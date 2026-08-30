export type ReportPeriod = "day" | "month" | "year";
export type ReportCurrency = "TRY" | "USD";
export type DashboardPaymentPeriod = "today" | "month" | "30d" | "90d" | "1y";

export type CurrencyTotals = Record<ReportCurrency, string>;

export type ReportPeriodFilter = {
  period: ReportPeriod;
  date: string;
  year: number;
  month: number;
  day: number;
  start: Date;
  end: Date;
};

export type ReportPeriodDto = {
  type: ReportPeriod;
  date: string;
  start: string;
  end: string;
  timeZone: "Europe/Istanbul";
};

export type ReportDistributionItemDto = {
  key: string;
  label: string;
  count: number;
  amounts: CurrencyTotals;
  percentages: CurrencyTotals;
};

export type ExpenseBreakdownSource =
  | "SUPPLIER_TRANSACTION_PAYMENT"
  | "EXPENSE_PERSONNEL_PAYMENT"
  | "LOAN_PAYMENT"
  | "INVOICE_PAYMENT"
  | "EXPENSE_RECORD";

export type ExpenseBreakdownItemDto = {
  key: string;
  label: string;
  source: ExpenseBreakdownSource;
  amounts: CurrencyTotals;
  percentages: CurrencyTotals;
};

export type ReportTrendItemDto = {
  bucketStart: string;
  label: string;
  revenue: CurrencyTotals;
  expenses: CurrencyTotals;
  net: CurrencyTotals;
};

export type ReportsOverviewDto = {
  period: ReportPeriodDto;
  revenue: CurrencyTotals;
  expenses: {
    total: CurrencyTotals;
    sources: {
      mailOrder: CurrencyTotals;
      specialPayments: CurrencyTotals;
    };
  };
  net: CurrencyTotals;
  totalOperations: number;
  totalVehicles: number;
  operationTypes: ReportDistributionItemDto[];
  paymentMethods: ReportDistributionItemDto[];
  expenseBreakdown: ExpenseBreakdownItemDto[];
  trend: ReportTrendItemDto[];
};

export type DashboardDailyEarningDto = {
  date: string;
  label: string;
  amounts: CurrencyTotals;
};

export type DashboardFinanceDto = {
  date: string;
  timeZone: "Europe/Istanbul";
  paymentPeriod: DashboardPaymentPeriod;
  dailyEarnings: DashboardDailyEarningDto[];
  paymentMethods: ReportDistributionItemDto[];
};
