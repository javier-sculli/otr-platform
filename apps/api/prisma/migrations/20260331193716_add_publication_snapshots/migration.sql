/*
  Warnings:

  - You are about to drop the column `metrics` on the `publications` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "publications" DROP COLUMN "metrics",
ADD COLUMN     "canal" TEXT NOT NULL DEFAULT 'LinkedIn',
ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "is_highlight" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "post_metric_snapshots" (
    "id" TEXT NOT NULL,
    "publication_id" TEXT NOT NULL,
    "day_number" INTEGER NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "taken_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_metric_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_metric_snapshots_publication_id_idx" ON "post_metric_snapshots"("publication_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_metric_snapshots_publication_id_day_number_key" ON "post_metric_snapshots"("publication_id", "day_number");

-- AddForeignKey
ALTER TABLE "post_metric_snapshots" ADD CONSTRAINT "post_metric_snapshots_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
