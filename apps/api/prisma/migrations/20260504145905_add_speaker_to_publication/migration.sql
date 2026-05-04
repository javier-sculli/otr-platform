-- AlterTable
ALTER TABLE "publications" ADD COLUMN     "speaker_id" TEXT;

-- CreateIndex
CREATE INDEX "publications_speaker_id_idx" ON "publications"("speaker_id");

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_speaker_id_fkey" FOREIGN KEY ("speaker_id") REFERENCES "speakers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
