import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useState, type FormEvent } from "react";
import { ChevronDown, ChevronRight, Save } from "lucide-react";
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
    <TableCell className="whitespace-nowrap">{dateLabel(entry.date)}</TableCell>
    <TableCell>{entry.supplierName}</TableCell><TableCell className="text-right">{entry.quantity}</TableCell>
    <TableCell className="whitespace-nowrap text-right">{money(entry.purchasePrice)}</TableCell>
    <TableCell className="whitespace-nowrap text-right">{money(entry.salePrice)}</TableCell>
    <TableCell className="whitespace-nowrap text-right">{money(entry.estimatedUnitProfit)}</TableCell>
    <TableCell className="min-w-36 max-w-64 whitespace-pre-wrap break-words">{entry.note || "—"}</TableCell>
  </>;
}
function ProductHistory({ product }: { product: GoodsProduct }) {
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ["goods-entry", "history", product.id, page], queryFn: () => apiRequest<GoodsPage<GoodsEntry>>(`${base}/products/${product.id}/history?page=${page}`) });
  return <>
    {query.isPending && <TableRow className="bg-yellow-50/70 dark:bg-yellow-950/20"><TableCell colSpan={8}>Geçmiş yükleniyor…</TableCell></TableRow>}
    {query.error && <TableRow><TableCell colSpan={8}><ErrorMessage error={query.error} /></TableCell></TableRow>}
    {query.data?.items.map(entry => <TableRow key={entry.id} className="bg-yellow-50/70 hover:bg-yellow-50 dark:bg-yellow-950/20">
      <TableCell className="pl-8 text-muted-foreground">↳ Geçmiş</TableCell><EntryCells entry={entry} />
    </TableRow>)}
    {query.data && query.data.total > 50 && <TableRow className="bg-yellow-50/70 dark:bg-yellow-950/20"><TableCell colSpan={8}><Pager page={page} total={query.data.total} onChange={setPage} /></TableCell></TableRow>}
  </>;
}
function Statistics() {
  const [productPage, setProductPage] = useState(1);
  const [supplierPage, setSupplierPage] = useState(1);
  const products = useQuery({ queryKey: ["goods-entry", "statistics", "products", productPage], queryFn: () => apiRequest<GoodsPage<GoodsProductTotal>>(`${base}/statistics?page=${productPage}`) });
  const suppliers = useQuery({ queryKey: ["goods-entry", "statistics", "suppliers", supplierPage], queryFn: () => apiRequest<GoodsPage<GoodsSupplierTotal>>(`${base}/statistics?group=suppliers&page=${supplierPage}`) });
  return <div className="space-y-4">
    <section className="rounded-xl border bg-card">
      <h2 className="p-4 font-semibold">Mal Girişi İstatistikleri</h2>
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
      return apiRequest<GoodsEntry>(`${base}/entries`, { method: "POST", body: JSON.stringify({ ...form, productId: form.productId || product?.id || undefined, quantity: Number(form.quantity), purchasePrice: form.purchasePrice.replace(",", "."), salePrice: form.salePrice.replace(",", ".") }) });
    },
    onSuccess: async () => { setForm(emptyForm()); setExpanded(new Set()); toast.success("Mal girişi kaydedildi"); await client.invalidateQueries({ queryKey: ["goods-entry"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const submit = (event: FormEvent) => { event.preventDefault(); if (!save.isPending) save.mutate(); };
  return <AppLayout title="Mal Girişi">
    <div className="space-y-5">
      <form onSubmit={submit} className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="mb-4 font-semibold">Yeni Mal Girişi</h2>
        <fieldset disabled={save.isPending} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="goods-product">Ürün</Label><Input id="goods-product" businessText required maxLength={200} list="goods-products" autoComplete="off" value={form.productName} onChange={event => setForm({ ...form, productName: event.target.value, productId: "" })} placeholder="Ürün adı yazın veya seçin" /><datalist id="goods-products">{suggestions.data?.items.map(product => <option key={product.id} value={product.name} />)}</datalist></div>
          <div className="space-y-1.5"><Label htmlFor="goods-date">Tarih</Label><Input id="goods-date" type="date" required value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="goods-supplier">Toptancı</Label><Input id="goods-supplier" businessText required maxLength={200} value={form.supplierName} onChange={event => setForm({ ...form, supplierName: event.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="goods-purchase">Alış Fiyatı (₺)</Label><Input id="goods-purchase" inputMode="decimal" required pattern="[0-9]{1,12}([.,][0-9]{1,2})?" placeholder="0,00" value={form.purchasePrice} onChange={event => setForm({ ...form, purchasePrice: event.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="goods-sale">Satış Fiyatı (₺)</Label><Input id="goods-sale" inputMode="decimal" required pattern="[0-9]{1,12}([.,][0-9]{1,2})?" placeholder="0,00" value={form.salePrice} onChange={event => setForm({ ...form, salePrice: event.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="goods-quantity">Adet</Label><Input id="goods-quantity" type="number" min={1} max={2147483647} step={1} required value={form.quantity} onChange={event => setForm({ ...form, quantity: event.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-2 xl:col-span-4"><Label htmlFor="goods-note">Not</Label><Textarea id="goods-note" businessText maxLength={2000} rows={2} value={form.note} onChange={event => setForm({ ...form, note: event.target.value })} /></div>
          <Button type="submit" className="self-end"><Save className="mr-2 h-4 w-4" />{save.isPending ? "Kaydediliyor…" : "Kaydet"}</Button>
        </fieldset>
      </form>
      <Tabs defaultValue="entries"><TabsList><TabsTrigger value="entries">Mal Girişleri</TabsTrigger><TabsTrigger value="statistics">İstatistikler</TabsTrigger></TabsList>
        <TabsContent value="entries" className="space-y-3">
          <Label htmlFor="goods-search" className="sr-only">Mal girişlerinde ara</Label><Input id="goods-search" type="search" placeholder="Ürün, toptancı, tarih (GG.AA.YYYY) veya not ara…" value={search} onChange={event => setSearch(event.target.value)} />
          <section className="overflow-hidden rounded-xl border bg-card">
            <ErrorMessage error={products.error} />
            <Table><TableHeader><TableRow>{["Ürün", "Son Giriş Tarihi", "Son Toptancı", "Son Adet", "Son Alış Fiyatı", "Son Satış Fiyatı", "Tahmini Birim Kâr", "Not"].map(label => <TableHead className="whitespace-nowrap" key={label}>{label}</TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {products.data?.items.map(product => <Fragment key={product.id}><TableRow>
                  <TableCell className="min-w-52"><div className="font-medium">{product.name}</div><div className="mt-1 flex flex-wrap gap-1">
                    {product.entryCount > 1 && <Button type="button" size="sm" variant="ghost" aria-expanded={expanded.has(product.id)} aria-label={`${product.name} geçmişi`} onClick={() => setExpanded(current => { const next = new Set(current); if (next.has(product.id)) next.delete(product.id); else next.add(product.id); return next; })}>{expanded.has(product.id) ? <ChevronDown className="mr-1 h-3 w-3" /> : <ChevronRight className="mr-1 h-3 w-3" />}Geçmiş ({product.entryCount - 1})</Button>}
                    <Button type="button" size="sm" variant="ghost" disabled={save.isPending} onClick={() => { setForm({ ...emptyForm(), productId: product.id, productName: product.name }); document.getElementById("goods-date")?.focus(); }}>Yeni giriş</Button>
                  </div></TableCell>
                  {product.latestEntry && <EntryCells entry={product.latestEntry} />}
                </TableRow>{expanded.has(product.id) && <ProductHistory product={product} />}</Fragment>)}
                {(products.isPending || products.data?.total === 0) && <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">{products.isPending ? "Yükleniyor…" : filter ? "Aramanızla eşleşen ürün bulunamadı." : "Henüz mal girişi yok. İlk kaydı yukarıdaki formdan ekleyin."}</TableCell></TableRow>}
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
