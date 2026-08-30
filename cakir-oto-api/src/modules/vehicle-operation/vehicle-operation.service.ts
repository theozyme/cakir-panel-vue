import { Prisma } from "../../../generated/prisma/client.js";

import { getPrisma } from "../../lib/prisma.js";
import { HttpError, isPrismaErrorCode } from "../../lib/http-error.js";
import { moneyToString, parseMoney } from "../../lib/money.js";
import { withSerializableTransaction, type BusinessTransaction } from "../../lib/transaction.js";
import { asRecord, oneOf, optionalString, requiredString } from "../../lib/validation.js";
import { getAcceptedSoundOfferForOperation, markSoundOfferUsed, releaseSoundOffer } from "../sound-offer/sound-offer.service.js";
import { consumeMultimediaStock, consumeSoundStock, restoreMultimediaStock, restoreSoundStock } from "../stock-lookup/stock-lookup.service.js";
import { createVehicleOperationSupplierPayment, reconcileVehicleOperationSupplierPayment } from "../supplier/supplier.service.js";
import type { VehicleOperationSupplierPaymentState } from "../supplier/supplier.types.js";
import type { CreateVehicleOperationResponse, CurrencyTotals, DeleteVehicleOperationResponse, SupportedCurrency, VehicleOperationDailyResponse, VehicleOperationDetail, VehicleOperationHistoryResponse, VehicleOperationVisitItem } from "./vehicle-operation.types.js";

const operationTypes = ["MULTIMEDIA", "SOUND_SYSTEM", "HIDDEN_FEATURE_ACTIVATION", "REAR_VIEW_CAMERA", "ANDROID_BOX", "DASH_CAMERA", "BULB", "LED_XENON", "BATTERY", "WIPER", "LABOR", "CAR_STEREO", "STEERING_WHEEL_COVER", "WINDOW_FILM", "PPF_COATING", "POWER_TAILGATE", "SERVICE", "ACCESSORY", "OTHER"] as const;
const paymentMethods = ["CASH", "CREDIT_CARD", "BANK_TRANSFER", "MAIL_ORDER"] as const;
const currencies = ["TRY", "USD"] as const;

type OperationInput = { type: (typeof operationTypes)[number]; description: string; priceInput: unknown; currency: SupportedCurrency; note: string | null; paymentMethod: (typeof paymentMethods)[number]; multimediaProductId: string | null; screenProductId: string | null; soundOfferId: string | null; mailOrderSupplierId: string | null };
type PartyInput = { customer: { firstName: string | null; lastName: string | null; phone: string | null; note: string | null } | null; vehicle: { brand: string | null; model: string | null } | null };
type CreateInput = PartyInput & { source: { type: "PENDING"; pendingVehicleId: string } | { type: "EXISTING"; vehicleId: string }; operation: OperationInput };

const parsePositiveInteger = (value: unknown, field: string, fallback?: number, maximum?: number) => {
  if (value === undefined && fallback !== undefined) return fallback;
  const text = typeof value === "number" ? String(value) : value;
  if (typeof text !== "string" || !/^\d+$/.test(text)) throw new HttpError(400, `${field} pozitif bir tam sayi olmali`);
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || (maximum && parsed > maximum)) throw new HttpError(400, `${field} gecersiz`);
  return parsed;
};
const formatDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const parseDateKey = (value: unknown) => {
  if (value === undefined) return formatDateKey(new Date());
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HttpError(400, "date YYYY-MM-DD formatinda olmali");
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) throw new HttpError(400, "date gecersiz");
  return value;
};
const getDayRange = (dateKey: string) => { const [year, month, day] = dateKey.split("-").map(Number); return { start: new Date(year, month - 1, day), end: new Date(year, month - 1, day + 1) }; };
const parseOperationAt = (value: unknown) => { if (typeof value !== "string" || !value.trim()) throw new HttpError(400, "operationAt zorunlu"); const parsed = new Date(value); if (Number.isNaN(parsed.getTime())) throw new HttpError(400, "operationAt gecersiz"); if (parsed.getTime() > Date.now() + 1000) throw new HttpError(400, "operationAt gelecekte olamaz"); return parsed; };
const emptyTotals = (): Record<SupportedCurrency, Prisma.Decimal> => ({ TRY: new Prisma.Decimal(0), USD: new Prisma.Decimal(0) });
const serializeTotals = (totals: Record<SupportedCurrency, Prisma.Decimal>): CurrencyTotals => ({ TRY: moneyToString(totals.TRY), USD: moneyToString(totals.USD) });

const parseOperationInput = (value: unknown): OperationInput => {
  const operation = asRecord(value, "operation");
  const type = oneOf(operation.type, "operation.type", operationTypes);
  const paymentMethod = oneOf(operation.paymentMethod, "operation.paymentMethod", paymentMethods);
  const currency = oneOf(operation.currency ?? "TRY", "operation.currency", currencies);
  const multimediaProductId = optionalString(operation.multimediaProductId, "operation.multimediaProductId");
  const screenProductId = optionalString(operation.screenProductId, "operation.screenProductId");
  const soundOfferId = optionalString(operation.soundOfferId, "operation.soundOfferId");
  const mailOrderSupplierId = optionalString(operation.mailOrderSupplierId, "operation.mailOrderSupplierId");
  if (type === "MULTIMEDIA" && (!multimediaProductId || !screenProductId)) throw new HttpError(400, "Multimedia operation icin iki stok urunu de zorunlu");
  if (type !== "MULTIMEDIA" && (multimediaProductId || screenProductId)) throw new HttpError(400, "Stok urunleri sadece MULTIMEDIA operation icin gonderilebilir");
  if (type === "SOUND_SYSTEM" && !soundOfferId) throw new HttpError(400, "SOUND_SYSTEM operation icin soundOfferId zorunlu");
  if (type !== "SOUND_SYSTEM" && soundOfferId) throw new HttpError(400, "soundOfferId sadece SOUND_SYSTEM operation icin gonderilebilir");
  if (paymentMethod === "MAIL_ORDER" && !mailOrderSupplierId) throw new HttpError(400, "MAIL_ORDER odeme icin supplier zorunlu");
  if (paymentMethod !== "MAIL_ORDER" && mailOrderSupplierId) throw new HttpError(400, "Supplier sadece MAIL_ORDER odeme icin gonderilebilir");
  return { type, description: requiredString(operation.description, "operation.description", 150), priceInput: operation.price, currency, note: optionalString(operation.note, "operation.note"), paymentMethod, multimediaProductId, screenProductId, soundOfferId, mailOrderSupplierId };
};

const parsePartyInput = (root: Record<string, unknown>): PartyInput => {
  let customer: PartyInput["customer"] = null;
  if (root.customer !== undefined && root.customer !== null) { const value = asRecord(root.customer, "customer"); const parsed = { firstName: optionalString(value.firstName, "customer.firstName", 100), lastName: optionalString(value.lastName, "customer.lastName", 100), phone: optionalString(value.phone, "customer.phone", 30), note: optionalString(value.note, "customer.note") }; customer = Object.values(parsed).some((item) => item !== null) ? parsed : null; }
  let vehicle: PartyInput["vehicle"] = null;
  if (root.vehicle !== undefined && root.vehicle !== null) { const value = asRecord(root.vehicle, "vehicle"); const parsed = { brand: optionalString(value.brand, "vehicle.brand", 100), model: optionalString(value.model, "vehicle.model", 100) }; vehicle = parsed.brand || parsed.model ? parsed : null; }
  return { customer, vehicle };
};
const parseCreateInput = (body: unknown): CreateInput => { const root = asRecord(body); const sourceValue = asRecord(root.source, "source"); const sourceType = oneOf(sourceValue.type, "source.type", ["PENDING", "EXISTING"] as const); const source = sourceType === "PENDING" ? { type: "PENDING" as const, pendingVehicleId: requiredString(sourceValue.pendingVehicleId, "source.pendingVehicleId") } : { type: "EXISTING" as const, vehicleId: requiredString(sourceValue.vehicleId, "source.vehicleId") }; return { source, operation: parseOperationInput(root.operation), ...parsePartyInput(root) }; };

const operationSelect = { id: true, visitId: true, vehicleId: true, operationType: true, description: true, price: true, currency: true, paymentMethod: true, operationAt: true, note: true, mailOrderSupplierId: true, multimediaProductId: true, screenProductId: true, soundOfferId: true, deletedAt: true, revision: true, vehicle: { select: { plate: true, brand: true, model: true } }, visit: { select: { customer: { select: { firstName: true, lastName: true, phone: true, note: true } } } }, multimediaProduct: { select: { id: true, code: true, brand: true, model: true } }, screenProduct: { select: { id: true, brand: true, sizeLabel: true } }, mailOrderSupplier: { select: { id: true, name: true, currency: true } }, soundOffer: { select: { id: true, status: true, saleType: true, manualTotal: true, autoTotal: true, exchangeRate: true, items: { select: { productId: true, productNameSnapshot: true, quantity: true } } } } } as const;
const serializeOperation = (row: any): CreateVehicleOperationResponse => ({ id: row.id, visitId: row.visitId, vehicleId: row.vehicleId, operationType: row.operationType, description: row.description, price: moneyToString(row.price), currency: row.currency as SupportedCurrency, paymentMethod: row.paymentMethod, operationAt: row.operationAt.toISOString(), note: row.note, soundOfferId: row.soundOfferId, revision: row.revision });
const snapshotOperation = (row: any): Prisma.InputJsonValue => ({ id: row.id, visitId: row.visitId, vehicleId: row.vehicleId, operationType: row.operationType, description: row.description, price: row.price.toString(), currency: row.currency, paymentMethod: row.paymentMethod, operationAt: row.operationAt.toISOString(), note: row.note, multimediaProductId: row.multimediaProductId, screenProductId: row.screenProductId, soundOfferId: row.soundOfferId, mailOrderSupplierId: row.mailOrderSupplierId, deletedAt: row.deletedAt?.toISOString() ?? null, revision: row.revision, soundOffer: row.soundOffer ? { id: row.soundOffer.id, status: row.soundOffer.status, saleType: row.soundOffer.saleType, manualTotal: row.soundOffer.manualTotal?.toString() ?? null, autoTotal: row.soundOffer.autoTotal.toString(), exchangeRate: row.soundOffer.exchangeRate.toString(), items: row.soundOffer.items.map((item: any) => ({ productId: item.productId, productName: item.productNameSnapshot, quantity: item.quantity })) } : null, sideEffects: { active: !row.deletedAt, stock: row.operationType === "MULTIMEDIA" ? { multimediaProductId: row.multimediaProductId, screenProductId: row.screenProductId, quantities: [-1, -1] } : row.operationType === "SOUND_SYSTEM" && row.soundOffer ? { offerId: row.soundOfferId, items: row.soundOffer.items.map((item: any) => ({ productId: item.productId, quantity: -item.quantity })) } : null, supplierPayment: row.paymentMethod === "MAIL_ORDER" ? { supplierId: row.mailOrderSupplierId, amount: row.price.toString(), currency: row.currency, transactionAt: row.operationAt.toISOString() } : null } });
const lockActiveOperation = async (tx: BusinessTransaction, id: string, revision: number) => { const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "vehicle_operations" WHERE "id" = ${id} AND "revision" = ${revision} AND "deleted_at" IS NULL FOR UPDATE`); if (locked.length !== 1) { const exists = await tx.vehicleOperation.findUnique({ where: { id }, select: { id: true } }); if (!exists) throw new HttpError(404, "VehicleOperation bulunamadi"); throw new HttpError(409, "Islem daha once degistirildi veya silindi; kaydi yenileyin"); } const row = await tx.vehicleOperation.findUnique({ where: { id }, select: operationSelect }); if (!row || row.deletedAt || row.revision !== revision) throw new HttpError(409, "Islem daha once degistirildi veya silindi; kaydi yenileyin"); return row; };

export const listDailyVehicleOperations = async (dateQuery: unknown): Promise<VehicleOperationDailyResponse> => {
  const date = parseDateKey(dateQuery); const { start, end } = getDayRange(date);
  const visits = await getPrisma().vehicleVisit.findMany({ where: { operations: { some: { deletedAt: null, operationAt: { gte: start, lt: end } } } }, orderBy: { arrivalAt: "asc" }, select: { id: true, arrivalAt: true, note: true, vehicle: { select: { id: true, plate: true, brand: true, model: true } }, customer: { select: { firstName: true, lastName: true, phone: true } }, operations: { where: { deletedAt: null, operationAt: { gte: start, lt: end } }, orderBy: { operationAt: "asc" }, select: { id: true, operationType: true, description: true, price: true, currency: true, paymentMethod: true, operationAt: true, note: true } } } });
  const summaryTotals = emptyTotals();
  const items: VehicleOperationVisitItem[] = visits.map((visit) => { const totals = emptyTotals(); const operations = visit.operations.map((operation) => { const currency = operation.currency as SupportedCurrency; totals[currency] = totals[currency].plus(operation.price); summaryTotals[currency] = summaryTotals[currency].plus(operation.price); return { ...operation, price: moneyToString(operation.price), currency, operationAt: operation.operationAt.toISOString() }; }); return { visitId: visit.id, vehicleId: visit.vehicle.id, plate: visit.vehicle.plate, customer: visit.customer, vehicle: { brand: visit.vehicle.brand, model: visit.vehicle.model }, arrivalAt: visit.arrivalAt.toISOString(), note: visit.note, operations, operationCount: operations.length, totalsByCurrency: serializeTotals(totals) }; });
  return { date, visits: items, summary: { totalVehicles: items.length, totalOperations: items.reduce((sum, item) => sum + item.operationCount, 0), totalsByCurrency: serializeTotals(summaryTotals) } };
};

export const listVehicleOperationHistory = async (query: { search?: unknown; page?: unknown; pageSize?: unknown }): Promise<VehicleOperationHistoryResponse> => {
  const page = parsePositiveInteger(query.page, "page", 1); const pageSize = parsePositiveInteger(query.pageSize, "pageSize", 20, 100); const search = typeof query.search === "string" ? query.search.trim() : "";
  const where: Prisma.VehicleOperationWhereInput = { deletedAt: null, ...(search ? { OR: [{ vehicle: { plate: { contains: search, mode: "insensitive" } } }, { visit: { customer: { firstName: { contains: search, mode: "insensitive" } } } }, { visit: { customer: { lastName: { contains: search, mode: "insensitive" } } } }, { visit: { customer: { phone: { contains: search, mode: "insensitive" } } } }] } : {}) };
  const prisma = getPrisma(); const [total, rows] = await Promise.all([prisma.vehicleOperation.count({ where }), prisma.vehicleOperation.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: [{ operationAt: "desc" }, { id: "desc" }], select: { id: true, visitId: true, vehicleId: true, operationType: true, description: true, paymentMethod: true, price: true, currency: true, operationAt: true, note: true, revision: true, vehicle: { select: { plate: true, brand: true, model: true } }, visit: { select: { customer: { select: { firstName: true, lastName: true, phone: true } } } } } })]);
  return { items: rows.map((row) => ({ operationId: row.id, visitId: row.visitId, vehicleId: row.vehicleId, plate: row.vehicle.plate, customer: row.visit.customer, vehicle: { brand: row.vehicle.brand, model: row.vehicle.model }, operationType: row.operationType, description: row.description, paymentMethod: row.paymentMethod, price: moneyToString(row.price), currency: row.currency as SupportedCurrency, operationAt: row.operationAt.toISOString(), note: row.note, revision: row.revision, hasStockImpact: row.operationType === "MULTIMEDIA" || row.operationType === "SOUND_SYSTEM", hasMailOrderImpact: row.paymentMethod === "MAIL_ORDER" })), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
};

export const getVehicleOperationDetail = async (id: string): Promise<VehicleOperationDetail> => { if (!id) throw new HttpError(400, "operation id zorunlu"); const row = await getPrisma().vehicleOperation.findFirst({ where: { id, deletedAt: null }, select: operationSelect }); if (!row) throw new HttpError(404, "VehicleOperation bulunamadi"); return { ...serializeOperation(row), plate: row.vehicle.plate, customer: row.visit.customer, vehicle: { brand: row.vehicle.brand, model: row.vehicle.model }, multimediaProductId: row.multimediaProductId, screenProductId: row.screenProductId, mailOrderSupplierId: row.mailOrderSupplierId, multimediaProduct: row.multimediaProduct, screenProduct: row.screenProduct, soundOffer: row.soundOffer ? { id: row.soundOffer.id, status: row.soundOffer.status, saleType: row.soundOffer.saleType } : null, mailOrderSupplier: row.mailOrderSupplier, hasStockImpact: row.operationType === "MULTIMEDIA" || row.operationType === "SOUND_SYSTEM", hasMailOrderImpact: row.paymentMethod === "MAIL_ORDER" }; };

export const createVehicleOperation = async (body: unknown): Promise<CreateVehicleOperationResponse> => {
  const input = parseCreateInput(body); const operationAt = new Date();
  try { return await withSerializableTransaction(async (tx) => {
    let vehicle: { id: string; plate: string }; let arrivalAt = operationAt; let pendingId: string | null = null;
    if (input.source.type === "PENDING") { const locks = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "pending_vehicles" WHERE "id" = ${input.source.pendingVehicleId} FOR UPDATE`); if (locks.length !== 1) throw new HttpError(409, "Bekleyen arac daha once isleme alindi"); const pending = await tx.pendingVehicle.findUnique({ where: { id: input.source.pendingVehicleId } }); if (!pending) throw new HttpError(409, "Bekleyen arac daha once isleme alindi"); arrivalAt = pending.createdAt; pendingId = pending.id; vehicle = await tx.vehicle.findUnique({ where: { normalizedPlate: pending.plate }, select: { id: true, plate: true } }) ?? await tx.vehicle.create({ data: { plate: pending.plate, normalizedPlate: pending.plate }, select: { id: true, plate: true } }); }
    else { const existing = await tx.vehicle.findUnique({ where: { id: input.source.vehicleId }, select: { id: true, plate: true } }); if (!existing) throw new HttpError(404, "Vehicle bulunamadi"); vehicle = existing; }
    if (input.vehicle) await tx.vehicle.update({ where: { id: vehicle.id }, data: { ...(input.vehicle.brand ? { brand: input.vehicle.brand } : {}), ...(input.vehicle.model ? { model: input.vehicle.model } : {}) } });
    let customer: { id: string } | null = null;
    if (input.customer) {
      const latest = await tx.vehicleVisit.findFirst({ where: { vehicleId: vehicle.id, customerId: { not: null } }, orderBy: [{ arrivalAt: "desc" }, { id: "desc" }], select: { customer: { select: { id: true, firstName: true, lastName: true, phone: true, note: true } } } });
      const sameCustomer = latest?.customer && latest.customer.firstName === input.customer.firstName && latest.customer.lastName === input.customer.lastName && latest.customer.phone === input.customer.phone && latest.customer.note === input.customer.note;
      customer = sameCustomer ? { id: latest.customer!.id } : await tx.customer.create({ data: input.customer, select: { id: true } });
    }
    const visit = await tx.vehicleVisit.create({ data: { vehicleId: vehicle.id, customerId: customer?.id ?? null, arrivalAt }, select: { id: true } });
    const soundOffer = input.operation.soundOfferId ? await getAcceptedSoundOfferForOperation(tx, input.operation.soundOfferId) : null;
    const price = soundOffer ? (soundOffer.manualTotal ?? soundOffer.autoTotal) : parseMoney(input.operation.priceInput, "operation.price"); const currency: SupportedCurrency = soundOffer ? "TRY" : input.operation.currency;
    const operation = await tx.vehicleOperation.create({ data: { visitId: visit.id, vehicleId: vehicle.id, operationType: input.operation.type, description: input.operation.description, price, currency, paymentMethod: input.operation.paymentMethod, operationAt, note: input.operation.note, mailOrderSupplierId: input.operation.mailOrderSupplierId, multimediaProductId: input.operation.multimediaProductId, screenProductId: input.operation.screenProductId, soundOfferId: input.operation.soundOfferId } });
    if (input.operation.type === "MULTIMEDIA") await consumeMultimediaStock(tx, operation.id, input.operation.multimediaProductId!, input.operation.screenProductId!);
    if (soundOffer && input.operation.soundOfferId) { await markSoundOfferUsed(tx, input.operation.soundOfferId); await consumeSoundStock(tx, operation.id, soundOffer.items); }
    if (input.operation.paymentMethod === "MAIL_ORDER" && input.operation.mailOrderSupplierId) await createVehicleOperationSupplierPayment({ tx, supplierId: input.operation.mailOrderSupplierId, operationId: operation.id, amount: price, currency, transactionAt: operationAt });
    if (pendingId) await tx.pendingVehicle.delete({ where: { id: pendingId } });
    return serializeOperation(operation);
  }); } catch (error) { if (isPrismaErrorCode(error, "P2002")) throw new HttpError(409, "Kayit eszamanli baska bir islemde kullanildi; tekrar deneyin"); throw error; }
};

const supplierState = (row: any): VehicleOperationSupplierPaymentState | null => row.paymentMethod === "MAIL_ORDER" && row.mailOrderSupplierId ? { supplierId: row.mailOrderSupplierId, amount: row.price, currency: row.currency, transactionAt: row.operationAt } : null;
const supplierStateKey = (state: VehicleOperationSupplierPaymentState | null) => state ? JSON.stringify({ supplierId: state.supplierId, amount: state.amount.toString(), currency: state.currency, transactionAt: state.transactionAt.toISOString() }) : "";

export const updateVehicleOperation = async (id: string, body: unknown): Promise<VehicleOperationDetail> => {
  if (!id) throw new HttpError(400, "operation id zorunlu"); const root = asRecord(body); const revision = parsePositiveInteger(root.revision, "revision"); const nextInput = parseOperationInput(root.operation); const nextOperationAt = parseOperationAt(root.operationAt);
  try { await withSerializableTransaction(async (tx) => {
    const current = await lockActiveOperation(tx, id, revision); const beforeJson = snapshotOperation(current);
    const oldMultimedia = current.operationType === "MULTIMEDIA" ? [current.multimediaProductId, current.screenProductId] : null; const newMultimedia = nextInput.type === "MULTIMEDIA" ? [nextInput.multimediaProductId, nextInput.screenProductId] : null; const multimediaChanged = JSON.stringify(oldMultimedia) !== JSON.stringify(newMultimedia);
    if (multimediaChanged && oldMultimedia) { if (!oldMultimedia[0] || !oldMultimedia[1]) throw new HttpError(409, "Eski multimedia stok baglantisi eksik"); await restoreMultimediaStock(tx, id, oldMultimedia[0], oldMultimedia[1]); }
    const oldSoundId = current.operationType === "SOUND_SYSTEM" ? current.soundOfferId : null; const newSoundId = nextInput.type === "SOUND_SYSTEM" ? nextInput.soundOfferId : null; const soundChanged = oldSoundId !== newSoundId;
    if (soundChanged && oldSoundId) { if (!current.soundOffer) throw new HttpError(409, "Eski sound offer baglantisi eksik"); await restoreSoundStock(tx, id, current.soundOffer.items); await releaseSoundOffer(tx, oldSoundId, id); await tx.vehicleOperation.update({ where: { id }, data: { soundOfferId: null } }); }
    let nextSoundOffer: any = null; if (nextInput.type === "SOUND_SYSTEM") { nextSoundOffer = soundChanged ? await getAcceptedSoundOfferForOperation(tx, newSoundId!) : current.soundOffer; if (!nextSoundOffer) throw new HttpError(409, "Sound offer bulunamadi"); }
    const price = nextSoundOffer ? (nextSoundOffer.manualTotal ?? nextSoundOffer.autoTotal) : parseMoney(nextInput.priceInput, "operation.price"); const currency: SupportedCurrency = nextSoundOffer ? "TRY" : nextInput.currency;
    const previousSupplier = supplierState(current); const nextSupplier: VehicleOperationSupplierPaymentState | null = nextInput.paymentMethod === "MAIL_ORDER" && nextInput.mailOrderSupplierId ? { supplierId: nextInput.mailOrderSupplierId, amount: price, currency, transactionAt: nextOperationAt } : null;
    if (supplierStateKey(previousSupplier) !== supplierStateKey(nextSupplier)) await reconcileVehicleOperationSupplierPayment({ tx, operationId: id, previous: previousSupplier, next: nextSupplier });
    if (multimediaChanged && newMultimedia) await consumeMultimediaStock(tx, id, newMultimedia[0]!, newMultimedia[1]!);
    if (soundChanged && newSoundId && nextSoundOffer) { await markSoundOfferUsed(tx, newSoundId); await consumeSoundStock(tx, id, nextSoundOffer.items); }
    const update = await tx.vehicleOperation.updateMany({ where: { id, revision, deletedAt: null }, data: { operationType: nextInput.type, description: nextInput.description, price, currency, paymentMethod: nextInput.paymentMethod, operationAt: nextOperationAt, note: nextInput.note, mailOrderSupplierId: nextInput.mailOrderSupplierId, multimediaProductId: nextInput.multimediaProductId, screenProductId: nextInput.screenProductId, soundOfferId: newSoundId, revision: { increment: 1 } } }); if (update.count !== 1) throw new HttpError(409, "Islem daha once degistirildi; kaydi yenileyin");
    const after = await tx.vehicleOperation.findUniqueOrThrow({ where: { id }, select: operationSelect }); await tx.vehicleOperationRevision.create({ data: { operationId: id, action: "UPDATE", fromRevision: revision, toRevision: revision + 1, beforeJson, afterJson: snapshotOperation(after) } });
  }); return getVehicleOperationDetail(id); } catch (error) { if (isPrismaErrorCode(error, "P2002")) throw new HttpError(409, "Kayit eszamanli baska bir islemde kullanildi; tekrar deneyin"); throw error; }
};

export const deleteVehicleOperation = async (id: string, body: unknown): Promise<DeleteVehicleOperationResponse> => {
  if (!id) throw new HttpError(400, "operation id zorunlu"); const revision = parsePositiveInteger(asRecord(body).revision, "revision");
  return withSerializableTransaction(async (tx) => { const current = await lockActiveOperation(tx, id, revision); const beforeJson = snapshotOperation(current);
    if (current.operationType === "MULTIMEDIA") { if (!current.multimediaProductId || !current.screenProductId) throw new HttpError(409, "Multimedia stok baglantisi eksik"); await restoreMultimediaStock(tx, id, current.multimediaProductId, current.screenProductId); }
    if (current.operationType === "SOUND_SYSTEM" && current.soundOfferId) { if (!current.soundOffer) throw new HttpError(409, "Sound offer baglantisi eksik"); await restoreSoundStock(tx, id, current.soundOffer.items); await releaseSoundOffer(tx, current.soundOfferId, id); await tx.vehicleOperation.update({ where: { id }, data: { soundOfferId: null } }); }
    const previousSupplier = supplierState(current); if (previousSupplier) await reconcileVehicleOperationSupplierPayment({ tx, operationId: id, previous: previousSupplier, next: null });
    const deletedAt = new Date(); const update = await tx.vehicleOperation.updateMany({ where: { id, revision, deletedAt: null }, data: { deletedAt, soundOfferId: null, revision: { increment: 1 } } }); if (update.count !== 1) throw new HttpError(409, "Islem daha once silindi veya degistirildi");
    const after = await tx.vehicleOperation.findUniqueOrThrow({ where: { id }, select: operationSelect }); await tx.vehicleOperationRevision.create({ data: { operationId: id, action: "DELETE", fromRevision: revision, toRevision: revision + 1, beforeJson, afterJson: snapshotOperation(after) } });
    return { operationId: id, vehicleId: current.vehicleId, visitId: current.visitId, deletedAt: deletedAt.toISOString(), revision: revision + 1 };
  });
};
