import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "../../../generated/prisma/client.js";
import { convertSupplierPayment, istanbulDate } from "./payment-conversion.js";
import { parseUsdRateXml, getUsdExchangeRate } from "../exchange-rate/exchange-rate.service.js";
import type { UsdExchangeRateDto } from "../exchange-rate/exchange-rate.types.js";

const rate = (value = "40.0000"): UsdExchangeRateDto => ({
  base: "USD",
  quote: "TRY",
  rate: value,
  rateType: "FOREX_SELLING",
  effectiveDate: "2026-09-11",
  fetchedAt: "2026-09-11T12:00:00Z",
  isStale: false,
});
const xml = (date = "11.09.2026", english = "09/11/2026", value = "48.5178") =>
  `<Tarih_Date Tarih="${date}" Date="${english}"><Currency CurrencyCode="USD"><ForexSelling>${value}</ForexSelling></Currency></Tarih_Date>`;

test("14000 TRY converts to 350 USD while retaining the original reporting amount", () => {
  const result = convertSupplierPayment(new Prisma.Decimal(14000), "USD", rate());
  assert.equal(result.amount.toFixed(2), "350.00");
  assert.equal(result.currency, "USD");
  assert.equal(result.sourceAmount?.toFixed(2), "14000.00");
  assert.equal(result.sourceCurrency, "TRY");
});
test("actual quoted rate uses half-up cents without round-trip reporting drift", () => {
  const result = convertSupplierPayment(new Prisma.Decimal(14000), "USD", rate("48.5178"));
  assert.equal(result.amount.toFixed(2), "288.55");
  assert.notEqual(result.amount.mul("48.5178").toFixed(2), "14000.00");
  assert.equal(result.sourceAmount?.toFixed(2), "14000.00");
  assert.equal(
    convertSupplierPayment(new Prisma.Decimal("1.01"), "USD", rate("2.0000")).amount.toFixed(2),
    "0.51",
  );
});
test("TRY supplier needs no exchange rate", () => {
  const result = convertSupplierPayment(new Prisma.Decimal(14000), "TRY", null);
  assert.equal(result.amount.toFixed(2), "14000.00");
  assert.equal(result.exchangeRate, null);
});
test("missing, nonfinite, nonpositive and zero-rounded values are rejected", () => {
  for (const value of ["0", "-1", "NaN", "Infinity"])
    assert.throws(() => convertSupplierPayment(new Prisma.Decimal(14000), "USD", rate(value)));
  assert.throws(() => convertSupplierPayment(new Prisma.Decimal(14000), "USD", null));
  assert.throws(() => convertSupplierPayment(new Prisma.Decimal("0.01"), "USD", rate("48.5178")));
  assert.throws(() => convertSupplierPayment(new Prisma.Decimal("1000000000000"), "TRY", null));
});
test("TCMB Turkish and English header dates both mean September 11", () => {
  assert.equal(parseUsdRateXml(xml()).effectiveDate, "2026-09-11");
  assert.equal(
    parseUsdRateXml(xml().replace('Tarih="11.09.2026"', "")).effectiveDate,
    "2026-09-11",
  );
});
test("Istanbul date respects the UTC day boundary", () => {
  assert.equal(istanbulDate(new Date("2026-09-10T21:30:00Z")), "2026-09-11");
});
test("historical rates walk backwards only for missing publications", async (t) => {
  const urls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    urls.push(url);
    return url.endsWith("04092026.xml")
      ? new Response(xml("04.09.2026", "09/04/2026"))
      : new Response("", { status: 404 });
  });
  const result = await getUsdExchangeRate("2026-09-06");
  assert.equal(result.effectiveDate, "2026-09-04");
  assert.equal(urls.length, 3);
});
test("historical network failures never substitute today's rate", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    throw new Error("offline");
  });
  await assert.rejects(() => getUsdExchangeRate("2026-09-03"), /TCMB kuru alinamadi/);
  assert.equal(calls, 1);
});
test("historical missing-publication search is bounded", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return new Response("", { status: 404 });
  });
  await assert.rejects(() => getUsdExchangeRate("2026-08-01"), /uygun TCMB kuru/);
  assert.equal(calls, 15);
});
