import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { getPrisma } from "../src/lib/prisma.js";
import { getUsdExchangeRate } from "../src/modules/exchange-rate/exchange-rate.service.js";
import {
  getVehicleOperationDetail,
  updateVehicleOperation,
  listDailyVehicleOperations,
} from "../src/modules/vehicle-operation/vehicle-operation.service.js";
import {
  getReportsOverview,
  parseReportPeriodFilter,
  getDashboardFinance,
  parseDashboardFinanceFilter,
} from "../src/modules/reports/reports.service.js";
import { convertSupplierPayment } from "../src/modules/vehicle-operation/payment-conversion.js";
import { Prisma } from "../generated/prisma/client.js";

const prisma = getPrisma();
const operationId = "075e867b-dbb8-486b-83ca-7eb7eb6c3739";
const supplierId = "d7c8a3cf-dcae-48dd-b683-afe259126287";
const day = "2026-09-11";
try {
  const operation = await getVehicleOperationDetail(operationId);
  assert.equal(operation.plate, "06EV1636");
  assert.equal(operation.operationAt, "2026-09-11T12:03:16.671Z");
  assert.equal(operation.mailOrderSupplierId, supplierId);
  assert.equal(operation.paymentMethod, "MAIL_ORDER");
  if (operation.currency === "TRY" && operation.supplierPayment?.sourceAmount === "14000.00") {
    console.log(
      JSON.stringify(
        { status: "already-corrected", price: operation.price, payment: operation.supplierPayment },
        null,
        2,
      ),
    );
  } else {
    assert.equal(operation.currency, "USD");
    assert.equal(operation.price, "14000.00");
    assert.equal(operation.revision, 1);
    assert.equal(operation.supplierPayment?.amount, "14000.00");
    assert.equal(operation.supplierPayment?.currency, "USD");
    assert.equal(operation.supplierPayment?.sourceAmount, null);
    const rate = await getUsdExchangeRate(day);
    assert.equal(rate.effectiveDate, day);
    const converted = convertSupplierPayment(new Prisma.Decimal("14000"), "USD", rate);
    const ledgerBefore = await prisma.supplierTransaction.findMany({
      where: { supplierId },
      orderBy: [{ transactionAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
    const stockBefore = await prisma.stockMovement.findMany({
      where: { referenceType: "VEHICLE_OPERATION", referenceId: operationId },
      orderBy: { id: "asc" },
    });
    const latestBefore = ledgerBefore.filter((r) => !r.voidedAt).at(-1)!;
    const expectedBalance = latestBefore
      .balanceAfter!.plus("14000")
      .minus(converted.amount)
      .toFixed(2);
    console.log(
      JSON.stringify(
        {
          mode: process.argv.includes("--apply") ? "apply" : "dry-run",
          operationId,
          plate: operation.plate,
          sourceTry: "14000.00",
          oldUsd: "14000.00",
          newUsd: converted.amount.toFixed(2),
          rate,
          latestBalanceBefore: latestBefore.balanceAfter?.toFixed(2),
          expectedBalance,
        },
        null,
        2,
      ),
    );
    if (process.argv.includes("--apply")) {
      const auditDir = "mail-order-repair.local";
      await mkdir(auditDir, { recursive: true });
      const auditPath = `${auditDir}/${operationId}-${Date.now()}.json`;
      await writeFile(
        auditPath,
        JSON.stringify({ operation, ledgerBefore, stockBefore, rate }, null, 2),
        { flag: "wx" },
      );
      const updated = await updateVehicleOperation(operationId, {
        revision: operation.revision,
        operationAt: operation.operationAt,
        correction: {
          originalAmountTry: "14000.00",
          reason:
            "06EV1636: 11.09.2026 tarihinde TL girilen 14000 tutarinin USD olarak kaydedilmesinin kullanici talebiyle duzeltilmesi",
        },
        operation: {
          type: operation.operationType,
          description: operation.description,
          price: "14000.00",
          currency: "TRY",
          paymentMethod: "MAIL_ORDER",
          mailOrderSupplierId: supplierId,
          multimediaProductId: operation.multimediaProductId,
          screenProductId: operation.screenProductId,
          soundOfferId: operation.soundOfferId,
          note: operation.note,
          expectedExchangeRate: { rate: rate.rate, effectiveDate: rate.effectiveDate },
        },
      });
      assert.equal(updated.currency, "TRY");
      assert.equal(updated.price, "14000.00");
      assert.equal(updated.supplierPayment?.amount, converted.amount.toFixed(2));
      assert.equal(updated.revision, 2);
      const stockAfter = await prisma.stockMovement.findMany({
        where: { referenceType: "VEHICLE_OPERATION", referenceId: operationId },
        orderBy: { id: "asc" },
      });
      assert.equal(
        JSON.stringify(stockAfter),
        JSON.stringify(stockBefore),
        "Stock movements must not change",
      );
      const active = await prisma.supplierTransaction.findMany({
        where: { sourceType: "VEHICLE_OPERATION", sourceId: operationId, voidedAt: null },
      });
      assert.equal(active.length, 1);
      const latestAfter = await prisma.supplierTransaction.findFirst({
        where: { supplierId, voidedAt: null },
        orderBy: [{ transactionAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      });
      assert.equal(latestAfter?.balanceAfter?.toFixed(2), expectedBalance);
      const [daily, reports, dashboard] = await Promise.all([
        listDailyVehicleOperations(day),
        getReportsOverview(parseReportPeriodFilter({ period: "day", date: day })),
        getDashboardFinance(parseDashboardFinanceFilter({ date: day, paymentPeriod: "today" })),
      ]);
      const dailyOperation = daily.visits
        .flatMap((v) => v.operations)
        .find((o) => o.id === operationId);
      assert.equal(dailyOperation?.currency, "TRY");
      assert.equal(dailyOperation?.price, "14000.00");
      await writeFile(
        auditPath.replace(".json", "-after.json"),
        JSON.stringify(
          { updated, latestBalance: latestAfter?.balanceAfter, reports, dashboard },
          null,
          2,
        ),
        { flag: "wx" },
      );
      console.log(
        JSON.stringify(
          {
            status: "corrected-and-verified",
            revision: updated.revision,
            payment: updated.supplierPayment,
            latestBalance: latestAfter?.balanceAfter?.toFixed(2),
            stockUnchanged: true,
            dailyTotals: daily.summary.totalsByCurrency,
            reportRevenue: reports.revenue,
            reportMailOrder: reports.expenses.sources.mailOrder,
            reportNet: reports.net,
            dashboard: dashboard.dailyEarnings,
            auditPath,
          },
          null,
          2,
        ),
      );
    }
  }
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message.replace(/postgres(?:ql)?:\/\/\S+/g, "[database]")
      : "Repair failed",
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
