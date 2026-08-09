-- Refuse to modify the schema when two historical vehicle rows normalize to
-- the same plate. Historical records must be reviewed manually; this migration
-- never merges or deletes them.
BEGIN;

DO $$
DECLARE
    collision_details TEXT;
BEGIN
    SELECT string_agg(
        normalized_plate || ' => [' || conflicting_rows || ']',
        '; ' ORDER BY normalized_plate
    )
    INTO collision_details
    FROM (
        SELECT
            UPPER(REGEXP_REPLACE(BTRIM("plate"), '[[:space:]]+', '', 'g')) AS normalized_plate,
            string_agg("id" || ':' || "plate", ', ' ORDER BY "id") AS conflicting_rows
        FROM "vehicles"
        GROUP BY UPPER(REGEXP_REPLACE(BTRIM("plate"), '[[:space:]]+', '', 'g'))
        HAVING COUNT(*) > 1
    ) collisions;

    IF collision_details IS NOT NULL THEN
        RAISE EXCEPTION 'Vehicle normalized plate collision(s): %', collision_details
            USING HINT = 'Resolve the listed historical vehicle rows manually, then run the migration again.';
    END IF;
END $$;

-- CreateEnum
CREATE TYPE "VehicleOperationType" AS ENUM ('MULTIMEDIA', 'SOUND_SYSTEM', 'SERVICE', 'ACCESSORY', 'OTHER');

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN "normalized_plate" VARCHAR(20);

UPDATE "vehicles"
SET "normalized_plate" = UPPER(REGEXP_REPLACE(BTRIM("plate"), '[[:space:]]+', '', 'g'));

ALTER TABLE "vehicles" ALTER COLUMN "normalized_plate" SET NOT NULL;

-- Keep the legacy migration importer compatible without importing business
-- helpers into src/modules/migration. Every future plate insert/update receives
-- the same canonical value at the database boundary.
CREATE FUNCTION "set_vehicle_normalized_plate"() RETURNS TRIGGER AS $$
BEGIN
    NEW."normalized_plate" := UPPER(REGEXP_REPLACE(BTRIM(NEW."plate"), '[[:space:]]+', '', 'g'));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "vehicles_set_normalized_plate"
BEFORE INSERT OR UPDATE OF "plate" ON "vehicles"
FOR EACH ROW EXECUTE FUNCTION "set_vehicle_normalized_plate"();

-- AlterTable
ALTER TABLE "vehicle_operations"
ADD COLUMN "operation_type" "VehicleOperationType",
ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'TRY';

-- CreateTable
CREATE TABLE "pending_vehicles" (
    "id" TEXT NOT NULL,
    "plate" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_normalized_plate_key" ON "vehicles"("normalized_plate");
CREATE UNIQUE INDEX "pending_vehicles_plate_key" ON "pending_vehicles"("plate");
CREATE INDEX "pending_vehicles_created_at_idx" ON "pending_vehicles"("created_at");
CREATE UNIQUE INDEX "supplier_transactions_source_type_source_id_key"
ON "supplier_transactions"("source_type", "source_id");

COMMIT;
