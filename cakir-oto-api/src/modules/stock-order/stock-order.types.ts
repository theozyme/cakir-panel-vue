import type { InventoryStockType } from "../inventory/inventory.types.js";

export type StockOrderStatusValue = "DRAFT" | "ORDERED" | "RECEIVED" | "CANCELLED";
export type StockOrderPaymentStatusValue = "UNPAID" | "PARTIAL" | "PAID";
export type StockOrderPaymentMethodValue =
  | "CASH"
  | "CREDIT_CARD"
  | "BANK_TRANSFER"
  | "CHECK"
  | "TERM";

export type StockOrderListFilter = {
  search: string | null;
  status: StockOrderStatusValue | null;
  supplierId: string | null;
  stockType: InventoryStockType | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  page: number;
  pageSize: number;
};

export type StockOrderItemDto = {
  id: string;
  stockType: InventoryStockType;
  productId: string | null;
  isNewProduct: boolean;
  productSnapshot: Record<string, unknown>;
  productLabel: string;
  productCode: string | null;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
};

export type StockOrderDto = {
  id: string;
  supplier: { id: string; name: string; currency: "TRY" | "USD" };
  currency: "TRY" | "USD";
  orderDate: string;
  expectedDeliveryDate: string;
  paymentStatus: StockOrderPaymentStatusValue;
  paymentMethod: StockOrderPaymentMethodValue;
  note: string | null;
  status: StockOrderStatusValue;
  receivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  productKinds: number;
  totalQuantity: number;
  totalAmount: string;
  stockTypes: InventoryStockType[];
  items: StockOrderItemDto[];
};

export type StockOrderListResponse = {
  items: StockOrderDto[];
  total: number;
  page: number;
  pageSize: number;
};
