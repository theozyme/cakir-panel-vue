import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Search, Pencil, Trash2, AlertTriangle, ShoppingCart, History } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { formatTRY, StatusBadge } from "@/components/shared/StatusBadge";
import { useStockStore } from "@/store/stockStore";
import type { StockItem } from "@/types";

export const Route = createFileRoute("/stok/")({
  head: () => ({
    meta: [
      { title: "Stok Yönetimi · Çakır Oto" },
      { name: "description", content: "Multimedya, ekran ve ses sistemi stok takibi." },
      { property: "og:title", content: "Stok Yönetimi" },
      { property: "og:description", content: "Ürün stokları, kritik seviye ve fiyat yönetimi." },
    ],
  }),
  component: StokPage,
});

const tabs = [
  { v: "multimedya", l: "Multimedya" },
  { v: "ekran", l: "Ekran" },
  { v: "ses_sistemi", l: "Ses Sistemi" },
] as const;

function StokPage() {
  const { stock } = useStockStore();
  const [tab, setTab] = useState<StockItem["kategori"]>("multimedya");
  const [q, setQ] = useState("");
  const [kritikOnly, setKritikOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const items = stock
    .filter((s) => s.kategori === tab)
    .filter((s) => s.urun.toLowerCase().includes(q.toLowerCase()) || s.kod.toLowerCase().includes(q.toLowerCase()))
    .filter((s) => (kritikOnly ? s.adet <= s.kritikSeviye : true));

  return (
    <AppLayout title="Stok Yönetimi">
      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          to="/stok/siparis-ver"
          search={{ tur: tab }}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90"
        >
          <ShoppingCart className="h-4 w-4" /> Sipariş Ver
        </Link>
        <Link
          to="/stok/siparisler"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-input bg-card px-4 text-sm font-semibold hover:bg-accent"
        >
          <History className="h-4 w-4" /> Geçmiş Siparişler
        </Link>
      </div>

      <div className="card-elevated p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              className={`h-9 rounded-lg px-4 text-sm font-semibold transition-colors ${
                tab === t.v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {t.l}
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ürün veya kod ara..."
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm">
            <input type="checkbox" checked={kritikOnly} onChange={(e) => setKritikOnly(e.target.checked)} className="accent-primary" />
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Sadece kritik stok
          </label>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Yeni Stok
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Ürün</th>
                <th className="px-4 py-3 text-left font-semibold">Kod / Model</th>
                <th className="px-4 py-3 text-left font-semibold">Marka</th>
                <th className="px-4 py-3 text-right font-semibold">Alış</th>
                <th className="px-4 py-3 text-right font-semibold">Satış</th>
                <th className="px-4 py-3 text-center font-semibold">Adet</th>
                <th className="px-4 py-3 text-left font-semibold">Raf</th>
                <th className="px-4 py-3 text-left font-semibold">Durum</th>
                <th className="px-4 py-3 text-right font-semibold">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => {
                const kritik = s.adet <= s.kritikSeviye;
                const tukendi = s.adet === 0;
                return (
                  <tr key={s.id} className="border-t border-border/60 hover:bg-muted/30">
                    <td className="px-4 py-3 font-semibold">{s.urun}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.kod}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.marka}</td>
                    <td className="px-4 py-3 text-right">{formatTRY(s.alisFiyati)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatTRY(s.satisFiyati)}</td>
                    <td className="px-4 py-3 text-center font-bold">{s.adet}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.raf}</td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={tukendi ? "destructive" : kritik ? "warning" : "success"}>
                        {tukendi ? "Tükendi" : kritik ? "Kritik" : "Yeterli"}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button className="grid h-8 w-8 place-items-center rounded-lg border border-input text-muted-foreground hover:text-primary">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button className="grid h-8 w-8 place-items-center rounded-lg border border-input text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">Kayıt bulunamadı</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setShowModal(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-bold">Yeni Stok Ekle</h2>
            <div className="grid gap-3">
              <input placeholder="Ürün adı" className="h-10 rounded-lg border border-input bg-background px-3 text-sm" />
              <input placeholder="Kod / Model" className="h-10 rounded-lg border border-input bg-background px-3 text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="Alış fiyatı" className="h-10 rounded-lg border border-input bg-background px-3 text-sm" />
                <input type="number" placeholder="Satış fiyatı" className="h-10 rounded-lg border border-input bg-background px-3 text-sm" />
                <input type="number" placeholder="Adet" className="h-10 rounded-lg border border-input bg-background px-3 text-sm" />
                <input placeholder="Raf" className="h-10 rounded-lg border border-input bg-background px-3 text-sm" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="h-10 rounded-lg border border-input px-4 text-sm font-semibold">İptal</button>
              <button onClick={() => setShowModal(false)} className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground">Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
