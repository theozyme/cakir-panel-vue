import { getPrisma } from "../../lib/prisma.js";
import { moneyToString } from "../../lib/money.js";
import { buildHistoryFilter, vehicleLabelOptions } from "./history-filters.js";
import type {
  SupportedCurrency,
  VehicleOperationHistoryResponse,
} from "./vehicle-operation.types.js";
import type { VehicleHistoryFilterOptions } from "../../../../shared/vehicle-history.js";

const loadVehicleLabels = () =>
  getPrisma().vehicle.findMany({
    where: { operations: { some: { deletedAt: null } } },
    distinct: ["brand", "model"],
    select: { brand: true, model: true },
  });

export const listVehicleHistoryFilterOptions = async (): Promise<VehicleHistoryFilterOptions> => {
  const prisma = getPrisma();
  const activeOperations = { some: { deletedAt: null } };
  const [labels, suppliers, multimedia, screens, offers] = await Promise.all([
    loadVehicleLabels(),
    prisma.supplier.findMany({
      where: { operations: activeOperations },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.multimediaProduct.findMany({
      where: { operations: activeOperations },
      select: { id: true, code: true, brand: true, model: true },
      orderBy: { code: "asc" },
    }),
    prisma.screenProduct.findMany({
      where: { operations: activeOperations },
      select: { id: true, brand: true, sizeLabel: true, sizeInch: true },
      orderBy: { brand: "asc" },
    }),
    prisma.soundSystemOffer.findMany({
      where: { operation: { is: { deletedAt: null } } },
      select: {
        id: true,
        createdAt: true,
        operation: { select: { vehicle: { select: { plate: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return {
    ...vehicleLabelOptions(labels),
    mailOrderSupplierId: suppliers.map((item) => ({ value: item.id, label: item.name })),
    multimediaProductId: multimedia.map((item) => ({
      value: item.id,
      label: [item.code, item.brand, item.model].filter(Boolean).join(" · "),
    })),
    screenProductId: screens.map((item) => ({
      value: item.id,
      label: [
        item.brand,
        item.sizeLabel ?? (item.sizeInch ? `${item.sizeInch} inç` : null),
        item.id.slice(0, 8),
      ]
        .filter(Boolean)
        .join(" · "),
    })),
    soundOfferId: offers.map((item) => ({
      value: item.id,
      label: [
        item.operation?.vehicle.plate,
        item.createdAt.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" }),
        item.id.slice(0, 8),
      ]
        .filter(Boolean)
        .join(" · "),
    })),
  };
};

export const listVehicleOperationHistory = async (
  query: Record<string, unknown>,
): Promise<VehicleOperationHistoryResponse> => {
  // Validate before running queries, including malformed/array query parameters.
  buildHistoryFilter(query);
  const labels =
    query.search || query.brand || query.model || query.brandState || query.modelState
      ? await loadVehicleLabels()
      : [];
  const { page, pageSize, where } = buildHistoryFilter(query, labels);
  const prisma = getPrisma();
  const [total, rows] = await prisma.$transaction(
    [
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
          revision: true,
          vehicle: { select: { plate: true, brand: true, model: true } },
          visit: {
            select: { customer: { select: { firstName: true, lastName: true, phone: true } } },
          },
        },
      }),
    ],
    { isolationLevel: "RepeatableRead" },
  );
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
      revision: row.revision,
      hasStockImpact: row.operationType === "MULTIMEDIA" || row.operationType === "SOUND_SYSTEM",
      hasMailOrderImpact: row.paymentMethod === "MAIL_ORDER",
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
};
