-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "canales" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "owner_id" TEXT;

-- CreateIndex
CREATE INDEX "clients_owner_id_idx" ON "clients"("owner_id");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
