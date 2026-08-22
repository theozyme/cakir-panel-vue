-- CreateEnum
CREATE TYPE "StockOrderStatus" AS ENUM ('DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockOrderPaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "StockOrderPaymentMethod" AS ENUM ('CASH', 'CREDIT_CARD', 'BANK_TRANSFER', 'CHECK', 'TERM');

-- AlterTable
ALTER TABLE "multimedia_products"
ADD COLUMN "critical_stock_level" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "screen_products"
ADD COLUMN "critical_stock_level" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "stock_movements"
ADD COLUMN "note" TEXT;

-- CreateTable
CREATE TABLE "stock_orders" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "order_date" DATE NOT NULL,
    "expected_delivery_date" DATE NOT NULL,
    "payment_status" "StockOrderPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "payment_method" "StockOrderPaymentMethod" NOT NULL,
    "note" TEXT,
    "status" "StockOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "received_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "stock_type" "StockType" NOT NULL,
    "multimedia_product_id" TEXT,
    "screen_product_id" TEXT,
    "sound_system_product_id" TEXT,
    "is_new_product" BOOLEAN NOT NULL DEFAULT false,
    "product_snapshot" JSONB NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "total_price" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_orders_supplier_id_idx" ON "stock_orders"("supplier_id");

-- CreateIndex
CREATE INDEX "stock_orders_status_idx" ON "stock_orders"("status");

-- CreateIndex
CREATE INDEX "stock_orders_order_date_idx" ON "stock_orders"("order_date");

-- CreateIndex
CREATE INDEX "stock_order_items_order_id_idx" ON "stock_order_items"("order_id");

-- CreateIndex
CREATE INDEX "stock_order_items_stock_type_idx" ON "stock_order_items"("stock_type");

-- CreateIndex
CREATE INDEX "stock_order_items_multimedia_product_id_idx" ON "stock_order_items"("multimedia_product_id");

-- CreateIndex
CREATE INDEX "stock_order_items_screen_product_id_idx" ON "stock_order_items"("screen_product_id");

-- CreateIndex
CREATE INDEX "stock_order_items_sound_system_product_id_idx" ON "stock_order_items"("sound_system_product_id");

-- AddForeignKey
ALTER TABLE "stock_orders" ADD CONSTRAINT "stock_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_order_items" ADD CONSTRAINT "stock_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "stock_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_order_items" ADD CONSTRAINT "stock_order_items_multimedia_product_id_fkey" FOREIGN KEY ("multimedia_product_id") REFERENCES "multimedia_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_order_items" ADD CONSTRAINT "stock_order_items_screen_product_id_fkey" FOREIGN KEY ("screen_product_id") REFERENCES "screen_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_order_items" ADD CONSTRAINT "stock_order_items_sound_system_product_id_fkey" FOREIGN KEY ("sound_system_product_id") REFERENCES "sound_system_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
