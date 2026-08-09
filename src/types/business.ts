export type Currency = "TRY" | "USD";
export type CurrencyTotals = Record<Currency, string>;

export type PendingVehicle = {
  id: string;
  plate: string;
  createdAt: string;
};

export type ConfirmPendingVehicleResponse = {
  pendingVehicleId: string;
  visitId: string;
  vehicleId: string;
  plate: string;
  arrivalAt: string;
};

export type VehicleVisitDetail = {
  id: string;
  arrivalAt: string;
  note: string | null;
  vehicle: {
    id: string;
    plate: string;
    brand: string | null;
    model: string | null;
  };
  customer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    note: string | null;
  } | null;
};

export type DailyVehicleOperation = {
  id: string;
  operationType: string | null;
  description: string;
  price: string;
  currency: Currency;
  paymentMethod: string;
  operationAt: string;
  note: string | null;
};

export type DailyVehicleVisit = {
  visitId: string;
  vehicleId: string;
  plate: string;
  customer: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  } | null;
  vehicle: { brand: string | null; model: string | null };
  arrivalAt: string;
  note: string | null;
  operations: DailyVehicleOperation[];
  operationCount: number;
  totalsByCurrency: CurrencyTotals;
};

export type DailyVehicleOperationResponse = {
  date: string;
  visits: DailyVehicleVisit[];
  summary: {
    totalVehicles: number;
    totalOperations: number;
    totalsByCurrency: CurrencyTotals;
  };
};

export type MultimediaProduct = {
  id: string;
  code: string;
  forx: string | null;
  model: string | null;
  brand: string | null;
  shelf: string | null;
  quantity: number;
};

export type ScreenProduct = {
  id: string;
  brand: string;
  storageGb: number | null;
  ramGb: number | null;
  cores: number | null;
  sizeInch: string | null;
  sizeLabel: string | null;
  quantity: number;
};

export type SoundSystemProduct = {
  id: string;
  name: string;
  purchasePriceUsd: string | null;
  cashSalePriceUsd: string | null;
  cardSalePriceUsd: string | null;
  quantity: number;
  criticalStockLevel: number;
};

export type Supplier = {
  id: string;
  name: string;
  currency: Currency;
};

export type MailOrderPeriod = "day" | "month" | "year";

export type MailOrderSupplier = Supplier & {
  currentBalance: string;
  periodDebtIncrease: string;
  periodPayments: string;
};

export type MailOrderCurrencySummary = {
  debtIncrease: string;
  payments: string;
  remainingDebt: string;
};

export type MailOrderSummary = Record<Currency, MailOrderCurrencySummary>;

export type SupplierTransaction = {
  id: string;
  transactionAt: string;
  type: "DEBT_INCREASE" | "PAYMENT" | "ADJUSTMENT" | "CANCEL";
  amount: string;
  currency: Currency;
  balanceAfter: string | null;
  note: string | null;
  sourceType: "MANUAL" | "VEHICLE_OPERATION" | "MIGRATION";
  sourceId: string | null;
};

export type MailOrderTrendItem = {
  bucketStart: string;
  label: string;
  TRY: { debtIncrease: string; payments: string };
  USD: { debtIncrease: string; payments: string };
};

export type UsdExchangeRate = {
  base: "USD";
  quote: "TRY";
  rate: string;
  rateType: "FOREX_SELLING";
  effectiveDate: string;
  fetchedAt: string;
  isStale: boolean;
};

export type SoundOffer = {
  id: string;
  manualTotal: string | null;
  autoTotal: string;
  finalTotal: string;
  exchangeRate: string;
  saleType: "CASH" | "CARD";
  status: string;
  createdAt: string;
  operationId: string | null;
  items: Array<{
    id: string;
    productId: string | null;
    productName: string;
    unitPurchasePriceUsd: string | null;
    quantity: number;
    lineTotal: string | null;
  }>;
};

export type OperationType = "MULTIMEDIA" | "SOUND_SYSTEM" | "SERVICE" | "ACCESSORY" | "OTHER";
export type PaymentMethod = "CASH" | "CREDIT_CARD" | "BANK_TRANSFER" | "MAIL_ORDER";

export type VehicleOperationHistoryItem = {
  operationId: string;
  visitId: string;
  vehicleId: string;
  plate: string;
  customer: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  } | null;
  vehicle: { brand: string | null; model: string | null };
  operationType: string | null;
  description: string;
  paymentMethod: string;
  price: string;
  currency: Currency;
  operationAt: string;
  note: string | null;
};

export type VehicleOperationHistoryResponse = {
  items: VehicleOperationHistoryItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type VehicleCustomerSummary = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  note: string | null;
};

export type VehicleLookupItem = {
  vehicleId: string;
  plate: string;
  brand: string | null;
  model: string | null;
  customer: VehicleCustomerSummary | null;
};

export type VehicleLookupResponse = { items: VehicleLookupItem[] };

export type CreateVehicleVisitResponse = {
  visitId: string;
  vehicleId: string;
  arrivalAt: string;
};

export type VehicleHistoryOperation = {
  operationId: string;
  description: string;
  operationType: string | null;
  price: string;
  currency: Currency;
  paymentMethod: string;
  operationAt: string;
  note: string | null;
  multimediaProduct: {
    id: string;
    code: string;
    forx: string | null;
    model: string | null;
    brand: string | null;
    shelf: string | null;
  } | null;
  screenProduct: {
    id: string;
    brand: string;
    storageGb: number | null;
    ramGb: number | null;
    cores: number | null;
    sizeInch: string | null;
    sizeLabel: string | null;
  } | null;
  soundOffer: {
    id: string;
    status: string;
    saleType: string;
    finalTotal: string;
    exchangeRate: string;
    items: Array<{
      id: string;
      productId: string | null;
      productName: string;
      quantity: number;
      unitPurchasePriceUsd: string | null;
      lineTotal: string | null;
    }>;
  } | null;
  mailOrderSupplier: { id: string; name: string; currency: string } | null;
};

export type VehicleHistoryResponse = {
  vehicle: {
    id: string;
    plate: string;
    brand: string | null;
    model: string | null;
  };
  customer: VehicleCustomerSummary | null;
  visits: Array<{
    visitId: string;
    arrivalAt: string;
    visitNote: string | null;
    customer: VehicleCustomerSummary | null;
    operations: VehicleHistoryOperation[];
  }>;
};
