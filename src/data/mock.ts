import type {
  Vehicle,
  Operation,
  Wholesaler,
  WholesalerMovement,
} from "@/types";

export const mockVehicles: Vehicle[] = [
  { id: "v1", plaka: "34 ABC 123", musteriAd: "Ahmet", musteriSoyad: "Yılmaz", telefon: "0532 111 22 33", marka: "Renault", model: "Clio", girisTarihi: "2026-07-27", durum: "bekleyen" },
  { id: "v2", plaka: "06 XYZ 456", musteriAd: "Mehmet", musteriSoyad: "Kaya", telefon: "0533 222 33 44", marka: "Volkswagen", model: "Passat", girisTarihi: "2026-07-27", durum: "bekleyen" },
  { id: "v3", plaka: "35 DEF 789", musteriAd: "Ayşe", musteriSoyad: "Demir", telefon: "0534 333 44 55", marka: "Ford", model: "Focus", girisTarihi: "2026-07-26", durum: "tamamlandi" },
  { id: "v4", plaka: "16 GHI 012", musteriAd: "Fatma", musteriSoyad: "Şahin", telefon: "0535 444 55 66", marka: "Toyota", model: "Corolla", girisTarihi: "2026-07-27", durum: "bekleyen" },
  { id: "v5", plaka: "34 JKL 345", musteriAd: "Ali", musteriSoyad: "Öztürk", telefon: "0536 555 66 77", marka: "Hyundai", model: "i20", girisTarihi: "2026-07-25", durum: "tamamlandi" },
];

export const mockOperations: Operation[] = [
  { id: "o1", plaka: "34 ABC 123", musteri: "Ahmet Yılmaz", islemTuru: "multimedya", ucret: 8500, odemeTuru: "kart", tarih: "2026-07-27", durum: "tamamlandi", not: "Android 10 inç" },
  { id: "o2", plaka: "06 XYZ 456", musteri: "Mehmet Kaya", islemTuru: "ses_sistemi", ucret: 15200, odemeTuru: "havale", tarih: "2026-07-27", durum: "tamamlandi" },
  { id: "o3", plaka: "35 DEF 789", musteri: "Ayşe Demir", islemTuru: "mail_order", ucret: 22000, odemeTuru: "mail_order", tarih: "2026-07-26", durum: "tamamlandi" },
  { id: "o4", plaka: "16 GHI 012", musteri: "Fatma Şahin", islemTuru: "servis", ucret: 3400, odemeTuru: "nakit", tarih: "2026-07-27", durum: "bekleyen" },
  { id: "o5", plaka: "34 JKL 345", musteri: "Ali Öztürk", islemTuru: "aksesuar", ucret: 1200, odemeTuru: "nakit", tarih: "2026-07-25", durum: "tamamlandi" },
  { id: "o6", plaka: "34 MNO 678", musteri: "Zeynep Aksoy", islemTuru: "multimedya", ucret: 9800, odemeTuru: "kart", tarih: "2026-07-24", durum: "tamamlandi" },
  { id: "o7", plaka: "34 PQR 901", musteri: "Emre Çelik", islemTuru: "ses_sistemi", ucret: 18500, odemeTuru: "mail_order", tarih: "2026-07-23", durum: "tamamlandi" },
];

export const mockWholesalers: Wholesaler[] = [
  { id: "w1", ad: "Elektronik A.Ş.", paraBirimi: "TRY", malGirisi: 145000, odenen: 95000, kalanBorc: 50000 },
  { id: "w2", ad: "Mega Ses Ltd.", paraBirimi: "TRY", malGirisi: 88000, odenen: 68000, kalanBorc: 20000 },
  { id: "w3", ad: "Global Import Co.", paraBirimi: "USD", malGirisi: 12500, odenen: 8000, kalanBorc: 4500 },
  { id: "w4", ad: "Focal Türkiye", paraBirimi: "USD", malGirisi: 8200, odenen: 8200, kalanBorc: 0 },
];

export const mockMovements: WholesalerMovement[] = [
  { id: "m1", toptanciId: "w1", tarih: "2026-07-15", tur: "mal_giris", aciklama: "Multimedya siparişi", tutar: 45000, paraBirimi: "TRY" },
  { id: "m2", toptanciId: "w1", tarih: "2026-07-20", tur: "odeme", aciklama: "Havale", tutar: 25000, paraBirimi: "TRY" },
  { id: "m3", toptanciId: "w1", tarih: "2026-07-25", tur: "mal_giris", aciklama: "Ekran siparişi", tutar: 30000, paraBirimi: "TRY" },
  { id: "m4", toptanciId: "w2", tarih: "2026-07-18", tur: "mal_giris", aciklama: "Hoparlör seti", tutar: 28000, paraBirimi: "TRY" },
  { id: "m5", toptanciId: "w2", tarih: "2026-07-22", tur: "odeme", aciklama: "Nakit ödeme", tutar: 18000, paraBirimi: "TRY" },
  { id: "m6", toptanciId: "w3", tarih: "2026-07-10", tur: "mal_giris", aciklama: "Import - konteyner", tutar: 6500, paraBirimi: "USD" },
];

export const dailyEarnings = [
  { gun: "Pzt", kazanc: 12400 },
  { gun: "Sal", kazanc: 18200 },
  { gun: "Çar", kazanc: 9800 },
  { gun: "Per", kazanc: 22500 },
  { gun: "Cum", kazanc: 27300 },
  { gun: "Cmt", kazanc: 31200 },
  { gun: "Paz", kazanc: 8400 },
];

export const wholesalers = mockWholesalers;
