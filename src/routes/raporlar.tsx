import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  TrendingDown,
  TrendingUp,
  Wallet,
  CalendarRange,
  ChartNoAxesCombined,
  CreditCard,
  Layers,
  RefreshCw,
  Inbox,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ReferenceLine,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { formatMoneyString } from "@/lib/money";
import type { Currency } from "@/types/business";
import type {
  ReportDistributionItem,
  ReportExpenseBreakdownItem,
  ReportPeriod,
  ReportsOverview,
} from "@/types/reports";

export const Route = createFileRoute("/raporlar")({
  head: () => ({
    meta: [
      { title: "Raporlar · Çakır Oto" },
      { name: "description", content: "Günlük, aylık ve yıllık işletme raporları." },
      { property: "og:title", content: "Raporlar" },
      { property: "og:description", content: "Ciro, gider ve işlem dağılımları." },
    ],
  }),
  component: Raporlar,
});

const periodLabels: Record<ReportPeriod, string> = {
  day: "Günlük",
  month: "Aylık",
  year: "Yıllık",
};

const todayInIstanbul = () => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const isZeroMoney = (value: string) => /^-?0(?:\.0+)?$/.test(value.trim());

const money = (value: string, currency: Currency) => formatMoneyString(value, currency);

const chartMoney = (value: unknown, currency: Currency) => {
  const numeric = Number(value ?? 0);
  return money(Number.isFinite(numeric) ? numeric.toFixed(2) : "0.00", currency);
};

function ReportMetric({
  label,
  value,
  hint,
  icon,
  tone = "primary",
  featured = false,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: ReactNode;
  tone?: "primary" | "success" | "destructive" | "warning";
  featured?: boolean;
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    destructive: "bg-destructive/10 text-destructive",
    warning: "bg-warning/15 text-warning-foreground",
  };
  return (
    <div
      className={`min-w-0 rounded-xl border p-4 ${featured ? "border-primary/25 bg-primary/[0.045]" : "border-border bg-card"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-medium text-muted-foreground">{label}</h3>
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tones[tone]}`}>
          {icon}
        </span>
      </div>
      <div className="mt-3 break-words text-2xl font-bold tracking-tight tabular-nums">{value}</div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );
}

function ReportEmpty({
  description = "Farklı bir dönem seçerek raporları inceleyebilirsiniz.",
}: {
  description?: string;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-5 text-center">
      <Inbox className="mb-3 h-6 w-6 text-muted-foreground/60" aria-hidden="true" />
      <p className="text-sm font-semibold">Seçili dönemde kayıt yok</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function ReportHeading({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start gap-3 border-b border-border/70 pb-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-primary">
        {icon}
      </span>
      <div>
        <h2 className="text-base font-bold tracking-tight">{title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function CurrencySelector({
  currency,
  hasUsd,
  onChange,
}: {
  currency: Currency;
  hasUsd: boolean;
  onChange: (currency: Currency) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-input bg-card p-1">
      {(["TRY", "USD"] as const).map((value) => (
        <Button
          key={value}
          type="button"
          size="sm"
          variant={currency === value ? "default" : "ghost"}
          disabled={value === "USD" && !hasUsd}
          aria-pressed={currency === value}
          title={value === "USD" && !hasUsd ? "Seçili dönemde USD tutarı bulunmuyor" : undefined}
          onClick={() => onChange(value)}
        >
          {value}
        </Button>
      ))}
    </div>
  );
}

function DistributionList({
  items,
  currency,
  color = "var(--color-primary)",
}: {
  items: ReportDistributionItem[];
  currency: Currency;
  color?: string;
}) {
  const visibleItems = items
    .filter((item) => item.count > 0 || !isZeroMoney(item.amounts[currency]))
    .sort((a, b) => Number(b.amounts[currency]) - Number(a.amounts[currency]));

  if (visibleItems.length === 0) {
    return <ReportEmpty />;
  }

  return (
    <div className="divide-y divide-border/60">
      {visibleItems.map((item) => {
        const width = Math.min(100, Math.max(0, Number(item.percentages[currency])));
        return (
          <div key={item.key} className="py-3 first:pt-0 last:pb-0">
            <div className="mb-1.5 flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="font-semibold">{item.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {item.count.toLocaleString("tr-TR")} işlem
                </div>
              </div>
              <div className="shrink-0 text-right tabular-nums">
                <div className="font-semibold">{money(item.amounts[currency], currency)}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  %{item.percentages[currency]} pay
                </div>
              </div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div
                className="h-full rounded-full"
                style={{ width: `${width}%`, background: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExpenseBreakdown({
  items,
  currency,
}: {
  items: ReportExpenseBreakdownItem[];
  currency: Currency;
}) {
  if (items.length === 0)
    return <ReportEmpty description="Bu döneme ait gider kalemi bulunmuyor." />;
  return (
    <div className="divide-y divide-border/60">
      {items.map((item) => (
        <div key={item.key} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{item.label}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {item.source === "SUPPLIER_TRANSACTION_PAYMENT"
                  ? "Mail Order ödemeleri"
                  : "Özel Ödemeler"}
              </div>
            </div>
            <div className="shrink-0 text-right tabular-nums">
              <div className="text-sm font-bold">{money(item.amounts[currency], currency)}</div>
              <div className="text-xs text-muted-foreground">%{item.percentages[currency]}</div>
            </div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div
              className="h-full rounded-full bg-destructive/65"
              style={{
                width: `${Math.min(100, Math.max(0, Number(item.percentages[currency])))}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Raporlar() {
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [date, setDate] = useState(todayInIstanbul);
  const [currency, setCurrency] = useState<Currency>("TRY");
  const queryString = useMemo(
    () => new URLSearchParams({ period, date }).toString(),
    [date, period],
  );
  const overviewQuery = useQuery({
    queryKey: ["reports", "overview", period, date],
    queryFn: () => apiRequest<ReportsOverview>(`/api/reports/overview?${queryString}`),
  });
  const overview = overviewQuery.data;
  const hasUsd = Boolean(
    overview &&
    [overview.revenue.USD, overview.expenses.total.USD, overview.net.USD].some(
      (value) => !isZeroMoney(value),
    ),
  );

  useEffect(() => {
    if (overview && !hasUsd) setCurrency("TRY");
  }, [hasUsd, overview]);

  const dateInput =
    period === "day" ? (
      <Input
        id="report-date"
        type="date"
        value={date}
        onChange={(event) => event.target.value && setDate(event.target.value)}
      />
    ) : period === "month" ? (
      <Input
        id="report-date"
        type="month"
        value={date.slice(0, 7)}
        onChange={(event) => event.target.value && setDate(`${event.target.value}-01`)}
      />
    ) : (
      <Input
        id="report-date"
        type="number"
        min="2000"
        max="9999"
        key={date.slice(0, 4)}
        defaultValue={date.slice(0, 4)}
        onBlur={(event) => {
          if (/^\d{4}$/.test(event.target.value) && event.target.validity.valid) {
            setDate(`${event.target.value}-01-01`);
          } else {
            event.target.value = date.slice(0, 4);
          }
        }}
      />
    );

  const trendData = (overview?.trend ?? []).map((item) => ({
    label: item.label,
    revenue: Number(item.revenue[currency]),
    expenses: Number(item.expenses[currency]),
    net: Number(item.net[currency]),
  }));
  const periodTitle = new Intl.DateTimeFormat("tr-TR", {
    year: "numeric",
    ...(period !== "year" ? { month: "long" as const } : {}),
    ...(period === "day" ? { day: "numeric" as const } : {}),
  }).format(new Date(`${date}T12:00:00`));
  const otherCurrency: Currency = currency === "TRY" ? "USD" : "TRY";

  return (
    <AppLayout title="Raporlar">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            FİNANSAL GÖRÜNÜM
          </div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            Rakamların arkasındaki tablo
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Kazancınızı, giderlerinizi ve iş hacminizi birlikte değerlendirin.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium">
          <CalendarRange className="h-4 w-4 text-primary" />
          {periodTitle}
        </span>
      </div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Dönem</div>
            <div className="inline-flex rounded-lg border border-input bg-background p-1">
              {(["day", "month", "year"] as const).map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={period === value ? "default" : "ghost"}
                  aria-pressed={period === value}
                  onClick={() => setPeriod(value)}
                >
                  {periodLabels[value]}
                </Button>
              ))}
            </div>
          </div>
          <div className="w-44">
            <label
              htmlFor="report-date"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              {period === "year" ? "Yıl" : period === "month" ? "Ay" : "Tarih"}
            </label>
            {dateInput}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDate(todayInIstanbul())}
          >
            {period === "day" ? "Bugün" : period === "month" ? "Bu ay" : "Bu yıl"}
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {overviewQuery.isFetching && !overviewQuery.isPending && (
            <span role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Güncelleniyor…
            </span>
          )}
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Para birimi</div>
            <CurrencySelector currency={currency} hasUsd={hasUsd} onChange={setCurrency} />
          </div>
        </div>
      </div>
      <p className="mb-4 text-[11px] text-muted-foreground">
        Dönemler Türkiye saatine göre hesaplanır. Tutarlar seçili para birimindedir; işlem adetleri
        tüm para birimlerini kapsar.
      </p>

      {overviewQuery.isPending && (
        <div role="status" aria-label="Rapor verileri yükleniyor" className="space-y-4">
          <span className="sr-only">Rapor verileri yükleniyor…</span>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-36 animate-pulse rounded-xl border border-border bg-muted"
              />
            ))}
          </div>
          <div className="h-80 animate-pulse rounded-xl border border-border bg-muted" />
        </div>
      )}

      {overviewQuery.isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <span>Rapor verileri alınamadı: {overviewQuery.error.message}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={overviewQuery.isFetching}
            onClick={() => void overviewQuery.refetch()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Tekrar dene
          </Button>
        </div>
      )}

      {overview && (
        <>
          <section aria-label="Finansal özet" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ReportMetric
              label="Ciro"
              value={money(overview.revenue[currency], currency)}
              hint={
                hasUsd
                  ? `Diğer para birimi: ${money(overview.revenue[otherCurrency], otherCurrency)}`
                  : "Seçili dönemin toplam cirosu"
              }
              icon={<TrendingUp className="h-5 w-5" />}
              tone="success"
            />
            <ReportMetric
              label="Gider"
              value={money(overview.expenses.total[currency], currency)}
              hint={
                hasUsd
                  ? `${money(overview.expenses.total[otherCurrency], otherCurrency)} · Mail Order + Özel Ödemeler`
                  : "Mail Order + Özel Ödemeler"
              }
              icon={<TrendingDown className="h-5 w-5" />}
              tone="destructive"
            />
            <ReportMetric
              label="Net Kazanç"
              value={money(overview.net[currency], currency)}
              hint={
                hasUsd
                  ? `Diğer para birimi: ${money(overview.net[otherCurrency], otherCurrency)}`
                  : "Toplam ciro − toplam gider"
              }
              featured
              icon={<Wallet className="h-5 w-5" />}
              tone={overview.net[currency].startsWith("-") ? "destructive" : "primary"}
            />
            <ReportMetric
              label="İşlem Sayısı"
              value={overview.totalOperations.toLocaleString("tr-TR")}
              hint={`${overview.totalVehicles.toLocaleString("tr-TR")} araç ziyareti · Tüm para birimleri`}
              icon={<Activity className="h-5 w-5" />}
              tone="warning"
            />
          </section>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <div className="min-w-0 rounded-xl border border-border bg-card p-4 md:p-5 xl:col-span-2">
              <ReportHeading
                title="Finansal performans"
                description={`${periodTitle} · Ciro, gider ve net kazancın dönem içindeki seyri · ${currency}`}
                icon={<ChartNoAxesCombined className="h-4 w-4" />}
              />
              <div className="h-80">
                {trendData.length === 0 ? (
                  <ReportEmpty />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={trendData}
                      margin={{ top: 10, right: 12, bottom: 0, left: 0 }}
                      accessibilityLayer
                    >
                      <defs>
                        <linearGradient id="reportRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-success)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--color-success)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="reportExpenses" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="0%"
                            stopColor="var(--color-destructive)"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="100%"
                            stopColor="var(--color-destructive)"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-border)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        stroke="var(--color-muted-foreground)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={28}
                      />
                      <YAxis
                        stroke="var(--color-muted-foreground)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) =>
                          new Intl.NumberFormat("tr-TR", {
                            notation: "compact",
                            maximumFractionDigits: 1,
                          }).format(Number(value))
                        }
                      />
                      <ReferenceLine
                        y={0}
                        stroke="var(--color-muted-foreground)"
                        strokeDasharray="4 4"
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: 12,
                        }}
                        formatter={(value) => chartMoney(value, currency)}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={7}
                        wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
                      />
                      <Area
                        name="Ciro"
                        type="monotone"
                        dataKey="revenue"
                        stroke="var(--color-success)"
                        fill="url(#reportRevenue)"
                        strokeWidth={2}
                      />
                      <Area
                        name="Gider"
                        type="monotone"
                        dataKey="expenses"
                        stroke="var(--color-destructive)"
                        fill="url(#reportExpenses)"
                        strokeWidth={2}
                      />
                      <Area
                        name="Net"
                        type="monotone"
                        dataKey="net"
                        stroke="var(--color-primary)"
                        fill="transparent"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="min-w-0 rounded-xl border border-border bg-card p-4 md:p-5">
              <ReportHeading
                title="Gider Dağılımı"
                description={`Gider kaynakları ve toplam içindeki payları · ${currency}`}
                icon={<TrendingDown className="h-4 w-4" />}
              />
              <div className="mb-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/60 p-3">
                  <div className="text-[11px] font-medium text-muted-foreground">Mail Order</div>
                  <div className="mt-1 break-words text-sm font-bold tabular-nums">
                    {money(overview.expenses.sources.mailOrder[currency], currency)}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/60 p-3">
                  <div className="text-[11px] font-medium text-muted-foreground">Özel Ödemeler</div>
                  <div className="mt-1 break-words text-sm font-bold tabular-nums">
                    {money(overview.expenses.sources.specialPayments[currency], currency)}
                  </div>
                </div>
              </div>
              <ExpenseBreakdown items={overview.expenseBreakdown} currency={currency} />
            </div>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="min-w-0 rounded-xl border border-border bg-card p-4 md:p-5">
              <ReportHeading
                title="İşlem Türleri Dağılımı"
                description={`İşlem adedi ve ciro payı · Tutara göre sıralı · ${currency}`}
                icon={<Layers className="h-4 w-4" />}
              />
              <DistributionList items={overview.operationTypes} currency={currency} />
            </div>
            <div className="min-w-0 rounded-xl border border-border bg-card p-4 md:p-5">
              <ReportHeading
                title="Ödeme Yöntemleri"
                description={`Cironun ödeme yöntemlerine göre dağılımı · ${currency}`}
                icon={<CreditCard className="h-4 w-4" />}
              />
              <DistributionList
                items={overview.paymentMethods}
                currency={currency}
                color="var(--color-chart-5)"
              />
              <p className="mt-4 border-t border-border/70 pt-3 text-[11px] leading-relaxed text-muted-foreground">
                Buradaki Mail Order tutarı, müşterilerin ödeme yöntemini gösterir.
              </p>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}
