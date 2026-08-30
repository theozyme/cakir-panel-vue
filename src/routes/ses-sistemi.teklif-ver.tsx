import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { apiRequest } from "@/lib/api";
import { formatMoneyString } from "@/lib/money";
import type {
  SoundOffer,
  SoundSystemProduct,
  UsdExchangeRate,
  PendingVehicle,
  VehicleIntakeContext,
  VehicleOperationDetail,
} from "@/types/business";

type OfferSearch = { pendingVehicleId?: string; vehicleId?: string; operationId?: string };

const SOUND_OFFER_PREVIEW_MULTIPLIERS = {
  CASH: new Decimal("1.50"),
  CARD: new Decimal("1.60"),
} as const;

const calculateSalePriceTry = (
  product: SoundSystemProduct,
  exchangeRate: Decimal,
  saleType: "CASH" | "CARD",
): Decimal | null =>
  product.purchasePriceUsd === null
    ? null
    : new Decimal(product.purchasePriceUsd)
        .mul(exchangeRate)
        .mul(SOUND_OFFER_PREVIEW_MULTIPLIERS[saleType]);

export const Route = createFileRoute("/ses-sistemi/teklif-ver")({
  validateSearch: (search: Record<string, unknown>): OfferSearch => ({
    ...(typeof search.pendingVehicleId === "string" ? { pendingVehicleId: search.pendingVehicleId } : {}),
    ...(typeof search.vehicleId === "string" ? { vehicleId: search.vehicleId } : {}),
    ...(typeof search.operationId === "string" ? { operationId: search.operationId } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Teklif Ver · Ses Sistemi · Çakır Oto" },
      { name: "description", content: "Alış USD fiyatı ve güncel kurla ses sistemi teklifi." },
    ],
  }),
  component: TeklifVer,
});

function TeklifVer() {
  const { pendingVehicleId, vehicleId, operationId } = Route.useSearch();
  const hasOperationContext = Boolean(pendingVehicleId || vehicleId || operationId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saleType, setSaleType] = useState<"CASH" | "CARD">("CASH");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [manualTotal, setManualTotal] = useState("");

  const productsQuery = useQuery({
    queryKey: ["stock", "sound-system"],
    queryFn: () => apiRequest<SoundSystemProduct[]>("/api/stock/sound-system-products?active=true"),
  });
  const rateQuery = useQuery({
    queryKey: ["exchange-rate", "USD"],
    queryFn: () => apiRequest<UsdExchangeRate>("/api/exchange-rates/usd"),
  });
  const contextQuery = useQuery({
    queryKey: ["sound-offer-context", pendingVehicleId, vehicleId, operationId],
    queryFn: async () => {
      if (operationId) {
        const operation = await apiRequest<VehicleOperationDetail>(`/api/vehicle-operations/${operationId}`);
        return { plate: operation.plate, customer: operation.customer };
      }
      if (vehicleId) {
        const intake = await apiRequest<VehicleIntakeContext>(`/api/vehicles/${vehicleId}/intake-context`);
        return { plate: intake.vehicle.plate, customer: intake.customer };
      }
      const pending = await apiRequest<PendingVehicle>(`/api/pending-vehicles/${pendingVehicleId}`);
      return { plate: pending.plate, customer: null };
    },
    enabled: hasOperationContext,
  });

  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const lines = useMemo(
    () =>
      products
        .filter((product) => selected[product.id] !== undefined)
        .map((product) => ({ product, quantity: Math.max(1, selected[product.id] ?? 1) })),
    [products, selected],
  );
  const exchangeRate = new Decimal(rateQuery.data?.rate ?? "0");
  const autoTotal = lines
    .reduce((total, line) => {
      const salePriceTry = calculateSalePriceTry(line.product, exchangeRate, saleType);
      return salePriceTry
        ? total.plus(salePriceTry.mul(line.quantity).toDecimalPlaces(2, Decimal.ROUND_HALF_UP))
        : total;
    }, new Decimal(0))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const costTotal = lines
    .reduce((total, line) => {
      return line.product.purchasePriceUsd
        ? total.plus(
            new Decimal(line.product.purchasePriceUsd).mul(exchangeRate).mul(line.quantity),
          )
        : total;
    }, new Decimal(0))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const parsedManualTotal = (() => {
    if (!manualTotal.trim()) return null;
    try {
      const value = new Decimal(manualTotal);
      return value.isPositive() ? value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP) : null;
    } catch {
      return null;
    }
  })();
  const finalTotal = parsedManualTotal ?? autoTotal;
  const estimatedProfit = finalTotal.minus(costTotal);

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest<SoundOffer>("/api/sound-offers", {
        method: "POST",
        body: JSON.stringify({
          saleType,
          items: lines.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
          })),
          ...(manualTotal.trim() ? { manualTotal } : {}),
        }),
      }),
    onSuccess: (offer) => {
      void queryClient.invalidateQueries({ queryKey: ["sound-offers"] });
      toast.success("Teklif kaydedildi; stok henüz düşülmedi");
      if (hasOperationContext) {
        navigate({
          to: "/araclar/yeni",
          search: { pendingVehicleId, vehicleId, operationId, soundOfferId: offer.id },
        });
      } else {
        navigate({ to: "/ses-sistemi/teklif-gecmisi" });
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = (product: SoundSystemProduct) => {
    if (product.purchasePriceUsd === null) {
      toast.error(`${product.name} için alış USD fiyatı tanımlı değil`);
      return;
    }
    if (product.quantity <= 0) {
      toast.error("Ürün stokta yok");
      return;
    }
    setSelected((current) => {
      const next = { ...current };
      if (next[product.id] !== undefined) delete next[product.id];
      else next[product.id] = 1;
      return next;
    });
  };

  const customerName = contextQuery.data?.customer
    ? [contextQuery.data.customer.firstName, contextQuery.data.customer.lastName]
        .filter(Boolean)
        .join(" ")
    : "";

  return (
    <AppLayout title="Ses Sistemi · Teklif Ver">
      {hasOperationContext ? (
        <Link
          to="/araclar/yeni"
          search={{ pendingVehicleId, vehicleId, operationId }}
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Araç İşlemine Dön
        </Link>
      ) : (
        <Link
          to="/ses-sistemi"
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Ses Sistemi
        </Link>
      )}

      <div className="card-elevated p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-muted-foreground">Müşteri</span>
            <input
              readOnly
              value={customerName}
              placeholder="Ad Soyad"
              className="h-9 w-full rounded-lg border border-input bg-muted px-3 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-muted-foreground">Plaka</span>
            <input
              readOnly
              value={contextQuery.data?.plate ?? ""}
              placeholder="34ABC123"
              className="h-9 w-full rounded-lg border border-input bg-muted px-3 text-sm"
            />
          </label>
          <div className="text-sm">
            <span className="mb-1 block font-medium text-muted-foreground">Satış Tipi</span>
            <div className="flex gap-2">
              {(["CASH", "CARD"] as const).map((type) => (
                <button
                  type="button"
                  key={type}
                  onClick={() => setSaleType(type)}
                  className={`h-9 flex-1 rounded-lg border text-sm font-semibold transition-colors ${saleType === type ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-muted-foreground hover:text-foreground"}`}
                >
                  {type === "CASH" ? "Nakit" : "Kredi Kartı"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          TCMB USD döviz satış kuru:{" "}
          {rateQuery.data
            ? `${rateQuery.data.rate} · ${rateQuery.data.effectiveDate}${rateQuery.data.isStale ? " · cache" : ""}`
            : "Yükleniyor..."}
        </div>
      </div>

      <div className="mt-6 card-elevated overflow-hidden">
        <div className="p-5 pb-3">
          <h2 className="text-base font-bold">Ürün Seçimi</h2>
          <p className="text-xs text-muted-foreground">
            Teklif kaydı stok rezervasyonu veya stok düşümü yapmaz.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Seç</th>
                <th className="px-4 py-3 text-left font-semibold">Ürün Adı</th>
                <th className="px-4 py-3 text-right font-semibold">Mevcut Stok</th>
                <th className="px-4 py-3 text-right font-semibold">Alış USD</th>
                <th className="px-4 py-3 text-right font-semibold">Nakit TL</th>
                <th className="px-4 py-3 text-right font-semibold">Kart TL</th>
                <th className="px-4 py-3 text-right font-semibold">Adet</th>
              </tr>
            </thead>
            <tbody>
              {productsQuery.isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Ürünler yükleniyor...
                  </td>
                </tr>
              )}
              {productsQuery.error instanceof Error && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-destructive">
                    {productsQuery.error.message}
                  </td>
                </tr>
              )}
              {products.map((product) => {
                const checked = selected[product.id] !== undefined;
                const cashPriceTry = rateQuery.data
                  ? calculateSalePriceTry(product, exchangeRate, "CASH")
                  : null;
                const cardPriceTry = rateQuery.data
                  ? calculateSalePriceTry(product, exchangeRate, "CARD")
                  : null;
                return (
                  <tr
                    key={product.id}
                    className={`border-t border-border/60 ${checked ? "bg-primary/5" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(product)}
                        className="h-4 w-4 accent-primary"
                      />
                    </td>
                    <td className="px-4 py-3 font-semibold">{product.name}</td>
                    <td className="px-4 py-3 text-right">{product.quantity}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {product.purchasePriceUsd
                        ? formatMoneyString(product.purchasePriceUsd, "USD")
                        : "-"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right ${saleType === "CASH" ? "font-bold text-primary" : ""}`}
                    >
                      {cashPriceTry
                        ? formatMoneyString(
                            cashPriceTry.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
                            "TRY",
                          )
                        : "-"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right ${saleType === "CARD" ? "font-bold text-primary" : ""}`}
                    >
                      {cardPriceTry
                        ? formatMoneyString(
                            cardPriceTry.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
                            "TRY",
                          )
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min={1}
                        max={product.quantity}
                        disabled={!checked}
                        value={checked ? selected[product.id] : ""}
                        onChange={(event) =>
                          setSelected((current) => ({
                            ...current,
                            [product.id]: Math.min(
                              product.quantity,
                              Math.max(1, Number(event.target.value) || 1),
                            ),
                          }))
                        }
                        className="h-9 w-20 rounded-lg border border-input bg-background px-2 text-right text-sm outline-none focus:border-primary disabled:opacity-40"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 card-elevated p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Seçilen Ürün
            </div>
            <div className="mt-1 text-2xl font-bold">{lines.length}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Otomatik Toplam
            </div>
            <div className="mt-1 text-2xl font-bold">
              {formatMoneyString(autoTotal.toFixed(2), "TRY")}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Nihai Teklif Tutarı
            </div>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={manualTotal}
              onChange={(e) => setManualTotal(e.target.value)}
              placeholder={autoTotal.toFixed(2)}
              className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-lg font-bold outline-none focus:border-primary"
            />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">Tahmini Kâr</div>
            <div
              className={`mt-1 text-2xl font-bold ${estimatedProfit.isNegative() ? "text-destructive" : "text-success"}`}
            >
              {formatMoneyString(estimatedProfit.toFixed(2), "TRY")}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setSelected({});
              setManualTotal("");
            }}
            className="h-9 rounded-lg border border-input bg-background px-4 text-sm font-semibold hover:bg-accent"
          >
            Temizle
          </button>
          <button
            type="button"
            disabled={createMutation.isPending || lines.length === 0 || !rateQuery.data}
            onClick={() => createMutation.mutate()}
            className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createMutation.isPending ? "Kaydediliyor..." : "Teklifi Onayla"}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
