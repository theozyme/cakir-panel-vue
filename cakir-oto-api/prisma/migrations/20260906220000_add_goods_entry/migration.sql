CREATE TABLE "goods_products" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "normalized_name" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "goods_products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "goods_entries" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "supplier_name" VARCHAR(200) NOT NULL,
    "purchase_price" DECIMAL(14,2) NOT NULL,
    "sale_price" DECIMAL(14,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "goods_entries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "goods_entries_quantity_check" CHECK ("quantity" > 0),
    CONSTRAINT "goods_entries_prices_check" CHECK ("purchase_price" >= 0 AND "sale_price" >= 0)
);

CREATE UNIQUE INDEX "goods_products_normalized_name_key" ON "goods_products"("normalized_name");
CREATE INDEX "goods_entries_product_id_date_created_at_id_idx" ON "goods_entries"("product_id", "date", "created_at", "id");
CREATE INDEX "goods_entries_date_idx" ON "goods_entries"("date");
ALTER TABLE "goods_entries" ADD CONSTRAINT "goods_entries_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "goods_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
