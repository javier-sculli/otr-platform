/*
  Warnings:

  - You are about to drop the column `area_id` on the `tickets` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_area_id_fkey";

-- DropIndex
DROP INDEX "tickets_area_id_idx";

-- AlterTable
ALTER TABLE "tickets" DROP COLUMN "area_id";
