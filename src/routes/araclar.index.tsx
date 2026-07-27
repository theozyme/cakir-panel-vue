import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Search, Eye } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatusBadge, formatTRY } from "@/components/shared/StatusBadge";
import { mockOperations } from "@/data/mock";

export const Route = createFileRoute("/araclar/")({
  head: () => ({
    meta: [
      { title: "Araç İşlemleri · Çakır Oto" },
      { name: "description", content: "Tüm araç işlemleri, ödemeler ve durum takibi." },
      { property: "og:title", content: "Araç İşlemleri" },
      { property: "og:description", content: "Araç işlem geçmişi ve yönetimi." },
    ],
  }),
  component: AraclarPage,
});

function AraclarPage() {
  const [q, setQ] = useState("");
  const filtered = mockOperations.filter(
    (o) => o.plaka.toLowerCase().includes(q.toLowerCase()) || o.musteri.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <AppLayout title="Araç İşlemleri">
      <div className="card-elevated p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Plaka veya müşteri ara..."
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <Link
            to="/araclar/yeni"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Yeni İşlem
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Plaka</th>
                <th className="px-4 py-3 text-left font-semibold">Müşteri</th>
                <th className="px-4 py-3 text-left font-semibold">İşlem</th>
                <th className="px-4 py-3 text-left font-semibold">Ödeme</th>
                <th className="px-4 py-3 text-left font-semibold">Tarih</th>
                <th className="px-4 py-3 text-right font-semibold">Ücret</th>
                <th className="px-4 py-3 text-left font-semibold">Durum</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-t border-border/60 hover:bg-muted/30">
                  <td className="px-4 py-3 font-semibold">{o.plaka}</td>
                  <td className="px-4 py-3">{o.musteri}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{o.islemTuru.replace("_", " ")}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{o.odemeTuru.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-muted-foreground">{o.tarih}</td>
                  <td className="px-4 py-3 text-right font-bold">{formatTRY(o.ucret)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={o.durum === "tamamlandi" ? "success" : o.durum === "bekleyen" ? "warning" : "destructive"}>
                      {o.durum === "tamamlandi" ? "Tamamlandı" : o.durum === "bekleyen" ? "Bekliyor" : "İptal"}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="grid h-8 w-8 place-items-center rounded-lg border border-input text-muted-foreground hover:text-foreground">
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
