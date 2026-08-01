import type { AudioProduct, Quote } from "@/types/audio";

export const mockAudioProducts: AudioProduct[] = [
  { id: "a1", urun: "Focal Hoparlör Seti 165mm", marka: "Focal", alisFiyati: 5500, nakitSatisFiyati: 8900, kartSatisFiyati: 9600, adet: 6, kritikSeviye: 2 },
  { id: "a2", urun: "Subwoofer 12\"", marka: "JBL", alisFiyati: 3200, nakitSatisFiyati: 5200, kartSatisFiyati: 5600, adet: 3, kritikSeviye: 2 },
  { id: "a3", urun: "Amplifikatör 4 Kanal", marka: "JBL", alisFiyati: 2800, nakitSatisFiyati: 4500, kartSatisFiyati: 4900, adet: 0, kritikSeviye: 2 },
  { id: "a4", urun: "DSP İşlemci 8 Kanal", marka: "Audison", alisFiyati: 7400, nakitSatisFiyati: 11500, kartSatisFiyati: 12400, adet: 4, kritikSeviye: 2 },
  { id: "a5", urun: "Tweeter Seti", marka: "Hertz", alisFiyati: 1100, nakitSatisFiyati: 1950, kartSatisFiyati: 2100, adet: 1, kritikSeviye: 3 },
  { id: "a6", urun: "Ses Yalıtım Kiti", marka: "STP", alisFiyati: 900, nakitSatisFiyati: 1650, kartSatisFiyati: 1800, adet: 14, kritikSeviye: 4 },
  { id: "a7", urun: "Bas Kablo Seti 4GA", marka: "Kicker", alisFiyati: 650, nakitSatisFiyati: 1200, kartSatisFiyati: 1320, adet: 9, kritikSeviye: 4 },
];

export const mockQuotes: Quote[] = [
  {
    id: "q1",
    no: "TKF-2026-0001",
    tarih: "2026-07-24",
    musteri: "Emre Çelik",
    plaka: "34 PQR 901",
    satisTipi: "kredi_karti",
    kalemler: [
      { urunId: "a1", urun: "Focal Hoparlör Seti 165mm", adet: 1, birimFiyat: 9600, alisFiyati: 5500 },
      { urunId: "a2", urun: 'Subwoofer 12"', adet: 1, birimFiyat: 5600, alisFiyati: 3200 },
    ],
    otomatikToplam: 15200,
    nihaiTutar: 15200,
    tahminiKar: 6500,
    durum: "onaylandi",
  },
  {
    id: "q2",
    no: "TKF-2026-0002",
    tarih: "2026-07-26",
    musteri: "Mehmet Kaya",
    plaka: "06 XYZ 456",
    satisTipi: "nakit",
    kalemler: [
      { urunId: "a4", urun: "DSP İşlemci 8 Kanal", adet: 1, birimFiyat: 11500, alisFiyati: 7400 },
    ],
    otomatikToplam: 11500,
    nihaiTutar: 11000,
    tahminiKar: 3600,
    durum: "beklemede",
  },
];
