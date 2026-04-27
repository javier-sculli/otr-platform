-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "canales" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "content_per_canal" JSONB NOT NULL DEFAULT '{}';
