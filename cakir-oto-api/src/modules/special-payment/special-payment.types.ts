import type { Prisma } from "../../../generated/prisma/client.js";

export type SpecialPaymentCategory =
  | "personnel"
  | "expense"
  | "invoice"
  | "loan"
  | "sgk"
  | "meal";

export type SpecialPaymentPeriod = "day" | "month" | "year";

export type SpecialPaymentPeriodFilter = {
  period: SpecialPaymentPeriod;
  date: string;
  start: Date;
  end: Date;
};

export type SpecialPaymentTotals = Record<SpecialPaymentCategory, string>;

export type SpecialPaymentSummaryDto = {
  period: SpecialPaymentPeriod;
  date: string;
  totals: SpecialPaymentTotals;
};

export type SpecialPaymentDailyTotalDto = {
  date: string;
  total: string;
};

export type SpecialPaymentItemDto = {
  id: string;
  category: SpecialPaymentCategory;
  title: string;
  paymentDate: string;
  amount: string;
  note: string | null;
};

export type SpecialPaymentListDto = {
  period: SpecialPaymentPeriod;
  date: string;
  category: SpecialPaymentCategory;
  items: SpecialPaymentItemDto[];
};

export type SpecialPaymentInput = {
  paymentDate: Date;
  amount: Prisma.Decimal;
  note: string | null;
  personnelId: string | null;
  loanAccountId: string | null;
  invoiceTypeId: string | null;
};

export type SpecialPaymentLookupDto = {
  id: string;
  name: string;
};
