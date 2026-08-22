import { Prisma } from "../../../generated/prisma/client.js";

import { HttpError, isPrismaErrorCode } from "../../lib/http-error.js";
import { parseMoney } from "../../lib/money.js";
import { getPrisma } from "../../lib/prisma.js";
import { withSerializableTransaction } from "../../lib/transaction.js";
import { asRecord, oneOf, optionalString, requiredString } from "../../lib/validation.js";
import type {
  InventoryActiveFilter,
  InventoryListFilter,
  InventoryListResponse,
  InventoryProduct,
  InventoryStatus,
  InventoryStockType,
} from "./inventory.types.js";

const stockTypes = ["MULTIMEDIA", "SCREEN", "SOUND_SYSTEM"] as const;

export const parseInventoryStockType = (value: unknown): InventoryStockType =>
  oneOf(value, "type", stockTypes);

const scalarQuery = (value: unknown, fieldName: string): string | null => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new HttpError(400, `${fieldName} tek bir string olmali`);
  return value.trim() || null;
};

const queryBoolean = (value: unknown, fieldName: string, fallback = false): boolean => {
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new HttpError(400, `${fieldName} true veya false olmali`);
};

const positiveQueryInteger = (
  value: unknown,
  fieldName: string,
  fallback: number,
  maximum: number,
): number => {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new HttpError(400, `${fieldName} pozitif integer olmali`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new HttpError(400, `${fieldName} 1-${maximum} araliginda olmali`);
  }
  return parsed;
};

export const parseInventoryListFilter = (query: unknown): InventoryListFilter => {
  const values = asRecord(query, "query");
  const activeText = scalarQuery(values.active, "active") ?? "true";
  const active = oneOf(activeText, "active", ["true", "false", "all"] as const);

  return {
    type: parseInventoryStockType(values.type),
    search: scalarQuery(values.search, "search"),
    brand: scalarQuery(values.brand, "brand"),
    criticalOnly: queryBoolean(values.criticalOnly, "criticalOnly"),
    active: active as InventoryActiveFilter,
    page: positiveQueryInteger(values.page, "page", 1, 100000),
    pageSize: positiveQueryInteger(values.pageSize, "pageSize", 50, 100),
  };
};

const inventoryStatus = (quantity: number, criticalStockLevel: number): InventoryStatus => {
  if (quantity === 0) return "OUT_OF_STOCK";
  return quantity <= criticalStockLevel ? "CRITICAL" : "SUFFICIENT";
};

const activeWhere = (active: InventoryActiveFilter) =>
  active === "all" ? {} : { isActive: active === "true" };

export const listInventoryProducts = async (
  filter: InventoryListFilter,
): Promise<InventoryListResponse> => {
  const prisma = getPrisma();
  const skip = (filter.page - 1) * filter.pageSize;

  if (filter.type === "MULTIMEDIA") {
    const where = {
      ...activeWhere(filter.active),
      ...(filter.criticalOnly
        ? { quantity: { lte: prisma.multimediaProduct.fields.criticalStockLevel } }
        : {}),
      ...(filter.brand ? { brand: { equals: filter.brand, mode: "insensitive" as const } } : {}),
      ...(filter.search
        ? {
            OR: [
              { code: { contains: filter.search, mode: "insensitive" as const } },
              { brand: { contains: filter.search, mode: "insensitive" as const } },
              { model: { contains: filter.search, mode: "insensitive" as const } },
              { forx: { contains: filter.search, mode: "insensitive" as const } },
              { shelf: { contains: filter.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.multimediaProduct.count({ where }),
      prisma.multimediaProduct.findMany({
        where,
        orderBy: [{ brand: "asc" }, { model: "asc" }, { code: "asc" }],
        skip,
        take: filter.pageSize,
      }),
    ]);
    return {
      total,
      page: filter.page,
      pageSize: filter.pageSize,
      items: rows.map((row) => ({
        type: "MULTIMEDIA" as const,
        id: row.id,
        code: row.code,
        brand: row.brand,
        model: row.model,
        forx: row.forx,
        shelf: row.shelf,
        quantity: row.quantity,
        criticalStockLevel: row.criticalStockLevel,
        isActive: row.isActive,
        status: inventoryStatus(row.quantity, row.criticalStockLevel),
      })),
    };
  }

  if (filter.type === "SCREEN") {
    const where = {
      ...activeWhere(filter.active),
      ...(filter.criticalOnly
        ? { quantity: { lte: prisma.screenProduct.fields.criticalStockLevel } }
        : {}),
      ...(filter.brand ? { brand: { equals: filter.brand, mode: "insensitive" as const } } : {}),
      ...(filter.search
        ? {
            OR: [
              { brand: { contains: filter.search, mode: "insensitive" as const } },
              { sizeLabel: { contains: filter.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.screenProduct.count({ where }),
      prisma.screenProduct.findMany({
        where,
        orderBy: [{ brand: "asc" }, { sizeInch: "asc" }],
        skip,
        take: filter.pageSize,
      }),
    ]);
    return {
      total,
      page: filter.page,
      pageSize: filter.pageSize,
      items: rows.map((row) => ({
        type: "SCREEN" as const,
        id: row.id,
        brand: row.brand,
        storageGb: row.storageGb,
        ramGb: row.ramGb,
        cores: row.cores,
        sizeInch: row.sizeInch?.toString() ?? null,
        sizeLabel: row.sizeLabel,
        quantity: row.quantity,
        criticalStockLevel: row.criticalStockLevel,
        isActive: row.isActive,
        status: inventoryStatus(row.quantity, row.criticalStockLevel),
      })),
    };
  }

  const where = {
    ...activeWhere(filter.active),
    ...(filter.criticalOnly
      ? { quantity: { lte: prisma.soundSystemProduct.fields.criticalStockLevel } }
      : {}),
    ...(filter.search
      ? { name: { contains: filter.search, mode: "insensitive" as const } }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.soundSystemProduct.count({ where }),
    prisma.soundSystemProduct.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: filter.pageSize,
    }),
  ]);
  return {
    total,
    page: filter.page,
    pageSize: filter.pageSize,
    items: rows.map((row) => ({
      type: "SOUND_SYSTEM" as const,
      id: row.id,
      name: row.name,
      purchasePriceUsd: row.purchasePriceUsd?.toFixed(2) ?? null,
      quantity: row.quantity,
      criticalStockLevel: row.criticalStockLevel,
      isActive: row.isActive,
      status: inventoryStatus(row.quantity, row.criticalStockLevel),
    })),
  };
};

const nonNegativeInteger = (value: unknown, fieldName: string): number => {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new HttpError(400, `${fieldName} sifir veya pozitif integer olmali`);
  }
  return Number(value);
};

const optionalNullableString = (
  values: Record<string, unknown>,
  key: string,
  maxLength: number,
): string | null | undefined =>
  Object.prototype.hasOwnProperty.call(values, key)
    ? optionalString(values[key], key, maxLength)
    : undefined;

const optionalNullableInteger = (
  values: Record<string, unknown>,
  key: string,
): number | null | undefined => {
  if (!Object.prototype.hasOwnProperty.call(values, key)) return undefined;
  if (values[key] === null || values[key] === "") return null;
  return nonNegativeInteger(values[key], key);
};

const optionalBoolean = (
  values: Record<string, unknown>,
  key: string,
): boolean | undefined => {
  if (!Object.prototype.hasOwnProperty.call(values, key)) return undefined;
  if (typeof values[key] !== "boolean") throw new HttpError(400, `${key} boolean olmali`);
  return values[key];
};

const decimalSize = (value: unknown, fieldName: string): Prisma.Decimal => {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new HttpError(400, `${fieldName} decimal olmali`);
  }
  const text = String(value).trim();
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(text)) {
    throw new HttpError(400, `${fieldName} gecersiz`);
  }
  const result = new Prisma.Decimal(text);
  if (!result.isPositive() || result.greaterThan("999.99")) {
    throw new HttpError(400, `${fieldName} 0-999.99 araliginda olmali`);
  }
  return result;
};

const optionalDecimalSize = (
  values: Record<string, unknown>,
  key: string,
): Prisma.Decimal | null | undefined => {
  if (!Object.prototype.hasOwnProperty.call(values, key)) return undefined;
  if (values[key] === null || values[key] === "") return null;
  return decimalSize(values[key], key);
};

const getInventoryProduct = async (
  type: InventoryStockType,
  id: string,
): Promise<InventoryProduct> => {
  const prisma = getPrisma();
  if (type === "MULTIMEDIA") {
    const row = await prisma.multimediaProduct.findUnique({ where: { id } });
    if (!row) throw new HttpError(404, "Multimedia urunu bulunamadi");
    return {
      type,
      id: row.id,
      code: row.code,
      brand: row.brand,
      model: row.model,
      forx: row.forx,
      shelf: row.shelf,
      quantity: row.quantity,
      criticalStockLevel: row.criticalStockLevel,
      isActive: row.isActive,
      status: inventoryStatus(row.quantity, row.criticalStockLevel),
    };
  }
  if (type === "SCREEN") {
    const row = await prisma.screenProduct.findUnique({ where: { id } });
    if (!row) throw new HttpError(404, "Ekran urunu bulunamadi");
    return {
      type,
      id: row.id,
      brand: row.brand,
      storageGb: row.storageGb,
      ramGb: row.ramGb,
      cores: row.cores,
      sizeInch: row.sizeInch?.toString() ?? null,
      sizeLabel: row.sizeLabel,
      quantity: row.quantity,
      criticalStockLevel: row.criticalStockLevel,
      isActive: row.isActive,
      status: inventoryStatus(row.quantity, row.criticalStockLevel),
    };
  }
  const row = await prisma.soundSystemProduct.findUnique({ where: { id } });
  if (!row) throw new HttpError(404, "Ses sistemi urunu bulunamadi");
  return {
    type,
    id: row.id,
    name: row.name,
    purchasePriceUsd: row.purchasePriceUsd?.toFixed(2) ?? null,
    quantity: row.quantity,
    criticalStockLevel: row.criticalStockLevel,
    isActive: row.isActive,
    status: inventoryStatus(row.quantity, row.criticalStockLevel),
  };
};

export const createInventoryProduct = async (body: unknown): Promise<InventoryProduct> => {
  const values = asRecord(body);
  const type = parseInventoryStockType(values.type);
  const initialQuantity = nonNegativeInteger(values.initialQuantity ?? 0, "initialQuantity");

  try {
    const id = await withSerializableTransaction(async (tx) => {
      let productId: string;
      if (type === "MULTIMEDIA") {
        const row = await tx.multimediaProduct.create({
          data: {
            code: requiredString(values.code, "code", 100),
            brand: requiredString(values.brand, "brand", 100),
            model: optionalString(values.model, "model", 150),
            forx: optionalString(values.forx, "forx", 100),
            shelf: optionalString(values.shelf, "shelf", 30),
            criticalStockLevel: nonNegativeInteger(
              values.criticalStockLevel ?? 0,
              "criticalStockLevel",
            ),
            quantity: initialQuantity,
          },
          select: { id: true },
        });
        productId = row.id;
      } else if (type === "SCREEN") {
        const sizeInch =
          values.sizeInch === undefined || values.sizeInch === null || values.sizeInch === ""
            ? null
            : decimalSize(values.sizeInch, "sizeInch");
        const sizeLabel = optionalString(values.sizeLabel, "sizeLabel", 100);
        if (sizeInch === null && sizeLabel === null) {
          throw new HttpError(400, "sizeInch veya sizeLabel zorunlu");
        }
        const row = await tx.screenProduct.create({
          data: {
            brand: requiredString(values.brand, "brand", 150),
            storageGb:
              values.storageGb === undefined || values.storageGb === null || values.storageGb === ""
                ? null
                : nonNegativeInteger(values.storageGb, "storageGb"),
            ramGb:
              values.ramGb === undefined || values.ramGb === null || values.ramGb === ""
                ? null
                : nonNegativeInteger(values.ramGb, "ramGb"),
            cores:
              values.cores === undefined || values.cores === null || values.cores === ""
                ? null
                : nonNegativeInteger(values.cores, "cores"),
            sizeInch,
            sizeLabel,
            criticalStockLevel: nonNegativeInteger(
              values.criticalStockLevel ?? 0,
              "criticalStockLevel",
            ),
            quantity: initialQuantity,
          },
          select: { id: true },
        });
        productId = row.id;
      } else {
        const row = await tx.soundSystemProduct.create({
          data: {
            name: requiredString(values.name, "name", 180),
            purchasePriceUsd: parseMoney(values.purchasePriceUsd, "purchasePriceUsd"),
            criticalStockLevel: nonNegativeInteger(
              values.criticalStockLevel ?? 0,
              "criticalStockLevel",
            ),
            quantity: initialQuantity,
          },
          select: { id: true },
        });
        productId = row.id;
      }

      if (initialQuantity > 0) {
        await tx.stockMovement.create({
          data: {
            stockType: type,
            productId,
            movementType: "MANUAL_CORRECTION",
            quantity: initialQuantity,
            referenceType: "INVENTORY_PRODUCT",
            referenceId: productId,
            note: "Initial stock",
          },
        });
      }
      return productId;
    });
    return getInventoryProduct(type, id);
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) throw new HttpError(409, "Urun zaten mevcut");
    throw error;
  }
};

export const updateInventoryProduct = async (
  type: InventoryStockType,
  id: string,
  body: unknown,
): Promise<InventoryProduct> => {
  const values = asRecord(body);
  if (
    Object.prototype.hasOwnProperty.call(values, "quantity") ||
    Object.prototype.hasOwnProperty.call(values, "initialQuantity")
  ) {
    throw new HttpError(400, "quantity yalniz stock movement ile degistirilebilir");
  }

  try {
    if (type === "MULTIMEDIA") {
      const data = {
        ...(Object.prototype.hasOwnProperty.call(values, "code")
          ? { code: requiredString(values.code, "code", 100) }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(values, "brand")
          ? { brand: requiredString(values.brand, "brand", 100) }
          : {}),
        ...(optionalNullableString(values, "model", 150) !== undefined
          ? { model: optionalNullableString(values, "model", 150) }
          : {}),
        ...(optionalNullableString(values, "forx", 100) !== undefined
          ? { forx: optionalNullableString(values, "forx", 100) }
          : {}),
        ...(optionalNullableString(values, "shelf", 30) !== undefined
          ? { shelf: optionalNullableString(values, "shelf", 30) }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(values, "criticalStockLevel")
          ? {
              criticalStockLevel: nonNegativeInteger(
                values.criticalStockLevel,
                "criticalStockLevel",
              ),
            }
          : {}),
        ...(optionalBoolean(values, "isActive") !== undefined
          ? { isActive: optionalBoolean(values, "isActive") }
          : {}),
      };
      if (Object.keys(data).length === 0) throw new HttpError(400, "Guncellenecek alan yok");
      const result = await getPrisma().multimediaProduct.updateMany({ where: { id }, data });
      if (result.count !== 1) throw new HttpError(404, "Multimedia urunu bulunamadi");
    } else if (type === "SCREEN") {
      const sizeInch = optionalDecimalSize(values, "sizeInch");
      const sizeLabel = optionalNullableString(values, "sizeLabel", 100);
      if (sizeInch !== undefined || sizeLabel !== undefined) {
        const current = await getPrisma().screenProduct.findUnique({
          where: { id },
          select: { sizeInch: true, sizeLabel: true },
        });
        if (!current) throw new HttpError(404, "Ekran urunu bulunamadi");
        if (
          (sizeInch === undefined ? current.sizeInch : sizeInch) === null &&
          (sizeLabel === undefined ? current.sizeLabel : sizeLabel) === null
        ) {
          throw new HttpError(400, "sizeInch veya sizeLabel zorunlu");
        }
      }
      const data = {
        ...(Object.prototype.hasOwnProperty.call(values, "brand")
          ? { brand: requiredString(values.brand, "brand", 150) }
          : {}),
        ...(optionalNullableInteger(values, "storageGb") !== undefined
          ? { storageGb: optionalNullableInteger(values, "storageGb") }
          : {}),
        ...(optionalNullableInteger(values, "ramGb") !== undefined
          ? { ramGb: optionalNullableInteger(values, "ramGb") }
          : {}),
        ...(optionalNullableInteger(values, "cores") !== undefined
          ? { cores: optionalNullableInteger(values, "cores") }
          : {}),
        ...(sizeInch !== undefined ? { sizeInch } : {}),
        ...(sizeLabel !== undefined ? { sizeLabel } : {}),
        ...(Object.prototype.hasOwnProperty.call(values, "criticalStockLevel")
          ? {
              criticalStockLevel: nonNegativeInteger(
                values.criticalStockLevel,
                "criticalStockLevel",
              ),
            }
          : {}),
        ...(optionalBoolean(values, "isActive") !== undefined
          ? { isActive: optionalBoolean(values, "isActive") }
          : {}),
      };
      if (Object.keys(data).length === 0) throw new HttpError(400, "Guncellenecek alan yok");
      const result = await getPrisma().screenProduct.updateMany({ where: { id }, data });
      if (result.count !== 1) throw new HttpError(404, "Ekran urunu bulunamadi");
    } else {
      let purchasePriceUsd: Prisma.Decimal | null | undefined;
      if (Object.prototype.hasOwnProperty.call(values, "purchasePriceUsd")) {
        purchasePriceUsd =
          values.purchasePriceUsd === null || values.purchasePriceUsd === ""
            ? null
            : parseMoney(values.purchasePriceUsd, "purchasePriceUsd");
      }
      const data = {
        ...(Object.prototype.hasOwnProperty.call(values, "name")
          ? { name: requiredString(values.name, "name", 180) }
          : {}),
        ...(purchasePriceUsd !== undefined ? { purchasePriceUsd } : {}),
        ...(Object.prototype.hasOwnProperty.call(values, "criticalStockLevel")
          ? {
              criticalStockLevel: nonNegativeInteger(
                values.criticalStockLevel,
                "criticalStockLevel",
              ),
            }
          : {}),
        ...(optionalBoolean(values, "isActive") !== undefined
          ? { isActive: optionalBoolean(values, "isActive") }
          : {}),
      };
      if (Object.keys(data).length === 0) throw new HttpError(400, "Guncellenecek alan yok");
      const result = await getPrisma().soundSystemProduct.updateMany({ where: { id }, data });
      if (result.count !== 1) throw new HttpError(404, "Ses sistemi urunu bulunamadi");
    }
    return getInventoryProduct(type, id);
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) throw new HttpError(409, "Urun zaten mevcut");
    throw error;
  }
};

export const adjustInventoryStock = async (
  type: InventoryStockType,
  id: string,
  body: unknown,
): Promise<InventoryProduct> => {
  const values = asRecord(body);
  const quantityDelta = values.quantityDelta;
  if (!Number.isSafeInteger(quantityDelta) || Number(quantityDelta) === 0) {
    throw new HttpError(400, "quantityDelta sifir olmayan signed integer olmali");
  }
  const delta = Number(quantityDelta);
  const note = optionalString(values.note, "note", 1000);

  await withSerializableTransaction(async (tx) => {
    const stockCondition = delta < 0 ? { quantity: { gte: Math.abs(delta) } } : {};
    let count = 0;
    if (type === "MULTIMEDIA") {
      count = (
        await tx.multimediaProduct.updateMany({
          where: { id, isActive: true, ...stockCondition },
          data: { quantity: { increment: delta } },
        })
      ).count;
    } else if (type === "SCREEN") {
      count = (
        await tx.screenProduct.updateMany({
          where: { id, isActive: true, ...stockCondition },
          data: { quantity: { increment: delta } },
        })
      ).count;
    } else {
      count = (
        await tx.soundSystemProduct.updateMany({
          where: { id, isActive: true, ...stockCondition },
          data: { quantity: { increment: delta } },
        })
      ).count;
    }

    if (count !== 1) {
      const existing =
        type === "MULTIMEDIA"
          ? await tx.multimediaProduct.findUnique({ where: { id }, select: { isActive: true } })
          : type === "SCREEN"
            ? await tx.screenProduct.findUnique({ where: { id }, select: { isActive: true } })
            : await tx.soundSystemProduct.findUnique({ where: { id }, select: { isActive: true } });
      if (!existing) throw new HttpError(404, "Urun bulunamadi");
      if (!existing.isActive) throw new HttpError(409, "Pasif urunun stogu degistirilemez");
      throw new HttpError(409, "Stok miktari negatif olamaz");
    }

    await tx.stockMovement.create({
      data: {
        stockType: type,
        productId: id,
        movementType: "MANUAL_CORRECTION",
        quantity: delta,
        referenceType: "MANUAL_CORRECTION",
        referenceId: null,
        note,
      },
    });
  });

  return getInventoryProduct(type, id);
};
