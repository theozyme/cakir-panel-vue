import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { TrendingUp, TrendingDown, Wallet, Mail } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/shared/StatCard";
import { formatTRY } from "@/components/shared/StatusBadge";
import { monthlyRevenue, mockSpecialPayments } from "@/data/mock";

export const Route = createFileRoute("/raporlar")({
  head: () => ({
    meta: [
      { title: "Raporlar · Çakır Oto" },
      { name: "description", content: "Aylık ve yıllık gelir-gider raporları." },
      { property: "og:title", content: "Raporlar" },
      { property: "og:description", content: "Finansal performans ve kategori analizi." },
    ],
  }),
  component: Raporlar,
});

const catColors = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)", "var(--color-primary)", "var(--color-warning)"];

function Raporlar() {
  const [range, setRange] = useState<"ay" | "yil">("ay");

  const totalGelir = monthlyRevenue.reduce((s, m) => s + m.gelir, 0);
  const totalGider = monthlyRevenue.reduce((s, m) => s + m.gider, 0);
  const mailOrderGider = 145000;
  const net = totalGelir - totalGider;

  const categoryMap = new Map<string, number>();
  mockSpecialPayments.forEach((p) => {
    categoryMap.set(p.kategori, (categoryMap.get(p.kategori) ?? 0) + p.tutar);
  });
  const catData = Array.from(categoryMap.entries()).map(([k, v], i) => ({
    name: k, value: v, color: catColors[i % catColors.length],
  }));

  return (
    <AppLayout title="Raporlar">
      <div className="mb-4 inline-flex rounded-lg border border-input bg-card p-1">
        {(["ay", "yil"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`h-9 rounded-md px-4 text-sm font-semibold transition-colors ${
              range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {r === "ay" ? "Aylık" : "Yıllık"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Toplam Gelir" value={formatTRY(totalGelir)} icon={<TrendingUp className="h-5 w-5" />} tone="success" />
        <StatCard label="Toplam Harcama" value={formatTRY(totalGider)} icon={<TrendingDown className="h-5 w-5" />} tone="destructive" />
        <StatCard label="Mail Order Gideri" value={formatTRY(mailOrderGider)} icon={<Mail className="h-5 w-5" />} tone="warning" />
        <StatCard label="Net Durum" value={formatTRY(net)} icon={<Wallet className="h-5 w-5" />} tone="primary" />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <div className="card-elevated p-5 xl:col-span-2">
          <h2 className="mb-4 text-base font-bold">Gelir - Gider Grafiği</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyRevenue}>
                <defs>
                  <linearGradient id="gelir" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-success)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-success)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gider" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-destructive)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-destructive)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="ay" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} formatter={(v: number) => formatTRY(v)} />
                <Legend />
                <Area name="Gelir" type="monotone" dataKey="gelir" stroke="var(--color-success)" fill="url(#gelir)" strokeWidth={2} />
                <Area name="Gider" type="monotone" dataKey="gider" stroke="var(--color-destructive)" fill="url(#gider)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-elevated p-5">
          <h2 className="mb-4 text-base font-bold">Harcama Kategori Dağılımı</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={catData} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {catData.map((c, i) => (<Cell key={i} fill={c.color} />))}
                </Pie>
                <Tooltip formatter={(v: number) => formatTRY(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-1.5">
            {catData.map((c) => (
              <div key={c.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 capitalize">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                  {c.name.replace("_", " ")}
                </span>
                <span className="font-semibold">{formatTRY(c.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
