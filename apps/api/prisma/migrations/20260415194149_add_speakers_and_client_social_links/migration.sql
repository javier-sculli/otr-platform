-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "instagram_url" TEXT,
ADD COLUMN     "tiktok_url" TEXT,
ADD COLUMN     "twitter_url" TEXT,
ADD COLUMN     "web_url" TEXT;

-- CreateTable
CREATE TABLE "speakers" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cargo" TEXT,
    "linkedin_url" TEXT,
    "instagram_url" TEXT,
    "twitter_url" TEXT,
    "tiktok_url" TEXT,
    "newsletter_url" TEXT,
    "blog_url" TEXT,
    "canales_habilitados" JSONB NOT NULL DEFAULT '{}',
    "personalidad_arquetipo" TEXT,
    "tono_voz_personal" TEXT,
    "contexto_experiencia" TEXT,
    "temas_habla" TEXT,
    "posicionamiento_opinion" TEXT,
    "estructura_narrativa" TEXT,
    "uso_idioma" TEXT,
    "criterios_calidad" TEXT,
    "contexto_marca" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "speakers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "speakers_client_id_idx" ON "speakers"("client_id");

-- AddForeignKey
ALTER TABLE "speakers" ADD CONSTRAINT "speakers_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
