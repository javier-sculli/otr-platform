-- DropForeignKey
ALTER TABLE "publications" DROP CONSTRAINT "publications_ticket_id_fkey";

-- AlterTable
ALTER TABLE "clients" ADD COLUMN "linkedin_url" TEXT;

-- AlterTable: client_id requires a default for existing rows — use a placeholder then remove default
ALTER TABLE "publications" ADD COLUMN "client_id" TEXT;
ALTER TABLE "publications" ADD COLUMN "post_content" TEXT;
ALTER TABLE "publications" ALTER COLUMN "ticket_id" DROP NOT NULL;

-- Backfill client_id from the related ticket
UPDATE "publications" p
SET "client_id" = t."client_id"
FROM "tickets" t
WHERE p."ticket_id" = t."id";

-- Delete orphaned publications that have no client (shouldn't happen but safety net)
DELETE FROM "publications" WHERE "client_id" IS NULL;

-- Now enforce NOT NULL
ALTER TABLE "publications" ALTER COLUMN "client_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "publications_url_key" ON "publications"("url");

-- CreateIndex
CREATE INDEX "publications_client_id_idx" ON "publications"("client_id");

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
