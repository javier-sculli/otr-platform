-- CreateEnum
CREATE TYPE "EstadoAprobacionCliente" AS ENUM ('BORRADOR', 'ENVIADO_AL_CLIENTE', 'APROBADO', 'RECHAZADO', 'REQUIERE_AJUSTES');

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "monthly_content_target" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "estado_aprobacion_cliente" "EstadoAprobacionCliente" NOT NULL DEFAULT 'BORRADOR',
ADD COLUMN     "is_draft_plan" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "planned_date" TIMESTAMP(3),
ADD COLUMN     "published_at" TIMESTAMP(3);
