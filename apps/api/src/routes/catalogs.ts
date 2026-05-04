import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export async function catalogsRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  // Get all clients
  fastify.get('/clients', async () => {
    const clients = await prisma.client.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
    return { data: clients };
  });

  // Get clients with ticket stats
  fastify.get('/clients/stats', async () => {
    const clients = await prisma.client.findMany({
      where: { active: true },
      include: {
        owner: { select: { id: true, name: true } },
        brandVoice: { select: { content: true } },
        tickets: {
          where: { status: { not: 'CANCELADO' } },
          select: { status: true },
        },
        _count: { select: { speakers: true } },
      },
      orderBy: { name: 'asc' },
    });

    const BRAND_VOICE_TOTAL = 11;

    const data = clients.map((client: typeof clients[number]) => {
      const tickets = client.tickets;
      const draft = tickets.filter((t: typeof tickets[number]) => t.status === 'BACKLOG' || t.status === 'BRIEF').length;
      const enRevision = tickets.filter((t: typeof tickets[number]) => t.status === 'REVISION').length;
      const programadas = tickets.filter((t: typeof tickets[number]) => t.status === 'APROBADO').length;

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
    if ((body as any).ownerId !== undefined) data.ownerId = (body as any).ownerId || null;
    const client = await prisma.client.update({ where: { id }, data });
    return { data: client };
  });

  // Archive a client (soft delete)
  fastify.delete('/clients/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.client.update({ where: { id }, data: { active: false } });
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

  // Get all users
  fastify.get('/users', async () => {
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
    return { data: users };
  });

  // Get all areas
  fastify.get('/areas', async () => {
    const areas = await prisma.area.findMany({
      orderBy: { name: 'asc' },
    });
    return { data: areas };
  });

  // Get all ticket types
  fastify.get('/ticket-types', async () => {
    const ticketTypes = await prisma.ticketType.findMany({
      orderBy: { name: 'asc' },
    });
    return { data: ticketTypes };
  });

  // ── Voceros ───────────────────────────────────────────────────────────────

  // Get all speakers across all clients
  fastify.get('/speakers', async () => {
    const speakers = await prisma.speaker.findMany({
      orderBy: [{ clientId: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, nombre: true, cargo: true, clientId: true, client: { select: { name: true } } },
    });
    return { data: speakers };
  });

  // Get all speakers for a client
  fastify.get('/clients/:id/speakers', async (request) => {
    const { id } = request.params as { id: string };
    const speakers = await prisma.speaker.findMany({
      where: { clientId: id },
      orderBy: { createdAt: 'asc' },
    });
    return { data: speakers };
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
