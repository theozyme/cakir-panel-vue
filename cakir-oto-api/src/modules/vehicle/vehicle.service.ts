import { getPrisma } from "../../lib/prisma.js";
import { HttpError } from "../../lib/http-error.js";
import { moneyToString } from "../../lib/money.js";
import type { SupportedCurrency } from "../vehicle-operation/vehicle-operation.types.js";
import type { VehicleHistoryResponse, VehicleIntakeContext, VehicleLookupResponse } from "./vehicle.types.js";

const parseLimit = (value: unknown): number => {
  if (value === undefined) return 10;
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new HttpError(400, "limit pozitif bir tam sayi olmali");
  }
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 25) {
    throw new HttpError(400, "limit 1-25 arasinda olmali");
  }
  return limit;
};

export const listVehicles = async (
  searchQuery: unknown,
  limitQuery: unknown,
): Promise<VehicleLookupResponse> => {
  const search = typeof searchQuery === "string" ? searchQuery.trim() : "";
  const rows = await getPrisma().vehicle.findMany({
    ...(search ? { where: { plate: { contains: search, mode: "insensitive" as const } } } : {}),
    take: parseLimit(limitQuery),
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      plate: true,
      brand: true,
      model: true,
      visits: {
        where: { customerId: { not: null } },
        orderBy: [{ arrivalAt: "desc" }, { id: "desc" }],
        take: 1,
        select: {
          customer: {
            select: { id: true, firstName: true, lastName: true, phone: true, note: true },
          },
        },
      },
    },
  });

  return {
    items: rows.map((row) => ({
      vehicleId: row.id,
      plate: row.plate,
      brand: row.brand,
      model: row.model,
      customer: row.visits[0]?.customer ?? null,
    })),
  };
};

export const getVehicleIntakeContext = async (vehicleId: string): Promise<VehicleIntakeContext> => {
  if (!vehicleId) throw new HttpError(400, "vehicleId zorunlu");
  const row = await getPrisma().vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      id: true,
      plate: true,
      brand: true,
      model: true,
      visits: {
        where: { customerId: { not: null } },
        orderBy: [{ arrivalAt: "desc" }, { id: "desc" }],
        take: 1,
        select: { customer: { select: { id: true, firstName: true, lastName: true, phone: true, note: true } } },
      },
    },
  });
  if (!row) throw new HttpError(404, "Vehicle bulunamadi");
  return {
    vehicle: { id: row.id, plate: row.plate, brand: row.brand, model: row.model },
    customer: row.visits[0]?.customer ?? null,
  };
};

export const getVehicleHistory = async (vehicleId: string): Promise<VehicleHistoryResponse> => {
  if (!vehicleId) throw new HttpError(400, "vehicleId zorunlu");

  const row = await getPrisma().vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      id: true,
      plate: true,
      brand: true,
      model: true,
      visits: {
        where: { operations: { some: { deletedAt: null } } },
        orderBy: [{ arrivalAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          arrivalAt: true,
          note: true,
          customer: {
            select: { id: true, firstName: true, lastName: true, phone: true, note: true },
          },
          operations: {
            where: { deletedAt: null },
            orderBy: [{ operationAt: "desc" }, { id: "desc" }],
            select: {
              id: true,
              description: true,
              operationType: true,
              price: true,
              currency: true,
              paymentMethod: true,
              operationAt: true,
              note: true,
              revision: true,
              multimediaProduct: {
                select: { id: true, code: true, forx: true, model: true, brand: true, shelf: true },
              },
              screenProduct: {
                select: {
                  id: true,
                  brand: true,
                  storageGb: true,
                  ramGb: true,
                  cores: true,
                  sizeInch: true,
                  sizeLabel: true,
                },
              },
              soundOffer: {
                select: {
                  id: true,
                  status: true,
                  saleType: true,
                  manualTotal: true,
                  autoTotal: true,
                  exchangeRate: true,
                  items: {
                    orderBy: { createdAt: "asc" },
                    select: {
                      id: true,
                      productId: true,
                      productNameSnapshot: true,
                      quantity: true,
                      unitPurchasePriceUsd: true,
                      lineTotal: true,
                    },
                  },
                },
              },
              mailOrderSupplier: { select: { id: true, name: true, currency: true } },
            },
          },
        },
      },
    },
  });

  if (!row) throw new HttpError(404, "Vehicle bulunamadi");
  const latestCustomer = row.visits.find((visit) => visit.customer)?.customer ?? null;

  return {
    vehicle: { id: row.id, plate: row.plate, brand: row.brand, model: row.model },
    customer: latestCustomer,
    visits: row.visits.map((visit) => ({
      visitId: visit.id,
      arrivalAt: visit.arrivalAt.toISOString(),
      visitNote: visit.note,
      customer: visit.customer,
      operations: visit.operations.map((operation) => ({
        operationId: operation.id,
        description: operation.description,
        operationType: operation.operationType,
        price: moneyToString(operation.price),
        currency: operation.currency as SupportedCurrency,
        paymentMethod: operation.paymentMethod,
        operationAt: operation.operationAt.toISOString(),
        note: operation.note,
        revision: operation.revision,
        multimediaProduct: operation.multimediaProduct,
        screenProduct: operation.screenProduct
          ? {
              ...operation.screenProduct,
              sizeInch: operation.screenProduct.sizeInch
                ? operation.screenProduct.sizeInch.toString()
                : null,
            }
          : null,
        soundOffer: operation.soundOffer
          ? {
              id: operation.soundOffer.id,
              status: operation.soundOffer.status,
              saleType: operation.soundOffer.saleType,
              finalTotal: moneyToString(
                operation.soundOffer.manualTotal ?? operation.soundOffer.autoTotal,
              ),
              exchangeRate: operation.soundOffer.exchangeRate.toString(),
              items: operation.soundOffer.items.map((item) => ({
                id: item.id,
                productId: item.productId,
                productName: item.productNameSnapshot,
                quantity: item.quantity,
                unitPurchasePriceUsd: item.unitPurchasePriceUsd?.toString() ?? null,
                lineTotal: item.lineTotal?.toString() ?? null,
              })),
            }
          : null,
        mailOrderSupplier: operation.mailOrderSupplier,
      })),
    })),
  };
};
