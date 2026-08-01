export type SaleType = "nakit" | "kredi_karti";

export interface AudioProduct {
  id: string;
  urun: string;
  marka: string;
  alisFiyati: number;
  nakitSatisFiyati: number;
  kartSatisFiyati: number;
  adet: number;
  kritikSeviye: number;
}

export interface QuoteLine {
  urunId: string;
  urun: string;
  adet: number;
  birimFiyat: number;
  alisFiyati: number;
}

export interface Quote {
  id: string;
  no: string;
  tarih: string;
  musteri: string;
  plaka?: string;
  satisTipi: SaleType;
  kalemler: QuoteLine[];
  otomatikToplam: number;
  nihaiTutar: number;
  tahminiKar: number;
  durum: "onaylandi" | "beklemede";
}

export const saleTypeLabels: Record<SaleType, string> = {
  nakit: "Nakit",
  kredi_karti: "Kredi Kartı",
};
