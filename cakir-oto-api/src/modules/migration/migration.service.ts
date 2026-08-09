import { createHash, randomUUID } from "node:crypto";

import JSZip from "jszip";

import { Prisma } from "../../../generated/prisma/client.js";
import { getPrisma } from "../../lib/prisma.js";
import type {
  MultimediaStockDryRunResponse,
  MultimediaStockImportResponse,
  MultimediaStockMigrationInput,
  MultimediaStockParsedRow,
  MultimediaStockPreviewItem,
  MigrationRowError,
  MigrationStatusResponse,
  ScreenStockDryRunResponse,
  ScreenStockImportResponse,
  ScreenStockMigrationInput,
  ScreenStockParsedRow,
  ScreenStockPreviewItem,
  SoundOfferMigrationInput,
  SoundOfferParsedRow,
  SoundOfferPreviewItem,
  SoundOfferWarning,
  SoundOffersDryRunResponse,
  SoundOffersImportResponse,
  SupplierDryRunResponse,
  SupplierImportResponse,
  SupplierListItem,
  SupplierMigrationInput,
  SupplierParsedRow,
  SupplierTransactionDryRunResponse,
  SupplierTransactionImportResponse,
  SupplierTransactionMigrationInput,
  SupplierTransactionMigrationRequest,
  SupplierTransactionParsedRow,
  SupplierTransactionPreviewItem,
  VehicleHistoryDryRunResponse,
  VehicleHistoryFileInput,
  VehicleHistoryImportResponse,
  VehicleHistoryPreviewItem,
  VehicleHistoryProcessInput,
  SoundStockDryRunResponse,
  SoundStockImportResponse,
  SoundStockMigrationInput,
  SoundStockParsedRow,
  SoundStockPreviewItem,
} from "./migration.types.js";

export const getMigrationModuleStatus = (): MigrationStatusResponse => ({
  success: true,
  message: "Migration modulu calisiyor",
});

const screenStockDataType = "SCREEN_STOCK";
const screenStockSourceFile = "screen_stock.json";
const multimediaStockDataType = "MULTIMEDIA_STOCK";
const multimediaStockSourceFile = "multimedia_stock.json";
const soundStockDataType = "SOUND_STOCK";
const soundStockSourceFile = "sound_stock.json";
const soundOffersDataType = "SOUND_OFFERS";
const soundOffersSourceFile = "sound_offers.json";
const suppliersDataType = "SUPPLIERS";
const suppliersSourceFile = "firm_currencies.json";
const supplierTransactionsDataType = "SUPPLIER_TRANSACTIONS";
const supplierTransactionsSourceFile = "supplier_transactions.json";
const vehicleHistoryDataType = "VEHICLE_HISTORY";
const vehicleHistorySourceFile = "vehicle_history.zip";
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

const assertScreenStockPayload = (body: unknown): ScreenStockMigrationInput[] => {
  if (!Array.isArray(body)) {
    throw new HttpError(400, "Request body JSON array olmali");
  }

  return body as ScreenStockMigrationInput[];
};

const assertMultimediaStockPayload = (body: unknown): MultimediaStockMigrationInput[] => {
  if (!Array.isArray(body)) {
    throw new HttpError(400, "Request body JSON array olmali");
  }

  return body as MultimediaStockMigrationInput[];
};

const assertSoundStockPayload = (body: unknown): SoundStockMigrationInput[] => {
  if (!Array.isArray(body)) {
    throw new HttpError(400, "Request body JSON array olmali");
  }

  return body as SoundStockMigrationInput[];
};

const assertSoundOffersPayload = (body: unknown): SoundOfferMigrationInput[] => {
  if (!Array.isArray(body)) {
    throw new HttpError(400, "Request body JSON array olmali");
  }

  return body as SoundOfferMigrationInput[];
};

const assertSupplierPayload = (body: unknown): SupplierMigrationInput => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Request body JSON object olmali");
  }

  return body as SupplierMigrationInput;
};

const assertSupplierTransactionPayload = (
  body: unknown,
): { supplierId: string; rows: SupplierTransactionMigrationInput[] } => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Request body { supplierId, rows } formatinda olmali");
  }

  const request = body as SupplierTransactionMigrationRequest;
  const supplierId = valueAsString(request.supplierId);

  if (!supplierId || !uuidRegex.test(supplierId)) {
    throw new HttpError(400, "supplierId eksik veya bozuk UUID");
  }

  if (!Array.isArray(request.rows)) {
    throw new HttpError(400, "rows JSON array olmali");
  }

  return {
    supplierId,
    rows: request.rows as SupplierTransactionMigrationInput[],
  };
};

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));

    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
};

const createFileHash = (body: unknown): string =>
  createHash("sha256").update(stableStringify(body)).digest("hex");

const valueAsString = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
};

const parseInteger = (value: unknown, fieldName: string, errors: string[]): number | undefined => {
  const text = valueAsString(value);

  if (!text || !/^-?\d+$/.test(text)) {
    errors.push(`${fieldName} parse edilemedi`);
    return undefined;
  }

  const parsed = Number(text);

  if (!Number.isSafeInteger(parsed)) {
    errors.push(`${fieldName} guvenli integer araliginda degil`);
    return undefined;
  }

  return parsed;
};

const parseDecimal = (
  value: unknown,
  fieldName: string,
  errors: string[],
  options: { required?: boolean } = {},
): string | null | undefined => {
  const text = valueAsString(value);

  if (!text) {
    if (options.required) {
      errors.push(`${fieldName} parse edilemedi`);
      return undefined;
    }

    return null;
  }

  const decimalText = text.replace(",", ".");

  if (!/^-?\d+(?:\.\d+)?$/.test(decimalText)) {
    errors.push(`${fieldName} parse edilemedi`);
    return undefined;
  }

  try {
    return new Prisma.Decimal(decimalText).toString();
  } catch {
    errors.push(`${fieldName} parse edilemedi`);
    return undefined;
  }
};

const isPositiveDecimal = (value: string | null | undefined): boolean => {
  if (!value) {
    return false;
  }

  return new Prisma.Decimal(value).greaterThan(0);
};

const normalizeName = (value: string): string =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");

const normalizeSupplierCurrency = (value: unknown, errors: string[]): "TRY" | "USD" | undefined => {
  const text = valueAsString(value)?.toUpperCase();

  if (!text) {
    errors.push("currency eksik");
    return undefined;
  }

  if (text === "TL" || text === "TRY") return "TRY";
  if (text === "USD") return "USD";

  errors.push("currency sadece TRY veya USD olmali");
  return undefined;
};

const parseSupplierTransactionType = (
  value: unknown,
  errors: string[],
): SupplierTransactionParsedRow["type"] | undefined => {
  const text = valueAsString(value)?.toLocaleLowerCase("tr-TR");

  if (!text) {
    errors.push("action eksik");
    return undefined;
  }

  if (text === "increase") return "DEBT_INCREASE";
  if (text === "payment") return "PAYMENT";

  errors.push("action desteklenmiyor");
  return undefined;
};

const resolveSupplierTransactionAction = (
  row: SupplierTransactionMigrationInput,
  errors: string[],
): { type?: SupplierTransactionParsedRow["type"]; actionInferred: boolean } => {
  if (valueAsString(row.action)) {
    return {
      type: parseSupplierTransactionType(row.action, errors),
      actionInferred: false,
    };
  }

  const addedDebt = parseDecimal(row.added_debt, "added_debt", errors);
  const paidAmount = parseDecimal(row.paid_amount, "paid_amount", errors);
  const hasAddedDebt = isPositiveDecimal(addedDebt);
  const hasPaidAmount = isPositiveDecimal(paidAmount);

  if (hasAddedDebt && !hasPaidAmount) {
    return {
      type: "DEBT_INCREASE",
      actionInferred: true,
    };
  }

  if (hasPaidAmount && !hasAddedDebt) {
    return {
      type: "PAYMENT",
      actionInferred: true,
    };
  }

  if (hasAddedDebt && hasPaidAmount) {
    errors.push("action eksik; added_debt ve paid_amount ikisi de pozitif, otomatik karar verilemedi");
    return {
      actionInferred: false,
    };
  }

  errors.push("action eksik; added_debt veya paid_amount pozitif olmali");
  return {
    actionInferred: false,
  };
};

const parseSoundSaleType = (
  value: unknown,
  errors: string[],
): SoundOfferParsedRow["saleType"] | undefined => {
  const text = valueAsString(value)?.toLocaleLowerCase("tr-TR");

  if (!text) {
    errors.push("sale_type eksik");
    return undefined;
  }

  if (text === "cash" || text === "nakit") {
    return "CASH";
  }

  if (["card", "kredi", "kredi karti", "kredi kartı", "credit"].includes(text)) {
    return "CARD";
  }

  errors.push("sale_type desteklenmiyor");
  return undefined;
};

const parseSoundOfferStatus = (
  value: unknown,
  errors: string[],
): SoundOfferParsedRow["status"] | undefined => {
  const text = valueAsString(value)?.toLocaleLowerCase("tr-TR");

  if (!text) {
    return "DRAFT";
  }

  if (["draft", "taslak"].includes(text)) return "DRAFT";
  if (["accepted", "accept", "kabul", "onaylandi", "onaylandı"].includes(text)) return "ACCEPTED";
  if (["used", "kullanildi", "kullanıldı"].includes(text)) return "USED";
  if (["cancelled", "canceled", "cancel", "iptal"].includes(text)) return "CANCELLED";

  errors.push("status desteklenmiyor");
  return undefined;
};

const parseLegacyDate = (value: unknown, fieldName: string, errors: string[]): Date | undefined => {
  const text = valueAsString(value);

  if (!text) {
    errors.push(`${fieldName} eksik`);
    return undefined;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(text);

  if (!match) {
    errors.push(`${fieldName} YYYY-MM-DD HH:mm:ss formatinda olmali`);
    return undefined;
  }

  const [, year, month, day, hour, minute, second] = match;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day) ||
    parsed.getHours() !== Number(hour) ||
    parsed.getMinutes() !== Number(minute) ||
    parsed.getSeconds() !== Number(second)
  ) {
    errors.push(`${fieldName} parse edilemedi`);
    return undefined;
  }

  return parsed;
};

const createBufferHash = (buffer: Buffer): string => createHash("sha256").update(buffer).digest("hex");

const deterministicUuid = (value: string): string => {
  const hash = createHash("sha256").update(value).digest("hex");

  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `${(8 + (Number.parseInt(hash.slice(16, 17), 16) % 4)).toString(16)}${hash.slice(17, 20)}`,
    hash.slice(20, 32),
  ].join("-");
};

const normalizePlate = (value: unknown): string | undefined => valueAsString(value)?.toUpperCase();

const normalizeLookup = (value: string): string =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");

const parseIsoLocalDate = (
  value: unknown,
  fieldName: string,
  errors: string[],
): Date | undefined => {
  const text = valueAsString(value);

  if (!text) {
    errors.push(`${fieldName} eksik`);
    return undefined;
  }

  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/.exec(text);

  if (!match) {
    errors.push(`${fieldName} ISO YYYY-MM-DDTHH:mm:ss formatinda olmali`);
    return undefined;
  }

  const [, year, month, day, hour, minute, second, fraction = "0"] = match;
  const millisecond = Number(fraction.padEnd(3, "0").slice(0, 3));
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    millisecond,
  );

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day)
  ) {
    errors.push(`${fieldName} parse edilemedi`);
    return undefined;
  }

  return parsed;
};

const dateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const parseVehiclePaymentMethod = (
  value: unknown,
  errors: string[],
): "CASH" | "CREDIT_CARD" | "BANK_TRANSFER" | "MAIL_ORDER" | undefined => {
  const text = valueAsString(value);

  if (!text) {
    errors.push("payment eksik");
    return undefined;
  }

  const normalized = normalizeLookup(text);

  if (normalized === "nakit") return "CASH";
  if (normalized === "kredi karti" || normalized === "kredi kartı") return "CREDIT_CARD";
  if (["havale / eft", "havale/eft", "havale", "eft"].includes(normalized)) {
    return "BANK_TRANSFER";
  }
  if (normalized === "mail order") return "MAIL_ORDER";

  errors.push(`payment desteklenmiyor: ${text}`);
  return undefined;
};

type VehicleHistoryParsedOperation = {
  id: string;
  legacyKey: string;
  sourceIndex: number;
  operationAt: Date;
  description: string;
  price: string;
  paymentMethod: "CASH" | "CREDIT_CARD" | "BANK_TRANSFER" | "MAIL_ORDER";
  note: string | null;
  screenProductId: string | null;
  multimediaProductId: string | null;
  mailOrderSupplierId: string | null;
};

type VehicleHistoryParsedFile = {
  id: string;
  legacyKey: string;
  sourceRow: number;
  sourcePath: string;
  folderDate: string;
  fileName: string;
  plate: string;
  arrivalAt: Date;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  visitNote: string | null;
  customer: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    note: string | null;
  } | null;
  operations: VehicleHistoryParsedOperation[];
  totalAmount: string;
};

type VehicleHistoryParseResult = {
  totalFiles: number;
  validFiles: VehicleHistoryParsedFile[];
  skippedFiles: number;
  errors: MigrationRowError[];
  warnings: string[];
};

type VehicleHistoryReferenceMaps = {
  screenIds: Set<string>;
  multimediaCodeMap: Map<string, string>;
  supplierNameMap: Map<string, string>;
  existingVehiclePlates: Set<string>;
  existingVisitIds: Set<string>;
  existingOperationIds: Set<string>;
};

const splitZipJsonPath = (path: string): { folderDate: string; fileName: string } | undefined => {
  if (path.includes("\\") || path.startsWith("/") || path.includes("..")) {
    return undefined;
  }

  const parts = path.split("/");

  if (parts.length !== 2 || !/^\d{4}-\d{2}-\d{2}$/.test(parts[0]) || !parts[1].endsWith(".json")) {
    return undefined;
  }

  return {
    folderDate: parts[0],
    fileName: parts[1],
  };
};

const resolveVehicleBrandModel = (
  input: VehicleHistoryFileInput,
  processes: VehicleHistoryProcessInput[],
  sourcePath: string,
  warnings: string[],
): { brand: string | null; model: string | null } => {
  const rootBrand = valueAsString(input.brand) ?? null;
  const rootModel = valueAsString(input.model) ?? null;
  const uniqueBrandMap = new Map<string, string>();
  const uniqueModelMap = new Map<string, string>();

  processes.forEach((process) => {
    const brand = valueAsString(process.brand);
    const model = valueAsString(process.model);

    if (brand) uniqueBrandMap.set(normalizeLookup(brand), brand);
    if (model) uniqueModelMap.set(normalizeLookup(model), model);
  });

  const resolve = (
    rootValue: string | null,
    values: Map<string, string>,
    label: "brand" | "model",
  ) => {
    if (rootValue) return rootValue;
    if (values.size === 1) return [...values.values()][0];
    if (values.size > 1) {
      warnings.push(`${sourcePath}: process ${label} degerleri celiskili, vehicle ${label} bos birakildi`);
    }

    return null;
  };

  return {
    brand: resolve(rootBrand, uniqueBrandMap, "brand"),
    model: resolve(rootModel, uniqueModelMap, "model"),
  };
};

const getVehicleHistoryReferenceMaps = async (
  visitIds: string[] = [],
  operationIds: string[] = [],
): Promise<VehicleHistoryReferenceMaps> => {
  const prisma = getPrisma();
  const [screenRows, multimediaRows, supplierRows, vehicleRows, visitRows, operationRows] =
    await Promise.all([
      prisma.screenProduct.findMany({
        select: {
          id: true,
        },
      }),
      prisma.multimediaProduct.findMany({
        select: {
          id: true,
          code: true,
        },
      }),
      prisma.supplier.findMany({
        select: {
          id: true,
          name: true,
        },
      }),
      prisma.vehicle.findMany({
        select: {
          plate: true,
        },
      }),
      visitIds.length > 0
        ? prisma.vehicleVisit.findMany({
            where: {
              id: {
                in: visitIds,
              },
            },
            select: {
              id: true,
            },
          })
        : Promise.resolve([]),
      operationIds.length > 0
        ? prisma.vehicleOperation.findMany({
            where: {
              id: {
                in: operationIds,
              },
            },
            select: {
              id: true,
            },
          })
        : Promise.resolve([]),
    ]);

  return {
    screenIds: new Set(screenRows.map((row) => row.id)),
    multimediaCodeMap: new Map(
      multimediaRows.map((row) => [normalizeLookup(row.code), row.id]),
    ),
    supplierNameMap: new Map(supplierRows.map((row) => [normalizeLookup(row.name), row.id])),
    existingVehiclePlates: new Set(vehicleRows.map((row) => normalizePlate(row.plate) ?? row.plate)),
    existingVisitIds: new Set(visitRows.map((row) => row.id)),
    existingOperationIds: new Set(operationRows.map((row) => row.id)),
  };
};

const parseVehicleHistoryOperation = (
  process: VehicleHistoryProcessInput,
  processIndex: number,
  visitLegacyKey: string,
  sourcePath: string,
  references: VehicleHistoryReferenceMaps,
  warnings: string[],
): { data?: VehicleHistoryParsedOperation; errorMessages: string[] } => {
  const errors: string[] = [];
  const operationAt = parseIsoLocalDate(process.timestamp, `processes[${processIndex}].timestamp`, errors);
  const description = valueAsString(process.description);
  const price = parseDecimal(process.price, `processes[${processIndex}].price`, errors, {
    required: true,
  });
  const paymentMethod = parseVehiclePaymentMethod(process.payment, errors);
  const screenType = valueAsString(process.screen_type);
  const multimediaType = valueAsString(process.multimedia_type);
  const mailOrderFirm = valueAsString(process.mail_order_firm);
  let screenProductId: string | null = null;
  let multimediaProductId: string | null = null;
  let mailOrderSupplierId: string | null = null;

  if (!description) {
    errors.push(`processes[${processIndex}].description eksik`);
  }

  if (screenType) {
    if (uuidRegex.test(screenType) && references.screenIds.has(screenType)) {
      screenProductId = screenType;
    } else {
      warnings.push(`${sourcePath}: screen_type eslesmedi (${screenType}), screenProductId bos birakildi`);
    }
  }

  if (multimediaType) {
    multimediaProductId = references.multimediaCodeMap.get(normalizeLookup(multimediaType)) ?? null;

    if (!multimediaProductId) {
      warnings.push(
        `${sourcePath}: multimedia_type eslesmedi (${multimediaType}), multimediaProductId bos birakildi`,
      );
    }
  }

  if (paymentMethod === "MAIL_ORDER") {
    if (mailOrderFirm) {
      mailOrderSupplierId = references.supplierNameMap.get(normalizeLookup(mailOrderFirm)) ?? null;

      if (!mailOrderSupplierId) {
        warnings.push(
          `${sourcePath}: mail_order_firm supplier ile eslesmedi (${mailOrderFirm}), supplier bos birakildi`,
        );
      }
    } else {
      warnings.push(`${sourcePath}: MAIL_ORDER isleminde mail_order_firm bos, supplier bos birakildi`);
    }
  }

  if (errors.length > 0 || !operationAt || !description || price === undefined || !paymentMethod) {
    return {
      errorMessages: errors.map((error) => `processes[${processIndex}]: ${error}`),
    };
  }

  const legacyKey = `${visitLegacyKey}|process:${processIndex}|${operationAt.toISOString()}`;

  return {
    data: {
      id: deterministicUuid(`vehicle-operation:${legacyKey}`),
      legacyKey,
      sourceIndex: processIndex,
      operationAt,
      description,
      price: price as string,
      paymentMethod,
      note: valueAsString(process.note) ?? null,
      screenProductId,
      multimediaProductId,
      mailOrderSupplierId,
    },
    errorMessages: [],
  };
};

const parseVehicleHistoryFile = (
  input: VehicleHistoryFileInput,
  sourcePath: string,
  sourceRow: number,
  folderDate: string,
  fileName: string,
  references: VehicleHistoryReferenceMaps,
  warnings: string[],
): { data?: VehicleHistoryParsedFile; error?: MigrationRowError; skipped?: true } => {
  const errors: string[] = [];
  const plate = normalizePlate(input.plate);
  const arrivalAt = parseIsoLocalDate(input.timestamp, "timestamp", errors);

  if (!plate) {
    errors.push("plate eksik");
  }

  if (arrivalAt && dateKey(arrivalAt) !== folderDate) {
    warnings.push(`${sourcePath}: klasor tarihi ile root timestamp gunu uyusmuyor`);
  }

  const processes = Array.isArray(input.processes)
    ? (input.processes as VehicleHistoryProcessInput[])
    : [];

  if (processes.length === 0) {
    warnings.push(`${sourcePath}: processes bos veya yok, dosya atlandi`);

    return {
      skipped: true,
    };
  }

  const { brand, model } = resolveVehicleBrandModel(input, processes, sourcePath, warnings);
  const visitLegacyKey = `${folderDate}|${fileName}|${valueAsString(input.timestamp) ?? ""}`;
  const operationErrors: string[] = [];
  const operations = processes.flatMap((process, processIndex) => {
    const result = parseVehicleHistoryOperation(
      process,
      processIndex,
      visitLegacyKey,
      sourcePath,
      references,
      warnings,
    );

    if (result.errorMessages.length > 0) {
      operationErrors.push(...result.errorMessages);
    }

    return result.data ? [result.data] : [];
  });

  if (operations.length === 0 && errors.length === 0) {
    warnings.push(`${sourcePath}: tum process kayitlari gecersiz, dosya atlandi`);

    return {
      skipped: true,
    };
  }

  errors.push(...operationErrors);

  if (errors.length > 0 || !plate || !arrivalAt) {
    return {
      error: {
        row: sourceRow,
        legacyKey: sourcePath,
        messages: errors,
      },
    };
  }

  const customer = {
    firstName: valueAsString(input.ad) ?? null,
    lastName: valueAsString(input.soyad) ?? null,
    phone: valueAsString(input.telefon) ?? null,
    note: valueAsString(input.musteri_notu) ?? null,
  };
  const hasCustomer = Object.values(customer).some(Boolean);
  const totalAmount = operations
    .reduce((sum, operation) => sum.add(new Prisma.Decimal(operation.price)), new Prisma.Decimal(0))
    .toString();

  return {
    data: {
      id: deterministicUuid(`vehicle-visit:${visitLegacyKey}`),
      legacyKey: visitLegacyKey,
      sourceRow,
      sourcePath,
      folderDate,
      fileName,
      plate,
      arrivalAt,
      vehicleBrand: brand,
      vehicleModel: model,
      visitNote: valueAsString(input.note) ?? null,
      customer: hasCustomer ? customer : null,
      operations,
      totalAmount,
    },
  };
};

const parseVehicleHistoryZip = async (
  zipBuffer: Buffer,
  references: VehicleHistoryReferenceMaps,
): Promise<VehicleHistoryParseResult> => {
  const warnings: string[] = [];
  const errors: MigrationRowError[] = [];
  const validFiles: VehicleHistoryParsedFile[] = [];
  let skippedFiles = 0;
  const zip = await JSZip.loadAsync(zipBuffer);
  const jsonEntries = Object.values(zip.files).filter((entry) => !entry.dir && entry.name.endsWith(".json"));

  for (const [index, entry] of jsonEntries.entries()) {
    const pathParts = splitZipJsonPath(entry.name);

    if (!pathParts) {
      errors.push({
        row: index,
        legacyKey: entry.name,
        messages: ["ZIP yolu YYYY-MM-DD/file.json formatinda olmali"],
      });
      continue;
    }

    try {
      const text = await entry.async("string");
      const parsed = JSON.parse(text) as VehicleHistoryFileInput;
      const result = parseVehicleHistoryFile(
        parsed,
        entry.name,
        index,
        pathParts.folderDate,
        pathParts.fileName,
        references,
        warnings,
      );

      if (result.data) {
        validFiles.push(result.data);
      }

      if (result.error) {
        errors.push(result.error);
      }

      if (result.skipped) {
        skippedFiles += 1;
      }
    } catch (error) {
      errors.push({
        row: index,
        legacyKey: entry.name,
        messages: [error instanceof SyntaxError ? "JSON parse edilemedi" : "ZIP entry okunamadi"],
      });
    }
  }

  return {
    totalFiles: jsonEntries.length,
    validFiles,
    skippedFiles,
    errors,
    warnings,
  };
};

const parseSoundOfferItem = (
  item: unknown,
  itemIndex: number,
  errors: string[],
): SoundOfferParsedRow["items"][number] | undefined => {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    errors.push(`items[${itemIndex}] obje degil`);
    return undefined;
  }

  const itemInput = item as { name?: unknown; price?: unknown; quantity?: unknown };
  const name = valueAsString(itemInput.name);
  const unitPurchasePriceUsd = parseDecimal(itemInput.price, `items[${itemIndex}].price`, errors, {
    required: true,
  });
  const quantity = parseInteger(itemInput.quantity, `items[${itemIndex}].quantity`, errors);

  if (!name) {
    errors.push(`items[${itemIndex}].name eksik`);
  }

  if (!name || unitPurchasePriceUsd === undefined || quantity === undefined) {
    return undefined;
  }

  return {
    sourceItem: itemIndex,
    productNameSnapshot: name,
    normalizedName: normalizeName(name),
    unitPurchasePriceUsd,
    quantity,
  };
};

const parseScreenSize = (value: unknown): { sizeInch: string | null; sizeLabel: string | null } => {
  if (value === null || value === undefined) {
    return {
      sizeInch: null,
      sizeLabel: null,
    };
  }

  const text = valueAsString(value);

  if (!text || ["NONE", "YOK", "-"].includes(text.toUpperCase())) {
    return {
      sizeInch: null,
      sizeLabel: null,
    };
  }

  const decimalText = text.replace(",", ".");

  if (/^-?\d+(?:\.\d+)?$/.test(decimalText)) {
    return {
      sizeInch: decimalText,
      sizeLabel: null,
    };
  }

  return {
    sizeInch: null,
    sizeLabel: text,
  };
};

const parseScreenStockRow = (
  row: ScreenStockMigrationInput,
  index: number,
  seenIds: Set<string>,
): { data?: ScreenStockParsedRow; error?: MigrationRowError } => {
  const errors: string[] = [];
  const id = valueAsString(row.kod);
  const brand = valueAsString(row.marka);
  const storageGb = parseInteger(row.hafiza, "hafiza", errors);
  const ramGb = parseInteger(row.ram, "ram", errors);
  const cores = parseInteger(row.cekirdek, "cekirdek", errors);
  const { sizeInch, sizeLabel } = parseScreenSize(row.boyut);
  const quantity = parseInteger(row.adet, "adet", errors);

  if (!id || !uuidRegex.test(id)) {
    errors.push("kod eksik veya bozuk UUID");
  } else if (seenIds.has(id)) {
    errors.push("kod payload icinde tekrar ediyor");
  }

  if (!brand) {
    errors.push("marka eksik");
  }

  if (errors.length > 0) {
    return {
      error: {
        row: index,
        ...(id ? { legacyKey: id } : {}),
        messages: errors,
      },
    };
  }

  seenIds.add(id!);

  return {
    data: {
      id: id as string,
      brand: brand as string,
      storageGb: storageGb as number,
      ramGb: ramGb as number,
      cores: cores as number,
      sizeInch: sizeInch as string | null,
      sizeLabel,
      quantity: quantity as number,
    },
  };
};

const parseMultimediaStockRow = (
  row: MultimediaStockMigrationInput,
  index: number,
  seenIds: Set<string>,
): { data?: MultimediaStockParsedRow; error?: MigrationRowError } => {
  const errors: string[] = [];
  const id = valueAsString(row.id);
  const code = valueAsString(row.kod);
  const quantity = parseInteger(row.adet, "adet", errors);

  if (!id || !uuidRegex.test(id)) {
    errors.push("id eksik veya bozuk UUID");
  } else if (seenIds.has(id)) {
    errors.push("id payload icinde tekrar ediyor");
  }

  if (!code) {
    errors.push("kod eksik");
  }

  if (errors.length > 0) {
    return {
      error: {
        row: index,
        ...(id ? { legacyKey: id } : {}),
        messages: errors,
      },
    };
  }

  seenIds.add(id!);

  return {
    data: {
      id: id as string,
      code: code as string,
      forx: valueAsString(row.forx) ?? null,
      model: valueAsString(row.model) ?? null,
      quantity: quantity as number,
      shelf: valueAsString(row.raf) ?? null,
      brand: valueAsString(row.marka) ?? null,
    },
  };
};

const parseSoundStockRow = (
  row: SoundStockMigrationInput,
  index: number,
  seenNames: Set<string>,
): { data?: SoundStockParsedRow; error?: MigrationRowError } => {
  const errors: string[] = [];
  const name = valueAsString(row.name);
  const purchasePriceUsd = parseDecimal(row.price, "price", errors, { required: true });
  const quantity = parseInteger(row.quantity, "quantity", errors);
  const normalizedName = name ? normalizeName(name) : undefined;

  if (!name || !normalizedName) {
    errors.push("name eksik");
  } else if (seenNames.has(normalizedName)) {
    errors.push("name payload icinde tekrar ediyor");
  }

  if (errors.length > 0) {
    return {
      error: {
        row: index,
        ...(name ? { legacyKey: name } : {}),
        messages: errors,
      },
    };
  }

  seenNames.add(normalizedName!);

  return {
    data: {
      name: name as string,
      normalizedName: normalizedName as string,
      purchasePriceUsd: purchasePriceUsd as string,
      quantity: quantity as number,
    },
  };
};

const parseSoundOfferRow = (
  row: SoundOfferMigrationInput,
  index: number,
): { data?: SoundOfferParsedRow; error?: MigrationRowError } => {
  const errors: string[] = [];
  const createdBy = valueAsString(row.user) ?? null;
  const manualTotal = parseDecimal(row.manual_total, "manual_total", errors);
  const autoTotal = parseDecimal(row.auto_total, "auto_total", errors, { required: true });
  const exchangeRate = parseDecimal(row.usd_kur, "usd_kur", errors, { required: true });
  const saleType = parseSoundSaleType(row.sale_type, errors);
  const status = parseSoundOfferStatus(row.status, errors);
  const createdAt = parseLegacyDate(row.timestamp, "timestamp", errors);

  if (!Array.isArray(row.items) || row.items.length === 0) {
    errors.push("items bos veya array degil");
  }

  const items = Array.isArray(row.items)
    ? row.items.flatMap((item, itemIndex) => {
        const parsedItem = parseSoundOfferItem(item, itemIndex, errors);

        return parsedItem ? [parsedItem] : [];
      })
    : [];

  if (errors.length > 0) {
    return {
      error: {
        row: index,
        ...(createdBy ? { legacyKey: createdBy } : {}),
        messages: errors,
      },
    };
  }

  return {
    data: {
      sourceRow: index,
      createdBy,
      items,
      manualTotal: manualTotal ?? null,
      autoTotal: autoTotal as string,
      exchangeRate: exchangeRate as string,
      saleType: saleType as SoundOfferParsedRow["saleType"],
      createdAt: createdAt as Date,
      status: status as SoundOfferParsedRow["status"],
    },
  };
};

const parseSupplierEntry = (
  nameInput: string,
  currencyInput: unknown,
  index: number,
  seenNames: Set<string>,
): { data?: SupplierParsedRow; error?: MigrationRowError } => {
  const errors: string[] = [];
  const name = nameInput.trim().replace(/\s+/g, " ");
  const normalizedName = name ? normalizeName(name) : undefined;
  const currency = normalizeSupplierCurrency(currencyInput, errors);

  if (!name || !normalizedName) {
    errors.push("firma adi eksik");
  } else if (seenNames.has(normalizedName)) {
    errors.push("firma adi payload icinde tekrar ediyor");
  }

  if (errors.length > 0) {
    return {
      error: {
        row: index,
        ...(name ? { legacyKey: name } : {}),
        messages: errors,
      },
    };
  }

  seenNames.add(normalizedName!);

  return {
    data: {
      sourceRow: index,
      name,
      normalizedName: normalizedName as string,
      currency: currency as "TRY" | "USD",
    },
  };
};

const parseSupplierTransactionRow = (
  row: SupplierTransactionMigrationInput,
  index: number,
  supplier: SupplierListItem,
): { data?: SupplierTransactionParsedRow; error?: MigrationRowError } => {
  const errors: string[] = [];
  const { type, actionInferred } = resolveSupplierTransactionAction(row, errors);
  const amount =
    type === "DEBT_INCREASE"
      ? parseDecimal(row.added_debt, "added_debt", errors, { required: true })
      : type === "PAYMENT"
        ? parseDecimal(row.paid_amount, "paid_amount", errors, { required: true })
        : undefined;
  const balanceAfter = parseDecimal(row.remaining_debt, "remaining_debt", errors, {
    required: true,
  });
  const transactionAt = parseLegacyDate(row.timestamp, "timestamp", errors);

  if (errors.length > 0 || !type || amount === undefined || balanceAfter === undefined) {
    return {
      error: {
        row: index,
        ...(row.timestamp ? { legacyKey: String(row.timestamp) } : {}),
        messages: errors,
      },
    };
  }

  return {
    data: {
      sourceRow: index,
      supplierId: supplier.id,
      supplierName: supplier.name,
      type,
      actionInferred,
      amount: amount as string,
      currency: supplier.currency,
      balanceAfter: balanceAfter as string,
      note: valueAsString(row.note) ?? null,
      transactionAt: transactionAt as Date,
    },
  };
};

const parseScreenStockPayload = (body: unknown) => {
  const payload = assertScreenStockPayload(body);
  const seenIds = new Set<string>();
  const validRows: ScreenStockParsedRow[] = [];
  const errors: MigrationRowError[] = [];

  payload.forEach((row, index) => {
    const result = parseScreenStockRow(row, index, seenIds);

    if (result.data) {
      validRows.push(result.data);
    }

    if (result.error) {
      errors.push(result.error);
    }
  });

  return {
    payload,
    total: payload.length,
    validRows,
    errors,
  };
};

const parseMultimediaStockPayload = (body: unknown) => {
  const payload = assertMultimediaStockPayload(body);
  const seenIds = new Set<string>();
  const validRows: MultimediaStockParsedRow[] = [];
  const errors: MigrationRowError[] = [];

  payload.forEach((row, index) => {
    const result = parseMultimediaStockRow(row, index, seenIds);

    if (result.data) {
      validRows.push(result.data);
    }

    if (result.error) {
      errors.push(result.error);
    }
  });

  return {
    payload,
    total: payload.length,
    validRows,
    errors,
  };
};

const parseSoundStockPayload = (body: unknown) => {
  const payload = assertSoundStockPayload(body);
  const seenNames = new Set<string>();
  const validRows: SoundStockParsedRow[] = [];
  const errors: MigrationRowError[] = [];

  payload.forEach((row, index) => {
    const result = parseSoundStockRow(row, index, seenNames);

    if (result.data) {
      validRows.push(result.data);
    }

    if (result.error) {
      errors.push(result.error);
    }
  });

  return {
    payload,
    total: payload.length,
    validRows,
    errors,
  };
};

const parseSoundOffersPayload = (body: unknown) => {
  const payload = assertSoundOffersPayload(body);
  const validRows: SoundOfferParsedRow[] = [];
  const errors: MigrationRowError[] = [];

  payload.forEach((row, index) => {
    const result = parseSoundOfferRow(row, index);

    if (result.data) {
      validRows.push(result.data);
    }

    if (result.error) {
      errors.push(result.error);
    }
  });

  return {
    payload,
    total: payload.length,
    validRows,
    errors,
  };
};

const parseSupplierPayload = (body: unknown) => {
  const payload = assertSupplierPayload(body);
  const seenNames = new Set<string>();
  const validRows: SupplierParsedRow[] = [];
  const errors: MigrationRowError[] = [];
  const entries = Object.entries(payload);

  entries.forEach(([name, currency], index) => {
    const result = parseSupplierEntry(name, currency, index, seenNames);

    if (result.data) {
      validRows.push(result.data);
    }

    if (result.error) {
      errors.push(result.error);
    }
  });

  return {
    payload,
    entries,
    total: entries.length,
    validRows,
    errors,
  };
};

const parseSupplierTransactionPayload = async (body: unknown) => {
  const { supplierId, rows } = assertSupplierTransactionPayload(body);
  const prisma = getPrisma();
  const supplier = await prisma.supplier.findUnique({
    where: {
      id: supplierId,
    },
    select: {
      id: true,
      name: true,
      currency: true,
    },
  });

  if (!supplier) {
    throw new HttpError(404, "Supplier bulunamadi");
  }

  const validRows: SupplierTransactionParsedRow[] = [];
  const errors: MigrationRowError[] = [];

  rows.forEach((row, index) => {
    const result = parseSupplierTransactionRow(row, index, supplier);

    if (result.data) {
      validRows.push(result.data);
    }

    if (result.error) {
      errors.push(result.error);
    }
  });

  return {
    payload: {
      supplierId,
      rows,
    },
    rows,
    total: rows.length,
    supplier,
    validRows,
    errors,
  };
};

const findExistingScreenProductIds = async (ids: string[]): Promise<Set<string>> => {
  if (ids.length === 0) {
    return new Set();
  }

  const prisma = getPrisma();
  const rows = await prisma.screenProduct.findMany({
    where: {
      id: {
        in: ids,
      },
    },
    select: {
      id: true,
    },
  });

  return new Set(rows.map((row) => row.id));
};

const findExistingMultimediaProductIds = async (ids: string[]): Promise<Set<string>> => {
  if (ids.length === 0) {
    return new Set();
  }

  const prisma = getPrisma();
  const rows = await prisma.multimediaProduct.findMany({
    where: {
      id: {
        in: ids,
      },
    },
    select: {
      id: true,
    },
  });

  return new Set(rows.map((row) => row.id));
};

const getSoundProductNameMap = async (): Promise<Map<string, string>> => {
  const prisma = getPrisma();
  const rows = await prisma.soundSystemProduct.findMany({
    select: {
      id: true,
      name: true,
    },
  });

  return new Map(rows.map((row) => [normalizeName(row.name), row.id]));
};

const findExistingSoundProductNames = async (): Promise<Set<string>> => {
  const prisma = getPrisma();
  const rows = await prisma.soundSystemProduct.findMany({
    select: {
      name: true,
    },
  });

  return new Set(rows.map((row) => normalizeName(row.name)));
};

const getSupplierList = async (): Promise<SupplierListItem[]> => {
  const prisma = getPrisma();

  return prisma.supplier.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      currency: true,
    },
  });
};

const findExistingSupplierNames = async (): Promise<Set<string>> => {
  const prisma = getPrisma();
  const rows = await prisma.supplier.findMany({
    select: {
      name: true,
    },
  });

  return new Set(rows.map((row) => normalizeName(row.name)));
};

const soundOfferSignature = (row: SoundOfferParsedRow): string =>
  [
    row.createdAt.toISOString(),
    row.createdBy ?? "",
    row.manualTotal ?? "",
    row.autoTotal,
    row.exchangeRate,
    row.saleType,
    row.status,
  ].join("|");

const supplierTransactionSignature = (row: SupplierTransactionParsedRow): string =>
  [
    row.supplierId,
    row.transactionAt.toISOString(),
    row.type,
    row.amount,
    row.currency,
    row.balanceAfter,
    row.note ?? "",
    "MIGRATION",
  ].join("|");

const findExistingSoundOfferSignatures = async (
  rows: SoundOfferParsedRow[],
): Promise<Set<string>> => {
  if (rows.length === 0) {
    return new Set();
  }

  const prisma = getPrisma();
  const existingRows = await prisma.soundSystemOffer.findMany({
    where: {
      createdAt: {
        in: rows.map((row) => row.createdAt),
      },
    },
    select: {
      createdAt: true,
      createdBy: true,
      manualTotal: true,
      autoTotal: true,
      exchangeRate: true,
      saleType: true,
      status: true,
    },
  });

  return new Set(
    existingRows.map((row) =>
      [
        row.createdAt.toISOString(),
        row.createdBy ?? "",
        row.manualTotal?.toString() ?? "",
        row.autoTotal.toString(),
        row.exchangeRate.toString(),
        row.saleType,
        row.status,
      ].join("|"),
    ),
  );
};

const findExistingSupplierTransactionSignatures = async (
  rows: SupplierTransactionParsedRow[],
): Promise<Set<string>> => {
  if (rows.length === 0) {
    return new Set();
  }

  const prisma = getPrisma();
  const existingRows = await prisma.supplierTransaction.findMany({
    where: {
      supplierId: rows[0].supplierId,
      sourceType: "MIGRATION",
      transactionAt: {
        in: rows.map((row) => row.transactionAt),
      },
    },
    select: {
      supplierId: true,
      transactionAt: true,
      type: true,
      amount: true,
      currency: true,
      balanceAfter: true,
      note: true,
    },
  });

  return new Set(
    existingRows.map((row) =>
      [
        row.supplierId,
        row.transactionAt.toISOString(),
        row.type,
        row.amount.toString(),
        row.currency,
        row.balanceAfter?.toString() ?? "",
        row.note ?? "",
        "MIGRATION",
      ].join("|"),
    ),
  );
};

const buildPreview = (
  validRows: ScreenStockParsedRow[],
  existingIds: Set<string>,
): ScreenStockPreviewItem[] =>
  validRows.map((row) => ({
    ...row,
    alreadyExists: existingIds.has(row.id),
  }));

const buildMultimediaPreview = (
  validRows: MultimediaStockParsedRow[],
  existingIds: Set<string>,
): MultimediaStockPreviewItem[] =>
  validRows.map((row) => ({
    ...row,
    alreadyExists: existingIds.has(row.id),
  }));

const buildSoundStockPreview = (
  validRows: SoundStockParsedRow[],
  existingNames: Set<string>,
): SoundStockPreviewItem[] =>
  validRows.map(({ normalizedName, ...row }) => ({
    ...row,
    alreadyExists: existingNames.has(normalizedName),
  }));

const buildSoundOffersPreview = (
  validRows: SoundOfferParsedRow[],
  existingSignatures: Set<string>,
): SoundOfferPreviewItem[] =>
  validRows.map((row) => ({
    id: String(row.sourceRow),
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
    itemCount: row.items.length,
    autoTotal: row.autoTotal,
    finalTotal: row.manualTotal ?? row.autoTotal,
    exchangeRate: row.exchangeRate,
    saleType: row.saleType,
    status: row.status,
    alreadyExists: existingSignatures.has(soundOfferSignature(row)),
  }));

const buildSupplierPreview = (
  validRows: SupplierParsedRow[],
  existingNames: Set<string>,
): SupplierPreviewItem[] =>
  validRows.map(({ normalizedName, sourceRow: _sourceRow, ...row }) => ({
    ...row,
    alreadyExists: existingNames.has(normalizedName),
  }));

const buildSupplierTransactionPreview = (
  validRows: SupplierTransactionParsedRow[],
  existingSignatures: Set<string>,
): SupplierTransactionPreviewItem[] => {
  const seenSignatures = new Set(existingSignatures);

  return validRows.map((row) => {
    const signature = supplierTransactionSignature(row);
    const alreadyExists = seenSignatures.has(signature);

    seenSignatures.add(signature);

    return {
      supplierName: row.supplierName,
      transactionAt: row.transactionAt.toISOString(),
      type: row.type,
      amount: row.amount,
      currency: row.currency,
      balanceAfter: row.balanceAfter,
      note: row.note,
      alreadyExists,
    };
  });
};

const countSupplierTransactionDuplicates = (
  validRows: SupplierTransactionParsedRow[],
  existingSignatures: Set<string>,
): number => {
  const seenSignatures = new Set(existingSignatures);
  let duplicateCount = 0;

  validRows.forEach((row) => {
    const signature = supplierTransactionSignature(row);

    if (seenSignatures.has(signature)) {
      duplicateCount += 1;
      return;
    }

    seenSignatures.add(signature);
  });

  return duplicateCount;
};

const buildVehicleHistoryPreview = (
  validFiles: VehicleHistoryParsedFile[],
  existingVisitIds: Set<string>,
): VehicleHistoryPreviewItem[] =>
  validFiles.slice(0, 50).map((file) => ({
    file: file.sourcePath,
    date: file.arrivalAt.toISOString(),
    plate: file.plate,
    brandModel: [file.vehicleBrand, file.vehicleModel].filter(Boolean).join(" / ") || "-",
    customer: file.customer
      ? [file.customer.firstName, file.customer.lastName, file.customer.phone].filter(Boolean).join(" ") ||
        file.customer.note
      : null,
    operationCount: file.operations.length,
    totalAmount: file.totalAmount,
    status: existingVisitIds.has(file.id) ? "EXISTING" : "NEW",
  }));

export const runScreenStockDryRun = async (body: unknown): Promise<ScreenStockDryRunResponse> => {
  const { total, validRows, errors } = parseScreenStockPayload(body);
  const existingIds = await findExistingScreenProductIds(validRows.map((row) => row.id));

  return {
    total,
    valid: validRows.length,
    invalid: errors.length,
    alreadyExists: existingIds.size,
    errors,
    preview: buildPreview(validRows, existingIds),
  };
};

export const runMultimediaStockDryRun = async (
  body: unknown,
): Promise<MultimediaStockDryRunResponse> => {
  const { total, validRows, errors } = parseMultimediaStockPayload(body);
  const existingIds = await findExistingMultimediaProductIds(validRows.map((row) => row.id));

  return {
    total,
    valid: validRows.length,
    invalid: errors.length,
    alreadyExists: existingIds.size,
    errors,
    preview: buildMultimediaPreview(validRows, existingIds),
  };
};

export const runSoundStockDryRun = async (body: unknown): Promise<SoundStockDryRunResponse> => {
  const { total, validRows, errors } = parseSoundStockPayload(body);
  const existingNames = await findExistingSoundProductNames();
  const alreadyExists = validRows.filter((row) => existingNames.has(row.normalizedName)).length;

  return {
    total,
    valid: validRows.length,
    invalid: errors.length,
    alreadyExists,
    errors,
    preview: buildSoundStockPreview(validRows, existingNames),
  };
};

export const runSoundOffersDryRun = async (body: unknown): Promise<SoundOffersDryRunResponse> => {
  const { total, validRows, errors } = parseSoundOffersPayload(body);
  const productNameMap = await getSoundProductNameMap();
  const existingSignatures = await findExistingSoundOfferSignatures(validRows);
  const warnings: SoundOfferWarning[] = [];

  validRows.forEach((row) => {
    row.items.forEach((item) => {
      if (!productNameMap.has(item.normalizedName)) {
        warnings.push({
          offerIndex: row.sourceRow,
          itemIndex: item.sourceItem,
          productName: item.productNameSnapshot,
          message: "Sound product bulunamadı, snapshot ile import edilecek",
        });
      }
    });
  });

  return {
    total,
    valid: validRows.length,
    invalid: errors.length,
    alreadyExists: validRows.filter((row) => existingSignatures.has(soundOfferSignature(row)))
      .length,
    errors,
    warnings,
    preview: buildSoundOffersPreview(validRows, existingSignatures),
  };
};

export const listSuppliers = async (): Promise<SupplierListItem[]> => getSupplierList();

export const runSuppliersDryRun = async (body: unknown): Promise<SupplierDryRunResponse> => {
  const { total, validRows, errors } = parseSupplierPayload(body);
  const existingNames = await findExistingSupplierNames();
  const alreadyExists = validRows.filter((row) => existingNames.has(row.normalizedName)).length;

  return {
    total,
    valid: validRows.length,
    invalid: errors.length,
    alreadyExists,
    warnings: [],
    errors,
    preview: buildSupplierPreview(validRows, existingNames),
  };
};

export const runSupplierTransactionsDryRun = async (
  body: unknown,
): Promise<SupplierTransactionDryRunResponse> => {
  const { total, validRows, errors } = await parseSupplierTransactionPayload(body);
  const existingSignatures = await findExistingSupplierTransactionSignatures(validRows);
  const warnings = validRows
    .filter((row) => row.actionInferred)
    .map((row) => `supplier_transactions[${row.sourceRow}]: action legacy alanlardan çıkarıldı`);

  return {
    total,
    valid: validRows.length,
    invalid: errors.length,
    alreadyExists: countSupplierTransactionDuplicates(validRows, existingSignatures),
    warnings,
    errors,
    preview: buildSupplierTransactionPreview(validRows, existingSignatures),
  };
};

export const runVehicleHistoryDryRun = async (
  zipBuffer: Buffer,
): Promise<VehicleHistoryDryRunResponse> => {
  if (!Buffer.isBuffer(zipBuffer) || zipBuffer.length === 0) {
    throw new HttpError(400, "ZIP body bos veya gecersiz");
  }

  const initialReferences = await getVehicleHistoryReferenceMaps();
  const parsed = await parseVehicleHistoryZip(zipBuffer, initialReferences);
  const visitIds = parsed.validFiles.map((file) => file.id);
  const operationIds = parsed.validFiles.flatMap((file) =>
    file.operations.map((operation) => operation.id),
  );
  const references = await getVehicleHistoryReferenceMaps(visitIds, operationIds);
  const uniquePlates = new Set(parsed.validFiles.map((file) => file.plate));
  const existingVehicles = [...uniquePlates].filter((plate) =>
    references.existingVehiclePlates.has(plate),
  ).length;

  return {
    totalFiles: parsed.totalFiles,
    validFiles: parsed.validFiles.length,
    invalidFiles: parsed.errors.length,
    skippedFiles: parsed.skippedFiles,
    totalVehicles: uniquePlates.size,
    newVehicles: uniquePlates.size - existingVehicles,
    existingVehicles,
    totalVisits: parsed.validFiles.length,
    totalOperations: parsed.validFiles.reduce((sum, file) => sum + file.operations.length, 0),
    warnings: parsed.warnings,
    errors: parsed.errors,
    preview: buildVehicleHistoryPreview(parsed.validFiles, references.existingVisitIds),
  };
};

export const importScreenStock = async (body: unknown): Promise<ScreenStockImportResponse> => {
  const { payload, total, validRows, errors } = parseScreenStockPayload(body);
  const fileHash = createFileHash(payload);
  const prisma = getPrisma();

  const previousBatch = await prisma.migrationBatch.findUnique({
    where: {
      fileHash,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (previousBatch?.status === "SUCCESS") {
    throw new HttpError(409, "Bu payload daha once basariyla import edilmis");
  }

  if (previousBatch) {
    throw new HttpError(409, "Bu payload icin migration batch zaten mevcut");
  }

  return prisma.$transaction(async (tx) => {
    const existingRows =
      validRows.length > 0
        ? await tx.screenProduct.findMany({
            where: {
              id: {
                in: validRows.map((row) => row.id),
              },
            },
            select: {
              id: true,
            },
          })
        : [];
    const existingIds = new Set(existingRows.map((row) => row.id));
    const rowsToCreate = validRows.filter((row) => !existingIds.has(row.id));
    const batch = await tx.migrationBatch.create({
      data: {
        dataType: screenStockDataType,
        sourceFile: screenStockSourceFile,
        fileHash,
        status: "RUNNING",
        totalCount: total,
        successCount: 0,
        skippedCount: 0,
        errorCount: errors.length,
      },
      select: {
        id: true,
      },
    });

    if (errors.length > 0) {
      await tx.migrationError.createMany({
        data: errors.map((error) => ({
          batchId: batch.id,
          ...(error.legacyKey ? { legacyKey: error.legacyKey } : {}),
          sourceReference: `screen_stock[${error.row}]`,
          errorType: "VALIDATION_ERROR",
          message: error.messages.join("; "),
          rawPayload: JSON.parse(
            JSON.stringify(payload[error.row] ?? null),
          ) as Prisma.InputJsonValue,
        })),
      });
    }

    const createResult =
      rowsToCreate.length > 0
        ? await tx.screenProduct.createMany({
            data: rowsToCreate.map((row) => ({
              id: row.id,
              brand: row.brand,
              storageGb: row.storageGb,
              ramGb: row.ramGb,
              cores: row.cores,
              sizeInch: row.sizeInch ? new Prisma.Decimal(row.sizeInch) : null,
              sizeLabel: row.sizeLabel,
              quantity: row.quantity,
            })),
            skipDuplicates: true,
          })
        : { count: 0 };

    const skipped = validRows.length - createResult.count;
    const status = errors.length > 0 ? "COMPLETED_WITH_ERRORS" : "SUCCESS";

    await tx.migrationBatch.update({
      where: {
        id: batch.id,
      },
      data: {
        status,
        successCount: createResult.count,
        skippedCount: skipped,
        errorCount: errors.length,
        finishedAt: new Date(),
      },
    });

    return {
      batchId: batch.id,
      total,
      success: createResult.count,
      skipped,
      error: errors.length,
    };
  });
};

export const importMultimediaStock = async (
  body: unknown,
): Promise<MultimediaStockImportResponse> => {
  const { payload, total, validRows, errors } = parseMultimediaStockPayload(body);
  const fileHash = createFileHash(payload);
  const prisma = getPrisma();

  const previousBatch = await prisma.migrationBatch.findUnique({
    where: {
      fileHash,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (previousBatch?.status === "SUCCESS") {
    throw new HttpError(409, "Bu payload daha once basariyla import edilmis");
  }

  if (previousBatch) {
    throw new HttpError(409, "Bu payload icin migration batch zaten mevcut");
  }

  return prisma.$transaction(async (tx) => {
    const existingRows =
      validRows.length > 0
        ? await tx.multimediaProduct.findMany({
            where: {
              id: {
                in: validRows.map((row) => row.id),
              },
            },
            select: {
              id: true,
            },
          })
        : [];
    const existingIds = new Set(existingRows.map((row) => row.id));
    const rowsToCreate = validRows.filter((row) => !existingIds.has(row.id));
    const batch = await tx.migrationBatch.create({
      data: {
        dataType: multimediaStockDataType,
        sourceFile: multimediaStockSourceFile,
        fileHash,
        status: "RUNNING",
        totalCount: total,
        successCount: 0,
        skippedCount: 0,
        errorCount: errors.length,
      },
      select: {
        id: true,
      },
    });

    if (errors.length > 0) {
      await tx.migrationError.createMany({
        data: errors.map((error) => ({
          batchId: batch.id,
          ...(error.legacyKey ? { legacyKey: error.legacyKey } : {}),
          sourceReference: `multimedia_stock[${error.row}]`,
          errorType: "VALIDATION_ERROR",
          message: error.messages.join("; "),
          rawPayload: JSON.parse(
            JSON.stringify(payload[error.row] ?? null),
          ) as Prisma.InputJsonValue,
        })),
      });
    }

    const createResult =
      rowsToCreate.length > 0
        ? await tx.multimediaProduct.createMany({
            data: rowsToCreate.map((row) => ({
              id: row.id,
              code: row.code,
              forx: row.forx,
              model: row.model,
              quantity: row.quantity,
              shelf: row.shelf,
              brand: row.brand,
            })),
            skipDuplicates: true,
          })
        : { count: 0 };

    const skipped = validRows.length - createResult.count;
    const status = errors.length > 0 ? "COMPLETED_WITH_ERRORS" : "SUCCESS";

    await tx.migrationBatch.update({
      where: {
        id: batch.id,
      },
      data: {
        status,
        successCount: createResult.count,
        skippedCount: skipped,
        errorCount: errors.length,
        finishedAt: new Date(),
      },
    });

    return {
      batchId: batch.id,
      total,
      success: createResult.count,
      skipped,
      error: errors.length,
    };
  });
};

export const importSoundStock = async (body: unknown): Promise<SoundStockImportResponse> => {
  const { payload, total, validRows, errors } = parseSoundStockPayload(body);
  const fileHash = createFileHash(payload);
  const prisma = getPrisma();

  const previousBatch = await prisma.migrationBatch.findUnique({
    where: {
      fileHash,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (previousBatch?.status === "SUCCESS") {
    throw new HttpError(409, "Bu payload daha once basariyla import edilmis");
  }

  if (previousBatch) {
    throw new HttpError(409, "Bu payload icin migration batch zaten mevcut");
  }

  return prisma.$transaction(async (tx) => {
    const existingRows = await tx.soundSystemProduct.findMany({
      select: {
        name: true,
      },
    });
    const existingNames = new Set(existingRows.map((row) => normalizeName(row.name)));
    const rowsToCreate = validRows.filter((row) => !existingNames.has(row.normalizedName));
    const batch = await tx.migrationBatch.create({
      data: {
        dataType: soundStockDataType,
        sourceFile: soundStockSourceFile,
        fileHash,
        status: "RUNNING",
        totalCount: total,
        successCount: 0,
        skippedCount: 0,
        errorCount: errors.length,
      },
      select: {
        id: true,
      },
    });

    if (errors.length > 0) {
      await tx.migrationError.createMany({
        data: errors.map((error) => ({
          batchId: batch.id,
          ...(error.legacyKey ? { legacyKey: error.legacyKey } : {}),
          sourceReference: `sound_stock[${error.row}]`,
          errorType: "VALIDATION_ERROR",
          message: error.messages.join("; "),
          rawPayload: JSON.parse(
            JSON.stringify(payload[error.row] ?? null),
          ) as Prisma.InputJsonValue,
        })),
      });
    }

    const createResult =
      rowsToCreate.length > 0
        ? await tx.soundSystemProduct.createMany({
            data: rowsToCreate.map((row) => ({
              name: row.name,
              purchasePriceUsd: row.purchasePriceUsd
                ? new Prisma.Decimal(row.purchasePriceUsd)
                : null,
              cashSalePrice: null,
              cardSalePrice: null,
              quantity: row.quantity,
            })),
            skipDuplicates: true,
          })
        : { count: 0 };

    const skipped = validRows.length - createResult.count;
    const status = errors.length > 0 ? "COMPLETED_WITH_ERRORS" : "SUCCESS";

    await tx.migrationBatch.update({
      where: {
        id: batch.id,
      },
      data: {
        status,
        successCount: createResult.count,
        skippedCount: skipped,
        errorCount: errors.length,
        finishedAt: new Date(),
      },
    });

    return {
      batchId: batch.id,
      total,
      success: createResult.count,
      skipped,
      error: errors.length,
    };
  });
};

export const importSoundOffers = async (body: unknown): Promise<SoundOffersImportResponse> => {
  const { payload, total, validRows, errors } = parseSoundOffersPayload(body);
  const fileHash = createFileHash(payload);
  const prisma = getPrisma();

  const previousBatch = await prisma.migrationBatch.findUnique({
    where: {
      fileHash,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (previousBatch?.status === "SUCCESS") {
    throw new HttpError(409, "Bu payload daha once basariyla import edilmis");
  }

  if (previousBatch) {
    throw new HttpError(409, "Bu payload icin migration batch zaten mevcut");
  }

  const productRows = await prisma.soundSystemProduct.findMany({
    select: {
      id: true,
      name: true,
    },
  });
  const productNameMap = new Map(productRows.map((row) => [normalizeName(row.name), row.id]));
  const existingRows =
    validRows.length > 0
      ? await prisma.soundSystemOffer.findMany({
          where: {
            createdAt: {
              in: validRows.map((row) => row.createdAt),
            },
          },
          select: {
            createdAt: true,
            createdBy: true,
            manualTotal: true,
            autoTotal: true,
            exchangeRate: true,
            saleType: true,
            status: true,
          },
        })
      : [];
  const existingSignatures = new Set(
    existingRows.map((row) =>
      [
        row.createdAt.toISOString(),
        row.createdBy ?? "",
        row.manualTotal?.toString() ?? "",
        row.autoTotal.toString(),
        row.exchangeRate.toString(),
        row.saleType,
        row.status,
      ].join("|"),
    ),
  );
  const rowsToCreate = validRows.filter((row) => !existingSignatures.has(soundOfferSignature(row)));
  const rowsToCreateWithIds = rowsToCreate.map((row) => ({
    id: randomUUID(),
    row,
  }));
  const migrationErrorData = errors.map((error) => ({
    ...(error.legacyKey ? { legacyKey: error.legacyKey } : {}),
    sourceReference: `sound_offers[${error.row}]`,
    errorType: "VALIDATION_ERROR",
    message: error.messages.join("; "),
    rawPayload: JSON.parse(JSON.stringify(payload[error.row] ?? null)) as Prisma.InputJsonValue,
  }));

  return prisma.$transaction(
    async (tx) => {
      const batch = await tx.migrationBatch.create({
        data: {
          dataType: soundOffersDataType,
          sourceFile: soundOffersSourceFile,
          fileHash,
          status: "RUNNING",
          totalCount: total,
          successCount: 0,
          skippedCount: 0,
          errorCount: errors.length,
        },
        select: {
          id: true,
        },
      });

      if (migrationErrorData.length > 0) {
        await tx.migrationError.createMany({
          data: migrationErrorData.map((error) => ({
            batchId: batch.id,
            ...error,
          })),
        });
      }

      const createResult =
        rowsToCreateWithIds.length > 0
          ? await tx.soundSystemOffer.createMany({
              data: rowsToCreateWithIds.map(({ id, row }) => ({
                id,
                createdBy: row.createdBy,
                manualTotal: row.manualTotal ? new Prisma.Decimal(row.manualTotal) : null,
                autoTotal: new Prisma.Decimal(row.autoTotal),
                exchangeRate: new Prisma.Decimal(row.exchangeRate),
                saleType: row.saleType,
                status: row.status,
                createdAt: row.createdAt,
              })),
            })
          : { count: 0 };

      const itemRows = rowsToCreateWithIds.flatMap(({ id, row }) =>
        row.items.map((item) => ({
          offerId: id,
          productId: productNameMap.get(item.normalizedName) ?? null,
          productNameSnapshot: item.productNameSnapshot,
          unitPurchasePriceUsd: item.unitPurchasePriceUsd
            ? new Prisma.Decimal(item.unitPurchasePriceUsd)
            : null,
          quantity: item.quantity,
        })),
      );

      if (itemRows.length > 0) {
        await tx.soundSystemOfferItem.createMany({
          data: itemRows,
        });
      }

      const skipped = validRows.length - createResult.count;
      const status = errors.length > 0 ? "COMPLETED_WITH_ERRORS" : "SUCCESS";

      await tx.migrationBatch.update({
        where: {
          id: batch.id,
        },
        data: {
          status,
          successCount: createResult.count,
          skippedCount: skipped,
          errorCount: errors.length,
          finishedAt: new Date(),
        },
      });

      return {
        batchId: batch.id,
        total,
        success: createResult.count,
        skipped,
        error: errors.length,
      };
    },
    {
      timeout: 30000,
    },
  );
};

export const importSuppliers = async (body: unknown): Promise<SupplierImportResponse> => {
  const { payload, entries, total, validRows, errors } = parseSupplierPayload(body);
  const fileHash = createFileHash(payload);
  const prisma = getPrisma();

  const previousBatch = await prisma.migrationBatch.findUnique({
    where: {
      fileHash,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (previousBatch?.status === "SUCCESS") {
    throw new HttpError(409, "Bu payload daha once basariyla import edilmis");
  }

  if (previousBatch) {
    throw new HttpError(409, "Bu payload icin migration batch zaten mevcut");
  }

  return prisma.$transaction(async (tx) => {
    const existingRows = await tx.supplier.findMany({
      select: {
        name: true,
      },
    });
    const existingNames = new Set(existingRows.map((row) => normalizeName(row.name)));
    const rowsToCreate = validRows.filter((row) => !existingNames.has(row.normalizedName));
    const batch = await tx.migrationBatch.create({
      data: {
        dataType: suppliersDataType,
        sourceFile: suppliersSourceFile,
        fileHash,
        status: "RUNNING",
        totalCount: total,
        successCount: 0,
        skippedCount: 0,
        errorCount: errors.length,
      },
      select: {
        id: true,
      },
    });

    if (errors.length > 0) {
      await tx.migrationError.createMany({
        data: errors.map((error) => ({
          batchId: batch.id,
          ...(error.legacyKey ? { legacyKey: error.legacyKey } : {}),
          sourceReference: `firm_currencies[${error.row}]`,
          errorType: "VALIDATION_ERROR",
          message: error.messages.join("; "),
          rawPayload: JSON.parse(
            JSON.stringify(entries[error.row] ?? null),
          ) as Prisma.InputJsonValue,
        })),
      });
    }

    const createResult =
      rowsToCreate.length > 0
        ? await tx.supplier.createMany({
            data: rowsToCreate.map((row) => ({
              name: row.name,
              currency: row.currency,
            })),
            skipDuplicates: true,
          })
        : { count: 0 };

    const skipped = validRows.length - createResult.count;
    const status = errors.length > 0 ? "COMPLETED_WITH_ERRORS" : "SUCCESS";

    await tx.migrationBatch.update({
      where: {
        id: batch.id,
      },
      data: {
        status,
        successCount: createResult.count,
        skippedCount: skipped,
        errorCount: errors.length,
        finishedAt: new Date(),
      },
    });

    return {
      batchId: batch.id,
      total,
      success: createResult.count,
      skipped,
      error: errors.length,
    };
  });
};

export const importSupplierTransactions = async (
  body: unknown,
): Promise<SupplierTransactionImportResponse> => {
  const { payload, rows, total, validRows, errors } = await parseSupplierTransactionPayload(body);
  const fileHash = createFileHash(payload);
  const prisma = getPrisma();

  const previousBatch = await prisma.migrationBatch.findUnique({
    where: {
      fileHash,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (previousBatch?.status === "SUCCESS") {
    throw new HttpError(409, "Bu payload daha once basariyla import edilmis");
  }

  if (previousBatch) {
    throw new HttpError(409, "Bu payload icin migration batch zaten mevcut");
  }

  return prisma.$transaction(async (tx) => {
    const existingRows =
      validRows.length > 0
        ? await tx.supplierTransaction.findMany({
            where: {
              supplierId: validRows[0].supplierId,
              sourceType: "MIGRATION",
              transactionAt: {
                in: validRows.map((row) => row.transactionAt),
              },
            },
            select: {
              supplierId: true,
              transactionAt: true,
              type: true,
              amount: true,
              currency: true,
              balanceAfter: true,
              note: true,
            },
          })
        : [];
    const existingSignatures = new Set(
      existingRows.map((row) =>
        [
          row.supplierId,
          row.transactionAt.toISOString(),
          row.type,
          row.amount.toString(),
          row.currency,
          row.balanceAfter?.toString() ?? "",
          row.note ?? "",
          "MIGRATION",
        ].join("|"),
      ),
    );
    const seenCreateSignatures = new Set<string>();
    const rowsToCreate = validRows.filter((row) => {
      const signature = supplierTransactionSignature(row);

      if (existingSignatures.has(signature) || seenCreateSignatures.has(signature)) {
        return false;
      }

      seenCreateSignatures.add(signature);
      return true;
    });
    const batch = await tx.migrationBatch.create({
      data: {
        dataType: supplierTransactionsDataType,
        sourceFile: supplierTransactionsSourceFile,
        fileHash,
        status: "RUNNING",
        totalCount: total,
        successCount: 0,
        skippedCount: 0,
        errorCount: errors.length,
      },
      select: {
        id: true,
      },
    });

    if (errors.length > 0) {
      await tx.migrationError.createMany({
        data: errors.map((error) => ({
          batchId: batch.id,
          ...(error.legacyKey ? { legacyKey: error.legacyKey } : {}),
          sourceReference: `supplier_transactions[${error.row}]`,
          errorType: "VALIDATION_ERROR",
          message: error.messages.join("; "),
          rawPayload: JSON.parse(
            JSON.stringify(rows[error.row] ?? null),
          ) as Prisma.InputJsonValue,
        })),
      });
    }

    const createResult =
      rowsToCreate.length > 0
        ? await tx.supplierTransaction.createMany({
            data: rowsToCreate.map((row) => ({
              supplierId: row.supplierId,
              type: row.type,
              amount: new Prisma.Decimal(row.amount),
              currency: row.currency,
              balanceAfter: new Prisma.Decimal(row.balanceAfter),
              note: row.note,
              transactionAt: row.transactionAt,
              sourceType: "MIGRATION",
            })),
          })
        : { count: 0 };

    const skipped = validRows.length - createResult.count;
    const status = errors.length > 0 ? "COMPLETED_WITH_ERRORS" : "SUCCESS";

    await tx.migrationBatch.update({
      where: {
        id: batch.id,
      },
      data: {
        status,
        successCount: createResult.count,
        skippedCount: skipped,
        errorCount: errors.length,
        finishedAt: new Date(),
      },
    });

    return {
      batchId: batch.id,
      total,
      success: createResult.count,
      skipped,
      error: errors.length,
    };
  });
};

const chunkArray = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

export const importVehicleHistory = async (
  zipBuffer: Buffer,
): Promise<VehicleHistoryImportResponse> => {
  if (!Buffer.isBuffer(zipBuffer) || zipBuffer.length === 0) {
    throw new HttpError(400, "ZIP body bos veya gecersiz");
  }

  const fileHash = createBufferHash(zipBuffer);
  const prisma = getPrisma();

  const previousBatch = await prisma.migrationBatch.findUnique({
    where: {
      fileHash,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (previousBatch?.status === "SUCCESS") {
    throw new HttpError(409, "Bu ZIP daha once basariyla import edilmis");
  }

  const initialReferences = await getVehicleHistoryReferenceMaps();
  const parsed = await parseVehicleHistoryZip(zipBuffer, initialReferences);
  const validFiles = parsed.validFiles;
  const visitIds = validFiles.map((file) => file.id);
  const operationIds = validFiles.flatMap((file) => file.operations.map((operation) => operation.id));
  const references = await getVehicleHistoryReferenceMaps(visitIds, operationIds);

  const batch = previousBatch
    ? await prisma.migrationBatch.update({
        where: {
          id: previousBatch.id,
        },
        data: {
          status: "RUNNING",
          totalCount: parsed.totalFiles,
          successCount: 0,
          skippedCount: 0,
          errorCount: parsed.errors.length,
          finishedAt: null,
        },
        select: {
          id: true,
        },
      })
    : await prisma.migrationBatch.create({
        data: {
          dataType: vehicleHistoryDataType,
          sourceFile: vehicleHistorySourceFile,
          fileHash,
          status: "RUNNING",
          totalCount: parsed.totalFiles,
          successCount: 0,
          skippedCount: 0,
          errorCount: parsed.errors.length,
        },
        select: {
          id: true,
        },
      });

  if (previousBatch) {
    await prisma.migrationError.deleteMany({
      where: {
        batchId: batch.id,
      },
    });
  }

  if (parsed.errors.length > 0) {
    for (const errorChunk of chunkArray(parsed.errors, 200)) {
      await prisma.migrationError.createMany({
        data: errorChunk.map((error) => ({
          batchId: batch.id,
          ...(error.legacyKey ? { legacyKey: error.legacyKey } : {}),
          sourceReference: error.legacyKey ?? `vehicle_history[${error.row}]`,
          errorType: "VALIDATION_ERROR",
          message: error.messages.join("; "),
          rawPayload: {
            sourcePath: error.legacyKey ?? null,
          } as Prisma.InputJsonValue,
        })),
      });
    }
  }

  const uniqueVehicleRows = new Map(
    validFiles
      .filter((file) => !references.existingVehiclePlates.has(file.plate))
      .map((file) => [
        file.plate,
        {
          plate: file.plate,
          brand: file.vehicleBrand,
          model: file.vehicleModel,
        },
      ]),
  );

  if (uniqueVehicleRows.size > 0) {
    for (const vehicleChunk of chunkArray([...uniqueVehicleRows.values()], 200)) {
      await prisma.vehicle.createMany({
        data: vehicleChunk,
        skipDuplicates: true,
      });
    }
  }

  const vehicleRows = await prisma.vehicle.findMany({
    select: {
      id: true,
      plate: true,
    },
  });
  const vehicleIdByPlate = new Map(
    vehicleRows.map((vehicle) => [normalizePlate(vehicle.plate) ?? vehicle.plate, vehicle.id]),
  );
  let success = 0;
  let skipped = parsed.skippedFiles;

  for (const fileChunk of chunkArray(validFiles, 10)) {
    const result = await prisma.$transaction(
      async (tx) => {
        let chunkSuccess = 0;
        let chunkSkipped = 0;

        for (const file of fileChunk) {
          if (references.existingVisitIds.has(file.id)) {
            chunkSkipped += 1;
            continue;
          }

          const vehicleId = vehicleIdByPlate.get(file.plate);

          if (!vehicleId) {
            chunkSkipped += 1;
            continue;
          }

          const customer = file.customer
            ? await tx.customer.create({
                data: {
                  firstName: file.customer.firstName,
                  lastName: file.customer.lastName,
                  phone: file.customer.phone,
                  note: file.customer.note,
                },
                select: {
                  id: true,
                },
              })
            : null;

          await tx.vehicleVisit.create({
            data: {
              id: file.id,
              vehicleId,
              customerId: customer?.id ?? null,
              arrivalAt: file.arrivalAt,
              note: file.visitNote,
            },
          });

          const operationRows = file.operations.filter(
            (operation) => !references.existingOperationIds.has(operation.id),
          );

          if (operationRows.length > 0) {
            await tx.vehicleOperation.createMany({
              data: operationRows.map((operation) => ({
                id: operation.id,
                visitId: file.id,
                vehicleId,
                description: operation.description,
                price: new Prisma.Decimal(operation.price),
                paymentMethod: operation.paymentMethod,
                operationAt: operation.operationAt,
                note: operation.note,
                mailOrderSupplierId: operation.mailOrderSupplierId,
                multimediaProductId: operation.multimediaProductId,
                screenProductId: operation.screenProductId,
              })),
              skipDuplicates: true,
            });
          }

          references.existingVisitIds.add(file.id);
          operationRows.forEach((operation) => references.existingOperationIds.add(operation.id));
          chunkSuccess += 1;
        }

        return {
          success: chunkSuccess,
          skipped: chunkSkipped,
        };
      },
      {
        timeout: 30000,
      },
    );

    success += result.success;
    skipped += result.skipped;
  }

  const status = parsed.errors.length > 0 ? "COMPLETED_WITH_ERRORS" : "SUCCESS";

  await prisma.migrationBatch.update({
    where: {
      id: batch.id,
    },
    data: {
      status,
      successCount: success,
      skippedCount: skipped,
      errorCount: parsed.errors.length,
      finishedAt: new Date(),
    },
  });

  return {
    batchId: batch.id,
    total: parsed.totalFiles,
    success,
    skipped,
    error: parsed.errors.length,
  };
};
