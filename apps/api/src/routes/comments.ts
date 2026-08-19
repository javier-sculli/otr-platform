import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const NICKNAMES: Record<string, string> = {
  joaco: 'joaquín',
  manu: 'manuela',
  javi: 'javier',
  sofi: 'sofía',
  santi: 'santiago',
  lore: 'lorena',
  nati: 'natalia',
  nahue: 'nahuel',
  palo: 'paloma',
  geo: 'georgina',
  agu: 'agustina',
  guada: 'guadalupe',
  shai: 'shaiel',
};

function normalizeStr(str: string) {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export async function commentsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // GET /tickets/:ticketId/comments
  fastify.get('/:ticketId/comments', async (request, reply) => {
    const { ticketId } = request.params as { ticketId: string };
    const comments = await prisma.ticketComment.findMany({
      where: { ticketId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return { data: comments };
  });

  // POST /tickets/:ticketId/comments
  fastify.post('/:ticketId/comments', async (request, reply) => {
    const { ticketId } = request.params as { ticketId: string };
    const { content } = request.body as { content: string };
    const user = (request as any).user;

    if (!content?.trim()) return reply.status(400).send({ error: 'Contenido requerido' });

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true, title: true } });
    if (!ticket) return reply.status(404).send({ error: 'Ticket no encontrado' });

    // Detectar @menciones en el contenido
    let mentionedIds: string[] = [];
    if (content.includes('@')) {
      const allUsers = await prisma.user.findMany({
        select: { id: true, name: true, email: true }
      });

      const matchedUserIds = new Set<string>();
      const normContent = normalizeStr(content);

      for (const u of allUsers) {
        if (u.id === user.id) continue; // Ignorar auto-mención

        const nameNorm = normalizeStr(u.name);
        const firstNameNorm = nameNorm.split(' ')[0];
        const emailPrefixNorm = normalizeStr(u.email ? u.email.split('@')[0] : '');

        // Construir candidatos de búsqueda para el usuario (nombre, primer nombre, email, apodos)
        const candidates = new Set<string>();
        if (nameNorm) candidates.add(nameNorm);
        if (firstNameNorm) candidates.add(firstNameNorm);
        if (emailPrefixNorm) candidates.add(emailPrefixNorm);

        for (const [nick, targetName] of Object.entries(NICKNAMES)) {
          const normTarget = normalizeStr(targetName);
          if (nameNorm === normTarget || firstNameNorm === normTarget || nameNorm.includes(normTarget)) {
            candidates.add(nick);
          }
        }

        // Probar los candidatos ordenados por longitud descendente para preferir nombres completos
        const sortedCandidates = Array.from(candidates).sort((a, b) => b.length - a.length);
        for (const cand of sortedCandidates) {
          if (!cand || cand.length < 2) continue;
          const escaped = cand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`@${escaped}(?=[^a-z0-9áéíóúñ]|\\s|$)`, 'i');
          if (regex.test(normContent)) {
            matchedUserIds.add(u.id);
            break;
          }
        }
      }
      mentionedIds = Array.from(matchedUserIds);
    }

    const comment = await prisma.ticketComment.create({
      data: { ticketId, userId: user.id, content, mentions: mentionedIds },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (mentionedIds.length > 0) {
      const senderId = user.id;
      setImmediate(async () => {
        try {
          const senderUser = await prisma.user.findUnique({
            where: { id: senderId },
            select: { name: true, email: true }
          });
          const senderName = senderUser?.name || senderUser?.email || user.email || 'Un usuario';
          const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000);

          for (const uid of mentionedIds) {
            const existingNotif = await prisma.notification.findFirst({
              where: {
                userId: uid,
                ticketId,
                type: 'MENTION',
                read: false,
                createdAt: { gte: twoMinAgo }
              }
            });
            if (existingNotif) {
              await prisma.notification.update({
                where: { id: existingNotif.id },
                data: {
                  fromName: senderName,
                  message: `${senderName} te mencionó en "${ticket.title}"`,
                  createdAt: new Date(),
                }
              });
            } else {
              await prisma.notification.create({
                data: {
                  userId: uid,
                  ticketId,
                  commentId: comment.id,
                  type: 'MENTION',
                  fromName: senderName,
                  message: `${senderName} te mencionó en "${ticket.title}"`,
                }
              });
            }
          }
        } catch (e) {
          // ignore background errors
        }
      });
    }

    return reply.status(201).send({ data: comment });
  });

  // DELETE /tickets/:ticketId/comments/:commentId
  fastify.delete('/:ticketId/comments/:commentId', async (request, reply) => {
    const { commentId } = request.params as { ticketId: string; commentId: string };
    const user = (request as any).user;

    const comment = await prisma.ticketComment.findUnique({ where: { id: commentId } });
    if (!comment) return reply.status(404).send({ error: 'Comentario no encontrado' });
    if (comment.userId !== user.id && user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Sin permiso' });
    }

    await prisma.ticketComment.delete({ where: { id: commentId } });
    return reply.status(204).send();
  });
}
