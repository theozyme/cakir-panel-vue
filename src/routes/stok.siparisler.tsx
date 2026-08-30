import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Eye, PackageCheck, Search, Send, X, XCircle } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/shared/OrderBadges";
import { apiRequest } from "@/lib/api";
import { inventoryStockHighlightClass } from "@/lib/inventory-style";
import { formatMoneyString } from "@/lib/money";
import { inventoryTypeLabels, type InventoryStockType } from "@/types/inventory";
import {
  orderStatusLabels,
  paymentMethodLabels,
  paymentStatusLabels,
  type OrderStatus,
  type StockOrder,
  type StockOrderListResponse,
  type Supplier,
} from "@/types/orders";

export const Route = createFileRoute("/stok/siparisler")({
  head: () => ({
    meta: [
      { title: "Geçmiş Siparişler · Stok Yönetimi · Çakır Oto" },
      { name: "description", content: "Gerçek stok siparişleri ve teslim alma işlemleri." },
    ],
  }),
  component: SiparislerPage,
});

const inputClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary";

const useDebouncedValue = (value: string, delay: number) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);
  return debounced;
};

function SiparislerPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [supplierId, setSupplierId] = useState("");
  const [status, setStatus] = useState<"" | OrderStatus>("");
  const [stockType, setStockType] = useState<"" | InventoryStockType>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => setPage(1), [dateFrom, dateTo, debouncedSearch, status, stockType, supplierId]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (supplierId) params.set("supplierId", supplierId);
    if (status) params.set("status", status);
    if (stockType) params.set("stockType", stockType);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    return params.toString();
  }, [dateFrom, dateTo, debouncedSearch, page, status, stockType, supplierId]);

  const ordersQuery = useQuery({
    queryKey: ["stock-orders", queryString],
    queryFn: () => apiRequest<StockOrderListResponse>(`/api/stock-orders?${queryString}`),
  });
  const suppliersQuery = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => apiRequest<Supplier[]>("/api/suppliers"),
  });
  const lastPage = Math.max(1, Math.ceil((ordersQuery.data?.total ?? 0) / 50));

  return (
    <AppLayout title="Geçmiş Siparişler">
      <div className="mb-4 flex flex-wrap gap-2">
        <Link to="/stok" className="inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm font-semibold hover:bg-accent"><ArrowLeft className="h-4 w-4" /> Stok Yönetimi</Link>
        <Link to="/stok/siparis-ver" className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-bold text-primary-foreground">Sipariş Ver</Link>
      </div>
      <div className="card-elevated p-5">
        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Sipariş id veya supplier ara..." className={`${inputClass} pl-9`} /></div>
          <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className={inputClass}><option value="">Tüm tedarikçiler</option>{(suppliersQuery.data ?? []).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select>
          <select value={stockType} onChange={(event) => setStockType(event.target.value as typeof stockType)} className={inputClass}><option value="">Tüm stok türleri</option>{(Object.keys(inventoryTypeLabels) as InventoryStockType[]).map((type) => <option key={type} value={type}>{inventoryTypeLabels[type]}</option>)}</select>
          <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className={inputClass}><option value="">Tüm durumlar</option>{(Object.keys(orderStatusLabels) as OrderStatus[]).map((value) => <option key={value} value={value}>{orderStatusLabels[value]}</option>)}</select>
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className={inputClass} />
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className={inputClass} />
          <button onClick={() => { setSearch(""); setSupplierId(""); setStatus(""); setStockType(""); setDateFrom(""); setDateTo(""); }} className="h-10 rounded-lg border border-input text-sm font-semibold">Filtreleri Temizle</button>
        </div>

        {ordersQuery.isLoading && <div className="py-12 text-center text-sm text-muted-foreground">Siparişler yükleniyor...</div>}
        {ordersQuery.error && <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{ordersQuery.error.message}</div>}
        {!ordersQuery.isLoading && !ordersQuery.error && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-3 text-left">Sipariş ID</th><th className="px-3 py-3 text-left">Tarih</th><th className="px-3 py-3 text-left">Tedarikçi</th><th className="px-3 py-3 text-left">Türler</th><th className="px-3 py-3 text-center">Çeşit</th><th className="px-3 py-3 text-center">Adet</th><th className="px-3 py-3 text-right">Toplam</th><th className="px-3 py-3 text-left">Ödeme</th><th className="px-3 py-3 text-left">Durum</th><th className="px-3 py-3 text-left">Teslim</th><th className="px-3 py-3 text-right">İşlem</th></tr></thead>
              <tbody>
                {(ordersQuery.data?.items ?? []).map((order) => (
                  <tr key={order.id} className="border-t border-border/60 hover:bg-muted/30">
                    <td className="px-3 py-3 font-mono text-xs font-semibold">{order.id.slice(0, 8)}</td>
                    <td className="px-3 py-3 text-muted-foreground">{order.orderDate}</td>
                    <td className="px-3 py-3">{order.supplier.name}</td>
                    <td className="px-3 py-3 text-muted-foreground">{order.stockTypes.map((type) => inventoryTypeLabels[type]).join(", ")}</td>
                    <td className="px-3 py-3 text-center">{order.productKinds}</td>
                    <td className="px-3 py-3 text-center font-semibold">{order.totalQuantity}</td>
                    <td className="px-3 py-3 text-right font-bold">{formatMoneyString(order.totalAmount, order.currency)}</td>
                    <td className="px-3 py-3"><PaymentStatusBadge status={order.paymentStatus} /></td>
                    <td className="px-3 py-3"><OrderStatusBadge status={order.status} /></td>
                    <td className="px-3 py-3 text-muted-foreground">{order.expectedDeliveryDate}</td>
                    <td className="px-3 py-3 text-right"><button onClick={() => setDetailId(order.id)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input px-2.5 text-xs font-semibold hover:text-primary"><Eye className="h-3.5 w-3.5" /> Detay</button></td>
                  </tr>
                ))}
                {(ordersQuery.data?.items.length ?? 0) === 0 && <tr><td colSpan={11} className="px-4 py-10 text-center text-sm text-muted-foreground">Sipariş bulunamadı</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex items-center justify-between text-sm"><span className="text-muted-foreground">Toplam {ordersQuery.data?.total ?? 0} sipariş</span><div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="h-9 rounded-lg border border-input px-3 disabled:opacity-40">Önceki</button><span>{page} / {lastPage}</span><button disabled={page >= lastPage} onClick={() => setPage((value) => value + 1)} className="h-9 rounded-lg border border-input px-3 disabled:opacity-40">Sonraki</button></div></div>
      </div>
      {detailId && <OrderDrawer id={detailId} onClose={() => setDetailId(null)} />}
    </AppLayout>
  );
}

function OrderDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const orderQuery = useQuery({ queryKey: ["stock-orders", id], queryFn: () => apiRequest<StockOrder>(`/api/stock-orders/${id}`) });
  const transition = useMutation({
    mutationFn: (action: "submit" | "receive" | "cancel") => apiRequest<StockOrder>(`/api/stock-orders/${id}/${action}`, { method: "POST" }),
    onSuccess: (order, action) => {
      void queryClient.invalidateQueries({ queryKey: ["stock-orders"] });
      if (action === "receive") {
        void queryClient.invalidateQueries({ queryKey: ["inventory"] });
        void queryClient.invalidateQueries({ queryKey: ["stock"] });
      }
      toast.success(action === "receive" ? "Sipariş teslim alındı ve stoklar güncellendi" : action === "submit" ? "Taslak siparişe dönüştürüldü" : "Sipariş iptal edildi");
      queryClient.setQueryData(["stock-orders", id], order);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const order = orderQuery.data;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside onClick={(event) => event.stopPropagation()} className="h-full w-full max-w-2xl overflow-y-auto bg-card shadow-xl">
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card px-5 py-4"><div><div className="text-lg font-bold">Sipariş {id.slice(0, 8)}</div><div className="text-xs text-muted-foreground">Gerçek DB kaydı</div></div><div className="ml-auto flex items-center gap-2">{order && <OrderStatusBadge status={order.status} />}<button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-input"><X className="h-4 w-4" /></button></div></div>
        {orderQuery.isLoading && <div className="p-8 text-center text-sm text-muted-foreground">Detay yükleniyor...</div>}
        {orderQuery.error && <div className="m-5 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{orderQuery.error.message}</div>}
        {order && <div className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3"><Info label="Sipariş tarihi" value={order.orderDate} /><Info label="Beklenen teslim" value={order.expectedDeliveryDate} /><Info label="Para birimi" value={order.currency} /><Info label="Ödeme durumu" value={paymentStatusLabels[order.paymentStatus]} /><Info label="Ödeme yöntemi" value={paymentMethodLabels[order.paymentMethod]} /><Info label="Toplam" value={formatMoneyString(order.totalAmount, order.currency)} /></div>
          {order.note && <div className="rounded-lg bg-muted/60 p-3 text-sm">Not: {order.note}</div>}
          <div><h3 className="mb-2 text-sm font-bold">Sipariş Kalemleri</h3><div className="overflow-x-auto rounded-xl border border-border"><table className="w-full text-sm"><thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-2 text-left">Ürün</th><th className="px-3 py-2 text-left">Tür</th><th className="px-3 py-2 text-center">Adet</th><th className="px-3 py-2 text-right">Birim</th><th className="px-3 py-2 text-right">Toplam</th></tr></thead><tbody>{order.items.map((item) => <tr key={item.id} className={`border-t border-border/60 transition-colors ${inventoryStockHighlightClass(item.inventoryStatus)}`}><td className="px-3 py-2"><div className="font-semibold">{item.productLabel}</div><div className="text-[11px] text-muted-foreground">{item.productCode ?? (item.isNewProduct ? "Teslimde oluşturulacak yeni ürün" : item.productId?.slice(0, 8))}</div></td><td className="px-3 py-2 text-muted-foreground">{inventoryTypeLabels[item.stockType]}</td><td className="px-3 py-2 text-center">{item.quantity}</td><td className="px-3 py-2 text-right">{formatMoneyString(item.unitPrice, order.currency)}</td><td className="px-3 py-2 text-right font-semibold">{formatMoneyString(item.totalPrice, order.currency)}</td></tr>)}</tbody></table></div></div>
          <div className="flex flex-wrap gap-2">
            {order.status === "DRAFT" && <><Link to="/stok/siparis-ver" search={{ orderId: order.id }} className="inline-flex h-10 items-center rounded-lg border border-input px-4 text-sm font-semibold">Taslağı Düzenle</Link><button disabled={transition.isPending} onClick={() => transition.mutate("submit")} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground"><Send className="h-4 w-4" /> Siparişi Oluştur</button></>}
            {order.status === "ORDERED" && <button disabled={transition.isPending} onClick={() => { if (window.confirm("Tüm sipariş kalemleri teslim alınıp stoklara eklensin mi?")) transition.mutate("receive"); }} className="inline-flex h-10 items-center gap-2 rounded-lg bg-success px-4 text-sm font-bold text-white"><PackageCheck className="h-4 w-4" /> Teslim Al</button>}
            {(order.status === "DRAFT" || order.status === "ORDERED") && <button disabled={transition.isPending} onClick={() => { if (window.confirm("Sipariş iptal edilsin mi?")) transition.mutate("cancel"); }} className="inline-flex h-10 items-center gap-2 rounded-lg border border-destructive/40 px-4 text-sm font-semibold text-destructive"><XCircle className="h-4 w-4" /> İptal Et</button>}
            {order.status === "RECEIVED" && <div className="rounded-lg bg-success/10 p-3 text-sm font-semibold text-success">Teslim alınmış sipariş readonly durumdadır. Tekrar stok eklenemez.</div>}
          </div>
        </div>}
      </aside>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-muted/60 p-3"><div className="text-[11px] text-muted-foreground">{label}</div><div className="text-sm font-semibold">{value}</div></div>; }
