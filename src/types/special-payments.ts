export type SpecialPaymentCategory =
  | "personnel"
  | "expense"
  | "invoice"
  | "loan"
  | "sgk"
  | "meal";

export type SpecialPaymentPeriod = "day" | "month" | "year";

export type SpecialPaymentTotals = Record<SpecialPaymentCategory, string>;

export type SpecialPaymentSummary = {
  period: SpecialPaymentPeriod;
  date: string;
  totals: SpecialPaymentTotals;
};

export type SpecialPaymentItem = {
  id: string;
  category: SpecialPaymentCategory;
  title: string;
  paymentDate: string;
  amount: string;
  note: string | null;
};

export type SpecialPaymentList = {
  period: SpecialPaymentPeriod;
  date: string;
  category: SpecialPaymentCategory;
  items: SpecialPaymentItem[];
};

export type MaintenanceItem = {
  id: string;
  name: string;
  isActive: boolean;
};

export type SpecialPaymentLookup = {
  id: string;
  name: string;
};
