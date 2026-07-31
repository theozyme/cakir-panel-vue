import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Eye,
  FileText,
  PackageCheck,
  Search,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { formatTRY, formatUSD } from "@/components/shared/StatusBadge";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/shared/OrderBadges";
import {
  addPayment,
  receiveDelivery,
  setOrderStatus,
  suppliers,
  useStockStore,
} from "@/store/stockStore";
import type { StockItem } from "@/types";
import {
  orderQty,
  orderStatusLabels,
  orderTotal,
  paymentMethodLabels,
  stockCategoryLabels,
  type OrderPaymentMethod,
  type OrderStatus,
  type OrderPaymentStatus,
  type PurchaseOrder,
} from "@/types/orders";

export const Route = createFileRoute("/stok/siparisler")({
  head: () => ({
    meta: [
      { title: "Geçmiş Siparişler · Stok Yönetimi · Çakır Oto" },
      { name: "description", content: "Tedarikçi siparişleri, durum takibi ve teslimat girişi." },
      { property: "og:title", content: "Geçmiş Siparişler" },
      { property: "og:description", content: "Sipariş listesi, filtreler, detay ve teslimat yönetimi." },
    ],
  }),
  component: SiparislerPage,
});

const inputCls =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary";

const money = (c: "TRY" | "USD", n: number) => (c === "USD" ? formatUSD(n) : formatTRY(n));

function SiparislerPage() {
  const { orders } = useStockStore();
  const [q, setQ] = useState("");
  const [ted, setTed] = useState("all");
  const [tur, setTur] = useState<"all" | StockItem["kategori"]>("all");
  const [durum, setDurum] = useState<"all" | OrderStatus>("all");
  const [odeme, setOdeme] = useState<"all" | OrderPaymentStatus>("all");
  const [bas, setBas] = useState("");
  const [bit, setBit] = useState("");
  const [detayId, setDetayId] = useState<string | null>(null);

  const list = useMemo(
    () =>
      orders
        .filter((o) => o.no.toLowerCase().includes(q.trim().toLowerCase()))
        .filter((o) => (ted === "all" ? true : o.tedarikciId === ted))
        .filter((o) => (tur === "all" ? true : o.stokTuru === tur))
        .filter((o) => (durum === "all" ? true : o.durum === durum))
        .filter((o) => (odeme === "all" ? true : o.odemeDurumu === odeme))
        .filter((o) => (bas ? o.tarih >= bas : true))
        .filter((o) => (bit ? o.tarih <= bit : true)),
    [orders, q, ted, tur, durum, odeme, bas, bit],
  );

  const detay = orders.find((o) => o.id === detayId) ?? null;

  return (
    <AppLayout title="Geçmiş Siparişler">
      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          to="/stok"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm font-semibold hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Stok Yönetimi
        </Link>
        <Link
          to="/stok/siparis-ver"
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-bold text-primary-foreground hover:opacity-90"
        >
          Sipariş Ver
        </Link>
      </div>

      <div className="card-elevated p-5">
        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              maxLength={40}
              placeholder="Sipariş no ara..."
              className={`${inputCls} pl-9`}
            />
          </div>
          <select value={ted} onChange={(e) => setTed(e.target.value)} className={inputCls}>
            <option value="all">Tüm tedarikçiler</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.ad}
              </option>
            ))}
          </select>
          <select value={tur} onChange={(e) => setTur(e.target.value as typeof tur)} className={inputCls}>
            <option value="all">Tüm stok türleri</option>
            {(Object.keys(stockCategoryLabels) as StockItem["kategori"][]).map((k) => (
              <option key={k} value={k}>
                {stockCategoryLabels[k]}
              </option>
            ))}
          </select>
          <select value={durum} onChange={(e) => setDurum(e.target.value as typeof durum)} className={inputCls}>
            <option value="all">Tüm sipariş durumları</option>
            {(Object.keys(orderStatusLabels) as OrderStatus[]).map((k) => (
              <option key={k} value={k}>
                {orderStatusLabels[k]}
              </option>
            ))}
          </select>
          <select value={odeme} onChange={(e) => setOdeme(e.target.value as typeof odeme)} className={inputCls}>
            <option value="all">Tüm ödeme durumları</option>
            <option value="odenmedi">Ödenmedi</option>
            <option value="kismi">Kısmi Ödendi</option>
            <option value="odendi">Ödendi</option>
          </select>
          <input type="date" value={bas} onChange={(e) => setBas(e.target.value)} className={inputCls} />
          <input type="date" value={bit} onChange={(e) => setBit(e.target.value)} className={inputCls} />
          <button
            onClick={() => {
              setQ("");
              setTed("all");
              setTur("all");
              setDurum("all");
              setOdeme("all");
              setBas("");
              setBit("");
            }}
            className="h-10 rounded-lg border border-input bg-background text-sm font-semibold hover:bg-accent"
          >
            Filtreleri Temizle
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-3 text-left font-semibold">Sipariş No</th>
                <th className="px-3 py-3 text-left font-semibold">Tarih</th>
                <th className="px-3 py-3 text-left font-semibold">Tedarikçi</th>
                <th className="px-3 py-3 text-left font-semibold">Stok Türü</th>
                <th className="px-3 py-3 text-center font-semibold">Ürün</th>
                <th className="px-3 py-3 text-center font-semibold">Adet</th>
                <th className="px-3 py-3 text-right font-semibold">Tutar</th>
                <th className="px-3 py-3 text-center font-semibold">Kur</th>
                <th className="px-3 py-3 text-left font-semibold">Ödeme</th>
                <th className="px-3 py-3 text-left font-semibold">Durum</th>
                <th className="px-3 py-3 text-left font-semibold">Beklenen Teslim</th>
                <th className="px-3 py-3 text-right font-semibold">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id} className="border-t border-border/60 hover:bg-muted/30">
                  <td className="px-3 py-3 font-semibold">{o.no}</td>
                  <td className="px-3 py-3 text-muted-foreground">{o.tarih}</td>
                  <td className="px-3 py-3">{o.tedarikciAd}</td>
                  <td className="px-3 py-3 text-muted-foreground">{stockCategoryLabels[o.stokTuru]}</td>
                  <td className="px-3 py-3 text-center">{o.kalemler.length}</td>
                  <td className="px-3 py-3 text-center font-semibold">{orderQty(o)}</td>
                  <td className="px-3 py-3 text-right font-bold">{money(o.paraBirimi, orderTotal(o))}</td>
                  <td className="px-3 py-3 text-center text-muted-foreground">
                    {o.paraBirimi === "USD" ? "USD" : "TL"}
                  </td>
                  <td className="px-3 py-3">
                    <PaymentStatusBadge status={o.odemeDurumu} />
                  </td>
                  <td className="px-3 py-3">
                    <OrderStatusBadge status={o.durum} />
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{o.beklenenTeslim}</td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end">
                      <button
                        onClick={() => setDetayId(o.id)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input px-2.5 text-xs font-semibold hover:text-primary"
                      >
                        <Eye className="h-3.5 w-3.5" /> Detay
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Sipariş bulunamadı
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detay && <OrderDrawer order={detay} onClose={() => setDetayId(null)} />}
    </AppLayout>
  );
}

function OrderDrawer({ order, onClose }: { order: PurchaseOrder; onClose: () => void }) {
  const [modal, setModal] = useState<null | "teslimat" | "odeme" | "durum" | "pdf">(null);
  const toplam = orderTotal(order);
  const odenen = order.odemeler.reduce((t, p) => t + p.tutar, 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-2xl overflow-y-auto bg-card shadow-xl"
      >
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <div className="text-lg font-bold">{order.no}</div>
            <div className="text-xs text-muted-foreground">
              {order.tedarikciAd} · {stockCategoryLabels[order.stokTuru]}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <OrderStatusBadge status={order.durum} />
            <button
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-lg border border-input hover:text-destructive"
              aria-label="Kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Info label="Sipariş tarihi" value={order.tarih} />
            <Info label="Beklenen teslim" value={order.beklenenTeslim} />
            <Info label="Para birimi" value={order.paraBirimi === "USD" ? "USD" : "TL"} />
            <Info label="Ödeme yöntemi" value={paymentMethodLabels[order.odemeYontemi]} />
            <Info label="Ödenen" value={money(order.paraBirimi, odenen)} />
            <Info label="Kalan" value={money(order.paraBirimi, Math.max(0, toplam - odenen))} />
          </div>

          <div className="flex items-center gap-2">
            <PaymentStatusBadge status={order.odemeDurumu} />
            {order.notu && <span className="text-xs text-muted-foreground">Not: {order.notu}</span>}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-bold">Ürünler</h3>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Ürün</th>
                    <th className="px-3 py-2 text-center font-semibold">Sipariş</th>
                    <th className="px-3 py-2 text-center font-semibold">Teslim</th>
                    <th className="px-3 py-2 text-center font-semibold">Eksik</th>
                    <th className="px-3 py-2 text-right font-semibold">Birim</th>
                    <th className="px-3 py-2 text-right font-semibold">Toplam</th>
                  </tr>
                </thead>
                <tbody>
                  {order.kalemler.map((k) => (
                    <tr key={k.stokId} className="border-t border-border/60">
                      <td className="px-3 py-2">
                        <div className="font-semibold">{k.urun}</div>
                        <div className="text-[11px] text-muted-foreground">{k.kod}</div>
                      </td>
                      <td className="px-3 py-2 text-center">{k.adet}</td>
                      <td className="px-3 py-2 text-center text-success">{k.teslimEdilen}</td>
                      <td className="px-3 py-2 text-center font-semibold text-destructive">
                        {k.adet - k.teslimEdilen}
                      </td>
                      <td className="px-3 py-2 text-right">{money(order.paraBirimi, k.birimFiyat)}</td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {money(order.paraBirimi, k.adet * k.birimFiyat)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-muted/40">
                    <td colSpan={5} className="px-3 py-2 text-right text-sm font-bold">
                      Genel Toplam
                    </td>
                    <td className="px-3 py-2 text-right text-base font-black text-primary">
                      {money(order.paraBirimi, toplam)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-bold">Durum Geçmişi</h3>
            <ol className="space-y-2">
              {order.gecmis.map((g, i) => (
                <li key={i} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div>
                    <div className="text-sm font-semibold">{orderStatusLabels[g.durum]}</div>
                    <div className="text-xs text-muted-foreground">
                      {g.tarih} · {g.aciklama}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {order.odemeler.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-bold">Ödemeler</h3>
              <ul className="space-y-2">
                {order.odemeler.map((p, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                    <span className="text-muted-foreground">
                      {p.tarih} · {paymentMethodLabels[p.yontem]}
                    </span>
                    <b>{money(order.paraBirimi, p.tutar)}</b>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <ActionBtn onClick={() => setModal("durum")}>Durumu Güncelle</ActionBtn>
            <ActionBtn onClick={() => setModal("odeme")}>
              <Wallet className="h-4 w-4" /> Ödeme Ekle
            </ActionBtn>
            <ActionBtn onClick={() => setModal("teslimat")}>
              <PackageCheck className="h-4 w-4" /> Teslimat Gir
            </ActionBtn>
            <ActionBtn onClick={() => setModal("pdf")}>
              <FileText className="h-4 w-4" /> PDF Önizleme
            </ActionBtn>
            <ActionBtn
              onClick={() => toast("Sipariş düzenleme Faz 2'de aktif olacak.")}
            >
              Siparişi Düzenle
            </ActionBtn>
            <button
              disabled={order.durum === "iptal"}
              onClick={() => {
                setOrderStatus(order.id, "iptal", "Sipariş iptal edildi");
                toast.error(`${order.no} iptal edildi.`);
              }}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-destructive/40 px-3 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-40"
            >
              <XCircle className="h-4 w-4" /> İptal Et
            </button>
          </div>
        </div>
      </aside>

      {modal === "teslimat" && (
        <DeliveryModal order={order} onClose={() => setModal(null)} />
      )}
      {modal === "odeme" && (
        <PaymentModal order={order} toplam={toplam} odenen={odenen} onClose={() => setModal(null)} />
      )}
      {modal === "durum" && <StatusModal order={order} onClose={() => setModal(null)} />}
      {modal === "pdf" && <PdfModal order={order} toplam={toplam} onClose={() => setModal(null)} />}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/60 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function ActionBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-input bg-background px-3 text-sm font-semibold hover:bg-accent"
    >
      {children}
    </button>
  );
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-card p-6 shadow-xl"
      >
        <h2 className="mb-4 text-lg font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function DeliveryModal({ order, onClose }: { order: PurchaseOrder; onClose: () => void }) {
  const [gelen, setGelen] = useState<Record<string, number>>({});

  function confirm() {
    const total = Object.values(gelen).reduce((t, n) => t + (n || 0), 0);
    if (total <= 0) {
      toast.error("En az bir ürün için teslim adedi girin.");
      return;
    }
    const invalid = order.kalemler.some(
      (k) => (gelen[k.stokId] ?? 0) > k.adet - k.teslimEdilen,
    );
    if (invalid) {
      toast.error("Teslim adedi, eksik adetten fazla olamaz.");
      return;
    }
    receiveDelivery(order.id, gelen);
    toast.success("Teslimat kaydedildi, stok adetleri güncellendi.");
    onClose();
  }

  return (
    <ModalShell title={`Teslimat Girişi · ${order.no}`} onClose={onClose}>
      <div className="space-y-3">
        {order.kalemler.map((k) => {
          const eksik = k.adet - k.teslimEdilen;
          const val = gelen[k.stokId] ?? 0;
          return (
            <div key={k.stokId} className="rounded-xl border border-border p-3">
              <div className="font-semibold">{k.urun}</div>
              <div className="text-[11px] text-muted-foreground">{k.kod}</div>
              <div className="mt-2 grid grid-cols-4 items-end gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">Sipariş</div>
                  <b>{k.adet}</b>
                </div>
                <div>
                  <div className="text-muted-foreground">Teslim edilen</div>
                  <b className="text-success">{k.teslimEdilen}</b>
                </div>
                <div>
                  <div className="text-muted-foreground">Eksik</div>
                  <b className="text-destructive">{eksik - val}</b>
                </div>
                <div>
                  <div className="mb-1 text-muted-foreground">Bu teslimat</div>
                  <input
                    type="number"
                    min={0}
                    max={eksik}
                    value={val}
                    onChange={(e) =>
                      setGelen((p) => ({
                        ...p,
                        [k.stokId]: Math.max(0, Math.min(eksik, Number(e.target.value) || 0)),
                      }))
                    }
                    className="h-9 w-full rounded-lg border border-input bg-background px-2 text-center text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="h-10 rounded-lg border border-input px-4 text-sm font-semibold">
          Vazgeç
        </button>
        <button
          onClick={confirm}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground"
        >
          Teslimatı Onayla
        </button>
      </div>
    </ModalShell>
  );
}

function PaymentModal({
  order,
  toplam,
  odenen,
  onClose,
}: {
  order: PurchaseOrder;
  toplam: number;
  odenen: number;
  onClose: () => void;
}) {
  const kalan = Math.max(0, toplam - odenen);
  const [tutar, setTutar] = useState(kalan);
  const [tarih, setTarih] = useState(new Date().toISOString().slice(0, 10));
  const [yontem, setYontem] = useState<OrderPaymentMethod>(order.odemeYontemi);

  return (
    <ModalShell title={`Ödeme Ekle · ${order.no}`} onClose={onClose}>
      <div className="grid gap-3">
        <div className="rounded-lg bg-muted/60 p-3 text-sm">
          Kalan borç: <b>{money(order.paraBirimi, kalan)}</b>
        </div>
        <input
          type="number"
          min={1}
          value={tutar}
          onChange={(e) => setTutar(Number(e.target.value) || 0)}
          className={inputCls}
          placeholder="Tutar"
        />
        <input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} className={inputCls} />
        <select
          value={yontem}
          onChange={(e) => setYontem(e.target.value as OrderPaymentMethod)}
          className={inputCls}
        >
          {(Object.keys(paymentMethodLabels) as OrderPaymentMethod[]).map((k) => (
            <option key={k} value={k}>
              {paymentMethodLabels[k]}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="h-10 rounded-lg border border-input px-4 text-sm font-semibold">
          Vazgeç
        </button>
        <button
          onClick={() => {
            if (tutar <= 0) return toast.error("Tutar 0'dan büyük olmalıdır.");
            if (tutar > kalan) return toast.error("Tutar kalan borçtan fazla olamaz.");
            if (!tarih) return toast.error("Ödeme tarihi zorunludur.");
            addPayment(order.id, { tarih, tutar, yontem }, toplam);
            toast.success("Ödeme kaydedildi.");
            onClose();
          }}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground"
        >
          Kaydet
        </button>
      </div>
    </ModalShell>
  );
}

function StatusModal({ order, onClose }: { order: PurchaseOrder; onClose: () => void }) {
  const [durum, setDurum] = useState<OrderStatus>(order.durum);
  return (
    <ModalShell title={`Durumu Güncelle · ${order.no}`} onClose={onClose}>
      <select value={durum} onChange={(e) => setDurum(e.target.value as OrderStatus)} className={inputCls}>
        {(Object.keys(orderStatusLabels) as OrderStatus[]).map((k) => (
          <option key={k} value={k}>
            {orderStatusLabels[k]}
          </option>
        ))}
      </select>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="h-10 rounded-lg border border-input px-4 text-sm font-semibold">
          Vazgeç
        </button>
        <button
          onClick={() => {
            setOrderStatus(order.id, durum);
            toast.success(`Durum "${orderStatusLabels[durum]}" olarak güncellendi.`);
            onClose();
          }}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground"
        >
          Güncelle
        </button>
      </div>
    </ModalShell>
  );
}

function PdfModal({
  order,
  toplam,
  onClose,
}: {
  order: PurchaseOrder;
  toplam: number;
  onClose: () => void;
}) {
  return (
    <ModalShell title="PDF Önizleme" onClose={onClose}>
      <div className="rounded-xl border border-border p-5 text-sm">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-base font-black">Çakır Oto</div>
            <div className="text-xs text-muted-foreground">Satın Alma Siparişi</div>
          </div>
          <div className="text-right">
            <div className="font-bold">{order.no}</div>
            <div className="text-xs text-muted-foreground">{order.tarih}</div>
          </div>
        </div>
        <div className="mb-3 text-xs text-muted-foreground">
          Tedarikçi: <b className="text-foreground">{order.tedarikciAd}</b> · Beklenen teslim:{" "}
          {order.beklenenTeslim}
        </div>
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 text-left">Ürün</th>
              <th className="py-1 text-center">Adet</th>
              <th className="py-1 text-right">Birim</th>
              <th className="py-1 text-right">Toplam</th>
            </tr>
          </thead>
          <tbody>
            {order.kalemler.map((k) => (
              <tr key={k.stokId} className="border-t border-border/60">
                <td className="py-1">{k.urun}</td>
                <td className="py-1 text-center">{k.adet}</td>
                <td className="py-1 text-right">{money(order.paraBirimi, k.birimFiyat)}</td>
                <td className="py-1 text-right">{money(order.paraBirimi, k.adet * k.birimFiyat)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 border-t border-border pt-2 text-right font-bold">
          Genel Toplam: {money(order.paraBirimi, toplam)}
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="h-10 rounded-lg border border-input px-4 text-sm font-semibold">
          Kapat
        </button>
        <button
          onClick={() => toast("PDF çıktısı Faz 2'de aktif olacak.")}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground"
        >
          Yazdır
        </button>
      </div>
    </ModalShell>
  );
}
