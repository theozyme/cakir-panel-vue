export type InventoryStockType = "MULTIMEDIA" | "SCREEN" | "SOUND_SYSTEM";
export type InventoryStatus = "OUT_OF_STOCK" | "CRITICAL" | "SUFFICIENT";

export type MultimediaInventoryProduct = {
  type: "MULTIMEDIA";
  id: string;
  code: string;
  brand: string | null;
  model: string | null;
  forx: string | null;
  shelf: string | null;
  quantity: number;
  criticalStockLevel: number;
  isActive: boolean;
  status: InventoryStatus;
};

export type ScreenInventoryProduct = {
  type: "SCREEN";
  id: string;
  brand: string;
  storageGb: number | null;
  ramGb: number | null;
  cores: number | null;
  sizeInch: string | null;
  sizeLabel: string | null;
  quantity: number;
  criticalStockLevel: number;
  isActive: boolean;
  status: InventoryStatus;
};

export type SoundInventoryProduct = {
  type: "SOUND_SYSTEM";
  id: string;
  name: string;
  purchasePriceUsd: string | null;
  quantity: number;
  criticalStockLevel: number;
  isActive: boolean;
  status: InventoryStatus;
};

export type InventoryProduct =
  | MultimediaInventoryProduct
  | ScreenInventoryProduct
  | SoundInventoryProduct;

export type InventoryListResponse = {
  items: InventoryProduct[];
  total: number;
  page: number;
  pageSize: number;
};

export const inventoryTypeLabels: Record<InventoryStockType, string> = {
  MULTIMEDIA: "Multimedya",
  SCREEN: "Ekran",
  SOUND_SYSTEM: "Ses Sistemi",
};

export const inventoryStatusLabels: Record<InventoryStatus, string> = {
  OUT_OF_STOCK: "Tükendi",
  CRITICAL: "Kritik",
  SUFFICIENT: "Yeterli",
};

export const inventoryProductLabel = (product: InventoryProduct): string => {
  if (product.type === "MULTIMEDIA") {
    return [product.brand, product.model, product.forx].filter(Boolean).join(" ") || product.code;
  }
  if (product.type === "SCREEN") {
    return [product.brand, product.sizeLabel ?? product.sizeInch].filter(Boolean).join(" ");
  }
  return product.name;
};

export const inventoryProductCode = (product: InventoryProduct): string =>
  product.type === "MULTIMEDIA" ? product.code : "";
