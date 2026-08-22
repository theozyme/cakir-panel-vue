import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, FileJson, Loader2, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";

export const Route = createFileRoute("/admin/migration")({
  head: () => ({
    meta: [
      { title: "Veri Migration Yönetimi · Çakır Oto" },
      { name: "description", content: "Gizli veri migration yönetim ekranı." },
    ],
  }),
  component: AdminMigrationPage,
});

type ScreenStockRow = {
  kod: string;
  marka: string;
  hafiza: string;
  ram: string;
  cekirdek: string;
  boyut: string;
  adet: number;
};

type MultimediaStockRow = {
  id: string;
  kod: string;
  forx?: string | null;
  model?: string | null;
  adet: number;
  raf?: string | null;
  marka?: string | null;
};

type SoundStockRow = {
  name: string;
  price: number;
  quantity: number;
};

type SoundOfferRow = {
  user?: string | null;
  items: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  manual_total?: number | null;
  auto_total: number;
  usd_kur: number;
  sale_type: string;
  timestamp: string;
  status?: string | null;
};

type SupplierMasterRows = Record<string, string>;

type SupplierTransactionRow = {
  total_debt?: number | string | null;
  paid_amount?: number | string | null;
  remaining_debt?: number | string | null;
  deducted?: boolean | null;
  timestamp?: string | null;
  action?: string | null;
  note?: string | null;
  added_debt?: number | string | null;
};

type MigrationError = {
  row: number;
  legacyKey?: string;
  messages: string[];
};

type MigrationWarning = {
  offerIndex: number;
  itemIndex: number;
  productName: string;
  message: string;
};

type DryRunWarning = MigrationWarning | string;

type ScreenStockPreviewItem = {
  id: string;
  brand: string;
  storageGb: number;
  ramGb: number;
  cores: number;
  sizeInch: string | null;
  quantity: number;
  alreadyExists: boolean;
};

type MultimediaStockPreviewItem = {
  id: string;
  code: string;
  forx: string | null;
  brand: string | null;
  model: string | null;
  shelf: string | null;
  quantity: number;
  alreadyExists: boolean;
};

type SoundStockPreviewItem = {
  name: string;
  purchasePriceUsd: string | null;
  quantity: number;
  alreadyExists: boolean;
};

type SoundOfferPreviewItem = {
  id: string;
  createdAt: string;
  createdBy: string | null;
  itemCount: number;
  autoTotal: string;
  finalTotal: string;
  exchangeRate: string;
  saleType: "CASH" | "CARD";
  status: "DRAFT" | "ACCEPTED" | "USED" | "CANCELLED";
  alreadyExists: boolean;
};

type SupplierPreviewItem = {
  name: string;
  currency: "TRY" | "USD";
  alreadyExists: boolean;
};

type SupplierTransactionPreviewItem = {
  supplierName: string;
  transactionAt: string;
  type: "DEBT_INCREASE" | "PAYMENT";
  amount: string;
  currency: string;
  balanceAfter: string;
  note: string | null;
  alreadyExists: boolean;
};

type VehicleHistoryPreviewItem = {
  file: string;
  date: string;
  plate: string;
  brandModel: string;
  customer: string | null;
  operationCount: number;
  totalAmount: string;
  status: "NEW" | "EXISTING" | "INVALID";
};

type SpecialPaymentPreviewItem = {
  file: string;
  section: string;
  masterName: string | null;
  date: string | null;
  amount: string | null;
  description: string | null;
  status: "NEW" | "EXISTING" | "SKIPPED" | "ERROR";
};

type DryRunResponse = {
  total?: number;
  valid?: number;
  invalid?: number;
  alreadyExists?: number;
  totalFiles?: number;
  validFiles?: number;
  invalidFiles?: number;
  skippedFiles?: number;
  totalVehicles?: number;
  newVehicles?: number;
  existingVehicles?: number;
  totalVisits?: number;
  totalOperations?: number;
  personnelPayments?: number;
  loanPayments?: number;
  invoicePayments?: number;
  expenseRecords?: number;
  sgkRecords?: number;
  mealRecords?: number;
  skippedCustomRecords?: number;
  errors: MigrationError[];
  warnings?: DryRunWarning[];
  preview: Array<
    | ScreenStockPreviewItem
    | MultimediaStockPreviewItem
    | SoundStockPreviewItem
    | SoundOfferPreviewItem
    | SupplierPreviewItem
    | SupplierTransactionPreviewItem
    | VehicleHistoryPreviewItem
    | SpecialPaymentPreviewItem
  >;
};

type ImportResponse = {
  batchId: string;
  total: number;
  success: number;
  skipped: number;
  error: number;
};

type SelectedFile = {
  name: string;
  size: number;
  rawFile?: File;
  rows:
    | SupplierMasterRows
    | Array<
        | ScreenStockRow
        | MultimediaStockRow
        | SoundStockRow
        | SoundOfferRow
        | SupplierTransactionRow
      >;
};

type SupplierListItem = {
  id: string;
  name: string;
  currency: string;
};

const migrationTypes = [
  {
    value: "screen-stock",
    label: "Ekran Stokları",
    fileHint: "screen_stock.json",
    dryRunPath: "/api/admin/migration/screen-stock/dry-run",
    importPath: "/api/admin/migration/screen-stock/import",
  },
  {
    value: "multimedia-stock",
    label: "Multimedya Stokları",
    fileHint: "multimedia_stock.json",
    dryRunPath: "/api/admin/migration/multimedia-stock/dry-run",
    importPath: "/api/admin/migration/multimedia-stock/import",
  },
  {
    value: "sound-stock",
    label: "Ses Sistemi Stokları",
    fileHint: "sound_stock.json",
    dryRunPath: "/api/admin/migration/sound-stock/dry-run",
    importPath: "/api/admin/migration/sound-stock/import",
  },
  {
    value: "sound-offers",
    label: "Ses Sistemi Teklifleri",
    fileHint: "sound_offers.json",
    dryRunPath: "/api/admin/migration/sound-offers/dry-run",
    importPath: "/api/admin/migration/sound-offers/import",
  },
  {
    value: "suppliers",
    label: "Toptancı Master",
    fileHint: "firm_currencies.json",
    dryRunPath: "/api/admin/migration/suppliers/dry-run",
    importPath: "/api/admin/migration/suppliers/import",
  },
  {
    value: "supplier-transactions",
    label: "Toptancı Hareketleri",
    fileHint: "firma_hareketleri.json",
    dryRunPath: "/api/admin/migration/supplier-transactions/dry-run",
    importPath: "/api/admin/migration/supplier-transactions/import",
  },
  {
    value: "vehicle-history",
    label: "Araç Geçmişi",
    fileHint: "vehicle_history.zip",
    dryRunPath: "/api/admin/migration/vehicle-history/dry-run",
    importPath: "/api/admin/migration/vehicle-history/import",
  },
  {
    value: "special-payments",
    label: "Özel Ödemeler",
    fileHint: "owner_master.json ve owner_YYYY-MM.json içeren ZIP",
    dryRunPath: "/api/admin/migration/special-payments/dry-run",
    importPath: "/api/admin/migration/special-payments/import",
  },
] as const;
type MigrationType = (typeof migrationTypes)[number]["value"];
const apiBaseUrl = import.meta.env.VITE_API_URL;

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const readJsonFile = async (file: File, type: MigrationType): Promise<SelectedFile> => {
  if (type === "vehicle-history" || type === "special-payments") {
    return {
      name: file.name,
      size: file.size,
      rawFile: file,
      rows: [],
    };
  }

  const text = await file.text();
  const parsed = JSON.parse(text) as unknown;

  if (type === "suppliers") {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("JSON dosyası object formatında olmalı.");
    }

    return {
      name: file.name,
      size: file.size,
      rows: parsed as SupplierMasterRows,
    };
  }

  if (!Array.isArray(parsed)) {
    throw new Error("JSON dosyası array formatında olmalı.");
  }

  return {
    name: file.name,
    size: file.size,
    rows: parsed as Array<
      ScreenStockRow | MultimediaStockRow | SoundStockRow | SoundOfferRow | SupplierTransactionRow
    >,
  };
};

const postMigration = async <TResponse,>(path: string, payload: unknown) => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => null)) as TResponse | { message?: string } | null;

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "message" in data ? data.message : undefined;

    throw new Error(message || "Migration isteği başarısız oldu.");
  }

  return data as TResponse;
};

const postZipMigration = async <TResponse,>(path: string, file: File) => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/zip",
      "X-Filename": file.name,
    },
    body: file,
  });
  const data = (await response.json().catch(() => null)) as TResponse | { message?: string } | null;

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "message" in data ? data.message : undefined;

    throw new Error(message || "ZIP migration isteği başarısız oldu.");
  }

  return data as TResponse;
};

const getMigrationConfig = (type: MigrationType) =>
  migrationTypes.find((migrationType) => migrationType.value === type) ?? migrationTypes[0];

const isMultimediaPreviewItem = (
  row: DryRunResponse["preview"][number],
): row is MultimediaStockPreviewItem => "code" in row;

const isSoundStockPreviewItem = (
  row: DryRunResponse["preview"][number],
): row is SoundStockPreviewItem => "purchasePriceUsd" in row;

const isSoundOfferPreviewItem = (
  row: DryRunResponse["preview"][number],
): row is SoundOfferPreviewItem => "itemCount" in row;

const isSupplierPreviewItem = (
  row: DryRunResponse["preview"][number],
): row is SupplierPreviewItem => "name" in row && "currency" in row && !("amount" in row);

const isSupplierTransactionPreviewItem = (
  row: DryRunResponse["preview"][number],
): row is SupplierTransactionPreviewItem => "supplierName" in row;

const isVehicleHistoryPreviewItem = (
  row: DryRunResponse["preview"][number],
): row is VehicleHistoryPreviewItem => "operationCount" in row && "plate" in row;

const isSpecialPaymentPreviewItem = (
  row: DryRunResponse["preview"][number],
): row is SpecialPaymentPreviewItem => "section" in row && "masterName" in row;

const isScreenPreviewItem = (
  row: DryRunResponse["preview"][number],
): row is ScreenStockPreviewItem =>
  !isMultimediaPreviewItem(row) &&
  !isSoundStockPreviewItem(row) &&
  !isSoundOfferPreviewItem(row) &&
  !isSupplierPreviewItem(row) &&
  !isSupplierTransactionPreviewItem(row) &&
  !isVehicleHistoryPreviewItem(row) &&
  !isSpecialPaymentPreviewItem(row);

const isMigrationWarning = (warning: DryRunWarning): warning is MigrationWarning =>
  typeof warning !== "string";

function AdminMigrationPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedType, setSelectedType] = useState<MigrationType>("screen-stock");
  const [file, setFile] = useState<SelectedFile | null>(null);
  const [dryRunResult, setDryRunResult] = useState<DryRunResponse | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierListItem[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);

  const isBusy = isParsing || isDryRunning || isImporting || isLoadingSuppliers;
  const selectedMigration = getMigrationConfig(selectedType);
  const requiresSupplier = selectedType === "supplier-transactions";
  const isVehicleHistory = selectedType === "vehicle-history";
  const isSpecialPayments = selectedType === "special-payments";
  const usesZip = isVehicleHistory || isSpecialPayments;
  const canImport = Boolean(file && dryRunResult && !isBusy && (!requiresSupplier || selectedSupplierId));
  const previewRows = useMemo(() => dryRunResult?.preview.slice(0, 50) ?? [], [dryRunResult]);
  const selectedFileRowCount = file
    ? usesZip
      ? null
      : Array.isArray(file.rows)
      ? file.rows.length
      : Object.keys(file.rows).length
    : 0;

  useEffect(() => {
    if (!requiresSupplier) return;

    let ignore = false;

    const loadSuppliers = async () => {
      setIsLoadingSuppliers(true);

      try {
        const response = await fetch(`${apiBaseUrl}/api/admin/migration/suppliers`);
        const data = (await response.json().catch(() => null)) as SupplierListItem[] | null;

        if (!response.ok) {
          throw new Error("Toptancı listesi alınamadı.");
        }

        if (!ignore) {
          setSuppliers(Array.isArray(data) ? data : []);
          setSelectedSupplierId((current) => current || (Array.isArray(data) ? data[0]?.id ?? "" : ""));
        }
      } catch (error) {
        if (!ignore) {
          setSuppliers([]);
          setSelectedSupplierId("");
          toast.error(error instanceof Error ? error.message : "Toptancı listesi alınamadı.");
        }
      } finally {
        if (!ignore) {
          setIsLoadingSuppliers(false);
        }
      }
    };

    void loadSuppliers();

    return () => {
      ignore = true;
    };
  }, [requiresSupplier]);

  const handleTypeChange = (type: MigrationType) => {
    setSelectedType(type);
    setFile(null);
    setDryRunResult(null);
    setImportResult(null);
  };

  const handleFile = async (nextFile?: File) => {
    if (!nextFile) return;

    const expectedExtension = usesZip ? ".zip" : ".json";

    if (!nextFile.name.toLowerCase().endsWith(expectedExtension)) {
      toast.error(`Lütfen ${expectedExtension} uzantılı bir dosya seçin.`);
      return;
    }

    setIsParsing(true);
    setDryRunResult(null);
    setImportResult(null);

    try {
      const parsedFile = await readJsonFile(nextFile, selectedType);
      setFile(parsedFile);
      toast.success(usesZip ? "ZIP dosyası hazır." : "JSON dosyası okundu.");
    } catch (error) {
      setFile(null);
      toast.error(error instanceof Error ? error.message : "JSON dosyası okunamadı.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    void handleFile(event.dataTransfer.files[0]);
  };

  const runDryRun = async () => {
    if (!file) {
      toast.error(`Önce ${selectedMigration.fileHint} dosyasını seçin.`);
      return;
    }

    if (requiresSupplier && !selectedSupplierId) {
      toast.error("Önce firma seçin.");
      return;
    }

    setIsDryRunning(true);
    setImportResult(null);

    try {
      const payload = requiresSupplier
        ? {
            supplierId: selectedSupplierId,
            rows: file.rows,
          }
        : file.rows;
      const result =
        usesZip && file.rawFile
          ? await postZipMigration<DryRunResponse>(selectedMigration.dryRunPath, file.rawFile)
          : await postMigration<DryRunResponse>(selectedMigration.dryRunPath, payload);
      setDryRunResult(result);
      toast.success("Dry Run tamamlandı.");
    } catch (error) {
      setDryRunResult(null);
      toast.error(error instanceof Error ? error.message : "Dry Run başarısız oldu.");
    } finally {
      setIsDryRunning(false);
    }
  };

  const runImport = async () => {
    if (!file || !dryRunResult) return;

    if (requiresSupplier && !selectedSupplierId) {
      toast.error("Önce firma seçin.");
      return;
    }

    setIsImporting(true);

    try {
      const payload = requiresSupplier
        ? {
            supplierId: selectedSupplierId,
            rows: file.rows,
          }
        : file.rows;
      const result =
        usesZip && file.rawFile
          ? await postZipMigration<ImportResponse>(selectedMigration.importPath, file.rawFile)
          : await postMigration<ImportResponse>(selectedMigration.importPath, payload);
      setImportResult(result);
      toast.success("Import tamamlandı.");
    } catch (error) {
      setImportResult(null);
      toast.error(error instanceof Error ? error.message : "Import başarısız oldu.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <AppLayout title="Veri Migration Yönetimi">
      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="card-elevated p-5">
          <label className="mb-2 block text-sm font-semibold text-foreground">Veri Tipi</label>
          <select
            value={selectedType}
            onChange={(event) => handleTypeChange(event.target.value as MigrationType)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          >
            {migrationTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          {requiresSupplier && (
            <div className="mt-4">
              <label className="mb-2 block text-sm font-semibold text-foreground">Firma</label>
              <select
                value={selectedSupplierId}
                onChange={(event) => {
                  setSelectedSupplierId(event.target.value);
                  setDryRunResult(null);
                  setImportResult(null);
                }}
                disabled={isLoadingSuppliers}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary disabled:opacity-50"
              >
                {suppliers.length === 0 ? (
                  <option value="">
                    {isLoadingSuppliers ? "Firmalar yükleniyor..." : "Firma bulunamadı"}
                  </option>
                ) : (
                  suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name} ({supplier.currency})
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className="mt-5 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 p-5 text-center transition-colors hover:border-primary hover:bg-muted/50"
          >
            <input
              ref={inputRef}
              type="file"
              accept={usesZip ? ".zip,application/zip" : ".json,application/json"}
              className="hidden"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
            {isParsing ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : (
              <UploadCloud className="h-8 w-8 text-primary" />
            )}
            <div className="mt-3 text-sm font-semibold">
              {usesZip ? "ZIP dosyası seç" : "JSON dosyası seç"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{selectedMigration.fileHint}</div>
          </div>

          {file && (
            <div className="mt-4 rounded-lg border border-border bg-background p-4">
              <div className="flex items-start gap-3">
                <FileJson className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 text-sm">
                  <div className="truncate font-semibold">{file.name}</div>
                  <div className="mt-1 text-muted-foreground">
                    {formatBytes(file.size)} ·{" "}
                    {selectedFileRowCount === null ? "ZIP arşivi" : `${selectedFileRowCount} kayıt`}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() => void runDryRun()}
              disabled={!file || isBusy}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
            >
              {isDryRunning && <Loader2 className="h-4 w-4 animate-spin" />}
              Dry Run
            </button>
            <button
              onClick={() => void runImport()}
              disabled={!canImport}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-input bg-card px-4 text-sm font-semibold hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            >
              {isImporting && <Loader2 className="h-4 w-4 animate-spin" />}
              Import Et
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {dryRunResult && (
            <>
              {isSpecialPayments ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <ResultCard label="Dosya" value={dryRunResult.totalFiles ?? 0} />
                  <ResultCard label="Geçerli Dosya" value={dryRunResult.validFiles ?? 0} tone="success" />
                  <ResultCard label="Hatalı Dosya" value={dryRunResult.invalidFiles ?? 0} tone="destructive" />
                  <ResultCard label="Personel Ödemesi" value={dryRunResult.personnelPayments ?? 0} />
                  <ResultCard label="Kredi Ödemesi" value={dryRunResult.loanPayments ?? 0} />
                  <ResultCard label="Fatura Ödemesi" value={dryRunResult.invoicePayments ?? 0} />
                  <ResultCard label="Gider Kaydı" value={dryRunResult.expenseRecords ?? 0} />
                  <ResultCard label="SGK Kaydı" value={dryRunResult.sgkRecords ?? 0} />
                  <ResultCard label="Yemek Kaydı" value={dryRunResult.mealRecords ?? 0} />
                  <ResultCard
                    label="Atlanan CUSTOM"
                    value={dryRunResult.skippedCustomRecords ?? 0}
                    tone="warning"
                  />
                  <ResultCard label="Uyarı" value={dryRunResult.warnings?.length ?? 0} tone="warning" />
                  <ResultCard label="Hata" value={dryRunResult.errors.length} tone="destructive" />
                </div>
              ) : isVehicleHistory ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <ResultCard label="Dosya" value={dryRunResult.totalFiles ?? 0} />
                  <ResultCard label="Geçerli Dosya" value={dryRunResult.validFiles ?? 0} tone="success" />
                  <ResultCard label="Hatalı Dosya" value={dryRunResult.invalidFiles ?? 0} tone="destructive" />
                  <ResultCard label="Atlanan Dosya" value={dryRunResult.skippedFiles ?? 0} tone="warning" />
                  <ResultCard label="Araç" value={dryRunResult.totalVehicles ?? 0} />
                  <ResultCard label="Yeni Araç" value={dryRunResult.newVehicles ?? 0} tone="success" />
                  <ResultCard label="Mevcut Araç" value={dryRunResult.existingVehicles ?? 0} tone="warning" />
                  <ResultCard label="Ziyaret" value={dryRunResult.totalVisits ?? 0} />
                  <ResultCard label="İşlem" value={dryRunResult.totalOperations ?? 0} />
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <ResultCard label="Toplam" value={dryRunResult.total ?? 0} />
                  <ResultCard label="Geçerli" value={dryRunResult.valid ?? 0} tone="success" />
                  <ResultCard label="Hatalı" value={dryRunResult.invalid ?? 0} tone="destructive" />
                  <ResultCard
                    label="Zaten Mevcut"
                    value={dryRunResult.alreadyExists ?? 0}
                    tone="warning"
                  />
                </div>
              )}

              {dryRunResult.errors.length > 0 && (
                <div className="card-elevated p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <h2 className="text-base font-bold">Hatalar</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Satır</th>
                          <th className="px-4 py-3 text-left font-semibold">Kod</th>
                          <th className="px-4 py-3 text-left font-semibold">Hata</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dryRunResult.errors.map((error) => (
                          <tr
                            key={`${error.row}-${error.legacyKey ?? "empty"}`}
                            className="border-t border-border/60"
                          >
                            <td className="px-4 py-3 font-semibold">{error.row + 1}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {error.legacyKey ?? "-"}
                            </td>
                            <td className="px-4 py-3">{error.messages.join("; ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {dryRunResult.warnings && dryRunResult.warnings.length > 0 && (
                <div className="card-elevated p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    <h2 className="text-base font-bold">Uyarılar</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Teklif</th>
                          <th className="px-4 py-3 text-left font-semibold">Item</th>
                          <th className="px-4 py-3 text-left font-semibold">Ürün</th>
                          <th className="px-4 py-3 text-left font-semibold">Uyarı</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dryRunResult.warnings.map((warning) => (
                          <tr
                            key={
                              isMigrationWarning(warning)
                                ? `${warning.offerIndex}-${warning.itemIndex}-${warning.productName}`
                                : warning
                            }
                            className="border-t border-border/60"
                          >
                            {isMigrationWarning(warning) ? (
                              <>
                                <td className="px-4 py-3 font-semibold">
                                  {warning.offerIndex + 1}
                                </td>
                                <td className="px-4 py-3 font-semibold">
                                  {warning.itemIndex + 1}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {warning.productName}
                                </td>
                                <td className="px-4 py-3">{warning.message}</td>
                              </>
                            ) : (
                              <>
                                <td className="px-4 py-3 text-muted-foreground">-</td>
                                <td className="px-4 py-3 text-muted-foreground">-</td>
                                <td className="px-4 py-3 text-muted-foreground">-</td>
                                <td className="px-4 py-3">{warning}</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {previewRows.length > 0 && selectedType === "special-payments" && (
                <div className="card-elevated p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <h2 className="text-base font-bold">Önizleme</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Dosya</th>
                          <th className="px-4 py-3 text-left font-semibold">Bölüm</th>
                          <th className="px-4 py-3 text-left font-semibold">Master/Kategori</th>
                          <th className="px-4 py-3 text-left font-semibold">Tarih</th>
                          <th className="px-4 py-3 text-right font-semibold">Tutar</th>
                          <th className="px-4 py-3 text-left font-semibold">Açıklama</th>
                          <th className="px-4 py-3 text-left font-semibold">Durum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, index) => {
                          if (!isSpecialPaymentPreviewItem(row)) return null;

                          const tone =
                            row.status === "ERROR"
                              ? "bg-destructive/15 text-destructive"
                              : row.status === "NEW"
                                ? "bg-success/15 text-success"
                                : "bg-warning/15 text-warning";
                          return (
                            <tr
                              key={`${row.file}-${row.section}-${row.date ?? "empty"}-${index}`}
                              className="border-t border-border/60 hover:bg-muted/30"
                            >
                              <td className="px-4 py-3 text-muted-foreground">{row.file}</td>
                              <td className="px-4 py-3 font-semibold">{row.section}</td>
                              <td className="px-4 py-3">{row.masterName ?? "-"}</td>
                              <td className="px-4 py-3">{row.date ?? "-"}</td>
                              <td className="px-4 py-3 text-right font-bold">{row.amount ?? "-"}</td>
                              <td className="px-4 py-3">{row.description ?? "-"}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {previewRows.length > 0 && selectedType === "screen-stock" && (
                <div className="card-elevated p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <h2 className="text-base font-bold">Önizleme</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Kod</th>
                          <th className="px-4 py-3 text-left font-semibold">Marka</th>
                          <th className="px-4 py-3 text-right font-semibold">Hafıza</th>
                          <th className="px-4 py-3 text-right font-semibold">RAM</th>
                          <th className="px-4 py-3 text-right font-semibold">Çekirdek</th>
                          <th className="px-4 py-3 text-right font-semibold">Boyut</th>
                          <th className="px-4 py-3 text-right font-semibold">Adet</th>
                          <th className="px-4 py-3 text-left font-semibold">Durum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row) => {
                          if (!isScreenPreviewItem(row)) return null;

                          return (
                            <tr
                              key={row.id}
                              className="border-t border-border/60 hover:bg-muted/30"
                            >
                              <td className="px-4 py-3 text-muted-foreground">{row.id}</td>
                              <td className="px-4 py-3 font-semibold">{row.brand}</td>
                              <td className="px-4 py-3 text-right">{row.storageGb}</td>
                              <td className="px-4 py-3 text-right">{row.ramGb}</td>
                              <td className="px-4 py-3 text-right">{row.cores}</td>
                              <td className="px-4 py-3 text-right">{row.sizeInch}</td>
                              <td className="px-4 py-3 text-right font-bold">{row.quantity}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    row.alreadyExists
                                      ? "bg-warning/15 text-warning"
                                      : "bg-success/15 text-success"
                                  }`}
                                >
                                  {row.alreadyExists ? "Zaten Mevcut" : "Yeni"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {previewRows.length > 0 && selectedType === "multimedia-stock" && (
                <div className="card-elevated p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <h2 className="text-base font-bold">Önizleme</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">ID</th>
                          <th className="px-4 py-3 text-left font-semibold">Kod</th>
                          <th className="px-4 py-3 text-left font-semibold">Forx</th>
                          <th className="px-4 py-3 text-left font-semibold">Marka</th>
                          <th className="px-4 py-3 text-left font-semibold">Model</th>
                          <th className="px-4 py-3 text-left font-semibold">Raf</th>
                          <th className="px-4 py-3 text-right font-semibold">Adet</th>
                          <th className="px-4 py-3 text-left font-semibold">Durum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row) => {
                          if (!isMultimediaPreviewItem(row)) return null;

                          return (
                            <tr
                              key={row.id}
                              className="border-t border-border/60 hover:bg-muted/30"
                            >
                              <td className="px-4 py-3 text-muted-foreground">{row.id}</td>
                              <td className="px-4 py-3 font-semibold">{row.code}</td>
                              <td className="px-4 py-3">{row.forx ?? "-"}</td>
                              <td className="px-4 py-3">{row.brand ?? "-"}</td>
                              <td className="px-4 py-3">{row.model ?? "-"}</td>
                              <td className="px-4 py-3">{row.shelf ?? "-"}</td>
                              <td className="px-4 py-3 text-right font-bold">{row.quantity}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    row.alreadyExists
                                      ? "bg-warning/15 text-warning"
                                      : "bg-success/15 text-success"
                                  }`}
                                >
                                  {row.alreadyExists ? "Zaten Mevcut" : "Yeni"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {previewRows.length > 0 && selectedType === "sound-stock" && (
                <div className="card-elevated p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <h2 className="text-base font-bold">Önizleme</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Ürün</th>
                          <th className="px-4 py-3 text-right font-semibold">Alış Fiyatı USD</th>
                          <th className="px-4 py-3 text-right font-semibold">Adet</th>
                          <th className="px-4 py-3 text-left font-semibold">Durum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row) => {
                          if (!isSoundStockPreviewItem(row)) return null;

                          return (
                            <tr
                              key={row.name}
                              className="border-t border-border/60 hover:bg-muted/30"
                            >
                              <td className="px-4 py-3 font-semibold">{row.name}</td>
                              <td className="px-4 py-3 text-right">
                                {row.purchasePriceUsd ?? "-"}
                              </td>
                              <td className="px-4 py-3 text-right font-bold">{row.quantity}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    row.alreadyExists
                                      ? "bg-warning/15 text-warning"
                                      : "bg-success/15 text-success"
                                  }`}
                                >
                                  {row.alreadyExists ? "Zaten Mevcut" : "Yeni"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {previewRows.length > 0 && selectedType === "sound-offers" && (
                <div className="card-elevated p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <h2 className="text-base font-bold">Önizleme</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Tarih</th>
                          <th className="px-4 py-3 text-left font-semibold">Kullanıcı</th>
                          <th className="px-4 py-3 text-right font-semibold">Ürün Sayısı</th>
                          <th className="px-4 py-3 text-right font-semibold">Otomatik Toplam</th>
                          <th className="px-4 py-3 text-right font-semibold">Nihai Teklif</th>
                          <th className="px-4 py-3 text-right font-semibold">USD Kuru</th>
                          <th className="px-4 py-3 text-left font-semibold">Satış Tipi</th>
                          <th className="px-4 py-3 text-left font-semibold">Durum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row) => {
                          if (!isSoundOfferPreviewItem(row)) return null;

                          return (
                            <tr
                              key={row.id}
                              className="border-t border-border/60 hover:bg-muted/30"
                            >
                              <td className="px-4 py-3 text-muted-foreground">
                                {new Date(row.createdAt).toLocaleString("tr-TR")}
                              </td>
                              <td className="px-4 py-3">{row.createdBy ?? "-"}</td>
                              <td className="px-4 py-3 text-right font-bold">{row.itemCount}</td>
                              <td className="px-4 py-3 text-right">{row.autoTotal}</td>
                              <td className="px-4 py-3 text-right">{row.finalTotal}</td>
                              <td className="px-4 py-3 text-right">{row.exchangeRate}</td>
                              <td className="px-4 py-3">{row.saleType}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    row.alreadyExists
                                      ? "bg-warning/15 text-warning"
                                      : "bg-success/15 text-success"
                                  }`}
                                >
                                  {row.alreadyExists ? "Zaten Mevcut" : row.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {previewRows.length > 0 && selectedType === "suppliers" && (
                <div className="card-elevated p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <h2 className="text-base font-bold">Önizleme</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Firma</th>
                          <th className="px-4 py-3 text-left font-semibold">Para Birimi</th>
                          <th className="px-4 py-3 text-left font-semibold">Durum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row) => {
                          if (!isSupplierPreviewItem(row)) return null;

                          return (
                            <tr
                              key={row.name}
                              className="border-t border-border/60 hover:bg-muted/30"
                            >
                              <td className="px-4 py-3 font-semibold">{row.name}</td>
                              <td className="px-4 py-3">{row.currency}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    row.alreadyExists
                                      ? "bg-warning/15 text-warning"
                                      : "bg-success/15 text-success"
                                  }`}
                                >
                                  {row.alreadyExists ? "Zaten Mevcut" : "Yeni"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {previewRows.length > 0 && selectedType === "supplier-transactions" && (
                <div className="card-elevated p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <h2 className="text-base font-bold">Önizleme</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Firma</th>
                          <th className="px-4 py-3 text-left font-semibold">Tarih</th>
                          <th className="px-4 py-3 text-left font-semibold">İşlem Tipi</th>
                          <th className="px-4 py-3 text-right font-semibold">Tutar</th>
                          <th className="px-4 py-3 text-left font-semibold">Para Birimi</th>
                          <th className="px-4 py-3 text-right font-semibold">Kalan Borç</th>
                          <th className="px-4 py-3 text-left font-semibold">Not</th>
                          <th className="px-4 py-3 text-left font-semibold">Durum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row) => {
                          if (!isSupplierTransactionPreviewItem(row)) return null;

                          return (
                            <tr
                              key={`${row.supplierName}-${row.transactionAt}-${row.type}-${row.amount}`}
                              className="border-t border-border/60 hover:bg-muted/30"
                            >
                              <td className="px-4 py-3 font-semibold">{row.supplierName}</td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {new Date(row.transactionAt).toLocaleString("tr-TR")}
                              </td>
                              <td className="px-4 py-3">{row.type}</td>
                              <td className="px-4 py-3 text-right font-bold">{row.amount}</td>
                              <td className="px-4 py-3">{row.currency}</td>
                              <td className="px-4 py-3 text-right">{row.balanceAfter}</td>
                              <td className="px-4 py-3">{row.note ?? "-"}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    row.alreadyExists
                                      ? "bg-warning/15 text-warning"
                                      : "bg-success/15 text-success"
                                  }`}
                                >
                                  {row.alreadyExists ? "Zaten Mevcut" : "Yeni"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {previewRows.length > 0 && selectedType === "vehicle-history" && (
                <div className="card-elevated p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <h2 className="text-base font-bold">Önizleme</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Dosya</th>
                          <th className="px-4 py-3 text-left font-semibold">Tarih</th>
                          <th className="px-4 py-3 text-left font-semibold">Plaka</th>
                          <th className="px-4 py-3 text-left font-semibold">Marka/Model</th>
                          <th className="px-4 py-3 text-left font-semibold">Müşteri</th>
                          <th className="px-4 py-3 text-right font-semibold">İşlem Sayısı</th>
                          <th className="px-4 py-3 text-right font-semibold">Toplam Tutar</th>
                          <th className="px-4 py-3 text-left font-semibold">Durum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row) => {
                          if (!isVehicleHistoryPreviewItem(row)) return null;

                          return (
                            <tr
                              key={row.file}
                              className="border-t border-border/60 hover:bg-muted/30"
                            >
                              <td className="px-4 py-3 text-muted-foreground">{row.file}</td>
                              <td className="px-4 py-3">
                                {new Date(row.date).toLocaleString("tr-TR")}
                              </td>
                              <td className="px-4 py-3 font-semibold">{row.plate}</td>
                              <td className="px-4 py-3">{row.brandModel}</td>
                              <td className="px-4 py-3">{row.customer ?? "-"}</td>
                              <td className="px-4 py-3 text-right font-bold">
                                {row.operationCount}
                              </td>
                              <td className="px-4 py-3 text-right">{row.totalAmount}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    row.status === "EXISTING"
                                      ? "bg-warning/15 text-warning"
                                      : "bg-success/15 text-success"
                                  }`}
                                >
                                  {row.status === "EXISTING" ? "Zaten Mevcut" : "Yeni"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {importResult && (
            <div className="card-elevated p-5">
              <h2 className="mb-4 text-base font-bold">Import Sonucu</h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <ResultCard label="batchId" value={importResult.batchId} />
                <ResultCard label="total" value={importResult.total} />
                <ResultCard label="success" value={importResult.success} tone="success" />
                <ResultCard label="skipped" value={importResult.skipped} tone="warning" />
                <ResultCard label="error" value={importResult.error} tone="destructive" />
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function ResultCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "success" | "warning" | "destructive";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "destructive"
          ? "text-destructive"
          : "text-foreground";

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className={`mt-2 break-all text-2xl font-black ${toneClass}`}>{value}</div>
    </div>
  );
}
