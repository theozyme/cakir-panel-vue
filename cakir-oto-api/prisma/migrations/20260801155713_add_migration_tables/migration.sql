-- CreateTable
CREATE TABLE "migration_batches" (
    "id" TEXT NOT NULL,
    "data_type" VARCHAR(50) NOT NULL,
    "source_file" VARCHAR(255) NOT NULL,
    "file_hash" VARCHAR(64) NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "uploaded_by" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "migration_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_errors" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "legacy_key" VARCHAR(255),
    "source_reference" TEXT,
    "error_type" VARCHAR(50) NOT NULL,
    "message" TEXT NOT NULL,
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "migration_errors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "migration_batches_file_hash_key" ON "migration_batches"("file_hash");

-- CreateIndex
CREATE INDEX "migration_batches_data_type_idx" ON "migration_batches"("data_type");

-- CreateIndex
CREATE INDEX "migration_batches_created_at_idx" ON "migration_batches"("created_at");

-- CreateIndex
CREATE INDEX "migration_errors_batch_id_idx" ON "migration_errors"("batch_id");

-- CreateIndex
CREATE INDEX "migration_errors_error_type_idx" ON "migration_errors"("error_type");

-- AddForeignKey
ALTER TABLE "migration_errors" ADD CONSTRAINT "migration_errors_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "migration_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
