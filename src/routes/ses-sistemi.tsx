import { createFileRoute } from "@tanstack/react-router";
import { Speaker, Volume2, Music4 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { formatTRY, StatusBadge } from "@/components/shared/StatusBadge";
import { mockOperations } from "@/data/mock";

export const Route = createFileRoute("/ses-sistemi")({
  head: () => ({
    meta: [
      { title: "Ses Sistemi · Çakır Oto" },
      { name: "description", content: "Ses sistemi teklifleri ve kurulumları." },
      { property: "og:title", content: "Ses Sistemi" },
      { property: "og:description", content: "Ses sistemi teklif ve kurulum takibi." },
    ],
  }),
  component: SesSistemi,
});

function SesSistemi() {
  const items = mockOperations.filter((o) => o.islemTuru === "ses_sistemi");

  return (
    <AppLayout title="Ses Sistemi">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-elevated p-5">
          <div className="mb-2 flex items-center gap-2 text-primary"><Speaker className="h-5 w-5" /><span className="text-sm font-bold">Aktif Teklif</span></div>
          <div className="text-3xl font-bold">7</div>
        </div>
        <div className="card-elevated p-5">
          <div className="mb-2 flex items-center gap-2 text-success"><Volume2 className="h-5 w-5" /><span className="text-sm font-bold">Tamamlanan (Ay)</span></div>
          <div className="text-3xl font-bold">14</div>
        </div>
        <div className="card-elevated p-5">
          <div className="mb-2 flex items-center gap-2 text-warning"><Music4 className="h-5 w-5" /><span className="text-sm font-bold">Ortalama Sepet</span></div>
          <div className="text-3xl font-bold">{formatTRY(16800)}</div>
        </div>
      </div>

      <div className="mt-6 card-elevated overflow-hidden">
        <div className="p-5 pb-3"><h2 className="text-base font-bold">Ses Sistemi İşlem Geçmişi</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Plaka</th>
                <th className="px-4 py-3 text-left font-semibold">Müşteri</th>
                <th className="px-4 py-3 text-left font-semibold">Tarih</th>
                <th className="px-4 py-3 text-right font-semibold">Tutar</th>
                <th className="px-4 py-3 text-left font-semibold">Durum</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id} className="border-t border-border/60">
                  <td className="px-4 py-3 font-semibold">{o.plaka}</td>
                  <td className="px-4 py-3">{o.musteri}</td>
                  <td className="px-4 py-3 text-muted-foreground">{o.tarih}</td>
                  <td className="px-4 py-3 text-right font-bold">{formatTRY(o.ucret)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={o.durum === "tamamlandi" ? "success" : "warning"}>
                      {o.durum === "tamamlandi" ? "Tamamlandı" : "Bekliyor"}
                    </StatusBadge>
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
