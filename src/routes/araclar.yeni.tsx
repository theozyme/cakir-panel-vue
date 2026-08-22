import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Save } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { apiRequest } from "@/lib/api";
import { formatMoneyString } from "@/lib/money";
import type {
  Currency,
  MultimediaProduct,
  OperationType,
  PaymentMethod,
  ScreenProduct,
  SoundOffer,
  Supplier,
  VehicleVisitDetail,
} from "@/types/business";

type OperationSearch = {
  visitId?: string;
  soundOfferId?: string;
};

export const Route = createFileRoute("/araclar/yeni")({
  validateSearch: (search: Record<string, unknown>): OperationSearch => ({
    ...(typeof search.visitId === "string" ? { visitId: search.visitId } : {}),
    ...(typeof search.soundOfferId === "string" ? { soundOfferId: search.soundOfferId } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Yeni Araç İşlemi · Çakır Oto" },
      { name: "description", content: "Yeni araç işlemi kaydı oluşturun." },
    ],
  }),
  component: YeniIslem,
});

const islemTurleri: Array<{ v: OperationType; l: string }> = [
  { v: "MULTIMEDIA", l: "Multimedya" },
  { v: "SOUND_SYSTEM", l: "Ses Sistemi" },
  { v: "HIDDEN_FEATURE_ACTIVATION", l: "Gizli Özellik Aktivasyon" },
  { v: "REAR_VIEW_CAMERA", l: "Geri Görüş Kamerası" },
  { v: "ANDROID_BOX", l: "Android Box" },
  { v: "DASH_CAMERA", l: "Kayıt Kamerası" },
  { v: "BULB", l: "Ampul" },
  { v: "LED_XENON", l: "LED Xenon" },
  { v: "BATTERY", l: "Akü" },
  { v: "WIPER", l: "Silecek" },
  { v: "LABOR", l: "İşçilik" },
  { v: "CAR_STEREO", l: "Teyp" },
  { v: "STEERING_WHEEL_COVER", l: "Direksiyon Kılıfı" },
  { v: "WINDOW_FILM", l: "Cam Filmi" },
  { v: "PPF_COATING", l: "PPF Kaplama" },
  { v: "POWER_TAILGATE", l: "Elektrikli Bagaj" },
  { v: "SERVICE", l: "Servis" },
  { v: "ACCESSORY", l: "Aksesuar" },
  { v: "OTHER", l: "Diğer" },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary";

type Draft = {
  phone: string;
  firstName: string;
  lastName: string;
  customerNote: string;
  brand: string;
  model: string;
  operationType: OperationType;
  description: string;
  price: string;
  paymentMethod: PaymentMethod;
  multimediaProductId: string;
  screenProductId: string;
  supplierId: string;
  operationNote: string;
  savedAt: number;
};

const draftKey = (visitId: string) => `vehicle-operation-draft:${visitId}`;

function YeniIslem() {
  const { visitId, soundOfferId } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [operationType, setOperationType] = useState<OperationType>("MULTIMEDIA");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [multimediaProductId, setMultimediaProductId] = useState("");
  const [screenProductId, setScreenProductId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [operationNote, setOperationNote] = useState("");

  const visitQuery = useQuery({
    queryKey: ["vehicle-visit", visitId],
    queryFn: () => apiRequest<VehicleVisitDetail>(`/api/vehicle-visits/${visitId}`),
    enabled: Boolean(visitId),
  });
  const multimediaQuery = useQuery({
    queryKey: ["stock", "multimedia"],
    queryFn: () => apiRequest<MultimediaProduct[]>("/api/stock/multimedia-products?inStock=true"),
    enabled: operationType === "MULTIMEDIA",
  });
  const screenQuery = useQuery({
    queryKey: ["stock", "screen"],
    queryFn: () => apiRequest<ScreenProduct[]>("/api/stock/screen-products?inStock=true"),
    enabled: operationType === "MULTIMEDIA",
  });
  const supplierQuery = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => apiRequest<Supplier[]>("/api/suppliers?active=true"),
    enabled: paymentMethod === "MAIL_ORDER",
  });
  const offerQuery = useQuery({
    queryKey: ["sound-offer", soundOfferId],
    queryFn: () => apiRequest<SoundOffer>(`/api/sound-offers/${soundOfferId}`),
    enabled: Boolean(soundOfferId),
  });

  useEffect(() => {
    if (!visitId || !visitQuery.data) return;

    const stored = sessionStorage.getItem(draftKey(visitId));
    if (stored) {
      try {
        const draft = JSON.parse(stored) as Draft;
        if (Date.now() - draft.savedAt < 24 * 60 * 60 * 1000) {
          setPhone(draft.phone);
          setFirstName(draft.firstName);
          setLastName(draft.lastName);
          setCustomerNote(draft.customerNote);
          setBrand(draft.brand);
          setModel(draft.model);
          setOperationType(draft.operationType);
          setDescription(draft.description);
          setPrice(draft.price);
          setPaymentMethod(draft.paymentMethod);
          setMultimediaProductId(draft.multimediaProductId);
          setScreenProductId(draft.screenProductId);
          setSupplierId(draft.supplierId);
          setOperationNote(draft.operationNote);
          return;
        }
        sessionStorage.removeItem(draftKey(visitId));
      } catch {
        sessionStorage.removeItem(draftKey(visitId));
      }
    }

    setPhone(visitQuery.data.customer?.phone ?? "");
    setFirstName(visitQuery.data.customer?.firstName ?? "");
    setLastName(visitQuery.data.customer?.lastName ?? "");
    setCustomerNote(visitQuery.data.customer?.note ?? "");
    setBrand(visitQuery.data.vehicle.brand ?? "");
    setModel(visitQuery.data.vehicle.model ?? "");
  }, [visitId, visitQuery.data]);

  useEffect(() => {
    if (offerQuery.data) {
      setOperationType("SOUND_SYSTEM");
      setPrice(offerQuery.data.finalTotal);
      setDescription((current) => current || "Ses sistemi");
    }
  }, [offerQuery.data, visitQuery.data?.id]);

  const availableSuppliers = useMemo(
    () =>
      supplierQuery.data?.filter(
        (supplier) => operationType !== "SOUND_SYSTEM" || supplier.currency === "TRY",
      ) ?? [],
    [operationType, supplierQuery.data],
  );
  const selectedSupplier = useMemo(
    () => availableSuppliers.find((supplier) => supplier.id === supplierId),
    [availableSuppliers, supplierId],
  );
  useEffect(() => {
    if (supplierQuery.data && supplierId && !selectedSupplier) {
      setSupplierId("");
    }
  }, [selectedSupplier, supplierId, supplierQuery.data]);
  const operationCurrency: Currency =
    paymentMethod === "MAIL_ORDER" ? (selectedSupplier?.currency ?? "TRY") : "TRY";

  const saveDraftAndOpenOffer = () => {
    if (!visitId) return;
    const draft: Draft = {
      phone,
      firstName,
      lastName,
      customerNote,
      brand,
      model,
      operationType,
      description,
      price,
      paymentMethod,
      multimediaProductId,
      screenProductId,
      supplierId,
      operationNote,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(draftKey(visitId), JSON.stringify(draft));
    navigate({ to: "/ses-sistemi/teklif-ver", search: { visitId } });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ id: string; vehicleId: string }>("/api/vehicle-operations", {
        method: "POST",
        body: JSON.stringify({
          visitId,
          customer: { firstName, lastName, phone, note: customerNote },
          vehicle: { brand, model },
          operation: {
            type: operationType,
            description,
            ...(operationType !== "SOUND_SYSTEM" ? { price } : {}),
            currency: operationCurrency,
            note: operationNote,
            paymentMethod,
            ...(operationType === "MULTIMEDIA" ? { multimediaProductId, screenProductId } : {}),
            ...(operationType === "SOUND_SYSTEM" ? { soundOfferId } : {}),
            ...(paymentMethod === "MAIL_ORDER" ? { mailOrderSupplierId: supplierId } : {}),
          },
        }),
      }),
    onSuccess: (result) => {
      if (visitId) sessionStorage.removeItem(draftKey(visitId));
      void queryClient.invalidateQueries({ queryKey: ["vehicle-operations"] });
      void queryClient.invalidateQueries({ queryKey: ["vehicle-history", result.vehicleId] });
      void queryClient.invalidateQueries({ queryKey: ["stock"] });
      void queryClient.invalidateQueries({ queryKey: ["sound-offer"] });
      toast.success("Araç işlemi kaydedildi");
      navigate({ to: "/araclar" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!visitId) {
    return (
      <AppLayout title="Yeni Araç İşlemi">
        <div className="card-elevated p-6 text-sm text-destructive">
          İşlem ekranı bir bekleyen araç onaylanarak açılmalıdır.
        </div>
      </AppLayout>
    );
  }

  if (visitQuery.isLoading) {
    return (
      <AppLayout title="Yeni Araç İşlemi">
        <div className="card-elevated h-40 animate-pulse" />
      </AppLayout>
    );
  }

  if (visitQuery.error instanceof Error || !visitQuery.data) {
    return (
      <AppLayout title="Yeni Araç İşlemi">
        <div className="card-elevated p-6 text-sm text-destructive">
          {visitQuery.error instanceof Error ? visitQuery.error.message : "Ziyaret bulunamadı"}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Yeni Araç İşlemi">
      <div className="mb-4 flex items-center gap-3">
        <Link
          to="/araclar"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-sm font-semibold hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" /> Geri
        </Link>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          createMutation.mutate();
        }}
        className="grid gap-4 lg:grid-cols-3"
      >
        <div className="card-elevated space-y-4 p-6 lg:col-span-2">
          <h2 className="text-base font-bold">Araç ve Müşteri Bilgileri</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Plaka">
              <input
                readOnly
                value={visitQuery.data.vehicle.plate}
                className={`${inputCls} bg-muted`}
              />
            </Field>
            <Field label="Telefon">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputCls}
                placeholder="0532 000 00 00"
              />
            </Field>
            <Field label="Ad">
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Soyad">
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Araç Markası">
              <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className={inputCls}
                placeholder="Renault"
              />
            </Field>
            <Field label="Model">
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className={inputCls}
                placeholder="Clio"
              />
            </Field>
          </div>
          <Field label="Müşteri Notu">
            <textarea
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </Field>

          <hr className="border-border/60" />
          <h2 className="text-base font-bold">İşlem Detayı</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="İşlem Türü">
              <select
                value={operationType}
                onChange={(e) => setOperationType(e.target.value as OperationType)}
                className={inputCls}
              >
                {islemTurleri.map((item) => (
                  <option key={item.v} value={item.v}>
                    {item.l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="İşlem Açıklaması">
              <input
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label={`Ücret (${operationCurrency})`}>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                readOnly={operationType === "SOUND_SYSTEM"}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={`${inputCls} ${operationType === "SOUND_SYSTEM" ? "bg-muted" : ""}`}
                placeholder="0.00"
              />
            </Field>
            <Field label="Tarih">
              <input
                readOnly
                type="date"
                value={new Date().toISOString().slice(0, 10)}
                className={`${inputCls} bg-muted`}
              />
            </Field>
            <Field label="Ödeme Türü">
              <select
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value as PaymentMethod);
                  setSupplierId("");
                }}
                className={inputCls}
              >
                <option value="CASH">Nakit</option>
                <option value="CREDIT_CARD">Kredi Kartı</option>
                <option value="BANK_TRANSFER">Havale</option>
                <option value="MAIL_ORDER">Mail Order</option>
              </select>
            </Field>
          </div>

          {operationType === "MULTIMEDIA" && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="mb-3 text-sm font-bold text-primary">Multimedya Stok Seçimi</div>
              <div className="grid gap-3 md:grid-cols-2">
                <select
                  required
                  value={multimediaProductId}
                  onChange={(e) => setMultimediaProductId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Multimedya ürünü seç...</option>
                  {multimediaQuery.data?.map((item) => (
                    <option key={item.id} value={item.id}>
                      {[item.brand, item.model, item.code].filter(Boolean).join(" · ")} · Stok:{" "}
                      {item.quantity}
                    </option>
                  ))}
                </select>
                <select
                  required
                  value={screenProductId}
                  onChange={(e) => setScreenProductId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Ekran ürünü seç...</option>
                  {screenQuery.data?.map((item) => (
                    <option key={item.id} value={item.id}>
                      {[
                        item.brand,
                        item.sizeLabel ?? item.sizeInch,
                        item.storageGb ? `${item.storageGb} GB` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}{" "}
                      · Stok: {item.quantity}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {operationType === "SOUND_SYSTEM" && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-warning">Ses Sistemi Teklifi</div>
                  {offerQuery.data ? (
                    <div className="mt-1 text-sm">
                      Teklif: {offerQuery.data.id.slice(0, 8)} ·{" "}
                      {formatMoneyString(offerQuery.data.finalTotal, "TRY")}
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-muted-foreground">
                      İşlemi kaydetmeden önce teklif oluşturun.
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={saveDraftAndOpenOffer}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-warning px-4 text-sm font-bold text-warning-foreground"
                >
                  <FileText className="h-4 w-4" /> Teklif Ver
                </button>
              </div>
            </div>
          )}

          {paymentMethod === "MAIL_ORDER" && (
            <div className="rounded-xl border border-chart-3/40 bg-accent p-4">
              <div className="mb-2 text-sm font-bold">Toptancı Seçimi</div>
              <select
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className={inputCls}
              >
                <option value="">Toptancı seç...</option>
                {availableSuppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name} ({supplier.currency})
                  </option>
                ))}
              </select>
              {selectedSupplier && (
                <div className="mt-2 text-xs text-muted-foreground">
                  İşlem ve ödeme tutarı {selectedSupplier.currency} olarak kaydedilecek:{" "}
                  {formatMoneyString(price || "0", selectedSupplier.currency)}
                </div>
              )}
            </div>
          )}

          <Field label="İşlem Notu">
            <textarea
              value={operationNote}
              onChange={(e) => setOperationNote(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </Field>
        </div>

        <div className="card-elevated h-fit space-y-4 p-6">
          <h2 className="text-base font-bold">Özet</h2>
          <p className="text-sm text-muted-foreground">
            Araç ziyareti, işlem, stok ve ödeme hareketleri tek transaction içinde kaydedilir.
          </p>
          <button
            disabled={
              createMutation.isPending || (operationType === "SOUND_SYSTEM" && !offerQuery.data)
            }
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {createMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
          </button>
          <Link
            to="/araclar"
            className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-input text-sm font-semibold hover:bg-muted"
          >
            İptal
          </Link>
        </div>
      </form>
    </AppLayout>
  );
}
