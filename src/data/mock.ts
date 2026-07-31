import type {
  Vehicle,
  Operation,
  StockItem,
  Wholesaler,
  WholesalerMovement,
  SpecialPayment,
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

export const mockStock: StockItem[] = [
  { id: "s1", kategori: "multimedya", urun: "Android Multimedya 10\"", kod: "MM-10-AND", marka: "Teyes", tedarikci: "Elektronik A.Ş.", alisFiyati: 4500, sonAlisFiyati: 4650, satisFiyati: 7500, adet: 8, raf: "A-1", kritikSeviye: 3 },
  { id: "s2", kategori: "multimedya", urun: "Android Multimedya 9\"", kod: "MM-09-AND", marka: "Teyes", tedarikci: "Elektronik A.Ş.", alisFiyati: 3800, sonAlisFiyati: 3900, satisFiyati: 6500, adet: 2, raf: "A-2", kritikSeviye: 3 },
  { id: "s3", kategori: "multimedya", urun: "CarPlay Modülü", kod: "MM-CP-01", marka: "Ottocast", tedarikci: "Anadolu Oto Elektronik", alisFiyati: 1200, sonAlisFiyati: 1250, satisFiyati: 2200, adet: 12, raf: "A-3", kritikSeviye: 5 },
  { id: "s4", kategori: "ekran", urun: "Arka Koltuk Ekranı 10\"", kod: "EK-10-BAK", marka: "Pioneer", tedarikci: "Global Import Co.", alisFiyati: 2200, sonAlisFiyati: 2300, satisFiyati: 3800, adet: 4, raf: "B-1", kritikSeviye: 2 },
  { id: "s5", kategori: "ekran", urun: "Dokunmatik Ekran 7\"", kod: "EK-07-DK", marka: "Kenwood", tedarikci: "Global Import Co.", alisFiyati: 900, sonAlisFiyati: 950, satisFiyati: 1650, adet: 1, raf: "B-2", kritikSeviye: 3 },
  { id: "s6", kategori: "ses_sistemi", urun: "Focal Hoparlör Seti", kod: "SS-FOC-01", marka: "Focal", tedarikci: "Focal Türkiye", alisFiyati: 5500, sonAlisFiyati: 5700, satisFiyati: 9200, adet: 6, raf: "C-1", kritikSeviye: 2 },
  { id: "s7", kategori: "ses_sistemi", urun: "Subwoofer 12\"", kod: "SS-SUB-12", marka: "JBL", tedarikci: "Mega Ses Ltd.", alisFiyati: 3200, sonAlisFiyati: 3350, satisFiyati: 5400, adet: 3, raf: "C-2", kritikSeviye: 2 },
  { id: "s8", kategori: "ses_sistemi", urun: "Amplifikatör 4 Kanal", kod: "SS-AMP-4K", marka: "JBL", tedarikci: "Mega Ses Ltd.", alisFiyati: 2800, sonAlisFiyati: 2900, satisFiyati: 4700, adet: 0, raf: "C-3", kritikSeviye: 2 },
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

export const mockSpecialPayments: SpecialPayment[] = [
  { id: "p1", kategori: "personel", baslik: "Usta Hasan - Maaş", tutar: 32000, tarih: "2026-07-01" },
  { id: "p2", kategori: "personel", baslik: "Çırak Mehmet - Maaş", tutar: 18000, tarih: "2026-07-01" },
  { id: "p3", kategori: "fatura", baslik: "Elektrik", tutar: 4200, tarih: "2026-07-15" },
  { id: "p4", kategori: "fatura", baslik: "Su", tutar: 850, tarih: "2026-07-15" },
  { id: "p5", kategori: "fatura", baslik: "İnternet", tutar: 1100, tarih: "2026-07-10" },
  { id: "p6", kategori: "kredi", baslik: "İşyeri Kredisi", tutar: 12500, tarih: "2026-07-05" },
  { id: "p7", kategori: "sgk_vergi", baslik: "SGK Primleri", tutar: 9800, tarih: "2026-07-25" },
  { id: "p8", kategori: "sgk_vergi", baslik: "KDV", tutar: 15400, tarih: "2026-07-25" },
  { id: "p9", kategori: "yemek", baslik: "Öğle yemekleri", tutar: 3200, tarih: "2026-07-20" },
  { id: "p10", kategori: "gider", baslik: "Temizlik malzemeleri", tutar: 680, tarih: "2026-07-12" },
  { id: "p11", kategori: "ozel", baslik: "Reklam - sosyal medya", tutar: 2500, tarih: "2026-07-18" },
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

export const monthlyRevenue = [
  { ay: "Oca", gelir: 285000, gider: 165000 },
  { ay: "Şub", gelir: 312000, gider: 178000 },
  { ay: "Mar", gelir: 356000, gider: 192000 },
  { ay: "Nis", gelir: 298000, gider: 172000 },
  { ay: "May", gelir: 402000, gider: 215000 },
  { ay: "Haz", gelir: 445000, gider: 228000 },
  { ay: "Tem", gelir: 468000, gider: 241000 },
];

export const wholesalers = mockWholesalers;
