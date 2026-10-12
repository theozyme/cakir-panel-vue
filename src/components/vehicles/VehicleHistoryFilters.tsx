import { useState } from "react";
import { Check, ChevronsUpDown, LoaderCircle, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  historyFieldDefinitions,
  historyOptionsForField,
  normalizeVehicleLabel,
  type HistoryField,
  type HistoryFilterKey,
  type HistoryFilters,
  type HistoryOption,
  type VehicleHistoryFilterOptions,
} from "../../../shared/vehicle-history";

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary";

function FilterChoice({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly HistoryOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          className={`${inputClass} flex items-center justify-between gap-2 text-left`}
        >
          <span className="truncate">{selected?.label ?? (value || "Tümü")}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0">
        <Command
          filter={(value, search) =>
            normalizeVehicleLabel(value).includes(normalizeVehicleLabel(search)) ? 1 : 0
          }
        >
          <CommandInput
            placeholder={`${label} ara...`}
            aria-label={`${label} seçeneklerinde ara`}
          />
          <CommandList>
            <CommandEmpty>Eşleşen seçenek bulunamadı.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="Tümü"
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <Check className={`h-4 w-4 ${value ? "opacity-0" : "opacity-100"}`} /> Tümü
              </CommandItem>
              {value && !selected && (
                <CommandItem value={value} onSelect={() => setOpen(false)}>
                  <Check className="h-4 w-4" /> {value}
                </CommandItem>
              )}
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.value}`}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`h-4 w-4 ${value === option.value ? "opacity-100" : "opacity-0"}`}
                  />{" "}
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const advancedGroups = [
  ["vehicle", "Araç bilgileri"],
  ["customer", "Müşteri bilgileri"],
  ["visit", "Ziyaret bilgileri"],
  ["operation", "İşlem bilgileri"],
  ["payment", "Ücret ve para birimi"],
  ["relations", "Tedarikçi ve ürün ilişkileri"],
  ["records", "Kayıt bilgileri ve tarihleri"],
] as const;

export function VehicleHistoryFilters({
  filters,
  options,
  loading,
  error,
  onRetry,
  onApply,
  onClear,
}: {
  filters: HistoryFilters;
  options?: VehicleHistoryFilterOptions;
  loading: boolean;
  error?: string;
  onRetry: () => void;
  onApply: (filters: HistoryFilters) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState<HistoryFilters>(filters);
  const [validationError, setValidationError] = useState("");
  const update = (key: HistoryFilterKey, value: string) => {
    setValidationError("");
    setDraft((previous) => {
      const next = { ...previous, [key]: value || undefined };
      if (key === "brand") {
        next.model = undefined;
        if (value) next.brandState = undefined;
      }
      if (key === "model" && value) next.modelState = undefined;
      if (key === "brandState" && value === "missing") {
        next.brand = undefined;
        next.model = undefined;
      }
      if (key === "modelState" && value === "missing") next.model = undefined;
      if (key === "operationType" && value) next.operationTypeState = undefined;
      if (key === "operationTypeState" && value === "missing") next.operationType = undefined;
      return next;
    });
  };
  const renderField = (field: HistoryField) => {
    const value = draft[field.key] ?? "";
    const id = `vehicle-filter-${field.key}`;
    return (
      <div key={field.key} className="min-w-0 space-y-1.5">
        <label htmlFor={id} className="block text-xs font-semibold text-muted-foreground">
          {field.label}
        </label>
        {field.kind === "choice" ? (
          <FilterChoice
            id={id}
            label={field.label}
            value={value}
            options={historyOptionsForField(field, draft, options)}
            onChange={(value) => update(field.key, value)}
          />
        ) : field.kind === "select" ? (
          <select
            id={id}
            value={value}
            onChange={(event) => update(field.key, event.target.value)}
            className={inputClass}
          >
            <option value="">Tümü</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <Input
            id={id}
            type={field.kind === "date" ? "date" : field.kind === "number" ? "number" : "text"}
            min={field.kind === "number" ? 1 : undefined}
            step={field.kind === "number" ? 1 : undefined}
            inputMode={field.kind === "money" ? "decimal" : undefined}
            maxLength={field.maxLength}
            value={value}
            placeholder={field.kind === "money" ? "Örn. 1500,00" : undefined}
            onChange={(event) => update(field.key, event.target.value)}
            className={inputClass}
          />
        )}
      </div>
    );
  };
  const apply = () => {
    const next = { ...draft };
    for (const key of ["minPrice", "maxPrice"] as const)
      if (next[key]) next[key] = next[key]!.trim().replace(",", ".");
    if ((next.minPrice || next.maxPrice) && !next.currency) {
      setValidationError("Ücret aralığı için para birimi seçin.");
      return;
    }
    if ((next.recordDateFrom || next.recordDateTo) && !next.recordDateField) {
      setValidationError("Kayıt tarihi alanını seçin.");
      return;
    }
    for (const [from, to, label] of [
      ["dateFrom", "dateTo", "İşlem tarihi"],
      ["arrivalFrom", "arrivalTo", "Geliş tarihi"],
      ["recordDateFrom", "recordDateTo", "Kayıt tarihi"],
    ] as const) {
      if (next[from] && next[to] && next[from]! > next[to]!) {
        setValidationError(`${label}: başlangıç bitişten sonra olamaz.`);
        return;
      }
    }
    for (const key of ["minPrice", "maxPrice"] as const) {
      if (next[key] && !/^\d{1,12}(?:\.\d{1,2})?$/.test(next[key]!)) {
        setValidationError("Ücret sıfır veya pozitif, en fazla iki ondalıklı bir tutar olmalı.");
        return;
      }
    }
    if (next.minPrice && next.maxPrice && Number(next.minPrice) > Number(next.maxPrice)) {
      setValidationError("Minimum ücret maksimum ücretten büyük olamaz.");
      return;
    }
    if (
      next.minRevision &&
      next.maxRevision &&
      Number(next.minRevision) > Number(next.maxRevision)
    ) {
      setValidationError("Minimum revizyon maksimumdan büyük olamaz.");
      return;
    }
    onApply(next);
  };
  return (
    <form
      id="vehicle-history-filters"
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
      className="mb-4 space-y-4 rounded-xl border border-border bg-muted/20 p-4"
    >
      <p className="text-xs text-muted-foreground">
        Seçilen filtrelerin tamamını sağlayan işlemler gösterilir. Tarihler İstanbul saatine
        göredir.
      </p>
      {loading && (
        <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Marka, model ve ürün seçenekleri
          yükleniyor...
        </p>
      )}
      {error && (
        <div role="alert" className="text-sm text-destructive">
          Filtre seçenekleri yüklenemedi: {error}{" "}
          <button type="button" onClick={onRetry} className="underline">
            Tekrar dene
          </button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {historyFieldDefinitions.filter((field) => field.group === "basic").map(renderField)}
      </div>
      <details
        className="rounded-lg border border-border bg-background/60 p-3"
        open={
          historyFieldDefinitions.some(
            (field) => field.group !== "basic" && field.group !== "search" && filters[field.key],
          ) || undefined
        }
      >
        <summary className="cursor-pointer text-sm font-semibold">Gelişmiş filtreler</summary>
        <div className="mt-4 space-y-5">
          {advancedGroups.map(([group, label]) => (
            <fieldset key={group}>
              <legend className="mb-2 text-sm font-semibold">{label}</legend>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {historyFieldDefinitions.filter((field) => field.group === group).map(renderField)}
              </div>
            </fieldset>
          ))}
        </div>
      </details>
      {validationError && (
        <p role="alert" className="text-sm text-destructive">
          {validationError}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Filtreleri uygula
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft({});
            setValidationError("");
            onClear();
          }}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-input bg-background px-4 text-sm font-semibold"
        >
          <X className="h-4 w-4" /> Filtreleri temizle
        </button>
      </div>
    </form>
  );
}
