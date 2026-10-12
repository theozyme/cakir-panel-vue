import { Prisma } from "../../../generated/prisma/client.js";
import type { VehicleOperationType, PaymentMethod } from "../../../generated/prisma/enums.js";
import { HttpError } from "../../lib/http-error.js";
import { optionalString } from "../../lib/validation.js";
import {
  historyFieldDefinitions,
  normalizeVehicleLabel,
  type HistoryFilters,
  type VehicleHistoryFilterOptions,
} from "../../../../shared/vehicle-history.js";

export type VehicleLabels = { brand: string | null; model: string | null }[];
export const vehicleLabelOptions = (
  labels: VehicleLabels,
): Pick<VehicleHistoryFilterOptions, "brands" | "models"> => {
  const brands = new Set<string>();
  const models = new Map<string, { brand: string | null; model: string }>();
  for (const item of labels) {
    const brand = item.brand?.trim() ? normalizeVehicleLabel(item.brand) : null;
    const model = item.model?.trim() ? normalizeVehicleLabel(item.model) : null;
    if (brand) brands.add(brand);
    if (model) models.set(JSON.stringify([brand, model]), { brand, model });
  }
  return {
    brands: [...brands].sort((a, b) => a.localeCompare(b, "tr")),
    models: [...models.values()].sort(
      (a, b) =>
        a.model.localeCompare(b.model, "tr") || (a.brand ?? "").localeCompare(b.brand ?? "", "tr"),
    ),
  };
};
export const parseHistoryInteger = (
  value: unknown,
  label: string,
  fallback?: number,
  maximum = 2_147_483_647,
) => {
  if (value === undefined || value === "") {
    if (fallback !== undefined) return fallback;
    throw new HttpError(400, `${label} zorunlu.`);
  }
  const text = typeof value === "number" ? String(value) : value;
  if (typeof text !== "string" || !/^\d+$/.test(text))
    throw new HttpError(400, `${label} pozitif tam sayı olmalı.`);
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum)
    throw new HttpError(400, `${label} geçersiz.`);
  return parsed;
};
const parseDate = (value: string, label: string) => {
  const date = new Date(`${value}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new HttpError(400, `${label} geçerli bir tarih olmalı (YYYY-MM-DD).`);
  }
  return new Date(`${value}T00:00:00+03:00`);
};
const dateRange = (
  from: string | undefined,
  to: string | undefined,
  label: string,
): Prisma.DateTimeFilter | undefined => {
  if (!from && !to) return undefined;
  const start = from ? parseDate(from, label) : undefined;
  const end = to ? parseDate(to, label) : undefined;
  if (start && end && start > end)
    throw new HttpError(400, `${label}: başlangıç bitişten sonra olamaz.`);
  return {
    ...(start ? { gte: start } : {}),
    ...(end ? { lt: new Date(end.getTime() + 86_400_000) } : {}),
  };
};
const parsePrice = (value: string, label: string) => {
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(value))
    throw new HttpError(
      400,
      `${label} sıfır veya pozitif, en fazla iki ondalıklı bir tutar olmalı.`,
    );
  return new Prisma.Decimal(value);
};
const contains = (value: string) => ({ contains: value, mode: "insensitive" as const });
const labelValues = (labels: VehicleLabels, field: "brand" | "model") => [
  ...new Set(
    labels.map((label) => label[field]).filter((value): value is string => value !== null),
  ),
];

export const buildHistoryFilter = (query: Record<string, unknown>, labels: VehicleLabels = []) => {
  const filters: HistoryFilters = {};
  for (const field of historyFieldDefinitions) {
    const value = optionalString(query[field.key], field.label, field.maxLength ?? 100);
    if (!value) continue;
    if (field.options && !field.options.some((option) => option.value === value))
      throw new HttpError(400, `${field.label} geçersiz.`);
    filters[field.key] = value;
  }
  const page = parseHistoryInteger(query.page, "Sayfa", 1);
  const pageSize = parseHistoryInteger(query.pageSize, "Sayfa boyutu", 20, 100);
  if ((page - 1) * pageSize > 2_147_483_647) throw new HttpError(400, "Sayfa numarası çok büyük.");
  const conditions: Prisma.VehicleOperationWhereInput[] = [];
  const { search } = filters;
  if (search)
    conditions.push({
      OR: [
        { vehicle: { plate: contains(search) } },
        { vehicle: { normalizedPlate: contains(search.toUpperCase().replace(/\s+/g, "")) } },
        { vehicle: { brand: contains(search) } },
        { vehicle: { model: contains(search) } },
        {
          vehicle: {
            brand: {
              in: labelValues(labels, "brand").filter((value) =>
                normalizeVehicleLabel(value).includes(normalizeVehicleLabel(search)),
              ),
            },
          },
        },
        {
          vehicle: {
            model: {
              in: labelValues(labels, "model").filter((value) =>
                normalizeVehicleLabel(value).includes(normalizeVehicleLabel(search)),
              ),
            },
          },
        },
        { visit: { customer: { firstName: contains(search) } } },
        { visit: { customer: { lastName: contains(search) } } },
        { visit: { customer: { phone: contains(search) } } },
      ],
    });
  if (filters.plate)
    conditions.push({
      vehicle: {
        OR: [
          { plate: contains(filters.plate) },
          { normalizedPlate: contains(filters.plate.toUpperCase().replace(/\s+/g, "")) },
        ],
      },
    });
  for (const field of ["brand", "model"] as const) {
    const values = labelValues(labels, field);
    const selected = filters[field];
    if (selected)
      conditions.push({
        vehicle: {
          [field]: {
            in: values.filter(
              (value) => normalizeVehicleLabel(value) === normalizeVehicleLabel(selected),
            ),
          },
        },
      });
    const state = filters[field === "brand" ? "brandState" : "modelState"];
    if (state) {
      const missing: Prisma.VehicleWhereInput = {
        OR: [{ [field]: null }, { [field]: { in: values.filter((value) => !value.trim()) } }],
      };
      conditions.push({ vehicle: state === "missing" ? missing : { NOT: missing } });
    }
  }
  for (const [key, field] of [
    ["customerFirstName", "firstName"],
    ["customerLastName", "lastName"],
    ["customerPhone", "phone"],
    ["customerNote", "note"],
  ] as const) {
    const value = filters[key];
    if (value) conditions.push({ visit: { customer: { [field]: contains(value) } } });
  }
  if (filters.customerState)
    conditions.push({
      visit: { customerId: filters.customerState === "missing" ? null : { not: null } },
    });
  for (const [key, field] of [
    ["description", "description"],
    ["operationNote", "note"],
  ] as const) {
    const value = filters[key];
    if (value) conditions.push({ [field]: contains(value) });
  }
  if (filters.visitNote) conditions.push({ visit: { note: contains(filters.visitNote) } });
  if (filters.operationType)
    conditions.push({
      operationType: filters.operationType as VehicleOperationType,
    });
  if (filters.operationTypeState)
    conditions.push({
      operationType: filters.operationTypeState === "missing" ? null : { not: null },
    });
  if (filters.paymentMethod)
    conditions.push({
      paymentMethod: filters.paymentMethod as PaymentMethod,
    });
  if (filters.currency) conditions.push({ currency: filters.currency });
  if (filters.minPrice || filters.maxPrice) {
    if (!filters.currency) throw new HttpError(400, "Ücret aralığı için para birimi seçin.");
    const min = filters.minPrice ? parsePrice(filters.minPrice, "Minimum ücret") : undefined;
    const max = filters.maxPrice ? parsePrice(filters.maxPrice, "Maksimum ücret") : undefined;
    if (min && max && min.gt(max))
      throw new HttpError(400, "Minimum ücret maksimum ücretten büyük olamaz.");
    conditions.push({ price: { ...(min ? { gte: min } : {}), ...(max ? { lte: max } : {}) } });
  }
  const operationRange = dateRange(filters.dateFrom, filters.dateTo, "İşlem tarihi");
  if (operationRange) conditions.push({ operationAt: operationRange });
  const arrivalRange = dateRange(filters.arrivalFrom, filters.arrivalTo, "Geliş tarihi");
  if (arrivalRange) conditions.push({ visit: { arrivalAt: arrivalRange } });
  for (const field of ["vehicleId", "visitId"] as const)
    if (filters[field]) conditions.push({ [field]: filters[field] });
  if (filters.operationId) conditions.push({ id: filters.operationId });
  if (filters.customerId) conditions.push({ visit: { customerId: filters.customerId } });
  for (const [field, state] of [
    ["mailOrderSupplierId", "supplierState"],
    ["multimediaProductId", "multimediaState"],
    ["screenProductId", "screenState"],
    ["soundOfferId", "soundOfferState"],
  ] as const) {
    if (filters[field]) conditions.push({ [field]: filters[field] });
    if (filters[state])
      conditions.push({ [field]: filters[state] === "missing" ? null : { not: null } });
  }
  if (filters.minRevision || filters.maxRevision) {
    const min = filters.minRevision
      ? parseHistoryInteger(filters.minRevision, "Minimum revizyon")
      : undefined;
    const max = filters.maxRevision
      ? parseHistoryInteger(filters.maxRevision, "Maksimum revizyon")
      : undefined;
    if (min && max && min > max)
      throw new HttpError(400, "Minimum revizyon maksimumdan büyük olamaz.");
    conditions.push({ revision: { ...(min ? { gte: min } : {}), ...(max ? { lte: max } : {}) } });
  }
  const recordRange = dateRange(filters.recordDateFrom, filters.recordDateTo, "Kayıt tarihi");
  if (recordRange) {
    if (!filters.recordDateField) throw new HttpError(400, "Kayıt tarihi alanını seçin.");
    switch (filters.recordDateField) {
      case "vehicleCreatedAt":
        conditions.push({ vehicle: { createdAt: recordRange } });
        break;
      case "vehicleUpdatedAt":
        conditions.push({ vehicle: { updatedAt: recordRange } });
        break;
      case "customerCreatedAt":
        conditions.push({ visit: { customer: { createdAt: recordRange } } });
        break;
      case "customerUpdatedAt":
        conditions.push({ visit: { customer: { updatedAt: recordRange } } });
        break;
      case "visitCreatedAt":
        conditions.push({ visit: { createdAt: recordRange } });
        break;
      case "operationCreatedAt":
        conditions.push({ createdAt: recordRange });
        break;
      case "operationUpdatedAt":
        conditions.push({ updatedAt: recordRange });
        break;
    }
  }
  const where: Prisma.VehicleOperationWhereInput = {
    deletedAt: null,
    ...(conditions.length ? { AND: conditions } : {}),
  };
  return { filters, page, pageSize, where };
};
