import { createHash } from "node:crypto";

import JSZip from "jszip";

import { Prisma } from "../../../generated/prisma/client.js";
import { HttpError } from "../../lib/http-error.js";
import { getPrisma } from "../../lib/prisma.js";
import type {
  MigrationRowError,
  SpecialPaymentMigrationPreviewItem,
  SpecialPaymentsDryRunResponse,
  SpecialPaymentsImportResponse,
} from "./migration.types.js";

const dataType = "SPECIAL_PAYMENTS";
const masterFileName = "owner_master.json";
const monthlyFilePattern = /^owner_(\d{4})-(0[1-9]|1[0-2])\.json$/;
const unsupportedCustomMessage = "Legacy CUSTOM alanı yeni sistemde desteklenmiyor.";

type JsonObject = Record<string, unknown>;
type FileKind = "MASTER" | "MONTHLY" | "INVALID";
type TargetKind =
  | "PERSONNEL_MASTER"
  | "LOAN_MASTER"
  | "INVOICE_MASTER"
  | "IGNORED_MASTER_CUSTOM"
  | "PERSONNEL_PAYMENT"
  | "LOAN_PAYMENT"
  | "INVOICE_PAYMENT"
  | "EXPENSE_RECORD";

type ArchiveFile = {
  name: string;
  hash: string;
  kind: FileKind;
  month: string | null;
  body: JsonObject | null;
  fileError?: string;
};

type ReferenceItem = { id: string; name: string };
type CategoryReference = ReferenceItem & {
  categoryType: "GENERAL" | "SGK" | "CUSTOM";
  isSystem: boolean;
};
type ReferenceState = {
  personnel: Map<string, ReferenceItem>;
  loans: Map<string, ReferenceItem>;
  invoices: Map<string, ReferenceItem>;
  categories: Map<string, CategoryReference>;
};

type PlannedRow = {
  sourceRow: number;
  legacyKey: string;
  file: string;
  section: string;
  kind: TargetKind;
  id: string | null;
  masterName: string | null;
  normalizedMasterName: string | null;
  date: Date | null;
  dateText: string | null;
  amount: string | null;
  description: string | null;
  status: SpecialPaymentMigrationPreviewItem["status"];
  raw: unknown;
  category?: {
    name: string;
    categoryType: "GENERAL" | "SGK";
  };
};

type PlannedError = {
  error: MigrationRowError;
  raw: unknown;
};

type FilePlan = {
  file: ArchiveFile;
  rows: PlannedRow[];
  errors: PlannedError[];
  warnings: string[];
  previouslyImported: boolean;
};

const isObject = (value: unknown): value is JsonObject =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const valueAsString = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
};

const normalizeLookup = (value: string): string =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");

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

const createEntryHash = (fileName: string, content: Buffer): string =>
  createHash("sha256")
    .update(`${dataType}\0${fileName}\0`)
    .update(content)
    .digest("hex");

const parsePositiveDecimal = (value: unknown, errors: string[]): string | undefined => {
  const text = valueAsString(value)?.replace(",", ".");

  if (!text || !/^\d+(?:\.\d+)?$/.test(text)) {
    errors.push("amount pozitif bir number veya numeric string olmalı");
    return undefined;
  }

  try {
    const decimal = new Prisma.Decimal(text);
    if (!decimal.greaterThan(0)) {
      errors.push("amount pozitif olmalı");
      return undefined;
    }
    if (decimal.decimalPlaces() > 2 || decimal.greaterThan("999999999999.99")) {
      errors.push("amount Decimal(14,2) aralığına uygun olmalı");
      return undefined;
    }
    return decimal.toString();
  } catch {
    errors.push("amount parse edilemedi");
    return undefined;
  }
};

const parseDate = (value: unknown, errors: string[]): { date: Date; text: string } | undefined => {
  const text = valueAsString(value);
  const match = text ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(text) : null;

  if (!match) {
    errors.push("date YYYY-MM-DD formatında olmalı");
    return undefined;
  }

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    errors.push("date parse edilemedi");
    return undefined;
  }

  return { date, text };
};

const cloneReferences = (references: ReferenceState): ReferenceState => ({
  personnel: new Map(references.personnel),
  loans: new Map(references.loans),
  invoices: new Map(references.invoices),
  categories: new Map(references.categories),
});

const loadReferences = async (): Promise<ReferenceState> => {
  const prisma = getPrisma();
  const [personnel, loans, invoices, categories] = await Promise.all([
    prisma.expensePersonnel.findMany({ select: { id: true, name: true } }),
    prisma.loanAccount.findMany({ select: { id: true, name: true } }),
    prisma.invoiceType.findMany({ select: { id: true, name: true } }),
    prisma.expenseCategory.findMany({
      select: { id: true, name: true, categoryType: true, isSystem: true },
    }),
  ]);

  return {
    personnel: new Map(personnel.map((row) => [normalizeLookup(row.name), row])),
    loans: new Map(loans.map((row) => [normalizeLookup(row.name), row])),
    invoices: new Map(invoices.map((row) => [normalizeLookup(row.name), row])),
    categories: new Map(categories.map((row) => [normalizeLookup(row.name), row])),
  };
};

const classifyFile = (name: string): { kind: FileKind; month: string | null; error?: string } => {
  if (name.includes("\\") || name.includes("/") || name.includes("..")) {
    return { kind: "INVALID", month: null, error: "ZIP içindeki dosyalar kök dizinde olmalı" };
  }

  if (name === masterFileName) {
    return { kind: "MASTER", month: null };
  }

  const match = monthlyFilePattern.exec(name);
  if (match) {
    return { kind: "MONTHLY", month: `${match[1]}-${match[2]}` };
  }

  return {
    kind: "INVALID",
    month: null,
    error: "Dosya adı owner_master.json veya owner_YYYY-MM.json olmalı",
  };
};

const readArchive = async (zipBuffer: Buffer): Promise<ArchiveFile[]> => {
  if (!Buffer.isBuffer(zipBuffer) || zipBuffer.length === 0) {
    throw new HttpError(400, "ZIP body boş veya geçersiz");
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBuffer);
  } catch {
    throw new HttpError(400, "ZIP dosyası okunamadı");
  }

  const entries = Object.values(zip.files).filter(
    (entry) => !entry.dir && !entry.name.startsWith("__MACOSX/") && !entry.name.endsWith(".DS_Store"),
  );
  if (entries.length === 0) {
    throw new HttpError(400, "ZIP içinde dosya bulunamadı");
  }

  const files: ArchiveFile[] = [];
  for (const entry of entries) {
    const content = await entry.async("nodebuffer");
    const classification = classifyFile(entry.name);
    let body: JsonObject | null = null;
    let fileError = classification.error;

    if (!fileError) {
      try {
        const text = content.toString("utf8").replace(/^\uFEFF/, "");
        const parsed = JSON.parse(text) as unknown;
        if (!isObject(parsed)) {
          fileError = "JSON kökü object formatında olmalı";
        } else {
          body = parsed;
        }
      } catch {
        fileError = "JSON parse edilemedi";
      }
    }

    files.push({
      name: entry.name,
      hash: createEntryHash(entry.name, content),
      kind: fileError ? "INVALID" : classification.kind,
      month: classification.month,
      body,
      ...(fileError ? { fileError } : {}),
    });
  }

  return files.sort((left, right) => {
    if (left.kind === "MASTER" && right.kind !== "MASTER") return -1;
    if (right.kind === "MASTER" && left.kind !== "MASTER") return 1;
    if (left.kind === "MONTHLY" && right.kind === "MONTHLY") {
      return (left.month ?? "").localeCompare(right.month ?? "");
    }
    if (left.kind === "MONTHLY" && right.kind === "INVALID") return -1;
    if (right.kind === "MONTHLY" && left.kind === "INVALID") return 1;
    return left.name.localeCompare(right.name);
  });
};

const previewOf = (row: PlannedRow): SpecialPaymentMigrationPreviewItem => ({
  file: row.file,
  section: row.section,
  masterName: row.masterName,
  date: row.dateText,
  amount: row.amount,
  description: row.description,
  status: row.status,
});

const addError = (
  plan: FilePlan,
  sourceRow: number,
  legacyKey: string,
  messages: string[],
  raw: unknown,
  preview: Omit<PlannedRow, "sourceRow" | "legacyKey" | "status" | "raw" | "id">,
) => {
  plan.errors.push({ error: { row: sourceRow, legacyKey, messages }, raw });
  plan.rows.push({
    ...preview,
    sourceRow,
    legacyKey,
    id: null,
    status: "ERROR",
    raw,
  });
};

const parseMasterFile = (plan: FilePlan, references: ReferenceState) => {
  const body = plan.file.body!;
  const sections: Array<{
    key: "personnel" | "loan_accounts" | "invoice_types";
    kind: TargetKind;
    references: Map<string, ReferenceItem>;
  }> = [
    { key: "personnel", kind: "PERSONNEL_MASTER", references: references.personnel },
    { key: "loan_accounts", kind: "LOAN_MASTER", references: references.loans },
    { key: "invoice_types", kind: "INVOICE_MASTER", references: references.invoices },
  ];
  let sourceRow = 0;

  for (const section of sections) {
    const values = body[section.key];
    if (values !== undefined && !Array.isArray(values)) {
      addError(
        plan,
        sourceRow++,
        `${plan.file.name}|${section.key}`,
        [`${section.key} array olmalı`],
        values,
        {
          file: plan.file.name,
          section: `master.${section.key}`,
          kind: section.kind,
          masterName: null,
          normalizedMasterName: null,
          date: null,
          dateText: null,
          amount: null,
          description: null,
        },
      );
      continue;
    }

    for (const [index, value] of (values ?? []).entries()) {
      const name = valueAsString(value);
      const legacyKey = `${plan.file.name}|${section.key}|${index}`;
      if (!name || name.length > 150) {
        addError(plan, sourceRow++, legacyKey, ["Master adı boş veya geçersiz"], value, {
          file: plan.file.name,
          section: `master.${section.key}`,
          kind: section.kind,
          masterName: null,
          normalizedMasterName: null,
          date: null,
          dateText: null,
          amount: null,
          description: null,
        });
        continue;
      }

      const normalized = normalizeLookup(name);
      const existing = section.references.get(normalized);
      plan.rows.push({
        sourceRow: sourceRow++,
        legacyKey,
        file: plan.file.name,
        section: `master.${section.key}`,
        kind: section.kind,
        id: null,
        masterName: existing?.name ?? name,
        normalizedMasterName: normalized,
        date: null,
        dateText: null,
        amount: null,
        description: null,
        status: existing ? "EXISTING" : "NEW",
        raw: value,
      });
      if (!existing) {
        section.references.set(normalized, {
          id: deterministicUuid(`special-payment-master:${section.kind}:${normalized}`),
          name,
        });
      }
    }
  }

  const customAreas = body.custom_areas;
  if (Array.isArray(customAreas) && customAreas.length > 0) {
    plan.warnings.push(`${plan.file.name}: custom_areas master kayıtları import edilmedi.`);
    customAreas.forEach((value, index) => {
      plan.rows.push({
        sourceRow: sourceRow++,
        legacyKey: `${plan.file.name}|custom_areas|${index}`,
        file: plan.file.name,
        section: "custom_areas",
        kind: "IGNORED_MASTER_CUSTOM",
        id: null,
        masterName: valueAsString(value) ?? null,
        normalizedMasterName: null,
        date: null,
        dateText: null,
        amount: null,
        description: null,
        status: "SKIPPED",
        raw: value,
      });
    });
  } else if (customAreas !== undefined) {
    plan.warnings.push(`${plan.file.name}: custom_areas master kaydı import edilmedi.`);
    plan.rows.push({
      sourceRow,
      legacyKey: `${plan.file.name}|custom_areas`,
      file: plan.file.name,
      section: "custom_areas",
      kind: "IGNORED_MASTER_CUSTOM",
      id: null,
      masterName: null,
      normalizedMasterName: null,
      date: null,
      dateText: null,
      amount: null,
      description: null,
      status: "SKIPPED",
      raw: customAreas,
    });
  }
};

const ensureCategoryReference = (
  plan: FilePlan,
  references: ReferenceState,
  name: string,
  categoryType: "GENERAL" | "SGK",
): { category: CategoryReference; compatible: boolean } => {
  const normalized = normalizeLookup(name);
  const existing = references.categories.get(normalized);
  if (existing) {
    if (existing.categoryType !== categoryType || !existing.isSystem) {
      plan.warnings.push(
        `${plan.file.name}: mevcut “${existing.name}” kategorisinin tipi/isSystem değeri uyumsuz; tarihsel kayıt değiştirilmedi ve ilgili satırlar atlanacak.`,
      );
    }
    return {
      category: existing,
      compatible: existing.categoryType === categoryType && existing.isSystem,
    };
  }

  const created: CategoryReference = {
    id: deterministicUuid(`special-payment-category:${normalized}`),
    name,
    categoryType,
    isSystem: true,
  };
  references.categories.set(normalized, created);
  return { category: created, compatible: true };
};

const parseMonthlyFile = (plan: FilePlan, references: ReferenceState) => {
  const body = plan.file.body!;
  let sourceRow = 0;

  const parsePaymentSection = (
    sectionName: "personnel" | "loans" | "invoices",
    kind: "PERSONNEL_PAYMENT" | "LOAN_PAYMENT" | "INVOICE_PAYMENT",
    masterReferences: Map<string, ReferenceItem>,
  ) => {
    const section = body[sectionName];
    if (section === undefined) return;
    if (!isObject(section)) {
      addError(plan, sourceRow++, `${plan.file.name}|${sectionName}`, [`${sectionName} object olmalı`], section, {
        file: plan.file.name,
        section: sectionName,
        kind,
        masterName: null,
        normalizedMasterName: null,
        date: null,
        dateText: null,
        amount: null,
        description: null,
      });
      return;
    }

    for (const [masterNameRaw, records] of Object.entries(section)) {
      const masterName = masterNameRaw.trim();
      const normalizedMasterName = normalizeLookup(masterName);
      const master = masterReferences.get(normalizedMasterName);
      if (!Array.isArray(records)) {
        addError(
          plan,
          sourceRow++,
          `${plan.file.name}|${sectionName}|${masterName}`,
          [`${sectionName}.${masterName} array olmalı`],
          records,
          {
            file: plan.file.name,
            section: sectionName,
            kind,
            masterName,
            normalizedMasterName,
            date: null,
            dateText: null,
            amount: null,
            description: null,
          },
        );
        continue;
      }

      records.forEach((raw, index) => {
        const legacyKey = `${plan.file.name}|${sectionName}|${masterName}|${index}`;
        if (!isObject(raw)) {
          addError(plan, sourceRow++, legacyKey, ["Kayıt object olmalı"], raw, {
            file: plan.file.name,
            section: sectionName,
            kind,
            masterName,
            normalizedMasterName,
            date: null,
            dateText: null,
            amount: null,
            description: null,
          });
          return;
        }

        const errors: string[] = [];
        const parsedDate = parseDate(raw.date, errors);
        const amount = parsePositiveDecimal(raw.amount, errors);
        const description = valueAsString(raw.note) ?? valueAsString(raw.desc) ?? null;
        if (errors.length > 0 || !parsedDate || !amount) {
          addError(plan, sourceRow++, legacyKey, errors, raw, {
            file: plan.file.name,
            section: sectionName,
            kind,
            masterName,
            normalizedMasterName,
            date: parsedDate?.date ?? null,
            dateText: parsedDate?.text ?? null,
            amount: amount ?? null,
            description,
          });
          return;
        }

        if (parsedDate.text.slice(0, 7) !== plan.file.month) {
          plan.warnings.push(
            `${plan.file.name} ${sectionName}.${masterName}[${index}]: kayıt ayı dosya ayı ile uyuşmuyor.`,
          );
        }
        if (!master) {
          plan.warnings.push(
            `${plan.file.name} ${sectionName}.${masterName}[${index}]: master bulunamadı, kayıt atlandı.`,
          );
        }

        const idKey = `${plan.file.name}|${masterName}|${parsedDate.text}|${index}`;
        plan.rows.push({
          sourceRow: sourceRow++,
          legacyKey: idKey,
          file: plan.file.name,
          section: sectionName,
          kind,
          id: deterministicUuid(`special-payment:${kind}:${idKey}`),
          masterName: master?.name ?? masterName,
          normalizedMasterName,
          date: parsedDate.date,
          dateText: parsedDate.text,
          amount,
          description,
          status: master ? "NEW" : "SKIPPED",
          raw,
        });
      });
    }
  };

  const parseExpenseSection = (
    sectionName: "expenses" | "sgk",
    categoryName: string,
    categoryType: "GENERAL" | "SGK",
  ) => {
    const records = body[sectionName];
    if (records === undefined) return;
    if (!Array.isArray(records)) {
      addError(plan, sourceRow++, `${plan.file.name}|${sectionName}`, [`${sectionName} array olmalı`], records, {
        file: plan.file.name,
        section: sectionName,
        kind: "EXPENSE_RECORD",
        masterName: categoryName,
        normalizedMasterName: normalizeLookup(categoryName),
        date: null,
        dateText: null,
        amount: null,
        description: null,
        category: { name: categoryName, categoryType },
      });
      return;
    }

    const { category, compatible } = ensureCategoryReference(
      plan,
      references,
      categoryName,
      categoryType,
    );
    records.forEach((raw, index) => {
      const legacyKey = `${plan.file.name}|${sectionName}|${index}`;
      if (!isObject(raw)) {
        addError(plan, sourceRow++, legacyKey, ["Kayıt object olmalı"], raw, {
          file: plan.file.name,
          section: sectionName,
          kind: "EXPENSE_RECORD",
          masterName: category.name,
          normalizedMasterName: normalizeLookup(category.name),
          date: null,
          dateText: null,
          amount: null,
          description: null,
          category: { name: categoryName, categoryType },
        });
        return;
      }

      const errors: string[] = [];
      const parsedDate = parseDate(raw.date, errors);
      const amount = parsePositiveDecimal(raw.amount, errors);
      const description = valueAsString(raw.desc) ?? valueAsString(raw.note) ?? null;
      if (errors.length > 0 || !parsedDate || !amount) {
        addError(plan, sourceRow++, legacyKey, errors, raw, {
          file: plan.file.name,
          section: sectionName,
          kind: "EXPENSE_RECORD",
          masterName: category.name,
          normalizedMasterName: normalizeLookup(category.name),
          date: parsedDate?.date ?? null,
          dateText: parsedDate?.text ?? null,
          amount: amount ?? null,
          description,
          category: { name: categoryName, categoryType },
        });
        return;
      }

      if (parsedDate.text.slice(0, 7) !== plan.file.month) {
        plan.warnings.push(
          `${plan.file.name} ${sectionName}[${index}]: kayıt ayı dosya ayı ile uyuşmuyor.`,
        );
      }
      plan.rows.push({
        sourceRow: sourceRow++,
        legacyKey: `${plan.file.name}|${sectionName}|${parsedDate.text}|${index}`,
        file: plan.file.name,
        section: sectionName,
        kind: "EXPENSE_RECORD",
        id: deterministicUuid(
          `special-payment:EXPENSE_RECORD:${plan.file.name}|${sectionName}|${parsedDate.text}|${index}`,
        ),
        masterName: category.name,
        normalizedMasterName: normalizeLookup(category.name),
        date: parsedDate.date,
        dateText: parsedDate.text,
        amount,
        description,
        status: compatible ? "NEW" : "SKIPPED",
        raw,
        category: { name: categoryName, categoryType },
      });
    });
  };

  parsePaymentSection("personnel", "PERSONNEL_PAYMENT", references.personnel);
  parsePaymentSection("loans", "LOAN_PAYMENT", references.loans);
  parsePaymentSection("invoices", "INVOICE_PAYMENT", references.invoices);
  parseExpenseSection("expenses", "Giderler", "GENERAL");
  parseExpenseSection("sgk", "SGK & Vergiler", "SGK");

  const custom = body.custom;
  if (custom === undefined) return;
  if (!isObject(custom)) {
    addError(plan, sourceRow, `${plan.file.name}|custom`, ["custom object olmalı"], custom, {
      file: plan.file.name,
      section: "custom",
      kind: "EXPENSE_RECORD",
      masterName: null,
      normalizedMasterName: null,
      date: null,
      dateText: null,
      amount: null,
      description: null,
    });
    return;
  }

  for (const [customNameRaw, records] of Object.entries(custom)) {
    const customName = customNameRaw.trim();
    const isMeal = normalizeLookup(customName) === normalizeLookup("YEMEK");
    if (!isMeal) {
      const recordCount = Array.isArray(records) ? records.length : 1;
      plan.warnings.push(`${plan.file.name} custom.${customName}: ${unsupportedCustomMessage}`);
      for (let index = 0; index < recordCount; index += 1) {
        const raw = Array.isArray(records) ? records[index] : records;
        plan.rows.push({
          sourceRow: sourceRow++,
          legacyKey: `${plan.file.name}|custom|${customName}|${index}`,
          file: plan.file.name,
          section: `custom.${customName}`,
          kind: "EXPENSE_RECORD",
          id: null,
          masterName: customName,
          normalizedMasterName: normalizeLookup(customName),
          date: null,
          dateText: isObject(raw) ? (valueAsString(raw.date) ?? null) : null,
          amount: isObject(raw) ? (valueAsString(raw.amount) ?? null) : null,
          description: isObject(raw)
            ? (valueAsString(raw.desc) ?? valueAsString(raw.note) ?? null)
            : null,
          status: "SKIPPED",
          raw,
        });
      }
      continue;
    }

    if (!Array.isArray(records)) {
      addError(plan, sourceRow++, `${plan.file.name}|custom|${customName}`, ["custom.YEMEK array olmalı"], records, {
        file: plan.file.name,
        section: "custom.YEMEK",
        kind: "EXPENSE_RECORD",
        masterName: "Yemek",
        normalizedMasterName: normalizeLookup("Yemek"),
        date: null,
        dateText: null,
        amount: null,
        description: null,
        category: { name: "Yemek", categoryType: "GENERAL" },
      });
      continue;
    }

    const { category, compatible } = ensureCategoryReference(
      plan,
      references,
      "Yemek",
      "GENERAL",
    );
    records.forEach((raw, index) => {
      const legacyKey = `${plan.file.name}|custom|${customName}|${index}`;
      if (!isObject(raw)) {
        addError(plan, sourceRow++, legacyKey, ["Kayıt object olmalı"], raw, {
          file: plan.file.name,
          section: "custom.YEMEK",
          kind: "EXPENSE_RECORD",
          masterName: category.name,
          normalizedMasterName: normalizeLookup(category.name),
          date: null,
          dateText: null,
          amount: null,
          description: null,
          category: { name: "Yemek", categoryType: "GENERAL" },
        });
        return;
      }

      const errors: string[] = [];
      const parsedDate = parseDate(raw.date, errors);
      const amount = parsePositiveDecimal(raw.amount, errors);
      const description = valueAsString(raw.desc) ?? valueAsString(raw.note) ?? null;
      if (errors.length > 0 || !parsedDate || !amount) {
        addError(plan, sourceRow++, legacyKey, errors, raw, {
          file: plan.file.name,
          section: "custom.YEMEK",
          kind: "EXPENSE_RECORD",
          masterName: category.name,
          normalizedMasterName: normalizeLookup(category.name),
          date: parsedDate?.date ?? null,
          dateText: parsedDate?.text ?? null,
          amount: amount ?? null,
          description,
          category: { name: "Yemek", categoryType: "GENERAL" },
        });
        return;
      }

      if (parsedDate.text.slice(0, 7) !== plan.file.month) {
        plan.warnings.push(
          `${plan.file.name} custom.YEMEK[${index}]: kayıt ayı dosya ayı ile uyuşmuyor.`,
        );
      }
      plan.rows.push({
        sourceRow: sourceRow++,
        legacyKey: `${plan.file.name}|custom.YEMEK|${parsedDate.text}|${index}`,
        file: plan.file.name,
        section: "custom.YEMEK",
        kind: "EXPENSE_RECORD",
        id: deterministicUuid(
          `special-payment:EXPENSE_RECORD:${plan.file.name}|custom|${parsedDate.text}|${index}`,
        ),
        masterName: category.name,
        normalizedMasterName: normalizeLookup(category.name),
        date: parsedDate.date,
        dateText: parsedDate.text,
        amount,
        description,
        status: compatible ? "NEW" : "SKIPPED",
        raw,
        category: { name: "Yemek", categoryType: "GENERAL" },
      });
    });
  }
};

const buildPlans = async (files: ArchiveFile[]): Promise<FilePlan[]> => {
  const references = cloneReferences(await loadReferences());
  const prisma = getPrisma();
  const previousBatches = await prisma.migrationBatch.findMany({
    where: { fileHash: { in: files.map((file) => file.hash) } },
    select: { fileHash: true, status: true },
  });
  const successfulHashes = new Set(
    previousBatches.filter((batch) => batch.status === "SUCCESS").map((batch) => batch.fileHash),
  );
  const plans: FilePlan[] = [];

  for (const file of files) {
    const plan: FilePlan = {
      file,
      rows: [],
      errors: [],
      warnings: [],
      previouslyImported: successfulHashes.has(file.hash),
    };

    if (file.kind === "INVALID" || !file.body) {
      addError(plan, 0, file.name, [file.fileError ?? "Geçersiz dosya"], null, {
        file: file.name,
        section: "file",
        kind: "IGNORED_MASTER_CUSTOM",
        masterName: null,
        normalizedMasterName: null,
        date: null,
        dateText: null,
        amount: null,
        description: null,
      });
    } else if (file.kind === "MASTER") {
      parseMasterFile(plan, references);
    } else {
      parseMonthlyFile(plan, references);
    }

    if (plan.previouslyImported) {
      plan.warnings.push(`${file.name}: dosya daha önce başarıyla import edilmiş.`);
      plan.rows.forEach((row) => {
        if (row.status === "NEW") row.status = "EXISTING";
      });
    }
    plans.push(plan);
  }

  const idsByKind = new Map<TargetKind, string[]>();
  plans.flatMap((plan) => plan.rows).forEach((row) => {
    if (!row.id || row.status !== "NEW") return;
    idsByKind.set(row.kind, [...(idsByKind.get(row.kind) ?? []), row.id]);
  });
  const [personnelIds, loanIds, invoiceIds, expenseIds] = await Promise.all([
    prisma.expensePersonnelPayment.findMany({
      where: { id: { in: idsByKind.get("PERSONNEL_PAYMENT") ?? [] } },
      select: { id: true },
    }),
    prisma.loanPayment.findMany({
      where: { id: { in: idsByKind.get("LOAN_PAYMENT") ?? [] } },
      select: { id: true },
    }),
    prisma.invoicePayment.findMany({
      where: { id: { in: idsByKind.get("INVOICE_PAYMENT") ?? [] } },
      select: { id: true },
    }),
    prisma.expenseRecord.findMany({
      where: { id: { in: idsByKind.get("EXPENSE_RECORD") ?? [] } },
      select: { id: true },
    }),
  ]);
  const existingIds = new Set(
    [...personnelIds, ...loanIds, ...invoiceIds, ...expenseIds].map((row) => row.id),
  );
  plans.flatMap((plan) => plan.rows).forEach((row) => {
    if (row.id && row.status === "NEW" && existingIds.has(row.id)) row.status = "EXISTING";
  });

  return plans;
};

const countRows = (plans: FilePlan[], section: string) =>
  plans.flatMap((plan) => plan.rows).filter((row) => row.section === section && row.status !== "ERROR").length;

const dryRunFromPlans = (plans: FilePlan[]): SpecialPaymentsDryRunResponse => ({
  totalFiles: plans.length,
  validFiles: plans.filter((plan) => plan.file.kind !== "INVALID").length,
  invalidFiles: plans.filter((plan) => plan.file.kind === "INVALID").length,
  personnelPayments: countRows(plans, "personnel"),
  loanPayments: countRows(plans, "loans"),
  invoicePayments: countRows(plans, "invoices"),
  expenseRecords: countRows(plans, "expenses"),
  sgkRecords: countRows(plans, "sgk"),
  mealRecords: countRows(plans, "custom.YEMEK"),
  skippedCustomRecords: plans
    .flatMap((plan) => plan.rows)
    .filter((row) => row.section.startsWith("custom.") && row.section !== "custom.YEMEK" && row.status === "SKIPPED")
    .length,
  warnings: plans.flatMap((plan) => plan.warnings),
  errors: plans.flatMap((plan) => plan.errors.map(({ error }) => error)),
  preview: plans.flatMap((plan) => plan.rows.map(previewOf)),
});

export const runSpecialPaymentsDryRun = async (
  zipBuffer: Buffer,
): Promise<SpecialPaymentsDryRunResponse> => dryRunFromPlans(await buildPlans(await readArchive(zipBuffer)));

const refreshReferenceMaps = async (tx: Prisma.TransactionClient): Promise<ReferenceState> => {
  const [personnel, loans, invoices, categories] = await Promise.all([
    tx.expensePersonnel.findMany({ select: { id: true, name: true } }),
    tx.loanAccount.findMany({ select: { id: true, name: true } }),
    tx.invoiceType.findMany({ select: { id: true, name: true } }),
    tx.expenseCategory.findMany({
      select: { id: true, name: true, categoryType: true, isSystem: true },
    }),
  ]);
  return {
    personnel: new Map(personnel.map((row) => [normalizeLookup(row.name), row])),
    loans: new Map(loans.map((row) => [normalizeLookup(row.name), row])),
    invoices: new Map(invoices.map((row) => [normalizeLookup(row.name), row])),
    categories: new Map(categories.map((row) => [normalizeLookup(row.name), row])),
  };
};

const writeFilePlan = async (plan: FilePlan) => {
  const prisma = getPrisma();
  return prisma.$transaction(
    async (tx) => {
      const previousBatch = await tx.migrationBatch.findUnique({
        where: { fileHash: plan.file.hash },
        select: { id: true, status: true, totalCount: true },
      });
      if (previousBatch?.status === "SUCCESS") {
        return {
          batchId: previousBatch.id,
          success: 0,
          skipped: previousBatch.totalCount,
          error: 0,
        };
      }

      const batch = previousBatch
        ? await tx.migrationBatch.update({
            where: { id: previousBatch.id },
            data: {
              dataType,
              sourceFile: plan.file.name,
              status: "RUNNING",
              totalCount: plan.rows.length,
              successCount: 0,
              skippedCount: 0,
              errorCount: plan.errors.length,
              finishedAt: null,
            },
            select: { id: true },
          })
        : await tx.migrationBatch.create({
            data: {
              dataType,
              sourceFile: plan.file.name,
              fileHash: plan.file.hash,
              status: "RUNNING",
              totalCount: plan.rows.length,
              errorCount: plan.errors.length,
            },
            select: { id: true },
          });

      if (previousBatch) {
        await tx.migrationError.deleteMany({ where: { batchId: batch.id } });
      }
      if (plan.errors.length > 0) {
        await tx.migrationError.createMany({
          data: plan.errors.map(({ error, raw }) => ({
            batchId: batch.id,
            legacyKey: error.legacyKey,
            sourceReference: error.legacyKey,
            errorType: "VALIDATION_ERROR",
            message: error.messages.join("; "),
            rawPayload:
              raw === null || raw === undefined
                ? Prisma.JsonNull
                : (raw as Prisma.InputJsonValue),
          })),
        });
      }

      let success = 0;
      let skipped = plan.rows.filter((row) => row.status === "SKIPPED" || row.status === "EXISTING").length;
      const newRows = plan.rows.filter((row) => row.status === "NEW");
      const createMasterRows = async (
        kind: "PERSONNEL_MASTER" | "LOAN_MASTER" | "INVOICE_MASTER",
      ) => {
        const rows = newRows.filter((row) => row.kind === kind && row.masterName);
        if (rows.length === 0) return;
        const data = rows.map((row) => ({ name: row.masterName! }));
        const result =
          kind === "PERSONNEL_MASTER"
            ? await tx.expensePersonnel.createMany({ data, skipDuplicates: true })
            : kind === "LOAN_MASTER"
              ? await tx.loanAccount.createMany({ data, skipDuplicates: true })
              : await tx.invoiceType.createMany({ data, skipDuplicates: true });
        success += result.count;
        skipped += rows.length - result.count;
      };
      await createMasterRows("PERSONNEL_MASTER");
      await createMasterRows("LOAN_MASTER");
      await createMasterRows("INVOICE_MASTER");

      const categoriesToCreate = new Map<string, NonNullable<PlannedRow["category"]>>();
      newRows.forEach((row) => {
        if (row.category) {
          categoriesToCreate.set(normalizeLookup(row.category.name), row.category);
        }
      });
      for (const category of categoriesToCreate.values()) {
        const references = await refreshReferenceMaps(tx);
        if (!references.categories.has(normalizeLookup(category.name))) {
          await tx.expenseCategory.create({
            data: { name: category.name, categoryType: category.categoryType, isSystem: true },
          });
        }
      }

      const references = await refreshReferenceMaps(tx);
      const personnelRows = newRows.filter((row) => row.kind === "PERSONNEL_PAYMENT" && row.id);
      const personnelData = personnelRows.flatMap((row) => {
        const personnel = references.personnel.get(row.normalizedMasterName!);
        return personnel
          ? [{ id: row.id!, personnelId: personnel.id, paymentDate: row.date!, amount: new Prisma.Decimal(row.amount!), note: row.description }]
          : [];
      });
      const personnelCreated = personnelData.length
        ? (await tx.expensePersonnelPayment.createMany({ data: personnelData, skipDuplicates: true })).count
        : 0;
      success += personnelCreated;
      skipped += personnelRows.length - personnelCreated;

      const loanRows = newRows.filter((row) => row.kind === "LOAN_PAYMENT" && row.id);
      const loanData = loanRows.flatMap((row) => {
        const account = references.loans.get(row.normalizedMasterName!);
        return account
          ? [{ id: row.id!, loanAccountId: account.id, paymentDate: row.date!, amount: new Prisma.Decimal(row.amount!), note: row.description }]
          : [];
      });
      const loansCreated = loanData.length
        ? (await tx.loanPayment.createMany({ data: loanData, skipDuplicates: true })).count
        : 0;
      success += loansCreated;
      skipped += loanRows.length - loansCreated;

      const invoiceRows = newRows.filter((row) => row.kind === "INVOICE_PAYMENT" && row.id);
      const invoiceData = invoiceRows.flatMap((row) => {
        const invoice = references.invoices.get(row.normalizedMasterName!);
        return invoice
          ? [{ id: row.id!, invoiceTypeId: invoice.id, paymentDate: row.date!, amount: new Prisma.Decimal(row.amount!), note: row.description }]
          : [];
      });
      const invoicesCreated = invoiceData.length
        ? (await tx.invoicePayment.createMany({ data: invoiceData, skipDuplicates: true })).count
        : 0;
      success += invoicesCreated;
      skipped += invoiceRows.length - invoicesCreated;

      const expenseRows = newRows.filter((row) => row.kind === "EXPENSE_RECORD" && row.id);
      const expenseData = expenseRows.flatMap((row) => {
        const category = references.categories.get(row.normalizedMasterName!);
        return category
          ? [{ id: row.id!, categoryId: category.id, expenseDate: row.date!, amount: new Prisma.Decimal(row.amount!), description: row.description }]
          : [];
      });
      const expensesCreated = expenseData.length
        ? (await tx.expenseRecord.createMany({ data: expenseData, skipDuplicates: true })).count
        : 0;
      success += expensesCreated;
      skipped += expenseRows.length - expensesCreated;

      const status = plan.errors.length > 0 ? "COMPLETED_WITH_ERRORS" : "SUCCESS";
      await tx.migrationBatch.update({
        where: { id: batch.id },
        data: {
          status,
          successCount: success,
          skippedCount: skipped,
          errorCount: plan.errors.length,
          finishedAt: new Date(),
        },
      });

      return { batchId: batch.id, success, skipped, error: plan.errors.length };
    },
    { timeout: 30000 },
  );
};

export const importSpecialPayments = async (
  zipBuffer: Buffer,
): Promise<SpecialPaymentsImportResponse> => {
  const plans = await buildPlans(await readArchive(zipBuffer));
  if (plans.every((plan) => plan.previouslyImported)) {
    throw new HttpError(409, "Seçilen dosyaların tamamı daha önce başarıyla import edilmiş");
  }
  const batchIds: string[] = [];
  let success = 0;
  let skipped = 0;
  let error = 0;

  for (const plan of plans) {
    const result = await writeFilePlan(plan);
    batchIds.push(result.batchId);
    success += result.success;
    skipped += result.skipped;
    error += result.error;
  }

  return {
    batchId: batchIds.join(", "),
    batchIds,
    total: plans.reduce((total, plan) => total + plan.rows.length, 0),
    success,
    skipped,
    error,
  };
};
