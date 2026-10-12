import assert from "node:assert/strict";
import { test } from "node:test";
import { buildHistoryFilter, vehicleLabelOptions } from "./history-filters.js";
import { HttpError } from "../../lib/http-error.js";
import { historyQueryString, readHistorySearch } from "../../../shared/vehicle-history.js";

const labels = [
  { brand: "BMW", model: "320i" },
  { brand: " bmw ", model: " 320I " },
  { brand: "Fiat", model: "Egea" },
  { brand: null, model: null },
  { brand: "  ", model: "" },
  { brand: null, model: "Unknown" },
];
const badRequest = (query: Record<string, unknown>) =>
  assert.throws(
    () => buildHistoryFilter(query, labels),
    (error: unknown) => error instanceof HttpError && error.statusCode === 400,
  );

test("global search includes brand/model and normalized plate without losing customer search", () => {
  const { where, page, pageSize } = buildHistoryFilter({ search: " 34 abc " });
  assert.equal(where.deletedAt, null);
  assert.equal(page, 1);
  assert.equal(pageSize, 20);
  const serialized = JSON.stringify(where);
  assert.ok(serialized.includes('"brand":{"contains":"34 abc","mode":"insensitive"}'));
  assert.ok(serialized.includes('"model":{"contains":"34 abc","mode":"insensitive"}'));
  assert.ok(serialized.includes('"normalizedPlate":{"contains":"34ABC"'));
  for (const field of ["firstName", "lastName", "phone"])
    assert.ok(serialized.includes(`"${field}"`));
});

test("exact vehicle labels match all case/whitespace variants and combine filters with AND", () => {
  const { where } = buildHistoryFilter(
    { search: "Ali", brand: "bmw", model: "320i", paymentMethod: "CREDIT_CARD" },
    labels,
  );
  const conditions = where.AND as Record<string, unknown>[];
  assert.deepEqual(conditions[1], { vehicle: { brand: { in: ["BMW", " bmw "] } } });
  assert.deepEqual(conditions[2], { vehicle: { model: { in: ["320i", " 320I "] } } });
  assert.deepEqual(conditions[3], { paymentMethod: "CREDIT_CARD" });
  assert.deepEqual(buildHistoryFilter({ brand: "Missing" }, labels).where.AND, [
    { vehicle: { brand: { in: [] } } },
  ]);
});

test("Turkish dotted I business inputs find legacy ASCII brand/model spellings", () => {
  const query = JSON.stringify(buildHistoryFilter({ search: "FİAT" }, labels).where);
  assert.ok(query.includes('"brand":{"in":["Fiat"]}'));
  const exact = buildHistoryFilter({ brand: "FİAT" }, labels);
  assert.deepEqual(exact.where.AND, [{ vehicle: { brand: { in: ["Fiat"] } } }]);
});

test("brand/model options deduplicate normalized labels and preserve model-brand associations", () => {
  const options = vehicleLabelOptions(labels);
  assert.deepEqual(options.brands, ["BMW", "FIAT"]);
  assert.equal(options.models.filter((item) => item.model === "320I").length, 1);
  assert.ok(options.models.some((item) => item.brand === null && item.model === "UNKNOWN"));
  assert.ok(!options.models.some((item) => item.model === ""));
});

test("missing labels include null, empty and whitespace; present is their complement", () => {
  const missing = { OR: [{ brand: null }, { brand: { in: ["  "] } }] };
  assert.deepEqual(buildHistoryFilter({ brandState: "missing" }, labels).where.AND, [
    { vehicle: missing },
  ]);
  assert.deepEqual(buildHistoryFilter({ brandState: "present" }, labels).where.AND, [
    { vehicle: { NOT: missing } },
  ]);
  assert.deepEqual(buildHistoryFilter({ modelState: "missing" }, labels).where.AND, [
    { vehicle: { OR: [{ model: null }, { model: { in: [""] } }] } },
  ]);
});

test("customer fields are scoped to the operation visit and can select visits without customers", () => {
  const { where } = buildHistoryFilter({
    customerFirstName: "Ali",
    customerPhone: "555",
    customerNote: "firma",
    customerId: "customer-1",
  });
  assert.deepEqual(where.AND, [
    { visit: { customer: { firstName: { contains: "Ali", mode: "insensitive" } } } },
    { visit: { customer: { phone: { contains: "555", mode: "insensitive" } } } },
    { visit: { customer: { note: { contains: "firma", mode: "insensitive" } } } },
    { visit: { customerId: "customer-1" } },
  ]);
  assert.deepEqual(buildHistoryFilter({ customerState: "missing" }).where.AND, [
    { visit: { customerId: null } },
  ]);
});

test("date range includes both Istanbul calendar days with an exclusive next-day end", () => {
  const { where } = buildHistoryFilter({ dateFrom: "2026-10-01", dateTo: "2026-10-12" });
  assert.deepEqual(where.AND, [
    {
      operationAt: { gte: new Date("2026-09-30T21:00:00Z"), lt: new Date("2026-10-12T21:00:00Z") },
    },
  ]);
  assert.deepEqual(buildHistoryFilter({ arrivalTo: "2024-02-29" }).where.AND, [
    { visit: { arrivalAt: { lt: new Date("2024-02-29T21:00:00Z") } } },
  ]);
  badRequest({ dateFrom: "2026-02-30" });
  badRequest({ dateFrom: "2026-10-13", dateTo: "2026-10-12" });
  badRequest({ dateFrom: "not-a-date" });
});

test("price bounds use decimals, allow zero and require an explicit currency", () => {
  const { where } = buildHistoryFilter({ currency: "TRY", minPrice: "0", maxPrice: "999.99" });
  assert.ok(Array.isArray(where.AND));
  assert.deepEqual(where.AND[0], { currency: "TRY" });
  const serialized = JSON.stringify(where);
  assert.ok(serialized.includes('"gte":"0"'));
  assert.ok(serialized.includes('"lte":"999.99"'));
  for (const query of [
    { minPrice: "10" },
    { currency: "EUR" },
    { currency: "TRY", minPrice: "-1" },
    { currency: "TRY", minPrice: "1.001" },
    { currency: "TRY", minPrice: "1e3" },
    { currency: "TRY", minPrice: "100", maxPrice: "99" },
    { currency: "TRY", maxPrice: "1000000000000" },
  ])
    badRequest(query);
});

test("advanced notes, linked records, IDs and revisions remain independent conditions", () => {
  const { where } = buildHistoryFilter({
    operationNote: "kontrol",
    visitNote: "randevu",
    description: "kamera",
    multimediaProductId: "product-1",
    supplierState: "missing",
    screenState: "present",
    soundOfferId: "offer-1",
    operationId: "operation-1",
    vehicleId: "vehicle-1",
    visitId: "visit-1",
    minRevision: "2",
    maxRevision: "5",
  });
  const conditions = where.AND as Record<string, unknown>[];
  for (const expected of [
    { id: "operation-1" },
    { vehicleId: "vehicle-1" },
    { visitId: "visit-1" },
    { multimediaProductId: "product-1" },
    { mailOrderSupplierId: null },
    { screenProductId: { not: null } },
    { soundOfferId: "offer-1" },
    { revision: { gte: 2, lte: 5 } },
  ]) {
    assert.ok(
      conditions.some((condition) => JSON.stringify(condition) === JSON.stringify(expected)),
    );
  }
  badRequest({ minRevision: "0" });
  badRequest({ minRevision: "3", maxRevision: "2" });
});

test("record dates use the selected entity path and cannot be applied without a field", () => {
  const range = { gte: new Date("2026-10-11T21:00:00Z") };
  assert.deepEqual(
    buildHistoryFilter({ recordDateField: "customerCreatedAt", recordDateFrom: "2026-10-12" }).where
      .AND,
    [{ visit: { customer: { createdAt: range } } }],
  );
  assert.deepEqual(
    buildHistoryFilter({ recordDateField: "vehicleUpdatedAt", recordDateFrom: "2026-10-12" }).where
      .AND,
    [{ vehicle: { updatedAt: range } }],
  );
  badRequest({ recordDateFrom: "2026-10-12" });
  badRequest({ recordDateField: "deletedAt" });
});

test("invalid scalar, enum, length and pagination inputs return 400 instead of reaching the DB", () => {
  for (const query of [
    { brand: ["BMW"] },
    { customerPhone: { contains: "x" } },
    { search: "x".repeat(151) },
    { operationType: "BAD" },
    { paymentMethod: "BAD" },
    { brandState: "BAD" },
    { page: "-1" },
    { page: "1.5" },
    { pageSize: "101" },
    { page: "2147483647", pageSize: "100" },
  ])
    badRequest(query);
});

test("URL round-trip preserves all filters and page, drops unrelated parameters and trims values", () => {
  const search = readHistorySearch({
    brand: " BMW ",
    model: "320i",
    customerNote: "İstanbul & firma",
    currency: "USD",
    minPrice: "10.50",
    recordDateField: "visitCreatedAt",
    page: "3",
    unrelated: "discard",
  });
  const encoded = historyQueryString(search);
  const restored = readHistorySearch(Object.fromEntries(new URLSearchParams(encoded)));
  assert.deepEqual(restored, search);
  assert.ok(!encoded.includes("unrelated"));
  assert.ok(!historyQueryString(search, false).includes("page="));
  assert.deepEqual(readHistorySearch({ search: " ", page: "NaN", brand: ["BMW"] }), {});
  assert.deepEqual(
    readHistorySearch({ minPrice: 1000, minRevision: 2, customerPhone: 5551112233 }),
    {
      customerPhone: "5551112233",
      minPrice: "1000",
      minRevision: "2",
    },
  );
});
