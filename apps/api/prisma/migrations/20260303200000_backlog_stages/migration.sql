-- CreateEnum
CREATE TYPE "Prioridad" AS ENUM ('ALTA', 'MEDIA', 'BAJA');

-- AlterEnum: replace TicketStatus with new 6-stage pipeline
-- Data migration: IDEA→BACKLOG, EN_PRODUCCION→CONTENIDO, PUBLICADO→APROBADO
BEGIN;
CREATE TYPE "TicketStatus_new" AS ENUM ('BACKLOG', 'BRIEF', 'CONTENIDO', 'DISENO', 'REVISION', 'APROBADO', 'CANCELADO');
ALTER TABLE "tickets" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "tickets" ALTER COLUMN "status" TYPE "TicketStatus_new" USING (
  CASE "status"::text
    WHEN 'IDEA'         THEN 'BACKLOG'
    WHEN 'EN_PRODUCCION' THEN 'CONTENIDO'
    WHEN 'PUBLICADO'    THEN 'APROBADO'
    WHEN 'CANCELADO'    THEN 'CANCELADO'
    ELSE 'BACKLOG'
  END
)::"TicketStatus_new";
ALTER TYPE "TicketStatus" RENAME TO "TicketStatus_old";
ALTER TYPE "TicketStatus_new" RENAME TO "TicketStatus";
DROP TYPE "TicketStatus_old";
ALTER TABLE "tickets" ALTER COLUMN "status" SET DEFAULT 'BACKLOG';
COMMIT;

-- AlterTable: add prioridad
ALTER TABLE "tickets" ADD COLUMN "prioridad" "Prioridad" NOT NULL DEFAULT 'MEDIA';
