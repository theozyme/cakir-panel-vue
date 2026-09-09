import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, Fragment, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Clock,
  Car,
  ListChecks,
  TrendingUp,
  CalendarRange,
  Plus,
  ArrowRight,
  ChevronDown,
  LoaderCircle,
  Wallet,
  CheckCircle2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { formatTRY } from "@/components/shared/StatusBadge";
import { apiRequest } from "@/lib/api";
import { formatMoneyString } from "@/lib/money";
import type {
  Currency,
  DailyVehicleOperationResponse,
  DailyVehicleVisit,
  PendingVehicle,
  VehicleLookupResponse,
} from "@/types/business";
import type { DashboardFinance, DashboardPaymentPeriod } from "@/types/reports";

interface DashboardMetricProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  tone?: "default" | "success" | "warning" | "destructive" | "primary";
  hint?: string;
}

const metricTone = {
  default: "bg-muted text-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning",
  destructive: "bg-destructive/10 text-destructive",
} as const;

function DashboardMetric({ label, value, icon, tone = "default", hint }: DashboardMetricProps) {
  return (
    <div
      className={`min-w-0 rounded-xl border p-4 ${tone === "primary" ? "border-primary/25 bg-primary/[0.045]" : "border-border bg-card"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${metricTone[tone]}`}>
          {icon}
        </div>
      </div>
      <div className="mt-2 min-w-0">
        <div className="break-words text-2xl font-bold tracking-tight text-foreground tabular-nums">
          {value}
        </div>
        {hint && (
          <div className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{hint}</div>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ana Sayfa · Çakır Oto Yönetim Paneli" },
      { name: "description", content: "Günlük araç işlemleri, kazanç ve stok özet paneli." },
      { property: "og:title", content: "Çakır Oto Yönetim Paneli" },
      { property: "og:description", content: "Araç, stok ve finans yönetim panosu." },
    ],
  }),
  component: Dashboard,
});

const paymentMethodColors: Record<string, string> = {
  CASH: "var(--color-chart-2)",
  CREDIT_CARD: "var(--color-chart-1)",
  BANK_TRANSFER: "var(--color-chart-5)",
  MAIL_ORDER: "var(--color-chart-3)",
};

const paymentPeriodOptions: Array<{ value: DashboardPaymentPeriod; label: string }> = [
  { value: "today", label: "Bugün" },
  { value: "month", label: "Bu ay" },
  { value: "30d", label: "Son 30 gün" },
  { value: "90d", label: "Son 90 gün" },
  { value: "1y", label: "Son 1 yıl" },
];

const getTodayDateKey = () => {
  const today = new Date();

  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`;
};

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const paymentMethodLabel: Record<string, string> = {
  CASH: "Nakit",
  CREDIT_CARD: "Kredi Kartı",
  BANK_TRANSFER: "Havale",
  MAIL_ORDER: "Mail Order",
};

const customerName = (customer: DailyVehicleVisit["customer"]) => {
  if (!customer) return "Müşteri yok";

  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ");

  return name || customer.phone || "Müşteri yok";
};

const formatCurrency = (value: string, currency: "TRY" | "USD") =>
  formatMoneyString(value, currency);

const formatTotals = (totals?: { TRY: string; USD: string }) => {
  if (!totals) return formatTRY(0);

  const parts = [];
  if (totals.TRY !== "0.00") parts.push(formatMoneyString(totals.TRY, "TRY"));
  if (totals.USD !== "0.00") parts.push(formatMoneyString(totals.USD, "USD"));
  return parts.length > 0 ? parts.join(" / ") : formatTRY(0);
};

function FinanceCurrencySelector({
  value,
  hasUsd,
  onChange,
}: {
  value: Currency;
  hasUsd: boolean;
  onChange: (currency: Currency) => void;
}) {
  if (!hasUsd) return null;

  return (
    <div className="inline-flex rounded-md border border-input bg-background p-0.5">
      {(["TRY", "USD"] as const).map((currency) => (
        <button
          key={currency}
          type="button"
          aria-pressed={value === currency}
          onClick={() => onChange(currency)}
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
            value === currency
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {currency}
        </button>
      ))}
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [plaka, setPlaka] = useState("");
  const [plateLookup, setPlateLookup] = useState("");
  const [plateSuggestionsOpen, setPlateSuggestionsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayDateKey);
  const [financeCurrency, setFinanceCurrency] = useState<Currency>("TRY");
  const [paymentPeriod, setPaymentPeriod] = useState<DashboardPaymentPeriod>("month");
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);
  const pendingQuery = useQuery({
    queryKey: ["pending-vehicles"],
    queryFn: () => apiRequest<PendingVehicle[]>("/api/pending-vehicles"),
  });
  const dailyQuery = useQuery({
    queryKey: ["vehicle-operations", selectedDate],
    queryFn: () =>
      apiRequest<DailyVehicleOperationResponse>(`/api/vehicle-operations?date=${selectedDate}`),
  });
  const dashboardFinanceQuery = useQuery({
    queryKey: ["reports", "dashboard", selectedDate, paymentPeriod],
    queryFn: () =>
      apiRequest<DashboardFinance>(
        `/api/reports/dashboard?date=${selectedDate}&paymentPeriod=${paymentPeriod}`,
      ),
    placeholderData: (previousData) => previousData,
  });
  const annualFinanceQuery = useQuery({
    queryKey: ["reports", "dashboard", "monthly-average", selectedDate],
    queryFn: () =>
      apiRequest<DashboardFinance>(`/api/reports/dashboard?date=${selectedDate}&paymentPeriod=1y`),
  });
  const monthToDateFinanceQuery = useQuery({
    queryKey: ["reports", "dashboard", "month-to-date-average", selectedDate],
    queryFn: () =>
      apiRequest<DashboardFinance>(`/api/reports/dashboard?date=${selectedDate}&paymentPeriod=mtd`),
  });
  const plateLookupQuery = useQuery({
    queryKey: ["vehicles", "dashboard-plate-lookup", plateLookup],
    queryFn: () =>
      apiRequest<VehicleLookupResponse>(
        `/api/vehicles?search=${encodeURIComponent(plateLookup)}&limit=10`,
      ),
    enabled: plateLookup.length >= 3,
  });
  const createPendingMutation = useMutation({
    mutationFn: (plate: string) =>
      apiRequest<PendingVehicle>("/api/pending-vehicles", {
        method: "POST",
        body: JSON.stringify({ plate }),
      }),
    onSuccess: () => {
      setPlaka("");
      void queryClient.invalidateQueries({ queryKey: ["pending-vehicles"] });
      toast.success("Araç bekleyen listesine eklendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const cancelPendingMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/api/pending-vehicles/${id}`, { method: "DELETE" }),
    onSuccess: () => toast.success("Bekleyen araç iptal edildi"),
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["pending-vehicles"] }),
  });
  const dailyData = dailyQuery.data;
  const dailyLoading = dailyQuery.isLoading;
  const dailyError = dailyQuery.error instanceof Error ? dailyQuery.error.message : null;
  const pendingVehicles = pendingQuery.data ?? [];
  const bekleyen = pendingVehicles.length;
  const isToday = selectedDate === getTodayDateKey();
  const bugun = dailyData?.summary.totalVehicles ?? 0;
  const totalOperationsValue =
    dailyLoading || dailyError ? "—" : (dailyData?.summary.totalOperations ?? 0);
  const dailyEarningsValue =
    dailyLoading || dailyError ? "—" : formatTotals(dailyData?.summary.totalsByCurrency);
  const dashboardFinance = dashboardFinanceQuery.data;
  const financeHasUsd = Boolean(
    dashboardFinance &&
    [
      ...dashboardFinance.dailyEarnings.map((item) => item.amounts.USD),
      ...dashboardFinance.paymentMethods.map((item) => item.amounts.USD),
    ].some((value) => Number(value) !== 0),
  );
  const dailyEarningsChart = (dashboardFinance?.dailyEarnings ?? []).map((item) => ({
    day: item.label,
    earnings: Number(item.amounts[financeCurrency]),
  }));
  const paymentDistribution = (dashboardFinance?.paymentMethods ?? [])
    .map((item) => ({
      key: item.key,
      name: item.label,
      value: Number(item.amounts[financeCurrency]),
      color: paymentMethodColors[item.key] ?? "var(--color-muted-foreground)",
    }))
    .filter((item) => item.value !== 0);
  const monthlyAverageValue =
    annualFinanceQuery.isLoading || annualFinanceQuery.isError
      ? "-"
      : formatTotals(
          (annualFinanceQuery.data?.paymentMethods ?? []).reduce(
            (totals, item) => ({
              TRY: (Number(totals.TRY) + Number(item.amounts.TRY) / 12).toFixed(2),
              USD: (Number(totals.USD) + Number(item.amounts.USD) / 12).toFixed(2),
            }),
            { TRY: "0.00", USD: "0.00" },
          ),
        );
  const selectedDayOfMonth = Number(selectedDate.slice(8, 10));
  const monthlyDailyAverageValue =
    monthToDateFinanceQuery.isLoading || monthToDateFinanceQuery.isError
      ? "-"
      : formatTotals(
          (monthToDateFinanceQuery.data?.paymentMethods ?? []).reduce(
            (totals, item) => ({
              TRY: (Number(totals.TRY) + Number(item.amounts.TRY) / selectedDayOfMonth).toFixed(2),
              USD: (Number(totals.USD) + Number(item.amounts.USD) / selectedDayOfMonth).toFixed(2),
            }),
            { TRY: "0.00", USD: "0.00" },
          ),
        );

  useEffect(() => {
    if (!financeHasUsd) setFinanceCurrency("TRY");
  }, [financeHasUsd]);

  useEffect(() => {
    const normalized = plaka.trim().toUpperCase().replace(/\s+/g, "");
    const timer = window.setTimeout(
      () => setPlateLookup(normalized.length >= 3 ? normalized : ""),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [plaka]);

  return (
    <AppLayout title="Ana Sayfa">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            OPERASYON ÖZETİ
          </div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">İşletmenize bir bakış</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Araç akışı, günlük işlemler ve kazançlar tek yerde.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isToday && (
            <button
              type="button"
              onClick={() => {
                setSelectedDate(getTodayDateKey());
                setExpandedVisitId(null);
              }}
              className="h-10 rounded-lg border border-border bg-card px-3 text-xs font-semibold hover:bg-accent"
            >
              Bugüne dön
            </button>
          )}
          <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3">
            <CalendarRange className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="sr-only">Özet tarihi</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => {
                setSelectedDate(event.target.value || getTodayDateKey());
                setExpandedVisitId(null);
              }}
              className="min-w-0 bg-transparent text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </label>
          <Link
            to="/raporlar"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold hover:bg-accent"
          >
            Raporlar <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
      <section aria-label="Günlük özet" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <DashboardMetric
          label="Bekleyen Araç"
          value={pendingQuery.isLoading || pendingQuery.isError ? "—" : bekleyen}
          icon={<Clock className="h-5 w-5" />}
          tone="warning"
          hint="İşlem sırası bekleyen araçlar"
        />
        <DashboardMetric
          label={isToday ? "Bugün Gelen Araç" : "Gelen Araç"}
          value={dailyLoading || dailyError ? "—" : bugun}
          icon={<Car className="h-5 w-5" />}
          tone="primary"
          hint={isToday ? "Bugünkü araç girişleri" : "Seçili tarihteki araç girişleri"}
        />
        <DashboardMetric
          label="Toplam İşlem"
          value={totalOperationsValue}
          icon={<ListChecks className="h-5 w-5" />}
          hint="Seçili güne ait işlem adedi"
        />
        <DashboardMetric
          label="Günlük Kazanç"
          value={dailyEarningsValue}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="success"
          hint="Seçili günün toplam kazancı"
        />
        <DashboardMetric
          label="Aylık Ortalama Kazanç"
          value={monthlyAverageValue}
          icon={<CalendarRange className="h-5 w-5" />}
          tone="success"
          hint={`İlgili ay günlük ort.: ${monthlyDailyAverageValue}`}
        />
      </section>

      <section
        aria-label="Operasyon takibi"
        className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.65fr)]"
      >
        <div className="min-w-0 rounded-xl border border-primary/20 bg-card p-5">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">Hızlı araç kaydı</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Yeni gelen aracı sıraya ekleyin.
                </p>
              </div>
            </div>
            <label htmlFor="dashboard-plate" className="text-xs font-semibold">
              Araç plakası
            </label>
          </div>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const normalized = plaka.trim().toUpperCase().replace(/\s+/g, "");
              if (!normalized) {
                toast.error("Plaka girin");
                return;
              }
              setPlateSuggestionsOpen(false);
              createPendingMutation.mutate(normalized);
            }}
          >
            <div className="relative min-w-0 flex-1">
              <input
                id="dashboard-plate"
                value={plaka}
                onFocus={() => setPlateSuggestionsOpen(true)}
                onChange={(event) => {
                  setPlaka(event.target.value.toUpperCase());
                  setPlateSuggestionsOpen(true);
                }}
                placeholder="34 ABC 123"
                autoComplete="off"
                onKeyDown={(event) => {
                  if (event.key === "Escape") setPlateSuggestionsOpen(false);
                }}
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base font-semibold tracking-wider outline-none transition-shadow placeholder:font-normal placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
              {plateSuggestionsOpen && plateLookup.length >= 3 && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg">
                  {plateLookupQuery.isLoading && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Plakalar aranıyor...
                    </div>
                  )}
                  {!plateLookupQuery.isLoading && plateLookupQuery.data?.items.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Kayıtlı plaka bulunamadı.
                    </div>
                  )}
                  {plateLookupQuery.data?.items.map((vehicle) => (
                    <button
                      key={vehicle.vehicleId}
                      type="button"
                      onClick={() => {
                        setPlaka(vehicle.plate);
                        setPlateSuggestionsOpen(false);
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <span className="font-semibold">{vehicle.plate}</span>
                      {(vehicle.brand || vehicle.model) && (
                        <span className="truncate text-xs text-muted-foreground">
                          {[vehicle.brand, vehicle.model].filter(Boolean).join(" ")}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={createPendingMutation.isPending}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createPendingMutation.isPending ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Ekle
            </button>
          </form>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Kayıtlı araçları bulmak için en az 3 karakter girin.
          </p>
          <Link
            to="/araclar"
            className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs font-semibold text-primary"
          >
            Araç işlemlerine git <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="card-elevated p-4 md:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
            <h2 className="flex items-center gap-2 text-base font-bold">
              Bekleyen Araçlar{" "}
              <span className="rounded-md bg-warning/15 px-2 py-0.5 text-xs text-warning-foreground">
                {pendingQuery.isLoading || pendingQuery.isError ? "—" : bekleyen}
              </span>
            </h2>
            <Link
              to="/araclar"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
            >
              Tümü <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {pendingQuery.isLoading && <div className="h-16 animate-pulse rounded-lg bg-muted" />}
            {pendingQuery.error instanceof Error && (
              <div className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
                {pendingQuery.error.message}
              </div>
            )}
            {!pendingQuery.isLoading && !pendingQuery.error && pendingVehicles.length === 0 && (
              <div className="flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/25 p-4 text-center">
                <CheckCircle2 className="mb-2 h-6 w-6 text-success" />
                <p className="text-sm font-semibold">Bekleyen araç yok</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Yeni gelen araçları hızlı kayıt alanından ekleyebilirsiniz.
                </p>
              </div>
            )}
            {pendingVehicles.map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background/50 p-3 sm:gap-3"
              >
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-warning/20 text-warning">
                  <Car className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{v.plate}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    Bekleme: {formatTime(v.createdAt)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    navigate({ to: "/araclar/yeni", search: { pendingVehicleId: v.id } })
                  }
                  className="inline-flex h-9 items-center rounded-lg border border-warning/40 px-3 text-xs font-semibold text-warning hover:bg-warning/10 disabled:opacity-50"
                >
                  İşleme Al
                </button>
                <button
                  type="button"
                  disabled={cancelPendingMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`${v.plate} plakalı bekleyen araç iptal edilsin mi?`))
                      cancelPendingMutation.mutate(v.id);
                  }}
                  className="inline-flex h-9 items-center rounded-lg border border-destructive/40 px-3 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  İptal
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="card-elevated overflow-hidden xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 p-4 pb-3 md:p-5 md:pb-3">
            <div>
              <h2 className="text-base font-bold">Günlük Araç İşlemleri</h2>
              <div className="mt-1 text-xs text-muted-foreground">
                {dailyData
                  ? `${dailyData.summary.totalVehicles} araç · ${dailyData.summary.totalOperations} işlem · ${formatTotals(
                      dailyData.summary.totalsByCurrency,
                    )}`
                  : "Araç işlem listesi"}
              </div>
            </div>
            <span className="rounded-lg bg-primary/5 px-3 py-2 text-xs font-medium text-primary">
              {new Intl.DateTimeFormat("tr-TR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }).format(new Date(`${selectedDate}T12:00:00`))}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="sticky top-0 z-10 bg-muted/80 text-[11px] uppercase tracking-wide text-muted-foreground backdrop-blur">
                <tr>
                  <th className="w-10 px-4 py-2.5" />
                  <th className="px-4 py-2.5 text-left font-semibold">Plaka</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Müşteri</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Araç</th>
                  <th className="px-4 py-2.5 text-right font-semibold">İşlem</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Toplam</th>
                </tr>
              </thead>
              <tbody>
                {dailyLoading &&
                  [1, 2, 3].map((item) => (
                    <tr key={item} className="border-t border-border/60">
                      <td className="px-4 py-3" colSpan={6}>
                        <div className="h-5 animate-pulse rounded bg-muted" />
                      </td>
                    </tr>
                  ))}

                {!dailyLoading && dailyError && (
                  <tr className="border-t border-border/60">
                    <td className="px-4 py-8 text-center text-sm text-destructive" colSpan={6}>
                      {dailyError}
                    </td>
                  </tr>
                )}

                {!dailyLoading && !dailyError && dailyData?.visits.length === 0 && (
                  <tr className="border-t border-border/60">
                    <td className="px-4 py-8 text-center text-sm text-muted-foreground" colSpan={6}>
                      <Car className="mx-auto mb-3 h-7 w-7 text-muted-foreground/50" />
                      <p className="font-semibold text-foreground">Bu güne ait işlem bulunmuyor</p>
                      <p className="mt-1 text-xs">
                        Başka bir tarih seçebilir veya araç işlemlerinden yeni kayıt açabilirsiniz.
                      </p>
                    </td>
                  </tr>
                )}

                {!dailyLoading &&
                  !dailyError &&
                  dailyData?.visits.map((visit) => {
                    const isExpanded = expandedVisitId === visit.visitId;

                    return (
                      <Fragment key={visit.visitId}>
                        <tr className="border-t border-border/60 transition-colors hover:bg-muted/30">
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => setExpandedVisitId(isExpanded ? null : visit.visitId)}
                              className="grid h-8 w-8 place-items-center rounded-lg border border-input text-muted-foreground hover:text-foreground"
                              aria-label="İşlemleri göster"
                              aria-expanded={isExpanded}
                            >
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              />
                            </button>
                          </td>
                          <td className="px-4 py-2.5 font-semibold">
                            <span className="inline-flex whitespace-nowrap rounded-md border border-border bg-background px-2 py-1 font-mono text-xs tracking-wide">
                              {visit.plate}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            <div>{customerName(visit.customer)}</div>
                            {visit.customer?.phone && (
                              <div className="text-xs text-muted-foreground">
                                {visit.customer.phone}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {[visit.vehicle.brand, visit.vehicle.model].filter(Boolean).join(" ") ||
                              "-"}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold">
                            {visit.operationCount}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold">
                            {formatTotals(visit.totalsByCurrency)}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-t border-border/60 bg-muted/20">
                            <td className="px-4 py-3" colSpan={6}>
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                  <span>Giriş: {formatTime(visit.arrivalAt)}</span>
                                  {visit.note && <span>Not: {visit.note}</span>}
                                </div>
                                {visit.operations.length > 0 ? (
                                  visit.operations.map((operation) => (
                                    <div
                                      key={operation.id}
                                      className="grid gap-2 rounded-lg border border-border/60 bg-background/70 p-3 md:grid-cols-[1fr_auto_auto]"
                                    >
                                      <div className="min-w-0">
                                        <div className="truncate font-semibold">
                                          {operation.description}
                                        </div>
                                        {operation.note && (
                                          <div className="mt-0.5 text-xs text-muted-foreground">
                                            {operation.note}
                                          </div>
                                        )}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {formatTime(operation.operationAt)} ·{" "}
                                        {paymentMethodLabel[operation.paymentMethod] ??
                                          operation.paymentMethod}
                                      </div>
                                      <div className="text-right font-bold">
                                        {formatCurrency(operation.price, operation.currency)}
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="rounded-lg border border-border/60 bg-background/70 p-3 text-sm text-muted-foreground">
                                    Bu ziyarette kayıtlı işlem yok.
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section
        aria-label="Finansal özet"
        className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"
      >
        <div className="card-elevated p-4 md:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold">
                <TrendingUp className="h-4 w-4 text-primary" />
                Kazanç akışı
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">Günlere göre toplam kazanç</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Son 7 gün</span>
              <FinanceCurrencySelector
                value={financeCurrency}
                hasUsd={financeHasUsd}
                onChange={setFinanceCurrency}
              />
            </div>
          </div>
          <div className="h-64">
            {dashboardFinanceQuery.isLoading ? (
              <div className="h-full animate-pulse rounded-lg bg-muted" />
            ) : dashboardFinanceQuery.error instanceof Error ? (
              <div className="grid h-full place-items-center text-sm text-destructive">
                {dashboardFinanceQuery.error.message}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dailyEarningsChart}
                  barSize={32}
                  margin={{ top: 16, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    stroke="var(--color-muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${Number(value) / 1000}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                    }}
                    formatter={(value: number) =>
                      formatMoneyString(value.toFixed(2), financeCurrency)
                    }
                  />
                  <Bar
                    name="Kazanç"
                    dataKey="earnings"
                    fill="var(--color-primary)"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card-elevated p-4 md:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Wallet className="h-4 w-4 text-primary" />
              Ödeme Dağılımı
            </h2>
            <div className="flex items-center gap-2">
              <select
                aria-label="Ödeme dağılımı dönemi"
                value={paymentPeriod}
                onChange={(event) => setPaymentPeriod(event.target.value as DashboardPaymentPeriod)}
                className="h-7 rounded-md border border-input bg-background px-2 text-[11px] font-medium outline-none focus:border-primary"
              >
                {paymentPeriodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <FinanceCurrencySelector
                value={financeCurrency}
                hasUsd={financeHasUsd}
                onChange={setFinanceCurrency}
              />
            </div>
          </div>
          <div className="h-48">
            {dashboardFinanceQuery.isLoading ? (
              <div className="h-full animate-pulse rounded-lg bg-muted" />
            ) : dashboardFinanceQuery.error instanceof Error ? (
              <div className="grid h-full place-items-center text-sm text-destructive">
                {dashboardFinanceQuery.error.message}
              </div>
            ) : paymentDistribution.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">
                Seçili dönemde ödeme kaydı yok.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentDistribution}
                    dataKey="value"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {paymentDistribution.map((item) => (
                      <Cell key={item.key} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) =>
                      formatMoneyString(value.toFixed(2), financeCurrency)
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-1 space-y-2 border-t border-border/70 pt-3">
            {paymentDistribution.map((p) => (
              <div key={p.key} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                  {p.name}
                </span>
                <span className="font-semibold">
                  {formatMoneyString(p.value.toFixed(2), financeCurrency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
