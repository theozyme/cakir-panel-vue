import { Prisma } from "../../../generated/prisma/client.js";

import { getPrisma } from "../../lib/prisma.js";
import { HttpError } from "../../lib/http-error.js";
import { parseMoney } from "../../lib/money.js";
import type { BusinessTransaction } from "../../lib/transaction.js";
import { asRecord, oneOf, optionalString, requiredString } from "../../lib/validation.js";
import { getUsdExchangeRate } from "../exchange-rate/exchange-rate.service.js";
import type { CreateSoundOfferInput, SoundOfferDto } from "./sound-offer.types.js";

type SoundOfferRow = Prisma.SoundSystemOfferGetPayload<{
  include: {
    items: true;
    operation: { select: { id: true } };
  };
}>;

const SOUND_OFFER_SALE_MULTIPLIERS = {
  CASH: new Prisma.Decimal("1.50"),
  CARD: new Prisma.Decimal("1.60"),
} as const;

const toDto = (row: SoundOfferRow): SoundOfferDto => ({
  id: row.id,
  manualTotal: row.manualTotal?.toFixed(2) ?? null,
  autoTotal: row.autoTotal.toFixed(2),
  finalTotal: (row.manualTotal ?? row.autoTotal).toFixed(2),
  exchangeRate: row.exchangeRate.toFixed(4),
  saleType: row.saleType,
  status: row.status,
  createdAt: row.createdAt.toISOString(),
  operationId: row.operation?.id ?? null,
  items: row.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    productName: item.productNameSnapshot,
    unitPurchasePriceUsd: item.unitPurchasePriceUsd?.toFixed(2) ?? null,
    quantity: item.quantity,
    lineTotal: item.lineTotal?.toFixed(2) ?? null,
  })),
});

const parseCreateInput = (body: unknown): CreateSoundOfferInput => {
  const input = asRecord(body);
  const saleType = oneOf(input.saleType, "saleType", ["CASH", "CARD"] as const);

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new HttpError(400, "items en az bir kalem icermeli");
  }

  const aggregated = new Map<string, number>();

  input.items.forEach((value, index) => {
    const item = asRecord(value, `items[${index}]`);
    const productId = requiredString(item.productId, `items[${index}].productId`);
    const quantity = item.quantity;

    if (!Number.isSafeInteger(quantity) || Number(quantity) <= 0) {
      throw new HttpError(400, `items[${index}].quantity pozitif integer olmali`);
    }

    aggregated.set(productId, (aggregated.get(productId) ?? 0) + Number(quantity));
  });

  const manualTotalText = optionalString(input.manualTotal, "manualTotal");

  if (manualTotalText !== null) {
    parseMoney(manualTotalText, "manualTotal");
  }

  return {
    saleType,
    items: [...aggregated.entries()].map(([productId, quantity]) => ({ productId, quantity })),
    manualTotal: manualTotalText,
  };
};

const includeOffer = {
  items: true,
  operation: { select: { id: true } },
} as const;

export const createSoundOffer = async (body: unknown): Promise<SoundOfferDto> => {
  const input = parseCreateInput(body);
  const exchangeRateResult = await getUsdExchangeRate();
  const exchangeRate = new Prisma.Decimal(exchangeRateResult.rate);
  const prisma = getPrisma();

  const offer = await prisma.$transaction(async (tx) => {
    const products = await tx.soundSystemProduct.findMany({
      where: {
        id: { in: input.items.map((item) => item.productId) },
        isActive: true,
      },
    });
    const productMap = new Map(products.map((product) => [product.id, product]));

    if (productMap.size !== input.items.length) {
      throw new HttpError(400, "Teklif urunlerinden biri bulunamadi veya aktif degil");
    }

    const lines = input.items.map((item) => {
      const product = productMap.get(item.productId)!;

      if (product.purchasePriceUsd === null) {
        throw new HttpError(409, `${product.name} icin alis USD fiyati tanimli degil`);
      }

      const lineTotal = product.purchasePriceUsd
        .mul(exchangeRate)
        .mul(SOUND_OFFER_SALE_MULTIPLIERS[input.saleType])
        .mul(item.quantity)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

      return {
        product,
        quantity: item.quantity,
        lineTotal,
      };
    });
    const autoTotal = lines
      .reduce((total, line) => total.plus(line.lineTotal), new Prisma.Decimal(0))
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const manualTotal = input.manualTotal ? parseMoney(input.manualTotal, "manualTotal") : null;

    const created = await tx.soundSystemOffer.create({
      data: {
        manualTotal,
        autoTotal,
        exchangeRate,
        saleType: input.saleType,
        status: "ACCEPTED",
        items: {
          create: lines.map((line) => ({
            productId: line.product.id,
            productNameSnapshot: line.product.name,
            unitPurchasePriceUsd: line.product.purchasePriceUsd,
            quantity: line.quantity,
            lineTotal: line.lineTotal,
          })),
        },
      },
      include: includeOffer,
    });

    return created;
  });

  return toDto(offer);
};

export const getSoundOffer = async (offerId: string): Promise<SoundOfferDto> => {
  const offer = await getPrisma().soundSystemOffer.findUnique({
    where: { id: offerId },
    include: includeOffer,
  });

  if (!offer) {
    throw new HttpError(404, "Sound offer bulunamadi");
  }

  return toDto(offer);
};

export const listSoundOffers = async (): Promise<SoundOfferDto[]> => {
  const offers = await getPrisma().soundSystemOffer.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: includeOffer,
  });

  return offers.map(toDto);
};

export const getAcceptedSoundOfferForOperation = async (
  tx: BusinessTransaction,
  offerId: string,
) => {
  const offer = await tx.soundSystemOffer.findUnique({
    where: { id: offerId },
    include: { items: true },
  });

  if (!offer) {
    throw new HttpError(404, "Sound offer bulunamadi");
  }

  if (offer.status !== "ACCEPTED") {
    throw new HttpError(409, "Sound offer kullanilabilir durumda degil");
  }

  if (offer.items.length === 0) {
    throw new HttpError(409, "Sound offer kalemi bulunamadi");
  }

  return offer;
};

export const markSoundOfferUsed = async (tx: BusinessTransaction, offerId: string) => {
  const update = await tx.soundSystemOffer.updateMany({
    where: {
      id: offerId,
      status: "ACCEPTED",
    },
    data: {
      status: "USED",
    },
  });

  if (update.count !== 1) {
    throw new HttpError(409, "Sound offer daha once kullanilmis veya iptal edilmis");
  }
};
