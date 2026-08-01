import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { formatTRY, StatusBadge } from "@/components/shared/StatusBadge";
import { useAudioStore } from "@/store/audioStore";
import { saleTypeLabels } from "@/types/audio";

export const Route = createFileRoute("/ses-sistemi/teklif-gecmisi")({
  head: () => ({
    meta: [
      { title: "Teklif Geçmişi · Ses Sistemi · Çakır Oto" },
      { name: "description", content: "Oluşturulan ses sistemi tekliflerinin geçmişi." },
      { property: "og:title", content: "Teklif Geçmişi" },
      { property: "og:description", content: "Ses sistemi teklif kayıtları ve kâr özetleri." },
    ],
  }),
  component: TeklifGecmisi,
});

function TeklifGecmisi() {
  const { quotes } = useAudioStore();

  return (
    <AppLayout title="Ses Sistemi · Teklif Geçmişi">
      <Link
        to="/ses-sistemi"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Ses Sistemi
      </Link>

      <div className="card-elevated overflow-hidden">
        <div className="p-5 pb-3">
          <h2 className="text-base font-bold">Teklif Geçmişi</h2>
          <p className="text-xs text-muted-foreground">{quotes.length} kayıt</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Teklif No</th>
                <th className="px-4 py-3 text-left font-semibold">Tarih</th>
                <th className="px-4 py-3 text-left font-semibold">Müşteri</th>
                <th className="px-4 py-3 text-left font-semibold">Satış Tipi</th>
                <th className="px-4 py-3 text-right font-semibold">Ürün</th>
                <th className="px-4 py-3 text-right font-semibold">Tutar</th>
                <th className="px-4 py-3 text-right font-semibold">Tahmini Kâr</th>
                <th className="px-4 py-3 text-left font-semibold">Durum</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} className="border-t border-border/60">
                  <td className="px-4 py-3 font-semibold">{q.no}</td>
                  <td className="px-4 py-3 text-muted-foreground">{q.tarih}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{q.musteri}</div>
                    {q.plaka && <div className="text-xs text-muted-foreground">{q.plaka}</div>}
                  </td>
                  <td className="px-4 py-3">{saleTypeLabels[q.satisTipi]}</td>
                  <td className="px-4 py-3 text-right">{q.kalemler.length}</td>
                  <td className="px-4 py-3 text-right font-bold">{formatTRY(q.nihaiTutar)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-success">
                    {formatTRY(q.tahminiKar)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={q.durum === "onaylandi" ? "success" : "warning"}>
                      {q.durum === "onaylandi" ? "Onaylandı" : "Beklemede"}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
              {quotes.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    Henüz teklif yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
