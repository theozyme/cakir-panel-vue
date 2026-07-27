import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Clock,
  Car,
  ListChecks,
  TrendingUp,
  AlertCircle,
  Wrench,
  PackageX,
  Plus,
  ArrowRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge, formatTRY } from "@/components/shared/StatusBadge";
import { mockOperations, mockVehicles, mockStock, dailyEarnings } from "@/data/mock";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ana Sayfa · Çakır Oto Yönetim Paneli" },
      { name: "description", content: "Günlük araç işlemleri, kazanç ve stok özet paneli." },
      { property: "og:title", content: "Çakır Oto Yönetim Paneli" },
      { property: "og:description", content: "Araç, stok ve finans yönetim panosu." },
    ],
  }),
  component: Dashboard,
});

const paymentDistribution = [
  { name: "Nakit", value: 32000, color: "var(--color-chart-2)" },
  { name: "Kredi Kartı", value: 58000, color: "var(--color-chart-1)" },
  { name: "Havale", value: 41000, color: "var(--color-chart-5)" },
  { name: "Mail Order", value: 22000, color: "var(--color-chart-3)" },
];

function Dashboard() {
  const [plaka, setPlaka] = useState("");
  const bekleyen = mockVehicles.filter((v) => v.durum === "bekleyen").length;
  const bugun = mockVehicles.filter((v) => v.girisTarihi === "2026-07-27").length;
  const gunlukKazanc = mockOperations
    .filter((o) => o.tarih === "2026-07-27" && o.durum === "tamamlandi")
    .reduce((s, o) => s + o.ucret, 0);
  const acikAlacak = 78500;
  const servisteki = 3;
  const kritikStok = mockStock.filter((s) => s.adet <= s.kritikSeviye).length;

  return (
    <AppLayout title="Ana Sayfa">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Bekleyen Araç" value={bekleyen} icon={<Clock className="h-5 w-5" />} tone="warning" />
        <StatCard label="Bugün Gelen Araç" value={bugun} icon={<Car className="h-5 w-5" />} tone="primary" />
        <StatCard label="Toplam İşlem" value={mockOperations.length} icon={<ListChecks className="h-5 w-5" />} />
        <StatCard label="Günlük Kazanç" value={formatTRY(gunlukKazanc)} icon={<TrendingUp className="h-5 w-5" />} tone="success" />
        <StatCard label="Açık Alacak" value={formatTRY(acikAlacak)} icon={<AlertCircle className="h-5 w-5" />} tone="destructive" />
        <StatCard label="Servisteki Araç" value={servisteki} icon={<Wrench className="h-5 w-5" />} tone="primary" />
        <StatCard label="Kritik Stok" value={kritikStok} icon={<PackageX className="h-5 w-5" />} tone="destructive" hint="Stoğu eşik altında" />
        <div className="card-elevated flex flex-col justify-between p-5">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hızlı Araç Ekle</div>
            <div className="mt-2 text-sm text-foreground">Plaka girip hemen kayıt açın.</div>
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={plaka}
              onChange={(e) => setPlaka(e.target.value.toUpperCase())}
              placeholder="34 ABC 123"
              className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
            <Link
              to="/araclar/yeni"
              className="inline-flex h-10 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Ekle
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <div className="card-elevated p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold">Günlük Kazanç</h2>
            <span className="text-xs text-muted-foreground">Son 7 gün</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyEarnings}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="gun" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }}
                  formatter={(v: number) => formatTRY(v)}
                />
                <Bar dataKey="kazanc" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-elevated p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold">Ödeme Dağılımı</h2>
            <span className="text-xs text-muted-foreground">Bu ay</span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentDistribution} dataKey="value" innerRadius={45} outerRadius={75} paddingAngle={3}>
                  {paymentDistribution.map((p, i) => (
                    <Cell key={i} fill={p.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatTRY(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1.5">
            {paymentDistribution.map((p) => (
              <div key={p.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                  {p.name}
                </span>
                <span className="font-semibold">{formatTRY(p.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="card-elevated p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold">Bekleyen Araçlar</h2>
            <Link to="/araclar" className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
              Tümü <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {mockVehicles.filter((v) => v.durum === "bekleyen").map((v) => (
              <div key={v.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/50 p-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-warning/20 text-warning">
                  <Car className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{v.plaka}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {v.musteriAd} {v.musteriSoyad} · {v.marka} {v.model}
                  </div>
                </div>
                <StatusBadge tone="warning">Bekliyor</StatusBadge>
              </div>
            ))}
          </div>
        </div>

        <div className="card-elevated overflow-hidden">
          <div className="flex items-center justify-between p-5 pb-3">
            <h2 className="text-base font-bold">Son İşlemler</h2>
            <Link to="/araclar" className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
              Tümü <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Plaka</th>
                  <th className="px-4 py-2.5 text-left font-semibold">İşlem</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Ücret</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Durum</th>
                </tr>
              </thead>
              <tbody>
                {mockOperations.slice(0, 6).map((o) => (
                  <tr key={o.id} className="border-t border-border/60">
                    <td className="px-4 py-2.5 font-semibold">{o.plaka}</td>
                    <td className="px-4 py-2.5 capitalize text-muted-foreground">{o.islemTuru.replace("_", " ")}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{formatTRY(o.ucret)}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge tone={o.durum === "tamamlandi" ? "success" : o.durum === "bekleyen" ? "warning" : "destructive"}>
                        {o.durum === "tamamlandi" ? "Tamamlandı" : o.durum === "bekleyen" ? "Bekliyor" : "İptal"}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
