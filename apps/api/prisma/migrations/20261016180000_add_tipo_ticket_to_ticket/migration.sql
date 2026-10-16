-- AlterTable
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "tipo_ticket" "TicketTypeKind" NOT NULL DEFAULT 'CONTENIDO';

-- Backfill tipo_ticket
UPDATE "tickets" SET "tipo_ticket" = 'PRENSA' WHERE "area" = 'PRENSA';
UPDATE "tickets" t
SET "tipo_ticket" = 'TAREA'
FROM "ticket_types" tt
WHERE t."ticket_type_id" = tt."id" AND tt."kind" = 'TAREA';
