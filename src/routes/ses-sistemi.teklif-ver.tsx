import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { formatTRY } from "@/components/shared/StatusBadge";
import { createQuote, nextQuoteNo, useAudioStore } from "@/store/audioStore";
import type { SaleType } from "@/types/audio";

export const Route = createFileRoute("/ses-sistemi/teklif-ver")({
  head: () => ({
    meta: [
      { title: "Teklif Ver · Ses Sistemi · Çakır Oto" },
      { name: "description", content: "Ses sistemi ürünleri için müşteri teklifi oluşturun." },
      { property: "og:title", content: "Teklif Ver" },
      { property: "og:description", content: "Nakit veya kredi kartı fiyatıyla ses sistemi teklifi." },
    ],
  }),
  component: TeklifVer,
});

function TeklifVer() {
  const { products } = useAudioStore();
  const navigate = useNavigate();
  const [satisTipi, setSatisTipi] = useState<SaleType>("nakit");
  const [musteri, setMusteri] = useState("");
  const [plaka, setPlaka] = useState("");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [nihai, setNihai] = useState("");

  const price = (p: (typeof products)[number]) =>
    satisTipi === "nakit" ? p.nakitSatisFiyati : p.kartSatisFiyati;

  const lines = useMemo(
    () =>
      products
        .filter((p) => selected[p.id] !== undefined)
        .map((p) => ({ p, adet: Math.max(1, selected[p.id] ?? 1) })),
    [products, selected],
  );

  const otomatikToplam = lines.reduce((t, l) => t + price(l.p) * l.adet, 0);
  const nihaiTutar = nihai.trim() === "" ? otomatikToplam : Number(nihai) || 0;
  const maliyet = lines.reduce((t, l) => t + l.p.alisFiyati * l.adet, 0);
  const tahminiKar = nihaiTutar - maliyet;

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = { ...s };
      if (next[id] !== undefined) delete next[id];
      else next[id] = 1;
      return next;
    });

  const clear = () => {
    setSelected({});
    setNihai("");
    setMusteri("");
    setPlaka("");
  };

  const confirm = () => {
    if (lines.length === 0) {
      toast.error("En az bir ürün seçin");
      return;
    }
    createQuote({
      id: `q${Date.now()}`,
      no: nextQuoteNo(),
      tarih: new Date().toISOString().slice(0, 10),
      musteri: musteri.trim() || "Bilinmiyor",
      plaka: plaka.trim() || undefined,
      satisTipi,
      kalemler: lines.map((l) => ({
        urunId: l.p.id,
        urun: l.p.urun,
        adet: l.adet,
        birimFiyat: price(l.p),
        alisFiyati: l.p.alisFiyati,
      })),
      otomatikToplam,
      nihaiTutar,
      tahminiKar,
      durum: "onaylandi",
    });
    toast.success("Teklif onaylandı");
    navigate({ to: "/ses-sistemi/teklif-gecmisi" });
  };

  return (
    <AppLayout title="Ses Sistemi · Teklif Ver">
      <Link
        to="/ses-sistemi"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Ses Sistemi
      </Link>

      <div className="card-elevated p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-muted-foreground">Müşteri</span>
            <input
              value={musteri}
              onChange={(e) => setMusteri(e.target.value)}
              placeholder="Ad Soyad"
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-muted-foreground">Plaka</span>
            <input
              value={plaka}
              onChange={(e) => setPlaka(e.target.value)}
              placeholder="34 ABC 123"
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <div className="text-sm">
            <span className="mb-1 block font-medium text-muted-foreground">Satış Tipi</span>
            <div className="flex gap-2">
              {(["nakit", "kredi_karti"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSatisTipi(t)}
                  className={`h-9 flex-1 rounded-lg border text-sm font-semibold transition-colors ${
                    satisTipi === t
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "nakit" ? "Nakit" : "Kredi Kartı"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 card-elevated overflow-hidden">
        <div className="p-5 pb-3">
          <h2 className="text-base font-bold">Ürün Seçimi</h2>
          <p className="text-xs text-muted-foreground">
            Teklif, seçilen satış tipine göre {satisTipi === "nakit" ? "nakit" : "kredi kartı"} fiyatı ile hesaplanır.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Seç</th>
                <th className="px-4 py-3 text-left font-semibold">Ürün Adı</th>
                <th className="px-4 py-3 text-right font-semibold">Mevcut Stok</th>
                <th className="px-4 py-3 text-right font-semibold">Alış Fiyatı</th>
                <th className="px-4 py-3 text-right font-semibold">Nakit Satış</th>
                <th className="px-4 py-3 text-right font-semibold">Kredi Kartı Satış</th>
                <th className="px-4 py-3 text-right font-semibold">Adet</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const checked = selected[p.id] !== undefined;
                return (
                  <tr key={p.id} className={`border-t border-border/60 ${checked ? "bg-primary/5" : ""}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(p.id)}
                        className="h-4 w-4 accent-primary"
                        aria-label={`${p.urun} seç`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{p.urun}</div>
                      <div className="text-xs text-muted-foreground">{p.marka}</div>
                    </td>
                    <td className="px-4 py-3 text-right">{p.adet}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{formatTRY(p.alisFiyati)}</td>
                    <td className={`px-4 py-3 text-right ${satisTipi === "nakit" ? "font-bold text-primary" : ""}`}>
                      {formatTRY(p.nakitSatisFiyati)}
                    </td>
                    <td className={`px-4 py-3 text-right ${satisTipi === "kredi_karti" ? "font-bold text-primary" : ""}`}>
                      {formatTRY(p.kartSatisFiyati)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min={1}
                        disabled={!checked}
                        value={checked ? selected[p.id] : ""}
                        onChange={(e) =>
                          setSelected((s) => ({ ...s, [p.id]: Math.max(1, Number(e.target.value) || 1) }))
                        }
                        className="h-9 w-20 rounded-lg border border-input bg-background px-2 text-right text-sm outline-none focus:border-primary disabled:opacity-40"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 card-elevated p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">Seçilen Ürün</div>
            <div className="mt-1 text-2xl font-bold">{lines.length}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">Otomatik Toplam</div>
            <div className="mt-1 text-2xl font-bold">{formatTRY(otomatikToplam)}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">Nihai Teklif Tutarı</div>
            <input
              type="number"
              value={nihai}
              onChange={(e) => setNihai(e.target.value)}
              placeholder={String(otomatikToplam)}
              className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-lg font-bold outline-none focus:border-primary"
            />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">Tahmini Kâr</div>
            <div className={`mt-1 text-2xl font-bold ${tahminiKar >= 0 ? "text-success" : "text-destructive"}`}>
              {formatTRY(tahminiKar)}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Link
            to="/ses-sistemi"
            className="inline-flex h-9 items-center rounded-lg border border-input bg-background px-4 text-sm font-semibold hover:bg-accent"
          >
            İptal
          </Link>
          <button
            onClick={clear}
            className="h-9 rounded-lg border border-input bg-background px-4 text-sm font-semibold hover:bg-accent"
          >
            Temizle
          </button>
          <button
            onClick={confirm}
            className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Teklifi Onayla
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
