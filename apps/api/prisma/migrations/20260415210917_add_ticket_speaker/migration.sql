-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "speaker_id" TEXT;

-- CreateIndex
CREATE INDEX "tickets_speaker_id_idx" ON "tickets"("speaker_id");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_speaker_id_fkey" FOREIGN KEY ("speaker_id") REFERENCES "speakers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
