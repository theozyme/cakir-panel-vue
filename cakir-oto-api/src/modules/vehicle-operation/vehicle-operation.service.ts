import { Prisma } from "../../../generated/prisma/client.js";

import { getPrisma } from "../../lib/prisma.js";
import { HttpError, isPrismaErrorCode } from "../../lib/http-error.js";
import { moneyToString, parseMoney } from "../../lib/money.js";
import { withSerializableTransaction } from "../../lib/transaction.js";
import { asRecord, oneOf, optionalString, requiredString } from "../../lib/validation.js";
import {
  getAcceptedSoundOfferForOperation,
  markSoundOfferUsed,
} from "../sound-offer/sound-offer.service.js";
import { consumeMultimediaStock, consumeSoundStock } from "../stock-lookup/stock-lookup.service.js";
import { createVehicleOperationSupplierPayment } from "../supplier/supplier.service.js";
import type {
  CreateVehicleOperationResponse,
  CurrencyTotals,
  SupportedCurrency,
  VehicleOperationDailyResponse,
  VehicleOperationHistoryResponse,
  VehicleOperationVisitItem,
} from "./vehicle-operation.types.js";

const operationTypes = [
  "MULTIMEDIA",
  "SOUND_SYSTEM",
  "HIDDEN_FEATURE_ACTIVATION",
  "REAR_VIEW_CAMERA",
  "ANDROID_BOX",
  "DASH_CAMERA",
  "BULB",
  "LED_XENON",
  "BATTERY",
  "WIPER",
  "LABOR",
  "CAR_STEREO",
  "STEERING_WHEEL_COVER",
  "WINDOW_FILM",
  "PPF_COATING",
  "POWER_TAILGATE",
  "SERVICE",
  "ACCESSORY",
  "OTHER",
] as const;
const paymentMethods = ["CASH", "CREDIT_CARD", "BANK_TRANSFER", "MAIL_ORDER"] as const;
const currencies = ["TRY", "USD"] as const;

const parsePositiveInteger = (
  value: unknown,
  field: string,
  fallback: number,
  maximum?: number,
): number => {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new HttpError(400, `${field} pozitif bir tam sayi olmali`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || (maximum !== undefined && parsed > maximum)) {
    throw new HttpError(
      400,
      maximum === undefined
        ? `${field} pozitif bir tam sayi olmali`
        : `${field} 1-${maximum} arasinda olmali`,
    );
  }

  return parsed;
};

type CreateInput = {
  visitId: string;
  customer: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    note: string | null;
  } | null;
  vehicle: {
    brand: string | null;
    model: string | null;
  } | null;
  operation: {
    type: (typeof operationTypes)[number];
    description: string;
    priceInput: unknown;
    currency: SupportedCurrency;
    note: string | null;
    paymentMethod: (typeof paymentMethods)[number];
    multimediaProductId: string | null;
    screenProductId: string | null;
    soundOfferId: string | null;
    mailOrderSupplierId: string | null;
  };
};

const formatDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const parseDateKey = (value: unknown): string => {
  if (value === undefined) return formatDateKey(new Date());

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, "date YYYY-MM-DD formatinda olmali");
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    throw new HttpError(400, "date gecersiz");
  }

  return value;
};

const getDayRange = (dateKey: string): { start: Date; end: Date } => {
  const [yearText, monthText, dayText] = dateKey.split("-");
  const start = new Date(Number(yearText), Number(monthText) - 1, Number(dayText), 0, 0, 0, 0);
  const end = new Date(Number(yearText), Number(monthText) - 1, Number(dayText) + 1, 0, 0, 0, 0);
  return { start, end };
};

const emptyTotals = (): Record<SupportedCurrency, Prisma.Decimal> => ({
  TRY: new Prisma.Decimal(0),
  USD: new Prisma.Decimal(0),
});

const serializeTotals = (totals: Record<SupportedCurrency, Prisma.Decimal>): CurrencyTotals => ({
  TRY: moneyToString(totals.TRY),
  USD: moneyToString(totals.USD),
});

const parseCreateInput = (body: unknown): CreateInput => {
  const root = asRecord(body);
  const operation = asRecord(root.operation, "operation");
  const visitId = requiredString(root.visitId, "visitId");
  const type = oneOf(operation.type, "operation.type", operationTypes);
  const description = requiredString(operation.description, "operation.description", 150);
  const paymentMethod = oneOf(operation.paymentMethod, "operation.paymentMethod", paymentMethods);
  const currency = oneOf(operation.currency ?? "TRY", "operation.currency", currencies);
  const multimediaProductId = optionalString(
    operation.multimediaProductId,
    "operation.multimediaProductId",
  );
  const screenProductId = optionalString(operation.screenProductId, "operation.screenProductId");
  const soundOfferId = optionalString(operation.soundOfferId, "operation.soundOfferId");
  const mailOrderSupplierId = optionalString(
    operation.mailOrderSupplierId,
    "operation.mailOrderSupplierId",
  );

  if (type === "MULTIMEDIA" && (!multimediaProductId || !screenProductId)) {
    throw new HttpError(400, "Multimedia operation icin iki stok urunu de zorunlu");
  }

  if (type !== "MULTIMEDIA" && (multimediaProductId || screenProductId)) {
    throw new HttpError(400, "Stok urunleri sadece MULTIMEDIA operation icin gonderilebilir");
  }

  if (type === "SOUND_SYSTEM" && !soundOfferId) {
    throw new HttpError(400, "SOUND_SYSTEM operation icin soundOfferId zorunlu");
  }

  if (type !== "SOUND_SYSTEM" && soundOfferId) {
    throw new HttpError(400, "soundOfferId sadece SOUND_SYSTEM operation icin gonderilebilir");
  }

  if (paymentMethod === "MAIL_ORDER" && !mailOrderSupplierId) {
    throw new HttpError(400, "MAIL_ORDER odeme icin supplier zorunlu");
  }

  if (paymentMethod !== "MAIL_ORDER" && mailOrderSupplierId) {
    throw new HttpError(400, "Supplier sadece MAIL_ORDER odeme icin gonderilebilir");
  }

  let customer: CreateInput["customer"] = null;
  if (root.customer !== undefined && root.customer !== null) {
    const value = asRecord(root.customer, "customer");
    const parsed = {
      firstName: optionalString(value.firstName, "customer.firstName", 100),
      lastName: optionalString(value.lastName, "customer.lastName", 100),
      phone: optionalString(value.phone, "customer.phone", 30),
      note: optionalString(value.note, "customer.note"),
    };
    customer = Object.values(parsed).some((item) => item !== null) ? parsed : null;
  }

  let vehicle: CreateInput["vehicle"] = null;
  if (root.vehicle !== undefined && root.vehicle !== null) {
    const value = asRecord(root.vehicle, "vehicle");
    const parsed = {
      brand: optionalString(value.brand, "vehicle.brand", 100),
      model: optionalString(value.model, "vehicle.model", 100),
    };
    vehicle = parsed.brand || parsed.model ? parsed : null;
  }

  return {
    visitId,
    customer,
    vehicle,
    operation: {
      type,
      description,
      priceInput: operation.price,
      currency,
      note: optionalString(operation.note, "operation.note"),
      paymentMethod,
      multimediaProductId,
      screenProductId,
      soundOfferId,
      mailOrderSupplierId,
    },
  };
};

export const listDailyVehicleOperations = async (
  dateQuery: unknown,
): Promise<VehicleOperationDailyResponse> => {
  const date = parseDateKey(dateQuery);
  const { start, end } = getDayRange(date);
  const visits = await getPrisma().vehicleVisit.findMany({
    where: { arrivalAt: { gte: start, lt: end } },
    orderBy: { arrivalAt: "asc" },
    select: {
      id: true,
      arrivalAt: true,
      note: true,
      vehicle: { select: { id: true, plate: true, brand: true, model: true } },
      customer: { select: { firstName: true, lastName: true, phone: true } },
      operations: {
        orderBy: { operationAt: "asc" },
        select: {
          id: true,
          operationType: true,
          description: true,
          price: true,
          currency: true,
          paymentMethod: true,
          operationAt: true,
          note: true,
        },
      },
    },
  });

  const summaryTotals = emptyTotals();
  const items: VehicleOperationVisitItem[] = visits.map((visit) => {
    const totals = emptyTotals();
    const operations = visit.operations.map((operation) => {
      const currency = operation.currency as SupportedCurrency;
      totals[currency] = totals[currency].plus(operation.price);
      summaryTotals[currency] = summaryTotals[currency].plus(operation.price);

      return {
        id: operation.id,
        operationType: operation.operationType,
        description: operation.description,
        price: moneyToString(operation.price),
        currency,
        paymentMethod: operation.paymentMethod,
        operationAt: operation.operationAt.toISOString(),
        note: operation.note,
      };
    });

    return {
      visitId: visit.id,
      vehicleId: visit.vehicle.id,
      plate: visit.vehicle.plate,
      customer: visit.customer,
      vehicle: { brand: visit.vehicle.brand, model: visit.vehicle.model },
      arrivalAt: visit.arrivalAt.toISOString(),
      note: visit.note,
      operations,
      operationCount: operations.length,
      totalsByCurrency: serializeTotals(totals),
    };
  });

  return {
    date,
    visits: items,
    summary: {
      totalVehicles: items.length,
      totalOperations: items.reduce((sum, visit) => sum + visit.operationCount, 0),
      totalsByCurrency: serializeTotals(summaryTotals),
    },
  };
};

export const listVehicleOperationHistory = async (query: {
  search?: unknown;
  page?: unknown;
  pageSize?: unknown;
}): Promise<VehicleOperationHistoryResponse> => {
  const page = parsePositiveInteger(query.page, "page", 1);
  const pageSize = parsePositiveInteger(query.pageSize, "pageSize", 20, 100);
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const where: Prisma.VehicleOperationWhereInput = search
    ? {
        OR: [
          { vehicle: { plate: { contains: search, mode: "insensitive" } } },
          { visit: { customer: { firstName: { contains: search, mode: "insensitive" } } } },
          { visit: { customer: { lastName: { contains: search, mode: "insensitive" } } } },
          { visit: { customer: { phone: { contains: search, mode: "insensitive" } } } },
        ],
      }
    : {};

  const prisma = getPrisma();
  const [total, rows] = await Promise.all([
    prisma.vehicleOperation.count({ where }),
    prisma.vehicleOperation.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ operationAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        visitId: true,
        vehicleId: true,
        operationType: true,
        description: true,
        paymentMethod: true,
        price: true,
        currency: true,
        operationAt: true,
        note: true,
        vehicle: { select: { plate: true, brand: true, model: true } },
        visit: {
          select: {
            customer: { select: { firstName: true, lastName: true, phone: true } },
          },
        },
      },
    }),
  ]);

  return {
    items: rows.map((row) => ({
      operationId: row.id,
      visitId: row.visitId,
      vehicleId: row.vehicleId,
      plate: row.vehicle.plate,
      customer: row.visit.customer,
      vehicle: { brand: row.vehicle.brand, model: row.vehicle.model },
      operationType: row.operationType,
      description: row.description,
      paymentMethod: row.paymentMethod,
      price: moneyToString(row.price),
      currency: row.currency as SupportedCurrency,
      operationAt: row.operationAt.toISOString(),
      note: row.note,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

export const createVehicleOperation = async (
  body: unknown,
): Promise<CreateVehicleOperationResponse> => {
  const input = parseCreateInput(body);
  const operationAt = new Date();

  try {
    return await withSerializableTransaction(async (tx) => {
      const visit = await tx.vehicleVisit.findUnique({
        where: { id: input.visitId },
        select: { id: true, vehicleId: true },
      });

      if (!visit) throw new HttpError(404, "VehicleVisit bulunamadi");

      if (input.customer) {
        const customer = await tx.customer.create({ data: input.customer });
        await tx.vehicleVisit.update({
          where: { id: visit.id },
          data: { customerId: customer.id },
        });
      }

      if (input.vehicle) {
        await tx.vehicle.update({
          where: { id: visit.vehicleId },
          data: {
            ...(input.vehicle.brand ? { brand: input.vehicle.brand } : {}),
            ...(input.vehicle.model ? { model: input.vehicle.model } : {}),
          },
        });
      }

      const soundOffer = input.operation.soundOfferId
        ? await getAcceptedSoundOfferForOperation(tx, input.operation.soundOfferId)
        : null;
      const price = soundOffer
        ? (soundOffer.manualTotal ?? soundOffer.autoTotal)
        : parseMoney(input.operation.priceInput, "operation.price");
      const currency: SupportedCurrency = soundOffer ? "TRY" : input.operation.currency;

      const operation = await tx.vehicleOperation.create({
        data: {
          visitId: visit.id,
          vehicleId: visit.vehicleId,
          operationType: input.operation.type,
          description: input.operation.description,
          price,
          currency,
          paymentMethod: input.operation.paymentMethod,
          operationAt,
          note: input.operation.note,
          mailOrderSupplierId: input.operation.mailOrderSupplierId,
          multimediaProductId: input.operation.multimediaProductId,
          screenProductId: input.operation.screenProductId,
          soundOfferId: input.operation.soundOfferId,
        },
      });

      if (
        input.operation.type === "MULTIMEDIA" &&
        input.operation.multimediaProductId &&
        input.operation.screenProductId
      ) {
        await consumeMultimediaStock(
          tx,
          operation.id,
          input.operation.multimediaProductId,
          input.operation.screenProductId,
        );
      }

      if (soundOffer && input.operation.soundOfferId) {
        await markSoundOfferUsed(tx, input.operation.soundOfferId);
        await consumeSoundStock(tx, operation.id, soundOffer.items);
      }

      if (input.operation.paymentMethod === "MAIL_ORDER" && input.operation.mailOrderSupplierId) {
        await createVehicleOperationSupplierPayment({
          tx,
          supplierId: input.operation.mailOrderSupplierId,
          operationId: operation.id,
          amount: price,
          currency,
          transactionAt: operationAt,
        });
      }

      return {
        id: operation.id,
        visitId: operation.visitId,
        vehicleId: operation.vehicleId,
        operationType: input.operation.type,
        description: operation.description,
        price: moneyToString(operation.price),
        currency,
        paymentMethod: operation.paymentMethod,
        operationAt: operation.operationAt.toISOString(),
        note: operation.note,
        soundOfferId: operation.soundOfferId,
      };
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002") && input.operation.soundOfferId) {
      throw new HttpError(409, "Sound offer baska bir operation tarafindan kullanildi");
    }

    throw error;
  }
};
