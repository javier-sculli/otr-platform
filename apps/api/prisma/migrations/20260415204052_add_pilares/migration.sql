-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "pilar_id" TEXT;

-- CreateTable
CREATE TABLE "pilares" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pilares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pilares_client_id_idx" ON "pilares"("client_id");

-- CreateIndex
CREATE INDEX "tickets_pilar_id_idx" ON "tickets"("pilar_id");

-- AddForeignKey
ALTER TABLE "pilares" ADD CONSTRAINT "pilares_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_pilar_id_fkey" FOREIGN KEY ("pilar_id") REFERENCES "pilares"("id") ON DELETE SET NULL ON UPDATE CASCADE;
