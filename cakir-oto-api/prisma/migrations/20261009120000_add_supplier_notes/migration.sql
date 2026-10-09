CREATE TABLE "supplier_notes" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "supplier_notes_supplier_id_updated_at_created_at_id_idx"
    ON "supplier_notes"("supplier_id", "updated_at" DESC, "created_at" DESC, "id" DESC);

ALTER TABLE "supplier_notes" ADD CONSTRAINT "supplier_notes_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
