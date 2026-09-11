import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "../../../generated/prisma/client.js";
import type { BusinessTransaction } from "../../lib/transaction.js";
import { convertSupplierPayment, emptyPaymentSnapshot } from "./payment-conversion.js";

// Unit tests use in-memory transaction doubles, never the configured live database.
process.env.DATABASE_URL = "postgresql://unit_test:unit_test@127.0.0.1:1/unit_test";
const { createVehicleOperationSupplierPayment, reconcileVehicleOperationSupplierPayment } =
  await import("../supplier/supplier.service.js");
const { supplierStateKey, preparePaymentRate } = await import("./payment-state.js");
const { getPrisma } = await import("../../lib/prisma.js");

const decimal = (value: string | number) => new Prisma.Decimal(value);
const date = new Date("2026-09-11T12:03:16.671Z");
function ledger() {
  const rows: any[] = [
    {
      id: "debt",
      supplierId: "supplier",
      type: "DEBT_INCREASE",
      amount: decimal(6000),
      balanceAfter: decimal(6000),
      transactionAt: new Date("2026-09-10T00:00:00Z"),
      voidedAt: null,
    },
    {
      id: "old-payment",
      supplierId: "supplier",
      type: "PAYMENT",
      amount: decimal(14000),
      balanceAfter: decimal(-8000),
      transactionAt: date,
      sourceType: "VEHICLE_OPERATION",
      sourceId: "operation",
      voidedAt: null,
    },
    {
      id: "later",
      supplierId: "supplier",
      type: "PAYMENT",
      amount: decimal(100),
      balanceAfter: decimal(-8100),
      transactionAt: new Date("2026-09-11T13:00:00Z"),
      voidedAt: null,
    },
  ];
  const filtered = (where: any) =>
    rows.filter(
      (r) =>
        (!where.supplierId || r.supplierId === where.supplierId) &&
        (!where.sourceId || r.sourceId === where.sourceId) &&
        (where.voidedAt !== null || r.voidedAt === null) &&
        (!where.transactionAt?.lt || r.transactionAt < where.transactionAt.lt) &&
        (!where.transactionAt?.gte || r.transactionAt >= where.transactionAt.gte),
    );
  const tx = {
    $queryRaw: async () => [{ id: "supplier" }],
    supplier: { findUnique: async () => ({ currency: "USD", isActive: true }) },
    supplierTransaction: {
      findFirst: async ({ where, orderBy }: any) => {
        const results = filtered(where).sort((a, b) => a.transactionAt - b.transactionAt);
        return (orderBy?.[0]?.transactionAt === "desc" ? results.at(-1) : results[0]) ?? null;
      },
      findMany: async ({ where }: any) =>
        filtered(where).sort((a, b) => a.transactionAt - b.transactionAt),
      findFirstOrThrow: async ({ where }: any) => {
        const row = filtered(where)[0];
        if (!row) throw new Error("Missing ledger row");
        return row;
      },
      update: async ({ where, data }: any) =>
        Object.assign(
          rows.find((r) => r.id === where.id),
          data,
        ),
      create: async ({ data }: any) => {
        const row = { id: "new-payment", voidedAt: null, ...data };
        rows.push(row);
        return row;
      },
    },
  } as unknown as BusinessTransaction;
  return { rows, tx };
}
const previous = {
  supplierId: "supplier",
  amount: decimal(14000),
  currency: "USD",
  transactionAt: date,
};
const rate = {
  base: "USD",
  quote: "TRY",
  rate: "48.5178",
  rateType: "FOREX_SELLING",
  effectiveDate: "2026-09-11",
  fetchedAt: "2026-09-11T12:00:00Z",
  isStale: false,
} as const;
test("legacy correction voids 14000 USD and recalculates all later balances with 288.55 USD", async () => {
  const { tx, rows } = ledger();
  const next = {
    supplierId: "supplier",
    transactionAt: date,
    ...convertSupplierPayment(decimal(14000), "USD", rate),
  };
  await reconcileVehicleOperationSupplierPayment({ tx, operationId: "operation", previous, next });
  assert.ok(rows.find((r) => r.id === "old-payment").voidedAt);
  assert.equal(rows.find((r) => r.id === "new-payment").balanceAfter.toFixed(2), "5711.45");
  assert.equal(rows.find((r) => r.id === "later").balanceAfter.toFixed(2), "5611.45");
  assert.equal(rows.find((r) => r.id === "new-payment").sourceAmount.toFixed(2), "14000.00");
});
test("deleting corrected operation restores the actual ledger effect", async () => {
  const { tx, rows } = ledger();
  const next = {
    supplierId: "supplier",
    transactionAt: date,
    ...convertSupplierPayment(decimal(14000), "USD", rate),
  };
  await reconcileVehicleOperationSupplierPayment({ tx, operationId: "operation", previous, next });
  await reconcileVehicleOperationSupplierPayment({
    tx,
    operationId: "operation",
    previous: next,
    next: null,
  });
  assert.equal(rows.find((r) => r.id === "later").balanceAfter.toFixed(2), "5900.00");
});
test("unchanged financial state compares equal despite note or fetch metadata changes", () => {
  const next = {
    supplierId: "supplier",
    transactionAt: date,
    ...convertSupplierPayment(decimal(14000), "USD", rate),
  };
  assert.equal(
    supplierStateKey(next),
    supplierStateKey({ ...next, exchangeRateFetchedAt: new Date() }),
  );
  assert.notEqual(supplierStateKey(next), supplierStateKey({ ...next, amount: decimal(500) }));
});
test("same-date edits retain the saved rate without fetching TCMB", async (t) => {
  const prisma = {
    supplier: { findUnique: async () => ({ currency: "USD", isActive: true }) },
    vehicleOperation: { findUnique: async () => ({ operationAt: date }) },
    supplierTransaction: {
      findFirst: async () => ({
        ...emptyPaymentSnapshot(),
        exchangeRate: decimal("48.5178"),
        exchangeRateDate: "2026-09-11",
        exchangeRateFetchedAt: date,
      }),
    },
  } as unknown as ReturnType<typeof getPrisma>;
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Must not fetch");
  });
  assert.equal(
    (
      await preparePaymentRate(
        "supplier",
        "TRY",
        date,
        "operation",
        { rate: "48.5178", effectiveDate: "2026-09-11" },
        prisma,
      )
    )?.rate,
    "48.5178",
  );
  await assert.rejects(
    () =>
      preparePaymentRate(
        "supplier",
        "TRY",
        date,
        "operation",
        { rate: "40.0000", effectiveDate: "2026-09-11" },
        prisma,
      ),
    /USD kuru degisti/,
  );
});

test("new backdated payment preserves its date and recalculates later movements", async () => {
  const { tx, rows } = ledger();
  rows.splice(
    rows.findIndex((r) => r.id === "old-payment"),
    1,
  );
  rows.find((r) => r.id === "later").balanceAfter = decimal(5900);
  const input = {
    tx,
    operationId: "new-operation",
    supplierId: "supplier",
    transactionAt: date,
    ...convertSupplierPayment(decimal(14000), "USD", { ...rate, rate: "40.0000" }),
  };
  const created = await createVehicleOperationSupplierPayment(input);
  assert.equal(created.transactionAt.toISOString(), date.toISOString());
  assert.equal(created.amount.toFixed(2), "350.00");
  assert.equal(rows.find((r) => r.id === "later").balanceAfter.toFixed(2), "5550.00");
  await assert.rejects(() => createVehicleOperationSupplierPayment(input), /zaten mevcut/);
});
