import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const catalogRouteCache = new Map<string, { timestamp: number; data: any }>();
const CATALOG_ROUTE_TTL_MS = 10 * 60 * 1000;

export function clearCatalogRouteCache() {
  catalogRouteCache.clear();
}

export async function catalogsRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  // Get all clients
  fastify.get('/clients', async (request, reply) => {
    const { includeArchived } = request.query as { includeArchived?: string };
    const cacheKey = `clients_${includeArchived}`;
    reply.header('Cache-Control', 'public, max-age=600, stale-while-revalidate=3600');
    const cached = catalogRouteCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CATALOG_ROUTE_TTL_MS) {
      reply.header('x-cache', 'HIT');
      return cached.data;
    }

    const where = includeArchived === 'true' ? {} : { active: true };
    const clients = await prisma.client.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    const result = { data: clients };
    catalogRouteCache.set(cacheKey, { timestamp: Date.now(), data: result });
    reply.header('x-cache', 'MISS');
    return result;
  });

  // Get clients with ticket stats
  fastify.get('/clients/stats', async (request) => {
    const { includeArchived } = request.query as { includeArchived?: string };
    const where = includeArchived === 'true' ? {} : { active: true };
    const clients = await prisma.client.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true } },
        brandVoice: { select: { content: true } },
        tickets: {
          where: { status: { notIn: ['CANCELADO', 'LISTO'] } },
          select: { status: true },
        },
        _count: { select: { speakers: true } },
      },
      orderBy: { name: 'asc' },
    });

    const BRAND_VOICE_TOTAL = 11;

    const data = clients.map((client: typeof clients[number]) => {
      const tickets = client.tickets;
      const draft = tickets.filter((t: typeof tickets[number]) => t.status === 'PENDIENTE' || t.status === 'REDACCION').length;
      const enRevision = tickets.filter((t: typeof tickets[number]) => t.status === 'REVISION_INTERNA' || t.status === 'CLIENTE' || t.status === 'ESPERANDO_FEEDBACK').length;
      const programadas = tickets.filter((t: typeof tickets[number]) => t.status === 'LISTO_PARA_PUBLICAR').length;

      // Brand voice completitud
      const bvContent = (client.brandVoice?.content ?? {}) as Record<string, string>;
      const bvFilled = Object.values(bvContent).filter(v => typeof v === 'string' && v.trim().length > 0).length;
      const brandKitCompletitud = Math.round((bvFilled / BRAND_VOICE_TOTAL) * 100);

      return {
        id: client.id,
        name: client.name,
        active: client.active,
        canales: client.canales,
        linkedinUrl: client.linkedinUrl,
        owner: client.owner,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
        brandKit: { completitud: brandKitCompletitud },
        voceros: client._count.speakers,
        contenido: { draft, enRevision, programadas },
      };
    });

    return { data };
  });

  // Create a new client
  fastify.post('/clients', async (request) => {
    const { name, ownerId, canales } = request.body as {
      name: string;
      ownerId?: string;
      canales?: string[];
    };
    const client = await prisma.client.create({
      data: { name, ownerId, canales: canales ?? [] },
      include: { owner: { select: { id: true, name: true } } },
    });
    return { data: client };
  });

  // Update client
  fastify.patch('/clients/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      linkedinUrl?: string;
      instagramUrl?: string;
      twitterUrl?: string;
      tiktokUrl?: string;
      webUrl?: string;
      newsletterUrl?: string;
      blogUrl?: string;
      name?: string;
      canales?: string[];
      monthlyContentTarget?: number;
    };
    const data: any = {};
    if (body.linkedinUrl !== undefined) data.linkedinUrl = body.linkedinUrl || null;
    if (body.instagramUrl !== undefined) data.instagramUrl = body.instagramUrl || null;
    if (body.twitterUrl !== undefined) data.twitterUrl = body.twitterUrl || null;
    if (body.tiktokUrl !== undefined) data.tiktokUrl = body.tiktokUrl || null;
    if (body.webUrl !== undefined) data.webUrl = body.webUrl || null;
    if (body.newsletterUrl !== undefined) data.newsletterUrl = body.newsletterUrl || null;
    if (body.blogUrl !== undefined) data.blogUrl = body.blogUrl || null;
    if (body.name !== undefined) data.name = body.name;
    if (body.canales !== undefined) data.canales = body.canales;
    if (body.monthlyContentTarget !== undefined) data.monthlyContentTarget = body.monthlyContentTarget;
    if ((body as any).ownerId !== undefined) data.ownerId = (body as any).ownerId || null;
    const client = await prisma.client.update({ where: { id }, data });
    return { data: client };
  });

  // Archive a client (soft delete) or hard delete
  fastify.delete('/clients/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { hard } = request.query as { hard?: string };

    if (hard === 'true') {
      await prisma.$transaction([
        prisma.postMetricSnapshot.deleteMany({ where: { publication: { clientId: id } } }),
        prisma.publication.deleteMany({ where: { clientId: id } }),
        prisma.ticketComment.deleteMany({ where: { ticket: { clientId: id } } }),
        prisma.notification.deleteMany({ where: { ticket: { clientId: id } } }),
        prisma.ticket.deleteMany({ where: { clientId: id } }),
        prisma.speaker.deleteMany({ where: { clientId: id } }),
        prisma.pilar.deleteMany({ where: { clientId: id } }),
        prisma.brandVoice.deleteMany({ where: { clientId: id } }),
        prisma.pressReference.deleteMany({ where: { clientId: id } }),
        prisma.client.delete({ where: { id } }),
      ]);
    } else {
      await prisma.client.update({ where: { id }, data: { active: false } });
    }
    reply.code(204).send();
  });

  // Get brand voice for a client
  fastify.get('/clients/:id/brand-voice', async (request, reply) => {
    const { id } = request.params as { id: string };
    const brandVoice = await prisma.brandVoice.findUnique({ where: { clientId: id } });
    return { data: brandVoice?.content ?? {} };
  });

  // Save (upsert) brand voice for a client
  fastify.put('/clients/:id/brand-voice', async (request) => {
    const { id } = request.params as { id: string };
    const { content } = request.body as { content: Record<string, string> };
    const brandVoice = await prisma.brandVoice.upsert({
      where: { clientId: id },
      create: { clientId: id, content },
      update: { content },
    });
    return { data: brandVoice.content };
  });

  // Get press references for a client
  fastify.get('/clients/:id/press-references', async (request) => {
    const { id } = request.params as { id: string };
    const refs = await prisma.pressReference.findMany({
      where: { clientId: id },
    });
    return { data: refs };
  });

  // Save/upsert press reference for a client
  fastify.put('/clients/:id/press-references', async (request) => {
    const { id } = request.params as { id: string };
    const { type, content } = request.body as { type: string; content: string };
    const ref = await prisma.pressReference.upsert({
      where: {
        clientId_type: {
          clientId: id,
          type,
        },
      },
      create: {
        clientId: id,
        type,
        content,
      },
      update: {
        content,
      },
    });
    return { data: ref };
  });

  // Get all users
  fastify.get('/users', async (request, reply) => {
    const cacheKey = 'users';
    reply.header('Cache-Control', 'public, max-age=600, stale-while-revalidate=3600');
    const cached = catalogRouteCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CATALOG_ROUTE_TTL_MS) {
      reply.header('x-cache', 'HIT');
      return cached.data;
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        areaId: true,
        area: true,
      },
      orderBy: { name: 'asc' },
    });
    const result = { data: users };
    catalogRouteCache.set(cacheKey, { timestamp: Date.now(), data: result });
    reply.header('x-cache', 'MISS');
    return result;
  });

  // Get all areas
  fastify.get('/areas', async (request, reply) => {
    const cacheKey = 'areas';
    reply.header('Cache-Control', 'public, max-age=600, stale-while-revalidate=3600');
    const cached = catalogRouteCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CATALOG_ROUTE_TTL_MS) {
      reply.header('x-cache', 'HIT');
      return cached.data;
    }

    const areas = await prisma.area.findMany({
      orderBy: { name: 'asc' },
    });
    const result = { data: areas };
    catalogRouteCache.set(cacheKey, { timestamp: Date.now(), data: result });
    reply.header('x-cache', 'MISS');
    return result;
  });

  // Get all ticket types
  fastify.get('/ticket-types', async (request, reply) => {
    const cacheKey = 'ticket-types';
    reply.header('Cache-Control', 'public, max-age=600, stale-while-revalidate=3600');
    const cached = catalogRouteCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CATALOG_ROUTE_TTL_MS) {
      reply.header('x-cache', 'HIT');
      return cached.data;
    }

    const defaultContenidoTypes = [
      'Carrusel',
      'Imagen Gráfica',
      'Story',
      'Reel',
      'Video',
      'Artículo Blog',
      'Hilo',
      'Texto',
      'Repost',
      'Newsletter',
    ];

    try {
      // Auto-migración: migrar 'Imagen', 'Placa con diseño' y variantes legadas a 'Imagen Gráfica'
      const legacyMerged = await prisma.ticketType.findMany({
        where: {
          kind: 'CONTENIDO',
          OR: [
            { name: { equals: 'Imagen', mode: 'insensitive' } },
            { name: { equals: 'Imagen sola', mode: 'insensitive' } },
            { name: { equals: 'Imagen estática', mode: 'insensitive' } },
            { name: { equals: 'Imagen estatica', mode: 'insensitive' } },
            { name: { equals: 'Placa con diseño', mode: 'insensitive' } },
            { name: { equals: 'Placa con diseno', mode: 'insensitive' } },
            { name: { equals: 'Placa', mode: 'insensitive' } },
            { name: { equals: 'Gráfica', mode: 'insensitive' } },
            { name: { equals: 'Grafica', mode: 'insensitive' } },
            {
              AND: [
                { name: { contains: 'imagen', mode: 'insensitive' } },
                { name: { contains: 'grafica', mode: 'insensitive' } },
              ],
            },
            {
              AND: [
                { name: { contains: 'imagen', mode: 'insensitive' } },
                { name: { contains: 'gráfica', mode: 'insensitive' } },
              ],
            },
            { name: { contains: 'imagen /', mode: 'insensitive' } },
            { name: { contains: 'imagen (', mode: 'insensitive' } },
          ],
          NOT: [
            { name: 'Imagen Gráfica' },
          ],
        },
      });

      if (legacyMerged.length > 0) {
        let targetType = await prisma.ticketType.findFirst({
          where: { name: 'Imagen Gráfica', kind: 'CONTENIDO' },
        });
        if (!targetType) {
          targetType = await prisma.ticketType.create({
            data: { name: 'Imagen Gráfica', kind: 'CONTENIDO' },
          });
        }

        const legacyIds = legacyMerged.map((t) => t.id);
        await prisma.ticket.updateMany({
          where: { ticketTypeId: { in: legacyIds } },
          data: { ticketTypeId: targetType.id },
        });
        await prisma.ticketType.deleteMany({
          where: { id: { in: legacyIds } },
        });
      }

      // Auto-migración: migrar 'Texto solo' y variantes legadas a 'Texto'
      const legacyTexto = await prisma.ticketType.findMany({
        where: {
          kind: 'CONTENIDO',
          OR: [
            { name: { equals: 'Texto solo', mode: 'insensitive' } },
            { name: { equals: 'Texto Solo', mode: 'insensitive' } },
            { name: { equals: 'Texto-solo', mode: 'insensitive' } },
          ],
          NOT: [
            { name: 'Texto' },
          ],
        },
      });

      if (legacyTexto.length > 0) {
        let textoType = await prisma.ticketType.findFirst({
          where: { name: 'Texto', kind: 'CONTENIDO' },
        });
        if (!textoType) {
          textoType = await prisma.ticketType.create({
            data: { name: 'Texto', kind: 'CONTENIDO' },
          });
        }

        const legacyTextoIds = legacyTexto.map((t) => t.id);
        await prisma.ticket.updateMany({
          where: { ticketTypeId: { in: legacyTextoIds } },
          data: { ticketTypeId: textoType.id },
        });
        await prisma.ticketType.deleteMany({
          where: { id: { in: legacyTextoIds } },
        });
      }

      // Limpieza explícita de cualquier ticketType redundante de CONTENIDO
      await prisma.ticketType.deleteMany({
        where: {
          kind: 'CONTENIDO',
          name: {
            in: [
              'Imagen', 'imagen', 'Imagen sola', 'Imagen estática', 'Imagen estatica',
              'Placa con diseño', 'Placa con diseno', 'Placa', 'Gráfica', 'Grafica',
              'Texto solo', 'Texto Solo', 'Texto-solo', 'texto solo',
            ],
          },
        },
      });

      const existing = await prisma.ticketType.findMany({ select: { name: true, kind: true } });
      const existingSet = new Set(existing.map((e) => `${e.kind}:${e.name.toLowerCase()}`));

      for (const name of defaultContenidoTypes) {
        if (!existingSet.has(`CONTENIDO:${name.toLowerCase()}`)) {
          await prisma.ticketType.upsert({
            where: { name_kind: { name, kind: 'CONTENIDO' } },
            update: {},
            create: { name, kind: 'CONTENIDO' },
          });
        }
      }
    } catch (err) {
      console.error('Error auto-seeding default ticket types:', err);
    }

    const ticketTypes = await prisma.ticketType.findMany({
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    });
    const result = { data: ticketTypes };
    catalogRouteCache.set(cacheKey, { timestamp: Date.now(), data: result });
    reply.header('x-cache', 'MISS');
    return result;
  });

  // ── Voceros ───────────────────────────────────────────────────────────────

  // Get all speakers across all clients
  fastify.get('/speakers', async (request, reply) => {
    const cacheKey = 'speakers_all';
    reply.header('Cache-Control', 'public, max-age=600, stale-while-revalidate=3600');
    const cached = catalogRouteCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CATALOG_ROUTE_TTL_MS) {
      reply.header('x-cache', 'HIT');
      return cached.data;
    }

    const speakers = await prisma.speaker.findMany({
      orderBy: [{ clientId: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, nombre: true, cargo: true, clientId: true, client: { select: { name: true } } },
    });
    const result = { data: speakers };
    catalogRouteCache.set(cacheKey, { timestamp: Date.now(), data: result });
    reply.header('x-cache', 'MISS');
    return result;
  });

  // Get all speakers for a client
  fastify.get('/clients/:id/speakers', async (request, reply) => {
    const { id } = request.params as { id: string };
    const cacheKey = `speakers_${id}`;
    reply.header('Cache-Control', 'public, max-age=600, stale-while-revalidate=3600');
    const cached = catalogRouteCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CATALOG_ROUTE_TTL_MS) {
      reply.header('x-cache', 'HIT');
      return cached.data;
    }

    const speakers = await prisma.speaker.findMany({
      where: { clientId: id },
      orderBy: { createdAt: 'asc' },
    });
    const result = { data: speakers };
    catalogRouteCache.set(cacheKey, { timestamp: Date.now(), data: result });
    reply.header('x-cache', 'MISS');
    return result;
  });

  // Create speaker
  fastify.post('/clients/:id/speakers', async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as { nombre: string; cargo?: string; linkedinUrl?: string };
    const speaker = await prisma.speaker.create({
      data: {
        clientId: id,
        nombre: body.nombre,
        cargo: body.cargo || null,
        linkedinUrl: body.linkedinUrl || null,
        canalesHabilitados: { linkedin: !!body.linkedinUrl },
      },
    });
    return { data: speaker };
  });

  // Update speaker
  fastify.patch('/clients/:clientId/speakers/:speakerId', async (request, reply) => {
    const { clientId, speakerId } = request.params as { clientId: string; speakerId: string };
    const body = request.body as {
      nombre?: string;
      cargo?: string;
      linkedinUrl?: string;
      instagramUrl?: string;
      twitterUrl?: string;
      tiktokUrl?: string;
      newsletterUrl?: string;
      blogUrl?: string;
      canalesHabilitados?: Record<string, boolean>;
      personalidadArquetipo?: string;
      tonoVozPersonal?: string;
      contextoExperiencia?: string;
      temasHabla?: string;
      posicionamientoOpinion?: string;
      estructuraNarrativa?: string;
      usoIdioma?: string;
      criteriosCalidad?: string;
      contextoMarca?: string;
    };

    const existing = await prisma.speaker.findFirst({ where: { id: speakerId, clientId } });
    if (!existing) return reply.status(404).send({ error: 'Speaker not found' });

    const data: any = {};
    const strFields = [
      'nombre', 'cargo', 'linkedinUrl', 'instagramUrl', 'twitterUrl',
      'tiktokUrl', 'newsletterUrl', 'blogUrl',
      'personalidadArquetipo', 'tonoVozPersonal', 'contextoExperiencia',
      'temasHabla', 'posicionamientoOpinion', 'estructuraNarrativa',
      'usoIdioma', 'criteriosCalidad', 'contextoMarca',
    ] as const;
    for (const field of strFields) {
      if (body[field] !== undefined) data[field] = body[field] || null;
    }
    if (body.canalesHabilitados !== undefined) data.canalesHabilitados = body.canalesHabilitados;

    const speaker = await prisma.speaker.update({ where: { id: speakerId }, data });
    return { data: speaker };
  });

  // ── Pilares ───────────────────────────────────────────────────────────────

  // Get all pilares for a client
  fastify.get('/clients/:id/pilares', async (request) => {
    const { id } = request.params as { id: string };
    const pilares = await prisma.pilar.findMany({
      where: { clientId: id },
      orderBy: { createdAt: 'asc' },
    });
    return { data: pilares };
  });

  // Create pilar
  fastify.post('/clients/:id/pilares', async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as { nombre: string; descripcion?: string };
    const pilar = await prisma.pilar.create({
      data: { clientId: id, nombre: body.nombre, descripcion: body.descripcion || null },
    });
    return { data: pilar };
  });

  // Update pilar
  fastify.patch('/clients/:clientId/pilares/:pilarId', async (request, reply) => {
    const { clientId, pilarId } = request.params as { clientId: string; pilarId: string };
    const body = request.body as { nombre?: string; descripcion?: string };
    const existing = await prisma.pilar.findFirst({ where: { id: pilarId, clientId } });
    if (!existing) return reply.status(404).send({ error: 'Pilar not found' });
    const pilar = await prisma.pilar.update({
      where: { id: pilarId },
      data: { nombre: body.nombre ?? existing.nombre, descripcion: body.descripcion !== undefined ? (body.descripcion || null) : existing.descripcion },
    });
    return { data: pilar };
  });

  // Delete pilar
  fastify.delete('/clients/:clientId/pilares/:pilarId', async (request, reply) => {
    const { clientId, pilarId } = request.params as { clientId: string; pilarId: string };
    const existing = await prisma.pilar.findFirst({ where: { id: pilarId, clientId } });
    if (!existing) return reply.status(404).send({ error: 'Pilar not found' });
    await prisma.pilar.delete({ where: { id: pilarId } });
    reply.code(204).send();
  });

  // Delete speaker
  fastify.delete('/clients/:clientId/speakers/:speakerId', async (request, reply) => {
    const { clientId, speakerId } = request.params as { clientId: string; speakerId: string };
    const existing = await prisma.speaker.findFirst({ where: { id: speakerId, clientId } });
    if (!existing) return reply.status(404).send({ error: 'Speaker not found' });
    await prisma.speaker.delete({ where: { id: speakerId } });
    reply.code(204).send();
  });
}
