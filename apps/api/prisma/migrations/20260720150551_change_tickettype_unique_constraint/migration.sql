/*
  Warnings:

  - A unique constraint covering the columns `[name,kind]` on the table `ticket_types` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ticket_types_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "ticket_types_name_kind_key" ON "ticket_types"("name", "kind");
