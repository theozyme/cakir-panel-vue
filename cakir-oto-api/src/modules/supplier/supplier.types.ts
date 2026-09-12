import type { Prisma } from "../../../generated/prisma/client.js";

import type { BusinessTransaction } from "../../lib/transaction.js";
import type { PaymentSnapshot, serializePaymentSnapshot } from "../vehicle-operation/payment-conversion.js";

export type SupplierCurrency = "TRY" | "USD";
export type SupplierPeriod = "day" | "month" | "year";
export type SupplierTransactionType = "DEBT_INCREASE" | "PAYMENT" | "ADJUSTMENT" | "CANCEL";
export type SupplierTransactionSourceType = "MANUAL" | "VEHICLE_OPERATION" | "MIGRATION";

export type SupplierPeriodFilter = {
  period: SupplierPeriod;
  year: number;
  month?: number;
  day?: number;
  start: Date;
  end: Date;
};

export type CurrencySummary = {
  debtIncrease: string;
  payments: string;
  remainingDebt: string;
};

export type SupplierSummaryDto = Record<SupplierCurrency, CurrencySummary>;

export type SupplierDto = {
  isActive: boolean;
  id: string;
  name: string;
  currency: SupplierCurrency;
  currentBalance: string;
  periodDebtIncrease: string;
  periodPayments: string;
};

export type SupplierLookupDto = {
  id: string;
  name: string;
  currency: SupplierCurrency;
};

export type SupplierTransactionDto = ReturnType<typeof serializePaymentSnapshot> & {
  id: string;
  transactionAt: string;
  type: SupplierTransactionType;
  amount: string;
  currency: SupplierCurrency;
  balanceAfter: string | null;
  note: string | null;
  sourceType: SupplierTransactionSourceType;
  sourceId: string | null;
  voidedAt: string | null;
};

export type TrendCurrencyValues = {
  debtIncrease: string;
  payments: string;
};

export type SupplierTrendItemDto = {
  bucketStart: string;
  label: string;
  TRY: TrendCurrencyValues;
  USD: TrendCurrencyValues;
};

export type ManualSupplierTransactionInput = {
  amount: Prisma.Decimal;
  note: string | null;
  transactionAt: Date | null;
};

export type SupplierPaymentInput = Partial<PaymentSnapshot> & {
  tx: BusinessTransaction;
  supplierId: string;
  operationId: string;
  amount: Prisma.Decimal;
  currency: string;
  transactionAt: Date;
};

export type VehicleOperationSupplierPaymentState = Partial<PaymentSnapshot> & {
  supplierId: string;
  amount: Prisma.Decimal;
  currency: string;
  transactionAt: Date;
};
