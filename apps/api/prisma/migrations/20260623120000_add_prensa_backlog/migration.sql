-- Backlog de Prensa (HU Fase 2): área + modelo de estado de dos niveles + gestión-pitch

-- AlterEnum: nuevo kind de TicketType para los tipos de Prensa
ALTER TYPE "TicketTypeKind" ADD VALUE IF NOT EXISTS 'PRENSA';

-- CreateEnum
CREATE TYPE "TicketArea" AS ENUM ('CONTENIDO', 'PRENSA');
CREATE TYPE "MacroEstado" AS ENUM ('BACKLOG', 'EN_PROGRESO', 'EN_REVISION', 'FINALIZADO');
CREATE TYPE "SubEstado" AS ENUM ('STAND_BY', 'PENDIENTE', 'EN_CURSO', 'REV_SANTI', 'REV_MANU', 'ENVIADO_CLIENTE', 'A_PUBLICAR', 'LISTO', 'CANCELADO');
CREATE TYPE "EstadoRespuesta" AS ENUM ('ENVIADO', 'RESPONDIDO', 'SIN_RESPUESTA');

-- AlterTable
ALTER TABLE "tickets"
  ADD COLUMN "area" "TicketArea" NOT NULL DEFAULT 'CONTENIDO',
  ADD COLUMN "macro_estado" "MacroEstado",
  ADD COLUMN "sub_estado" "SubEstado",
  ADD COLUMN "medio" TEXT,
  ADD COLUMN "periodista" TEXT,
  ADD COLUMN "estado_respuesta" "EstadoRespuesta";

-- CreateIndex
CREATE INDEX "tickets_area_macro_estado_idx" ON "tickets"("area", "macro_estado");
