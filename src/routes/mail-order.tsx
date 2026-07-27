import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/shared/StatCard";
import { formatTRY, formatUSD, StatusBadge } from "@/components/shared/StatusBadge";
import { mockWholesalers, mockMovements } from "@/data/mock";

export const Route = createFileRoute("/mail-order")({
  head: () => ({
    meta: [
      { title: "Mail Order · Çakır Oto" },
      { name: "description", content: "Toptancı borç ve ödeme takibi." },
      { property: "og:title", content: "Mail Order Takip" },
      { property: "og:description", content: "TL ve USD toptancı hesap özetleri." },
    ],
  }),
  component: MailOrder,
});

const monthly = [
  { ay: "Şub", giris: 42000, odeme: 32000 },
  { ay: "Mar", giris: 58000, odeme: 40000 },
  { ay: "Nis", giris: 61000, odeme: 55000 },
  { ay: "May", giris: 72000, odeme: 60000 },
  { ay: "Haz", giris: 85000, odeme: 68000 },
  { ay: "Tem", giris: 91000, odeme: 72000 },
];

function MailOrder() {
  const [selected, setSelected] = useState(mockWholesalers[0].id);
  const active = mockWholesalers.find((w) => w.id === selected)!;
  const movements = mockMovements.filter((m) => m.toptanciId === selected);

  const tryTotals = mockWholesalers.filter((w) => w.paraBirimi === "TRY").reduce(
    (a, w) => ({ giris: a.giris + w.malGirisi, odeme: a.odeme + w.odenen, borc: a.borc + w.kalanBorc }),
    { giris: 0, odeme: 0, borc: 0 },
  );
  const usdTotals = mockWholesalers.filter((w) => w.paraBirimi === "USD").reduce(
    (a, w) => ({ giris: a.giris + w.malGirisi, odeme: a.odeme + w.odenen, borc: a.borc + w.kalanBorc }),
    { giris: 0, odeme: 0, borc: 0 },
  );

  return (
    <AppLayout title="Mail Order">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card-elevated p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">TRY</span>
            <h2 className="text-base font-bold">TL Firmaları Özeti</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Mal Girişi" value={formatTRY(tryTotals.giris)} icon={<TrendingUp className="h-5 w-5" />} tone="primary" />
            <StatCard label="Ödenen" value={formatTRY(tryTotals.odeme)} icon={<Wallet className="h-5 w-5" />} tone="success" />
            <StatCard label="Kalan Borç" value={formatTRY(tryTotals.borc)} icon={<TrendingDown className="h-5 w-5" />} tone="destructive" />
          </div>
        </div>
        <div className="card-elevated p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">USD</span>
            <h2 className="text-base font-bold">USD Firmaları Özeti</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Mal Girişi" value={formatUSD(usdTotals.giris)} icon={<TrendingUp className="h-5 w-5" />} tone="primary" />
            <StatCard label="Ödenen" value={formatUSD(usdTotals.odeme)} icon={<Wallet className="h-5 w-5" />} tone="success" />
            <StatCard label="Kalan Borç" value={formatUSD(usdTotals.borc)} icon={<TrendingDown className="h-5 w-5" />} tone="destructive" />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card-elevated p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold">Firmalar</h2>
            <button className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2">
            {mockWholesalers.map((w) => (
              <button
                key={w.id}
                onClick={() => setSelected(w.id)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  selected === w.id ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="truncate text-sm font-semibold">{w.ad}</div>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold">{w.paraBirimi}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Kalan borç</span>
                  <span className={`font-bold ${w.kalanBorc > 0 ? "text-destructive" : "text-success"}`}>
                    {w.paraBirimi === "TRY" ? formatTRY(w.kalanBorc) : formatUSD(w.kalanBorc)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="card-elevated p-5 lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold">{active.ad} · Hesap Hareketleri</h2>
            <div className="flex gap-2">
              <button className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-success px-3 text-xs font-bold text-success-foreground hover:opacity-90">
                <Plus className="h-3.5 w-3.5" /> Yeni Ödeme
              </button>
              <button className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-destructive px-3 text-xs font-bold text-destructive-foreground hover:opacity-90">
                <Plus className="h-3.5 w-3.5" /> Borç Ekle
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold">Tarih</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Tür</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Açıklama</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-t border-border/60">
                    <td className="px-3 py-2.5 text-muted-foreground">{m.tarih}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge tone={m.tur === "odeme" ? "success" : "destructive"}>
                        {m.tur === "odeme" ? "Ödeme" : "Mal Girişi"}
                      </StatusBadge>
                    </td>
                    <td className="px-3 py-2.5">{m.aciklama}</td>
                    <td className={`px-3 py-2.5 text-right font-bold ${m.tur === "odeme" ? "text-success" : "text-destructive"}`}>
                      {m.tur === "odeme" ? "-" : "+"}{m.paraBirimi === "TRY" ? formatTRY(m.tutar) : formatUSD(m.tutar)}
                    </td>
                  </tr>
                ))}
                {movements.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-sm text-muted-foreground">Hareket yok</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-6 card-elevated p-5">
        <h2 className="mb-4 text-base font-bold">Aylık Mail Order Hareketi</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="ay" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} formatter={(v: number) => formatTRY(v)} />
              <Legend />
              <Bar name="Mal Girişi" dataKey="giris" fill="var(--color-destructive)" radius={[6, 6, 0, 0]} />
              <Bar name="Ödeme" dataKey="odeme" fill="var(--color-success)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </AppLayout>
  );
}
