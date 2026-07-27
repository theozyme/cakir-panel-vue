import { createFileRoute } from "@tanstack/react-router";
import { Wrench, Clock, CheckCircle2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { formatTRY, StatusBadge } from "@/components/shared/StatusBadge";
import { mockOperations } from "@/data/mock";

export const Route = createFileRoute("/servis")({
  head: () => ({
    meta: [
      { title: "Servis · Çakır Oto" },
      { name: "description", content: "Servisteki araçlar ve iş takibi." },
      { property: "og:title", content: "Servis Takibi" },
      { property: "og:description", content: "Servis işlemleri ve durum takibi." },
    ],
  }),
  component: ServisPage,
});

function ServisPage() {
  const items = mockOperations.filter((o) => o.islemTuru === "servis");
  return (
    <AppLayout title="Servis">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-elevated p-5">
          <div className="mb-2 flex items-center gap-2 text-warning"><Clock className="h-5 w-5" /><span className="text-sm font-bold">Serviste</span></div>
          <div className="text-3xl font-bold">3</div>
        </div>
        <div className="card-elevated p-5">
          <div className="mb-2 flex items-center gap-2 text-success"><CheckCircle2 className="h-5 w-5" /><span className="text-sm font-bold">Bugün Teslim</span></div>
          <div className="text-3xl font-bold">2</div>
        </div>
        <div className="card-elevated p-5">
          <div className="mb-2 flex items-center gap-2 text-primary"><Wrench className="h-5 w-5" /><span className="text-sm font-bold">Aylık Servis Geliri</span></div>
          <div className="text-3xl font-bold">{formatTRY(48200)}</div>
        </div>
      </div>

      <div className="mt-6 card-elevated overflow-hidden">
        <div className="p-5 pb-3"><h2 className="text-base font-bold">Servis Kayıtları</h2></div>
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
                      {o.durum === "tamamlandi" ? "Tamamlandı" : "Serviste"}
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
