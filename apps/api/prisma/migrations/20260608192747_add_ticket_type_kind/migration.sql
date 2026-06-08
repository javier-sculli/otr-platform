-- CreateEnum
CREATE TYPE "TicketTypeKind" AS ENUM ('CONTENIDO', 'TAREA');

-- AlterTable
ALTER TABLE "ticket_types" ADD COLUMN     "kind" "TicketTypeKind" NOT NULL DEFAULT 'CONTENIDO';

-- Seed task (non-content) ticket types — idempotent
INSERT INTO "ticket_types" ("id", "name", "kind", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'Deck',           'TAREA', now(), now()),
  (gen_random_uuid(), 'Estrategia',     'TAREA', now(), now()),
  (gen_random_uuid(), 'Reporte',        'TAREA', now(), now()),
  (gen_random_uuid(), 'Diseño puntual', 'TAREA', now(), now()),
  (gen_random_uuid(), 'Otro',           'TAREA', now(), now())
ON CONFLICT ("name") DO UPDATE SET "kind" = EXCLUDED."kind";
