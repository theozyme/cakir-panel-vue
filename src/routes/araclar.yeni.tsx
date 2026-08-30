import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Save } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { ApiError, apiRequest } from "@/lib/api";
import { formatMoneyString } from "@/lib/money";
import type { Currency, MultimediaProduct, OperationType, PaymentMethod, PendingVehicle, ScreenProduct, SoundOffer, Supplier, VehicleIntakeContext, VehicleOperationDetail } from "@/types/business";

type OperationSearch = { pendingVehicleId?: string; vehicleId?: string; operationId?: string; soundOfferId?: string };
export const Route = createFileRoute("/araclar/yeni")({
  validateSearch: (search: Record<string, unknown>): OperationSearch => ({
    ...(typeof search.pendingVehicleId === "string" ? { pendingVehicleId: search.pendingVehicleId } : {}),
    ...(typeof search.vehicleId === "string" ? { vehicleId: search.vehicleId } : {}),
    ...(typeof search.operationId === "string" ? { operationId: search.operationId } : {}),
    ...(typeof search.soundOfferId === "string" ? { soundOfferId: search.soundOfferId } : {}),
  }),
  head: () => ({ meta: [{ title: "Araç İşlemi · Çakır Oto" }] }),
  component: VehicleOperationForm,
});

const operationTypes: Array<{ value: OperationType; label: string }> = [
  ["MULTIMEDIA", "Multimedya"], ["SOUND_SYSTEM", "Ses Sistemi"], ["HIDDEN_FEATURE_ACTIVATION", "Gizli Özellik Aktivasyonu"],
  ["REAR_VIEW_CAMERA", "Geri Görüş Kamerası"], ["ANDROID_BOX", "Android Box"], ["DASH_CAMERA", "Kayıt Kamerası"],
  ["BULB", "Ampul"], ["LED_XENON", "LED Xenon"], ["BATTERY", "Akü"], ["WIPER", "Silecek"], ["LABOR", "İşçilik"],
  ["CAR_STEREO", "Teyp"], ["STEERING_WHEEL_COVER", "Direksiyon Kılıfı"], ["WINDOW_FILM", "Cam Filmi"],
  ["PPF_COATING", "PPF Kaplama"], ["POWER_TAILGATE", "Elektrikli Bagaj"], ["SERVICE", "Servis"],
  ["ACCESSORY", "Aksesuar"], ["OTHER", "Diğer"],
].map(([value, label]) => ({ value: value as OperationType, label }));
const inputClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary";
const toLocalDateTime = (value: string | Date) => { const date = new Date(value); const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000); return local.toISOString().slice(0, 16); };
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>{children}</label>; }
type Draft = { phone: string; firstName: string; lastName: string; customerNote: string; brand: string; model: string; operationType: OperationType; description: string; price: string; paymentMethod: PaymentMethod; multimediaProductId: string; screenProductId: string; supplierId: string; operationNote: string; operationAt: string; savedAt: number };
const invalidationRoots = ["vehicle-operations", "vehicle-history", "daily-operations", "pending-vehicles", "inventory", "stock", "sound-offer", "sound-offers", "suppliers", "mail-order", "reports", "dashboard"];

function VehicleOperationForm() {
  const { pendingVehicleId, vehicleId, operationId, soundOfferId } = Route.useSearch();
  const isEdit = Boolean(operationId); const contextCount = [pendingVehicleId, vehicleId, operationId].filter(Boolean).length;
  const contextKey = operationId ? `edit:${operationId}` : pendingVehicleId ? `pending:${pendingVehicleId}` : vehicleId ? `vehicle:${vehicleId}` : "invalid";
  const navigate = useNavigate(); const queryClient = useQueryClient(); const initialized = useRef("");
  const [phone, setPhone] = useState(""); const [firstName, setFirstName] = useState(""); const [lastName, setLastName] = useState("");
  const [customerNote, setCustomerNote] = useState(""); const [brand, setBrand] = useState(""); const [model, setModel] = useState("");
  const [operationType, setOperationType] = useState<OperationType>("MULTIMEDIA"); const [description, setDescription] = useState("");
  const [price, setPrice] = useState(""); const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [multimediaProductId, setMultimediaProductId] = useState(""); const [screenProductId, setScreenProductId] = useState("");
  const [supplierId, setSupplierId] = useState(""); const [operationNote, setOperationNote] = useState(""); const [operationAt, setOperationAt] = useState(toLocalDateTime(new Date()));

  const pendingQuery = useQuery({ queryKey: ["pending-vehicle", pendingVehicleId], queryFn: () => apiRequest<PendingVehicle>(`/api/pending-vehicles/${pendingVehicleId}`), enabled: Boolean(pendingVehicleId) });
  const intakeQuery = useQuery({ queryKey: ["vehicle-intake", vehicleId], queryFn: () => apiRequest<VehicleIntakeContext>(`/api/vehicles/${vehicleId}/intake-context`), enabled: Boolean(vehicleId) });
  const detailQuery = useQuery({ queryKey: ["vehicle-operation", operationId], queryFn: () => apiRequest<VehicleOperationDetail>(`/api/vehicle-operations/${operationId}`), enabled: Boolean(operationId) });
  const context = useMemo<VehicleIntakeContext | null>(() => {
    if (detailQuery.data) return { vehicle: { id: detailQuery.data.vehicleId, plate: detailQuery.data.plate, ...detailQuery.data.vehicle }, customer: detailQuery.data.customer ? { id: "", ...detailQuery.data.customer } : null };
    if (intakeQuery.data) return intakeQuery.data;
    if (pendingQuery.data) return { vehicle: { id: "", plate: pendingQuery.data.plate, brand: null, model: null }, customer: null };
    return null;
  }, [detailQuery.data, intakeQuery.data, pendingQuery.data]);
  const selectedOfferId = soundOfferId ?? detailQuery.data?.soundOfferId ?? undefined;
  const offerQuery = useQuery({ queryKey: ["sound-offer", selectedOfferId], queryFn: () => apiRequest<SoundOffer>(`/api/sound-offers/${selectedOfferId}`), enabled: Boolean(selectedOfferId) });
  const multimediaQuery = useQuery({ queryKey: ["stock", "multimedia", "operation-form"], queryFn: () => apiRequest<MultimediaProduct[]>("/api/stock/multimedia-products?inStock=false"), enabled: operationType === "MULTIMEDIA" });
  const screenQuery = useQuery({ queryKey: ["stock", "screen", "operation-form"], queryFn: () => apiRequest<ScreenProduct[]>("/api/stock/screen-products?inStock=false"), enabled: operationType === "MULTIMEDIA" });
  const supplierQuery = useQuery({ queryKey: ["suppliers"], queryFn: () => apiRequest<Supplier[]>("/api/suppliers?active=true"), enabled: paymentMethod === "MAIL_ORDER" });

  useEffect(() => {
    if (!context || initialized.current === contextKey) return;
    const key = `vehicle-operation-draft:${contextKey}`; const stored = sessionStorage.getItem(key);
    if (stored) { try { const draft = JSON.parse(stored) as Draft; if (Date.now() - draft.savedAt < 86_400_000) {
      setPhone(draft.phone); setFirstName(draft.firstName); setLastName(draft.lastName); setCustomerNote(draft.customerNote); setBrand(draft.brand); setModel(draft.model);
      setOperationType(draft.operationType); setDescription(draft.description); setPrice(draft.price); setPaymentMethod(draft.paymentMethod);
      setMultimediaProductId(draft.multimediaProductId); setScreenProductId(draft.screenProductId); setSupplierId(draft.supplierId); setOperationNote(draft.operationNote); setOperationAt(draft.operationAt);
      initialized.current = contextKey; return;
    } } catch { /* discard invalid draft */ } sessionStorage.removeItem(key); }
    const detail = detailQuery.data;
    setPhone(context.customer?.phone ?? ""); setFirstName(context.customer?.firstName ?? ""); setLastName(context.customer?.lastName ?? ""); setCustomerNote(context.customer?.note ?? ""); setBrand(context.vehicle.brand ?? ""); setModel(context.vehicle.model ?? "");
    if (detail) { setOperationType(detail.operationType ?? "OTHER"); setDescription(detail.description); setPrice(detail.price); setPaymentMethod(detail.paymentMethod); setMultimediaProductId(detail.multimediaProductId ?? ""); setScreenProductId(detail.screenProductId ?? ""); setSupplierId(detail.mailOrderSupplierId ?? ""); setOperationNote(detail.note ?? ""); setOperationAt(toLocalDateTime(detail.operationAt)); }
    initialized.current = contextKey;
  }, [context, contextKey, detailQuery.data]);
  useEffect(() => { if (offerQuery.data) { setOperationType("SOUND_SYSTEM"); setPrice(offerQuery.data.finalTotal); setDescription((value) => value || "Ses sistemi"); } }, [offerQuery.data]);

  const selectedSupplier = supplierQuery.data?.find((supplier) => supplier.id === supplierId);
  const currentSupplierCurrency =
    detailQuery.data?.mailOrderSupplier?.id === supplierId
      ? (detailQuery.data.mailOrderSupplier.currency as Currency)
      : undefined;
  const currency: Currency = paymentMethod === "MAIL_ORDER" ? (selectedSupplier?.currency ?? currentSupplierCurrency ?? "TRY") : "TRY";
  const saveDraftAndOpenOffer = () => { const draft: Draft = { phone, firstName, lastName, customerNote, brand, model, operationType, description, price, paymentMethod, multimediaProductId, screenProductId, supplierId, operationNote, operationAt, savedAt: Date.now() }; sessionStorage.setItem(`vehicle-operation-draft:${contextKey}`, JSON.stringify(draft)); navigate({ to: "/ses-sistemi/teklif-ver", search: { pendingVehicleId, vehicleId, operationId } }); };
  const operationPayload = () => ({ type: operationType, description, ...(operationType !== "SOUND_SYSTEM" ? { price } : {}), currency, paymentMethod, note: operationNote, ...(operationType === "MULTIMEDIA" ? { multimediaProductId, screenProductId } : {}), ...(operationType === "SOUND_SYSTEM" ? { soundOfferId: selectedOfferId } : {}), ...(paymentMethod === "MAIL_ORDER" ? { mailOrderSupplierId: supplierId } : {}) });
  const mutation = useMutation({
    mutationFn: () => isEdit
      ? apiRequest<VehicleOperationDetail>(`/api/vehicle-operations/${operationId}`, { method: "PATCH", body: JSON.stringify({ revision: detailQuery.data?.revision, operationAt: new Date(operationAt).toISOString(), operation: operationPayload() }) })
      : apiRequest<{ id: string; vehicleId: string }>("/api/vehicle-operations", { method: "POST", body: JSON.stringify({ source: pendingVehicleId ? { type: "PENDING", pendingVehicleId } : { type: "EXISTING", vehicleId }, customer: { firstName, lastName, phone, note: customerNote }, vehicle: { brand, model }, operation: operationPayload() }) }),
    onSuccess: async () => { sessionStorage.removeItem(`vehicle-operation-draft:${contextKey}`); await Promise.all(invalidationRoots.map((root) => queryClient.invalidateQueries({ queryKey: [root] }))); toast.success(isEdit ? "Araç işlemi güncellendi" : "Araç işlemi kaydedildi"); navigate({ to: "/araclar" }); },
    onError: async (error: Error) => { if (error instanceof ApiError && error.status === 409 && isEdit && (error.message.includes("degistirildi") || error.message.includes("silindi"))) { sessionStorage.removeItem(`vehicle-operation-draft:${contextKey}`); initialized.current = ""; await detailQuery.refetch(); toast.error("Kayıt başka bir işlemle değişti. Güncel veri yeniden yüklendi."); return; } toast.error(error.message); },
  });
  const contextQuery = operationId ? detailQuery : pendingVehicleId ? pendingQuery : intakeQuery;
  if (contextCount !== 1) return <AppLayout title="Araç İşlemi"><div className="card-elevated p-6 text-sm text-destructive">Form pendingVehicleId, vehicleId veya operationId bağlamlarından tam olarak biriyle açılmalıdır.</div></AppLayout>;
  if (contextQuery.isLoading) return <AppLayout title="Araç İşlemi"><div className="card-elevated h-40 animate-pulse" /></AppLayout>;
  if (!context || contextQuery.error instanceof Error) return <AppLayout title="Araç İşlemi"><div className="card-elevated p-6 text-sm text-destructive">{contextQuery.error instanceof Error ? contextQuery.error.message : "Kayıt bulunamadı"}</div></AppLayout>;

  return <AppLayout title={isEdit ? "Araç İşlemini Düzenle" : "Yeni Araç İşlemi"}>
    <div className="mb-4"><Link to="/araclar" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-sm font-semibold"><ArrowLeft className="h-4 w-4" /> Geri</Link></div>
    <form onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }} className="grid gap-4 lg:grid-cols-3">
      <div className="card-elevated space-y-4 p-6 lg:col-span-2">
        <h2 className="font-bold">Araç ve Müşteri Bilgileri</h2><div className="grid gap-4 md:grid-cols-2">
          <Field label="Plaka"><input readOnly value={context.vehicle.plate} className={`${inputClass} bg-muted`} /></Field><Field label="Telefon"><input readOnly={isEdit} value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} /></Field>
          <Field label="Ad"><input readOnly={isEdit} value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} /></Field><Field label="Soyad"><input readOnly={isEdit} value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} /></Field>
          <Field label="Araç Markası"><input readOnly={isEdit} value={brand} onChange={(e) => setBrand(e.target.value)} className={inputClass} /></Field><Field label="Model"><input readOnly={isEdit} value={model} onChange={(e) => setModel(e.target.value)} className={inputClass} /></Field>
        </div>{!isEdit && <Field label="Müşteri Notu"><textarea value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} rows={2} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></Field>}
        <hr className="border-border/60" /><h2 className="font-bold">İşlem Detayı</h2><div className="grid gap-4 md:grid-cols-2">
          <Field label="İşlem Türü"><select value={operationType} onChange={(e) => setOperationType(e.target.value as OperationType)} className={inputClass}>{operationTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
          <Field label="İşlem Açıklaması"><input required value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} /></Field>
          <Field label={`Ücret (${currency})`}><input required type="number" min="0.01" step="0.01" readOnly={operationType === "SOUND_SYSTEM"} value={price} onChange={(e) => setPrice(e.target.value)} className={`${inputClass} ${operationType === "SOUND_SYSTEM" ? "bg-muted" : ""}`} /></Field>
          <Field label="Tarih ve Saat"><input required type="datetime-local" max={toLocalDateTime(new Date())} value={operationAt} onChange={(e) => setOperationAt(e.target.value)} className={inputClass} /></Field>
          <Field label="Ödeme Türü"><select value={paymentMethod} onChange={(e) => { setPaymentMethod(e.target.value as PaymentMethod); setSupplierId(""); }} className={inputClass}><option value="CASH">Nakit</option><option value="CREDIT_CARD">Kredi Kartı</option><option value="BANK_TRANSFER">Havale</option><option value="MAIL_ORDER">Mail Order</option></select></Field>
        </div>
        {operationType === "MULTIMEDIA" && <div className="grid gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 md:grid-cols-2"><select required value={multimediaProductId} onChange={(e) => setMultimediaProductId(e.target.value)} className={inputClass}><option value="">Multimedya ürünü seç...</option>{detailQuery.data?.multimediaProduct && !multimediaQuery.data?.some((item) => item.id === detailQuery.data?.multimediaProduct?.id) && <option value={detailQuery.data.multimediaProduct.id}>{[detailQuery.data.multimediaProduct.brand, detailQuery.data.multimediaProduct.model, detailQuery.data.multimediaProduct.code].filter(Boolean).join(" · ")} · Mevcut kayıt</option>}{multimediaQuery.data?.map((item) => <option key={item.id} value={item.id}>{[item.brand, item.model, item.code].filter(Boolean).join(" · ")} · Stok: {item.quantity}</option>)}</select><select required value={screenProductId} onChange={(e) => setScreenProductId(e.target.value)} className={inputClass}><option value="">Ekran ürünü seç...</option>{detailQuery.data?.screenProduct && !screenQuery.data?.some((item) => item.id === detailQuery.data?.screenProduct?.id) && <option value={detailQuery.data.screenProduct.id}>{[detailQuery.data.screenProduct.brand, detailQuery.data.screenProduct.sizeLabel].filter(Boolean).join(" · ")} · Mevcut kayıt</option>}{screenQuery.data?.map((item) => <option key={item.id} value={item.id}>{[item.brand, item.sizeLabel ?? item.sizeInch].filter(Boolean).join(" · ")} · Stok: {item.quantity}</option>)}</select></div>}
        {operationType === "SOUND_SYSTEM" && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4"><div><div className="font-bold">Ses Sistemi Teklifi</div>{offerQuery.data ? <div className="text-sm">{offerQuery.data.id.slice(0, 8)} · {formatMoneyString(offerQuery.data.finalTotal, "TRY")}</div> : <div className="text-xs text-muted-foreground">Kaydetmeden önce teklif seçin.</div>}</div><button type="button" onClick={saveDraftAndOpenOffer} className="inline-flex h-10 items-center gap-2 rounded-lg bg-warning px-4 text-sm font-bold text-warning-foreground"><FileText className="h-4 w-4" /> Teklif Ver</button></div>}
        {paymentMethod === "MAIL_ORDER" && <div className="rounded-xl border border-chart-3/40 bg-accent p-4"><Field label="Toptancı"><select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputClass}><option value="">Toptancı seç...</option>{detailQuery.data?.mailOrderSupplier && !supplierQuery.data?.some((supplier) => supplier.id === detailQuery.data?.mailOrderSupplier?.id) && <option value={detailQuery.data.mailOrderSupplier.id}>{detailQuery.data.mailOrderSupplier.name} ({detailQuery.data.mailOrderSupplier.currency}) · Mevcut kayıt</option>}{supplierQuery.data?.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name} ({supplier.currency})</option>)}</select></Field></div>}
        <Field label="İşlem Notu"><textarea value={operationNote} onChange={(e) => setOperationNote(e.target.value)} rows={3} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></Field>
      </div>
      <aside className="card-elevated h-fit space-y-4 p-6"><h2 className="font-bold">Özet</h2><p className="text-sm text-muted-foreground">Ziyaret, işlem ve tüm stok/ödeme etkileri yalnız Kaydet ile tek transaction içinde uygulanır.</p><button disabled={mutation.isPending || (operationType === "SOUND_SYSTEM" && !offerQuery.data)} type="submit" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50"><Save className="h-4 w-4" /> {mutation.isPending ? "Kaydediliyor..." : isEdit ? "Değişiklikleri Kaydet" : "Kaydet"}</button><Link to="/araclar" className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-input text-sm font-semibold">İptal</Link></aside>
    </form>
  </AppLayout>;
}
