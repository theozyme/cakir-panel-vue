ALTER TABLE "goods_entries" ADD COLUMN "product_name" VARCHAR(200), ADD COLUMN "supersedes_id" TEXT;
UPDATE "goods_entries" e SET "product_name" = p."name" FROM "goods_products" p WHERE p."id" = e."product_id";
CREATE UNIQUE INDEX "goods_entries_supersedes_id_key" ON "goods_entries"("supersedes_id");
ALTER TABLE "goods_entries" ADD CONSTRAINT "goods_entries_supersedes_id_fkey"
  FOREIGN KEY ("supersedes_id") REFERENCES "goods_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
