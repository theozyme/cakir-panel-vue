import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  History,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { apiRequest } from "@/lib/api";
import { inventoryStockHighlightClass } from "@/lib/inventory-style";
import { formatMoneyString } from "@/lib/money";
import {
  inventoryProductLabel,
  inventoryStatusLabels,
  inventoryTypeLabels,
  type InventoryListResponse,
  type InventoryProduct,
  type InventoryStockType,
} from "@/types/inventory";

export const Route = createFileRoute("/stok/")({
  head: () => ({
    meta: [
      { title: "Stok Yönetimi · Çakır Oto" },
      { name: "description", content: "Multimedya, ekran ve ses sistemi stok takibi." },
    ],
  }),
  component: StokPage,
});

const tabs: InventoryStockType[] = ["MULTIMEDIA", "SCREEN", "SOUND_SYSTEM"];
const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary";

const useDebouncedValue = <T,>(value: T, delay: number): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);
  return debounced;
};

const productSecondary = (product: InventoryProduct): string => {
  if (product.type === "MULTIMEDIA") {
    return [product.code, product.forx, product.shelf ? `Raf ${product.shelf}` : null]
      .filter(Boolean)
      .join(" · ");
  }
  if (product.type === "SCREEN") {
    return [
      product.storageGb !== null ? `${product.storageGb} GB` : null,
      product.ramGb !== null ? `${product.ramGb} GB RAM` : null,
      product.cores !== null ? `${product.cores} çekirdek` : null,
      product.sizeLabel ?? (product.sizeInch ? `${product.sizeInch}"` : null),
    ]
      .filter(Boolean)
      .join(" · ");
  }
  return product.purchasePriceUsd
    ? `Alış: ${formatMoneyString(product.purchasePriceUsd, "USD")}`
    : "Alış USD tanımlı değil";
};

function StokPage() {
  const queryClient = useQueryClient();
  const [type, setType] = useState<InventoryStockType>("MULTIMEDIA");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [active, setActive] = useState<"true" | "false" | "all">("true");
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<{ mode: "create" | "edit"; product?: InventoryProduct } | null>(null);
  const [adjusting, setAdjusting] = useState<InventoryProduct | null>(null);

  useEffect(() => setPage(1), [active, criticalOnly, debouncedSearch, type]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ type, active, page: String(page), pageSize: "50" });
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (criticalOnly) params.set("criticalOnly", "true");
    return params.toString();
  }, [active, criticalOnly, debouncedSearch, page, type]);

  const productsQuery = useQuery({
    queryKey: ["inventory", type, queryString],
    queryFn: () => apiRequest<InventoryListResponse>(`/api/inventory/products?${queryString}`),
  });

  const invalidateStock = () => {
    void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    void queryClient.invalidateQueries({ queryKey: ["stock"] });
  };

  const activeMutation = useMutation({
    mutationFn: (product: InventoryProduct) =>
      apiRequest<InventoryProduct>(`/api/inventory/products/${product.type}/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !product.isActive }),
      }),
    onSuccess: (product) => {
      invalidateStock();
      toast.success(product.isActive ? "Ürün yeniden aktifleştirildi" : "Ürün pasife alındı");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const products = productsQuery.data?.items ?? [];
  const lastPage = Math.max(1, Math.ceil((productsQuery.data?.total ?? 0) / 50));

  return (
    <AppLayout title="Stok Yönetimi">
      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          to="/stok/siparis-ver"
          search={{ tur: type }}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90"
        >
          <ShoppingCart className="h-4 w-4" /> Sipariş Ver
        </Link>
        <Link
          to="/stok/siparisler"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-input bg-card px-4 text-sm font-semibold hover:bg-accent"
        >
          <History className="h-4 w-4" /> Geçmiş Siparişler
        </Link>
      </div>

      <div className="card-elevated p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setType(tab)}
              className={`h-9 rounded-lg px-4 text-sm font-semibold transition-colors ${
                type === tab
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {inventoryTypeLabels[tab]}
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ürün, marka veya kod ara..."
              className={`${inputClass} pl-9`}
            />
          </div>
          <select value={active} onChange={(event) => setActive(event.target.value as typeof active)} className={`${inputClass} w-auto min-w-[140px]`}>
            <option value="true">Aktif ürünler</option>
            <option value="false">Pasif ürünler</option>
            <option value="all">Tüm ürünler</option>
          </select>
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm">
            <input type="checkbox" checked={criticalOnly} onChange={(event) => setCriticalOnly(event.target.checked)} className="accent-primary" />
            <AlertTriangle className="h-4 w-4 text-destructive" /> Sadece kritik stok
          </label>
          <button onClick={() => setEditor({ mode: "create" })} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90">
            <Plus className="h-4 w-4" /> Yeni Stok
          </button>
        </div>

        {productsQuery.isLoading && <div className="py-12 text-center text-sm text-muted-foreground">Stoklar yükleniyor...</div>}
        {productsQuery.error && <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{productsQuery.error.message}</div>}
        {!productsQuery.isLoading && !productsQuery.error && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Ürün</th>
                  <th className="px-4 py-3 text-left font-semibold">Gerçek DB bilgileri</th>
                  <th className="px-4 py-3 text-center font-semibold">Adet</th>
                  <th className="px-4 py-3 text-center font-semibold">Kritik</th>
                  <th className="px-4 py-3 text-left font-semibold">Stok durumu</th>
                  <th className="px-4 py-3 text-left font-semibold">Kayıt</th>
                  <th className="px-4 py-3 text-right font-semibold">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr
                    key={product.id}
                    className={`border-t border-border/60 transition-colors ${inventoryStockHighlightClass(product.status)}`}
                  >
                    <td className="px-4 py-3 font-semibold">{inventoryProductLabel(product)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{productSecondary(product) || "—"}</td>
                    <td className="px-4 py-3 text-center text-base font-bold">{product.quantity}</td>
                    <td className="px-4 py-3 text-center">{product.criticalStockLevel}</td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={product.status === "OUT_OF_STOCK" ? "destructive" : product.status === "CRITICAL" ? "warning" : "success"}>
                        {inventoryStatusLabels[product.status]}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={product.isActive ? "success" : "muted"}>{product.isActive ? "Aktif" : "Pasif"}</StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => setEditor({ mode: "edit", product })} className="grid h-8 w-8 place-items-center rounded-lg border border-input text-muted-foreground hover:text-primary" aria-label="Ürünü düzenle">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button disabled={!product.isActive} onClick={() => setAdjusting(product)} className="grid h-8 w-8 place-items-center rounded-lg border border-input text-muted-foreground hover:text-primary disabled:opacity-40" aria-label="Stok düzelt">
                          <PackagePlus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          disabled={activeMutation.isPending}
                          onClick={() => {
                            const action = product.isActive ? "pasife almak" : "aktifleştirmek";
                            if (window.confirm(`${inventoryProductLabel(product)} ürününü ${action} istiyor musunuz?`)) activeMutation.mutate(product);
                          }}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-input text-muted-foreground hover:text-destructive disabled:opacity-40"
                          aria-label={product.isActive ? "Pasife al" : "Aktifleştir"}
                        >
                          {product.isActive ? <Trash2 className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">Kayıt bulunamadı</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Toplam {productsQuery.data?.total ?? 0} kayıt</span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="h-9 rounded-lg border border-input px-3 disabled:opacity-40">Önceki</button>
            <span>{page} / {lastPage}</span>
            <button disabled={page >= lastPage} onClick={() => setPage((value) => Math.min(lastPage, value + 1))} className="h-9 rounded-lg border border-input px-3 disabled:opacity-40">Sonraki</button>
          </div>
        </div>
      </div>

      {editor && <ProductEditor type={type} product={editor.product} onClose={() => setEditor(null)} onSaved={invalidateStock} />}
      {adjusting && <StockAdjustment product={adjusting} onClose={() => setAdjusting(null)} onSaved={invalidateStock} />}
    </AppLayout>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-card p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

const formValue = (product: InventoryProduct | undefined, key: string): string => {
  if (!product) return "";
  const value = (product as unknown as Record<string, unknown>)[key];
  return value === null || value === undefined ? "" : String(value);
};

function ProductEditor({ type, product, onClose, onSaved }: { type: InventoryStockType; product?: InventoryProduct; onClose: () => void; onSaved: () => void }) {
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      product
        ? apiRequest<InventoryProduct>(`/api/inventory/products/${product.type}/${product.id}`, { method: "PATCH", body: JSON.stringify(payload) })
        : apiRequest<InventoryProduct>("/api/inventory/products", { method: "POST", body: JSON.stringify({ type, ...payload }) }),
    onSuccess: () => {
      onSaved();
      toast.success(product ? "Ürün güncellendi" : "Yeni ürün oluşturuldu");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (key: string) => String(data.get(key) ?? "").trim();
    const nullable = (key: string) => text(key) || null;
    const integer = (key: string) => Number(text(key) || 0);
    let payload: Record<string, unknown>;
    if (type === "MULTIMEDIA") {
      payload = { code: text("code"), brand: text("brand"), model: nullable("model"), forx: nullable("forx"), shelf: nullable("shelf"), criticalStockLevel: integer("criticalStockLevel") };
    } else if (type === "SCREEN") {
      payload = {
        brand: text("brand"),
        storageGb: text("storageGb") ? integer("storageGb") : null,
        ramGb: text("ramGb") ? integer("ramGb") : null,
        cores: text("cores") ? integer("cores") : null,
        sizeInch: nullable("sizeInch"),
        sizeLabel: nullable("sizeLabel"),
        criticalStockLevel: integer("criticalStockLevel"),
      };
    } else {
      payload = { name: text("name"), purchasePriceUsd: text("purchasePriceUsd"), criticalStockLevel: integer("criticalStockLevel") };
    }
    if (!product) payload.initialQuantity = integer("initialQuantity");
    mutation.mutate(payload);
  };

  return (
    <Modal title={product ? "Ürün Bilgilerini Düzenle" : `Yeni ${inventoryTypeLabels[type]} Ürünü`} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3">
        {type === "MULTIMEDIA" && (
          <>
            <Field name="code" label="Ürün kodu *" defaultValue={formValue(product, "code")} required />
            <Field name="brand" label="Marka *" defaultValue={formValue(product, "brand")} required />
            <Field name="model" label="Model" defaultValue={formValue(product, "model")} />
            <Field name="forx" label="FORX" defaultValue={formValue(product, "forx")} />
            <Field name="shelf" label="Raf" defaultValue={formValue(product, "shelf")} />
          </>
        )}
        {type === "SCREEN" && (
          <>
            <Field name="brand" label="Marka *" defaultValue={formValue(product, "brand")} required />
            <div className="grid grid-cols-3 gap-3">
              <Field name="storageGb" label="Hafıza GB" type="number" defaultValue={formValue(product, "storageGb")} />
              <Field name="ramGb" label="RAM GB" type="number" defaultValue={formValue(product, "ramGb")} />
              <Field name="cores" label="Çekirdek" type="number" defaultValue={formValue(product, "cores")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field name="sizeInch" label="Boyut (inç)" type="number" step="0.01" defaultValue={formValue(product, "sizeInch")} />
              <Field name="sizeLabel" label="Boyut etiketi" defaultValue={formValue(product, "sizeLabel")} />
            </div>
          </>
        )}
        {type === "SOUND_SYSTEM" && (
          <>
            <Field name="name" label="Ürün adı *" defaultValue={formValue(product, "name")} required />
            <Field name="purchasePriceUsd" label="Alış USD *" type="number" step="0.01" defaultValue={formValue(product, "purchasePriceUsd")} required />
          </>
        )}
        <div className={`grid gap-3 ${product ? "grid-cols-1" : "grid-cols-2"}`}>
          <Field name="criticalStockLevel" label="Kritik stok" type="number" defaultValue={formValue(product, "criticalStockLevel") || "0"} required />
          {!product && <Field name="initialQuantity" label="İlk adet" type="number" defaultValue="0" required />}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-input px-4 text-sm font-semibold">İptal</button>
          <button disabled={mutation.isPending} className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">{mutation.isPending ? "Kaydediliyor..." : "Kaydet"}</button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ name, label, defaultValue, type = "text", step, required }: { name: string; label: string; defaultValue?: string; type?: string; step?: string; required?: boolean }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
      {label}
      <input name={name} type={type} min={type === "number" ? "0" : undefined} step={step} defaultValue={defaultValue} required={required} className={inputClass} />
    </label>
  );
}

function StockAdjustment({ product, onClose, onSaved }: { product: InventoryProduct; onClose: () => void; onSaved: () => void }) {
  const [quantityDelta, setQuantityDelta] = useState("");
  const [note, setNote] = useState("");
  const mutation = useMutation({
    mutationFn: () => apiRequest<InventoryProduct>(`/api/inventory/products/${product.type}/${product.id}/adjust-stock`, { method: "POST", body: JSON.stringify({ quantityDelta: Number(quantityDelta), note: note.trim() || null }) }),
    onSuccess: () => {
      onSaved();
      toast.success("Manuel stok düzeltmesi kaydedildi");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <Modal title="Manuel Stok Düzeltme" onClose={onClose}>
      <div className="mb-4 rounded-lg bg-muted/60 p-3 text-sm">{inventoryProductLabel(product)} · Mevcut stok: <b>{product.quantity}</b></div>
      <div className="grid gap-3">
        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">Signed miktar (+5 / -2)<input type="number" value={quantityDelta} onChange={(event) => setQuantityDelta(event.target.value)} className={inputClass} /></label>
        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">Açıklama<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} className="min-h-24 rounded-lg border border-input bg-background p-3 text-sm" /></label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="h-10 rounded-lg border border-input px-4 text-sm font-semibold">Vazgeç</button>
        <button disabled={mutation.isPending || !quantityDelta || Number(quantityDelta) === 0} onClick={() => mutation.mutate()} className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">Düzeltmeyi Kaydet</button>
      </div>
    </Modal>
  );
}
