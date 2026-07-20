import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

console.log('--- Tickets mentioning "jeeves" in title/description/links (any client) ---');
const mentions = await prisma.ticket.findMany({
  where: {
    OR: [
      { title: { contains: 'jeeves', mode: 'insensitive' } },
      { description: { contains: 'jeeves', mode: 'insensitive' } },
    ],
  },
  include: { client: { select: { name: true, id: true } } },
  orderBy: { createdAt: 'desc' },
});
console.log('count:', mentions.length);
for (const t of mentions) {
  console.log(JSON.stringify({ id: t.id, title: t.title, client: t.client?.name, clientId: t.clientId, area: t.area }));
}

console.log('\n--- ALL tickets for BOTH Jeeves client ids (no filter on area) ---');
for (const id of ['1e63b5e0-f6e8-4084-b506-4a397b7b5623', 'b0bf900b-9967-478e-80af-cec82b7d0877']) {
  const tickets = await prisma.ticket.findMany({
    where: { clientId: id },
    select: { id: true, title: true, area: true, status: true, macroEstado: true, subEstado: true, isDraftPlan: true, createdAt: true },
  });
  console.log(`Client ${id}: ${tickets.length} tickets`);
  console.log(JSON.stringify(tickets, null, 2));
}

console.log('\n--- Any other tables referencing the ownerless Jeeves client id? (publications via ticket, comments, notifications) ---');
const orphanClientId = 'b0bf900b-9967-478e-80af-cec82b7d0877';
const ticketIds = (await prisma.ticket.findMany({ where: { clientId: orphanClientId }, select: { id: true } })).map(t => t.id);
console.log('ticketIds for orphan client:', ticketIds);

await prisma.$disconnect();
