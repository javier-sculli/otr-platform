-- DropForeignKey
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_area_id_fkey";

-- DropForeignKey
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_ticket_type_id_fkey";

-- AlterTable
ALTER TABLE "tickets" ALTER COLUMN "area_id" DROP NOT NULL,
ALTER COLUMN "ticket_type_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
