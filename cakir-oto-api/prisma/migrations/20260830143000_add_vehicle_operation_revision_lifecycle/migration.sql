-- AddEnumValue
ALTER TYPE "StockMovementType" ADD VALUE 'VEHICLE_OPERATION_REVERSAL';

-- CreateEnum
CREATE TYPE "VehicleOperationRevisionAction" AS ENUM ('UPDATE', 'DELETE');

-- AlterTable
ALTER TABLE "vehicle_operations"
ADD COLUMN "deleted_at" TIMESTAMP(3),
ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "supplier_transactions"
ADD COLUMN "voided_at" TIMESTAMP(3);

-- Replace the old all-rows source uniqueness with active-source uniqueness.
DROP INDEX "supplier_transactions_source_type_source_id_key";
CREATE UNIQUE INDEX "supplier_transactions_active_source_key"
ON "supplier_transactions"("source_type", "source_id")
WHERE "voided_at" IS NULL AND "source_id" IS NOT NULL;

-- CreateTable
CREATE TABLE "vehicle_operation_revisions" (
    "id" TEXT NOT NULL,
    "operation_id" TEXT NOT NULL,
    "action" "VehicleOperationRevisionAction" NOT NULL,
    "from_revision" INTEGER NOT NULL,
    "to_revision" INTEGER NOT NULL,
    "before_json" JSONB NOT NULL,
    "after_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_operation_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_operations_deleted_at_idx" ON "vehicle_operations"("deleted_at");
CREATE INDEX "supplier_transactions_voided_at_idx" ON "supplier_transactions"("voided_at");
CREATE INDEX "vehicle_operation_revisions_operation_id_created_at_idx"
ON "vehicle_operation_revisions"("operation_id", "created_at");

-- AddForeignKey
ALTER TABLE "vehicle_operation_revisions"
ADD CONSTRAINT "vehicle_operation_revisions_operation_id_fkey"
FOREIGN KEY ("operation_id") REFERENCES "vehicle_operations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
