import { Prisma } from "../../../generated/prisma/client.js";

import { HttpError, isPrismaErrorCode } from "../../lib/http-error.js";
import { moneyToString, parseMoney } from "../../lib/money.js";
import { getPrisma } from "../../lib/prisma.js";
import type { BusinessTransaction } from "../../lib/transaction.js";
import { withSerializableTransaction } from "../../lib/transaction.js";
import { asRecord, oneOf, optionalString, requiredString } from "../../lib/validation.js";
import { inventoryStatus, parseInventoryStockType } from "../inventory/inventory.service.js";
import type { InventoryStockType } from "../inventory/inventory.types.js";
import type {
  StockOrderDto,
  StockOrderListFilter,
  StockOrderListResponse,
  StockOrderPaymentMethodValue,
  StockOrderPaymentStatusValue,
  StockOrderStatusValue,
} from "./stock-order.types.js";

const statuses = ["DRAFT", "ORDERED", "RECEIVED", "CANCELLED"] as const;
const paymentStatuses = ["UNPAID", "PARTIAL", "PAID"] as const;
const paymentMethods = ["CASH", "CREDIT_CARD", "BANK_TRANSFER", "CHECK", "TERM"] as const;

type ParsedOrderItem = {
  stockType: InventoryStockType;
  isNewProduct: boolean;
  productId: string | null;
  productSnapshot: Record<string, unknown> | null;
  quantity: number;
  unitPrice: Prisma.Decimal;
};

type ParsedOrderInput = {
  supplierId: string;
  orderDate: Date;
  expectedDeliveryDate: Date;
  paymentStatus: StockOrderPaymentStatusValue;
  paymentMethod: StockOrderPaymentMethodValue;
  note: string | null;
  status: "DRAFT" | "ORDERED";
  items: ParsedOrderItem[];
};

const includeOrder = {
  supplier: { select: { id: true, name: true, currency: true } },
  items: {
    orderBy: { createdAt: "asc" as const },
    include: {
      multimediaProduct: { select: { quantity: true, criticalStockLevel: true } },
      screenProduct: { select: { quantity: true, criticalStockLevel: true } },
      soundSystemProduct: { select: { quantity: true, criticalStockLevel: true } },
    },
  },
} as const;

type OrderRow = Prisma.StockOrderGetPayload<{ include: typeof includeOrder }>;

const scalarQuery = (value: unknown, fieldName: string): string | null => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new HttpError(400, `${fieldName} tek bir string olmali`);
  return value.trim() || null;
};

const positiveInteger = (value: unknown, fieldName: string, maximum = 9999): number => {
  if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > maximum) {
    throw new HttpError(400, `${fieldName} 1-${maximum} araliginda integer olmali`);
  }
  return Number(value);
};

const pageInteger = (value: unknown, fieldName: string, fallback: number, maximum: number) => {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new HttpError(400, `${fieldName} pozitif integer olmali`);
  }
  return positiveInteger(Number(value), fieldName, maximum);
};

const parseDate = (value: unknown, fieldName: string): Date => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, `${fieldName} YYYY-MM-DD formatinda olmali`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, `${fieldName} gecersiz tarih`);
  }
  return date;
};

export const parseStockOrderListFilter = (query: unknown): StockOrderListFilter => {
  const values = asRecord(query, "query");
  const statusText = scalarQuery(values.status, "status");
  const stockTypeText = scalarQuery(values.stockType, "stockType");
  return {
    search: scalarQuery(values.search, "search"),
    status: statusText ? oneOf(statusText, "status", statuses) : null,
    supplierId: scalarQuery(values.supplierId, "supplierId"),
    stockType: stockTypeText ? parseInventoryStockType(stockTypeText) : null,
    dateFrom: values.dateFrom ? parseDate(values.dateFrom, "dateFrom") : null,
    dateTo: values.dateTo ? parseDate(values.dateTo, "dateTo") : null,
    page: pageInteger(values.page, "page", 1, 100000),
    pageSize: pageInteger(values.pageSize, "pageSize", 50, 100),
  };
};

const parseCreateInput = (body: unknown): ParsedOrderInput => {
  const values = asRecord(body);
  const orderDate = parseDate(values.orderDate, "orderDate");
  const expectedDeliveryDate = parseDate(values.expectedDeliveryDate, "expectedDeliveryDate");
  if (expectedDeliveryDate.getTime() < orderDate.getTime()) {
    throw new HttpError(400, "expectedDeliveryDate orderDate'den once olamaz");
  }
  if (!Array.isArray(values.items) || values.items.length === 0 || values.items.length > 100) {
    throw new HttpError(400, "items 1-100 kalem icermeli");
  }

  const duplicateExisting = new Set<string>();
  const items = values.items.map((raw, index): ParsedOrderItem => {
    const item = asRecord(raw, `items[${index}]`);
    const stockType = parseInventoryStockType(item.stockType);
    if (typeof item.isNewProduct !== "boolean") {
      throw new HttpError(400, `items[${index}].isNewProduct boolean olmali`);
    }
    const quantity = positiveInteger(item.quantity, `items[${index}].quantity`);
    const unitPrice = parseMoney(item.unitPrice, `items[${index}].unitPrice`);

    if (item.isNewProduct) {
      if (item.productId !== undefined && item.productId !== null && item.productId !== "") {
        throw new HttpError(400, `items[${index}] yeni urun productId tasiyamaz`);
      }
      return {
        stockType,
        isNewProduct: true,
        productId: null,
        productSnapshot: asRecord(item.productSnapshot, `items[${index}].productSnapshot`),
        quantity,
        unitPrice,
      };
    }

    const productId = requiredString(item.productId, `items[${index}].productId`, 100);
    const duplicateKey = `${stockType}:${productId}`;
    if (duplicateExisting.has(duplicateKey)) {
      throw new HttpError(400, `items[${index}] ayni mevcut urunu tekrar ediyor`);
    }
    duplicateExisting.add(duplicateKey);
    return {
      stockType,
      isNewProduct: false,
      productId,
      productSnapshot: null,
      quantity,
      unitPrice,
    };
  });

  return {
    supplierId: requiredString(values.supplierId, "supplierId", 100),
    orderDate,
    expectedDeliveryDate,
    paymentStatus: oneOf(values.paymentStatus, "paymentStatus", paymentStatuses),
    paymentMethod: oneOf(values.paymentMethod, "paymentMethod", paymentMethods),
    note: optionalString(values.note, "note", 500),
    status: oneOf(values.status, "status", ["DRAFT", "ORDERED"] as const),
    items,
  };
};

const nonNegativeSnapshotInteger = (value: unknown, fieldName: string): number => {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new HttpError(400, `${fieldName} sifir veya pozitif integer olmali`);
  }
  return Number(value);
};

const nullableSnapshotInteger = (value: unknown, fieldName: string): number | null =>
  value === null || value === undefined || value === ""
    ? null
    : nonNegativeSnapshotInteger(value, fieldName);

const snapshotSize = (value: unknown, fieldName: string): string | null => {
  if (value === null || value === undefined || value === "") return null;
  const text = typeof value === "string" || typeof value === "number" ? String(value) : "";
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(text)) throw new HttpError(400, `${fieldName} gecersiz`);
  const decimal = new Prisma.Decimal(text);
  if (!decimal.isPositive() || decimal.greaterThan("999.99")) {
    throw new HttpError(400, `${fieldName} gecersiz`);
  }
  return decimal.toString();
};

const normalizeNewSnapshot = (
  stockType: InventoryStockType,
  raw: Record<string, unknown>,
): Record<string, string | number | null> => {
  if (stockType === "MULTIMEDIA") {
    return {
      code: requiredString(raw.code, "productSnapshot.code", 100),
      brand: requiredString(raw.brand, "productSnapshot.brand", 100),
      model: optionalString(raw.model, "productSnapshot.model", 150),
      forx: optionalString(raw.forx, "productSnapshot.forx", 100),
      shelf: optionalString(raw.shelf, "productSnapshot.shelf", 30),
      criticalStockLevel: nonNegativeSnapshotInteger(
        raw.criticalStockLevel ?? 0,
        "productSnapshot.criticalStockLevel",
      ),
    };
  }
  if (stockType === "SCREEN") {
    const sizeInch = snapshotSize(raw.sizeInch, "productSnapshot.sizeInch");
    const sizeLabel = optionalString(raw.sizeLabel, "productSnapshot.sizeLabel", 100);
    if (sizeInch === null && sizeLabel === null) {
      throw new HttpError(400, "Yeni ekran icin sizeInch veya sizeLabel zorunlu");
    }
    return {
      brand: requiredString(raw.brand, "productSnapshot.brand", 150),
      storageGb: nullableSnapshotInteger(raw.storageGb, "productSnapshot.storageGb"),
      ramGb: nullableSnapshotInteger(raw.ramGb, "productSnapshot.ramGb"),
      cores: nullableSnapshotInteger(raw.cores, "productSnapshot.cores"),
      sizeInch,
      sizeLabel,
      criticalStockLevel: nonNegativeSnapshotInteger(
        raw.criticalStockLevel ?? 0,
        "productSnapshot.criticalStockLevel",
      ),
    };
  }
  return {
    name: requiredString(raw.name, "productSnapshot.name", 180),
    purchasePriceUsd: moneyToString(
      parseMoney(raw.purchasePriceUsd, "productSnapshot.purchasePriceUsd"),
    ),
    criticalStockLevel: nonNegativeSnapshotInteger(
      raw.criticalStockLevel ?? 0,
      "productSnapshot.criticalStockLevel",
    ),
  };
};

type ItemCreateData = {
  stockType: InventoryStockType;
  multimediaProductId: string | null;
  screenProductId: string | null;
  soundSystemProductId: string | null;
  isNewProduct: boolean;
  productSnapshot: Prisma.InputJsonValue;
  quantity: number;
  unitPrice: Prisma.Decimal;
  totalPrice: Prisma.Decimal;
};

const buildItemData = async (
  tx: BusinessTransaction,
  item: ParsedOrderItem,
): Promise<ItemCreateData> => {
  const base = {
    stockType: item.stockType,
    multimediaProductId: null,
    screenProductId: null,
    soundSystemProductId: null,
    isNewProduct: item.isNewProduct,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.unitPrice
      .mul(item.quantity)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
  };

  if (item.isNewProduct) {
    const snapshot = normalizeNewSnapshot(item.stockType, item.productSnapshot ?? {});
    return { ...base, productSnapshot: snapshot as Prisma.InputJsonValue };
  }

  if (item.stockType === "MULTIMEDIA") {
    const product = await tx.multimediaProduct.findFirst({
      where: { id: item.productId!, isActive: true },
    });
    if (!product) throw new HttpError(400, "Multimedia urunu bulunamadi veya pasif");
    return {
      ...base,
      multimediaProductId: product.id,
      productSnapshot: {
        code: product.code,
        brand: product.brand,
        model: product.model,
        forx: product.forx,
        shelf: product.shelf,
        criticalStockLevel: product.criticalStockLevel,
      },
    };
  }
  if (item.stockType === "SCREEN") {
    const product = await tx.screenProduct.findFirst({
      where: { id: item.productId!, isActive: true },
    });
    if (!product) throw new HttpError(400, "Ekran urunu bulunamadi veya pasif");
    return {
      ...base,
      screenProductId: product.id,
      productSnapshot: {
        brand: product.brand,
        storageGb: product.storageGb,
        ramGb: product.ramGb,
        cores: product.cores,
        sizeInch: product.sizeInch?.toString() ?? null,
        sizeLabel: product.sizeLabel,
        criticalStockLevel: product.criticalStockLevel,
      },
    };
  }
  const product = await tx.soundSystemProduct.findFirst({
    where: { id: item.productId!, isActive: true },
  });
  if (!product) throw new HttpError(400, "Ses sistemi urunu bulunamadi veya pasif");
  return {
    ...base,
    soundSystemProductId: product.id,
    productSnapshot: {
      name: product.name,
      purchasePriceUsd: product.purchasePriceUsd?.toFixed(2) ?? null,
      criticalStockLevel: product.criticalStockLevel,
    },
  };
};

const currency = (value: string): "TRY" | "USD" => {
  if (value !== "TRY" && value !== "USD") throw new HttpError(409, "Supplier currency gecersiz");
  return value;
};

const productIdentity = (row: OrderRow["items"][number]): string | null =>
  row.multimediaProductId ?? row.screenProductId ?? row.soundSystemProductId;

const currentInventory = (row: OrderRow["items"][number]) =>
  row.multimediaProduct ?? row.screenProduct ?? row.soundSystemProduct;

const snapshotRecord = (value: Prisma.JsonValue): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const snapshotLabel = (stockType: InventoryStockType, snapshot: Record<string, unknown>): string => {
  if (stockType === "MULTIMEDIA") {
    return [snapshot.brand, snapshot.model, snapshot.forx].filter(Boolean).join(" ") || String(snapshot.code ?? "Multimedia");
  }
  if (stockType === "SCREEN") {
    return [snapshot.brand, snapshot.sizeLabel ?? snapshot.sizeInch].filter(Boolean).join(" ") || "Ekran";
  }
  return String(snapshot.name ?? "Ses Sistemi");
};

const toDto = (row: OrderRow): StockOrderDto => {
  const total = row.items.reduce(
    (sum, item) => sum.plus(item.totalPrice),
    new Prisma.Decimal(0),
  );
  const snapshots = row.items.map((item) => snapshotRecord(item.productSnapshot));
  return {
    id: row.id,
    supplier: { id: row.supplier.id, name: row.supplier.name, currency: currency(row.supplier.currency) },
    currency: currency(row.currency),
    orderDate: row.orderDate.toISOString().slice(0, 10),
    expectedDeliveryDate: row.expectedDeliveryDate.toISOString().slice(0, 10),
    paymentStatus: row.paymentStatus,
    paymentMethod: row.paymentMethod,
    note: row.note,
    status: row.status,
    receivedAt: row.receivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    productKinds: row.items.length,
    totalQuantity: row.items.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount: moneyToString(total),
    stockTypes: [...new Set(row.items.map((item) => item.stockType))],
    items: row.items.map((item, index) => {
      const inventory = currentInventory(item);
      return {
        id: item.id,
        stockType: item.stockType,
        productId: productIdentity(item),
        isNewProduct: item.isNewProduct,
        productSnapshot: snapshots[index] ?? {},
        productLabel: snapshotLabel(item.stockType, snapshots[index] ?? {}),
        productCode:
          typeof snapshots[index]?.code === "string" ? String(snapshots[index]?.code) : null,
        inventoryStatus: inventory
          ? inventoryStatus(inventory.quantity, inventory.criticalStockLevel)
          : null,
        quantity: item.quantity,
        unitPrice: moneyToString(item.unitPrice),
        totalPrice: moneyToString(item.totalPrice),
      };
    }),
  };
};

const orderOrStateError = async (tx: BusinessTransaction, id: string): Promise<never> => {
  const row = await tx.stockOrder.findUnique({ where: { id }, select: { status: true } });
  if (!row) throw new HttpError(404, "Stock order bulunamadi");
  throw new HttpError(409, `Stock order ${row.status} durumunda`);
};

const supplierForOrder = async (tx: BusinessTransaction, supplierId: string) => {
  const supplier = await tx.supplier.findFirst({
    where: { id: supplierId, isActive: true },
    select: { id: true, currency: true },
  });
  if (!supplier) throw new HttpError(400, "Supplier bulunamadi veya pasif");
  currency(supplier.currency);
  return supplier;
};

export const createStockOrder = async (body: unknown): Promise<StockOrderDto> => {
  const input = parseCreateInput(body);
  const id = await withSerializableTransaction(async (tx) => {
    const supplier = await supplierForOrder(tx, input.supplierId);
    const items = await Promise.all(input.items.map((item) => buildItemData(tx, item)));
    const order = await tx.stockOrder.create({
      data: {
        supplierId: supplier.id,
        currency: supplier.currency,
        orderDate: input.orderDate,
        expectedDeliveryDate: input.expectedDeliveryDate,
        paymentStatus: input.paymentStatus,
        paymentMethod: input.paymentMethod,
        note: input.note,
        status: input.status,
      },
      select: { id: true },
    });
    await tx.stockOrderItem.createMany({
      data: items.map((item) => ({ ...item, orderId: order.id })),
    });
    return order.id;
  });
  return getStockOrder(id);
};

export const updateDraftStockOrder = async (
  id: string,
  body: unknown,
): Promise<StockOrderDto> => {
  const input = parseCreateInput({ ...asRecord(body), status: "DRAFT" });
  await withSerializableTransaction(async (tx) => {
    const supplier = await supplierForOrder(tx, input.supplierId);
    const items = await Promise.all(input.items.map((item) => buildItemData(tx, item)));
    const update = await tx.stockOrder.updateMany({
      where: { id, status: "DRAFT" },
      data: {
        supplierId: supplier.id,
        currency: supplier.currency,
        orderDate: input.orderDate,
        expectedDeliveryDate: input.expectedDeliveryDate,
        paymentStatus: input.paymentStatus,
        paymentMethod: input.paymentMethod,
        note: input.note,
      },
    });
    if (update.count !== 1) await orderOrStateError(tx, id);
    await tx.stockOrderItem.deleteMany({ where: { orderId: id } });
    await tx.stockOrderItem.createMany({ data: items.map((item) => ({ ...item, orderId: id })) });
  });
  return getStockOrder(id);
};

export const listStockOrders = async (
  filter: StockOrderListFilter,
): Promise<StockOrderListResponse> => {
  const where = {
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.supplierId ? { supplierId: filter.supplierId } : {}),
    ...(filter.stockType ? { items: { some: { stockType: filter.stockType } } } : {}),
    ...(filter.dateFrom || filter.dateTo
      ? {
          orderDate: {
            ...(filter.dateFrom ? { gte: filter.dateFrom } : {}),
            ...(filter.dateTo ? { lte: filter.dateTo } : {}),
          },
        }
      : {}),
    ...(filter.search
      ? {
          OR: [
            { id: { contains: filter.search, mode: "insensitive" as const } },
            { supplier: { name: { contains: filter.search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
  const prisma = getPrisma();
  const [total, rows] = await Promise.all([
    prisma.stockOrder.count({ where }),
    prisma.stockOrder.findMany({
      where,
      include: includeOrder,
      orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
    }),
  ]);
  return { items: rows.map(toDto), total, page: filter.page, pageSize: filter.pageSize };
};

export const getStockOrder = async (id: string): Promise<StockOrderDto> => {
  const row = await getPrisma().stockOrder.findUnique({ where: { id }, include: includeOrder });
  if (!row) throw new HttpError(404, "Stock order bulunamadi");
  return toDto(row);
};

export const submitStockOrder = async (id: string): Promise<StockOrderDto> => {
  await withSerializableTransaction(async (tx) => {
    const update = await tx.stockOrder.updateMany({
      where: { id, status: "DRAFT" },
      data: { status: "ORDERED" },
    });
    if (update.count !== 1) await orderOrStateError(tx, id);
  });
  return getStockOrder(id);
};

export const cancelStockOrder = async (id: string): Promise<StockOrderDto> => {
  await withSerializableTransaction(async (tx) => {
    const update = await tx.stockOrder.updateMany({
      where: { id, status: { in: ["DRAFT", "ORDERED"] } },
      data: { status: "CANCELLED" },
    });
    if (update.count !== 1) await orderOrStateError(tx, id);
  });
  return getStockOrder(id);
};

const receiveExistingProduct = async (
  tx: BusinessTransaction,
  item: OrderRow["items"][number],
): Promise<string> => {
  if (item.stockType === "MULTIMEDIA" && item.multimediaProductId) {
    const result = await tx.multimediaProduct.updateMany({
      where: { id: item.multimediaProductId, isActive: true },
      data: { quantity: { increment: item.quantity } },
    });
    if (result.count !== 1) throw new HttpError(409, "Multimedia urunu bulunamadi veya pasif");
    return item.multimediaProductId;
  }
  if (item.stockType === "SCREEN" && item.screenProductId) {
    const result = await tx.screenProduct.updateMany({
      where: { id: item.screenProductId, isActive: true },
      data: { quantity: { increment: item.quantity } },
    });
    if (result.count !== 1) throw new HttpError(409, "Ekran urunu bulunamadi veya pasif");
    return item.screenProductId;
  }
  if (item.stockType === "SOUND_SYSTEM" && item.soundSystemProductId) {
    const result = await tx.soundSystemProduct.updateMany({
      where: { id: item.soundSystemProductId, isActive: true },
      data: { quantity: { increment: item.quantity } },
    });
    if (result.count !== 1) throw new HttpError(409, "Ses sistemi urunu bulunamadi veya pasif");
    return item.soundSystemProductId;
  }
  throw new HttpError(409, "Stock order item urun iliskisi gecersiz");
};

const receiveNewProduct = async (
  tx: BusinessTransaction,
  item: OrderRow["items"][number],
): Promise<string> => {
  const snapshot = normalizeNewSnapshot(item.stockType, snapshotRecord(item.productSnapshot));
  if (item.stockType === "MULTIMEDIA") {
    const row = await tx.multimediaProduct.create({
      data: {
        code: String(snapshot.code),
        brand: String(snapshot.brand),
        model: snapshot.model === null ? null : String(snapshot.model),
        forx: snapshot.forx === null ? null : String(snapshot.forx),
        shelf: snapshot.shelf === null ? null : String(snapshot.shelf),
        criticalStockLevel: Number(snapshot.criticalStockLevel),
        quantity: item.quantity,
      },
      select: { id: true },
    });
    await tx.stockOrderItem.update({ where: { id: item.id }, data: { multimediaProductId: row.id } });
    return row.id;
  }
  if (item.stockType === "SCREEN") {
    const row = await tx.screenProduct.create({
      data: {
        brand: String(snapshot.brand),
        storageGb: snapshot.storageGb === null ? null : Number(snapshot.storageGb),
        ramGb: snapshot.ramGb === null ? null : Number(snapshot.ramGb),
        cores: snapshot.cores === null ? null : Number(snapshot.cores),
        sizeInch: snapshot.sizeInch === null ? null : new Prisma.Decimal(String(snapshot.sizeInch)),
        sizeLabel: snapshot.sizeLabel === null ? null : String(snapshot.sizeLabel),
        criticalStockLevel: Number(snapshot.criticalStockLevel),
        quantity: item.quantity,
      },
      select: { id: true },
    });
    await tx.stockOrderItem.update({ where: { id: item.id }, data: { screenProductId: row.id } });
    return row.id;
  }
  const row = await tx.soundSystemProduct.create({
    data: {
      name: String(snapshot.name),
      purchasePriceUsd: new Prisma.Decimal(String(snapshot.purchasePriceUsd)),
      criticalStockLevel: Number(snapshot.criticalStockLevel),
      quantity: item.quantity,
    },
    select: { id: true },
  });
  await tx.stockOrderItem.update({ where: { id: item.id }, data: { soundSystemProductId: row.id } });
  return row.id;
};

export const receiveStockOrder = async (id: string): Promise<StockOrderDto> => {
  try {
    await withSerializableTransaction(async (tx) => {
      const update = await tx.stockOrder.updateMany({
        where: { id, status: "ORDERED" },
        data: { status: "RECEIVED", receivedAt: new Date() },
      });
      if (update.count !== 1) await orderOrStateError(tx, id);

      const order = await tx.stockOrder.findUnique({ where: { id }, include: includeOrder });
      if (!order) throw new HttpError(404, "Stock order bulunamadi");
      for (const item of order.items) {
        const productId = item.isNewProduct
          ? await receiveNewProduct(tx, item)
          : await receiveExistingProduct(tx, item);
        await tx.stockMovement.create({
          data: {
            stockType: item.stockType,
            productId,
            movementType: "ORDER_DELIVERY",
            quantity: item.quantity,
            referenceType: "STOCK_ORDER",
            referenceId: order.id,
            note: null,
          },
        });
      }
    });
    return getStockOrder(id);
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) {
      throw new HttpError(409, "Yeni siparis urunu mevcut bir urunle cakisti");
    }
    throw error;
  }
};
