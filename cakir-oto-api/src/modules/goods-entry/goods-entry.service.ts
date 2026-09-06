import { Prisma, type GoodsEntry } from "../../../generated/prisma/client.js";
import { getPrisma } from "../../lib/prisma.js";
import { HttpError, isPrismaErrorCode } from "../../lib/http-error.js";
import { asRecord, optionalString, requiredString } from "../../lib/validation.js";

const uppercase = (value: string) => value.normalize("NFC").toLocaleUpperCase("tr-TR");
// Fold dotted/undotted I for product identity, including imported Latin brand names.
const normalizeName = (value: string) => uppercase(value.trim().replace(/\s+/g, " ")).replace(/İ/g, "I");
const orderBy: Prisma.GoodsEntryOrderByWithRelationInput[] = [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }];
const dto = (entry: GoodsEntry) => ({
  ...entry,
  date: entry.date.toISOString().slice(0, 10),
  purchasePrice: entry.purchasePrice.toFixed(2),
  salePrice: entry.salePrice.toFixed(2),
  estimatedUnitProfit: entry.salePrice.minus(entry.purchasePrice).toFixed(2),
});

const integer = (value: unknown, fallback: number, max: number) => {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max) {
    throw new HttpError(400, "Sayfalama değeri geçersiz");
  }
  return Number(value);
};
const pagination = (query: Record<string, unknown>) => ({
  page: integer(query.page, 1, 1000000),
  pageSize: integer(query.pageSize, 50, 100),
});

const parseDate = (value: unknown): Date => {
  const text = requiredString(value, "Tarih", 10);
  const date = new Date(`${text}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new HttpError(400, "Geçerli bir tarih girin");
  }
  return date;
};
const price = (value: unknown, field: string) => {
  if (typeof value !== "string" || !/^\d{1,12}(?:\.\d{1,2})?$/.test(value)) {
    throw new HttpError(400, `${field} en fazla 12 tam ve 2 ondalık basamaklı, negatif olmayan bir tutar olmalı`);
  }
  return new Prisma.Decimal(value);
};

export function parseGoodsEntry(body: unknown) {
  const values = asRecord(body);
  const name = requiredString(uppercase(requiredString(values.productName, "Ürün", 200)).replace(/\s+/g, " "), "Ürün", 200);
  const normalizedName = normalizeName(name);
  const productId = optionalString(values.productId, "Ürün ID", 100);
  const supplierName = requiredString(uppercase(requiredString(values.supplierName, "Toptancı", 200)).replace(/\s+/g, " "), "Toptancı", 200);
  const note = optionalString(values.note, "Not", 2000);
  const quantity = values.quantity;
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 2147483647) {
    throw new HttpError(400, "Adet pozitif bir tam sayı olmalı");
  }
  const data = {
    date: parseDate(values.date), supplierName, quantity,
    purchasePrice: price(values.purchasePrice, "Alış fiyatı"),
    salePrice: price(values.salePrice, "Satış fiyatı"),
    note: note ? uppercase(note) : null,
  };
  return { name, normalizedName, productId, data };
}

export async function createEntry(body: unknown) {
  const { name, normalizedName, productId, data } = parseGoodsEntry(body);
  const save = () => getPrisma().$transaction(async (tx) => {
    const product = productId
      ? await tx.goodsProduct.findUnique({ where: { id: productId } })
      : await tx.goodsProduct.upsert({ where: { normalizedName }, create: { name, normalizedName }, update: {} });
    if (!product) throw new HttpError(404, "Ürün bulunamadı");
    if (product.normalizedName !== normalizedName) throw new HttpError(400, "Ürün adı seçilen ürünle eşleşmiyor");
    return dto(await tx.goodsEntry.create({ data: { ...data, productId: product.id } }));
  });
  try { return await save(); } catch (error) {
    // Concurrent first entries must share the unique master, without losing either entry.
    if (!productId && isPrismaErrorCode(error, "P2002")) return save();
    throw error;
  }
}

export async function listProducts(query: Record<string, unknown>) {
  const { page, pageSize } = pagination(query);
  const search = optionalString(query.search, "Arama", 200);
  const where: Prisma.GoodsProductWhereInput = {};
  if (search) {
    const text = uppercase(search);
    const entryOr: Prisma.GoodsEntryWhereInput[] = [
      { supplierName: { contains: text, mode: "insensitive" } },
      { note: { contains: text, mode: "insensitive" } },
    ];
    const dateText = search.replace(/^(\d{2})\.(\d{2})\.(\d{4})$/, "$3-$2-$1");
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
      try { entryOr.push({ date: parseDate(dateText) }); } catch { /* Invalid dates remain text searches. */ }
    }
    where.OR = [{ normalizedName: { contains: normalizeName(search) } }, { entries: { some: { OR: entryOr } } }];
  }
  return getPrisma().$transaction(async (tx) => {
    const total = await tx.goodsProduct.count({ where });
    const products = await tx.goodsProduct.findMany({
      where, skip: (page - 1) * pageSize, take: pageSize,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      include: { entries: { orderBy, take: 1 }, _count: { select: { entries: true } } },
    });
    return { items: products.map(({ entries, _count, ...product }) => ({ ...product, latestEntry: entries[0] ? dto(entries[0]) : null, entryCount: _count.entries })), total, page, pageSize };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function history(id: string, query: Record<string, unknown>) {
  const { page, pageSize } = pagination(query);
  return getPrisma().$transaction(async (tx) => {
    if (!await tx.goodsProduct.findUnique({ where: { id } })) throw new HttpError(404, "Ürün bulunamadı");
    const total = await tx.goodsEntry.count({ where: { productId: id } });
    // The current entry is already visible in the parent row.
    const rows = await tx.goodsEntry.findMany({ where: { productId: id }, orderBy, skip: 1 + (page - 1) * pageSize, take: pageSize });
    return { items: rows.map(dto), total: Math.max(0, total - 1), page, pageSize };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

type ProductTotal = { id: string; name: string; totalQuantity: bigint; totalPurchase: Prisma.Decimal; totalPotentialSale: Prisma.Decimal; estimatedProfit: Prisma.Decimal };
type SupplierTotal = { supplierName: string; totalQuantity: bigint; totalPurchase: Prisma.Decimal; entryCount: bigint };
export async function statistics(query: Record<string, unknown>) {
  const { page, pageSize } = pagination(query);
  const group = query.group ?? "products";
  if (group !== "products" && group !== "suppliers") throw new HttpError(400, "İstatistik grubu geçersiz");
  return getPrisma().$transaction(async (tx) => {
    if (group === "suppliers") {
      const counts = await tx.$queryRaw<{ total: bigint }[]>`SELECT COUNT(DISTINCT supplier_name) AS total FROM goods_entries`;
      const rows = await tx.$queryRaw<SupplierTotal[]>`
        SELECT supplier_name AS "supplierName", SUM(quantity) AS "totalQuantity",
          SUM(purchase_price * quantity) AS "totalPurchase", COUNT(*) AS "entryCount"
        FROM goods_entries GROUP BY supplier_name ORDER BY supplier_name
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
      return { items: rows.map(row => ({ ...row, totalQuantity: row.totalQuantity.toString(), totalPurchase: row.totalPurchase.toFixed(2), entryCount: row.entryCount.toString() })), total: Number(counts[0]?.total ?? 0), page, pageSize };
    }
    const total = await tx.goodsProduct.count();
    const rows = await tx.$queryRaw<ProductTotal[]>`
      SELECT p.id, p.name, SUM(e.quantity) AS "totalQuantity",
        SUM(e.purchase_price * e.quantity) AS "totalPurchase",
        SUM(e.sale_price * e.quantity) AS "totalPotentialSale",
        SUM((e.sale_price - e.purchase_price) * e.quantity) AS "estimatedProfit"
      FROM goods_products p JOIN goods_entries e ON e.product_id = p.id
      GROUP BY p.id, p.name ORDER BY p.name, p.id
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
    return { items: rows.map(row => ({ ...row, totalQuantity: row.totalQuantity.toString(), totalPurchase: row.totalPurchase.toFixed(2), totalPotentialSale: row.totalPotentialSale.toFixed(2), estimatedProfit: row.estimatedProfit.toFixed(2) })), total, page, pageSize };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
