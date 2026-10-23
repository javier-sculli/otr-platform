-- AlterTable
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "sort_order" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill sort_order preserving current createdAt DESC order (spaced by 1024)
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) * 1024.0 AS new_sort_order
  FROM "tickets"
)
UPDATE "tickets" t
SET "sort_order" = ordered.new_sort_order
FROM ordered
WHERE t.id = ordered.id;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tickets_sort_order_idx" ON "tickets"("sort_order");
