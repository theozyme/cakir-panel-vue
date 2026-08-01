# Oto Yönetim Paneli

React + TypeScript, Tailwind CSS ve shadcn/ui kullanarak modern bir Çakır Oto Yönetim Paneli tasarla.

Bu sadece Faz 1 frontend UI çalışmasıdır. Backend, veritabanı ve gerçek API entegrasyonu yapma. Mock data kullan. Gelecekte PostgreSQL ve Node.js REST API bağlanacak şekilde temiz ve modüler bir yapı kur.

Tasarım:

 Türkçe arayüz

 Masaüstü öncelikli, responsive

 Koyu lacivert navigasyon

 Açık arka plan

 Beyaz, yuvarlak ve hafif gölgeli kartlar

 Ana renk mavi

 Başarılı işlemler yeşil

 Bekleyen işlemler turuncu

 Borç ve silme işlemleri kırmızı

 Lucide ikonları

 Recharts grafikler

Ana menü:

 Ana Sayfa

 Araç İşlemleri

 Mail Order

 Stok Yönetimi

 Ses Sistemi

 Servis

 Özel Ödemeler

 Raporlar

Öncelikle şu ekranları oluştur:

1. Ana Sayfa

Dashboard kartları:

 Bekleyen Araç

 Bugün Gelen Araç

 Toplam İşlem

 Günlük Kazanç

 Açık Alacak

 Servisteki Araç

 Kritik Stok

Ayrıca:

 Plaka ile hızlı araç ekleme

 Bekleyen araçlar

 Son işlemler tablosu

 Nakit, kredi kartı, havale ve Mail Order ödeme dağılımı

 Günlük kazanç grafiği

2. Araç İşlemi Ekle

Alanlar:

 Plaka

 Ad, soyad, telefon

 Araç marka ve model

 İşlem türü

 Ücret

 Tarih

 Ödeme türü

 Not

Dinamik davranışlar:

 Multimedya seçilirse stok seçimi göster.

 Ses Sistemi seçilirse son teklif bilgilerini göster.

 Mail Order seçilirse toptancı seçimi göster.

3. Mail Order

Toptancı borç ve ödeme takip ekranı oluştur.

Göster:

 TL ve USD firma özetleri

 Mal girişi

 Yapılan ödeme

 Kalan borç

 Firma listesi

 Firma detay hareketleri

 Yeni ödeme

 Borç artırma

 Aylık grafik

4. Stok Yönetimi

Sekmeler:

 Multimedya

 Ekran

 Ses Sistemi

Stok tablosunda:

 Ürün

 Kod veya model

 Alış fiyatı

 Satış fiyatı

 Adet

 Raf

 Durum

 Güncelle ve sil işlemleri

Yeni stok ekleme modalı, arama ve kritik stok filtresi ekle.

5. Özel Ödemeler

Sekmeler:

 Personel

 Giderler

 Faturalar

 Krediler

 SGK ve Vergiler

 Yemek

 Özel Alanlar

Aylık ödeme ekleme, kayıt listeleme ve kategori toplamlarını göster.

6. Raporlar

Aylık ve yıllık rapor ekranları oluştur.

Göster:

 Toplam gelir

 Toplam harcama

 Mail Order gideri

 Net durum

 Kategori dağılımı

 Gelir-gider grafiği

 Doughnut harcama grafiği

React Router kullan. Tekrarlanabilir component yapısı kur. TypeScript interface’leri oluştur. Mock verileri ayrı dosyalarda tut. Tüm ekranlar arasında navigasyon çalışsın. Supabase veya Firebase kullanma.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ec7d6d4f-3ae3-4667-962a-b23b93fa4f0f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
