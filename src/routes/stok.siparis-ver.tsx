import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Minus, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { formatTRY, formatUSD } from "@/components/shared/StatusBadge";
import { createOrder, nextOrderNo, suppliers, useStockStore } from "@/store/stockStore";
import type { StockItem } from "@/types";
import type {
  OrderItem,
  OrderPaymentMethod,
  OrderPaymentStatus,
  PurchaseOrder,
} from "@/types/orders";
import { paymentMethodLabels, paymentStatusLabels } from "@/types/orders";

type Search = { tur?: StockItem["kategori"] };

export const Route = createFileRoute("/stok/siparis-ver")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const tur = search.tur;
    return {
      tur:
        tur === "multimedya" || tur === "ekran" || tur === "ses_sistemi" ? tur : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Sipariş Ver · Stok Yönetimi · Çakır Oto" },
      { name: "description", content: "Tedarikçiye yeni stok siparişi oluşturma ekranı." },
      { property: "og:title", content: "Sipariş Ver" },
      { property: "og:description", content: "Ürün seçimi ve sipariş sepeti ile yeni stok siparişi." },
    ],
  }),
  component: SiparisVerPage,
});

const tabs = [
  { v: "multimedya", l: "Multimedya" },
  { v: "ekran", l: "Ekran" },
  { v: "ses_sistemi", l: "Ses Sistemi" },
] as const;

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) =>
  new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const inputCls =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary";

function SiparisVerPage() {
  const { tur } = Route.useSearch();
  const navigate = useNavigate();
  const { stock } = useStockStore();

  const [tab, setTab] = useState<StockItem["kategori"]>(tur ?? "multimedya");
  const [q, setQ] = useState("");
  const [marka, setMarka] = useState("all");
  const [kritikOnly, setKritikOnly] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [cart, setCart] = useState<OrderItem[]>([]);

  const [tedarikciId, setTedarikciId] = useState("");
  const [paraBirimi, setParaBirimi] = useState<"TRY" | "USD">("TRY");
  const [tarih, setTarih] = useState(today());
  const [teslim, setTeslim] = useState(plusDays(10));
  const [notu, setNotu] = useState("");
  const [odemeDurumu, setOdemeDurumu] = useState<OrderPaymentStatus>("odenmedi");
  const [odemeYontemi, setOdemeYontemi] = useState<OrderPaymentMethod>("havale");
  const [errors, setErrors] = useState<string[]>([]);

  const markalar = useMemo(
    () => Array.from(new Set(stock.filter((s) => s.kategori === tab).map((s) => s.marka))),
    [stock, tab],
  );

  const items = stock
    .filter((s) => s.kategori === tab)
    .filter(
      (s) =>
        s.urun.toLowerCase().includes(q.toLowerCase()) ||
        s.kod.toLowerCase().includes(q.toLowerCase()),
    )
    .filter((s) => (marka === "all" ? true : s.marka === marka))
    .filter((s) => (kritikOnly ? s.adet <= s.kritikSeviye : true));

  const fmt = paraBirimi === "USD" ? formatUSD : formatTRY;
  const genelToplam = cart.reduce((t, k) => t + k.adet * k.birimFiyat, 0);
  const toplamAdet = cart.reduce((t, k) => t + k.adet, 0);

  function addToCart(s: StockItem) {
    const adet = qty[s.id] ?? 1;
    if (!Number.isFinite(adet) || adet < 1) {
      toast.error("Sipariş miktarı en az 1 olmalıdır.");
      return;
    }
    if (adet > 9999) {
      toast.error("Sipariş miktarı çok yüksek (maks. 9999).");
      return;
    }
    setCart((prev) => {
      const found = prev.find((k) => k.stokId === s.id);
      if (found) {
        return prev.map((k) => (k.stokId === s.id ? { ...k, adet: k.adet + adet } : k));
      }
      return [
        ...prev,
        {
          stokId: s.id,
          urun: s.urun,
          kod: s.kod,
          adet,
          birimFiyat: s.sonAlisFiyati,
          teslimEdilen: 0,
        },
      ];
    });
    setQty((p) => ({ ...p, [s.id]: 1 }));
    toast.success(`${s.urun} sepete eklendi.`);
  }

  function validate() {
    const e: string[] = [];
    if (cart.length === 0) e.push("En az bir ürün seçmelisiniz.");
    if (!tedarikciId) e.push("Tedarikçi seçimi zorunludur.");
    if (!tarih) e.push("Sipariş tarihi zorunludur.");
    if (!teslim) e.push("Beklenen teslim tarihi zorunludur.");
    if (tarih && teslim && teslim < tarih)
      e.push("Beklenen teslim tarihi, sipariş tarihinden önce olamaz.");
    if (notu.length > 500) e.push("Sipariş notu 500 karakteri aşamaz.");
    setErrors(e);
    return e.length === 0;
  }

  function build(durum: PurchaseOrder["durum"]): PurchaseOrder {
    const ted = suppliers.find((s) => s.id === tedarikciId)!;
    return {
      id: `so-${Date.now()}`,
      no: nextOrderNo(),
      tarih,
      beklenenTeslim: teslim,
      tedarikciId,
      tedarikciAd: ted.ad,
      stokTuru: tab,
      paraBirimi,
      notu: notu.trim() || undefined,
      odemeDurumu,
      odemeYontemi,
      durum,
      kalemler: cart,
      gecmis: [
        {
          tarih: today(),
          durum,
          aciklama: durum === "taslak" ? "Taslak kaydedildi" : "Sipariş oluşturuldu",
        },
      ],
      odemeler: [],
    };
  }

  function submit(durum: PurchaseOrder["durum"]) {
    if (!validate()) {
      toast.error("Lütfen eksik alanları doldurun.");
      return;
    }
    const order = build(durum);
    createOrder(order);
    toast.success(
      durum === "taslak" ? `${order.no} taslak olarak kaydedildi.` : `${order.no} oluşturuldu.`,
    );
    navigate({ to: "/stok/siparisler" });
  }

  function clearAll() {
    setCart([]);
    setErrors([]);
    setNotu("");
    toast("Sepet temizlendi.");
  }

  return (
    <AppLayout title="Sipariş Ver">
      <div className="mb-4">
        <Link
          to="/stok"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm font-semibold hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Stok Yönetimi
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px]">
        {/* Sol: ürün seçimi */}
        <div className="card-elevated p-5">
          <div className="mb-4 flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button
                key={t.v}
                onClick={() => {
                  setTab(t.v);
                  setMarka("all");
                }}
                className={`h-9 rounded-lg px-4 text-sm font-semibold transition-colors ${
                  tab === t.v
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {t.l}
              </button>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ürün veya kod ara..."
                maxLength={60}
                className={`${inputCls} pl-9`}
              />
            </div>
            <select value={marka} onChange={(e) => setMarka(e.target.value)} className={`${inputCls} w-auto min-w-[150px]`}>
              <option value="all">Tüm markalar</option>
              {markalar.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm">
              <input
                type="checkbox"
                checked={kritikOnly}
                onChange={(e) => setKritikOnly(e.target.checked)}
                className="accent-primary"
              />
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Kritik stok
            </label>
          </div>

          <div className="space-y-3">
            {items.map((s) => {
              const kritik = s.adet <= s.kritikSeviye;
              const val = qty[s.id] ?? 1;
              return (
                <div
                  key={s.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    kritik ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{s.urun}</span>
                        {kritik && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-bold text-destructive">
                            <AlertTriangle className="h-3 w-3" /> Kritik stok
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {s.kod} · {s.marka} · Tedarikçi: {s.tedarikci}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                        <span>
                          Mevcut stok: <b className={kritik ? "text-destructive" : ""}>{s.adet}</b>
                        </span>
                        <span className="text-muted-foreground">Kritik seviye: {s.kritikSeviye}</span>
                        <span>
                          Son alış: <b>{formatTRY(s.sonAlisFiyati)}</b>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex h-10 items-center rounded-lg border border-input bg-background">
                        <button
                          onClick={() => setQty((p) => ({ ...p, [s.id]: Math.max(1, val - 1) }))}
                          className="grid h-full w-9 place-items-center text-muted-foreground hover:text-foreground"
                          aria-label="Azalt"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={9999}
                          value={val}
                          onChange={(e) =>
                            setQty((p) => ({ ...p, [s.id]: Math.max(1, Number(e.target.value) || 1) }))
                          }
                          className="h-full w-14 border-x border-input bg-transparent text-center text-sm outline-none"
                        />
                        <button
                          onClick={() => setQty((p) => ({ ...p, [s.id]: Math.min(9999, val + 1) }))}
                          className="grid h-full w-9 place-items-center text-muted-foreground hover:text-foreground"
                          aria-label="Artır"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <button
                        onClick={() => addToCart(s)}
                        className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
                      >
                        <ShoppingCart className="h-4 w-4" /> Sepete ekle
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {items.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">Ürün bulunamadı</div>
            )}
          </div>
        </div>

        {/* Sağ: sipariş özeti */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="card-elevated p-5">
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
              <ShoppingCart className="h-4 w-4 text-primary" /> Sipariş Özeti
            </h2>

            <div className="mb-3 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/60 p-3">
                <div className="text-[11px] text-muted-foreground">Ürün çeşidi</div>
                <div className="text-lg font-bold">{cart.length}</div>
              </div>
              <div className="rounded-lg bg-muted/60 p-3">
                <div className="text-[11px] text-muted-foreground">Toplam adet</div>
                <div className="text-lg font-bold">{toplamAdet}</div>
              </div>
            </div>

            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {cart.map((k) => (
                <div key={k.stokId} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{k.urun}</div>
                      <div className="text-[11px] text-muted-foreground">{k.kod}</div>
                    </div>
                    <button
                      onClick={() => setCart((p) => p.filter((x) => x.stokId !== k.stokId))}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Kaldır"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={k.adet}
                        onChange={(e) =>
                          setCart((p) =>
                            p.map((x) =>
                              x.stokId === k.stokId
                                ? { ...x, adet: Math.max(1, Number(e.target.value) || 1) }
                                : x,
                            ),
                          )
                        }
                        className="h-8 w-16 rounded-md border border-input bg-background px-2 text-center outline-none focus:border-primary"
                      />
                      <span className="text-muted-foreground">× {fmt(k.birimFiyat)}</span>
                    </div>
                    <b>{fmt(k.adet * k.birimFiyat)}</b>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <div className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
                  Sepet boş — soldan ürün ekleyin
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-semibold">Genel Toplam</span>
              <span className="text-xl font-black text-primary">{fmt(genelToplam)}</span>
            </div>

            <div className="mt-4 grid gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Tedarikçi *</label>
                <select
                  value={tedarikciId}
                  onChange={(e) => {
                    setTedarikciId(e.target.value);
                    const s = suppliers.find((x) => x.id === e.target.value);
                    if (s) setParaBirimi(s.paraBirimi);
                  }}
                  className={inputCls}
                >
                  <option value="">Seçiniz</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.ad}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Para birimi</label>
                <div className="flex gap-2">
                  {(["TRY", "USD"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setParaBirimi(c)}
                      className={`h-10 flex-1 rounded-lg text-sm font-semibold transition-colors ${
                        paraBirimi === c
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {c === "TRY" ? "TL" : "USD"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">Sipariş tarihi *</label>
                  <input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">Beklenen teslim *</label>
                  <input type="date" value={teslim} onChange={(e) => setTeslim(e.target.value)} className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">Ödeme durumu</label>
                  <select
                    value={odemeDurumu}
                    onChange={(e) => setOdemeDurumu(e.target.value as OrderPaymentStatus)}
                    className={inputCls}
                  >
                    {(Object.keys(paymentStatusLabels) as OrderPaymentStatus[]).map((k) => (
                      <option key={k} value={k}>
                        {paymentStatusLabels[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">Ödeme yöntemi</label>
                  <select
                    value={odemeYontemi}
                    onChange={(e) => setOdemeYontemi(e.target.value as OrderPaymentMethod)}
                    className={inputCls}
                  >
                    {(Object.keys(paymentMethodLabels) as OrderPaymentMethod[]).map((k) => (
                      <option key={k} value={k}>
                        {paymentMethodLabels[k]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Sipariş notu</label>
                <textarea
                  value={notu}
                  onChange={(e) => setNotu(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Opsiyonel not..."
                  className="w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus:border-primary"
                />
              </div>
            </div>

            {errors.length > 0 && (
              <ul className="mt-3 space-y-1 rounded-lg bg-destructive/10 p-3 text-xs font-medium text-destructive">
                {errors.map((e) => (
                  <li key={e}>• {e}</li>
                ))}
              </ul>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => submit("verildi")}
                className="col-span-2 h-11 rounded-lg bg-primary text-sm font-bold text-primary-foreground hover:opacity-90"
              >
                Siparişi Oluştur
              </button>
              <button
                onClick={() => submit("taslak")}
                className="h-10 rounded-lg border border-input bg-background text-sm font-semibold hover:bg-accent"
              >
                Taslak Kaydet
              </button>
              <button
                onClick={clearAll}
                className="h-10 rounded-lg border border-input bg-background text-sm font-semibold hover:bg-accent"
              >
                Temizle
              </button>
              <Link
                to="/stok"
                className="col-span-2 grid h-10 place-items-center rounded-lg text-sm font-semibold text-muted-foreground hover:text-destructive"
              >
                İptal
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
