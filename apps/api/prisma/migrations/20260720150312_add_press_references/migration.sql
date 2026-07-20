-- AlterEnum
ALTER TYPE "SubEstado" ADD VALUE 'PENDIENTE_PUBLICACION';

-- CreateTable
CREATE TABLE "press_references" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "press_references_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "press_references_client_id_type_key" ON "press_references"("client_id", "type");

-- AddForeignKey
ALTER TABLE "press_references" ADD CONSTRAINT "press_references_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
