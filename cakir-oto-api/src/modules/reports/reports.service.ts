import { Prisma } from "../../../generated/prisma/client.js";

import { HttpError } from "../../lib/http-error.js";
import { moneyToString } from "../../lib/money.js";
import { getPrisma } from "../../lib/prisma.js";
import { asRecord, oneOf } from "../../lib/validation.js";
import {
  getSpecialPaymentDailyTotals,
  getSpecialPaymentSummary,
  parseSpecialPaymentPeriodFilter,
} from "../special-payment/special-payment.service.js";
import type { SpecialPaymentTotals } from "../special-payment/special-payment.types.js";
import type {
  CurrencyTotals,
  DashboardFinanceDto,
  DashboardPaymentPeriod,
  ExpenseBreakdownItemDto,
  ReportCurrency,
  ReportDistributionItemDto,
  ReportPeriod,
  ReportPeriodFilter,
  ReportsOverviewDto,
  ReportTrendItemDto,
} from "./reports.types.js";

const timeZone = "Europe/Istanbul" as const;
const periods = ["day", "month", "year"] as const;
const dashboardPaymentPeriods = ["today", "month", "30d", "90d", "1y"] as const;
const currencies = ["TRY", "USD"] as const;

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

type DecimalTotals = Record<ReportCurrency, Prisma.Decimal>;
type TrendAggregateRow = { bucket: string; currency: string; amount: Prisma.Decimal };
type DailyEarningAggregateRow = TrendAggregateRow;

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
  if (typeof value !== "string") throw new HttpError(400, `${fieldName} tek bir string olmalı`);
  return value;
};

const currentIstanbulDate = (): string => {
  const parts = datePartsInIstanbul(new Date());
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
};

const parseDateKey = (value: unknown): string => {
  const text = scalarString(value, "date") ?? currentIstanbulDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new HttpError(400, "date YYYY-MM-DD formatında olmalı");
  }

  const [yearText, monthText, dayText] = text.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new HttpError(400, "date geçersiz");
  }
  return text;
};

export const parseReportPeriodFilter = (query: unknown): ReportPeriodFilter => {
  const values = asRecord(query, "query");
  const rawPeriod = scalarString(values.period, "period");
  const period: ReportPeriod = rawPeriod ? oneOf(rawPeriod, "period", periods) : "month";
  const date = parseDateKey(values.date);
  const [yearText, monthText, dayText] = date.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  const startParts: DateParts = {
    year,
    month: period === "year" ? 1 : month,
    day: period === "day" ? day : 1,
    hour: 0,
    minute: 0,
    second: 0,
  };
  let endParts: DateParts;

  if (period === "day") {
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    endParts = {
      year: next.getUTCFullYear(),
      month: next.getUTCMonth() + 1,
      day: next.getUTCDate(),
      hour: 0,
      minute: 0,
      second: 0,
    };
  } else if (period === "month") {
    const next = new Date(Date.UTC(year, month, 1));
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
    date,
    year,
    month,
    day,
    start: zonedDateTimeToUtc(startParts),
    end: zonedDateTimeToUtc(endParts),
  };
};

type DashboardFinanceFilter = {
  date: string;
  dailyStart: Date;
  dailyEnd: Date;
  paymentPeriod: DashboardPaymentPeriod;
  paymentStart: Date;
  paymentEnd: Date;
};

const dateKeyWithOffset = (date: string, dayOffset: number): string => {
  const [yearText, monthText, dayText] = date.split("-");
  const shifted = new Date(
    Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText) + dayOffset),
  );

  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(
    shifted.getUTCDate(),
  ).padStart(2, "0")}`;
};

export const parseDashboardFinanceFilter = (query: unknown): DashboardFinanceFilter => {
  const values = asRecord(query, "query");
  const date = parseDateKey(values.date);
  const rawPaymentPeriod = scalarString(values.paymentPeriod, "paymentPeriod");
  const paymentPeriod: DashboardPaymentPeriod = rawPaymentPeriod
    ? oneOf(rawPaymentPeriod, "paymentPeriod", dashboardPaymentPeriods)
    : "month";
  const dayFilter = parseReportPeriodFilter({ period: "day", date });
  const monthFilter = parseReportPeriodFilter({ period: "month", date });
  const firstDayFilter = parseReportPeriodFilter({
    period: "day",
    date: dateKeyWithOffset(date, -6),
  });
  const rollingDayOffsets: Partial<Record<DashboardPaymentPeriod, number>> = {
    today: 0,
    "30d": -29,
    "90d": -89,
    "1y": -364,
  };
  const paymentStart =
    paymentPeriod === "month"
      ? monthFilter.start
      : parseReportPeriodFilter({
          period: "day",
          date: dateKeyWithOffset(date, rollingDayOffsets[paymentPeriod] ?? 0),
        }).start;

  return {
    date,
    dailyStart: firstDayFilter.start,
    dailyEnd: dayFilter.end,
    paymentPeriod,
    paymentStart,
    paymentEnd: paymentPeriod === "month" ? monthFilter.end : dayFilter.end,
  };
};

const zeroTotals = (): DecimalTotals => ({
  TRY: new Prisma.Decimal(0),
  USD: new Prisma.Decimal(0),
});

const decimalValue = (value: Prisma.Decimal | string | number | null | undefined): Prisma.Decimal =>
  new Prisma.Decimal(value?.toString() ?? "0");

const asCurrency = (value: string): ReportCurrency => {
  if (!currencies.includes(value as ReportCurrency)) {
    throw new HttpError(500, `Desteklenmeyen para birimi: ${value}`);
  }
  return value as ReportCurrency;
};

const serializeTotals = (totals: DecimalTotals): CurrencyTotals => ({
  TRY: moneyToString(totals.TRY),
  USD: moneyToString(totals.USD),
});

const percentage = (amount: Prisma.Decimal, total: Prisma.Decimal): string =>
  total.isZero() ? "0.00" : amount.div(total).mul(100).toFixed(2);

const utcTimestampText = (date: Date): string => date.toISOString().replace("T", " ").slice(0, 23);

const getTrendAggregateRows = async (
  filter: ReportPeriodFilter,
): Promise<{ revenue: TrendAggregateRow[]; mailOrder: TrendAggregateRow[] }> => {
  const prisma = getPrisma();
  const start = utcTimestampText(filter.start);
  const end = utcTimestampText(filter.end);
  const operationLocalTime = Prisma.sql`(("operation_at" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Istanbul')`;
  const transactionLocalTime = Prisma.sql`(("transaction_at" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Istanbul')`;
  const operationBucket =
    filter.period === "year"
      ? Prisma.sql`TO_CHAR(DATE_TRUNC('month', ${operationLocalTime}), 'YYYY-MM')`
      : Prisma.sql`TO_CHAR(DATE_TRUNC('day', ${operationLocalTime}), 'YYYY-MM-DD')`;
  const transactionBucket =
    filter.period === "year"
      ? Prisma.sql`TO_CHAR(DATE_TRUNC('month', ${transactionLocalTime}), 'YYYY-MM')`
      : Prisma.sql`TO_CHAR(DATE_TRUNC('day', ${transactionLocalTime}), 'YYYY-MM-DD')`;

  const [revenue, mailOrder] = await Promise.all([
    prisma.$queryRaw<TrendAggregateRow[]>(Prisma.sql`
      SELECT ${operationBucket} AS "bucket", "currency", SUM("price") AS "amount"
      FROM "vehicle_operations"
      WHERE "operation_at" >= CAST(${start} AS timestamp)
        AND "operation_at" < CAST(${end} AS timestamp)
        AND "deleted_at" IS NULL
      GROUP BY 1, 2
      ORDER BY 1, 2
    `),
    prisma.$queryRaw<TrendAggregateRow[]>(Prisma.sql`
      SELECT ${transactionBucket} AS "bucket", "currency", SUM("amount") AS "amount"
      FROM "supplier_transactions"
      WHERE "transaction_at" >= CAST(${start} AS timestamp)
        AND "transaction_at" < CAST(${end} AS timestamp)
        AND "type" = 'PAYMENT'
        AND "voided_at" IS NULL
      GROUP BY 1, 2
      ORDER BY 1, 2
    `),
  ]);

  return { revenue, mailOrder };
};

type TrendBucket = { key: string; bucketStart: string; label: string };

const buildTrendBuckets = (filter: ReportPeriodFilter): TrendBucket[] => {
  if (filter.period === "day") {
    return [{ key: filter.date, bucketStart: filter.start.toISOString(), label: "Gün Toplamı" }];
  }

  if (filter.period === "month") {
    const dayCount = new Date(Date.UTC(filter.year, filter.month, 0)).getUTCDate();
    return Array.from({ length: dayCount }, (_, index) => {
      const day = index + 1;
      const key = `${filter.year}-${String(filter.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return {
        key,
        bucketStart: zonedDateTimeToUtc({
          year: filter.year,
          month: filter.month,
          day,
          hour: 0,
          minute: 0,
          second: 0,
        }).toISOString(),
        label: String(day),
      };
    });
  }

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
  return monthLabels.map((label, index) => {
    const month = index + 1;
    return {
      key: `${filter.year}-${String(month).padStart(2, "0")}`,
      bucketStart: zonedDateTimeToUtc({
        year: filter.year,
        month,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
      }).toISOString(),
      label,
    };
  });
};

const addTrendAmount = (
  target: Map<string, DecimalTotals>,
  bucket: string,
  currency: ReportCurrency,
  amount: Prisma.Decimal | string | number,
) => {
  const totals = target.get(bucket) ?? zeroTotals();
  totals[currency] = totals[currency].plus(decimalValue(amount));
  target.set(bucket, totals);
};

const buildTrend = (
  filter: ReportPeriodFilter,
  revenueRows: TrendAggregateRow[],
  mailOrderRows: TrendAggregateRow[],
  specialPaymentRows: Array<{ date: string; total: string }>,
): ReportTrendItemDto[] => {
  const revenueByBucket = new Map<string, DecimalTotals>();
  const mailOrderByBucket = new Map<string, DecimalTotals>();
  const specialPaymentsByBucket = new Map<string, DecimalTotals>();

  revenueRows.forEach((row) =>
    addTrendAmount(revenueByBucket, row.bucket, asCurrency(row.currency), row.amount),
  );
  mailOrderRows.forEach((row) =>
    addTrendAmount(mailOrderByBucket, row.bucket, asCurrency(row.currency), row.amount),
  );
  specialPaymentRows.forEach((row) => {
    const bucket = filter.period === "year" ? row.date.slice(0, 7) : row.date;
    addTrendAmount(specialPaymentsByBucket, bucket, "TRY", row.total);
  });

  return buildTrendBuckets(filter).map((bucket) => {
    const revenue = revenueByBucket.get(bucket.key) ?? zeroTotals();
    const mailOrder = mailOrderByBucket.get(bucket.key) ?? zeroTotals();
    const specialPayments = specialPaymentsByBucket.get(bucket.key) ?? zeroTotals();
    const expenses: DecimalTotals = {
      TRY: mailOrder.TRY.plus(specialPayments.TRY),
      USD: mailOrder.USD.plus(specialPayments.USD),
    };
    const net: DecimalTotals = {
      TRY: revenue.TRY.minus(expenses.TRY),
      USD: revenue.USD.minus(expenses.USD),
    };
    return {
      bucketStart: bucket.bucketStart,
      label: bucket.label,
      revenue: serializeTotals(revenue),
      expenses: serializeTotals(expenses),
      net: serializeTotals(net),
    };
  });
};

type DistributionDefinition = { key: string; label: string };
type DistributionAccumulator = DistributionDefinition & { count: number; amounts: DecimalTotals };

const paymentMethodDefinitions: DistributionDefinition[] = [
  { key: "CASH", label: "Nakit" },
  { key: "CREDIT_CARD", label: "Kredi Kartı" },
  { key: "BANK_TRANSFER", label: "Banka Havalesi" },
  { key: "MAIL_ORDER", label: "Mail Order" },
];

const baseOperationTypeDefinitions: DistributionDefinition[] = [
  { key: "MULTIMEDIA", label: "Multimedya" },
  { key: "SOUND_SYSTEM", label: "Ses Sistemi" },
  { key: "HIDDEN_FEATURE_ACTIVATION", label: "Gizli Özellik Aktivasyon" },
  { key: "REAR_VIEW_CAMERA", label: "Geri Görüş Kamerası" },
  { key: "ANDROID_BOX", label: "Android Box" },
  { key: "DASH_CAMERA", label: "Kayıt Kamerası" },
  { key: "BULB", label: "Ampul" },
  { key: "LED_XENON", label: "LED Xenon" },
  { key: "BATTERY", label: "Akü" },
  { key: "WIPER", label: "Silecek" },
  { key: "LABOR", label: "İşçilik" },
  { key: "CAR_STEREO", label: "Teyp" },
  { key: "STEERING_WHEEL_COVER", label: "Direksiyon Kılıfı" },
  { key: "WINDOW_FILM", label: "Cam Filmi" },
  { key: "PPF_COATING", label: "PPF Kaplama" },
  { key: "POWER_TAILGATE", label: "Elektrikli Bagaj" },
  { key: "SERVICE", label: "Servis" },
  { key: "ACCESSORY", label: "Aksesuar" },
  { key: "OTHER", label: "Diğer" },
  { key: "LEGACY_UNKNOWN", label: "Diğer / Eski Kayıt" },
];

const normalizeHistoricalDescription = (value: string): string =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");

const knownHistoricalDescriptions = new Map<string, DistributionDefinition>([
  ["multimedya", { key: "MULTIMEDIA", label: "Multimedya" }],
  ["ses sistemi", { key: "SOUND_SYSTEM", label: "Ses Sistemi" }],
  [
    "gizli özellik aktivasyon",
    { key: "HIDDEN_FEATURE_ACTIVATION", label: "Gizli Özellik Aktivasyon" },
  ],
  ["geri görüş kamerası", { key: "REAR_VIEW_CAMERA", label: "Geri Görüş Kamerası" }],
  ["android box", { key: "ANDROID_BOX", label: "Android Box" }],
  ["kayıt kamerası", { key: "DASH_CAMERA", label: "Kayıt Kamerası" }],
  ["ampul", { key: "BULB", label: "Ampul" }],
  ["led xenon", { key: "LED_XENON", label: "LED Xenon" }],
  ["akü", { key: "BATTERY", label: "Akü" }],
  ["silecek", { key: "WIPER", label: "Silecek" }],
  ["işçilik", { key: "LABOR", label: "İşçilik" }],
  ["teyp", { key: "CAR_STEREO", label: "Teyp" }],
  ["direksiyon kılıfı", { key: "STEERING_WHEEL_COVER", label: "Direksiyon Kılıfı" }],
  ["aksesuar", { key: "ACCESSORY", label: "Aksesuar" }],
  ["cam filmi", { key: "WINDOW_FILM", label: "Cam Filmi" }],
  ["ppf kaplama", { key: "PPF_COATING", label: "PPF Kaplama" }],
  ["elektrikli bagaj", { key: "POWER_TAILGATE", label: "Elektrikli Bagaj" }],
  ["servis", { key: "SERVICE", label: "Servis" }],
  ["diğer", { key: "OTHER", label: "Diğer" }],
]);

const readableHistoricalLabel = (normalized: string): string =>
  normalized
    .split(" ")
    .map((word) => {
      const [first, ...rest] = Array.from(word);
      return first ? `${first.toLocaleUpperCase("tr-TR")}${rest.join("")}` : word;
    })
    .join(" ");

const historicalOperationDefinition = (description: string): DistributionDefinition => {
  const normalized = normalizeHistoricalDescription(description);
  if (!normalized) return { key: "LEGACY_UNKNOWN", label: "Diğer / Eski Kayıt" };
  return (
    knownHistoricalDescriptions.get(normalized) ?? {
      key: `LEGACY_DESCRIPTION:${normalized}`,
      label: readableHistoricalLabel(normalized),
    }
  );
};

const operationTypeDefinitions = (
  rows: Array<{ operationType: string | null; description: string }>,
): DistributionDefinition[] => {
  const existingKeys = new Set(baseOperationTypeDefinitions.map((item) => item.key));
  const historicalDefinitions = new Map<string, DistributionDefinition>();

  for (const row of rows) {
    if (row.operationType) continue;
    const definition = historicalOperationDefinition(row.description);
    if (!existingKeys.has(definition.key)) historicalDefinitions.set(definition.key, definition);
  }

  return [
    ...baseOperationTypeDefinitions,
    ...[...historicalDefinitions.values()].sort((left, right) =>
      left.label.localeCompare(right.label, "tr-TR"),
    ),
  ];
};

const serializeDistribution = (
  items: DistributionAccumulator[],
  revenue: DecimalTotals,
): ReportDistributionItemDto[] =>
  items.map((item) => ({
    key: item.key,
    label: item.label,
    count: item.count,
    amounts: serializeTotals(item.amounts),
    percentages: {
      TRY: percentage(item.amounts.TRY, revenue.TRY),
      USD: percentage(item.amounts.USD, revenue.USD),
    },
  }));

const buildDistribution = <
  T extends { currency: string; _sum: { price: Prisma.Decimal | null }; _count: { _all: number } },
>(
  rows: T[],
  definitions: DistributionDefinition[],
  keyFromRow: (row: T) => string,
  revenue: DecimalTotals,
): ReportDistributionItemDto[] => {
  const items = definitions.map<DistributionAccumulator>((definition) => ({
    ...definition,
    count: 0,
    amounts: zeroTotals(),
  }));
  const byKey = new Map(items.map((item) => [item.key, item]));

  for (const row of rows) {
    const key = keyFromRow(row);
    const item = byKey.get(key);
    if (!item) continue;
    const currency = asCurrency(row.currency);
    item.count += row._count._all;
    item.amounts[currency] = item.amounts[currency].plus(decimalValue(row._sum.price));
  }

  return serializeDistribution(items, revenue);
};

const dashboardWeekdayFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone,
  weekday: "short",
});

export const getDashboardFinance = async (
  filter: DashboardFinanceFilter,
): Promise<DashboardFinanceDto> => {
  const prisma = getPrisma();
  const dailyStart = utcTimestampText(filter.dailyStart);
  const dailyEnd = utcTimestampText(filter.dailyEnd);
  const operationLocalTime = Prisma.sql`(("operation_at" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Istanbul')`;
  const operationBucket = Prisma.sql`TO_CHAR(DATE_TRUNC('day', ${operationLocalTime}), 'YYYY-MM-DD')`;

  const [dailyRows, paymentMethodRows] = await Promise.all([
    prisma.$queryRaw<DailyEarningAggregateRow[]>(Prisma.sql`
      SELECT ${operationBucket} AS "bucket", "currency", SUM("price") AS "amount"
      FROM "vehicle_operations"
      WHERE "operation_at" >= CAST(${dailyStart} AS timestamp)
        AND "operation_at" < CAST(${dailyEnd} AS timestamp)
        AND "deleted_at" IS NULL
      GROUP BY 1, 2
      ORDER BY 1, 2
    `),
    prisma.vehicleOperation.groupBy({
      by: ["paymentMethod", "currency"],
      where: { operationAt: { gte: filter.paymentStart, lt: filter.paymentEnd }, deletedAt: null },
      _sum: { price: true },
      _count: { _all: true },
    }),
  ]);

  const dailyAmounts = new Map<string, DecimalTotals>();
  dailyRows.forEach((row) =>
    addTrendAmount(dailyAmounts, row.bucket, asCurrency(row.currency), row.amount),
  );

  const monthlyRevenue = zeroTotals();
  paymentMethodRows.forEach((row) => {
    const currency = asCurrency(row.currency);
    monthlyRevenue[currency] = monthlyRevenue[currency].plus(decimalValue(row._sum.price));
  });

  const dailyEarnings = Array.from({ length: 7 }, (_, index) => {
    const date = dateKeyWithOffset(filter.date, index - 6);
    const dayFilter = parseReportPeriodFilter({ period: "day", date });

    return {
      date,
      label: dashboardWeekdayFormatter.format(dayFilter.start).replace(".", ""),
      amounts: serializeTotals(dailyAmounts.get(date) ?? zeroTotals()),
    };
  });

  return {
    date: filter.date,
    timeZone,
    paymentPeriod: filter.paymentPeriod,
    dailyEarnings,
    paymentMethods: buildDistribution(
      paymentMethodRows,
      paymentMethodDefinitions,
      (row) => row.paymentMethod,
      monthlyRevenue,
    ),
  };
};

const specialPaymentTotals = (totals: SpecialPaymentTotals): DecimalTotals => ({
  TRY: Object.values(totals).reduce(
    (sum, amount) => sum.plus(decimalValue(amount)),
    new Prisma.Decimal(0),
  ),
  USD: new Prisma.Decimal(0),
});

export const getReportsOverview = async (
  filter: ReportPeriodFilter,
): Promise<ReportsOverviewDto> => {
  const prisma = getPrisma();
  const operationWhere = { operationAt: { gte: filter.start, lt: filter.end }, deletedAt: null };
  const supplierWhere = {
    transactionAt: { gte: filter.start, lt: filter.end },
    type: "PAYMENT" as const,
    voidedAt: null,
  };
  const specialPaymentFilter = parseSpecialPaymentPeriodFilter({
    period: filter.period,
    date: filter.date,
  });

  const [
    revenueRows,
    mailOrderRows,
    operationCount,
    vehicleGroups,
    operationTypeRows,
    paymentMethodRows,
    specialSummary,
    specialDailyTotals,
    trendRows,
  ] = await Promise.all([
    prisma.vehicleOperation.groupBy({
      by: ["currency"],
      where: operationWhere,
      _sum: { price: true },
    }),
    prisma.supplierTransaction.groupBy({
      by: ["currency"],
      where: supplierWhere,
      _sum: { amount: true },
    }),
    prisma.vehicleOperation.count({ where: operationWhere }),
    prisma.vehicleOperation.groupBy({ by: ["visitId"], where: operationWhere }),
    prisma.vehicleOperation.groupBy({
      by: ["operationType", "description", "currency"],
      where: operationWhere,
      _sum: { price: true },
      _count: { _all: true },
    }),
    prisma.vehicleOperation.groupBy({
      by: ["paymentMethod", "currency"],
      where: operationWhere,
      _sum: { price: true },
      _count: { _all: true },
    }),
    getSpecialPaymentSummary(specialPaymentFilter),
    getSpecialPaymentDailyTotals(specialPaymentFilter),
    getTrendAggregateRows(filter),
  ]);

  const revenue = zeroTotals();
  revenueRows.forEach((row) => {
    const currency = asCurrency(row.currency);
    revenue[currency] = revenue[currency].plus(decimalValue(row._sum.price));
  });

  const mailOrder = zeroTotals();
  mailOrderRows.forEach((row) => {
    const currency = asCurrency(row.currency);
    mailOrder[currency] = mailOrder[currency].plus(decimalValue(row._sum.amount));
  });

  const specialPayments = specialPaymentTotals(specialSummary.totals);
  const expenses: DecimalTotals = {
    TRY: mailOrder.TRY.plus(specialPayments.TRY),
    USD: mailOrder.USD.plus(specialPayments.USD),
  };
  const net: DecimalTotals = {
    TRY: revenue.TRY.minus(expenses.TRY),
    USD: revenue.USD.minus(expenses.USD),
  };

  const operationTypes = buildDistribution(
    operationTypeRows,
    operationTypeDefinitions(operationTypeRows),
    (row) => row.operationType ?? historicalOperationDefinition(row.description).key,
    revenue,
  );

  const paymentMethods = buildDistribution(
    paymentMethodRows,
    paymentMethodDefinitions,
    (row) => row.paymentMethod,
    revenue,
  );

  const expenseBreakdownBase: Array<Omit<ExpenseBreakdownItemDto, "percentages">> = [
    {
      key: "MAIL_ORDER",
      label: "Mail Order",
      source: "SUPPLIER_TRANSACTION_PAYMENT",
      amounts: serializeTotals(mailOrder),
    },
    {
      key: "PERSONNEL",
      label: "Personel",
      source: "EXPENSE_PERSONNEL_PAYMENT",
      amounts: { TRY: specialSummary.totals.personnel, USD: "0.00" },
    },
    {
      key: "LOAN",
      label: "Krediler",
      source: "LOAN_PAYMENT",
      amounts: { TRY: specialSummary.totals.loan, USD: "0.00" },
    },
    {
      key: "SGK",
      label: "SGK & Vergiler",
      source: "EXPENSE_RECORD",
      amounts: { TRY: specialSummary.totals.sgk, USD: "0.00" },
    },
    {
      key: "INVOICE",
      label: "Faturalar",
      source: "INVOICE_PAYMENT",
      amounts: { TRY: specialSummary.totals.invoice, USD: "0.00" },
    },
    {
      key: "GENERAL",
      label: "Genel Giderler",
      source: "EXPENSE_RECORD",
      amounts: { TRY: specialSummary.totals.expense, USD: "0.00" },
    },
    {
      key: "MEAL",
      label: "Yemek",
      source: "EXPENSE_RECORD",
      amounts: { TRY: specialSummary.totals.meal, USD: "0.00" },
    },
  ];
  const expenseBreakdown: ExpenseBreakdownItemDto[] = expenseBreakdownBase.map((item) => ({
    ...item,
    percentages: {
      TRY: percentage(decimalValue(item.amounts.TRY), expenses.TRY),
      USD: percentage(decimalValue(item.amounts.USD), expenses.USD),
    },
  }));

  return {
    period: {
      type: filter.period,
      date: filter.date,
      start: filter.start.toISOString(),
      end: filter.end.toISOString(),
      timeZone,
    },
    revenue: serializeTotals(revenue),
    expenses: {
      total: serializeTotals(expenses),
      sources: {
        mailOrder: serializeTotals(mailOrder),
        specialPayments: serializeTotals(specialPayments),
      },
    },
    net: serializeTotals(net),
    totalOperations: operationCount,
    totalVehicles: vehicleGroups.length,
    operationTypes,
    paymentMethods,
    expenseBreakdown,
    trend: buildTrend(filter, trendRows.revenue, trendRows.mailOrder, specialDailyTotals),
  };
};
