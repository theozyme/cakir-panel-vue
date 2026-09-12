import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { useEffect, useMemo, useState } from "react";
import { Plus, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api";
import { formatMoneyString } from "@/lib/money";
import type {
  Currency,
  MailOrderPeriod,
  MailOrderSummary,
  MailOrderSupplier,
  MailOrderTrendItem,
  SupplierTransaction,
} from "@/types/business";

export const Route = createFileRoute("/mail-order")({
  head: () => ({
    meta: [
      { title: "Mail Order · Çakır Oto" },
      { name: "description", content: "Toptancı borç ve ödeme takibi." },
      { property: "og:title", content: "Mail Order Takip" },
      { property: "og:description", content: "TL ve USD toptancı hesap özetleri." },
    ],
  }),
  component: MailOrder,
});

type IstanbulDate = { year: number; month: number; day: number };
type TransactionDialogKind = "payment" | "debt";

const inputCls =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

const getIstanbulDate = (): IstanbulDate => {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;
  return { year: values.year ?? 1970, month: values.month ?? 1, day: values.day ?? 1 };
};

const pad = (value: number) => String(value).padStart(2, "0");
const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const emptySummary: MailOrderSummary = {
  TRY: { debtIncrease: "0.00", payments: "0.00", remainingDebt: "0.00" },
  USD: { debtIncrease: "0.00", payments: "0.00", remainingDebt: "0.00" },
};

const transactionLabels: Record<SupplierTransaction["type"], string> = {
  DEBT_INCREASE: "Borç / Mal Girişi",
  PAYMENT: "Ödeme",
  ADJUSTMENT: "Düzeltme",
  CANCEL: "İptal",
};

const transactionTone = (type: SupplierTransaction["type"]) => {
  if (type === "PAYMENT") return "success" as const;
  if (type === "DEBT_INCREASE") return "destructive" as const;
  if (type === "ADJUSTMENT") return "warning" as const;
  return "muted" as const;
};

const formatTransactionDate = (value: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

function TrendChart({ currency, data }: { currency: Currency; data: MailOrderTrendItem[] }) {
  const chartData = data.map((item) => ({
    label: item.label,
    debtIncrease: Number(item[currency].debtIncrease),
    payments: Number(item[currency].payments),
  }));

  return (
    <div>
      <div className="mb-2 text-sm font-bold">{currency}</div>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
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
              tickFormatter={(value) => `${value / 1000}k`}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: 12,
              }}
              formatter={(value) =>
                formatMoneyString(new Decimal(String(value ?? 0)).toFixed(2), currency)
              }
            />
            <Legend />
            <Bar
              name="Mal Girişi"
              dataKey="debtIncrease"
              fill="var(--color-destructive)"
              radius={[6, 6, 0, 0]}
            />
            <Bar
              name="Ödeme"
              dataKey="payments"
              fill="var(--color-success)"
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SupplierPaymentChart({
  currency,
  suppliers,
  selected,
  onSelect,
}: {
  currency: Currency;
  suppliers: MailOrderSupplier[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const rows = suppliers
    .filter((supplier) => supplier.currency === currency)
    .map((supplier) => ({ ...supplier, payment: new Decimal(supplier.periodPayments) }))
    .sort((a, b) => b.payment.comparedTo(a.payment) || a.name.localeCompare(b.name, "tr"));
  const total = rows.reduce((sum, row) => sum.plus(row.payment), new Decimal(0));
  const maximum = rows[0]?.payment ?? new Decimal(0);
  const paidCount = rows.filter((row) => row.payment.isPositive()).length;
  const label = currency === "TRY" ? "TL" : "USD";
  const barColor = currency === "TRY" ? "bg-primary" : "bg-success";

  return (
    <section
      className="min-w-0 rounded-xl border border-border/60 bg-background/50 p-4 sm:p-5"
      aria-label={`${label} firma ödemeleri`}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <span className={`h-2.5 w-2.5 rounded-full ${barColor}`} aria-hidden="true" />
            {label} hesapları
          </div>
          <p className="text-2xl font-bold tracking-tight tabular-nums">
            {formatMoneyString(total.toFixed(2), currency)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Seçili dönemde toplam ödeme</p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
          {paidCount} / {rows.length} firmaya ödeme
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {label} hesabı olan firma bulunmuyor.
        </p>
      ) : (
        <>
          {total.isZero() && (
            <p className="mb-3 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
              Bu dönemde ödeme yapılmadı.
            </p>
          )}
          <div className="mb-2 flex justify-between px-2 text-[11px] font-medium text-muted-foreground">
            <span>Firma · tutara göre sıralı</span>
            <span>Ödenen / toplam içindeki pay</span>
          </div>
          <ul className="space-y-1">
            {rows.map((row) => {
              const width = maximum.isPositive()
                ? row.payment.div(maximum).times(100).toNumber()
                : 0;
              const share = total.isPositive() ? row.payment.div(total).times(100).toNumber() : 0;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(row.id)}
                    aria-label={`${row.name}: ${formatMoneyString(row.periodPayments, currency)}. Hesap hareketlerini görüntüle`}
                    className={`w-full rounded-lg p-2 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selected === row.id ? "bg-muted/70" : ""}`}
                  >
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                      <span className="min-w-0 break-words font-semibold">
                        {row.name}
                        {!row.isActive && (
                          <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                            Pasif
                          </span>
                        )}
                      </span>
                      <span className="ml-auto flex shrink-0 items-baseline gap-2 tabular-nums">
                        <span className="font-bold">
                          {formatMoneyString(row.periodPayments, currency)}
                        </span>
                        <span className="w-12 text-right text-xs text-muted-foreground">
                          %{share.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}
                        </span>
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function MailOrder() {
  const initialDate = useMemo(getIstanbulDate, []);
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<MailOrderPeriod>("month");
  const [year, setYear] = useState(initialDate.year);
  const [month, setMonth] = useState(initialDate.month);
  const [day, setDay] = useState(initialDate.day);
  const [selected, setSelected] = useState("");
  const [dialogKind, setDialogKind] = useState<TransactionDialogKind | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [transactionAt, setTransactionAt] = useState("");
  const [firmDialogOpen, setFirmDialogOpen] = useState(false);
  const [firmName, setFirmName] = useState("");
  const [firmCurrency, setFirmCurrency] = useState<Currency>("TRY");

  const refreshSuppliers = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["mail-order"] }),
      queryClient.invalidateQueries({ queryKey: ["suppliers"] }),
    ]);
  const createFirmMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ id: string }>("/api/suppliers", {
        method: "POST",
        body: JSON.stringify({ name: firmName.trim(), currency: firmCurrency }),
      }),
    onSuccess: async (supplier) => {
      await refreshSuppliers();
      setSelected(supplier.id);
      setFirmDialogOpen(false);
      toast.success("Firma eklendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const statusMutation = useMutation({
    mutationFn: (supplier: MailOrderSupplier) =>
      apiRequest(`/api/suppliers/${supplier.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !supplier.isActive }),
      }),
    onSuccess: async (_result, supplier) => {
      await refreshSuppliers();
      toast.success(supplier.isActive ? "Firma pasife alındı" : "Firma aktif edildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filterQuery = useMemo(() => {
    const params = new URLSearchParams({ period, year: String(year) });
    if (period !== "year") params.set("month", String(month));
    if (period === "day") params.set("day", String(day));
    return params.toString();
  }, [day, month, period, year]);

  const summaryQuery = useQuery({
    queryKey: ["mail-order", "summary", filterQuery],
    queryFn: () => apiRequest<MailOrderSummary>(`/api/suppliers/summary?${filterQuery}`),
  });
  const suppliersQuery = useQuery({
    queryKey: ["mail-order", "suppliers", filterQuery],
    queryFn: () =>
      apiRequest<MailOrderSupplier[]>(`/api/suppliers?includeInactive=true&${filterQuery}`),
  });
  const trendQuery = useQuery({
    queryKey: ["mail-order", "trend", filterQuery],
    queryFn: () => apiRequest<MailOrderTrendItem[]>(`/api/suppliers/trend?${filterQuery}`),
  });

  const suppliers = suppliersQuery.data ?? [];
  const active = suppliers.find((supplier) => supplier.id === selected);

  useEffect(() => {
    if (suppliersQuery.data && !suppliersQuery.data.some((supplier) => supplier.id === selected)) {
      setSelected(suppliersQuery.data[0]?.id ?? "");
    }
  }, [selected, suppliersQuery.data]);

  const transactionsQuery = useQuery({
    queryKey: ["mail-order", "transactions", selected, filterQuery],
    queryFn: () =>
      apiRequest<SupplierTransaction[]>(`/api/suppliers/${selected}/transactions?${filterQuery}`),
    enabled: Boolean(selected),
  });

  const transactionMutation = useMutation({
    mutationFn: ({
      kind,
      payload,
    }: {
      kind: TransactionDialogKind;
      payload: Record<string, string>;
    }) =>
      apiRequest<SupplierTransaction>(
        `/api/suppliers/${selected}/${kind === "payment" ? "payments" : "debts"}`,
        { method: "POST", body: JSON.stringify(payload) },
      ),
    onSuccess: (_transaction, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["mail-order"] });
      toast.success(variables.kind === "payment" ? "Ödeme kaydedildi" : "Borç kaydedildi");
      setDialogKind(null);
      setAmount("");
      setNote("");
      setTransactionAt("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openDialog = (kind: TransactionDialogKind) => {
    setAmount("");
    setNote("");
    setTransactionAt("");
    setDialogKind(kind);
  };

  const submitTransaction = (event: React.FormEvent) => {
    event.preventDefault();
    if (!dialogKind || !selected) return;

    try {
      const decimal = new Decimal(amount);
      if (!/^\d+(?:\.\d{1,2})?$/.test(amount.trim()) || !decimal.isPositive()) {
        toast.error("Tutar sıfırdan büyük ve en fazla iki ondalıklı olmalı");
        return;
      }
    } catch {
      toast.error("Geçerli bir tutar girin");
      return;
    }

    const payload: Record<string, string> = { amount: amount.trim() };
    if (note.trim()) payload.note = note.trim();
    if (transactionAt) payload.transactionAt = new Date(`${transactionAt}:00+03:00`).toISOString();
    transactionMutation.mutate({ kind: dialogKind, payload });
  };

  const summary = summaryQuery.data ?? emptySummary;
  const trend = trendQuery.data ?? [];
  const periodLabel = period === "day" ? "Günlük" : period === "month" ? "Aylık" : "Yıllık";
  const selectedPeriodLabel =
    period === "year"
      ? String(year)
      : new Intl.DateTimeFormat("tr-TR", {
          month: "long",
          year: "numeric",
          ...(period === "day" ? { day: "numeric" as const } : {}),
          timeZone: "UTC",
        }).format(new Date(Date.UTC(year, month - 1, period === "day" ? day : 1)));
  const dataError = summaryQuery.error ?? suppliersQuery.error ?? trendQuery.error;

  return (
    <AppLayout title="Mail Order">
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border/60 bg-card p-4">
        <label className="min-w-36 text-xs font-semibold text-muted-foreground">
          Dönem
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as MailOrderPeriod)}
            className={`${inputCls} mt-1`}
          >
            <option value="day">Günlük</option>
            <option value="month">Aylık</option>
            <option value="year">Yıllık</option>
          </select>
        </label>
        {period === "day" && (
          <label className="min-w-48 text-xs font-semibold text-muted-foreground">
            Gün
            <input
              type="date"
              value={`${year}-${pad(month)}-${pad(day)}`}
              onChange={(event) => {
                const [nextYear, nextMonth, nextDay] = event.target.value.split("-").map(Number);
                if (nextYear && nextMonth && nextDay) {
                  setYear(nextYear);
                  setMonth(nextMonth);
                  setDay(nextDay);
                }
              }}
              className={`${inputCls} mt-1`}
            />
          </label>
        )}
        {period === "month" && (
          <label className="min-w-48 text-xs font-semibold text-muted-foreground">
            Ay
            <input
              type="month"
              value={`${year}-${pad(month)}`}
              onChange={(event) => {
                const [nextYear, nextMonth] = event.target.value.split("-").map(Number);
                if (nextYear && nextMonth) {
                  setYear(nextYear);
                  setMonth(nextMonth);
                  setDay((current) => Math.min(current, daysInMonth(nextYear, nextMonth)));
                }
              }}
              className={`${inputCls} mt-1`}
            />
          </label>
        )}
        {period === "year" && (
          <label className="min-w-36 text-xs font-semibold text-muted-foreground">
            Yıl
            <input
              type="number"
              min={1}
              max={9999}
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className={`${inputCls} mt-1`}
            />
          </label>
        )}
        <div className="pb-2 text-xs text-muted-foreground">Saat dilimi: Europe/Istanbul</div>
      </div>

      {dataError && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {dataError instanceof Error ? dataError.message : "Mail Order verileri alınamadı"}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {(["TRY", "USD"] as const).map((currency) => (
          <div key={currency} className="card-elevated p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                {currency}
              </span>
              <h2 className="text-base font-bold">
                {currency === "TRY" ? "TL" : "USD"} Firmaları Özeti
              </h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                label="Mal Girişi"
                value={
                  summaryQuery.isLoading
                    ? "—"
                    : formatMoneyString(summary[currency].debtIncrease, currency)
                }
                icon={<TrendingUp className="h-5 w-5" />}
                tone="primary"
              />
              <StatCard
                label="Ödenen"
                value={
                  summaryQuery.isLoading
                    ? "—"
                    : formatMoneyString(summary[currency].payments, currency)
                }
                icon={<Wallet className="h-5 w-5" />}
                tone="success"
              />
              <StatCard
                label="Kalan Borç"
                value={
                  summaryQuery.isLoading
                    ? "—"
                    : formatMoneyString(summary[currency].remainingDebt, currency)
                }
                icon={<TrendingDown className="h-5 w-5" />}
                tone="destructive"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card-elevated p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-bold">Firmalar</h2>
            <button
              onClick={() => {
                setFirmName("");
                setFirmCurrency("TRY");
                setFirmDialogOpen(true);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> Yeni Firma Ekle
            </button>
          </div>
          <div className="space-y-2">
            {suppliersQuery.isLoading && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Firmalar yükleniyor…
              </div>
            )}
            {!suppliersQuery.isLoading && suppliers.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">Firma bulunamadı</div>
            )}
            {suppliers.map((supplier) => (
              <button
                key={supplier.id}
                onClick={() => setSelected(supplier.id)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  selected === supplier.id
                    ? "border-primary bg-primary/5"
                    : "border-border/60 hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="truncate text-sm font-semibold">
                    {supplier.name}
                    {!supplier.isActive && (
                      <span className="ml-2 text-xs text-muted-foreground">Pasif</span>
                    )}
                  </div>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold">
                    {supplier.currency}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Kalan borç</span>
                  <span
                    className={`font-bold ${new Decimal(supplier.currentBalance).isPositive() ? "text-destructive" : "text-success"}`}
                  >
                    {formatMoneyString(supplier.currentBalance, supplier.currency)}
                  </span>
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>
                    Dönem borç: {formatMoneyString(supplier.periodDebtIncrease, supplier.currency)}
                  </span>
                  <span>
                    Ödeme: {formatMoneyString(supplier.periodPayments, supplier.currency)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div id="mail-order-account" className="card-elevated scroll-mt-6 p-5 lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold">
              {active ? `${active.name} · Hesap Hareketleri` : "Hesap Hareketleri"}
            </h2>
            <div className="flex gap-2">
              <button
                disabled={!active || statusMutation.isPending}
                onClick={() => active && statusMutation.mutate(active)}
                className="h-9 rounded-lg border border-input px-3 text-xs font-bold disabled:opacity-40"
              >
                {statusMutation.isPending
                  ? "Kaydediliyor…"
                  : active?.isActive
                    ? "Pasife Al"
                    : "Aktife Al"}
              </button>
              <button
                disabled={!active?.isActive}
                onClick={() => openDialog("payment")}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-success px-3 text-xs font-bold text-success-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" /> Yeni Ödeme
              </button>
              <button
                disabled={!active?.isActive}
                onClick={() => openDialog("debt")}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-destructive px-3 text-xs font-bold text-destructive-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" /> Borç Ekle
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold">Tarih</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Tür</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Açıklama</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {transactionsQuery.data?.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className={`border-t border-border/60 ${transaction.voidedAt ? "opacity-55" : ""}`}
                  >
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {formatTransactionDate(transaction.transactionAt)}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge tone={transactionTone(transaction.type)}>
                        {transactionLabels[transaction.type]}
                      </StatusBadge>
                      {transaction.voidedAt && (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          Revize/iptal
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {transaction.note || "—"}
                      {transaction.sourceType === "VEHICLE_OPERATION" && (
                        <span className="ml-2 text-[10px] text-muted-foreground">Araç işlemi</span>
                      )}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-bold ${transaction.type === "PAYMENT" ? "text-success" : transaction.type === "DEBT_INCREASE" ? "text-destructive" : ""}`}
                    >
                      {transaction.type === "PAYMENT"
                        ? "-"
                        : transaction.type === "DEBT_INCREASE"
                          ? "+"
                          : ""}
                      {formatMoneyString(transaction.amount, transaction.currency)}
                      {transaction.sourceAmount &&
                        transaction.sourceCurrency === "TRY" &&
                        transaction.exchangeRate && (
                          <div className="mt-1 text-xs font-normal text-muted-foreground">
                            {formatMoneyString(transaction.sourceAmount, "TRY")} · Kur:{" "}
                            {transaction.exchangeRate} · {transaction.exchangeRateDate}
                            {transaction.exchangeRateIsStale ? " · Önbellek" : ""}
                          </div>
                        )}
                    </td>
                  </tr>
                ))}
                {transactionsQuery.isLoading && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      Hareketler yükleniyor…
                    </td>
                  </tr>
                )}
                {!transactionsQuery.isLoading &&
                  selected &&
                  transactionsQuery.data?.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-8 text-center text-sm text-muted-foreground"
                      >
                        Bu dönemde hareket yok
                      </td>
                    </tr>
                  )}
                {!selected && !suppliersQuery.isLoading && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      Firma seçilmedi
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-6 card-elevated p-5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{periodLabel} Mail Order Hareketi</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tüm firmalara yapılan ödemeler, tek bakışta.
            </p>
          </div>
          <span className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-semibold">
            {selectedPeriodLabel}
          </span>
        </div>
        {suppliersQuery.isLoading ? (
          <div role="status" className="grid h-60 place-items-center text-sm text-muted-foreground">
            Firma ödemeleri yükleniyor…
          </div>
        ) : suppliersQuery.isError ? (
          <p role="alert" className="py-8 text-center text-sm text-destructive">
            Firma ödemeleri alınamadı. Sayfayı yenileyerek tekrar deneyin.
          </p>
        ) : (
          <div className="grid items-start gap-4 xl:grid-cols-2">
            {(["TRY", "USD"] as const).map((currency) => (
              <SupplierPaymentChart
                key={currency}
                currency={currency}
                suppliers={suppliers}
                selected={selected}
                onSelect={(id) => {
                  setSelected(id);
                  document
                    .getElementById("mail-order-account")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              />
            ))}
          </div>
        )}
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Her para birimi kendi içinde karşılaştırılır. Pasif firmalar ve ödeme yapılmayan firmalar
          dahildir. Hesap hareketlerini açmak için firma satırına tıklayın.
        </p>
        <details className="mt-5 border-t border-border/60 pt-4">
          <summary className="cursor-pointer text-sm font-semibold">
            Zaman içindeki mal girişi ve ödemeler
          </summary>
          {trendQuery.isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Grafik yükleniyor…</p>
          ) : trendQuery.isError ? (
            <p className="py-8 text-center text-sm text-destructive">Hareket grafiği alınamadı.</p>
          ) : (
            <div className="mt-4 grid gap-6 xl:grid-cols-2">
              <TrendChart currency="TRY" data={trend} />
              <TrendChart currency="USD" data={trend} />
            </div>
          )}
        </details>
      </div>

      <Dialog open={firmDialogOpen} onOpenChange={setFirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Firma Ekle</DialogTitle>
            <DialogDescription>Firma adını ve hesabın para birimini girin.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (firmName.trim() && !createFirmMutation.isPending) createFirmMutation.mutate();
            }}
          >
            <label className="block text-sm font-semibold">
              Firma adı
              <input
                required
                autoFocus
                maxLength={150}
                value={firmName}
                onChange={(event) => setFirmName(event.target.value)}
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className="block text-sm font-semibold">
              Para birimi
              <select
                value={firmCurrency}
                onChange={(event) => setFirmCurrency(event.target.value as Currency)}
                className={`${inputCls} mt-1`}
              >
                <option value="TRY">TL</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <DialogFooter>
              <button
                type="button"
                onClick={() => setFirmDialogOpen(false)}
                className="h-10 rounded-lg border border-input px-4 text-sm font-semibold"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={!firmName.trim() || createFirmMutation.isPending}
                className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {createFirmMutation.isPending ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogKind !== null} onOpenChange={(open) => !open && setDialogKind(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogKind === "payment" ? "Yeni Ödeme" : "Borç Ekle"}</DialogTitle>
            <DialogDescription>
              {active
                ? `${active.name} hesabına ${active.currency} hareketi kaydedilecek.`
                : "Firma seçin."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitTransaction} className="space-y-4">
            <label className="block text-sm font-semibold">
              Tutar ({active?.currency ?? ""})
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                autoFocus
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className="block text-sm font-semibold">
              Açıklama
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={2000}
                rows={3}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <label className="block text-sm font-semibold">
              İşlem tarihi (opsiyonel)
              <input
                type="datetime-local"
                value={transactionAt}
                onChange={(event) => setTransactionAt(event.target.value)}
                className={`${inputCls} mt-1`}
              />
            </label>
            <DialogFooter>
              <button
                type="button"
                onClick={() => setDialogKind(null)}
                className="h-10 rounded-lg border border-input px-4 text-sm font-semibold"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={transactionMutation.isPending}
                className={`h-10 rounded-lg px-4 text-sm font-bold text-white disabled:opacity-50 ${dialogKind === "payment" ? "bg-success" : "bg-destructive"}`}
              >
                {transactionMutation.isPending ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
