import { XMLParser } from "fast-xml-parser";
import { Prisma } from "../../../generated/prisma/client.js";

import { HttpError } from "../../lib/http-error.js";
import type { UsdExchangeRateDto } from "./exchange-rate.types.js";

const tcmbUrl = "https://www.tcmb.gov.tr/kurlar/today.xml";
const freshCacheMs = 15 * 60 * 1000;
const fallbackCacheMs = 24 * 60 * 60 * 1000;

type CacheEntry = Omit<UsdExchangeRateDto, "isStale"> & {
  fetchedAtMs: number;
};

let cachedRate: CacheEntry | null = null;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: true,
});

const formatEffectiveDate = (value: unknown): string => {
  if (typeof value !== "string") return "";

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value.trim();
};

const fromCache = (entry: CacheEntry, isStale: boolean): UsdExchangeRateDto => ({
  base: entry.base,
  quote: entry.quote,
  rate: entry.rate,
  rateType: entry.rateType,
  effectiveDate: entry.effectiveDate,
  fetchedAt: entry.fetchedAt,
  isStale,
});

export const getUsdExchangeRate = async (): Promise<UsdExchangeRateDto> => {
  const now = Date.now();

  if (cachedRate && now - cachedRate.fetchedAtMs < freshCacheMs) {
    return fromCache(cachedRate, false);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(tcmbUrl, {
      signal: controller.signal,
      headers: {
        Accept: "application/xml,text/xml",
      },
    });

    if (!response.ok) {
      throw new Error(`TCMB HTTP ${response.status}`);
    }

    const xml = await response.text();
    const document = parser.parse(xml) as {
      Tarih_Date?: {
        Date?: unknown;
        Currency?: unknown;
      };
    };
    const currencyValue = document.Tarih_Date?.Currency;
    const currencies = Array.isArray(currencyValue) ? currencyValue : [currencyValue];
    const usd = currencies.find((item): item is Record<string, unknown> =>
      Boolean(
        item &&
        typeof item === "object" &&
        (item as { CurrencyCode?: unknown }).CurrencyCode === "USD",
      ),
    );
    const rawRate = usd?.ForexSelling;

    if (typeof rawRate !== "string" && typeof rawRate !== "number") {
      throw new Error("TCMB USD ForexSelling bulunamadi");
    }

    const rate = new Prisma.Decimal(String(rawRate));

    if (!rate.isPositive()) {
      throw new Error("TCMB USD ForexSelling gecersiz");
    }

    const fetchedAt = new Date();
    cachedRate = {
      base: "USD",
      quote: "TRY",
      rate: rate.toFixed(4),
      rateType: "FOREX_SELLING",
      effectiveDate: formatEffectiveDate(document.Tarih_Date?.Date),
      fetchedAt: fetchedAt.toISOString(),
      fetchedAtMs: fetchedAt.getTime(),
    };

    return fromCache(cachedRate, false);
  } catch (error) {
    if (cachedRate && now - cachedRate.fetchedAtMs < fallbackCacheMs) {
      return fromCache(cachedRate, true);
    }

    throw new HttpError(
      503,
      error instanceof Error ? `TCMB kuru alinamadi: ${error.message}` : "TCMB kuru alinamadi",
    );
  } finally {
    clearTimeout(timeout);
  }
};
