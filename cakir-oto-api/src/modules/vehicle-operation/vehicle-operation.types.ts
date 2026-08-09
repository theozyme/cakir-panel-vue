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
  operationType: string;
  description: string;
  price: string;
  currency: SupportedCurrency;
  paymentMethod: string;
  operationAt: string;
  note: string | null;
  soundOfferId: string | null;
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
