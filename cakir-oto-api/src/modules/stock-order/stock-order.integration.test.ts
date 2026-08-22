import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe("inventory and stock-order transactions", { skip: !testDatabaseUrl }, () => {
  let inventory: typeof import("../inventory/inventory.service.js");
  let stockOrders: typeof import("./stock-order.service.js");
  let suppliers: typeof import("../supplier/supplier.service.js");
  let prisma: ReturnType<(typeof import("../../lib/prisma.js"))["getPrisma"]>;
  const createdOrderIds: string[] = [];
  const createdProductIds: Array<{ type: "MULTIMEDIA" | "SCREEN" | "SOUND_SYSTEM"; id: string }> = [];
  const createdSupplierIds: string[] = [];

  before(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    [inventory, stockOrders, suppliers] = await Promise.all([
      import("../inventory/inventory.service.js"),
      import("./stock-order.service.js"),
      import("../supplier/supplier.service.js"),
    ]);
    prisma = (await import("../../lib/prisma.js")).getPrisma();
  });

  after(async () => {
    if (!prisma) return;
    if (createdOrderIds.length > 0) {
      await prisma.stockMovement.deleteMany({
        where: { referenceType: "STOCK_ORDER", referenceId: { in: createdOrderIds } },
      });
      await prisma.stockOrderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
      await prisma.stockOrder.deleteMany({ where: { id: { in: createdOrderIds } } });
    }
    for (const product of createdProductIds.reverse()) {
      await prisma.stockMovement.deleteMany({ where: { productId: product.id } });
      if (product.type === "MULTIMEDIA") {
        await prisma.multimediaProduct.deleteMany({ where: { id: product.id } });
      } else if (product.type === "SCREEN") {
        await prisma.screenProduct.deleteMany({ where: { id: product.id } });
      } else {
        await prisma.soundSystemProduct.deleteMany({ where: { id: product.id } });
      }
    }
    if (createdSupplierIds.length > 0) {
      await prisma.supplier.deleteMany({ where: { id: { in: createdSupplierIds } } });
    }
    await prisma.$disconnect();
  });

  test("manual stock correction writes movements and prevents negative stock", async () => {
    const suffix = randomUUID();
    const product = await inventory.createInventoryProduct({
      type: "MULTIMEDIA",
      code: `TEST-${suffix}`,
      brand: "Integration",
      initialQuantity: 2,
      criticalStockLevel: 1,
    });
    createdProductIds.push({ type: "MULTIMEDIA", id: product.id });

    const listed = await inventory.listInventoryProducts({
      type: "MULTIMEDIA",
      search: suffix,
      brand: "integration",
      criticalOnly: false,
      active: "true",
      page: 1,
      pageSize: 10,
    });
    assert.equal(listed.items.some((item) => item.id === product.id), true);
    await assert.rejects(
      inventory.updateInventoryProduct("MULTIMEDIA", product.id, { quantity: 100 }),
      (error: unknown) =>
        error instanceof Error && "statusCode" in error && error.statusCode === 400,
    );

    const adjusted = await inventory.adjustInventoryStock("MULTIMEDIA", product.id, {
      quantityDelta: -1,
      note: "integration correction",
    });
    assert.equal(adjusted.quantity, 1);
    await assert.rejects(
      inventory.adjustInventoryStock("MULTIMEDIA", product.id, { quantityDelta: -2 }),
      (error: unknown) =>
        error instanceof Error && "statusCode" in error && error.statusCode === 409,
    );
    const movements = await prisma.stockMovement.findMany({ where: { productId: product.id } });
    assert.deepEqual(
      movements.map((movement) => movement.quantity).sort((a, b) => a - b),
      [-1, 2],
    );

    const inactive = await inventory.updateInventoryProduct("MULTIMEDIA", product.id, {
      isActive: false,
    });
    assert.equal(inactive.isActive, false);
    await assert.rejects(
      inventory.adjustInventoryStock("MULTIMEDIA", product.id, { quantityDelta: 1 }),
      (error: unknown) =>
        error instanceof Error && "statusCode" in error && error.statusCode === 409,
    );
    await inventory.updateInventoryProduct("MULTIMEDIA", product.id, { isActive: true });
  });

  test("draft and ordered do not change stock; receive is atomic and idempotent", async () => {
    const suffix = randomUUID();
    const supplier = await suppliers.createSupplier({ name: `Order Supplier ${suffix}`, currency: "USD" });
    createdSupplierIds.push(supplier.id);
    await assert.rejects(
      suppliers.createSupplier({ name: supplier.name.toLowerCase(), currency: "USD" }),
      (error: unknown) =>
        error instanceof Error && "statusCode" in error && error.statusCode === 409,
    );

    const multimedia = await inventory.createInventoryProduct({
      type: "MULTIMEDIA",
      code: `ORDER-${suffix}`,
      brand: "Integration",
      initialQuantity: 3,
      criticalStockLevel: 1,
    });
    createdProductIds.push({ type: "MULTIMEDIA", id: multimedia.id });

    const draft = await stockOrders.createStockOrder({
      supplierId: supplier.id,
      orderDate: "2026-08-22",
      expectedDeliveryDate: "2026-08-30",
      paymentStatus: "UNPAID",
      paymentMethod: "BANK_TRANSFER",
      status: "DRAFT",
      items: [
        {
          stockType: "MULTIMEDIA",
          isNewProduct: false,
          productId: multimedia.id,
          quantity: 2,
          unitPrice: "10.25",
        },
        {
          stockType: "SCREEN",
          isNewProduct: true,
          productSnapshot: {
            brand: `Screen ${suffix}`,
            sizeLabel: "10 inch",
            criticalStockLevel: 1,
          },
          quantity: 4,
          unitPrice: "20.50",
        },
      ],
    });
    createdOrderIds.push(draft.id);
    assert.equal((await prisma.multimediaProduct.findUniqueOrThrow({ where: { id: multimedia.id } })).quantity, 3);
    assert.equal(await prisma.stockMovement.count({ where: { referenceId: draft.id } }), 0);

    await stockOrders.submitStockOrder(draft.id);
    assert.equal((await prisma.multimediaProduct.findUniqueOrThrow({ where: { id: multimedia.id } })).quantity, 3);
    assert.equal(await prisma.stockMovement.count({ where: { referenceId: draft.id } }), 0);

    const received = await stockOrders.receiveStockOrder(draft.id);
    assert.equal(received.status, "RECEIVED");
    assert.equal((await prisma.multimediaProduct.findUniqueOrThrow({ where: { id: multimedia.id } })).quantity, 5);
    const newScreen = received.items.find((item) => item.stockType === "SCREEN")?.productId;
    assert.ok(newScreen);
    createdProductIds.push({ type: "SCREEN", id: newScreen });
    assert.equal((await prisma.screenProduct.findUniqueOrThrow({ where: { id: newScreen } })).quantity, 4);
    assert.equal(
      await prisma.stockMovement.count({
        where: { movementType: "ORDER_DELIVERY", referenceId: draft.id },
      }),
      2,
    );
    await assert.rejects(
      stockOrders.receiveStockOrder(draft.id),
      (error: unknown) =>
        error instanceof Error && "statusCode" in error && error.statusCode === 409,
    );
    assert.equal((await prisma.multimediaProduct.findUniqueOrThrow({ where: { id: multimedia.id } })).quantity, 5);
    assert.equal(await prisma.supplierTransaction.count({ where: { supplierId: supplier.id } }), 0);
  });

  test("draft editing, submit and cancel enforce state rules without touching stock", async () => {
    const suffix = randomUUID();
    const supplier = await suppliers.createSupplier({
      name: `Cancel Supplier ${suffix}`,
      currency: "TRY",
    });
    createdSupplierIds.push(supplier.id);
    const product = await inventory.createInventoryProduct({
      type: "SCREEN",
      brand: `Cancel Screen ${suffix}`,
      sizeLabel: "9 inch",
      initialQuantity: 6,
      criticalStockLevel: 1,
    });
    createdProductIds.push({ type: "SCREEN", id: product.id });

    const order = await stockOrders.createStockOrder({
      supplierId: supplier.id,
      orderDate: "2026-08-22",
      expectedDeliveryDate: "2026-08-25",
      paymentStatus: "UNPAID",
      paymentMethod: "CASH",
      status: "DRAFT",
      items: [
        {
          stockType: "SCREEN",
          isNewProduct: false,
          productId: product.id,
          quantity: 2,
          unitPrice: "100.00",
        },
      ],
    });
    createdOrderIds.push(order.id);
    const edited = await stockOrders.updateDraftStockOrder(order.id, {
      supplierId: supplier.id,
      orderDate: "2026-08-22",
      expectedDeliveryDate: "2026-08-26",
      paymentStatus: "PARTIAL",
      paymentMethod: "BANK_TRANSFER",
      items: [
        {
          stockType: "SCREEN",
          isNewProduct: false,
          productId: product.id,
          quantity: 3,
          unitPrice: "90.00",
        },
      ],
    });
    assert.equal(edited.items[0]?.quantity, 3);
    await stockOrders.submitStockOrder(order.id);
    await assert.rejects(stockOrders.updateDraftStockOrder(order.id, {
      supplierId: supplier.id,
      orderDate: "2026-08-22",
      expectedDeliveryDate: "2026-08-26",
      paymentStatus: "UNPAID",
      paymentMethod: "CASH",
      items: [{ stockType: "SCREEN", isNewProduct: false, productId: product.id, quantity: 1, unitPrice: "1.00" }],
    }));
    const cancelled = await stockOrders.cancelStockOrder(order.id);
    assert.equal(cancelled.status, "CANCELLED");
    await assert.rejects(stockOrders.receiveStockOrder(order.id));
    assert.equal((await prisma.screenProduct.findUniqueOrThrow({ where: { id: product.id } })).quantity, 6);
    assert.equal(await prisma.stockMovement.count({ where: { referenceId: order.id } }), 0);
  });

  test("one failing receive item rolls back status, movements and earlier increments", async () => {
    const suffix = randomUUID();
    const supplier = await suppliers.createSupplier({ name: `Rollback Supplier ${suffix}`, currency: "USD" });
    createdSupplierIds.push(supplier.id);
    const multimedia = await inventory.createInventoryProduct({
      type: "MULTIMEDIA",
      code: `ROLLBACK-${suffix}`,
      brand: "Integration",
      initialQuantity: 1,
      criticalStockLevel: 0,
    });
    createdProductIds.push({ type: "MULTIMEDIA", id: multimedia.id });
    const sound = await inventory.createInventoryProduct({
      type: "SOUND_SYSTEM",
      name: `Duplicate ${suffix}`,
      purchasePriceUsd: "15.00",
      initialQuantity: 0,
      criticalStockLevel: 0,
    });
    createdProductIds.push({ type: "SOUND_SYSTEM", id: sound.id });

    const order = await stockOrders.createStockOrder({
      supplierId: supplier.id,
      orderDate: "2026-08-22",
      expectedDeliveryDate: "2026-08-30",
      paymentStatus: "UNPAID",
      paymentMethod: "BANK_TRANSFER",
      status: "ORDERED",
      items: [
        { stockType: "MULTIMEDIA", isNewProduct: false, productId: multimedia.id, quantity: 5, unitPrice: "10.00" },
        {
          stockType: "SOUND_SYSTEM",
          isNewProduct: true,
          productSnapshot: { name: `Duplicate ${suffix}`, purchasePriceUsd: "15.00", criticalStockLevel: 0 },
          quantity: 2,
          unitPrice: "15.00",
        },
      ],
    });
    createdOrderIds.push(order.id);
    await assert.rejects(stockOrders.receiveStockOrder(order.id));
    assert.equal((await prisma.stockOrder.findUniqueOrThrow({ where: { id: order.id } })).status, "ORDERED");
    assert.equal((await prisma.multimediaProduct.findUniqueOrThrow({ where: { id: multimedia.id } })).quantity, 1);
    assert.equal(await prisma.stockMovement.count({ where: { referenceId: order.id } }), 0);
  });
});
