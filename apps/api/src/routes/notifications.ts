import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export async function notificationsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // GET /notifications
  fastify.get('/', async (request) => {
    const user = (request as any).user;
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const unreadCount = notifications.filter(n => !n.read).length;
    return { data: notifications, unreadCount };
  });

  // PATCH /notifications/:id/read
  fastify.patch('/:id/read', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;
    const n = await prisma.notification.findUnique({ where: { id } });
    if (!n || n.userId !== user.id) return reply.status(404).send({ error: 'No encontrado' });
    const updated = await prisma.notification.update({ where: { id }, data: { read: true } });
    return { data: updated };
  });

  // PATCH /notifications/read-all
  fastify.patch('/read-all', async (request) => {
    const user = (request as any).user;
    await prisma.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
    return { ok: true };
  });
}
