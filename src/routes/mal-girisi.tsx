import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useState, type FormEvent } from "react";
import { ChevronDown, ChevronRight, History, Pencil, Plus, Save, Search, X } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/api";
import { formatMoneyString } from "@/lib/money";
import { toBusinessUppercase } from "@/lib/business-text";
import type { GoodsEntry, GoodsPage, GoodsProduct, GoodsProductTotal, GoodsSupplierTotal } from "@/types/goods-entry";

export const Route = createFileRoute("/mal-girisi")({ component: GoodsEntryPage });
const base = "/api/goods-entry";
const money = (value: string) => formatMoneyString(value, "TRY");
const dateLabel = (value: string) => value.split("-").reverse().join(".");
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const emptyForm = () => ({ productId: "", productName: "", date: today(), supplierName: "", purchasePrice: "", salePrice: "", quantity: "1", note: "" });
const normalize = (value: string) => value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR").replace(/İ/g, "I");

function Pager({ page, total, pageSize = 50, onChange }: { page: number; total: number; pageSize?: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <div className="flex flex-wrap items-center justify-end gap-3 p-3 text-sm">
    <span className="text-muted-foreground">{total} kayıt · Sayfa {page} / {pages}</span>
    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Önceki</Button>
    <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Sonraki</Button>
  </div>;
}
function ErrorMessage({ error }: { error: Error | null }) {
  return error ? <p role="alert" className="p-3 text-sm text-destructive">{error.message}</p> : null;
}
function EntryCells({ entry }: { entry: GoodsEntry }) {
  return <>
    <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">{dateLabel(entry.date)}</TableCell>
    <TableCell className="min-w-28 font-medium">{entry.supplierName}</TableCell>
    <TableCell className="text-right tabular-nums"><span className="inline-flex rounded-md bg-muted px-2 py-1 font-semibold">{entry.quantity}</span></TableCell>
    <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">{money(entry.purchasePrice)}</TableCell>
    <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">{money(entry.salePrice)}</TableCell>
    <TableCell className={`whitespace-nowrap text-right font-semibold tabular-nums ${entry.estimatedUnitProfit.startsWith("-") ? "text-destructive" : "text-primary"}`}>{money(entry.estimatedUnitProfit)}</TableCell>
    <TableCell className="min-w-36 max-w-56 whitespace-pre-wrap break-words text-xs text-muted-foreground">{entry.note || "—"}</TableCell>
  </>;
}
function ProductHistory({ product }: { product: GoodsProduct }) {
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ["goods-entry", "history", product.id, page], queryFn: () => apiRequest<GoodsPage<GoodsEntry>>(`${base}/products/${product.id}/history?page=${page}`) });
  return <>
    <TableRow className="bg-yellow-50/70 dark:bg-yellow-950/20"><TableCell colSpan={9} className="py-3"><div className="flex items-center gap-2 text-xs font-medium"><History className="h-3.5 w-3.5" />{product.name} · Önceki girişler ve düzenlemeler</div></TableCell></TableRow>
    {query.isPending && <TableRow className="bg-yellow-50/70 dark:bg-yellow-950/20"><TableCell colSpan={9}>Geçmiş yükleniyor…</TableCell></TableRow>}
    {query.error && <TableRow><TableCell colSpan={9}><ErrorMessage error={query.error} /></TableCell></TableRow>}
    {query.data?.items.map(entry => <TableRow key={entry.id} className="bg-yellow-50/70 hover:bg-yellow-50 dark:bg-yellow-950/20">
      <TableCell className="border-l-2 border-yellow-200 pl-5"><div className="text-xs text-muted-foreground">{entry.supersedesId ? "Düzenleme" : "Mal girişi"}</div><div className="mt-1 text-sm font-medium">{entry.productName || product.name}</div></TableCell><EntryCells entry={entry} />
      <TableCell className="whitespace-nowrap text-right text-xs text-muted-foreground"><div>Kaydedilme</div><div className="mt-1">{new Date(entry.createdAt).toLocaleString("tr-TR")}</div></TableCell>
    </TableRow>)}
    {query.data && query.data.total > 50 && <TableRow className="bg-yellow-50/70 dark:bg-yellow-950/20"><TableCell colSpan={9}><Pager page={page} total={query.data.total} onChange={setPage} /></TableCell></TableRow>}
  </>;
}
function Statistics() {
  const [productPage, setProductPage] = useState(1);
  const [supplierPage, setSupplierPage] = useState(1);
  const products = useQuery({ queryKey: ["goods-entry", "statistics", "products", productPage], queryFn: () => apiRequest<GoodsPage<GoodsProductTotal>>(`${base}/statistics?page=${productPage}`) });
  const suppliers = useQuery({ queryKey: ["goods-entry", "statistics", "suppliers", supplierPage], queryFn: () => apiRequest<GoodsPage<GoodsSupplierTotal>>(`${base}/statistics?group=suppliers&page=${supplierPage}`) });
  return <div className="space-y-4">
    <section className="rounded-xl border bg-card">
      <div className="p-4"><h2 className="font-semibold">Mal Girişi İstatistikleri</h2><p className="mt-1 text-xs text-muted-foreground">Tüm mal alımları hesaplanır. Düzenlenen kayıtların yalnızca son sürümü toplamlara dahildir.</p></div>
      <ErrorMessage error={products.error} />
      <Table><TableHeader><TableRow>{["Ürün", "Toplam Adet", "Toplam Alış", "Toplam Potansiyel Satış", "Tahmini Kâr"].map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{products.data?.items.map(row => <TableRow key={row.id}><TableCell className="font-medium">{row.name}</TableCell><TableCell>{row.totalQuantity}</TableCell><TableCell>{money(row.totalPurchase)}</TableCell><TableCell>{money(row.totalPotentialSale)}</TableCell><TableCell>{money(row.estimatedProfit)}</TableCell></TableRow>)}
          {(products.isPending || products.data?.total === 0) && <TableRow><TableCell colSpan={5}>{products.isPending ? "Yükleniyor…" : "Henüz mal girişi yok."}</TableCell></TableRow>}
        </TableBody></Table>
      {products.data && <Pager page={productPage} total={products.data.total} onChange={setProductPage} />}
    </section>
    <section className="rounded-xl border bg-card">
      <h2 className="p-4 font-semibold">Toptancı Bazında Özet</h2><ErrorMessage error={suppliers.error} />
      <Table><TableHeader><TableRow>{["Toptancı", "Toplam Alınan Adet", "Toplam Alış Tutarı", "Kayıt Sayısı"].map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{suppliers.data?.items.map(row => <TableRow key={row.supplierName}><TableCell className="font-medium">{row.supplierName}</TableCell><TableCell>{row.totalQuantity}</TableCell><TableCell>{money(row.totalPurchase)}</TableCell><TableCell>{row.entryCount}</TableCell></TableRow>)}
          {(suppliers.isPending || suppliers.data?.total === 0) && <TableRow><TableCell colSpan={4}>{suppliers.isPending ? "Yükleniyor…" : "Henüz toptancı kaydı yok."}</TableCell></TableRow>}
        </TableBody></Table>
      {suppliers.data && <Pager page={supplierPage} total={suppliers.data.total} onChange={setSupplierPage} />}
    </section>
  </div>;
}

function GoodsEntryPage() {
  const client = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  useEffect(() => { const timer = setTimeout(() => { setFilter(search); setPage(1); setExpanded(new Set()); }, 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => { const timer = setTimeout(() => setProductSearch(form.productName), 250); return () => clearTimeout(timer); }, [form.productName]);
  const products = useQuery({ queryKey: ["goods-entry", "products", filter, page], queryFn: () => apiRequest<GoodsPage<GoodsProduct>>(`${base}/products?search=${encodeURIComponent(filter)}&page=${page}`) });
  const suggestions = useQuery({ queryKey: ["goods-entry", "suggestions", productSearch], queryFn: () => apiRequest<GoodsPage<GoodsProduct>>(`${base}/products?search=${encodeURIComponent(productSearch)}&pageSize=10`), enabled: productSearch.trim().length > 0 });
  const save = useMutation({
    mutationFn: () => {
      const product = suggestions.data?.items.find(item => item.normalizedName === normalize(form.productName));
      const path = editingId ? `${base}/entries/${encodeURIComponent(editingId)}/revisions` : `${base}/entries`;
      return apiRequest<GoodsEntry>(path, { method: "POST", body: JSON.stringify({ ...form, productId: form.productId || product?.id || undefined, quantity: Number(form.quantity), purchasePrice: form.purchasePrice.replace(",", "."), salePrice: form.salePrice.replace(",", ".") }) });
    },
    onSuccess: async (entry) => { const wasEditing = Boolean(editingId); setForm(emptyForm()); setEditingId(null); setExpanded(wasEditing ? new Set([entry.productId]) : new Set()); toast.success(wasEditing ? "Düzenleme kaydedildi. Önceki sürüm geçmişte korundu." : "Mal girişi kaydedildi"); await client.invalidateQueries({ queryKey: ["goods-entry"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const submit = (event: FormEvent) => { event.preventDefault(); if (!save.isPending) save.mutate(); };
  const openEditor = (product: GoodsProduct) => {
    const entry = product.latestEntry;
    if (!entry) return;
    setEditingId(entry.id);
    setForm({ productId: product.id, productName: toBusinessUppercase(product.name), date: entry.date, supplierName: toBusinessUppercase(entry.supplierName), purchasePrice: entry.purchasePrice, salePrice: entry.salePrice, quantity: String(entry.quantity), note: toBusinessUppercase(entry.note || "") });
    document.getElementById("goods-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("goods-product")?.focus({ preventScroll: true });
  };
  return <AppLayout title="Mal Girişi">
    <div className="space-y-5">
      <form id="goods-form" onSubmit={submit} className={`scroll-mt-44 rounded-xl border bg-card p-4 shadow-sm md:p-5 ${editingId ? "border-primary/50 ring-1 ring-primary/10" : ""}`}>
        <div className="mb-5 flex items-start justify-between gap-3">
          <div><h2 className="flex items-center gap-2 font-semibold">{editingId ? <Pencil className="h-4 w-4 text-primary" /> : <Plus className="h-4 w-4 text-primary" />}{editingId ? "Mal Girişini Düzenle" : "Yeni Mal Girişi"}</h2><p className="mt-1 text-xs text-muted-foreground">{editingId ? "Değişiklikler yeni sürüm olarak kaydedilir. Önceki bilgiler geçmişte kalır." : "Yeni alım bilgilerini girin veya tablodan bir ürün seçin."}</p></div>
          {editingId && <Button type="button" variant="ghost" size="sm" disabled={save.isPending} onClick={() => { setEditingId(null); setForm(emptyForm()); }}><X className="mr-1 h-4 w-4" />Vazgeç</Button>}
        </div>
        <fieldset disabled={save.isPending} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="goods-product">Ürün</Label><Input id="goods-product" businessText required maxLength={200} list={editingId ? undefined : "goods-products"} autoComplete="off" value={form.productName} onChange={event => setForm({ ...form, productName: event.target.value, productId: editingId ? form.productId : "" })} placeholder="Ürün adı yazın veya seçin" /><datalist id="goods-products">{suggestions.data?.items.map(product => <option key={product.id} value={product.name} />)}</datalist></div>
          <div className="space-y-1.5"><Label htmlFor="goods-date">Tarih</Label><Input id="goods-date" type="date" required value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="goods-supplier">Toptancı</Label><Input id="goods-supplier" businessText required maxLength={200} value={form.supplierName} onChange={event => setForm({ ...form, supplierName: event.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="goods-purchase">Alış Fiyatı (₺)</Label><Input id="goods-purchase" inputMode="decimal" required pattern="[0-9]{1,12}([.,][0-9]{1,2})?" placeholder="0,00" value={form.purchasePrice} onChange={event => setForm({ ...form, purchasePrice: event.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="goods-sale">Satış Fiyatı (₺)</Label><Input id="goods-sale" inputMode="decimal" required pattern="[0-9]{1,12}([.,][0-9]{1,2})?" placeholder="0,00" value={form.salePrice} onChange={event => setForm({ ...form, salePrice: event.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="goods-quantity">Adet</Label><Input id="goods-quantity" type="number" min={1} max={2147483647} step={1} required value={form.quantity} onChange={event => setForm({ ...form, quantity: event.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-2 xl:col-span-4"><Label htmlFor="goods-note">Not</Label><Textarea id="goods-note" businessText maxLength={2000} rows={2} value={form.note} onChange={event => setForm({ ...form, note: event.target.value })} /></div>
          <Button type="submit" className="self-end"><Save className="mr-2 h-4 w-4" />{save.isPending ? "Kaydediliyor…" : editingId ? "Düzenlemeyi Kaydet" : "Kaydet"}</Button>
        </fieldset>
      </form>
      <Tabs defaultValue="entries"><TabsList><TabsTrigger value="entries">Mal Girişleri</TabsTrigger><TabsTrigger value="statistics">İstatistikler</TabsTrigger></TabsList>
        <TabsContent value="entries" className="space-y-3">
          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-col gap-3 border-b bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="font-semibold">Ürünler <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{products.data?.total ?? "…"}</span></h2><p className="mt-1 text-xs text-muted-foreground">Her ürünün güncel bilgileri · Fiyatlar birim tutardır.</p></div>
              <div className="relative w-full sm:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Label htmlFor="goods-search" className="sr-only">Mal girişlerinde ara</Label><Input id="goods-search" businessText className="bg-background pl-9" placeholder="Ürün, toptancı, tarih veya not ara…" value={search} onChange={event => setSearch(event.target.value)} /></div>
            </div>
            <ErrorMessage error={products.error} />
            <Table><TableHeader className="bg-muted/40"><TableRow>{["Ürün / Geçmiş", "Giriş Tarihi", "Toptancı", "Adet", "Alış", "Satış", "Birim Kâr", "Not", "İşlemler"].map((label, index) => <TableHead className={`h-11 whitespace-nowrap text-xs font-semibold ${[3, 4, 5, 6, 8].includes(index) ? "text-right" : ""}`} key={label}>{label}</TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {products.data?.items.map(product => <Fragment key={product.id}><TableRow className={expanded.has(product.id) ? "bg-muted/30" : "hover:bg-muted/20"}>
                  <TableCell className="min-w-52 py-4"><div className="font-semibold">{product.name}</div><div className="mt-1 flex flex-wrap items-center gap-1">
                    {product.entryCount > 1 && <Button type="button" size="sm" variant="ghost" aria-expanded={expanded.has(product.id)} aria-label={`${product.name} geçmişi`} onClick={() => setExpanded(current => { const next = new Set(current); if (next.has(product.id)) next.delete(product.id); else next.add(product.id); return next; })}>{expanded.has(product.id) ? <ChevronDown className="mr-1 h-3 w-3" /> : <ChevronRight className="mr-1 h-3 w-3" />}Geçmiş ({product.entryCount - 1})</Button>}
                    {product.entryCount === 1 && <span className="py-1 text-xs text-muted-foreground">İlk kayıt</span>}
                  </div></TableCell>
                  {product.latestEntry ? <EntryCells entry={product.latestEntry} /> : <TableCell colSpan={7}>Giriş bilgisi yok</TableCell>}
                  <TableCell className="text-right"><div className="flex justify-end gap-2">
                    <Button type="button" size="sm" variant="outline" disabled={save.isPending || !product.latestEntry} onClick={() => openEditor(product)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Düzenle</Button>
                    <Button type="button" size="sm" variant="ghost" disabled={save.isPending} onClick={() => { setEditingId(null); setForm({ ...emptyForm(), productId: product.id, productName: toBusinessUppercase(product.name) }); document.getElementById("goods-form")?.scrollIntoView({ behavior: "smooth", block: "start" }); document.getElementById("goods-date")?.focus({ preventScroll: true }); }}><Plus className="mr-1 h-3.5 w-3.5" />Yeni giriş</Button>
                  </div><div className="mt-1 text-xs text-muted-foreground">{product.latestEntry?.supersedesId ? "Düzenlenmiş kayıt" : "Güncel giriş"}</div></TableCell>
                </TableRow>{expanded.has(product.id) && <ProductHistory product={product} />}</Fragment>)}
                {(products.isPending || products.data?.total === 0) && <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">{products.isPending ? "Yükleniyor…" : filter ? "Aramanızla eşleşen ürün bulunamadı." : "Henüz mal girişi yok. İlk kaydı yukarıdaki formdan ekleyin."}</TableCell></TableRow>}
              </TableBody>
            </Table>
            {products.data && <Pager page={page} total={products.data.total} onChange={next => { setPage(next); setExpanded(new Set()); }} />}
          </section>
        </TabsContent>
        <TabsContent value="statistics"><Statistics /></TabsContent>
      </Tabs>
    </div>
  </AppLayout>;
}
