import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { mockStock, mockWholesalers } from "@/data/mock";
import { formatTRY } from "@/components/shared/StatusBadge";

export const Route = createFileRoute("/araclar/yeni")({
  head: () => ({
    meta: [
      { title: "Yeni Araç İşlemi · Çakır Oto" },
      { name: "description", content: "Yeni araç işlemi kaydı oluşturun." },
      { property: "og:title", content: "Yeni Araç İşlemi" },
      { property: "og:description", content: "Araç ve işlem bilgilerini girin." },
    ],
  }),
  component: YeniIslem,
});

const islemTurleri = [
  { v: "multimedya", l: "Multimedya" },
  { v: "ses_sistemi", l: "Ses Sistemi" },
  { v: "mail_order", l: "Mail Order" },
  { v: "servis", l: "Servis" },
  { v: "aksesuar", l: "Aksesuar" },
  { v: "diger", l: "Diğer" },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary";

function YeniIslem() {
  const navigate = useNavigate();
  const [islemTuru, setIslemTuru] = useState("multimedya");
  const multimedyaStock = mockStock.filter((s) => s.kategori === "multimedya");

  return (
    <AppLayout title="Yeni Araç İşlemi">
      <div className="mb-4 flex items-center gap-3">
        <Link to="/araclar" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-sm font-semibold hover:bg-muted">
          <ArrowLeft className="h-4 w-4" /> Geri
        </Link>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ to: "/araclar" });
        }}
        className="grid gap-4 lg:grid-cols-3"
      >
        <div className="card-elevated space-y-4 p-6 lg:col-span-2">
          <h2 className="text-base font-bold">Araç ve Müşteri Bilgileri</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Plaka"><input required className={inputCls} placeholder="34 ABC 123" /></Field>
            <Field label="Telefon"><input className={inputCls} placeholder="0532 000 00 00" /></Field>
            <Field label="Ad"><input required className={inputCls} /></Field>
            <Field label="Soyad"><input required className={inputCls} /></Field>
            <Field label="Araç Markası"><input className={inputCls} placeholder="Renault" /></Field>
            <Field label="Model"><input className={inputCls} placeholder="Clio" /></Field>
          </div>

          <hr className="border-border/60" />

          <h2 className="text-base font-bold">İşlem Detayı</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="İşlem Türü">
              <select value={islemTuru} onChange={(e) => setIslemTuru(e.target.value)} className={inputCls}>
                {islemTurleri.map((t) => (
                  <option key={t.v} value={t.v}>{t.l}</option>
                ))}
              </select>
            </Field>
            <Field label="Ücret (₺)"><input type="number" className={inputCls} placeholder="0" /></Field>
            <Field label="Tarih"><input type="date" defaultValue="2026-07-27" className={inputCls} /></Field>
            <Field label="Ödeme Türü">
              <select className={inputCls}>
                <option value="nakit">Nakit</option>
                <option value="kart">Kredi Kartı</option>
                <option value="havale">Havale</option>
                <option value="mail_order">Mail Order</option>
              </select>
            </Field>
          </div>

          {islemTuru === "multimedya" && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="mb-2 text-sm font-bold text-primary">Multimedya Stok Seçimi</div>
              <select className={inputCls}>
                <option value="">Stoktan seç...</option>
                {multimedyaStock.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.urun} — {s.kod} · Stok: {s.adet} · {formatTRY(s.satisFiyati)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {islemTuru === "ses_sistemi" && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-4">
              <div className="mb-2 text-sm font-bold text-warning">Son Ses Sistemi Teklifleri</div>
              <ul className="space-y-1 text-sm">
                <li className="flex justify-between"><span>34 PQR 901 — Focal + Sub</span><span className="font-semibold">{formatTRY(18500)}</span></li>
                <li className="flex justify-between"><span>06 XYZ 456 — Full Set</span><span className="font-semibold">{formatTRY(15200)}</span></li>
                <li className="flex justify-between"><span>34 MNO 678 — Hoparlör Değişim</span><span className="font-semibold">{formatTRY(6400)}</span></li>
              </ul>
            </div>
          )}

          {islemTuru === "mail_order" && (
            <div className="rounded-xl border border-chart-3/40 bg-accent p-4">
              <div className="mb-2 text-sm font-bold">Toptancı Seçimi</div>
              <select className={inputCls}>
                <option value="">Toptancı seç...</option>
                {mockWholesalers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.ad} ({w.paraBirimi}) · Kalan: {w.paraBirimi === "TRY" ? formatTRY(w.kalanBorc) : `$${w.kalanBorc}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Field label="Not">
            <textarea rows={3} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </Field>
        </div>

        <div className="card-elevated h-fit space-y-4 p-6">
          <h2 className="text-base font-bold">Özet</h2>
          <p className="text-sm text-muted-foreground">
            Kayıt oluşturmadan önce bilgileri kontrol edin. Bu form Faz 1 için tasarımdır; kaydetme mock davranışı ile araç listesine döner.
          </p>
          <button type="submit" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-primary-foreground hover:opacity-90">
            <Save className="h-4 w-4" /> Kaydet
          </button>
          <Link to="/araclar" className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-input text-sm font-semibold hover:bg-muted">
            İptal
          </Link>
        </div>
      </form>
    </AppLayout>
  );
}
