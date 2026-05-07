import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

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
    const mentionNames = [...content.matchAll(/@([\w\sáéíóúÁÉÍÓÚñÑ]+?)(?=[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]|$)/g)]
      .map(m => m[1].trim().toLowerCase());

    let mentionedIds: string[] = [];
    if (mentionNames.length > 0) {
      const mentionedUsers = await prisma.user.findMany({
        where: { name: { in: mentionNames.map(n => n), mode: 'insensitive' } },
        select: { id: true, name: true },
      });
      mentionedIds = mentionedUsers.map(u => u.id).filter(id => id !== user.id);

      // Crear notificaciones para cada mencionado
      if (mentionedIds.length > 0) {
        await prisma.notification.createMany({
          data: mentionedIds.map(uid => ({
            userId: uid,
            ticketId,
            fromName: user.name,
            message: `${user.name} te mencionó en "${ticket.title}"`,
          })),
        });
      }
    }

    const comment = await prisma.ticketComment.create({
      data: { ticketId, userId: user.id, content, mentions: mentionedIds },
      include: { user: { select: { id: true, name: true } } },
    });

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
