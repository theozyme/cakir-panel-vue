import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
describe("vehicle history database filters", { skip: !testDatabaseUrl }, () => {
  let prisma: ReturnType<(typeof import("../../lib/prisma.js"))["getPrisma"]>;
  let history: typeof import("./vehicle-history.service.js");
  const vehicleIds: string[] = [];
  const customerIds: string[] = [];
  const suffix = randomUUID();
  const brand = `VH-${suffix}`;
  let mainVehicleId: string;
  let missingVehicleId: string;
  let specialOperationId: string;

  before(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    prisma = (await import("../../lib/prisma.js")).getPrisma();
    history = await import("./vehicle-history.service.js");
    const oldCustomer = await prisma.customer.create({
      data: {
        firstName: "Ali",
        lastName: suffix,
        phone: "5551112233",
        note: "Eski ziyaret müşterisi",
      },
    });
    customerIds.push(oldCustomer.id);
    const newCustomer = await prisma.customer.create({
      data: { firstName: "Veli", lastName: suffix, phone: "5559998877" },
    });
    customerIds.push(newCustomer.id);
    const vehicle = await prisma.vehicle.create({
      data: { plate: `99H${suffix.slice(0, 8)}`, brand, model: "320i" },
    });
    vehicleIds.push(vehicle.id);
    mainVehicleId = vehicle.id;
    const oldVisit = await prisma.vehicleVisit.create({
      data: {
        vehicleId: vehicle.id,
        customerId: oldCustomer.id,
        arrivalAt: new Date("2026-10-11T12:00:00Z"),
        note: "Randevu",
      },
    });
    const newVisit = await prisma.vehicleVisit.create({
      data: {
        vehicleId: vehicle.id,
        customerId: newCustomer.id,
        arrivalAt: new Date("2026-10-13T12:00:00Z"),
      },
    });
    await prisma.vehicleOperation.createMany({
      data: Array.from({ length: 21 }, () => ({
        id: randomUUID(),
        vehicleId: vehicle.id,
        visitId: oldVisit.id,
        operationType: "OTHER" as const,
        description: "Kontrol",
        price: "100.00",
        currency: "TRY",
        paymentMethod: "CASH" as const,
        operationAt: new Date("2026-10-12T12:00:00Z"),
      })),
    });
    const special = await prisma.vehicleOperation.create({
      data: {
        vehicleId: vehicle.id,
        visitId: oldVisit.id,
        operationType: "REAR_VIEW_CAMERA",
        description: "Kamera",
        price: "200.25",
        currency: "TRY",
        paymentMethod: "CREDIT_CARD",
        note: "Garanti kontrolü",
        revision: 2,
        operationAt: new Date("2026-10-12T20:59:59.999Z"),
      },
    });
    specialOperationId = special.id;
    await prisma.vehicleOperation.create({
      data: {
        vehicleId: vehicle.id,
        visitId: newVisit.id,
        operationType: "OTHER",
        description: "Ertesi gün",
        price: "300.00",
        currency: "USD",
        paymentMethod: "CASH",
        operationAt: new Date("2026-10-12T21:00:00Z"),
      },
    });
    for (const [plateSuffix, variantBrand, model, deleted] of [
      ["V", ` ${brand.toLowerCase()} `, " 320I ", false],
      ["M", "  ", "", false],
      ["D", `DELETED-${suffix}`, null, true],
    ] as const) {
      const row = await prisma.vehicle.create({
        data: { plate: `99${plateSuffix}${suffix.slice(0, 8)}`, brand: variantBrand, model },
      });
      vehicleIds.push(row.id);
      if (plateSuffix === "M") missingVehicleId = row.id;
      const visit = await prisma.vehicleVisit.create({
        data: {
          vehicleId: row.id,
          customerId: plateSuffix === "M" ? null : oldCustomer.id,
          arrivalAt: new Date("2026-10-12T10:00:00Z"),
        },
      });
      await prisma.vehicleOperation.create({
        data: {
          vehicleId: row.id,
          visitId: visit.id,
          operationType: null,
          description: "Eski kayıt",
          price: "100.00",
          currency: "TRY",
          paymentMethod: "CASH",
          operationAt: new Date("2026-10-12T10:00:00Z"),
          ...(deleted ? { deletedAt: new Date() } : {}),
        },
      });
    }
  });

  after(async () => {
    if (!prisma) return;
    await prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    await prisma.$disconnect();
  });

  test("brand variants span pages, preserve multiple operations and produce the same total", async () => {
    const first = await history.listVehicleOperationHistory({
      brand: brand.toLowerCase(),
      page: "1",
    });
    const second = await history.listVehicleOperationHistory({
      brand: brand.toLowerCase(),
      page: "2",
    });
    assert.equal(first.pagination.total, 24);
    assert.equal(first.pagination.totalPages, 2);
    assert.equal(first.items.length, 20);
    assert.equal(second.items.length, 4);
    assert.equal(
      new Set([...first.items, ...second.items].map((item) => item.operationId)).size,
      24,
    );
    const search = await history.listVehicleOperationHistory({ search: brand, pageSize: "100" });
    assert.equal(search.pagination.total, 24);
    const options = await history.listVehicleHistoryFilterOptions();
    assert.ok(options.brands.includes(brand.toUpperCase()));
    assert.equal(options.brands.filter((value) => value === brand.toUpperCase()).length, 1);
    assert.ok(!options.brands.includes(`DELETED-${suffix}`.toUpperCase()));
  });

  test("model, payment and Istanbul dates combine and include the last millisecond of the end day", async () => {
    const result = await history.listVehicleOperationHistory({
      brand,
      model: "320I",
      paymentMethod: "CASH",
      dateFrom: "2026-10-12",
      dateTo: "2026-10-12",
      pageSize: "100",
    });
    assert.equal(result.pagination.total, 22);
    const boundary = await history.listVehicleOperationHistory({
      brand,
      dateTo: "2026-10-12",
      paymentMethod: "CREDIT_CARD",
    });
    assert.deepEqual(
      boundary.items.map((item) => item.operationId),
      [specialOperationId],
    );
  });

  test("customer filters use each visit's customer even if a later visit changes the customer", async () => {
    const old = await history.listVehicleOperationHistory({
      vehicleId: mainVehicleId,
      customerFirstName: "Ali",
    });
    const latest = await history.listVehicleOperationHistory({
      vehicleId: mainVehicleId,
      customerFirstName: "Veli",
    });
    assert.equal(old.pagination.total, 22);
    assert.equal(latest.pagination.total, 1);
    assert.equal(latest.items[0]?.customer?.phone, "5559998877");
  });

  test("decimal prices and currency distinguish operations and notes/revisions can refine the result", async () => {
    const result = await history.listVehicleOperationHistory({
      brand,
      currency: "TRY",
      minPrice: "200.25",
      maxPrice: "200.25",
      operationNote: "Garanti",
      visitNote: "Randevu",
      minRevision: "2",
      maxRevision: "2",
    });
    assert.deepEqual(
      result.items.map((item) => item.operationId),
      [specialOperationId],
    );
    assert.equal(
      (await history.listVehicleOperationHistory({ brand, currency: "USD", minPrice: "200.25" }))
        .pagination.total,
      1,
    );
  });

  test("blank labels, missing customers and legacy operation types remain independently discoverable", async () => {
    const result = await history.listVehicleOperationHistory({
      vehicleId: missingVehicleId,
      brandState: "missing",
      modelState: "missing",
      customerState: "missing",
      operationTypeState: "missing",
      supplierState: "missing",
      multimediaState: "missing",
      screenState: "missing",
      soundOfferState: "missing",
    });
    assert.equal(result.pagination.total, 1);
    assert.equal(result.items[0]?.customer, null);
    assert.equal(
      (
        await history.listVehicleOperationHistory({
          vehicleId: missingVehicleId,
          brandState: "present",
        })
      ).pagination.total,
      0,
    );
  });
});
