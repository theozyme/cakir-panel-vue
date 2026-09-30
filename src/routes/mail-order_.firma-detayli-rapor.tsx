import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Decimal from "decimal.js";
import { ArrowLeft, Building2, FileSpreadsheet, Plus, RotateCcw, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { exportSupplierDetailWorkbook } from "@/lib/supplier-detail-excel";
import type {
  Currency,
  MailOrderPeriod,
  MailOrderSupplier,
  SupplierTransaction,
} from "@/types/business";

export const Route = createFileRoute("/mail-order_/firma-detayli-rapor")({
  head: () => ({
    meta: [
      { title: "Firma Detaylı Rapor · Çakır Oto" },
      { name: "description", content: "Firma bazında mail order mal girişi ve ödeme dökümü." },
    ],
  }),
  component: SupplierDetailReport,
});

type TransactionKind = "debt" | "payment";

const inputCls =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const months = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

const currentIstanbulYearMonth = () => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;
  return {
    year: parts.year ?? new Date().getFullYear(),
    month: parts.month ?? 1,
    day: parts.day ?? 1,
    hour: parts.hour ?? 12,
    minute: parts.minute ?? 0,
  };
};

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const sourceLabel = (source: SupplierTransaction["sourceType"]) =>
  source === "MANUAL" ? "Manuel" : source === "VEHICLE_OPERATION" ? "Araç işlemi" : "Aktarım";

function SummaryCard({
  label,
  description,
  value,
  currency,
  tone = "default",
}: {
  label: string;
  description: string;
  value: string;
  currency: Currency;
  tone?: "default" | "danger" | "success";
}) {
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "success"
        ? "text-success"
        : "text-foreground";
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className={`mt-2 text-xl font-bold tabular-nums ${toneClass}`}>
        {formatMoneyString(value, currency)}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function TransactionTable({
  title,
  rows,
  currency,
  undoingId,
  onUndo,
}: {
  title: string;
  rows: SupplierTransaction[];
  currency: Currency;
  undoingId: string | null;
  onUndo: (transaction: SupplierTransaction) => void;
}) {
  return (
    <section className="card-elevated min-w-0 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
          {rows.length} kayıt
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-border/60">
        <table className="w-full table-fixed text-xs xl:text-sm">
          <colgroup>
            <col className="w-[19%]" />
            <col className="w-[26%]" />
            <col className="w-[19%]" />
            <col className="w-[20%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead className="bg-muted/70 text-left text-xs text-muted-foreground">
            <tr>
              <th className="break-words px-2 py-2.5 font-semibold">Tarih</th>
              <th className="break-words px-2 py-2.5 font-semibold">Not</th>
              <th className="break-words px-2 py-2.5 font-semibold">Kaynak</th>
              <th className="break-words px-2 py-2.5 text-right font-semibold">Tutar</th>
              <th className="break-words px-2 py-2.5 text-right font-semibold">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((transaction) => (
              <tr key={transaction.id} className={transaction.voidedAt ? "opacity-55" : ""}>
                <td className="break-words px-2 py-3 align-top">
                  {formatDate(transaction.transactionAt)}
                </td>
                <td className="break-words px-2 py-3 align-top">{transaction.note || "—"}</td>
                <td className="break-words px-2 py-3 align-top">
                  {sourceLabel(transaction.sourceType)}
                  {transaction.voidedAt && (
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold">
                      Geri alındı
                    </span>
                  )}
                </td>
                <td className="break-all px-2 py-3 text-right align-top font-bold tabular-nums">
                  {formatMoneyString(transaction.amount, currency)}
                </td>
                <td className="break-words px-2 py-3 text-right align-top">
                  {!transaction.voidedAt && transaction.sourceType === "MANUAL" ? (
                    <button
                      type="button"
                      onClick={() => onUndo(transaction)}
                      disabled={undoingId === transaction.id}
                      className="inline-flex min-h-8 max-w-full flex-wrap items-center justify-center gap-1 rounded-md border border-destructive/30 px-1.5 py-1 text-xs font-bold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Geri Al
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                  Seçili dönemde kayıt yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SupplierDetailReport() {
  const initialDate = useMemo(currentIstanbulYearMonth, []);
  const queryClient = useQueryClient();
  const [year, setYear] = useState(initialDate.year);
  const [month, setMonth] = useState<number | "all">("all");
  const [selectedId, setSelectedId] = useState("");
  const [dialogKind, setDialogKind] = useState<TransactionKind | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [transactionAt, setTransactionAt] = useState("");
  const [undoTarget, setUndoTarget] = useState<SupplierTransaction | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const period: MailOrderPeriod = month === "all" ? "year" : "month";
  const filterQuery = useMemo(() => {
    const params = new URLSearchParams({ period, year: String(year) });
    if (month !== "all") params.set("month", String(month));
    return params.toString();
  }, [month, period, year]);

  const suppliersQuery = useQuery({
    queryKey: ["mail-order", "detail-suppliers", filterQuery],
    queryFn: () =>
      apiRequest<MailOrderSupplier[]>(`/api/suppliers?includeInactive=true&${filterQuery}`),
  });
  const suppliers = suppliersQuery.data ?? [];
  const selectedSupplier = suppliers.find((supplier) => supplier.id === selectedId);

  useEffect(() => {
    if (
      suppliersQuery.data &&
      !suppliersQuery.data.some((supplier) => supplier.id === selectedId)
    ) {
      setSelectedId(suppliersQuery.data[0]?.id ?? "");
    }
  }, [selectedId, suppliersQuery.data]);

  const transactionsQuery = useQuery({
    queryKey: ["mail-order", "detail-transactions", selectedId, filterQuery],
    queryFn: () =>
      apiRequest<SupplierTransaction[]>(`/api/suppliers/${selectedId}/transactions?${filterQuery}`),
    enabled: Boolean(selectedId),
  });
  const transactions = useMemo(
    () =>
      [...(transactionsQuery.data ?? [])].sort(
        (first, second) =>
          new Date(second.transactionAt).getTime() - new Date(first.transactionAt).getTime(),
      ),
    [transactionsQuery.data],
  );
  const activeTransactions = transactions.filter((transaction) => !transaction.voidedAt);
  const debtRows = transactions.filter((transaction) => transaction.type === "DEBT_INCREASE");
  const paymentRows = transactions.filter((transaction) => transaction.type === "PAYMENT");
  const debtTotal = activeTransactions
    .filter((transaction) => transaction.type === "DEBT_INCREASE")
    .reduce((sum, transaction) => sum.plus(transaction.amount), new Decimal(0));
  const paymentTotal = activeTransactions
    .filter((transaction) => transaction.type === "PAYMENT")
    .reduce((sum, transaction) => sum.plus(transaction.amount), new Decimal(0));
  const periodLabel = month === "all" ? `${year} · Tüm Yıl` : `${months[month - 1]} ${year}`;

  const openTransactionDialog = (kind: TransactionKind) => {
    const isCurrentPeriod =
      year === initialDate.year && (month === "all" || month === initialDate.month);
    const defaultMonth = month === "all" ? (isCurrentPeriod ? initialDate.month : 1) : month;
    const defaultDay = isCurrentPeriod ? initialDate.day : 1;
    const defaultHour = isCurrentPeriod ? initialDate.hour : 12;
    const defaultMinute = isCurrentPeriod ? initialDate.minute : 0;
    setAmount("");
    setNote("");
    setTransactionAt(
      `${pad(year, 4)}-${pad(defaultMonth)}-${pad(defaultDay)}T${pad(defaultHour)}:${pad(defaultMinute)}`,
    );
    setDialogKind(kind);
  };

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["mail-order"] }),
      queryClient.invalidateQueries({ queryKey: ["suppliers"] }),
    ]);

  const createMutation = useMutation({
    mutationFn: ({ kind, payload }: { kind: TransactionKind; payload: Record<string, string> }) =>
      apiRequest<SupplierTransaction>(
        `/api/suppliers/${selectedId}/${kind === "payment" ? "payments" : "debts"}`,
        { method: "POST", body: JSON.stringify(payload) },
      ),
    onSuccess: async (_result, variables) => {
      await refresh();
      toast.success(variables.kind === "payment" ? "Ödeme kaydedildi" : "Borç kaydedildi");
      setDialogKind(null);
      setAmount("");
      setNote("");
      setTransactionAt("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const undoMutation = useMutation({
    mutationFn: (transaction: SupplierTransaction) =>
      apiRequest(`/api/suppliers/${selectedId}/transactions/${transaction.id}/undo`, {
        method: "PATCH",
      }),
    onSuccess: async () => {
      await refresh();
      toast.success("İşlem geri alındı ve bakiye güncellendi");
      setUndoTarget(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submitTransaction = (event: React.FormEvent) => {
    event.preventDefault();
    if (!dialogKind || !selectedSupplier) return;
    let decimal: Decimal;
    try {
      decimal = new Decimal(amount);
    } catch {
      toast.error("Geçerli bir tutar girin");
      return;
    }
    if (!/^\d+(?:\.\d{1,2})?$/.test(amount.trim()) || !decimal.isPositive()) {
      toast.error("Tutar sıfırdan büyük ve en fazla iki ondalıklı olmalı");
      return;
    }
    if (!note.trim()) {
      toast.error("İşlemin nedenini not alanına yazın");
      return;
    }

    const payload: Record<string, string> = { amount: amount.trim(), note: note.trim() };
    if (transactionAt) payload.transactionAt = new Date(`${transactionAt}:00+03:00`).toISOString();
    createMutation.mutate({ kind: dialogKind, payload });
  };

  const exportCurrentView = async () => {
    if (!selectedSupplier) return;
    setIsExporting(true);
    try {
      await exportSupplierDetailWorkbook({
        supplier: selectedSupplier,
        periodLabel,
        debtTotal: debtTotal.toFixed(2),
        paymentTotal: paymentTotal.toFixed(2),
        transactions,
      });
      toast.success("Firma raporu Excel olarak indirildi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Excel raporu oluşturulamadı");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AppLayout title="Firma Detaylı Rapor">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/mail-order"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-input px-3 text-sm font-semibold hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" /> Mail Order'a Dön
        </Link>
        <button
          type="button"
          onClick={() => void exportCurrentView()}
          disabled={!selectedSupplier || isExporting}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-success px-4 text-sm font-bold text-success-foreground hover:opacity-90 disabled:opacity-50"
        >
          <FileSpreadsheet className="h-4 w-4" />
          {isExporting ? "Excel hazırlanıyor…" : "Ekranı Excel'e Aktar"}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border/60 bg-card p-4">
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
        <label className="min-w-48 text-xs font-semibold text-muted-foreground">
          Ay
          <select
            value={month}
            onChange={(event) =>
              setMonth(event.target.value === "all" ? "all" : Number(event.target.value))
            }
            className={`${inputCls} mt-1`}
          >
            <option value="all">Tüm Yıl</option>
            {months.map((label, index) => (
              <option key={label} value={index + 1}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <span className="pb-2 text-xs text-muted-foreground">Dönem: {periodLabel}</span>
      </div>

      <section className="card-elevated mb-4 p-3">
        <div className="mb-3 flex items-center gap-2 px-2 pt-1">
          <Building2 className="h-4 w-4 text-primary" />
          <h2 className="font-bold">Tüm Firmalar</h2>
          <span className="ml-auto text-xs text-muted-foreground">{suppliers.length}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {suppliers.map((supplier) => (
            <button
              key={supplier.id}
              type="button"
              onClick={() => setSelectedId(supplier.id)}
              className={`min-w-40 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                supplier.id === selectedId
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/70 hover:bg-muted"
              }`}
            >
              <span className="block font-semibold">{supplier.name}</span>
              <span
                className={`mt-0.5 block text-xs ${
                  supplier.id === selectedId
                    ? "text-primary-foreground/75"
                    : "text-muted-foreground"
                }`}
              >
                {supplier.currency} · {supplier.isActive ? "Aktif" : "Pasif"}
              </span>
            </button>
          ))}
          {!suppliersQuery.isLoading && suppliers.length === 0 && (
            <p className="w-full px-2 py-8 text-center text-sm text-muted-foreground">
              Firma bulunamadı.
            </p>
          )}
        </div>
      </section>

      <main className="min-w-0 space-y-4">
        {selectedSupplier ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/60 bg-card p-4">
              <div>
                <h1 className="text-xl font-bold">{selectedSupplier.name}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedSupplier.currency} hesabı · {periodLabel}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openTransactionDialog("debt")}
                  disabled={!selectedSupplier.isActive}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-destructive px-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" /> Borç Girişi
                </button>
                <button
                  type="button"
                  onClick={() => openTransactionDialog("payment")}
                  disabled={!selectedSupplier.isActive}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-success px-3 text-sm font-bold text-success-foreground disabled:opacity-50"
                >
                  <WalletCards className="h-4 w-4" /> Ödeme Ekle
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <SummaryCard
                label="Seçili Dönem Mal Girişi"
                description="Seçilen yıl veya ay içinde firmaya eklenen toplam borç."
                value={debtTotal.toFixed(2)}
                currency={selectedSupplier.currency}
                tone="danger"
              />
              <SummaryCard
                label="Seçili Dönem Ödemeleri"
                description="Seçilen yıl veya ay içinde firmaya yapılan toplam ödeme."
                value={paymentTotal.toFixed(2)}
                currency={selectedSupplier.currency}
                tone="success"
              />
              <SummaryCard
                label="Güncel Borç Bakiyesi"
                description="Firmanın seçili dönemden bağımsız, bugünkü toplam borç bakiyesi."
                value={selectedSupplier.currentBalance}
                currency={selectedSupplier.currency}
              />
            </div>

            {transactionsQuery.isError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {transactionsQuery.error instanceof Error
                  ? transactionsQuery.error.message
                  : "Firma hareketleri alınamadı"}
              </div>
            )}
            {transactionsQuery.isLoading ? (
              <div className="card-elevated grid h-48 place-items-center text-sm text-muted-foreground">
                Firma hareketleri yükleniyor…
              </div>
            ) : (
              <div className="grid items-start gap-4 lg:grid-cols-2">
                <TransactionTable
                  title="Mal Girişleri"
                  rows={debtRows}
                  currency={selectedSupplier.currency}
                  undoingId={undoMutation.isPending ? (undoTarget?.id ?? null) : null}
                  onUndo={setUndoTarget}
                />
                <TransactionTable
                  title="Ödemeler"
                  rows={paymentRows}
                  currency={selectedSupplier.currency}
                  undoingId={undoMutation.isPending ? (undoTarget?.id ?? null) : null}
                  onUndo={setUndoTarget}
                />
              </div>
            )}
          </>
        ) : (
          <div className="card-elevated grid h-64 place-items-center text-sm text-muted-foreground">
            Görüntülemek için bir firma seçin.
          </div>
        )}
      </main>

      <Dialog open={dialogKind !== null} onOpenChange={(open) => !open && setDialogKind(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogKind === "payment" ? "Ödeme Ekle" : "Borç Girişi"}</DialogTitle>
            <DialogDescription>
              {selectedSupplier?.name} hesabına {selectedSupplier?.currency} hareketi kaydedilecek.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitTransaction} className="space-y-4">
            <label className="block text-sm font-semibold">
              Tutar ({selectedSupplier?.currency})
              <input
                autoFocus
                required
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className="block text-sm font-semibold">
              İşlem nedeni / not
              <textarea
                required
                maxLength={2000}
                rows={4}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Bu işlemin neden yapıldığını yazın"
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <label className="block text-sm font-semibold">
              İşlem tarihi
              <input
                type="datetime-local"
                required
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
                disabled={createMutation.isPending}
                className={`h-10 rounded-lg px-4 text-sm font-bold text-white disabled:opacity-50 ${
                  dialogKind === "payment" ? "bg-success" : "bg-destructive"
                }`}
              >
                {createMutation.isPending ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={undoTarget !== null} onOpenChange={(open) => !open && setUndoTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>İşlemi geri al</AlertDialogTitle>
            <AlertDialogDescription>
              {undoTarget
                ? `${formatMoneyString(undoTarget.amount, undoTarget.currency)} tutarındaki işlem geri alınacak. Firma bakiyesi ve sonraki hareketlerin bakiyeleri yeniden hesaplanacak.`
                : "Bu işlem geri alınacak."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={undoMutation.isPending}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              disabled={!undoTarget || undoMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (undoTarget) undoMutation.mutate(undoTarget);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {undoMutation.isPending ? "Geri alınıyor…" : "Evet, Geri Al"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
