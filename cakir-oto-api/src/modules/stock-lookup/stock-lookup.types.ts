export type MultimediaProductDto = {
  id: string;
  code: string;
  forx: string | null;
  model: string | null;
  brand: string | null;
  shelf: string | null;
  quantity: number;
};

export type ScreenProductDto = {
  id: string;
  brand: string;
  storageGb: number | null;
  ramGb: number | null;
  cores: number | null;
  sizeInch: string | null;
  sizeLabel: string | null;
  quantity: number;
};

export type SoundSystemProductDto = {
  id: string;
  name: string;
  purchasePriceUsd: string | null;
  cashSalePriceUsd: string | null;
  cardSalePriceUsd: string | null;
  quantity: number;
  criticalStockLevel: number;
};

export type SoundStockConsumptionItem = {
  productId: string | null;
  quantity: number;
};
