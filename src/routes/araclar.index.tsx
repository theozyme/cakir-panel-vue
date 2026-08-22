import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Eye, LoaderCircle, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api";
import { formatMoneyString } from "@/lib/money";
import type {
  CreateVehicleVisitResponse,
  PendingVehicle,
  VehicleLookupResponse,
  VehicleOperationHistoryItem,
  VehicleOperationHistoryResponse,
} from "@/types/business";

export const Route = createFileRoute("/araclar/")({
  head: () => ({
    meta: [
      { title: "Araç İşlemleri · Çakır Oto" },
      { name: "description", content: "Tüm araç işlem geçmişi ve ödemeler." },
    ],
  }),
  component: AraclarPage,
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

const customerName = (item: VehicleOperationHistoryItem) => {
  if (!item.customer) return "Müşteri yok";
  return (
    [item.customer.firstName, item.customer.lastName].filter(Boolean).join(" ") ||
    item.customer.phone ||
    "Müşteri yok"
  );
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

function AraclarPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [newOperationOpen, setNewOperationOpen] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [debouncedVehicleSearch, setDebouncedVehicleSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedVehicleSearch(vehicleSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [vehicleSearch]);

  const historyQuery = useQuery({
    queryKey: ["vehicle-operations", "history", debouncedSearch, page, 20],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      return apiRequest<VehicleOperationHistoryResponse>(
        `/api/vehicle-operations/history?${params.toString()}`,
      );
    },
    placeholderData: keepPreviousData,
  });

  const vehicleQuery = useQuery({
    queryKey: ["vehicles", "lookup", debouncedVehicleSearch],
    queryFn: () =>
      apiRequest<VehicleLookupResponse>(
        `/api/vehicles?search=${encodeURIComponent(debouncedVehicleSearch)}&limit=10`,
      ),
    enabled: newOperationOpen && debouncedVehicleSearch.length >= 2,
  });

  const createVisitMutation = useMutation({
    mutationFn: (vehicleId: string) =>
      apiRequest<CreateVehicleVisitResponse>(`/api/vehicles/${vehicleId}/visits`, {
        method: "POST",
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["vehicle-history", result.vehicleId] });
      setNewOperationOpen(false);
      navigate({ to: "/araclar/yeni", search: { visitId: result.visitId } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createPendingMutation = useMutation({
    mutationFn: (plate: string) =>
      apiRequest<PendingVehicle>("/api/pending-vehicles", {
        method: "POST",
        body: JSON.stringify({ plate }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pending-vehicles"] });
      toast.success("Plaka bekleyen araçlara eklendi. Ana Sayfa'dan işleme alın.");
      setNewOperationOpen(false);
      navigate({ to: "/" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const normalizedNewPlate = vehicleSearch.trim().toUpperCase().replace(/\s+/g, "");
  const exactVehicleExists = vehicleQuery.data?.items.some(
    (vehicle) => vehicle.plate.replace(/\s+/g, "").toUpperCase() === normalizedNewPlate,
  );
  const rows = historyQuery.data?.items ?? [];
  const pagination = historyQuery.data?.pagination;

  return (
    <AppLayout title="Araç İşlemleri">
      <div className="card-elevated p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Plaka veya müşteri ara..."
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <button
            type="button"
            onClick={() => setNewOperationOpen(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Yeni İşlem
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Plaka</th>
                <th className="px-4 py-3 text-left font-semibold">Müşteri</th>
                <th className="px-4 py-3 text-left font-semibold">İşlem</th>
                <th className="px-4 py-3 text-left font-semibold">Ödeme</th>
                <th className="px-4 py-3 text-left font-semibold">Tarih</th>
                <th className="px-4 py-3 text-right font-semibold">Ücret</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {historyQuery.isLoading &&
                [1, 2, 3, 4].map((item) => (
                  <tr key={item} className="border-t border-border/60">
                    <td colSpan={7} className="px-4 py-4">
                      <div className="h-5 animate-pulse rounded bg-muted" />
                    </td>
                  </tr>
                ))}
              {!historyQuery.isLoading && historyQuery.error instanceof Error && (
                <tr className="border-t border-border/60">
                  <td colSpan={7} className="px-4 py-10 text-center text-destructive">
                    {historyQuery.error.message}
                  </td>
                </tr>
              )}
              {!historyQuery.isLoading && !historyQuery.error && rows.length === 0 && (
                <tr className="border-t border-border/60">
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    {debouncedSearch
                      ? "Aramanızla eşleşen işlem bulunamadı."
                      : "Henüz araç işlemi yok."}
                  </td>
                </tr>
              )}
              {rows.map((item) => (
                <tr key={item.operationId} className="border-t border-border/60 hover:bg-muted/30">
                  <td className="px-4 py-3 font-semibold">{item.plate}</td>
                  <td className="px-4 py-3">
                    <div>{customerName(item)}</div>
                    {item.customer?.phone && (
                      <div className="text-xs text-muted-foreground">{item.customer.phone}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      {operationLabels[item.operationType ?? ""] ?? item.operationType ?? "İşlem"}
                    </div>
                    <div className="max-w-64 truncate text-xs text-muted-foreground">
                      {item.description}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {paymentLabels[item.paymentMethod] ?? item.paymentMethod}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatDateTime(item.operationAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold">
                    {formatMoneyString(item.price, item.currency)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to="/araclar/$vehicleId"
                      params={{ vehicleId: item.vehicleId }}
                      aria-label={`${item.plate} geçmişini görüntüle`}
                      className="ml-auto grid h-8 w-8 place-items-center rounded-lg border border-input text-muted-foreground hover:text-foreground"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination && pagination.total > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4 text-sm">
            <span className="text-muted-foreground">
              Toplam {pagination.total} işlem · Sayfa {pagination.page}/
              {Math.max(pagination.totalPages, 1)}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || historyQuery.isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="h-9 rounded-lg border border-input px-3 font-semibold disabled:opacity-40"
              >
                Önceki
              </button>
              <button
                type="button"
                disabled={page >= pagination.totalPages || historyQuery.isFetching}
                onClick={() => setPage((current) => current + 1)}
                className="h-9 rounded-lg border border-input px-3 font-semibold disabled:opacity-40"
              >
                Sonraki
              </button>
            </div>
          </div>
        )}
      </div>

      <Dialog
        open={newOperationOpen}
        onOpenChange={(open) => {
          setNewOperationOpen(open);
          if (!open) setVehicleSearch("");
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Yeni İşlem Başlat</DialogTitle>
            <DialogDescription>
              Mevcut bir plakayı seçin veya yeni plakayı bekleyen araçlara ekleyin.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={vehicleSearch}
              onChange={(event) => setVehicleSearch(event.target.value.toUpperCase())}
              placeholder="Plaka ara..."
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {vehicleQuery.isFetching && (
              <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" /> Araçlar aranıyor...
              </div>
            )}
            {vehicleQuery.error instanceof Error && (
              <div className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
                {vehicleQuery.error.message}
              </div>
            )}
            {vehicleQuery.data?.items.map((vehicle) => {
              const name = vehicle.customer
                ? [vehicle.customer.firstName, vehicle.customer.lastName]
                    .filter(Boolean)
                    .join(" ") || vehicle.customer.phone
                : null;
              return (
                <button
                  key={vehicle.vehicleId}
                  type="button"
                  disabled={createVisitMutation.isPending}
                  onClick={() => createVisitMutation.mutate(vehicle.vehicleId)}
                  className="flex w-full items-center justify-between rounded-lg border border-border/60 p-3 text-left hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
                >
                  <span>
                    <span className="block font-semibold">{vehicle.plate}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[vehicle.brand, vehicle.model, name].filter(Boolean).join(" · ") ||
                        "Araç bilgisi yok"}
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-primary">Seç</span>
                </button>
              );
            })}
            {debouncedVehicleSearch.length >= 2 &&
              vehicleQuery.data?.items.length === 0 &&
              !vehicleQuery.isFetching && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Mevcut araç bulunamadı.
                </div>
              )}
            {debouncedVehicleSearch.length < 2 && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Aramak için en az iki karakter girin.
              </div>
            )}
          </div>
          {normalizedNewPlate.length >= 5 &&
            debouncedVehicleSearch.replace(/\s+/g, "").toUpperCase() === normalizedNewPlate &&
            vehicleQuery.isSuccess &&
            !exactVehicleExists && (
              <button
                type="button"
                disabled={createPendingMutation.isPending}
                onClick={() => createPendingMutation.mutate(normalizedNewPlate)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-primary/40 font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
              >
                {createPendingMutation.isPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {normalizedNewPlate} plakasını bekleyen araçlara ekle
              </button>
            )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
