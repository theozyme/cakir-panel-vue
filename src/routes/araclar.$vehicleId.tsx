import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Car, Plus } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { VehicleOperationActions } from "@/components/shared/VehicleOperationActions";
import { apiRequest } from "@/lib/api";
import { formatMoneyString } from "@/lib/money";
import type {
  VehicleCustomerSummary,
  VehicleHistoryOperation,
  VehicleHistoryResponse,
} from "@/types/business";

export const Route = createFileRoute("/araclar/$vehicleId")({
  head: () => ({
    meta: [
      { title: "Araç Geçmişi · Çakır Oto" },
      { name: "description", content: "Aracın ziyaret ve işlem geçmişi." },
    ],
  }),
  component: VehicleHistoryPage,
});

const operationLabels: Record<string, string> = {
  MULTIMEDIA: "Multimedya",
  SOUND_SYSTEM: "Ses Sistemi",
  HIDDEN_FEATURE_ACTIVATION: "Gizli Özellik Aktivasyon",
  REAR_VIEW_CAMERA: "Geri Görüş Kamerası",
  ANDROID_BOX: "Android Box",
  DASH_CAMERA: "Kayıt Kamerası",
  BULB: "Ampul",
  LED_XENON: "LED Xenon",
  BATTERY: "Akü",
  WIPER: "Silecek",
  LABOR: "İşçilik",
  CAR_STEREO: "Teyp",
  STEERING_WHEEL_COVER: "Direksiyon Kılıfı",
  WINDOW_FILM: "Cam Filmi",
  PPF_COATING: "PPF Kaplama",
  POWER_TAILGATE: "Elektrikli Bagaj",
  SERVICE: "Servis",
  ACCESSORY: "Aksesuar",
  OTHER: "Diğer",
};

const paymentLabels: Record<string, string> = {
  CASH: "Nakit",
  CREDIT_CARD: "Kredi Kartı",
  BANK_TRANSFER: "Havale",
  MAIL_ORDER: "Mail Order",
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeStyle: "short" }).format(
    new Date(value),
  );

const displayCustomer = (customer: VehicleCustomerSummary | null) => {
  if (!customer) return "Müşteri bilgisi yok";
  return (
    [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
    customer.phone ||
    "Müşteri bilgisi yok"
  );
};

function ProductDetails({ operation }: { operation: VehicleHistoryOperation }) {
  if (
    !operation.multimediaProduct &&
    !operation.screenProduct &&
    !operation.soundOffer &&
    !operation.mailOrderSupplier
  ) {
    return null;
  }

  return (
    <div className="mt-3 grid gap-2 border-t border-border/60 pt-3 md:grid-cols-2">
      {operation.multimediaProduct && (
        <div className="rounded-lg bg-muted/45 p-3 text-xs">
          <div className="font-semibold text-foreground">Multimedya Ürünü</div>
          <div className="mt-1 text-muted-foreground">
            {[
              operation.multimediaProduct.brand,
              operation.multimediaProduct.model,
              operation.multimediaProduct.code,
              operation.multimediaProduct.forx,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
          {operation.multimediaProduct.shelf && (
            <div className="mt-1 text-muted-foreground">
              Raf: {operation.multimediaProduct.shelf}
            </div>
          )}
        </div>
      )}
      {operation.screenProduct && (
        <div className="rounded-lg bg-muted/45 p-3 text-xs">
          <div className="font-semibold text-foreground">Ekran Ürünü</div>
          <div className="mt-1 text-muted-foreground">
            {[
              operation.screenProduct.brand,
              operation.screenProduct.sizeLabel,
              operation.screenProduct.sizeInch ? `${operation.screenProduct.sizeInch}"` : null,
              operation.screenProduct.storageGb ? `${operation.screenProduct.storageGb} GB` : null,
              operation.screenProduct.ramGb ? `${operation.screenProduct.ramGb} GB RAM` : null,
              operation.screenProduct.cores ? `${operation.screenProduct.cores} çekirdek` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
      )}
      {operation.soundOffer && (
        <div className="rounded-lg bg-muted/45 p-3 text-xs md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold text-foreground">Ses Sistemi Teklifi</div>
            <div className="text-muted-foreground">
              {operation.soundOffer.saleType} · {operation.soundOffer.status} · Toplam{" "}
              {operation.soundOffer.finalTotal} TRY
            </div>
          </div>
          <div className="mt-2 space-y-1 text-muted-foreground">
            {operation.soundOffer.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-3">
                <span>
                  {item.productName} × {item.quantity}
                </span>
                {item.lineTotal && <span>{item.lineTotal}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      {operation.mailOrderSupplier && (
        <div className="rounded-lg bg-muted/45 p-3 text-xs">
          <div className="font-semibold text-foreground">Mail Order Tedarikçisi</div>
          <div className="mt-1 text-muted-foreground">
            {operation.mailOrderSupplier.name} · {operation.mailOrderSupplier.currency}
          </div>
        </div>
      )}
    </div>
  );
}

function VehicleHistoryPage() {
  const { vehicleId } = Route.useParams();
  const historyQuery = useQuery({
    queryKey: ["vehicle-history", vehicleId],
    queryFn: () => apiRequest<VehicleHistoryResponse>(`/api/vehicles/${vehicleId}/history`),
  });

  if (historyQuery.isLoading) {
    return (
      <AppLayout title="Araç Geçmişi">
        <div className="card-elevated h-48 animate-pulse" />
      </AppLayout>
    );
  }

  if (historyQuery.error instanceof Error || !historyQuery.data) {
    return (
      <AppLayout title="Araç Geçmişi">
        <div className="card-elevated p-6 text-sm text-destructive">
          {historyQuery.error instanceof Error ? historyQuery.error.message : "Araç bulunamadı"}
        </div>
      </AppLayout>
    );
  }

  const history = historyQuery.data;
  const vehicleName = [history.vehicle.brand, history.vehicle.model].filter(Boolean).join(" ");

  return (
    <AppLayout title="Araç Geçmişi">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/araclar"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-sm font-semibold hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" /> Araç İşlemleri
        </Link>
        <Link
          to="/araclar/yeni"
          search={{ vehicleId }}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Yeni İşlem Ekle
        </Link>
      </div>

      <section className="card-elevated mb-4 flex flex-wrap items-center gap-4 p-5">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
          <Car className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold">{history.vehicle.plate}</h1>
          <div className="mt-1 text-sm text-muted-foreground">
            {[vehicleName, displayCustomer(history.customer), history.customer?.phone]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        <div className="rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground">
          Salt okunur geçmiş
        </div>
      </section>

      <div className="space-y-4">
        {history.visits.length === 0 && (
          <div className="card-elevated p-8 text-center text-sm text-muted-foreground">
            Bu araca ait ziyaret kaydı yok.
          </div>
        )}
        {history.visits.map((visit) => (
          <section key={visit.visitId} className="card-elevated overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 bg-muted/25 px-5 py-4">
              <div>
                <h2 className="font-bold">{formatDateTime(visit.arrivalAt)}</h2>
                <div className="mt-1 text-xs text-muted-foreground">
                  {displayCustomer(visit.customer)}
                  {visit.customer?.phone ? ` · ${visit.customer.phone}` : ""}
                </div>
                {visit.visitNote && (
                  <div className="mt-1 text-xs text-muted-foreground">{visit.visitNote}</div>
                )}
              </div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                {visit.operations.length} işlem
              </span>
            </div>
            <div className="divide-y divide-border/60 px-5">
              {visit.operations.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Bu ziyarette henüz işlem yok.
                </div>
              )}
              {visit.operations.map((operation) => (
                <article key={operation.operationId} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">
                        {operationLabels[operation.operationType ?? ""] ??
                          operation.operationType ??
                          "İşlem"}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {operation.description}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">
                        {formatMoneyString(operation.price, operation.currency)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {paymentLabels[operation.paymentMethod] ?? operation.paymentMethod} ·{" "}
                        {formatDateTime(operation.operationAt)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <VehicleOperationActions
                      operationId={operation.operationId}
                      revision={operation.revision}
                      hasStockImpact={
                        operation.operationType === "MULTIMEDIA" ||
                        operation.operationType === "SOUND_SYSTEM"
                      }
                      hasMailOrderImpact={operation.paymentMethod === "MAIL_ORDER"}
                    />
                  </div>
                  {operation.note && (
                    <div className="mt-3 rounded-lg border border-border/60 p-3 text-sm text-muted-foreground">
                      {operation.note}
                    </div>
                  )}
                  <ProductDetails operation={operation} />
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppLayout>
  );
}
