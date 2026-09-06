export interface GoodsEntry {
  id: string;
  productId: string;
  productName: string | null;
  supersedesId: string | null;
  createdAt: string;
  date: string;
  supplierName: string;
  purchasePrice: string;
  salePrice: string;
  quantity: number;
  note: string | null;
  estimatedUnitProfit: string;
}
export interface GoodsProduct {
  id: string;
  name: string;
  normalizedName: string;
  latestEntry: GoodsEntry | null;
  entryCount: number;
}
export interface GoodsPage<T> { items: T[]; total: number; page: number; pageSize: number }
export interface GoodsProductTotal {
  id: string;
  name: string;
  totalQuantity: string;
  totalPurchase: string;
  totalPotentialSale: string;
  estimatedProfit: string;
}
export interface GoodsSupplierTotal {
  supplierName: string;
  totalQuantity: string;
  totalPurchase: string;
  entryCount: string;
}
