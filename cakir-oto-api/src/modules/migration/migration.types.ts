export type MigrationStatusResponse = {
  success: true;
  message: string;
};

export type ScreenStockMigrationInput = {
  kod?: unknown;
  marka?: unknown;
  hafiza?: unknown;
  ram?: unknown;
  cekirdek?: unknown;
  boyut?: unknown;
  adet?: unknown;
};

export type MultimediaStockMigrationInput = {
  id?: unknown;
  kod?: unknown;
  forx?: unknown;
  model?: unknown;
  adet?: unknown;
  raf?: unknown;
  marka?: unknown;
};

export type SoundStockMigrationInput = {
  name?: unknown;
  price?: unknown;
  quantity?: unknown;
};

export type SoundOfferMigrationItemInput = {
  name?: unknown;
  price?: unknown;
  quantity?: unknown;
};

export type SoundOfferMigrationInput = {
  user?: unknown;
  items?: unknown;
  manual_total?: unknown;
  auto_total?: unknown;
  usd_kur?: unknown;
  sale_type?: unknown;
  timestamp?: unknown;
  status?: unknown;
};

export type SupplierMigrationInput = Record<string, unknown>;

export type SupplierTransactionMigrationInput = {
  total_debt?: unknown;
  paid_amount?: unknown;
  remaining_debt?: unknown;
  deducted?: unknown;
  timestamp?: unknown;
  action?: unknown;
  note?: unknown;
  added_debt?: unknown;
};

export type SupplierTransactionMigrationRequest = {
  supplierId?: unknown;
  rows?: unknown;
};

export type VehicleHistoryProcessInput = {
  timestamp?: unknown;
  description?: unknown;
  price?: unknown;
  payment?: unknown;
  brand?: unknown;
  model?: unknown;
  note?: unknown;
  mail_order_firm?: unknown;
  multimedia_type?: unknown;
  screen_type?: unknown;
};

export type VehicleHistoryFileInput = {
  plate?: unknown;
  timestamp?: unknown;
  ad?: unknown;
  soyad?: unknown;
  telefon?: unknown;
  musteri_notu?: unknown;
  brand?: unknown;
  model?: unknown;
  note?: unknown;
  processes?: unknown;
};

export type ScreenStockParsedRow = {
  id: string;
  brand: string;
  storageGb: number;
  ramGb: number;
  cores: number;
  sizeInch: string | null;
  sizeLabel: string | null;
  quantity: number;
};

export type MultimediaStockParsedRow = {
  id: string;
  code: string;
  forx: string | null;
  model: string | null;
  quantity: number;
  shelf: string | null;
  brand: string | null;
};

export type SoundStockParsedRow = {
  name: string;
  normalizedName: string;
  purchasePriceUsd: string | null;
  quantity: number;
};

export type SoundOfferParsedItem = {
  sourceItem: number;
  productNameSnapshot: string;
  normalizedName: string;
  unitPurchasePriceUsd: string | null;
  quantity: number;
};

export type SoundOfferParsedRow = {
  sourceRow: number;
  createdBy: string | null;
  items: SoundOfferParsedItem[];
  manualTotal: string | null;
  autoTotal: string;
  exchangeRate: string;
  saleType: "CASH" | "CARD";
  createdAt: Date;
  status: "DRAFT" | "ACCEPTED" | "USED" | "CANCELLED";
};

export type SupplierParsedRow = {
  sourceRow: number;
  name: string;
  normalizedName: string;
  currency: "TRY" | "USD";
};

export type SupplierTransactionParsedRow = {
  sourceRow: number;
  supplierId: string;
  supplierName: string;
  type: "DEBT_INCREASE" | "PAYMENT";
  actionInferred: boolean;
  amount: string;
  currency: string;
  balanceAfter: string;
  note: string | null;
  transactionAt: Date;
};

export type MigrationRowError = {
  row: number;
  legacyKey?: string;
  messages: string[];
};

export type SoundOfferWarning = {
  offerIndex: number;
  itemIndex: number;
  productName: string;
  message: string;
};

export type ScreenStockPreviewItem = ScreenStockParsedRow & {
  alreadyExists: boolean;
};

export type MultimediaStockPreviewItem = MultimediaStockParsedRow & {
  alreadyExists: boolean;
};

export type SoundStockPreviewItem = Omit<SoundStockParsedRow, "normalizedName"> & {
  alreadyExists: boolean;
};

export type SoundOfferPreviewItem = {
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

export type SupplierPreviewItem = {
  name: string;
  currency: "TRY" | "USD";
  alreadyExists: boolean;
};

export type SupplierTransactionPreviewItem = {
  supplierName: string;
  transactionAt: string;
  type: "DEBT_INCREASE" | "PAYMENT";
  amount: string;
  currency: string;
  balanceAfter: string;
  note: string | null;
  alreadyExists: boolean;
};

export type VehicleHistoryPreviewItem = {
  file: string;
  date: string;
  plate: string;
  brandModel: string;
  customer: string | null;
  operationCount: number;
  totalAmount: string;
  status: "NEW" | "EXISTING" | "INVALID";
};

export type ScreenStockDryRunResponse = {
  total: number;
  valid: number;
  invalid: number;
  alreadyExists: number;
  errors: MigrationRowError[];
  preview: ScreenStockPreviewItem[];
};

export type MultimediaStockDryRunResponse = {
  total: number;
  valid: number;
  invalid: number;
  alreadyExists: number;
  errors: MigrationRowError[];
  preview: MultimediaStockPreviewItem[];
};

export type SoundStockDryRunResponse = {
  total: number;
  valid: number;
  invalid: number;
  alreadyExists: number;
  errors: MigrationRowError[];
  preview: SoundStockPreviewItem[];
};

export type SoundOffersDryRunResponse = {
  total: number;
  valid: number;
  invalid: number;
  alreadyExists: number;
  errors: MigrationRowError[];
  warnings: SoundOfferWarning[];
  preview: SoundOfferPreviewItem[];
};

export type SupplierDryRunResponse = {
  total: number;
  valid: number;
  invalid: number;
  alreadyExists: number;
  warnings: string[];
  errors: MigrationRowError[];
  preview: SupplierPreviewItem[];
};

export type SupplierTransactionDryRunResponse = {
  total: number;
  valid: number;
  invalid: number;
  alreadyExists: number;
  warnings: string[];
  errors: MigrationRowError[];
  preview: SupplierTransactionPreviewItem[];
};

export type VehicleHistoryDryRunResponse = {
  totalFiles: number;
  validFiles: number;
  invalidFiles: number;
  skippedFiles: number;
  totalVehicles: number;
  newVehicles: number;
  existingVehicles: number;
  totalVisits: number;
  totalOperations: number;
  warnings: string[];
  errors: MigrationRowError[];
  preview: VehicleHistoryPreviewItem[];
};

export type ScreenStockImportResponse = {
  batchId: string;
  total: number;
  success: number;
  skipped: number;
  error: number;
};

export type MultimediaStockImportResponse = ScreenStockImportResponse;

export type SoundStockImportResponse = ScreenStockImportResponse;

export type SoundOffersImportResponse = ScreenStockImportResponse;

export type SupplierImportResponse = ScreenStockImportResponse;

export type SupplierTransactionImportResponse = ScreenStockImportResponse;

export type VehicleHistoryImportResponse = ScreenStockImportResponse;

export type SpecialPaymentMigrationPreviewItem = {
  file: string;
  section: string;
  masterName: string | null;
  date: string | null;
  amount: string | null;
  description: string | null;
  status: "NEW" | "EXISTING" | "SKIPPED" | "ERROR";
};

export type SpecialPaymentsDryRunResponse = {
  totalFiles: number;
  validFiles: number;
  invalidFiles: number;
  personnelPayments: number;
  loanPayments: number;
  invoicePayments: number;
  expenseRecords: number;
  sgkRecords: number;
  mealRecords: number;
  skippedCustomRecords: number;
  warnings: string[];
  errors: MigrationRowError[];
  preview: SpecialPaymentMigrationPreviewItem[];
};

export type SpecialPaymentsImportResponse = {
  batchId: string;
  batchIds: string[];
  total: number;
  success: number;
  skipped: number;
  error: number;
};

export type SupplierListItem = {
  id: string;
  name: string;
  currency: string;
};
