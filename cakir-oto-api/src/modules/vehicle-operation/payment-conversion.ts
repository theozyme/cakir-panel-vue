import { Prisma } from "../../../generated/prisma/client.js";
import { HttpError } from "../../lib/http-error.js";
import type { UsdExchangeRateDto } from "../exchange-rate/exchange-rate.types.js";

export type PaymentSnapshot = {
  sourceAmount: Prisma.Decimal | null;
  sourceCurrency: string | null;
  exchangeRate: Prisma.Decimal | null;
  exchangeRateType: string | null;
  exchangeRateDate: string | null;
  exchangeRateFetchedAt: Date | null;
  exchangeRateIsStale: boolean | null;
};
export const emptyPaymentSnapshot = (): PaymentSnapshot => ({
  sourceAmount: null,
  sourceCurrency: null,
  exchangeRate: null,
  exchangeRateType: null,
  exchangeRateDate: null,
  exchangeRateFetchedAt: null,
  exchangeRateIsStale: null,
});
export const istanbulDate = (date: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

export const convertSupplierPayment = (
  amountTry: Prisma.Decimal,
  currency: string,
  rate: UsdExchangeRateDto | null,
) => {
  if (
    !amountTry.isFinite() ||
    !amountTry.greaterThan(0) ||
    amountTry.greaterThan("999999999999.99")
  )
    throw new HttpError(400, "TL tutari gecersiz veya cok buyuk");
  if (currency !== "TRY" && currency !== "USD")
    throw new HttpError(400, "Firma para birimi desteklenmiyor");
  if (
    currency === "USD" &&
    (!rate ||
      !new Prisma.Decimal(rate.rate).isFinite() ||
      !new Prisma.Decimal(rate.rate).greaterThan(0))
  )
    throw new HttpError(503, "Gecerli USD kuru bulunamadi");
  const amount =
    currency === "USD"
      ? amountTry.div(rate!.rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
      : amountTry;
  if (!amount.greaterThan(0) || amount.greaterThan("999999999999.99"))
    throw new HttpError(400, "Firma odemesi sifira yuvarlaniyor veya cok buyuk");
  const snapshot: PaymentSnapshot = {
    ...emptyPaymentSnapshot(),
    sourceAmount: amountTry,
    sourceCurrency: "TRY",
    ...(currency === "USD" && rate
      ? {
          exchangeRate: new Prisma.Decimal(rate.rate),
          exchangeRateType: rate.rateType,
          exchangeRateDate: rate.effectiveDate,
          exchangeRateFetchedAt: new Date(rate.fetchedAt),
          exchangeRateIsStale: rate.isStale,
        }
      : {}),
  };
  return { amount, currency, ...snapshot };
};

export const serializePaymentSnapshot = (row: PaymentSnapshot) => ({
  sourceAmount: row.sourceAmount?.toFixed(2) ?? null,
  sourceCurrency: row.sourceCurrency,
  exchangeRate: row.exchangeRate?.toFixed(4) ?? null,
  exchangeRateType: row.exchangeRateType,
  exchangeRateDate: row.exchangeRateDate,
  exchangeRateFetchedAt: row.exchangeRateFetchedAt?.toISOString() ?? null,
  exchangeRateIsStale: row.exchangeRateIsStale,
});
