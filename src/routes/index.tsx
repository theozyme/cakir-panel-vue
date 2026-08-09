import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, Fragment, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Clock,
  Car,
  ListChecks,
  TrendingUp,
  AlertCircle,
  Wrench,
  PackageX,
  Plus,
  ArrowRight,
  ChevronDown,
  LoaderCircle,
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
import { mockStock, dailyEarnings } from "@/data/mock";
import { apiRequest } from "@/lib/api";
import { formatMoneyString } from "@/lib/money";
import type {
  ConfirmPendingVehicleResponse,
  DailyVehicleOperationResponse,
  DailyVehicleVisit,
  PendingVehicle,
} from "@/types/business";

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
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border/80 bg-card px-4 py-3.5 transition-colors hover:border-border">
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${metricTone[tone]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-0.5 truncate text-xl font-bold tracking-tight text-foreground">
          {value}
        </div>
        {hint && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</div>}
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

const paymentDistribution = [
  { name: "Nakit", value: 32000, color: "var(--color-chart-2)" },
  { name: "Kredi Kartı", value: 58000, color: "var(--color-chart-1)" },
  { name: "Havale", value: 41000, color: "var(--color-chart-5)" },
  { name: "Mail Order", value: 22000, color: "var(--color-chart-3)" },
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

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [plaka, setPlaka] = useState("");
  const [selectedDate, setSelectedDate] = useState(getTodayDateKey);
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
  const confirmPendingMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<ConfirmPendingVehicleResponse>(`/api/pending-vehicles/${id}/confirm`, {
        method: "POST",
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["pending-vehicles"] });
      void queryClient.invalidateQueries({ queryKey: ["vehicle-operations"] });
      navigate({ to: "/araclar/yeni", search: { visitId: result.visitId } });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const dailyData = dailyQuery.data;
  const dailyLoading = dailyQuery.isLoading;
  const dailyError = dailyQuery.error instanceof Error ? dailyQuery.error.message : null;
  const pendingVehicles = pendingQuery.data ?? [];
  const bekleyen = pendingVehicles.length;
  const bugun = dailyData?.summary.totalVehicles ?? 0;
  const totalOperationsValue = dailyLoading ? "-" : (dailyData?.summary.totalOperations ?? 0);
  const dailyEarningsValue = dailyLoading ? "-" : formatTotals(dailyData?.summary.totalsByCurrency);
  const acikAlacak = 78500;
  const servisteki = 3;
  const kritikStok = mockStock.filter((s) => s.adet <= s.kritikSeviye).length;

  return (
    <AppLayout title="Ana Sayfa">
      <section aria-label="Günlük özet" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardMetric
          label="Bekleyen Araç"
          value={bekleyen}
          icon={<Clock className="h-5 w-5" />}
          tone="warning"
        />
        <DashboardMetric
          label="Bugün Gelen Araç"
          value={bugun}
          icon={<Car className="h-5 w-5" />}
          tone="primary"
        />
        <DashboardMetric
          label="Toplam İşlem"
          value={totalOperationsValue}
          icon={<ListChecks className="h-5 w-5" />}
        />
        <DashboardMetric
          label="Günlük Kazanç"
          value={dailyEarningsValue}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="success"
        />
        <DashboardMetric
          label="Açık Alacak"
          value={formatTRY(acikAlacak)}
          icon={<AlertCircle className="h-5 w-5" />}
          tone="destructive"
        />
        <DashboardMetric
          label="Servisteki Araç"
          value={servisteki}
          icon={<Wrench className="h-5 w-5" />}
          tone="primary"
        />
        <DashboardMetric
          label="Kritik Stok"
          value={kritikStok}
          icon={<PackageX className="h-5 w-5" />}
          tone="destructive"
          hint="Stoğu eşik altında"
        />
        <div className="flex min-w-0 flex-col justify-center rounded-xl border border-primary/20 bg-primary/[0.035] px-4 py-3.5">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Hızlı Araç Ekle
            </div>
            <div className="mt-2 text-sm text-foreground">Plaka girip hemen kayıt açın.</div>
          </div>
          <form
            className="mt-2.5 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const normalized = plaka.trim().toUpperCase().replace(/\s+/g, "");
              if (!normalized) {
                toast.error("Plaka girin");
                return;
              }
              createPendingMutation.mutate(normalized);
            }}
          >
            <input
              value={plaka}
              onChange={(e) => setPlaka(e.target.value.toUpperCase())}
              placeholder="34 ABC 123"
              className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <button
              type="submit"
              disabled={createPendingMutation.isPending}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createPendingMutation.isPending ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Ekle
            </button>
          </form>
        </div>
      </section>

      <section aria-label="Finansal özet" className="mt-5 grid gap-4 xl:grid-cols-3">
        <div className="card-elevated p-4 xl:col-span-2 md:p-5">
          <div className="mb-3 flex items-center justify-between border-b border-border/70 pb-3">
            <h2 className="text-base font-bold">Günlük Kazanç</h2>
            <span className="text-xs text-muted-foreground">Son 7 gün</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyEarnings}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="gun"
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
                  tickFormatter={(v) => `${v / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                  }}
                  formatter={(v: number) => formatTRY(v)}
                />
                <Bar dataKey="kazanc" fill="var(--color-primary)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-elevated p-4 md:p-5">
          <div className="mb-3 flex items-center justify-between border-b border-border/70 pb-3">
            <h2 className="text-base font-bold">Ödeme Dağılımı</h2>
            <span className="text-xs text-muted-foreground">Bu ay</span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentDistribution}
                  dataKey="value"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                >
                  {paymentDistribution.map((p, i) => (
                    <Cell key={i} fill={p.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatTRY(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 space-y-2 border-t border-border/70 pt-3">
            {paymentDistribution.map((p) => (
              <div key={p.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                  {p.name}
                </span>
                <span className="font-semibold">{formatTRY(p.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-label="Operasyon takibi" className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="card-elevated p-4 md:p-5">
          <div className="mb-3 flex items-center justify-between border-b border-border/70 pb-3">
            <h2 className="text-base font-bold">Bekleyen Araçlar</h2>
            <Link
              to="/araclar"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
            >
              Tümü <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {pendingQuery.isLoading && <div className="h-16 animate-pulse rounded-lg bg-muted" />}
            {pendingQuery.error instanceof Error && (
              <div className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
                {pendingQuery.error.message}
              </div>
            )}
            {!pendingQuery.isLoading && !pendingQuery.error && pendingVehicles.length === 0 && (
              <div className="rounded-lg border border-border/60 p-3 text-sm text-muted-foreground">
                Bekleyen araç yok.
              </div>
            )}
            {pendingVehicles.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/50 p-3"
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
                  disabled={confirmPendingMutation.isPending}
                  onClick={() => confirmPendingMutation.mutate(v.id)}
                  className="inline-flex h-9 items-center rounded-lg border border-warning/40 px-3 text-xs font-semibold text-warning hover:bg-warning/10 disabled:opacity-50"
                >
                  İşleme Al
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="card-elevated overflow-hidden">
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
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => {
                setSelectedDate(event.target.value || getTodayDateKey());
                setExpandedVisitId(null);
              }}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
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
                      Bu tarihte araç işlemi yok.
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
                            >
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              />
                            </button>
                          </td>
                          <td className="px-4 py-2.5 font-semibold">{visit.plate}</td>
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
    </AppLayout>
  );
}
