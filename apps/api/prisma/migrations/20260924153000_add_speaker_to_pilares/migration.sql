-- AlterTable
ALTER TABLE "pilares" ADD COLUMN "speaker_id" TEXT;

-- CreateIndex
CREATE INDEX "pilares_speaker_id_idx" ON "pilares"("speaker_id");

-- AddForeignKey
ALTER TABLE "pilares" ADD CONSTRAINT "pilares_speaker_id_fkey" FOREIGN KEY ("speaker_id") REFERENCES "speakers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
