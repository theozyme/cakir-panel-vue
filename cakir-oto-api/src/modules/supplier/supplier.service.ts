import { Prisma } from "../../../generated/prisma/client.js";

import { HttpError, isPrismaErrorCode } from "../../lib/http-error.js";
import { moneyToString, parseMoney } from "../../lib/money.js";
import { getPrisma } from "../../lib/prisma.js";
import { withSerializableTransaction } from "../../lib/transaction.js";
import { asRecord, oneOf, optionalString, requiredString } from "../../lib/validation.js";
import type {
  ManualSupplierTransactionInput,
  SupplierCurrency,
  SupplierDto,
  SupplierLookupDto,
  SupplierPaymentInput,
  SupplierPeriod,
  SupplierPeriodFilter,
  SupplierSummaryDto,
  SupplierTransactionDto,
  SupplierTransactionType,
  SupplierTrendItemDto,
  TrendCurrencyValues,
} from "./supplier.types.js";

const timeZone = "Europe/Istanbul";
const zero = () => new Prisma.Decimal(0);
const emptyTrendValues = (): TrendCurrencyValues => ({ debtIncrease: "0.00", payments: "0.00" });

export const createSupplier = async (body: unknown): Promise<SupplierLookupDto> => {
  const values = asRecord(body);
  const name = requiredString(values.name, "name", 150);
  const supplierCurrency = oneOf(values.currency, "currency", ["TRY", "USD"] as const);

  try {
    return await withSerializableTransaction(async (tx) => {
      const duplicate = await tx.supplier.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
        select: { id: true },
      });
      if (duplicate) throw new HttpError(409, "Supplier adi zaten mevcut");

      const supplier = await tx.supplier.create({
        data: { name, currency: supplierCurrency },
        select: { id: true, name: true, currency: true },
      });
      return { id: supplier.id, name: supplier.name, currency: asCurrency(supplier.currency) };
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) throw new HttpError(409, "Supplier adi zaten mevcut");
    throw error;
  }
};

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const zonedFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const datePartsInIstanbul = (date: Date): DateParts => {
  const parts = Object.fromEntries(
    zonedFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;

  return {
    year: parts.year ?? 0,
    month: parts.month ?? 0,
    day: parts.day ?? 0,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
  };
};

const zonedDateTimeToUtc = (target: DateParts): Date => {
  const desired = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    target.second,
  );
  let timestamp = desired;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = datePartsInIstanbul(new Date(timestamp));
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    const difference = desired - actualAsUtc;
    timestamp += difference;
    if (difference === 0) break;
  }

  return new Date(timestamp);
};

const scalarString = (value: unknown, fieldName: string): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new HttpError(400, `${fieldName} tek bir string olmali`);
  return value;
};

const integerQuery = (
  value: unknown,
  fieldName: string,
  minimum: number,
  maximum: number,
): number => {
  const text = scalarString(value, fieldName);
  if (!text || !/^\d+$/.test(text)) throw new HttpError(400, `${fieldName} gecersiz`);
  const parsed = Number(text);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new HttpError(400, `${fieldName} gecersiz`);
  }
  return parsed;
};

const validCalendarDate = (year: number, month: number, day: number): boolean => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
};

export const parseSupplierPeriodFilter = (query: unknown): SupplierPeriodFilter => {
  const values = asRecord(query, "query");
  const now = datePartsInIstanbul(new Date());
  const rawPeriod = scalarString(values.period, "period");
  const period: SupplierPeriod = rawPeriod ? (rawPeriod as SupplierPeriod) : "month";

  if (!(["day", "month", "year"] as const).includes(period)) {
    throw new HttpError(400, "period day, month veya year olmali");
  }

  const year = values.year === undefined ? now.year : integerQuery(values.year, "year", 1, 9999);
  const month =
    period === "year"
      ? undefined
      : values.month === undefined && !rawPeriod
        ? now.month
        : integerQuery(values.month, "month", 1, 12);
  const day = period === "day" ? integerQuery(values.day, "day", 1, 31) : undefined;

  if (period === "day" && !validCalendarDate(year, month as number, day as number)) {
    throw new HttpError(400, "year, month ve day gecerli bir tarih olmali");
  }

  const startParts: DateParts = {
    year,
    month: month ?? 1,
    day: day ?? 1,
    hour: 0,
    minute: 0,
    second: 0,
  };
  let endParts: DateParts;

  if (period === "day") {
    const next = new Date(Date.UTC(year, (month as number) - 1, (day as number) + 1));
    endParts = {
      year: next.getUTCFullYear(),
      month: next.getUTCMonth() + 1,
      day: next.getUTCDate(),
      hour: 0,
      minute: 0,
      second: 0,
    };
  } else if (period === "month") {
    const next = new Date(Date.UTC(year, month as number, 1));
    endParts = {
      year: next.getUTCFullYear(),
      month: next.getUTCMonth() + 1,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
    };
  } else {
    endParts = { year: year + 1, month: 1, day: 1, hour: 0, minute: 0, second: 0 };
  }

  return {
    period,
    year,
    ...(month ? { month } : {}),
    ...(day ? { day } : {}),
    start: zonedDateTimeToUtc(startParts),
    end: zonedDateTimeToUtc(endParts),
  };
};

const asCurrency = (value: string): SupplierCurrency => {
  if (value !== "TRY" && value !== "USD")
    throw new HttpError(500, "Supplier currency desteklenmiyor");
  return value;
};

const latestActiveBalances = async () =>
  getPrisma().supplierTransaction.findMany({
    where: { supplier: { isActive: true }, balanceAfter: { not: null } },
    distinct: ["supplierId"],
    orderBy: [
      { supplierId: "asc" },
      { transactionAt: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ],
    select: { supplierId: true, balanceAfter: true },
  });

export const listActiveSuppliers = async (filter: SupplierPeriodFilter): Promise<SupplierDto[]> => {
  const prisma = getPrisma();
  const [suppliers, balances, periodTotals] = await Promise.all([
    prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, currency: true },
    }),
    latestActiveBalances(),
    prisma.supplierTransaction.groupBy({
      by: ["supplierId", "type"],
      where: {
        supplier: { isActive: true },
        transactionAt: { gte: filter.start, lt: filter.end },
        type: { in: ["DEBT_INCREASE", "PAYMENT"] },
      },
      _sum: { amount: true },
    }),
  ]);
  const balanceBySupplier = new Map(
    balances.map((row) => [row.supplierId, row.balanceAfter ?? zero()]),
  );
  const totalsBySupplier = new Map<string, { debt: Prisma.Decimal; payments: Prisma.Decimal }>();

  for (const row of periodTotals) {
    const totals = totalsBySupplier.get(row.supplierId) ?? { debt: zero(), payments: zero() };
    const amount = row._sum.amount ?? zero();
    if (row.type === "DEBT_INCREASE") totals.debt = amount;
    if (row.type === "PAYMENT") totals.payments = amount;
    totalsBySupplier.set(row.supplierId, totals);
  }

  return suppliers.map((supplier) => {
    const totals = totalsBySupplier.get(supplier.id) ?? { debt: zero(), payments: zero() };
    return {
      id: supplier.id,
      name: supplier.name,
      currency: asCurrency(supplier.currency),
      currentBalance: moneyToString(balanceBySupplier.get(supplier.id) ?? zero()),
      periodDebtIncrease: moneyToString(totals.debt),
      periodPayments: moneyToString(totals.payments),
    };
  });
};

export const getSupplierSummary = async (
  filter: SupplierPeriodFilter,
): Promise<SupplierSummaryDto> => {
  const prisma = getPrisma();
  const [suppliers, balances, periodTotals] = await Promise.all([
    prisma.supplier.findMany({
      where: { isActive: true },
      select: { id: true, currency: true },
    }),
    latestActiveBalances(),
    prisma.supplierTransaction.groupBy({
      by: ["currency", "type"],
      where: {
        supplier: { isActive: true },
        transactionAt: { gte: filter.start, lt: filter.end },
        type: { in: ["DEBT_INCREASE", "PAYMENT"] },
      },
      _sum: { amount: true },
    }),
  ]);
  const totals: Record<
    SupplierCurrency,
    { debtIncrease: Prisma.Decimal; payments: Prisma.Decimal; remainingDebt: Prisma.Decimal }
  > = {
    TRY: { debtIncrease: zero(), payments: zero(), remainingDebt: zero() },
    USD: { debtIncrease: zero(), payments: zero(), remainingDebt: zero() },
  };
  const currencyBySupplier = new Map(
    suppliers.map((supplier) => [supplier.id, asCurrency(supplier.currency)]),
  );

  for (const row of periodTotals) {
    const currency = asCurrency(row.currency);
    const amount = row._sum.amount ?? zero();
    if (row.type === "DEBT_INCREASE") totals[currency].debtIncrease = amount;
    if (row.type === "PAYMENT") totals[currency].payments = amount;
  }

  for (const balance of balances) {
    const currency = currencyBySupplier.get(balance.supplierId);
    if (currency)
      totals[currency].remainingDebt = totals[currency].remainingDebt.plus(
        balance.balanceAfter ?? zero(),
      );
  }

  return {
    TRY: {
      debtIncrease: moneyToString(totals.TRY.debtIncrease),
      payments: moneyToString(totals.TRY.payments),
      remainingDebt: moneyToString(totals.TRY.remainingDebt),
    },
    USD: {
      debtIncrease: moneyToString(totals.USD.debtIncrease),
      payments: moneyToString(totals.USD.payments),
      remainingDebt: moneyToString(totals.USD.remainingDebt),
    },
  };
};

export const listSupplierTransactions = async (
  supplierId: string,
  filter: SupplierPeriodFilter,
): Promise<SupplierTransactionDto[]> => {
  const prisma = getPrisma();
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { id: true },
  });
  if (!supplier) throw new HttpError(404, "Supplier bulunamadi");

  const rows = await prisma.supplierTransaction.findMany({
    where: { supplierId, transactionAt: { gte: filter.start, lt: filter.end } },
    orderBy: [{ transactionAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    transactionAt: row.transactionAt.toISOString(),
    type: row.type as SupplierTransactionType,
    amount: moneyToString(row.amount),
    currency: asCurrency(row.currency),
    balanceAfter: row.balanceAfter ? moneyToString(row.balanceAfter) : null,
    note: row.note,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
  }));
};

const trendBucketKey = (filter: SupplierPeriodFilter, date: Date): string => {
  const parts = datePartsInIstanbul(date);
  if (filter.period === "day") return String(parts.hour);
  if (filter.period === "month") return String(parts.day);
  return String(parts.month);
};

const buildTrendBuckets = (
  filter: SupplierPeriodFilter,
): Array<SupplierTrendItemDto & { key: string }> => {
  const count =
    filter.period === "day"
      ? 24
      : filter.period === "month"
        ? new Date(Date.UTC(filter.year, filter.month as number, 0)).getUTCDate()
        : 12;
  const monthLabels = [
    "Oca",
    "Şub",
    "Mar",
    "Nis",
    "May",
    "Haz",
    "Tem",
    "Ağu",
    "Eyl",
    "Eki",
    "Kas",
    "Ara",
  ];

  return Array.from({ length: count }, (_, index) => {
    const value = index + 1;
    const localParts: DateParts = {
      year: filter.year,
      month: filter.period === "year" ? value : (filter.month as number),
      day: filter.period === "month" ? value : (filter.day ?? 1),
      hour: filter.period === "day" ? index : 0,
      minute: 0,
      second: 0,
    };
    return {
      key: String(filter.period === "day" ? index : value),
      bucketStart: zonedDateTimeToUtc(localParts).toISOString(),
      label:
        filter.period === "day"
          ? `${String(index).padStart(2, "0")}:00`
          : filter.period === "month"
            ? String(value)
            : (monthLabels[index] ?? String(value)),
      TRY: emptyTrendValues(),
      USD: emptyTrendValues(),
    };
  });
};

export const getSupplierTrend = async (
  filter: SupplierPeriodFilter,
): Promise<SupplierTrendItemDto[]> => {
  const rows = await getPrisma().supplierTransaction.findMany({
    where: {
      supplier: { isActive: true },
      transactionAt: { gte: filter.start, lt: filter.end },
      type: { in: ["DEBT_INCREASE", "PAYMENT"] },
    },
    select: { transactionAt: true, type: true, amount: true, currency: true },
  });
  const buckets = buildTrendBuckets(filter);
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  const decimalTotals = new Map<string, { debt: Prisma.Decimal; payments: Prisma.Decimal }>();

  for (const row of rows) {
    const currency = asCurrency(row.currency);
    const key = `${trendBucketKey(filter, row.transactionAt)}:${currency}`;
    const totals = decimalTotals.get(key) ?? { debt: zero(), payments: zero() };
    if (row.type === "DEBT_INCREASE") totals.debt = totals.debt.plus(row.amount);
    if (row.type === "PAYMENT") totals.payments = totals.payments.plus(row.amount);
    decimalTotals.set(key, totals);
  }

  for (const bucket of buckets) {
    for (const currency of ["TRY", "USD"] as const) {
      const totals = decimalTotals.get(`${bucket.key}:${currency}`) ?? {
        debt: zero(),
        payments: zero(),
      };
      bucket[currency] = {
        debtIncrease: moneyToString(totals.debt),
        payments: moneyToString(totals.payments),
      };
    }
  }

  return buckets.map(({ key: _key, ...bucket }) => bucket);
};

export const parseManualSupplierTransaction = (body: unknown): ManualSupplierTransactionInput => {
  const values = asRecord(body);
  const amount = parseMoney(values.amount, "amount");
  const note = optionalString(values.note, "note", 2000);
  const rawTransactionAt = values.transactionAt;
  let transactionAt: Date | null = null;

  if (rawTransactionAt !== undefined && rawTransactionAt !== null && rawTransactionAt !== "") {
    if (
      typeof rawTransactionAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
        rawTransactionAt,
      )
    ) {
      throw new HttpError(400, "transactionAt timezone iceren ISO tarih olmali");
    }
    transactionAt = new Date(rawTransactionAt);
    if (Number.isNaN(transactionAt.getTime())) throw new HttpError(400, "transactionAt gecersiz");
    if (transactionAt.getTime() > Date.now() + 1000)
      throw new HttpError(400, "transactionAt gelecekte olamaz");
  }

  return { amount, note, transactionAt };
};

const lockSupplier = async (tx: SupplierPaymentInput["tx"], supplierId: string) => {
  const locked = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "suppliers" WHERE "id" = ${supplierId} FOR UPDATE`,
  );
  if (locked.length !== 1) throw new HttpError(404, "Supplier bulunamadi");

  const supplier = await tx.supplier.findUnique({
    where: { id: supplierId },
    select: { id: true, currency: true, isActive: true },
  });
  if (!supplier?.isActive) throw new HttpError(409, "Supplier aktif degil");
  return supplier;
};

const latestLedgerTransaction = async (tx: SupplierPaymentInput["tx"], supplierId: string) => {
  const latest = await tx.supplierTransaction.findFirst({
    where: { supplierId },
    orderBy: [{ transactionAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    select: { transactionAt: true, balanceAfter: true },
  });
  if (latest && latest.balanceAfter === null) {
    throw new HttpError(409, "Supplier son hareketinin balanceAfter degeri eksik");
  }
  return latest;
};

export const createManualSupplierTransaction = async (
  supplierId: string,
  type: "PAYMENT" | "DEBT_INCREASE",
  input: ManualSupplierTransactionInput,
): Promise<SupplierTransactionDto> =>
  withSerializableTransaction(async (tx) => {
    const supplier = await lockSupplier(tx, supplierId);
    const latest = await latestLedgerTransaction(tx, supplierId);
    const transactionAt = input.transactionAt ?? new Date();
    if (latest && transactionAt.getTime() < latest.transactionAt.getTime()) {
      throw new HttpError(409, "Islem tarihi supplier son hareketinden eski olamaz");
    }

    const previousBalance = latest?.balanceAfter ?? zero();
    const balanceAfter =
      type === "PAYMENT" ? previousBalance.minus(input.amount) : previousBalance.plus(input.amount);
    const row = await tx.supplierTransaction.create({
      data: {
        supplierId,
        type,
        amount: input.amount,
        currency: supplier.currency,
        balanceAfter,
        note: input.note,
        transactionAt,
        sourceType: "MANUAL",
        sourceId: null,
      },
    });

    return {
      id: row.id,
      transactionAt: row.transactionAt.toISOString(),
      type: row.type,
      amount: moneyToString(row.amount),
      currency: asCurrency(row.currency),
      balanceAfter: row.balanceAfter ? moneyToString(row.balanceAfter) : null,
      note: row.note,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
    };
  });

export const createVehicleOperationSupplierPayment = async ({
  tx,
  supplierId,
  operationId,
  amount,
  currency,
  transactionAt,
}: SupplierPaymentInput) => {
  const supplier = await lockSupplier(tx, supplierId);
  if (supplier.currency !== currency) {
    throw new HttpError(400, "Operation currency supplier currency ile ayni olmali");
  }

  const latest = await latestLedgerTransaction(tx, supplierId);
  const previousBalance = latest?.balanceAfter ?? zero();
  const balanceAfter = previousBalance.minus(amount);
  const ledgerTransactionAt =
    latest && transactionAt.getTime() < latest.transactionAt.getTime()
      ? latest.transactionAt
      : transactionAt;

  try {
    return await tx.supplierTransaction.create({
      data: {
        supplierId,
        type: "PAYMENT",
        amount,
        currency,
        balanceAfter,
        transactionAt: ledgerTransactionAt,
        sourceType: "VEHICLE_OPERATION",
        sourceId: operationId,
      },
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) {
      throw new HttpError(409, "Bu operation icin supplier payment zaten mevcut");
    }
    throw error;
  }
};
