import { prisma } from '../lib/prisma.js';

function cleanHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function safeSlice(str: string, maxLength: number): string {
  if (!str) return '';
  return Array.from(str).slice(0, maxLength).join('');
}

async function syncClientContent(targetClientQuery?: string) {
  const whereClient = targetClientQuery
    ? {
        OR: [
          { id: targetClientQuery },
          { name: { contains: targetClientQuery, mode: 'insensitive' as const } },
        ],
      }
    : { active: true };

  const clients = await prisma.client.findMany({
    where: whereClient,
    select: { id: true, name: true },
  });

  if (clients.length === 0) {
    console.log(`❌ No se encontró ningún cliente con: "${targetClientQuery}"`);
    return;
  }

  for (const client of clients) {
    console.log(`\n🔄 Sincronizando contenidos históricos para: ${client.name} (${client.id})`);

    const existingDocs = await prisma.knowledgeDocument.findMany({
      where: { clientId: client.id, sourceUrl: { not: null } },
      select: { sourceUrl: true },
    });
    const existingUrls = new Set(existingDocs.map(d => d.sourceUrl!).filter(Boolean));

    const toInsert: Array<{
      clientId: string;
      speakerId?: string | null;
      title: string;
      type: string;
      tags: string[];
      content: string;
      summary?: string | null;
      date: Date;
      sourceUrl?: string | null;
    }> = [];

    // 1. Publicaciones scrapeadas o creadas
    const publications = await prisma.publication.findMany({
      where: { clientId: client.id, postContent: { not: null } },
      include: { ticket: { select: { id: true, title: true } } },
      orderBy: { publishedAt: 'desc' },
    });

    for (const pub of publications) {
      if (!pub.postContent || pub.postContent.trim().length < 15) continue;
      if (pub.url && existingUrls.has(pub.url)) continue;

      const lines = pub.postContent.trim().split('\n').map(l => l.trim()).filter(Boolean);
      const hookTitle = lines[0] ? safeSlice(lines[0], 75) : 'Publicación en redes';
      const title = pub.ticket?.title ? `${pub.ticket.title}` : hookTitle;

      const canalTag = (pub.canal || 'general').toLowerCase();
      const tags = Array.from(new Set([canalTag, ...(pub.tags || [])]));

      toInsert.push({
        clientId: client.id,
        speakerId: pub.speakerId || null,
        title,
        type: 'POST',
        tags,
        content: pub.postContent.trim(),
        summary: pub.insights || (lines.slice(0, 2).join(' ') || null),
        date: pub.publishedAt ? new Date(pub.publishedAt) : new Date(),
        sourceUrl: pub.url || null,
      });

      if (pub.url) existingUrls.add(pub.url);
    }

    // 2. Tickets finalizados con contentPerCanal
    const ingestedTicketIds = new Set(publications.map(p => p.ticketId).filter(Boolean));
    const tickets = await prisma.ticket.findMany({
      where: {
        clientId: client.id,
        id: { notIn: Array.from(ingestedTicketIds) as string[] },
        status: { in: ['PUBLICADO', 'LISTO_PARA_PUBLICAR', 'LISTO', 'CLIENTE'] },
      },
      select: {
        id: true,
        title: true,
        objetivo: true,
        contentPerCanal: true,
        linkPublicacion: true,
        dueDate: true,
        publishedAt: true,
        createdAt: true,
        speakerId: true,
        tiposContenido: true,
      },
    });

    for (const ticket of tickets) {
      if (!ticket.contentPerCanal || typeof ticket.contentPerCanal !== 'object') continue;

      for (const [canal, rawHtml] of Object.entries(ticket.contentPerCanal as Record<string, string>)) {
        if (typeof rawHtml !== 'string') continue;
        const text = cleanHtml(rawHtml);
        if (text.length < 25) continue;

        const ticketSourceKey = ticket.linkPublicacion || `ticket:${ticket.id}:${canal.toLowerCase()}`;
        if (existingUrls.has(ticketSourceKey)) continue;

        const canalTag = canal.toLowerCase();
        const tags = Array.from(new Set([canalTag, ...(ticket.tiposContenido || [])]));

        toInsert.push({
          clientId: client.id,
          speakerId: ticket.speakerId || null,
          title: ticket.title,
          type: 'POST',
          tags,
          content: text,
          summary: ticket.objetivo || null,
          date: ticket.publishedAt ? new Date(ticket.publishedAt) : (ticket.dueDate ? new Date(ticket.dueDate) : new Date(ticket.createdAt)),
          sourceUrl: ticket.linkPublicacion || null,
        });

        existingUrls.add(ticketSourceKey);
      }
    }

    if (toInsert.length > 0) {
      const result = await prisma.knowledgeDocument.createMany({
        data: toInsert,
      });
      console.log(`✅ ${result.count} documentos de contenidos históricos inyectados en la Knowledge Base de ${client.name}.`);
    } else {
      console.log(`ℹ️ No hay contenidos nuevos para inyectar en ${client.name} (ya estaban al día).`);
    }
  }
}

const target = process.argv[2];
syncClientContent(target)
  .then(() => {
    console.log('\n🎉 Sincronización completada.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error en sincronización:', err);
    process.exit(1);
  });
