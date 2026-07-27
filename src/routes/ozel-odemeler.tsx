import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { formatTRY } from "@/components/shared/StatusBadge";
import { mockSpecialPayments } from "@/data/mock";
import type { PaymentCategory } from "@/types";

export const Route = createFileRoute("/ozel-odemeler")({
  head: () => ({
    meta: [
      { title: "Özel Ödemeler · Çakır Oto" },
      { name: "description", content: "Personel, fatura, kredi, SGK ve gider takibi." },
      { property: "og:title", content: "Özel Ödemeler" },
      { property: "og:description", content: "Aylık ödeme kayıt ve toplamları." },
    ],
  }),
  component: OzelOdemeler,
});

const tabs: { v: PaymentCategory; l: string }[] = [
  { v: "personel", l: "Personel" },
  { v: "gider", l: "Giderler" },
  { v: "fatura", l: "Faturalar" },
  { v: "kredi", l: "Krediler" },
  { v: "sgk_vergi", l: "SGK & Vergiler" },
  { v: "yemek", l: "Yemek" },
  { v: "ozel", l: "Özel Alanlar" },
];

function OzelOdemeler() {
  const [tab, setTab] = useState<PaymentCategory>("personel");
  const items = mockSpecialPayments.filter((p) => p.kategori === tab);
  const total = items.reduce((s, i) => s + i.tutar, 0);
  const categoryTotals = tabs.map((t) => ({
    ...t,
    total: mockSpecialPayments.filter((p) => p.kategori === t.v).reduce((s, i) => s + i.tutar, 0),
  }));

  return (
    <AppLayout title="Özel Ödemeler">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
        {categoryTotals.map((c) => (
          <button
            key={c.v}
            onClick={() => setTab(c.v)}
            className={`card-elevated p-4 text-left transition-all ${tab === c.v ? "ring-2 ring-primary" : ""}`}
          >
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{c.l}</div>
            <div className="mt-1.5 text-lg font-bold">{formatTRY(c.total)}</div>
          </button>
        ))}
      </div>

      <div className="mt-6 card-elevated p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">{tabs.find((t) => t.v === tab)?.l}</h2>
            <div className="mt-1 text-sm text-muted-foreground">Toplam: <span className="font-bold text-foreground">{formatTRY(total)}</span></div>
          </div>
          <button className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
            <Plus className="h-4 w-4" /> Aylık Ödeme Ekle
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Başlık</th>
                <th className="px-4 py-3 text-left font-semibold">Tarih</th>
                <th className="px-4 py-3 text-right font-semibold">Tutar</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t border-border/60">
                  <td className="px-4 py-3 font-semibold">{p.baslik}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.tarih}</td>
                  <td className="px-4 py-3 text-right font-bold text-destructive">-{formatTRY(p.tutar)}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="grid h-8 w-8 place-items-center rounded-lg border border-input text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">Kayıt yok</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
