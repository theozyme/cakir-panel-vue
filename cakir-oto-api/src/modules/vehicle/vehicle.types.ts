import type { SupportedCurrency } from "../vehicle-operation/vehicle-operation.types.js";

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

export type VehicleLookupResponse = {
  items: VehicleLookupItem[];
};

export type VehicleHistoryOperation = {
  operationId: string;
  description: string;
  operationType: string | null;
  price: string;
  currency: SupportedCurrency;
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
  mailOrderSupplier: {
    id: string;
    name: string;
    currency: string;
  } | null;
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
