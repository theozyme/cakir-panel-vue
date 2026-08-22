import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Activity, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/shared/StatCard";
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
}: {
  items: ReportDistributionItem[];
  currency: Currency;
}) {
  const visibleItems = items.filter(
    (item) => item.count > 0 || !isZeroMoney(item.amounts[currency]),
  );

  if (visibleItems.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Seçili dönemde kayıt yok
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {visibleItems.map((item) => {
        const width = Math.min(100, Math.max(0, Number(item.percentages[currency])));
        return (
          <div key={item.key}>
            <div className="mb-1.5 flex items-start justify-between gap-3 text-sm">
              <div>
                <div className="font-semibold">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.count} işlem</div>
              </div>
              <div className="text-right">
                <div className="font-bold">{money(item.amounts[currency], currency)}</div>
                <div className="text-xs text-muted-foreground">%{item.percentages[currency]}</div>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${width}%` }}
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
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.key} className="rounded-lg border border-border/60 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{item.label}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {item.source === "SUPPLIER_TRANSACTION_PAYMENT"
                  ? "Mail Order ödemeleri"
                  : "Özel Ödemeler"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold">{money(item.amounts[currency], currency)}</div>
              <div className="text-xs text-muted-foreground">%{item.percentages[currency]}</div>
            </div>
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
    if (!hasUsd) setCurrency("TRY");
  }, [hasUsd]);

  const dateInput =
    period === "day" ? (
      <Input
        type="date"
        value={date}
        onChange={(event) => event.target.value && setDate(event.target.value)}
      />
    ) : period === "month" ? (
      <Input
        type="month"
        value={date.slice(0, 7)}
        onChange={(event) => event.target.value && setDate(`${event.target.value}-01`)}
      />
    ) : (
      <Input
        type="number"
        min="2000"
        max="9999"
        key={date.slice(0, 4)}
        defaultValue={date.slice(0, 4)}
        onBlur={(event) => {
          if (/^\d{4}$/.test(event.target.value)) setDate(`${event.target.value}-01-01`);
        }}
      />
    );

  const trendData = (overview?.trend ?? []).map((item) => ({
    label: item.label,
    revenue: Number(item.revenue[currency]),
    expenses: Number(item.expenses[currency]),
    net: Number(item.net[currency]),
  }));

  return (
    <AppLayout title="Raporlar">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 rounded-xl border border-border/60 bg-card p-4">
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
                  onClick={() => setPeriod(value)}
                >
                  {periodLabels[value]}
                </Button>
              ))}
            </div>
          </div>
          <div className="w-44">
            <div className="mb-1 text-xs font-medium text-muted-foreground">Tarih</div>
            {dateInput}
          </div>
          <div className="pb-2 text-xs text-muted-foreground">Saat dilimi: Europe/Istanbul</div>
        </div>
        <div className="flex items-center gap-3">
          {overviewQuery.isFetching && !overviewQuery.isPending && (
            <span className="text-xs text-muted-foreground">Güncelleniyor…</span>
          )}
          <CurrencySelector currency={currency} hasUsd={hasUsd} onChange={setCurrency} />
        </div>
      </div>

      {overviewQuery.isPending && (
        <div className="card-elevated grid min-h-48 place-items-center p-6 text-sm text-muted-foreground">
          Rapor verileri yükleniyor…
        </div>
      )}

      {overviewQuery.isError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Rapor verileri alınamadı: {overviewQuery.error.message}
        </div>
      )}

      {overview && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Ciro"
              value={money(overview.revenue.TRY, "TRY")}
              hint={hasUsd ? money(overview.revenue.USD, "USD") : undefined}
              icon={<TrendingUp className="h-5 w-5" />}
              tone="success"
            />
            <StatCard
              label="Gider"
              value={money(overview.expenses.total.TRY, "TRY")}
              hint={
                hasUsd
                  ? `${money(overview.expenses.total.USD, "USD")} · Mail Order + Özel Ödemeler`
                  : "Mail Order + Özel Ödemeler"
              }
              icon={<TrendingDown className="h-5 w-5" />}
              tone="destructive"
            />
            <StatCard
              label="Net Kazanç"
              value={money(overview.net.TRY, "TRY")}
              hint={hasUsd ? money(overview.net.USD, "USD") : undefined}
              icon={<Wallet className="h-5 w-5" />}
              tone={overview.net.TRY.startsWith("-") ? "destructive" : "primary"}
            />
            <StatCard
              label="İşlem Sayısı"
              value={overview.totalOperations}
              hint={`${overview.totalVehicles} araç ziyareti`}
              icon={<Activity className="h-5 w-5" />}
              tone="warning"
            />
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-3">
            <div className="card-elevated p-5 xl:col-span-2">
              <h2 className="mb-1 text-base font-bold">İşlem Türleri Dağılımı</h2>
              <p className="mb-5 text-xs text-muted-foreground">
                İşlem adedi ve toplam ciro içindeki payı
              </p>
              <DistributionList items={overview.operationTypes} currency={currency} />
            </div>
            <div className="card-elevated p-5">
              <h2 className="mb-1 text-base font-bold">Ödeme Yöntemleri</h2>
              <p className="mb-5 text-xs text-muted-foreground">
                Mail Order burada ödeme yöntemi istatistiğidir
              </p>
              <DistributionList items={overview.paymentMethods} currency={currency} />
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <div className="card-elevated p-5 xl:col-span-2">
              <h2 className="mb-1 text-base font-bold">Ciro / Gider / Net</h2>
              <p className="mb-4 text-xs text-muted-foreground">
                Tüm hesaplamalar sunucuda yapılır · {currency}
              </p>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="reportRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-success)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--color-success)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="reportExpenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-destructive)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--color-destructive)" stopOpacity={0} />
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
                    />
                    <YAxis
                      stroke="var(--color-muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${Number(value) / 1000}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 12,
                      }}
                      formatter={(value) => chartMoney(value, currency)}
                    />
                    <Legend />
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
              </div>
            </div>

            <div className="card-elevated p-5">
              <h2 className="mb-1 text-base font-bold">Gider Dağılımı</h2>
              <p className="mb-4 text-xs text-muted-foreground">
                Toplam giderin kaynakları ayrı gösterilir
              </p>
              <div className="mb-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/60 p-3">
                  <div className="text-[11px] font-medium text-muted-foreground">Mail Order</div>
                  <div className="mt-1 text-sm font-bold">
                    {money(overview.expenses.sources.mailOrder[currency], currency)}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/60 p-3">
                  <div className="text-[11px] font-medium text-muted-foreground">Özel Ödemeler</div>
                  <div className="mt-1 text-sm font-bold">
                    {money(overview.expenses.sources.specialPayments[currency], currency)}
                  </div>
                </div>
              </div>
              <ExpenseBreakdown items={overview.expenseBreakdown} currency={currency} />
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}
