import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Plus, Search, ShoppingCart, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { apiRequest } from "@/lib/api";
import { inventoryStockHighlightClass } from "@/lib/inventory-style";
import { formatMoneyString } from "@/lib/money";
import {
  inventoryProductCode,
  inventoryProductLabel,
  inventoryTypeLabels,
  type InventoryListResponse,
  type InventoryProduct,
  type InventoryStockType,
} from "@/types/inventory";
import {
  paymentMethodLabels,
  paymentStatusLabels,
  type OrderPaymentMethod,
  type OrderPaymentStatus,
  type StockOrder,
  type StockOrderItemInput,
  type Supplier,
} from "@/types/orders";

type SearchParams = { tur?: InventoryStockType; orderId?: string };

export const Route = createFileRoute("/stok/siparis-ver")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    ...(search.tur === "MULTIMEDIA" || search.tur === "SCREEN" || search.tur === "SOUND_SYSTEM"
      ? { tur: search.tur }
      : {}),
    ...(typeof search.orderId === "string" && search.orderId ? { orderId: search.orderId } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Sipariş Ver · Stok Yönetimi · Çakır Oto" },
      { name: "description", content: "Gerçek stok ürünlerinden satın alma siparişi oluşturma." },
    ],
  }),
  component: SiparisVerPage,
});

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const inputClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary";

const useDebouncedValue = (value: string, delay: number) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);
  return debounced;
};

const positiveMoney = (value: string): boolean => {
  try {
    return new Decimal(value).isPositive();
  } catch {
    return false;
  }
};

function SiparisVerPage() {
  const { tur, orderId } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<InventoryStockType>(tur ?? "MULTIMEDIA");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<StockOrderItemInput[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [orderDate, setOrderDate] = useState(today());
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(plusDays(10));
  const [note, setNote] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<OrderPaymentStatus>("UNPAID");
  const [paymentMethod, setPaymentMethod] = useState<OrderPaymentMethod>("BANK_TRANSFER");
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  const [hydratedOrder, setHydratedOrder] = useState<string | null>(null);

  const productParams = useMemo(() => {
    const params = new URLSearchParams({ type: tab, active: "true", page: "1", pageSize: "100" });
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (criticalOnly) params.set("criticalOnly", "true");
    return params.toString();
  }, [criticalOnly, debouncedSearch, tab]);

  const productsQuery = useQuery({
    queryKey: ["inventory", "order-picker", tab, productParams],
    queryFn: () => apiRequest<InventoryListResponse>(`/api/inventory/products?${productParams}`),
  });
  const suppliersQuery = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => apiRequest<Supplier[]>("/api/suppliers"),
  });
  const draftQuery = useQuery({
    queryKey: ["stock-orders", orderId],
    queryFn: () => apiRequest<StockOrder>(`/api/stock-orders/${orderId}`),
    enabled: Boolean(orderId),
  });

  useEffect(() => {
    const order = draftQuery.data;
    if (!order || hydratedOrder === order.id) return;
    if (order.status !== "DRAFT") {
      toast.error("Yalnız taslak sipariş düzenlenebilir");
      return;
    }
    setSupplierId(order.supplier.id);
    setOrderDate(order.orderDate);
    setExpectedDeliveryDate(order.expectedDeliveryDate);
    setNote(order.note ?? "");
    setPaymentStatus(order.paymentStatus);
    setPaymentMethod(order.paymentMethod);
    setCart(
      order.items.map((item) => ({
        key: item.id,
        stockType: item.stockType,
        isNewProduct: item.isNewProduct,
        ...(item.productId ? { productId: item.productId } : {}),
        ...(item.isNewProduct ? { productSnapshot: item.productSnapshot } : {}),
        productLabel: item.productLabel,
        productCode: item.productCode,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    );
    setHydratedOrder(order.id);
  }, [draftQuery.data, hydratedOrder]);

  const selectedSupplier = suppliersQuery.data?.find((supplier) => supplier.id === supplierId);
  const currency = selectedSupplier?.currency ?? "TRY";
  const total = cart.reduce((sum, item) => {
    try {
      return sum.plus(new Decimal(item.unitPrice).mul(item.quantity));
    } catch {
      return sum;
    }
  }, new Decimal(0));
  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);

  const saveMutation = useMutation({
    mutationFn: async (status: "DRAFT" | "ORDERED") => {
      if (!supplierId) throw new Error("Tedarikçi seçimi zorunludur");
      if (cart.length === 0) throw new Error("En az bir sipariş kalemi ekleyin");
      if (expectedDeliveryDate < orderDate) throw new Error("Beklenen teslim tarihi sipariş tarihinden önce olamaz");
      if (cart.some((item) => !positiveMoney(item.unitPrice) || item.quantity < 1)) {
        throw new Error("Her kalemde geçerli adet ve pozitif birim fiyat olmalıdır");
      }
      const payload = {
        supplierId,
        orderDate,
        expectedDeliveryDate,
        paymentStatus,
        paymentMethod,
        note: note.trim() || null,
        status,
        items: cart.map((item) => ({
          stockType: item.stockType,
          isNewProduct: item.isNewProduct,
          ...(item.productId ? { productId: item.productId } : {}),
          ...(item.productSnapshot ? { productSnapshot: item.productSnapshot } : {}),
          quantity: item.quantity,
          unitPrice: new Decimal(item.unitPrice).toFixed(2),
        })),
      };
      if (orderId) {
        const updated = await apiRequest<StockOrder>(`/api/stock-orders/${orderId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        return status === "ORDERED"
          ? apiRequest<StockOrder>(`/api/stock-orders/${updated.id}/submit`, { method: "POST" })
          : updated;
      }
      return apiRequest<StockOrder>("/api/stock-orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ["stock-orders"] });
      toast.success(order.status === "DRAFT" ? "Taslak kaydedildi" : "Sipariş oluşturuldu; stok henüz değişmedi");
      navigate({ to: "/stok/siparisler" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addExisting = (product: InventoryProduct) => {
    const quantity = Number(quantities[product.id] || 1);
    const unitPrice = (prices[product.id] ?? "").trim();
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 9999) return toast.error("Adet 1-9999 aralığında olmalıdır");
    if (!positiveMoney(unitPrice)) return toast.error("Pozitif birim fiyat girin");
    const key = `${product.type}:${product.id}`;
    setCart((current) => {
      const existing = current.find((item) => item.key === key);
      if (existing) return current.map((item) => item.key === key ? { ...item, quantity: item.quantity + quantity, unitPrice } : item);
      return [...current, {
        key,
        stockType: product.type,
        isNewProduct: false,
        productId: product.id,
        productLabel: inventoryProductLabel(product),
        productCode: inventoryProductCode(product) || null,
        quantity,
        unitPrice,
      }];
    });
    setQuantities((current) => ({ ...current, [product.id]: "1" }));
    toast.success("Ürün sepete eklendi");
  };

  return (
    <AppLayout title={orderId ? "Taslak Siparişi Düzenle" : "Sipariş Ver"}>
      <div className="mb-4"><Link to="/stok" className="inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm font-semibold hover:bg-accent"><ArrowLeft className="h-4 w-4" /> Stok Yönetimi</Link></div>
      {draftQuery.isLoading && <div className="card-elevated p-8 text-center text-sm text-muted-foreground">Taslak yükleniyor...</div>}
      {draftQuery.error && <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{draftQuery.error.message}</div>}
      {(!orderId || hydratedOrder) && (
        <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
          <div className="card-elevated p-5">
            <div className="mb-4 flex flex-wrap gap-2">
              {(Object.keys(inventoryTypeLabels) as InventoryStockType[]).map((value) => (
                <button key={value} onClick={() => setTab(value)} className={`h-9 rounded-lg px-4 text-sm font-semibold ${tab === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>{inventoryTypeLabels[value]}</button>
              ))}
              <button onClick={() => setNewProductOpen(true)} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary px-3 text-sm font-semibold text-primary"><Plus className="h-4 w-4" /> Yeni Ürün Ekle</button>
            </div>
            <div className="mb-4 flex gap-3">
              <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Gerçek stok ürünlerinde ara..." className={`${inputClass} pl-9`} /></div>
              <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-input px-3 text-sm"><input type="checkbox" checked={criticalOnly} onChange={(event) => setCriticalOnly(event.target.checked)} /><AlertTriangle className="h-4 w-4 text-destructive" /> Kritik</label>
            </div>
            {productsQuery.isLoading && <div className="py-10 text-center text-sm text-muted-foreground">Ürünler yükleniyor...</div>}
            {productsQuery.error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{productsQuery.error.message}</div>}
            <div className="space-y-3">
              {(productsQuery.data?.items ?? []).map((product) => (
                <div
                  key={product.id}
                  className={`rounded-xl border border-border p-4 transition-colors ${inventoryStockHighlightClass(product.status)}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><div className="font-semibold">{inventoryProductLabel(product)}</div><div className="text-xs text-muted-foreground">{inventoryProductCode(product) || inventoryTypeLabels[product.type]} · Mevcut stok: {product.quantity}</div></div>
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="grid gap-1 text-[11px] text-muted-foreground">Adet<input type="number" min={1} max={9999} value={quantities[product.id] ?? "1"} onChange={(event) => setQuantities((current) => ({ ...current, [product.id]: event.target.value }))} className="h-9 w-20 rounded-lg border border-input bg-background px-2" /></label>
                      <label className="grid gap-1 text-[11px] text-muted-foreground">Birim fiyat ({currency})<input type="text" inputMode="decimal" value={prices[product.id] ?? ""} onChange={(event) => setPrices((current) => ({ ...current, [product.id]: event.target.value }))} className="h-9 w-28 rounded-lg border border-input bg-background px-2" /></label>
                      <button onClick={() => addExisting(product)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"><ShoppingCart className="h-4 w-4" /> Ekle</button>
                    </div>
                  </div>
                </div>
              ))}
              {!productsQuery.isLoading && (productsQuery.data?.items.length ?? 0) === 0 && <div className="py-10 text-center text-sm text-muted-foreground">Ürün bulunamadı</div>}
            </div>
          </div>

          <div className="lg:sticky lg:top-20 lg:self-start">
            <div className="card-elevated p-5 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:overscroll-contain">
              <h2 className="mb-3 flex items-center gap-2 font-bold"><ShoppingCart className="h-4 w-4 text-primary" /> Sipariş Özeti</h2>
              <div className="mb-3 grid grid-cols-2 gap-3"><Summary label="Ürün çeşidi" value={String(cart.length)} /><Summary label="Toplam adet" value={String(totalQuantity)} /></div>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.key} className="rounded-lg border border-border p-3">
                    <div className="flex justify-between gap-2"><div className="min-w-0"><div className="truncate text-sm font-semibold">{item.productLabel}</div><div className="text-[11px] text-muted-foreground">{inventoryTypeLabels[item.stockType]}{item.isNewProduct ? " · Yeni ürün" : ""}</div></div><button onClick={() => setCart((current) => current.filter((value) => value.key !== item.key))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button></div>
                    <div className="mt-2 grid grid-cols-[70px_1fr] gap-2"><input type="number" min={1} value={item.quantity} onChange={(event) => setCart((current) => current.map((value) => value.key === item.key ? { ...value, quantity: Math.max(1, Number(event.target.value) || 1) } : value))} className="h-8 rounded-md border border-input bg-background px-2 text-center text-xs" /><input value={item.unitPrice} onChange={(event) => setCart((current) => current.map((value) => value.key === item.key ? { ...value, unitPrice: event.target.value } : value))} className="h-8 rounded-md border border-input bg-background px-2 text-right text-xs" /></div>
                  </div>
                ))}
                {cart.length === 0 && <div className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">Sepet boş</div>}
              </div>
              <div className="my-4 flex justify-between border-t border-border pt-3"><span className="font-semibold">Genel Toplam</span><b className="text-xl text-primary">{formatMoneyString(total.toFixed(2), currency)}</b></div>
              <div className="grid gap-3">
                <div><div className="mb-1 flex items-center justify-between"><label className="text-xs font-semibold text-muted-foreground">Tedarikçi *</label><button onClick={() => setNewSupplierOpen(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><UserPlus className="h-3.5 w-3.5" /> Yeni Tedarikçi</button></div><select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className={inputClass}><option value="">Seçiniz</option>{(suppliersQuery.data ?? []).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name} ({supplier.currency})</option>)}</select></div>
                <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">Para birimi</label><div className="grid h-10 place-items-center rounded-lg bg-muted text-sm font-bold">{selectedSupplier ? selectedSupplier.currency : "Supplier seçin"}</div></div>
                <div className="grid grid-cols-2 gap-3"><DateField label="Sipariş tarihi" value={orderDate} onChange={setOrderDate} /><DateField label="Beklenen teslim" value={expectedDeliveryDate} onChange={setExpectedDeliveryDate} /></div>
                <div className="grid grid-cols-2 gap-3"><SelectField label="Ödeme durumu" value={paymentStatus} onChange={(value) => setPaymentStatus(value as OrderPaymentStatus)} options={paymentStatusLabels} /><SelectField label="Ödeme yöntemi" value={paymentMethod} onChange={(value) => setPaymentMethod(value as OrderPaymentMethod)} options={paymentMethodLabels} /></div>
                <label className="grid gap-1 text-xs font-semibold text-muted-foreground">Sipariş notu<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={3} className="rounded-lg border border-input bg-background p-3 text-sm" /></label>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2"><button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate("ORDERED")} className="col-span-2 h-11 rounded-lg bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50">Siparişi Oluştur</button><button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate("DRAFT")} className="h-10 rounded-lg border border-input text-sm font-semibold disabled:opacity-50">Taslak Kaydet</button><button onClick={() => setCart([])} className="h-10 rounded-lg border border-input text-sm font-semibold">Sepeti Temizle</button></div>
            </div>
          </div>
        </div>
      )}
      {newProductOpen && <NewProductModal type={tab} currency={currency} onClose={() => setNewProductOpen(false)} onAdd={(item) => { setCart((current) => [...current, item]); setNewProductOpen(false); }} />}
      {newSupplierOpen && <NewSupplierModal onClose={() => setNewSupplierOpen(false)} onCreated={(supplier) => { queryClient.setQueryData<Supplier[]>(["suppliers"], (current) => [...(current ?? []), supplier].sort((a, b) => a.name.localeCompare(b.name))); void queryClient.invalidateQueries({ queryKey: ["suppliers"] }); setSupplierId(supplier.id); setNewSupplierOpen(false); }} />}
    </AppLayout>
  );
}

function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-muted/60 p-3"><div className="text-[11px] text-muted-foreground">{label}</div><div className="text-lg font-bold">{value}</div></div>; }
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="grid gap-1 text-xs font-semibold text-muted-foreground">{label}<input type="date" value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} /></label>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Record<string, string> }) { return <label className="grid gap-1 text-xs font-semibold text-muted-foreground">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>{Object.entries(options).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>; }

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}><div onClick={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 shadow-xl"><h2 className="mb-4 text-lg font-bold">{title}</h2>{children}</div></div>; }
function FormField({ name, label, type = "text", step, required }: { name: string; label: string; type?: string; step?: string; required?: boolean }) { return <label className="grid gap-1 text-xs font-semibold text-muted-foreground">{label}<input name={name} type={type} min={type === "number" ? "0" : undefined} step={step} required={required} className={inputClass} /></label>; }

function NewProductModal({ type, currency, onClose, onAdd }: { type: InventoryStockType; currency: "TRY" | "USD"; onClose: () => void; onAdd: (item: StockOrderItemInput) => void }) {
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (key: string) => String(data.get(key) ?? "").trim();
    const integerOrNull = (key: string) => text(key) ? Number(text(key)) : null;
    const quantity = Number(text("quantity"));
    const unitPrice = text("unitPrice");
    if (!Number.isSafeInteger(quantity) || quantity < 1 || !positiveMoney(unitPrice)) return toast.error("Geçerli adet ve pozitif birim fiyat girin");
    let snapshot: Record<string, unknown>;
    let label: string;
    let code: string | null = null;
    if (type === "MULTIMEDIA") {
      snapshot = { code: text("code"), brand: text("brand"), model: text("model") || null, forx: text("forx") || null, shelf: text("shelf") || null, criticalStockLevel: Number(text("criticalStockLevel") || 0) };
      label = [snapshot.brand, snapshot.model, snapshot.forx].filter(Boolean).join(" ");
      code = text("code");
    } else if (type === "SCREEN") {
      snapshot = { brand: text("brand"), storageGb: integerOrNull("storageGb"), ramGb: integerOrNull("ramGb"), cores: integerOrNull("cores"), sizeInch: text("sizeInch") || null, sizeLabel: text("sizeLabel") || null, criticalStockLevel: Number(text("criticalStockLevel") || 0) };
      label = [snapshot.brand, snapshot.sizeLabel ?? snapshot.sizeInch].filter(Boolean).join(" ");
    } else {
      snapshot = { name: text("name"), purchasePriceUsd: text("purchasePriceUsd"), criticalStockLevel: Number(text("criticalStockLevel") || 0) };
      label = text("name");
    }
    onAdd({ key: `new:${crypto.randomUUID()}`, stockType: type, isNewProduct: true, productSnapshot: snapshot, productLabel: label, productCode: code, quantity, unitPrice });
    toast.success("Yeni ürün sipariş kalemine eklendi; henüz stokta oluşturulmadı");
  };
  return <Modal title={`Yeni ${inventoryTypeLabels[type]} Sipariş Ürünü`} onClose={onClose}><form onSubmit={submit} className="grid gap-3">
    {type === "MULTIMEDIA" && <><FormField name="code" label="Ürün kodu *" required /><FormField name="brand" label="Marka *" required /><FormField name="model" label="Model" /><FormField name="forx" label="FORX" /><FormField name="shelf" label="Raf" /></>}
    {type === "SCREEN" && <><FormField name="brand" label="Marka *" required /><div className="grid grid-cols-3 gap-2"><FormField name="storageGb" label="Hafıza GB" type="number" /><FormField name="ramGb" label="RAM GB" type="number" /><FormField name="cores" label="Çekirdek" type="number" /></div><div className="grid grid-cols-2 gap-2"><FormField name="sizeInch" label="Boyut inç" type="number" step="0.01" /><FormField name="sizeLabel" label="Boyut etiketi" /></div></>}
    {type === "SOUND_SYSTEM" && <><FormField name="name" label="Ürün adı *" required /><FormField name="purchasePriceUsd" label="Alış USD *" type="number" step="0.01" required /></>}
    <div className="grid grid-cols-3 gap-2"><FormField name="criticalStockLevel" label="Kritik stok" type="number" /><FormField name="quantity" label="Sipariş adedi *" type="number" required /><FormField name="unitPrice" label={`Birim (${currency}) *`} type="number" step="0.01" required /></div>
    <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={onClose} className="h-10 rounded-lg border border-input px-4 text-sm font-semibold">İptal</button><button className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground">Sepete Ekle</button></div>
  </form></Modal>;
}

function NewSupplierModal({ onClose, onCreated }: { onClose: () => void; onCreated: (supplier: Supplier) => void }) {
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<"TRY" | "USD">("TRY");
  const mutation = useMutation({
    mutationFn: () => apiRequest<Supplier>("/api/suppliers", { method: "POST", body: JSON.stringify({ name, currency }) }),
    onSuccess: (supplier) => { toast.success("Tedarikçi oluşturuldu"); onCreated(supplier); },
    onError: (error: Error) => toast.error(error.message),
  });
  return <Modal title="Yeni Tedarikçi" onClose={onClose}><div className="grid gap-3"><label className="grid gap-1 text-xs font-semibold text-muted-foreground">Firma adı *<input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} /></label><label className="grid gap-1 text-xs font-semibold text-muted-foreground">Para birimi<select value={currency} onChange={(event) => setCurrency(event.target.value as typeof currency)} className={inputClass}><option value="TRY">TRY</option><option value="USD">USD</option></select></label></div><div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="h-10 rounded-lg border border-input px-4 text-sm font-semibold">İptal</button><button disabled={!name.trim() || mutation.isPending} onClick={() => mutation.mutate()} className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">Oluştur</button></div></Modal>;
}
