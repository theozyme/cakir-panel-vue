import type { Currency } from "./business";

export type ReportPeriod = "day" | "month" | "year";
export type DashboardPaymentPeriod = "today" | "month" | "30d" | "90d" | "1y";
export type ReportCurrencyTotals = Record<Currency, string>;

export type ReportDistributionItem = {
  key: string;
  label: string;
  count: number;
  amounts: ReportCurrencyTotals;
  percentages: ReportCurrencyTotals;
};

export type ExpenseBreakdownSource =
  | "SUPPLIER_TRANSACTION_PAYMENT"
  | "EXPENSE_PERSONNEL_PAYMENT"
  | "LOAN_PAYMENT"
  | "INVOICE_PAYMENT"
  | "EXPENSE_RECORD";

export type ReportExpenseBreakdownItem = {
  key: string;
  label: string;
  source: ExpenseBreakdownSource;
  amounts: ReportCurrencyTotals;
  percentages: ReportCurrencyTotals;
};

export type ReportTrendItem = {
  bucketStart: string;
  label: string;
  revenue: ReportCurrencyTotals;
  expenses: ReportCurrencyTotals;
  net: ReportCurrencyTotals;
};

export type ReportsOverview = {
  period: {
    type: ReportPeriod;
    date: string;
    start: string;
    end: string;
    timeZone: "Europe/Istanbul";
  };
  revenue: ReportCurrencyTotals;
  expenses: {
    total: ReportCurrencyTotals;
    sources: {
      mailOrder: ReportCurrencyTotals;
      specialPayments: ReportCurrencyTotals;
    };
  };
  net: ReportCurrencyTotals;
  totalOperations: number;
  totalVehicles: number;
  operationTypes: ReportDistributionItem[];
  paymentMethods: ReportDistributionItem[];
  expenseBreakdown: ReportExpenseBreakdownItem[];
  trend: ReportTrendItem[];
};

export type DashboardFinance = {
  date: string;
  timeZone: "Europe/Istanbul";
  paymentPeriod: DashboardPaymentPeriod;
  dailyEarnings: Array<{
    date: string;
    label: string;
    amounts: ReportCurrencyTotals;
  }>;
  paymentMethods: ReportDistributionItem[];
};
