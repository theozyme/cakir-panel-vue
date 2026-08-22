export type PaymentMethod = "nakit" | "kart" | "havale" | "mail_order";
export type OperationStatus = "bekleyen" | "tamamlandi" | "iptal";
export type OperationType =
  | "multimedya"
  | "ses_sistemi"
  | "mail_order"
  | "servis"
  | "aksesuar"
  | "diger";

export interface Vehicle {
  id: string;
  plaka: string;
  musteriAd: string;
  musteriSoyad: string;
  telefon: string;
  marka: string;
  model: string;
  girisTarihi: string;
  durum: OperationStatus;
}

export interface Operation {
  id: string;
  plaka: string;
  musteri: string;
  islemTuru: OperationType;
  ucret: number;
  odemeTuru: PaymentMethod;
  tarih: string;
  durum: OperationStatus;
  not?: string;
}

export interface Wholesaler {
  id: string;
  ad: string;
  paraBirimi: "TRY" | "USD";
  malGirisi: number;
  odenen: number;
  kalanBorc: number;
}

export interface WholesalerMovement {
  id: string;
  toptanciId: string;
  tarih: string;
  tur: "mal_giris" | "odeme";
  aciklama: string;
  tutar: number;
  paraBirimi: "TRY" | "USD";
}

export type PaymentCategory =
  | "personel"
  | "gider"
  | "fatura"
  | "kredi"
  | "sgk_vergi"
  | "yemek"
  | "ozel";

export interface SpecialPayment {
  id: string;
  kategori: PaymentCategory;
  baslik: string;
  tutar: number;
  tarih: string;
  not?: string;
}
