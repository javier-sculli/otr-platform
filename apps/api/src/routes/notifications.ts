import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const notifCache = new Map<string, { timestamp: number; data: any }>();
const NOTIF_TTL_MS = 10 * 1000; // 10 seconds TTL per user

export function clearUserNotificationsCache(userId?: string) {
  if (userId) {
    notifCache.delete(userId);
  } else {
    notifCache.clear();
  }
}

export async function notificationsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // GET /notifications
  fastify.get('/', async (request, reply) => {
    const user = (request as any).user;
    const cacheKey = user.id;

    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    const cached = notifCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < NOTIF_TTL_MS) {
      reply.header('x-cache', 'HIT');
      return cached.data;
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      include: { ticket: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const unreadCount = notifications.filter(n => !n.read).length;
    const result = { data: notifications, unreadCount };

    notifCache.set(cacheKey, { timestamp: Date.now(), data: result });
    reply.header('x-cache', 'MISS');
    return result;
  });

  // PATCH /notifications/:id/read
  fastify.patch('/:id/read', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;
    const n = await prisma.notification.findUnique({ where: { id } });
    if (!n || n.userId !== user.id) return reply.status(404).send({ error: 'No encontrado' });
    const updated = await prisma.notification.update({ where: { id }, data: { read: true } });
    
    clearUserNotificationsCache(user.id);
    return { data: updated };
  });

  // PATCH /notifications/read-all
  fastify.patch('/read-all', async (request) => {
    const user = (request as any).user;
    await prisma.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
    
    clearUserNotificationsCache(user.id);
    return { ok: true };
  });
}
