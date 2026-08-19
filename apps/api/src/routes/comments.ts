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

    // Detectar @menciones: palabras que empiecen con @
    const rawTokens = [...content.matchAll(/@([\w\sáéíóúÁÉÍÓÚñÑ]+?)(?=[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]|$)/g)]
      .map(m => m[1].trim().toLowerCase())
      .filter(t => t.length >= 2);

    let mentionedIds: string[] = [];
    if (rawTokens.length > 0) {
      const allUsers = await prisma.user.findMany({
        select: { id: true, name: true, email: true }
      });

      const matchedUserIds = new Set<string>();
      for (const rawToken of rawTokens) {
        const normRaw = normalizeStr(rawToken);
        const resolvedTarget = NICKNAMES[normRaw] ? normalizeStr(NICKNAMES[normRaw]) : normRaw;

        for (const u of allUsers) {
          if (u.id === user.id) continue; // Ignorar auto-mención
          const nameNorm = normalizeStr(u.name);
          const emailNorm = normalizeStr(u.email);
          const firstNameNorm = nameNorm.split(' ')[0];

          if (
            nameNorm === resolvedTarget ||
            firstNameNorm === resolvedTarget ||
            nameNorm.includes(resolvedTarget) ||
            emailNorm.startsWith(resolvedTarget)
          ) {
            matchedUserIds.add(u.id);
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
      let senderName = user.name || user.email;
      setImmediate(async () => {
        try {
          if (!senderName && user.id) {
            const senderUser = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, email: true } });
            senderName = senderUser?.name || senderUser?.email || 'Un usuario';
          }
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
