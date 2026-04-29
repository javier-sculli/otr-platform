import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { syncLinkedInMetrics } from '../jobs/syncLinkedInMetrics.js';

export async function metricsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // GET /metrics?clientId=xxx&highlight=true&canal=LinkedIn
  fastify.get('/', async (request) => {
    const { clientId, highlight, canal } = request.query as { clientId?: string; highlight?: string; canal?: string };

    const where: Record<string, unknown> = {};
    if (clientId) where.clientId = clientId;
    if (highlight === 'true') where.isHighlight = true;
    if (canal) where.canal = { equals: canal, mode: 'insensitive' };

    const publications = await prisma.publication.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        ticket: {
          select: { id: true, title: true, clientId: true, canales: true },
        },
        snapshots: {
          orderBy: { dayNumber: 'asc' },
        },
      },
      orderBy: { publishedAt: 'desc' },
    });

    return { data: publications };
  });

  // GET /metrics/:publicationId — detalle de una publication con snapshots
  fastify.get('/:publicationId', async (request, reply) => {
    const { publicationId } = request.params as { publicationId: string };

    const publication = await prisma.publication.findUnique({
      where: { id: publicationId },
      include: {
        ticket: {
          select: { id: true, title: true, clientId: true, canales: true, client: true },
        },
        snapshots: {
          orderBy: { dayNumber: 'asc' },
        },
      },
    });

    if (!publication) return reply.status(404).send({ error: 'No encontrado' });
    return { data: publication };
  });

  // PATCH /metrics/:publicationId — editar campos manuales (insight, tags, isHighlight)
  fastify.patch('/:publicationId', async (request, reply) => {
    const { publicationId } = request.params as { publicationId: string };
    const body = request.body as {
      isHighlight?: boolean;
      tags?: string[];
      insights?: string;
      url?: string;
      publishedAt?: string;
      canal?: string;
    };

    const data: any = {};
    if (body.isHighlight !== undefined) data.isHighlight = body.isHighlight;
    if (body.tags !== undefined) data.tags = body.tags;
    if (body.insights !== undefined) data.insights = body.insights;
    if (body.url !== undefined) data.url = body.url;
    if (body.publishedAt !== undefined) data.publishedAt = new Date(body.publishedAt);
    if (body.canal !== undefined) data.canal = body.canal;

    const publication = await prisma.publication.update({
      where: { id: publicationId },
      data,
      include: { snapshots: { orderBy: { dayNumber: 'asc' } } },
    });

    return { data: publication };
  });

  // POST /metrics/:publicationId/snapshots — agregar snapshot manual
  fastify.post('/:publicationId/snapshots', async (request, reply) => {
    const { publicationId } = request.params as { publicationId: string };
    const { dayNumber, likes, comments, shares } = request.body as {
      dayNumber: number;
      likes: number;
      comments: number;
      shares: number;
    };

    if (dayNumber === undefined || likes === undefined) {
      return reply.status(400).send({ error: 'dayNumber, likes son requeridos' });
    }

    const snapshot = await prisma.postMetricSnapshot.upsert({
      where: { publicationId_dayNumber: { publicationId, dayNumber } },
      create: { publicationId, dayNumber, likes, comments: comments ?? 0, shares: shares ?? 0 },
      update: { likes, comments: comments ?? 0, shares: shares ?? 0, takenAt: new Date() },
    });

    return { data: snapshot };
  });

  // POST /metrics/sync — trigger manual del scraper (opcionalmente para un cliente)
  fastify.post('/sync', async (request) => {
    const { clientId } = request.body as { clientId?: string };

    // Corre async, no bloquea la respuesta
    syncLinkedInMetrics(clientId).catch(err =>
      console.error('[metrics/sync] Error:', err)
    );

    return { message: 'Sync iniciado' };
  });
}
