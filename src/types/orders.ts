import type { StockItem } from "@/types";

export type StockCategory = StockItem["kategori"];

export type OrderStatus =
  | "taslak"
  | "verildi"
  | "hazirlaniyor"
  | "kargoda"
  | "kismi_teslim"
  | "teslim_edildi"
  | "iptal";

export type OrderPaymentStatus = "odenmedi" | "kismi" | "odendi";

export type OrderPaymentMethod = "nakit" | "kart" | "havale" | "cek" | "vadeli";

export interface Supplier {
  id: string;
  ad: string;
  paraBirimi: "TRY" | "USD";
}

export interface OrderItem {
  stokId: string;
  urun: string;
  kod: string;
  adet: number;
  birimFiyat: number;
  teslimEdilen: number;
}

export interface OrderHistoryEntry {
  tarih: string;
  durum: OrderStatus;
  aciklama: string;
}

export interface OrderPayment {
  tarih: string;
  tutar: number;
  yontem: OrderPaymentMethod;
}

export interface PurchaseOrder {
  id: string;
  no: string;
  tarih: string;
  beklenenTeslim: string;
  tedarikciId: string;
  tedarikciAd: string;
  stokTuru: StockCategory;
  paraBirimi: "TRY" | "USD";
  notu?: string;
  odemeDurumu: OrderPaymentStatus;
  odemeYontemi: OrderPaymentMethod;
  durum: OrderStatus;
  kalemler: OrderItem[];
  gecmis: OrderHistoryEntry[];
  odemeler: OrderPayment[];
}

export const orderStatusLabels: Record<OrderStatus, string> = {
  taslak: "Taslak",
  verildi: "Sipariş Verildi",
  hazirlaniyor: "Hazırlanıyor",
  kargoda: "Kargoda",
  kismi_teslim: "Kısmi Teslim",
  teslim_edildi: "Teslim Edildi",
  iptal: "İptal",
};

export const paymentStatusLabels: Record<OrderPaymentStatus, string> = {
  odenmedi: "Ödenmedi",
  kismi: "Kısmi Ödendi",
  odendi: "Ödendi",
};

export const paymentMethodLabels: Record<OrderPaymentMethod, string> = {
  nakit: "Nakit",
  kart: "Kredi Kartı",
  havale: "Havale / EFT",
  cek: "Çek",
  vadeli: "Vadeli",
};

export const stockCategoryLabels: Record<StockCategory, string> = {
  multimedya: "Multimedya",
  ekran: "Ekran",
  ses_sistemi: "Ses Sistemi",
};

export function orderTotal(o: PurchaseOrder) {
  return o.kalemler.reduce((t, k) => t + k.adet * k.birimFiyat, 0);
}

export function orderQty(o: PurchaseOrder) {
  return o.kalemler.reduce((t, k) => t + k.adet, 0);
}
