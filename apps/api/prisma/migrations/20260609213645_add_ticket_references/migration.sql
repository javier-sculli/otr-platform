-- CreateTable
CREATE TABLE "_TicketReferences" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_TicketReferences_AB_unique" ON "_TicketReferences"("A", "B");

-- CreateIndex
CREATE INDEX "_TicketReferences_B_index" ON "_TicketReferences"("B");

-- AddForeignKey
ALTER TABLE "_TicketReferences" ADD CONSTRAINT "_TicketReferences_A_fkey" FOREIGN KEY ("A") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TicketReferences" ADD CONSTRAINT "_TicketReferences_B_fkey" FOREIGN KEY ("B") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
