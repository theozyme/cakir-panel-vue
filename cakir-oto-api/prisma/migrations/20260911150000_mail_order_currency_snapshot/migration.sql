ALTER TABLE "supplier_transactions"
  ADD COLUMN "source_amount" DECIMAL(14,2),
  ADD COLUMN "source_currency" VARCHAR(3),
  ADD COLUMN "exchange_rate" DECIMAL(14,4),
  ADD COLUMN "exchange_rate_type" VARCHAR(30),
  ADD COLUMN "exchange_rate_date" VARCHAR(10),
  ADD COLUMN "exchange_rate_fetched_at" TIMESTAMP(3),
  ADD COLUMN "exchange_rate_is_stale" BOOLEAN;

ALTER TABLE "supplier_transactions" ADD CONSTRAINT "supplier_transaction_conversion_valid" CHECK (
  ("source_amount" IS NULL AND "source_currency" IS NULL AND "exchange_rate" IS NULL)
  OR COALESCE(("source_amount" > 0 AND "source_currency" = 'TRY' AND
      (("currency" = 'TRY' AND "exchange_rate" IS NULL)
       OR ("currency" = 'USD' AND "exchange_rate" > 0 AND "exchange_rate_date" IS NOT NULL))), FALSE)
);
