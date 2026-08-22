export type InventoryStockType = "MULTIMEDIA" | "SCREEN" | "SOUND_SYSTEM";
export type InventoryStatus = "OUT_OF_STOCK" | "CRITICAL" | "SUFFICIENT";
export type InventoryActiveFilter = "true" | "false" | "all";

export type InventoryListFilter = {
  type: InventoryStockType;
  search: string | null;
  brand: string | null;
  criticalOnly: boolean;
  active: InventoryActiveFilter;
  page: number;
  pageSize: number;
};

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
