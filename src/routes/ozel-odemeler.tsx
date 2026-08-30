import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowDownUp, Landmark, Pencil, Plus, Save, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { formatTRY } from "@/components/shared/StatusBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api";
import type {
  MaintenanceItem,
  SpecialPaymentCategory,
  SpecialPaymentItem,
  SpecialPaymentList,
  SpecialPaymentLookup,
  SpecialPaymentPeriod,
  SpecialPaymentSummary,
} from "@/types/special-payments";

export const Route = createFileRoute("/ozel-odemeler")({
  head: () => ({
    meta: [
      { title: "Özel Ödemeler · Çakır Oto" },
      { name: "description", content: "Personel, fatura, kredi, SGK ve gider takibi." },
      { property: "og:title", content: "Özel Ödemeler" },
      { property: "og:description", content: "Dönemsel ödeme kayıt ve toplamları." },
    ],
  }),
  component: OzelOdemeler,
});

const tabs: Array<{ value: SpecialPaymentCategory; label: string }> = [
  { value: "personnel", label: "Personel" },
  { value: "expense", label: "Giderler" },
  { value: "invoice", label: "Faturalar" },
  { value: "loan", label: "Krediler" },
  { value: "sgk", label: "SGK & Vergiler" },
  { value: "meal", label: "Yemek" },
];

const periodLabels: Record<SpecialPaymentPeriod, string> = {
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

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "İstek tamamlanamadı";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("tr-TR").format(new Date(`${value}T00:00:00.000Z`));

const queryString = (period: SpecialPaymentPeriod, date: string) =>
  new URLSearchParams({ period, date }).toString();

function OzelOdemeler() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<SpecialPaymentCategory>("personnel");
  const [period, setPeriod] = useState<SpecialPaymentPeriod>("month");
  const [date, setDate] = useState(todayInIstanbul);
  const [personnelDateSort, setPersonnelDateSort] = useState<"asc" | "desc">("desc");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [personnelOpen, setPersonnelOpen] = useState(false);
  const [loanOpen, setLoanOpen] = useState(false);
  const periodQuery = queryString(period, date);

  const summaryQuery = useQuery({
    queryKey: ["special-payments", "summary", period, date],
    queryFn: () =>
      apiRequest<SpecialPaymentSummary>(`/api/special-payments/summary?${periodQuery}`),
  });
  const paymentsQuery = useQuery({
    queryKey: ["special-payments", "items", tab, period, date],
    queryFn: () =>
      apiRequest<SpecialPaymentList>(`/api/special-payments?category=${tab}&${periodQuery}`),
  });
  const personnelQuery = useQuery({
    queryKey: ["personnel-maintenance"],
    queryFn: () => apiRequest<MaintenanceItem[]>("/api/personnel-maintenance"),
  });
  const loanQuery = useQuery({
    queryKey: ["loan-account-maintenance"],
    queryFn: () => apiRequest<MaintenanceItem[]>("/api/loan-account-maintenance"),
  });
  const invoiceQuery = useQuery({
    queryKey: ["special-payments", "invoice-types"],
    queryFn: () => apiRequest<SpecialPaymentLookup[]>("/api/special-payments/invoice-types"),
  });

  const invalidatePayments = () =>
    queryClient.invalidateQueries({ queryKey: ["special-payments"] });

  const deleteMutation = useMutation({
    mutationFn: (item: SpecialPaymentItem) =>
      apiRequest<{ id: string }>(`/api/special-payments/${item.category}/${item.id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void invalidatePayments();
      toast.success("Ödeme kaydı silindi");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const selectedLabel = tabs.find((item) => item.value === tab)?.label ?? "";
  const items = paymentsQuery.data?.items;
  const displayedItems = useMemo(() => {
    const currentItems = items ?? [];
    if (tab !== "personnel") return currentItems;

    return [...currentItems].sort((first, second) => {
      const comparison = first.paymentDate.localeCompare(second.paymentDate);
      return personnelDateSort === "asc" ? comparison : -comparison;
    });
  }, [items, personnelDateSort, tab]);
  const activePersonnel = useMemo(
    () => (personnelQuery.data ?? []).filter((item) => item.isActive),
    [personnelQuery.data],
  );
  const personnelSections = useMemo(() => {
    if (tab !== "personnel") return [];

    const grouped = new Map<string, SpecialPaymentItem[]>(
      activePersonnel.map((person) => [person.name, []]),
    );
    displayedItems.forEach((item) => {
      const personItems = grouped.get(item.title) ?? [];
      personItems.push(item);
      grouped.set(item.title, personItems);
    });

    return [...grouped.entries()]
      .map(([personName, personItems]) => ({
        personName,
        items: personItems,
        total: personItems.reduce((sum, item) => sum + Number(item.amount), 0),
      }))
      .sort((first, second) => first.personName.localeCompare(second.personName, "tr"));
  }, [activePersonnel, displayedItems, tab]);
  const activeLoans = (loanQuery.data ?? []).filter((item) => item.isActive);

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

  return (
    <AppLayout title="Özel Ödemeler">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Dönem</div>
            <div className="inline-flex rounded-lg border border-input bg-card p-1">
              {(["day", "month", "year"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPeriod(value)}
                  className={`h-9 rounded-md px-4 text-sm font-semibold transition-colors ${
                    period === value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {periodLabels[value]}
                </button>
              ))}
            </div>
          </div>
          <div className="w-44">
            <div className="mb-1 text-xs font-medium text-muted-foreground">Tarih</div>
            {dateInput}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setPersonnelOpen(true)}>
            <Users /> Personel Yönetimi
          </Button>
          <Button variant="outline" onClick={() => setLoanOpen(true)}>
            <Landmark /> Kredi Hesapları
          </Button>
        </div>
      </div>

      {summaryQuery.isError && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Toplamlar yüklenemedi: {errorMessage(summaryQuery.error)}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tabs.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setTab(item.value)}
            className={`card-elevated p-4 text-left transition-all ${
              tab === item.value ? "ring-2 ring-primary" : ""
            }`}
          >
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {item.label}
            </div>
            <div className="mt-1.5 text-lg font-bold">
              {summaryQuery.isPending
                ? "—"
                : formatTRY(Number(summaryQuery.data?.totals[item.value] ?? 0))}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-6 card-elevated p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">{selectedLabel}</h2>
            <div className="mt-1 text-sm text-muted-foreground">
              Toplam:{" "}
              <span className="font-bold text-foreground">
                {summaryQuery.isPending
                  ? "—"
                  : formatTRY(Number(summaryQuery.data?.totals[tab] ?? 0))}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {tab === "personnel" && (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setPersonnelDateSort((current) => (current === "asc" ? "desc" : "asc"))
                }
              >
                <ArrowDownUp />
                Tarih: {personnelDateSort === "desc" ? "Yeni → Eski" : "Eski → Yeni"}
              </Button>
            )}
            <Button onClick={() => setPaymentOpen(true)}>
              <Plus /> Ödeme Ekle
            </Button>
          </div>
        </div>

        {paymentsQuery.isPending && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            Kayıtlar yükleniyor…
          </div>
        )}
        {paymentsQuery.isError && (
          <div className="px-4 py-10 text-center text-sm text-destructive">
            Kayıtlar yüklenemedi: {errorMessage(paymentsQuery.error)}
          </div>
        )}
        {!paymentsQuery.isPending && !paymentsQuery.isError && tab === "personnel" && (
          <div className="space-y-4">
            {personnelSections.map((section) => (
              <section key={section.personName} className="overflow-hidden rounded-xl border">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 px-4 py-3">
                  <div>
                    <h3 className="font-bold">{section.personName}</h3>
                    <div className="text-xs text-muted-foreground">
                      {section.items.length} ödeme kaydı
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Personel toplamı</div>
                    <div className="font-bold text-destructive">-{formatTRY(section.total)}</div>
                  </div>
                </div>
                {section.items.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Seçili dönemde ödeme kaydı yok
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2.5 text-left font-semibold">Not / Açıklama</th>
                          <th
                            className="px-4 py-2.5 text-left font-semibold"
                            aria-sort={personnelDateSort === "asc" ? "ascending" : "descending"}
                          >
                            Tarih
                          </th>
                          <th className="px-4 py-2.5 text-right font-semibold">Tutar</th>
                          <th className="px-4 py-2.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {section.items.map((item) => (
                          <tr key={item.id} className="border-t border-border/60">
                            <td className="max-w-sm px-4 py-3 text-muted-foreground">
                              {item.note || "—"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {formatDate(item.paymentDate)}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-destructive">
                              -{formatTRY(Number(item.amount))}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <PaymentDeleteButton
                                item={item}
                                isPending={deleteMutation.isPending}
                                onDelete={() => deleteMutation.mutate(item)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ))}
            {personnelSections.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                Gösterilecek personel bulunamadı
              </div>
            )}
          </div>
        )}
        {!paymentsQuery.isPending && !paymentsQuery.isError && tab !== "personnel" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Başlık</th>
                  <th className="px-4 py-3 text-left font-semibold">Not / Açıklama</th>
                  <th className="px-4 py-3 text-left font-semibold">Tarih</th>
                  <th className="px-4 py-3 text-right font-semibold">Tutar</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {displayedItems.map((item) => (
                  <tr key={item.id} className="border-t border-border/60">
                    <td className="px-4 py-3 font-semibold">{item.title}</td>
                    <td className="max-w-sm px-4 py-3 text-muted-foreground">{item.note || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(item.paymentDate)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-destructive">
                      -{formatTRY(Number(item.amount))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PaymentDeleteButton
                        item={item}
                        isPending={deleteMutation.isPending}
                        onDelete={() => deleteMutation.mutate(item)}
                      />
                    </td>
                  </tr>
                ))}
                {displayedItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      Seçili dönemde kayıt yok
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {paymentOpen && (
        <PaymentDialog
          category={tab}
          categoryLabel={selectedLabel}
          defaultDate={date}
          personnel={activePersonnel}
          loanAccounts={activeLoans}
          invoiceTypes={invoiceQuery.data ?? []}
          lookupsLoading={
            (tab === "personnel" && personnelQuery.isPending) ||
            (tab === "loan" && loanQuery.isPending) ||
            (tab === "invoice" && invoiceQuery.isPending)
          }
          lookupsError={
            tab === "personnel"
              ? personnelQuery.error
              : tab === "loan"
                ? loanQuery.error
                : tab === "invoice"
                  ? invoiceQuery.error
                  : null
          }
          onClose={() => setPaymentOpen(false)}
          onSaved={() => void invalidatePayments()}
        />
      )}
      <MaintenanceDialog
        open={personnelOpen}
        onOpenChange={setPersonnelOpen}
        title="Personel Yönetimi"
        itemLabel="Personel"
        endpoint="/api/personnel-maintenance"
        queryKey="personnel-maintenance"
        items={personnelQuery.data ?? []}
        isLoading={personnelQuery.isPending}
        error={personnelQuery.error}
      />
      <MaintenanceDialog
        open={loanOpen}
        onOpenChange={setLoanOpen}
        title="Kredi Hesapları"
        itemLabel="Kredi hesabı"
        endpoint="/api/loan-account-maintenance"
        queryKey="loan-account-maintenance"
        items={loanQuery.data ?? []}
        isLoading={loanQuery.isPending}
        error={loanQuery.error}
      />
    </AppLayout>
  );
}

function PaymentDeleteButton({
  item,
  isPending,
  onDelete,
}: {
  item: SpecialPaymentItem;
  isPending: boolean;
  onDelete: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          aria-label="Ödeme kaydını sil"
          className="grid h-8 w-8 place-items-center rounded-lg border border-input text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ödeme kaydı silinsin mi?</AlertDialogTitle>
          <AlertDialogDescription>
            Yalnızca “{item.title}” ödeme kaydı silinecek. Bağlı master kayıt korunacak.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Vazgeç</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isPending}
            onClick={onDelete}
          >
            Sil
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type PaymentDialogProps = {
  category: SpecialPaymentCategory;
  categoryLabel: string;
  defaultDate: string;
  personnel: MaintenanceItem[];
  loanAccounts: MaintenanceItem[];
  invoiceTypes: SpecialPaymentLookup[];
  lookupsLoading: boolean;
  lookupsError: unknown;
  onClose: () => void;
  onSaved: () => void;
};

function PaymentDialog({
  category,
  categoryLabel,
  defaultDate,
  personnel,
  loanAccounts,
  invoiceTypes,
  lookupsLoading,
  lookupsError,
  onClose,
  onSaved,
}: PaymentDialogProps) {
  const [paymentDate, setPaymentDate] = useState(defaultDate);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const options = useMemo(() => {
    if (category === "personnel") return personnel;
    if (category === "loan") return loanAccounts;
    if (category === "invoice") return invoiceTypes;
    return [];
  }, [category, invoiceTypes, loanAccounts, personnel]);
  const needsMaster = category === "personnel" || category === "loan" || category === "invoice";
  const [masterId, setMasterId] = useState(options[0]?.id ?? "");

  useEffect(() => {
    if (!masterId && options[0]) setMasterId(options[0].id);
  }, [masterId, options]);

  const mutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        paymentDate,
        amount,
        note: note.trim() || null,
      };
      if (category === "personnel") body.personnelId = masterId;
      if (category === "loan") body.loanAccountId = masterId;
      if (category === "invoice") body.invoiceTypeId = masterId;
      return apiRequest<SpecialPaymentItem>(`/api/special-payments/${category}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      onSaved();
      toast.success("Ödeme kaydedildi");
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{categoryLabel} Ödemesi Ekle</DialogTitle>
          <DialogDescription>Tutar, ödeme tarihi ve varsa açıklamayı kaydedin.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {needsMaster && (
            <label className="block space-y-1.5 text-sm font-medium">
              <span>
                {category === "personnel"
                  ? "Personel"
                  : category === "loan"
                    ? "Kredi hesabı"
                    : "Fatura türü"}
              </span>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={masterId}
                onChange={(event) => setMasterId(event.target.value)}
                disabled={lookupsLoading || Boolean(lookupsError) || options.length === 0}
                required
              >
                <option value="">{lookupsLoading ? "Yükleniyor…" : "Aktif kayıt seçin"}</option>
                {options.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              {lookupsError ? (
                <span className="block text-xs text-destructive">
                  Master kayıtlar yüklenemedi: {errorMessage(lookupsError)}
                </span>
              ) : !lookupsLoading && options.length === 0 ? (
                <span className="block text-xs text-destructive">
                  {category === "invoice"
                    ? "Aktif fatura türü bulunamadı."
                    : "Aktif master kayıt bulunamadı; önce bakım ekranından kayıt ekleyin."}
                </span>
              ) : null}
            </label>
          )}
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Tutar</span>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Ödeme tarihi</span>
            <Input
              type="date"
              value={paymentDate}
              onChange={(event) => setPaymentDate(event.target.value)}
              required
            />
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Not / Açıklama</span>
            <Textarea
              maxLength={2000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Opsiyonel"
            />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Vazgeç
            </Button>
            <Button
              type="submit"
              disabled={
                mutation.isPending ||
                (needsMaster && (Boolean(lookupsError) || !masterId || options.length === 0))
              }
            >
              {mutation.isPending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type MaintenanceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  itemLabel: string;
  endpoint: string;
  queryKey: string;
  items: MaintenanceItem[];
  isLoading: boolean;
  error: unknown;
};

function MaintenanceDialog({
  open,
  onOpenChange,
  title,
  itemLabel,
  endpoint,
  queryKey,
  items,
  isLoading,
  error,
}: MaintenanceDialogProps) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [queryKey] });
  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest<MaintenanceItem>(endpoint, {
        method: "POST",
        body: JSON.stringify({ name: newName }),
      }),
    onSuccess: () => {
      setNewName("");
      void invalidate();
      toast.success(`${itemLabel} eklendi`);
    },
    onError: (mutationError) => toast.error(errorMessage(mutationError)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiRequest<MaintenanceItem>(`${endpoint}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setEditingId(null);
      setEditingName("");
      void invalidate();
      toast.success(`${itemLabel} güncellendi`);
    },
    onError: (mutationError) => toast.error(errorMessage(mutationError)),
  });

  const submitNew = (event: FormEvent) => {
    event.preventDefault();
    if (newName.trim()) createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Kayıt ekleyin, adını düzenleyin veya yeni ödemelerde kullanılmasını kapatın.
          </DialogDescription>
        </DialogHeader>
        <form className="flex gap-2" onSubmit={submitNew}>
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder={`${itemLabel} adı`}
            maxLength={150}
          />
          <Button type="submit" disabled={!newName.trim() || createMutation.isPending}>
            <Plus /> Ekle
          </Button>
        </form>
        <div className="divide-y rounded-lg border">
          {isLoading && (
            <div className="p-6 text-center text-sm text-muted-foreground">Yükleniyor…</div>
          )}
          {error && (
            <div className="p-6 text-center text-sm text-destructive">
              Kayıtlar yüklenemedi: {errorMessage(error)}
            </div>
          )}
          {!isLoading && !error && items.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">Henüz kayıt yok</div>
          )}
          {items.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center gap-2 p-3">
              {editingId === item.id ? (
                <Input
                  className="min-w-48 flex-1"
                  value={editingName}
                  onChange={(event) => setEditingName(event.target.value)}
                  maxLength={150}
                  autoFocus
                />
              ) : (
                <div className="min-w-48 flex-1">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.isActive ? "Aktif" : "Pasif"}
                  </div>
                </div>
              )}
              {editingId === item.id ? (
                <>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    aria-label="Adı kaydet"
                    disabled={!editingName.trim() || updateMutation.isPending}
                    onClick={() =>
                      updateMutation.mutate({ id: item.id, body: { name: editingName } })
                    }
                  >
                    <Save />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Düzenlemeyi iptal et"
                    onClick={() => setEditingId(null)}
                  >
                    <X />
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label="Adı düzenle"
                  onClick={() => {
                    setEditingId(item.id);
                    setEditingName(item.name);
                  }}
                >
                  <Pencil />
                </Button>
              )}
              <Switch
                checked={item.isActive}
                disabled={updateMutation.isPending}
                aria-label={`${item.name} aktiflik durumu`}
                onCheckedChange={(isActive) =>
                  updateMutation.mutate({ id: item.id, body: { isActive } })
                }
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
