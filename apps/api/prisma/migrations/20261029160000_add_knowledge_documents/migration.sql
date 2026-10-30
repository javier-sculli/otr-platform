-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "speaker_id" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'NOTA',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_documents_client_id_idx" ON "knowledge_documents"("client_id");

-- CreateIndex
CREATE INDEX "knowledge_documents_speaker_id_idx" ON "knowledge_documents"("speaker_id");

-- CreateIndex
CREATE INDEX "knowledge_documents_type_idx" ON "knowledge_documents"("type");

-- CreateIndex
CREATE INDEX "knowledge_documents_client_id_date_idx" ON "knowledge_documents"("client_id", "date");

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_speaker_id_fkey" FOREIGN KEY ("speaker_id") REFERENCES "speakers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
