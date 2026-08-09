export type CreateSoundOfferItemInput = {
  productId: string;
  quantity: number;
};

export type CreateSoundOfferInput = {
  saleType: "CASH" | "CARD";
  items: CreateSoundOfferItemInput[];
  manualTotal: string | null;
};

export type SoundOfferDto = {
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
