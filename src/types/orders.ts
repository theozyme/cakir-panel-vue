import type { InventoryStockType } from "@/types/inventory";

export type OrderStatus = "DRAFT" | "ORDERED" | "RECEIVED" | "CANCELLED";
export type OrderPaymentStatus = "UNPAID" | "PARTIAL" | "PAID";
export type OrderPaymentMethod =
  | "CASH"
  | "CREDIT_CARD"
  | "BANK_TRANSFER"
  | "CHECK"
  | "TERM";

export type Supplier = {
  id: string;
  name: string;
  currency: "TRY" | "USD";
};

export type StockOrderItem = {
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

export type StockOrder = {
  id: string;
  supplier: Supplier;
  currency: "TRY" | "USD";
  orderDate: string;
  expectedDeliveryDate: string;
  paymentStatus: OrderPaymentStatus;
  paymentMethod: OrderPaymentMethod;
  note: string | null;
  status: OrderStatus;
  receivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  productKinds: number;
  totalQuantity: number;
  totalAmount: string;
  stockTypes: InventoryStockType[];
  items: StockOrderItem[];
};

export type StockOrderListResponse = {
  items: StockOrder[];
  total: number;
  page: number;
  pageSize: number;
};

export type StockOrderItemInput = {
  key: string;
  stockType: InventoryStockType;
  isNewProduct: boolean;
  productId?: string;
  productSnapshot?: Record<string, unknown>;
  productLabel: string;
  productCode: string | null;
  quantity: number;
  unitPrice: string;
};

export const orderStatusLabels: Record<OrderStatus, string> = {
  DRAFT: "Taslak",
  ORDERED: "Sipariş Verildi",
  RECEIVED: "Teslim Alındı",
  CANCELLED: "İptal",
};

export const paymentStatusLabels: Record<OrderPaymentStatus, string> = {
  UNPAID: "Ödenmedi",
  PARTIAL: "Kısmi Ödendi",
  PAID: "Ödendi",
};

export const paymentMethodLabels: Record<OrderPaymentMethod, string> = {
  CASH: "Nakit",
  CREDIT_CARD: "Kredi Kartı",
  BANK_TRANSFER: "Havale / EFT",
  CHECK: "Çek",
  TERM: "Vadeli",
};
