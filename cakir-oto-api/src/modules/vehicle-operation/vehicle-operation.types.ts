export type SupportedCurrency = "TRY" | "USD";

export type CurrencyTotals = Record<SupportedCurrency, string>;

export type VehicleOperationListItem = {
  id: string;
  operationType: string | null;
  description: string;
  price: string;
  currency: SupportedCurrency;
  paymentMethod: string;
  operationAt: string;
  note: string | null;
};

export type VehicleOperationVisitItem = {
  visitId: string;
  vehicleId: string;
  plate: string;
  customer: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  } | null;
  vehicle: {
    brand: string | null;
    model: string | null;
  };
  arrivalAt: string;
  note: string | null;
  operations: VehicleOperationListItem[];
  operationCount: number;
  totalsByCurrency: CurrencyTotals;
};

export type VehicleOperationDailyResponse = {
  date: string;
  visits: VehicleOperationVisitItem[];
  summary: {
    totalVehicles: number;
    totalOperations: number;
    totalsByCurrency: CurrencyTotals;
  };
};

export type CreateVehicleOperationResponse = {
  id: string;
  visitId: string;
  vehicleId: string;
  operationType: string | null;
  description: string;
  price: string;
  currency: SupportedCurrency;
  paymentMethod: string;
  operationAt: string;
  note: string | null;
  soundOfferId: string | null;
  revision: number;
};

export type VehicleOperationDetail = CreateVehicleOperationResponse & {
  plate: string;
  customer: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    note: string | null;
  } | null;
  vehicle: { brand: string | null; model: string | null };
  multimediaProductId: string | null;
  screenProductId: string | null;
  mailOrderSupplierId: string | null;
  multimediaProduct: { id: string; code: string; brand: string | null; model: string | null } | null;
  screenProduct: { id: string; brand: string; sizeLabel: string | null } | null;
  soundOffer: { id: string; status: string; saleType: string } | null;
  mailOrderSupplier: { id: string; name: string; currency: string } | null;
  hasStockImpact: boolean;
  hasMailOrderImpact: boolean;
};

export type DeleteVehicleOperationResponse = {
  operationId: string;
  vehicleId: string;
  visitId: string;
  deletedAt: string;
  revision: number;
};

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
  vehicle: {
    brand: string | null;
    model: string | null;
  };
  operationType: string | null;
  description: string;
  paymentMethod: string;
  price: string;
  currency: SupportedCurrency;
  operationAt: string;
  note: string | null;
  revision: number;
  hasStockImpact: boolean;
  hasMailOrderImpact: boolean;
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
