import { Prisma } from "../../../generated/prisma/client.js";

import { HttpError, isPrismaErrorCode } from "../../lib/http-error.js";
import { moneyToString, parseMoney } from "../../lib/money.js";
import { getPrisma } from "../../lib/prisma.js";
import { withSerializableTransaction, type BusinessTransaction } from "../../lib/transaction.js";
import { asRecord, oneOf, optionalString, requiredString } from "../../lib/validation.js";
import type {
  SpecialPaymentCategory,
  SpecialPaymentDailyTotalDto,
  SpecialPaymentInput,
  SpecialPaymentItemDto,
  SpecialPaymentListDto,
  SpecialPaymentLookupDto,
  SpecialPaymentPeriod,
  SpecialPaymentPeriodFilter,
  SpecialPaymentSummaryDto,
} from "./special-payment.types.js";

const categories = ["personnel", "expense", "invoice", "loan", "sgk", "meal"] as const;
const periods = ["day", "month", "year"] as const;
const timeZone = "Europe/Istanbul";
const mealName = "Yemek";

const systemCategoryByPayment = {
  expense: { name: "Giderler", categoryType: "GENERAL" },
  sgk: { name: "SGK & Vergiler", categoryType: "SGK" },
  meal: { name: mealName, categoryType: "GENERAL" },
} as const;

const scalarString = (value: unknown, fieldName: string): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new HttpError(400, `${fieldName} tek bir string olmalı`);
  return value;
};

const currentIstanbulDate = (): string => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const parseDateKey = (value: unknown, fieldName: string, fallback?: string): string => {
  const text = value === undefined ? fallback : scalarString(value, fieldName);
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new HttpError(400, `${fieldName} YYYY-MM-DD formatında olmalı`);
  }

  const [yearText, monthText, dayText] = text.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new HttpError(400, `${fieldName} geçersiz tarih`);
  }
  return text;
};

const dateFromKey = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
const dateKey = (value: Date): string => value.toISOString().slice(0, 10);

export const parseSpecialPaymentCategory = (value: unknown): SpecialPaymentCategory =>
  oneOf(value, "category", categories);

export const parseSpecialPaymentPeriodFilter = (query: unknown): SpecialPaymentPeriodFilter => {
  const values = asRecord(query, "query");
  const rawPeriod = scalarString(values.period, "period");
  const period: SpecialPaymentPeriod = rawPeriod
    ? oneOf(rawPeriod, "period", periods)
    : "month";
  const date = parseDateKey(values.date, "date", currentIstanbulDate());
  const anchor = dateFromKey(date);
  let start: Date;
  let end: Date;

  if (period === "day") {
    start = anchor;
    end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate() + 1));
  } else if (period === "month") {
    start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
  } else {
    start = new Date(Date.UTC(anchor.getUTCFullYear(), 0, 1));
    end = new Date(Date.UTC(anchor.getUTCFullYear() + 1, 0, 1));
  }

  return { period, date, start, end };
};

export const parseSpecialPaymentInput = (body: unknown): SpecialPaymentInput => {
  const values = asRecord(body);
  return {
    paymentDate: dateFromKey(parseDateKey(values.paymentDate, "paymentDate")),
    amount: parseMoney(values.amount, "amount"),
    note: optionalString(values.note, "note", 2000),
    personnelId:
      values.personnelId === undefined ? null : requiredString(values.personnelId, "personnelId"),
    loanAccountId:
      values.loanAccountId === undefined
        ? null
        : requiredString(values.loanAccountId, "loanAccountId"),
    invoiceTypeId:
      values.invoiceTypeId === undefined
        ? null
        : requiredString(values.invoiceTypeId, "invoiceTypeId"),
  };
};

type ExpenseCategoryRow = {
  id: string;
  name: string;
  categoryType: "GENERAL" | "SGK" | "CUSTOM";
};

const normalizeCategoryName = (value: string): string =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");

const expensePaymentCategory = (
  category: Pick<ExpenseCategoryRow, "name" | "categoryType">,
): "expense" | "sgk" | "meal" | null => {
  if (category.categoryType === "CUSTOM") return null;
  if (category.categoryType === "SGK") return "sgk";
  return normalizeCategoryName(category.name) === normalizeCategoryName(mealName)
    ? "meal"
    : "expense";
};

const categoryIdsByPayment = (rows: ExpenseCategoryRow[]) => {
  const result: Record<"expense" | "sgk" | "meal", string[]> = {
    expense: [],
    sgk: [],
    meal: [],
  };
  for (const row of rows) {
    const category = expensePaymentCategory(row);
    if (category) result[category].push(row.id);
  }
  return result;
};

const decimalOrZero = (value: Prisma.Decimal | null | undefined): Prisma.Decimal =>
  value ?? new Prisma.Decimal(0);

export const getSpecialPaymentSummary = async (
  filter: SpecialPaymentPeriodFilter,
): Promise<SpecialPaymentSummaryDto> => {
  const prisma = getPrisma();
  const dateWhere = { gte: filter.start, lt: filter.end };
  const [personnel, loan, invoice, expenseCategories] = await Promise.all([
    prisma.expensePersonnelPayment.aggregate({
      where: { paymentDate: dateWhere },
      _sum: { amount: true },
    }),
    prisma.loanPayment.aggregate({ where: { paymentDate: dateWhere }, _sum: { amount: true } }),
    prisma.invoicePayment.aggregate({ where: { paymentDate: dateWhere }, _sum: { amount: true } }),
    prisma.expenseCategory.findMany({
      select: { id: true, name: true, categoryType: true },
    }),
  ]);
  const ids = categoryIdsByPayment(expenseCategories);

  const sumExpense = async (categoryIds: string[]): Promise<Prisma.Decimal> => {
    if (categoryIds.length === 0) return new Prisma.Decimal(0);
    const result = await prisma.expenseRecord.aggregate({
      where: { categoryId: { in: categoryIds }, expenseDate: dateWhere },
      _sum: { amount: true },
    });
    return decimalOrZero(result._sum.amount);
  };

  const [expense, sgk, meal] = await Promise.all([
    sumExpense(ids.expense),
    sumExpense(ids.sgk),
    sumExpense(ids.meal),
  ]);

  return {
    period: filter.period,
    date: filter.date,
    totals: {
      personnel: moneyToString(decimalOrZero(personnel._sum.amount)),
      expense: moneyToString(expense),
      invoice: moneyToString(decimalOrZero(invoice._sum.amount)),
      loan: moneyToString(decimalOrZero(loan._sum.amount)),
      sgk: moneyToString(sgk),
      meal: moneyToString(meal),
    },
  };
};

export const getSpecialPaymentDailyTotals = async (
  filter: SpecialPaymentPeriodFilter,
): Promise<SpecialPaymentDailyTotalDto[]> => {
  const prisma = getPrisma();
  const dateWhere = { gte: filter.start, lt: filter.end };
  const expenseCategories = await prisma.expenseCategory.findMany({
    select: { id: true, name: true, categoryType: true },
  });
  const ids = categoryIdsByPayment(expenseCategories);
  const reportableExpenseCategoryIds = [...ids.expense, ...ids.sgk, ...ids.meal];

  const [personnel, loan, invoice, expense] = await Promise.all([
    prisma.expensePersonnelPayment.groupBy({
      by: ["paymentDate"],
      where: { paymentDate: dateWhere },
      _sum: { amount: true },
    }),
    prisma.loanPayment.groupBy({
      by: ["paymentDate"],
      where: { paymentDate: dateWhere },
      _sum: { amount: true },
    }),
    prisma.invoicePayment.groupBy({
      by: ["paymentDate"],
      where: { paymentDate: dateWhere },
      _sum: { amount: true },
    }),
    reportableExpenseCategoryIds.length
      ? prisma.expenseRecord.groupBy({
          by: ["expenseDate"],
          where: {
            expenseDate: dateWhere,
            categoryId: { in: reportableExpenseCategoryIds },
          },
          _sum: { amount: true },
        })
      : Promise.resolve([]),
  ]);

  const totals = new Map<string, Prisma.Decimal>();
  const add = (date: Date, amount: Prisma.Decimal | null | undefined) => {
    const key = dateKey(date);
    totals.set(key, (totals.get(key) ?? new Prisma.Decimal(0)).plus(decimalOrZero(amount)));
  };

  personnel.forEach((row) => add(row.paymentDate, row._sum.amount));
  loan.forEach((row) => add(row.paymentDate, row._sum.amount));
  invoice.forEach((row) => add(row.paymentDate, row._sum.amount));
  expense.forEach((row) => add(row.expenseDate, row._sum.amount));

  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, total]) => ({ date, total: moneyToString(total) }));
};

export const listSpecialPayments = async (
  category: SpecialPaymentCategory,
  filter: SpecialPaymentPeriodFilter,
): Promise<SpecialPaymentListDto> => {
  const prisma = getPrisma();
  const dateWhere = { gte: filter.start, lt: filter.end };
  let items: SpecialPaymentItemDto[];

  if (category === "personnel") {
    const rows = await prisma.expensePersonnelPayment.findMany({
      where: { paymentDate: dateWhere },
      include: { personnel: { select: { name: true } } },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });
    items = rows.map((row) => ({
      id: row.id,
      category,
      title: row.personnel.name,
      paymentDate: dateKey(row.paymentDate),
      amount: moneyToString(row.amount),
      note: row.note,
    }));
  } else if (category === "loan") {
    const rows = await prisma.loanPayment.findMany({
      where: { paymentDate: dateWhere },
      include: { loanAccount: { select: { name: true } } },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });
    items = rows.map((row) => ({
      id: row.id,
      category,
      title: row.loanAccount.name,
      paymentDate: dateKey(row.paymentDate),
      amount: moneyToString(row.amount),
      note: row.note,
    }));
  } else if (category === "invoice") {
    const rows = await prisma.invoicePayment.findMany({
      where: { paymentDate: dateWhere },
      include: { invoiceType: { select: { name: true } } },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });
    items = rows.map((row) => ({
      id: row.id,
      category,
      title: row.invoiceType.name,
      paymentDate: dateKey(row.paymentDate),
      amount: moneyToString(row.amount),
      note: row.note,
    }));
  } else {
    const expenseCategories = await prisma.expenseCategory.findMany({
      select: { id: true, name: true, categoryType: true },
    });
    const ids = categoryIdsByPayment(expenseCategories)[category];
    const rows = ids.length
      ? await prisma.expenseRecord.findMany({
          where: { categoryId: { in: ids }, expenseDate: dateWhere },
          include: { category: { select: { name: true } } },
          orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        })
      : [];
    items = rows.map((row) => ({
      id: row.id,
      category,
      title: row.category.name,
      paymentDate: dateKey(row.expenseDate),
      amount: moneyToString(row.amount),
      note: row.description,
    }));
  }

  return { period: filter.period, date: filter.date, category, items };
};

const requireReference = (value: string | null, fieldName: string): string => {
  if (!value) throw new HttpError(400, `${fieldName} zorunlu`);
  return value;
};

const ensureSystemCategory = async (
  tx: BusinessTransaction,
  category: "expense" | "sgk" | "meal",
) => {
  const expected = systemCategoryByPayment[category];
  const existing = await tx.expenseCategory.findFirst({
    where: { name: { equals: expected.name, mode: "insensitive" } },
  });

  if (existing) {
    if (existing.categoryType !== expected.categoryType || !existing.isActive) {
      throw new HttpError(409, `${expected.name} kategorisi pasif veya beklenen tipte değil`);
    }
    return existing;
  }

  try {
    return await tx.expenseCategory.create({
      data: {
        name: expected.name,
        categoryType: expected.categoryType,
        isSystem: true,
        isActive: true,
      },
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) {
      throw new HttpError(409, `${expected.name} kategorisiyle çakışan bir kayıt mevcut`);
    }
    throw error;
  }
};

export const createSpecialPayment = async (
  category: SpecialPaymentCategory,
  input: SpecialPaymentInput,
): Promise<SpecialPaymentItemDto> =>
  withSerializableTransaction(async (tx) => {
    if (category === "personnel") {
      const personnelId = requireReference(input.personnelId, "personnelId");
      const personnel = await tx.expensePersonnel.findUnique({ where: { id: personnelId } });
      if (!personnel) throw new HttpError(404, "Personel bulunamadı");
      if (!personnel.isActive) throw new HttpError(409, "Personel aktif değil");
      const row = await tx.expensePersonnelPayment.create({
        data: { personnelId, paymentDate: input.paymentDate, amount: input.amount, note: input.note },
      });
      return {
        id: row.id,
        category,
        title: personnel.name,
        paymentDate: dateKey(row.paymentDate),
        amount: moneyToString(row.amount),
        note: row.note,
      };
    }

    if (category === "loan") {
      const loanAccountId = requireReference(input.loanAccountId, "loanAccountId");
      const account = await tx.loanAccount.findUnique({ where: { id: loanAccountId } });
      if (!account) throw new HttpError(404, "Kredi hesabı bulunamadı");
      if (!account.isActive) throw new HttpError(409, "Kredi hesabı aktif değil");
      const row = await tx.loanPayment.create({
        data: { loanAccountId, paymentDate: input.paymentDate, amount: input.amount, note: input.note },
      });
      return {
        id: row.id,
        category,
        title: account.name,
        paymentDate: dateKey(row.paymentDate),
        amount: moneyToString(row.amount),
        note: row.note,
      };
    }

    if (category === "invoice") {
      const invoiceTypeId = requireReference(input.invoiceTypeId, "invoiceTypeId");
      const invoiceType = await tx.invoiceType.findUnique({ where: { id: invoiceTypeId } });
      if (!invoiceType) throw new HttpError(404, "Fatura türü bulunamadı");
      if (!invoiceType.isActive) throw new HttpError(409, "Fatura türü aktif değil");
      const row = await tx.invoicePayment.create({
        data: { invoiceTypeId, paymentDate: input.paymentDate, amount: input.amount, note: input.note },
      });
      return {
        id: row.id,
        category,
        title: invoiceType.name,
        paymentDate: dateKey(row.paymentDate),
        amount: moneyToString(row.amount),
        note: row.note,
      };
    }

    const expenseCategory = await ensureSystemCategory(tx, category);
    const row = await tx.expenseRecord.create({
      data: {
        categoryId: expenseCategory.id,
        expenseDate: input.paymentDate,
        amount: input.amount,
        description: input.note,
      },
    });
    return {
      id: row.id,
      category,
      title: expenseCategory.name,
      paymentDate: dateKey(row.expenseDate),
      amount: moneyToString(row.amount),
      note: row.description,
    };
  });

export const deleteSpecialPayment = async (
  category: SpecialPaymentCategory,
  paymentId: string,
): Promise<{ id: string }> => {
  const prisma = getPrisma();

  if (category === "personnel") {
    const result = await prisma.expensePersonnelPayment.deleteMany({ where: { id: paymentId } });
    if (result.count === 0) throw new HttpError(404, "Personel ödemesi bulunamadı");
  } else if (category === "loan") {
    const result = await prisma.loanPayment.deleteMany({ where: { id: paymentId } });
    if (result.count === 0) throw new HttpError(404, "Kredi ödemesi bulunamadı");
  } else if (category === "invoice") {
    const result = await prisma.invoicePayment.deleteMany({ where: { id: paymentId } });
    if (result.count === 0) throw new HttpError(404, "Fatura ödemesi bulunamadı");
  } else {
    const row = await prisma.expenseRecord.findUnique({
      where: { id: paymentId },
      include: { category: { select: { name: true, categoryType: true } } },
    });
    if (!row || expensePaymentCategory(row.category) !== category) {
      throw new HttpError(404, "Gider kaydı bulunamadı");
    }
    const result = await prisma.expenseRecord.deleteMany({ where: { id: paymentId } });
    if (result.count === 0) throw new HttpError(404, "Gider kaydı bulunamadı");
  }

  return { id: paymentId };
};

export const listActiveInvoiceTypes = async (): Promise<SpecialPaymentLookupDto[]> =>
  getPrisma().invoiceType.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
