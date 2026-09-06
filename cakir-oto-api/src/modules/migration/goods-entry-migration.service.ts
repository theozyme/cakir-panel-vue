import { createHash } from "node:crypto";
import { Prisma } from "../../../generated/prisma/client.js";
import { getPrisma } from "../../lib/prisma.js";
import { HttpError, isPrismaErrorCode } from "../../lib/http-error.js";
import { asRecord, requiredString } from "../../lib/validation.js";
import { parseGoodsEntry } from "../goods-entry/goods-entry.service.js";
import type { MigrationRowError } from "./migration.types.js";

function parseCreatedAt(value: unknown) {
  const text = requiredString(value, "created_at", 19);
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)) {
    throw new HttpError(400, "created_at YYYY-MM-DD HH:mm:ss biçiminde olmalı");
  }
  // Legacy timestamps have no offset and represent Turkish local time.
  const wallClock = text.replace(" ", "T");
  const check = new Date(`${wallClock}Z`);
  if (!Number.isFinite(check.getTime()) || check.toISOString().slice(0, 19) !== wallClock || text.startsWith("0000")) {
    throw new HttpError(400, "created_at geçerli bir tarih ve saat olmalı");
  }
  return new Date(`${wallClock}+03:00`);
}

function parsePayload(body: unknown) {
  if (!Array.isArray(body)) throw new HttpError(400, "JSON dosyası bir kayıt dizisi olmalı");
  if (body.length > 10000) throw new HttpError(400, "Bir dosyada en fazla 10.000 kayıt aktarılabilir");
  const errors: MigrationRowError[] = [];
  const seen = new Set<string>();
  const rows: Array<ReturnType<typeof parseGoodsEntry> & { id: string; legacyId: string; createdAt: Date }> = [];
  body.forEach((raw: unknown, index: number) => {
    let legacyKey: string | undefined;
    try {
      const row = asRecord(raw);
      // IDs must stay strings: legacy IDs exceed JavaScript's safe integer range.
      legacyKey = requiredString(row.id, "id (metin)", 200);
      if (seen.has(legacyKey)) throw new HttpError(400, "Dosyada aynı id birden fazla kez kullanılmış");
      const parsed = parseGoodsEntry({
        productName: row.product_name,
        date: row.entry_date,
        supplierName: row.wholesaler,
        purchasePrice: typeof row.purchase_price === "number" ? String(row.purchase_price) : row.purchase_price,
        salePrice: typeof row.sale_price === "number" ? String(row.sale_price) : row.sale_price,
        quantity: row.quantity,
        note: row.note,
      });
      const createdAt = parseCreatedAt(row.created_at);
      if (parsed.data.date.getUTCFullYear() < 1) throw new HttpError(400, "entry_date geçerli bir tarih olmalı");
      seen.add(legacyKey);
      // Stable, namespaced entry identity needs no extra schema or legacy mapping table.
      rows.push({ ...parsed, id: `legacy-goods-entry:${legacyKey}`, legacyId: legacyKey, createdAt });
    } catch (error) {
      errors.push({ row: index, ...(legacyKey ? { legacyKey } : {}), messages: [error instanceof Error ? error.message : "Geçersiz kayıt"] });
    }
  });
  return { payload: body as unknown[], total: body.length, rows, errors };
}

async function existingIds(rows: Array<{ id: string }>, db: Pick<Prisma.TransactionClient, "goodsEntry">) {
  const ids = new Set<string>();
  for (let offset = 0; offset < rows.length; offset += 500) {
    const existing = await db.goodsEntry.findMany({ where: { id: { in: rows.slice(offset, offset + 500).map(row => row.id) } }, select: { id: true } });
    existing.forEach(row => ids.add(row.id));
  }
  return ids;
}

export async function runGoodsEntryDryRun(body: unknown) {
  const { total, rows, errors } = parsePayload(body);
  const existing = await existingIds(rows, getPrisma());
  return {
    total, valid: rows.length, invalid: errors.length, alreadyExists: existing.size, errors,
    warnings: ["created_at Türkiye saati (UTC+03:00) kabul edilir. Daha önce aktarılan id değerleri atlanır; mevcut kayıtlar güncellenmez."],
    preview: rows.slice(0, 50).map(row => ({
      legacyId: row.legacyId, productName: row.name,
      date: row.data.date.toISOString().slice(0, 10),
      supplierName: row.data.supplierName,
      purchasePrice: row.data.purchasePrice.toFixed(2), salePrice: row.data.salePrice.toFixed(2),
      quantity: row.data.quantity, note: row.data.note,
      createdAt: row.createdAt.toISOString(), alreadyExists: existing.has(row.id),
    })),
  };
}

export async function importGoodsEntries(body: unknown) {
  const { payload, total, rows, errors } = parsePayload(body);
  const fileHash = createHash("sha256").update("GOODS_ENTRY:").update(JSON.stringify(payload)).digest("hex");
  const save = () => getPrisma().$transaction(async (tx) => {
    // Serialize legacy goods imports, including overlapping files, until this batch commits.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(730621, 1)::text`;
    const previous = await tx.migrationBatch.findUnique({ where: { fileHash } });
    if (previous) throw new HttpError(409, "Bu dosya daha önce aktarılmış. Hatalı satırları düzelterek yeniden yükleyebilirsiniz.");
    const existing = await existingIds(rows, tx);
    const batch = await tx.migrationBatch.create({ data: {
      dataType: "GOODS_ENTRY", sourceFile: "goods_entry.json", fileHash, status: "RUNNING", totalCount: total,
    } });
    if (errors.length) {
      await tx.migrationError.createMany({ data: errors.map(error => ({
        batchId: batch.id,
        ...(error.legacyKey ? { legacyKey: error.legacyKey } : {}),
        sourceReference: `goods_entry[${error.row}]`, errorType: "VALIDATION_ERROR", message: error.messages.join("; "),
        rawPayload: payload[error.row] == null ? Prisma.JsonNull : payload[error.row] as Prisma.InputJsonValue,
      })) });
    }
    const productIds = new Map<string, string>();
    const entries: Prisma.GoodsEntryCreateManyInput[] = [];
    for (const row of rows) {
      if (existing.has(row.id)) continue;
      let productId = productIds.get(row.normalizedName);
      if (!productId) {
        const product = await tx.goodsProduct.upsert({
          where: { normalizedName: row.normalizedName },
          create: { name: row.name, normalizedName: row.normalizedName }, update: {},
        });
        productId = product.id;
        productIds.set(row.normalizedName, productId);
      }
      entries.push({ ...row.data, id: row.id, productId, productName: row.name, createdAt: row.createdAt, updatedAt: row.createdAt });
    }
    let success = 0;
    for (let offset = 0; offset < entries.length; offset += 500) {
      const result = await tx.goodsEntry.createMany({ data: entries.slice(offset, offset + 500), skipDuplicates: true });
      success += result.count;
    }
    const skipped = rows.length - success;
    await tx.migrationBatch.update({ where: { id: batch.id }, data: {
      status: errors.length ? "COMPLETED_WITH_ERRORS" : "SUCCESS",
      successCount: success, skippedCount: skipped, errorCount: errors.length, finishedAt: new Date(),
    } });
    return { batchId: batch.id, total, success, skipped, error: errors.length };
  }, { timeout: 60000 });
  try { return await save(); } catch (error) {
    // A simultaneous manual entry may create the same product master first.
    if (isPrismaErrorCode(error, "P2002")) return save();
    throw error;
  }
}
