import { getPrisma } from "../../lib/prisma.js";
import { HttpError } from "../../lib/http-error.js";
import type { BusinessTransaction } from "../../lib/transaction.js";
import type {
  MultimediaProductDto,
  ScreenProductDto,
  SoundStockConsumptionItem,
  SoundSystemProductDto,
} from "./stock-lookup.types.js";

export const listMultimediaProducts = async (
  inStockOnly: boolean,
): Promise<MultimediaProductDto[]> =>
  getPrisma().multimediaProduct.findMany({
    where: {
      isActive: true,
      ...(inStockOnly ? { quantity: { gt: 0 } } : {}),
    },
    orderBy: [{ brand: "asc" }, { model: "asc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      forx: true,
      model: true,
      brand: true,
      shelf: true,
      quantity: true,
    },
  });

export const listScreenProducts = async (inStockOnly: boolean): Promise<ScreenProductDto[]> => {
  const rows = await getPrisma().screenProduct.findMany({
    where: {
      isActive: true,
      ...(inStockOnly ? { quantity: { gt: 0 } } : {}),
    },
    orderBy: [{ brand: "asc" }, { sizeInch: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    brand: row.brand,
    storageGb: row.storageGb,
    ramGb: row.ramGb,
    cores: row.cores,
    sizeInch: row.sizeInch?.toString() ?? null,
    sizeLabel: row.sizeLabel,
    quantity: row.quantity,
  }));
};

export const listSoundSystemProducts = async (
  activeOnly: boolean,
): Promise<SoundSystemProductDto[]> => {
  const rows = await getPrisma().soundSystemProduct.findMany({
    ...(activeOnly ? { where: { isActive: true } } : {}),
    orderBy: { name: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    purchasePriceUsd: row.purchasePriceUsd?.toString() ?? null,
    cashSalePriceUsd: row.cashSalePrice?.toString() ?? null,
    cardSalePriceUsd: row.cardSalePrice?.toString() ?? null,
    quantity: row.quantity,
    criticalStockLevel: row.criticalStockLevel,
  }));
};

export const consumeMultimediaStock = async (
  tx: BusinessTransaction,
  operationId: string,
  multimediaProductId: string,
  screenProductId: string,
) => {
  const multimediaUpdate = await tx.multimediaProduct.updateMany({
    where: {
      id: multimediaProductId,
      isActive: true,
      quantity: { gte: 1 },
    },
    data: {
      quantity: { decrement: 1 },
    },
  });

  if (multimediaUpdate.count !== 1) {
    throw new HttpError(409, "Multimedya urunu bulunamadi veya stokta yok");
  }

  const screenUpdate = await tx.screenProduct.updateMany({
    where: {
      id: screenProductId,
      isActive: true,
      quantity: { gte: 1 },
    },
    data: {
      quantity: { decrement: 1 },
    },
  });

  if (screenUpdate.count !== 1) {
    throw new HttpError(409, "Ekran urunu bulunamadi veya stokta yok");
  }

  await tx.stockMovement.createMany({
    data: [
      {
        stockType: "MULTIMEDIA",
        productId: multimediaProductId,
        movementType: "VEHICLE_OPERATION",
        quantity: -1,
        referenceType: "VEHICLE_OPERATION",
        referenceId: operationId,
      },
      {
        stockType: "SCREEN",
        productId: screenProductId,
        movementType: "VEHICLE_OPERATION",
        quantity: -1,
        referenceType: "VEHICLE_OPERATION",
        referenceId: operationId,
      },
    ],
  });
};

export const consumeSoundStock = async (
  tx: BusinessTransaction,
  operationId: string,
  items: SoundStockConsumptionItem[],
) => {
  const aggregated = new Map<string, number>();

  for (const item of items) {
    if (!item.productId) {
      throw new HttpError(409, "Teklif kalemlerinden biri aktif bir stok urunune bagli degil");
    }

    aggregated.set(item.productId, (aggregated.get(item.productId) ?? 0) + item.quantity);
  }

  const sortedItems = [...aggregated.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );

  for (const [productId, quantity] of sortedItems) {
    const update = await tx.soundSystemProduct.updateMany({
      where: {
        id: productId,
        isActive: true,
        quantity: { gte: quantity },
      },
      data: {
        quantity: { decrement: quantity },
      },
    });

    if (update.count !== 1) {
      throw new HttpError(409, "Ses sistemi urunlerinden biri icin stok yetersiz");
    }
  }

  await tx.stockMovement.createMany({
    data: sortedItems.map(([productId, quantity]) => ({
      stockType: "SOUND_SYSTEM" as const,
      productId,
      movementType: "VEHICLE_OPERATION" as const,
      quantity: -quantity,
      referenceType: "VEHICLE_OPERATION",
      referenceId: operationId,
    })),
  });
};
