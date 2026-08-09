-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CREDIT_CARD', 'BANK_TRANSFER', 'MAIL_ORDER');

-- CreateEnum
CREATE TYPE "SupplierTransactionType" AS ENUM ('DEBT_INCREASE', 'PAYMENT', 'ADJUSTMENT', 'CANCEL');

-- CreateEnum
CREATE TYPE "SupplierTransactionSourceType" AS ENUM ('MANUAL', 'VEHICLE_OPERATION', 'MIGRATION');

-- CreateEnum
CREATE TYPE "SoundSaleType" AS ENUM ('CASH', 'CARD');

-- CreateEnum
CREATE TYPE "SoundOfferStatus" AS ENUM ('DRAFT', 'ACCEPTED', 'USED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockType" AS ENUM ('MULTIMEDIA', 'SCREEN', 'SOUND_SYSTEM');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE', 'VEHICLE_OPERATION', 'ORDER_DELIVERY', 'MANUAL_CORRECTION');

-- CreateEnum
CREATE TYPE "ExpenseCategoryType" AS ENUM ('GENERAL', 'SGK', 'CUSTOM');

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "phone" VARCHAR(30),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "plate" VARCHAR(20) NOT NULL,
    "brand" VARCHAR(100),
    "model" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_visits" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "arrival_at" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_operations" (
    "id" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "description" VARCHAR(150) NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "operation_at" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "mail_order_supplier_id" TEXT,
    "multimedia_product_id" TEXT,
    "screen_product_id" TEXT,
    "sound_offer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "multimedia_products" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "forx" VARCHAR(100),
    "model" VARCHAR(150),
    "brand" VARCHAR(100),
    "shelf" VARCHAR(30),
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "multimedia_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screen_products" (
    "id" TEXT NOT NULL,
    "brand" VARCHAR(150) NOT NULL,
    "storage_gb" INTEGER,
    "ram_gb" INTEGER,
    "cores" INTEGER,
    "size_inch" DECIMAL(5,2),
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "screen_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sound_system_products" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "purchase_price_usd" DECIMAL(14,2),
    "cash_sale_price" DECIMAL(14,2),
    "card_sale_price" DECIMAL(14,2),
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "critical_stock_level" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sound_system_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sound_system_offers" (
    "id" TEXT NOT NULL,
    "created_by" VARCHAR(100),
    "manual_total" DECIMAL(14,2),
    "auto_total" DECIMAL(14,2) NOT NULL,
    "exchange_rate" DECIMAL(14,4) NOT NULL,
    "sale_type" "SoundSaleType" NOT NULL,
    "status" "SoundOfferStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sound_system_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sound_system_offer_items" (
    "id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "product_id" TEXT,
    "product_name_snapshot" VARCHAR(180) NOT NULL,
    "unit_purchase_price_usd" DECIMAL(14,2),
    "quantity" INTEGER NOT NULL,
    "line_total" DECIMAL(14,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sound_system_offer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "stock_type" "StockType" NOT NULL,
    "product_id" TEXT NOT NULL,
    "movement_type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reference_type" VARCHAR(40),
    "reference_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_transactions" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "type" "SupplierTransactionType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "balance_after" DECIMAL(14,2),
    "note" TEXT,
    "transaction_at" TIMESTAMP(3) NOT NULL,
    "source_type" "SupplierTransactionSourceType" NOT NULL DEFAULT 'MANUAL',
    "source_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_personnel" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_personnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_personnel_payments" (
    "id" TEXT NOT NULL,
    "personnel_id" TEXT NOT NULL,
    "payment_date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_personnel_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "category_type" "ExpenseCategoryType" NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_records" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "expense_date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_accounts" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_payments" (
    "id" TEXT NOT NULL,
    "loan_account_id" TEXT NOT NULL,
    "payment_date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_types" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_payments" (
    "id" TEXT NOT NULL,
    "invoice_type_id" TEXT NOT NULL,
    "payment_date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_plate_key" ON "vehicles"("plate");

-- CreateIndex
CREATE INDEX "vehicle_visits_vehicle_id_idx" ON "vehicle_visits"("vehicle_id");

-- CreateIndex
CREATE INDEX "vehicle_visits_customer_id_idx" ON "vehicle_visits"("customer_id");

-- CreateIndex
CREATE INDEX "vehicle_visits_arrival_at_idx" ON "vehicle_visits"("arrival_at");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_operations_sound_offer_id_key" ON "vehicle_operations"("sound_offer_id");

-- CreateIndex
CREATE INDEX "vehicle_operations_visit_id_idx" ON "vehicle_operations"("visit_id");

-- CreateIndex
CREATE INDEX "vehicle_operations_vehicle_id_idx" ON "vehicle_operations"("vehicle_id");

-- CreateIndex
CREATE INDEX "vehicle_operations_payment_method_idx" ON "vehicle_operations"("payment_method");

-- CreateIndex
CREATE INDEX "vehicle_operations_operation_at_idx" ON "vehicle_operations"("operation_at");

-- CreateIndex
CREATE INDEX "vehicle_operations_mail_order_supplier_id_idx" ON "vehicle_operations"("mail_order_supplier_id");

-- CreateIndex
CREATE INDEX "multimedia_products_code_idx" ON "multimedia_products"("code");

-- CreateIndex
CREATE INDEX "multimedia_products_brand_idx" ON "multimedia_products"("brand");

-- CreateIndex
CREATE INDEX "screen_products_brand_idx" ON "screen_products"("brand");

-- CreateIndex
CREATE UNIQUE INDEX "sound_system_products_name_key" ON "sound_system_products"("name");

-- CreateIndex
CREATE INDEX "sound_system_products_name_idx" ON "sound_system_products"("name");

-- CreateIndex
CREATE INDEX "sound_system_offers_status_idx" ON "sound_system_offers"("status");

-- CreateIndex
CREATE INDEX "sound_system_offers_created_at_idx" ON "sound_system_offers"("created_at");

-- CreateIndex
CREATE INDEX "sound_system_offer_items_offer_id_idx" ON "sound_system_offer_items"("offer_id");

-- CreateIndex
CREATE INDEX "sound_system_offer_items_product_id_idx" ON "sound_system_offer_items"("product_id");

-- CreateIndex
CREATE INDEX "stock_movements_stock_type_product_id_idx" ON "stock_movements"("stock_type", "product_id");

-- CreateIndex
CREATE INDEX "stock_movements_reference_type_reference_id_idx" ON "stock_movements"("reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_name_key" ON "suppliers"("name");

-- CreateIndex
CREATE INDEX "suppliers_name_idx" ON "suppliers"("name");

-- CreateIndex
CREATE INDEX "supplier_transactions_supplier_id_idx" ON "supplier_transactions"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_transactions_transaction_at_idx" ON "supplier_transactions"("transaction_at");

-- CreateIndex
CREATE INDEX "supplier_transactions_source_type_source_id_idx" ON "supplier_transactions"("source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_personnel_name_key" ON "expense_personnel"("name");

-- CreateIndex
CREATE INDEX "expense_personnel_payments_personnel_id_idx" ON "expense_personnel_payments"("personnel_id");

-- CreateIndex
CREATE INDEX "expense_personnel_payments_payment_date_idx" ON "expense_personnel_payments"("payment_date");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_name_key" ON "expense_categories"("name");

-- CreateIndex
CREATE INDEX "expense_records_category_id_idx" ON "expense_records"("category_id");

-- CreateIndex
CREATE INDEX "expense_records_expense_date_idx" ON "expense_records"("expense_date");

-- CreateIndex
CREATE UNIQUE INDEX "loan_accounts_name_key" ON "loan_accounts"("name");

-- CreateIndex
CREATE INDEX "loan_payments_loan_account_id_idx" ON "loan_payments"("loan_account_id");

-- CreateIndex
CREATE INDEX "loan_payments_payment_date_idx" ON "loan_payments"("payment_date");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_types_name_key" ON "invoice_types"("name");

-- CreateIndex
CREATE INDEX "invoice_payments_invoice_type_id_idx" ON "invoice_payments"("invoice_type_id");

-- CreateIndex
CREATE INDEX "invoice_payments_payment_date_idx" ON "invoice_payments"("payment_date");

-- AddForeignKey
ALTER TABLE "vehicle_visits" ADD CONSTRAINT "vehicle_visits_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_visits" ADD CONSTRAINT "vehicle_visits_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_operations" ADD CONSTRAINT "vehicle_operations_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "vehicle_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_operations" ADD CONSTRAINT "vehicle_operations_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_operations" ADD CONSTRAINT "vehicle_operations_mail_order_supplier_id_fkey" FOREIGN KEY ("mail_order_supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_operations" ADD CONSTRAINT "vehicle_operations_multimedia_product_id_fkey" FOREIGN KEY ("multimedia_product_id") REFERENCES "multimedia_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_operations" ADD CONSTRAINT "vehicle_operations_screen_product_id_fkey" FOREIGN KEY ("screen_product_id") REFERENCES "screen_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_operations" ADD CONSTRAINT "vehicle_operations_sound_offer_id_fkey" FOREIGN KEY ("sound_offer_id") REFERENCES "sound_system_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sound_system_offer_items" ADD CONSTRAINT "sound_system_offer_items_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "sound_system_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sound_system_offer_items" ADD CONSTRAINT "sound_system_offer_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "sound_system_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_transactions" ADD CONSTRAINT "supplier_transactions_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_personnel_payments" ADD CONSTRAINT "expense_personnel_payments_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "expense_personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_records" ADD CONSTRAINT "expense_records_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_loan_account_id_fkey" FOREIGN KEY ("loan_account_id") REFERENCES "loan_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_type_id_fkey" FOREIGN KEY ("invoice_type_id") REFERENCES "invoice_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
