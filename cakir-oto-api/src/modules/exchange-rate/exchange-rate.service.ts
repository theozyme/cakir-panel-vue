import { XMLParser } from "fast-xml-parser";
import { Prisma } from "../../../generated/prisma/client.js";
import { HttpError } from "../../lib/http-error.js";
import type { UsdExchangeRateDto } from "./exchange-rate.types.js";

const freshCacheMs = 15 * 60 * 1000;
const fallbackCacheMs = 24 * 60 * 60 * 1000;
type CacheEntry = UsdExchangeRateDto & { fetchedAtMs: number };
const cache = new Map<string, CacheEntry>();
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: true,
});
const todayKey = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const validateRateDate = (value: unknown): string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new HttpError(400, "Kur tarihi YYYY-MM-DD olmali");
  const parsed = new Date(`${value}T00:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value ||
    value > todayKey()
  )
    throw new HttpError(400, "Kur tarihi gecersiz veya gelecekte");
  return value;
};

export const parseUsdRateXml = (xml: string): Omit<UsdExchangeRateDto, "fetchedAt" | "isStale"> => {
  const document = parser.parse(xml) as {
    Tarih_Date?: { Tarih?: string; Date?: string; Currency?: unknown };
  };
  const header = document.Tarih_Date;
  // Tarih is DD.MM.YYYY; the English Date attribute is MM/DD/YYYY.
  const tr = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(header?.Tarih ?? ""));
  const en = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(header?.Date ?? ""));
  const effectiveDate = tr ? `${tr[3]}-${tr[2]}-${tr[1]}` : en ? `${en[3]}-${en[1]}-${en[2]}` : "";
  validateRateDate(effectiveDate);
  const currencies = Array.isArray(header?.Currency) ? header.Currency : [header?.Currency];
  const usd = currencies.find(
    (item) => item && typeof item === "object" && item.CurrencyCode === "USD",
  ) as { ForexSelling?: unknown } | undefined;
  if (typeof usd?.ForexSelling !== "string" && typeof usd?.ForexSelling !== "number")
    throw new Error("TCMB USD ForexSelling bulunamadi");
  const rate = new Prisma.Decimal(String(usd.ForexSelling));
  if (!rate.isFinite() || !rate.greaterThan(0) || !rate.toDecimalPlaces(4).greaterThan(0))
    throw new Error("TCMB USD ForexSelling gecersiz");
  return {
    base: "USD",
    quote: "TRY",
    rate: rate.toFixed(4),
    rateType: "FOREX_SELLING",
    effectiveDate,
  };
};

const readXml = async (url: string): Promise<string | null> => {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(5_000),
    headers: { Accept: "application/xml,text/xml" },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`TCMB HTTP ${response.status}`);
  return response.text();
};
const asDto = (
  { fetchedAtMs: _ignored, ...entry }: CacheEntry,
  isStale: boolean,
): UsdExchangeRateDto => ({ ...entry, isStale });

export const getUsdExchangeRate = async (date?: string): Promise<UsdExchangeRateDto> => {
  const requestedDate = date === undefined ? todayKey() : validateRateDate(date);
  const historical = requestedDate !== todayKey();
  const key = historical ? requestedDate : `today:${requestedDate}`;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && (historical || now - cached.fetchedAtMs < freshCacheMs))
    return asDto(cached, false);
  try {
    let parsed: ReturnType<typeof parseUsdRateXml> | null = null;
    if (!historical) {
      const xml = await readXml("https://www.tcmb.gov.tr/kurlar/today.xml");
      if (!xml) throw new Error("Guncel TCMB kuru bulunamadi");
      parsed = parseUsdRateXml(xml);
    } else {
      for (let offset = 0; offset <= 14; offset++) {
        const day = new Date(`${requestedDate}T00:00:00Z`);
        day.setUTCDate(day.getUTCDate() - offset);
        const [year, month, dd] = day.toISOString().slice(0, 10).split("-");
        const xml = await readXml(
          `https://www.tcmb.gov.tr/kurlar/${year}${month}/${dd}${month}${year}.xml`,
        );
        if (xml === null) continue;
        parsed = parseUsdRateXml(xml);
        break;
      }
    }
    if (!parsed || parsed.effectiveDate > requestedDate)
      throw new Error("Islem tarihine uygun TCMB kuru bulunamadi");
    const entry: CacheEntry = {
      ...parsed,
      fetchedAt: new Date().toISOString(),
      fetchedAtMs: now,
      isStale: false,
    };
    cache.set(key, entry);
    if (cache.size > 512) cache.delete(cache.keys().next().value!);
    return asDto(entry, false);
  } catch (error) {
    if (cached && now - cached.fetchedAtMs < fallbackCacheMs) return asDto(cached, true);
    throw new HttpError(
      503,
      error instanceof Error ? `TCMB kuru alinamadi: ${error.message}` : "TCMB kuru alinamadi",
    );
  }
};
