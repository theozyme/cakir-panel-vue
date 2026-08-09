import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { ArrowLeft } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { apiRequest } from "@/lib/api";
import { formatMoneyString } from "@/lib/money";
import type { SoundOffer } from "@/types/business";

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
  const offersQuery = useQuery({
    queryKey: ["sound-offers"],
    queryFn: () => apiRequest<SoundOffer[]>("/api/sound-offers"),
  });
  const offers = offersQuery.data ?? [];

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
          <p className="text-xs text-muted-foreground">{offers.length} kayıt</p>
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
              {offers.map((offer) => {
                const cost = offer.items.reduce(
                  (total, item) =>
                    item.unitPurchasePriceUsd
                      ? total.plus(
                          new Decimal(item.unitPurchasePriceUsd)
                            .mul(offer.exchangeRate)
                            .mul(item.quantity),
                        )
                      : total,
                  new Decimal(0),
                );
                const profit = new Decimal(offer.finalTotal).minus(cost);

                return (
                  <tr key={offer.id} className="border-t border-border/60">
                    <td className="px-4 py-3 font-semibold">
                      {offer.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(offer.createdAt).toLocaleDateString("tr-TR")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">-</td>
                    <td className="px-4 py-3">
                      {offer.saleType === "CASH" ? "Nakit" : "Kredi Kartı"}
                    </td>
                    <td className="px-4 py-3 text-right">{offer.items.length}</td>
                    <td className="px-4 py-3 text-right font-bold">
                      {formatMoneyString(offer.finalTotal, "TRY")}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-success">
                      {formatMoneyString(profit.toFixed(2), "TRY")}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={offer.status === "USED" ? "success" : "warning"}>
                        {offer.status === "USED" ? "Kullanıldı" : "Onaylandı"}
                      </StatusBadge>
                    </td>
                  </tr>
                );
              })}
              {offersQuery.error instanceof Error && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-destructive">
                    {offersQuery.error.message}
                  </td>
                </tr>
              )}
              {!offersQuery.isLoading && offers.length === 0 && (
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
