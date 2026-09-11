import { Prisma } from "../../../generated/prisma/client.js";
import { getPrisma } from "../../lib/prisma.js";
import { HttpError } from "../../lib/http-error.js";
import type { BusinessTransaction } from "../../lib/transaction.js";
import { getUsdExchangeRate } from "../exchange-rate/exchange-rate.service.js";
import type { UsdExchangeRateDto } from "../exchange-rate/exchange-rate.types.js";
import {
  convertSupplierPayment,
  istanbulDate,
  serializePaymentSnapshot,
} from "./payment-conversion.js";
import type { VehicleOperationSupplierPaymentState } from "../supplier/supplier.types.js";

export const activeSupplierPayment = async (tx: BusinessTransaction, operationId: string) =>
  tx.supplierTransaction.findFirst({
    where: { sourceType: "VEHICLE_OPERATION", sourceId: operationId, voidedAt: null },
  });
export const serializeSupplierPayment = (row: Awaited<ReturnType<typeof activeSupplierPayment>>) =>
  row
    ? {
        supplierId: row.supplierId,
        amount: row.amount.toFixed(2),
        currency: row.currency,
        transactionAt: row.transactionAt.toISOString(),
        ...serializePaymentSnapshot(row),
      }
    : null;

export const preparePaymentRate = async (
  supplierId: string | null,
  currency: string,
  operationAt: Date,
  operationId?: string,
  expected?: unknown,
  prisma = getPrisma(),
): Promise<UsdExchangeRateDto | null> => {
  if (!supplierId || currency !== "TRY") return null;
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { currency: true, isActive: true },
  });
  if (!supplier?.isActive) throw new HttpError(409, "Firma bulunamadi veya aktif degil");
  if (supplier.currency === "TRY") return null;
  const current = operationId
    ? await prisma.vehicleOperation.findUnique({
        where: { id: operationId },
        select: { operationAt: true },
      })
    : null;
  const previous = operationId ? await activeSupplierPayment(prisma, operationId) : null;
  let rate: UsdExchangeRateDto;
  if (
    current &&
    previous?.exchangeRate &&
    previous.exchangeRateDate &&
    previous.exchangeRateFetchedAt &&
    istanbulDate(current.operationAt) === istanbulDate(operationAt)
  ) {
    rate = {
      base: "USD",
      quote: "TRY",
      rate: previous.exchangeRate.toFixed(4),
      rateType: "FOREX_SELLING",
      effectiveDate: previous.exchangeRateDate,
      fetchedAt: previous.exchangeRateFetchedAt.toISOString(),
      isStale: previous.exchangeRateIsStale ?? false,
    };
  } else rate = await getUsdExchangeRate(istanbulDate(operationAt));
  const preview = expected as { rate?: unknown; effectiveDate?: unknown } | undefined;
  if (!preview || preview.rate !== rate.rate || preview.effectiveDate !== rate.effectiveDate)
    throw new HttpError(
      409,
      "USD kuru degisti veya onizleme eksik; kuru yenileyip tekrar kaydedin",
    );
  return rate;
};

export const nextSupplierPayment = async (
  tx: BusinessTransaction,
  supplierId: string | null,
  price: Prisma.Decimal,
  currency: string,
  transactionAt: Date,
  rate: UsdExchangeRateDto | null,
): Promise<VehicleOperationSupplierPaymentState | null> => {
  if (!supplierId) return null;
  const supplier = await tx.supplier.findUnique({
    where: { id: supplierId },
    select: { currency: true, isActive: true },
  });
  if (!supplier?.isActive) throw new HttpError(409, "Firma bulunamadi veya aktif degil");
  if (currency !== "TRY") {
    if (supplier.currency !== currency)
      throw new HttpError(
        400,
        "Eski kaydin para birimi firma ile uyusmuyor; TL duzeltmesi kullanin",
      );
    return { supplierId, amount: price, currency, transactionAt };
  }
  return { supplierId, transactionAt, ...convertSupplierPayment(price, supplier.currency, rate) };
};

export const supplierStateKey = (state: VehicleOperationSupplierPaymentState | null) =>
  state
    ? JSON.stringify({
        supplierId: state.supplierId,
        amount: state.amount.toFixed(2),
        currency: state.currency,
        transactionAt: state.transactionAt.toISOString(),
        sourceAmount: state.sourceAmount?.toFixed(2) ?? null,
        sourceCurrency: state.sourceCurrency ?? null,
        exchangeRate: state.exchangeRate?.toFixed(4) ?? null,
        exchangeRateDate: state.exchangeRateDate ?? null,
      })
    : "";
