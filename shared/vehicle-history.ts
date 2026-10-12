export const historyOperationLabels: Record<string, string> = {
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
export const historyPaymentLabels: Record<string, string> = {
  CASH: "Nakit",
  CREDIT_CARD: "Kredi Kartı",
  BANK_TRANSFER: "Havale",
  MAIL_ORDER: "Mail Order",
};
export type HistoryOption = { value: string; label: string };
const optionsFromLabels = (labels: Record<string, string>): HistoryOption[] =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));
const presence = [
  { value: "present", label: "Bilgisi var" },
  { value: "missing", label: "Bilgisi eksik" },
] as const;
const relationPresence = [
  { value: "present", label: "Kaydı var" },
  { value: "missing", label: "Kaydı yok" },
] as const;
export const historyRecordDateLabels: Record<string, string> = {
  vehicleCreatedAt: "Araç oluşturulma",
  vehicleUpdatedAt: "Araç güncellenme",
  customerCreatedAt: "Müşteri oluşturulma",
  customerUpdatedAt: "Müşteri güncellenme",
  visitCreatedAt: "Ziyaret oluşturulma",
  operationCreatedAt: "İşlem oluşturulma",
  operationUpdatedAt: "İşlem güncellenme",
};
type FieldDefinition = {
  key: string;
  label: string;
  group: string;
  kind: "text" | "date" | "number" | "money" | "select" | "choice";
  maxLength?: number;
  options?: readonly HistoryOption[];
};
export const historyFields = [
  { key: "search", label: "Genel arama", group: "search", kind: "text", maxLength: 150 },
  { key: "brand", label: "Araç markası", group: "basic", kind: "choice", maxLength: 100 },
  { key: "model", label: "Araç modeli", group: "basic", kind: "choice", maxLength: 100 },
  {
    key: "operationType",
    label: "İşlem türü",
    group: "basic",
    kind: "select",
    options: optionsFromLabels(historyOperationLabels),
  },
  {
    key: "paymentMethod",
    label: "Ödeme yöntemi",
    group: "basic",
    kind: "select",
    options: optionsFromLabels(historyPaymentLabels),
  },
  { key: "dateFrom", label: "İşlem tarihi başlangıç", group: "basic", kind: "date" },
  { key: "dateTo", label: "İşlem tarihi bitiş", group: "basic", kind: "date" },
  { key: "plate", label: "Plaka", group: "vehicle", kind: "text", maxLength: 20 },
  {
    key: "brandState",
    label: "Marka bilgisi",
    group: "vehicle",
    kind: "select",
    options: presence,
  },
  {
    key: "modelState",
    label: "Model bilgisi",
    group: "vehicle",
    kind: "select",
    options: presence,
  },
  {
    key: "customerFirstName",
    label: "Müşteri adı",
    group: "customer",
    kind: "text",
    maxLength: 100,
  },
  {
    key: "customerLastName",
    label: "Müşteri soyadı",
    group: "customer",
    kind: "text",
    maxLength: 100,
  },
  {
    key: "customerPhone",
    label: "Müşteri telefonu",
    group: "customer",
    kind: "text",
    maxLength: 30,
  },
  { key: "customerNote", label: "Müşteri notu", group: "customer", kind: "text", maxLength: 500 },
  {
    key: "customerState",
    label: "Müşteri kaydı",
    group: "customer",
    kind: "select",
    options: relationPresence,
  },
  { key: "arrivalFrom", label: "Geliş tarihi başlangıç", group: "visit", kind: "date" },
  { key: "arrivalTo", label: "Geliş tarihi bitiş", group: "visit", kind: "date" },
  { key: "visitNote", label: "Ziyaret notu", group: "visit", kind: "text", maxLength: 500 },
  {
    key: "description",
    label: "İşlem açıklaması",
    group: "operation",
    kind: "text",
    maxLength: 150,
  },
  { key: "operationNote", label: "İşlem notu", group: "operation", kind: "text", maxLength: 500 },
  {
    key: "operationTypeState",
    label: "İşlem türü bilgisi",
    group: "operation",
    kind: "select",
    options: presence,
  },
  {
    key: "currency",
    label: "Para birimi",
    group: "payment",
    kind: "select",
    options: [
      { value: "TRY", label: "Türk lirası (TRY)" },
      { value: "USD", label: "ABD doları (USD)" },
    ],
  },
  { key: "minPrice", label: "Minimum ücret", group: "payment", kind: "money" },
  { key: "maxPrice", label: "Maksimum ücret", group: "payment", kind: "money" },
  {
    key: "mailOrderSupplierId",
    label: "Mail order tedarikçisi",
    group: "relations",
    kind: "choice",
    maxLength: 100,
  },
  {
    key: "supplierState",
    label: "Tedarikçi ilişkisi",
    group: "relations",
    kind: "select",
    options: relationPresence,
  },
  {
    key: "multimediaProductId",
    label: "Multimedya ürünü",
    group: "relations",
    kind: "choice",
    maxLength: 100,
  },
  {
    key: "multimediaState",
    label: "Multimedya ilişkisi",
    group: "relations",
    kind: "select",
    options: relationPresence,
  },
  {
    key: "screenProductId",
    label: "Ekran ürünü",
    group: "relations",
    kind: "choice",
    maxLength: 100,
  },
  {
    key: "screenState",
    label: "Ekran ilişkisi",
    group: "relations",
    kind: "select",
    options: relationPresence,
  },
  {
    key: "soundOfferId",
    label: "Ses sistemi teklifi",
    group: "relations",
    kind: "choice",
    maxLength: 100,
  },
  {
    key: "soundOfferState",
    label: "Ses teklifi ilişkisi",
    group: "relations",
    kind: "select",
    options: relationPresence,
  },
  { key: "vehicleId", label: "Araç ID", group: "records", kind: "text", maxLength: 100 },
  { key: "visitId", label: "Ziyaret ID", group: "records", kind: "text", maxLength: 100 },
  { key: "operationId", label: "İşlem ID", group: "records", kind: "text", maxLength: 100 },
  { key: "customerId", label: "Müşteri ID", group: "records", kind: "text", maxLength: 100 },
  { key: "minRevision", label: "Minimum revizyon", group: "records", kind: "number" },
  { key: "maxRevision", label: "Maksimum revizyon", group: "records", kind: "number" },
  {
    key: "recordDateField",
    label: "Kayıt tarihi alanı",
    group: "records",
    kind: "select",
    options: optionsFromLabels(historyRecordDateLabels),
  },
  { key: "recordDateFrom", label: "Kayıt tarihi başlangıç", group: "records", kind: "date" },
  { key: "recordDateTo", label: "Kayıt tarihi bitiş", group: "records", kind: "date" },
] as const satisfies readonly FieldDefinition[];
export type HistoryFilterKey = (typeof historyFields)[number]["key"];
export type HistoryField = FieldDefinition & { key: HistoryFilterKey };
export const historyFieldDefinitions: readonly HistoryField[] = historyFields;
export type HistoryFilters = Partial<Record<HistoryFilterKey, string>>;
export type HistorySearch = HistoryFilters & { page?: number };
export type VehicleHistoryFilterOptions = {
  brands: string[];
  models: { brand: string | null; model: string }[];
  mailOrderSupplierId: HistoryOption[];
  multimediaProductId: HistoryOption[];
  screenProductId: HistoryOption[];
  soundOfferId: HistoryOption[];
};
// Legacy imports and Turkish business inputs can spell the same brand with I/İ/ı/i.
export const normalizeVehicleLabel = (value: string) =>
  value.trim().replace(/[İı]/g, "i").toUpperCase();

export const historyOptionsForField = (
  field: HistoryField,
  filters: HistoryFilters,
  options?: VehicleHistoryFilterOptions,
): readonly HistoryOption[] => {
  if (field.options) return field.options;
  if (!options) return [];
  if (field.key === "brand") return options.brands.map((value) => ({ value, label: value }));
  if (field.key === "model")
    return [
      ...new Set(
        options.models
          .filter((item) => !filters.brand || item.brand === normalizeVehicleLabel(filters.brand))
          .map((item) => item.model),
      ),
    ].map((value) => ({ value, label: value }));
  if (
    field.key === "mailOrderSupplierId" ||
    field.key === "multimediaProductId" ||
    field.key === "screenProductId" ||
    field.key === "soundOfferId"
  )
    return options[field.key];
  return [];
};
export const readHistorySearch = (query: Record<string, unknown>): HistorySearch => {
  const filters: HistorySearch = {};
  for (const { key } of historyFields) {
    const raw = query[key];
    const value = typeof raw === "number" && Number.isFinite(raw) ? String(raw) : raw;
    if (typeof value === "string" && value.trim()) filters[key] = value.trim();
  }
  const page = Number(query.page);
  if (Number.isSafeInteger(page) && page > 1) filters.page = page;
  return filters;
};
export const historyQueryString = (filters: HistorySearch, includePage = true) => {
  const params = new URLSearchParams();
  for (const { key } of historyFields) if (filters[key]) params.set(key, filters[key]!);
  if (includePage) {
    params.set("page", String(filters.page ?? 1));
    params.set("pageSize", "20");
  }
  return params.toString();
};
