import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

// Catálogo subestado → macroEstado de Prensa (HU Fase 2). Espejo de
// PRENSA_SUBESTADOS en @otr/types; inline acá porque el API no consume el
// paquete compartido en runtime.
const SUBESTADO_TO_MACRO: Record<string, string> = {
  STAND_BY: 'BACKLOG',
  PENDIENTE: 'BACKLOG',
  EN_CURSO: 'EN_PROGRESO',
  REV_SANTI: 'EN_REVISION',
  REV_MANU: 'EN_REVISION',
  ENVIADO_CLIENTE: 'EN_REVISION',
  A_PUBLICAR: 'FINALIZADO',
  LISTO: 'FINALIZADO',
  CANCELADO: 'FINALIZADO',
};

export async function ticketsRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  // List tickets with filters
  fastify.get('/', async (request) => {
    const { clientId, ownerId, status, speakerId, area, isDraftPlan } = request.query as {
      clientId?: string;
      ownerId?: string;
      status?: string;
      speakerId?: string;
      area?: string;
      isDraftPlan?: string;
    };

    const where: any = {};
    if (clientId) where.clientId = clientId;
    if (ownerId) where.ownerId = ownerId;
    if (status) where.status = status;
    if (speakerId) where.speakerId = speakerId;
    if (area) where.area = area;

    if (isDraftPlan === 'true') {
      where.isDraftPlan = true;
    } else if (isDraftPlan === 'false') {
      where.isDraftPlan = false;
    } else if (isDraftPlan === 'all') {
      // No filter on isDraftPlan: returns both drafts and active tickets
    } else {
      where.isDraftPlan = false;
    }

    const orderBy: any = (isDraftPlan === 'true' || isDraftPlan === 'all') 
      ? { plannedDate: 'asc' } 
      : { createdAt: 'desc' };

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true, email: true } },
        ticketType: { select: { id: true, name: true, kind: true } },
        pilar: { select: { id: true, nombre: true } },
        speaker: { select: { id: true, nombre: true } },
      },
      orderBy,
    });

    return { data: tickets };
  });

  // Get single ticket
  fastify.get('/:id', async (request) => {
    const { id } = request.params as { id: string };

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        client: true,
        owner: { select: { id: true, name: true, email: true } },
        ticketType: true,
        pilar: true,
        speaker: true,
        publication: true,
        references: {
          select: {
            id: true,
            title: true,
            status: true,
            ticketType: { select: { id: true, name: true, kind: true } },
          },
        },
      },
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    return { data: ticket };
  });

  // Create ticket
  fastify.post('/', async (request) => {
    const data = request.body as any;

    const ticket = await prisma.ticket.create({
      data: {
        title: data.title,
        description: data.referencias !== undefined ? data.referencias : data.description,
        objetivo: data.objetivo,
        canales: data.canales || (data.canal ? [data.canal] : []),
        prioridad: data.prioridad || 'MEDIA',
        clientId: data.clientId,
        ownerId: data.ownerId,
        ticketTypeId: data.ticketTypeId || null,
        pilarId: data.pilarId || null,
        speakerId: data.speakerId || null,
        status: data.status || 'PENDIENTE',
        area: data.area || 'CONTENIDO',
        subEstado: data.subEstado || null,
        macroEstado: (data.subEstado ? SUBESTADO_TO_MACRO[data.subEstado] : null) as any,
        medio: data.medio || null,
        periodista: data.periodista || null,
        estadoRespuesta: data.estadoRespuesta || null,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        plannedDate: data.plannedDate ? new Date(data.plannedDate) : null,
        isDraftPlan: data.isDraftPlan !== undefined ? data.isDraftPlan : false,
        estadoAprobacionCliente: data.estadoAprobacionCliente || 'BORRADOR',
        content: data.copy !== undefined ? data.copy : data.content,
        linkEntregable: data.linkPublicacionReal !== undefined ? data.linkPublicacionReal : data.linkEntregable,
        links: data.links || [],
      },
      include: {
        client: true,
        owner: { select: { id: true, name: true, email: true } },
        ticketType: true,
      },
    });

    return { data: ticket };
  });

  // Update ticket
  fastify.patch('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.referencias !== undefined) updateData.description = data.referencias;
    if (data.objetivo !== undefined) updateData.objetivo = data.objetivo;
    if (data.canales !== undefined) updateData.canales = data.canales;
    if (data.canal !== undefined) updateData.canales = [data.canal];
    if (data.contentPerCanal !== undefined) updateData.contentPerCanal = data.contentPerCanal;
    if (data.prioridad !== undefined) updateData.prioridad = data.prioridad;
    if (data.ownerId !== undefined) updateData.ownerId = data.ownerId;
    if (data.ticketTypeId !== undefined) updateData.ticketTypeId = data.ticketTypeId;
    if (data.pilarId !== undefined) updateData.pilarId = data.pilarId || null;
    if (data.speakerId !== undefined) updateData.speakerId = data.speakerId || null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.area !== undefined) updateData.area = data.area;
    if (data.subEstado !== undefined) {
      updateData.subEstado = data.subEstado || null;
      updateData.macroEstado = data.subEstado ? SUBESTADO_TO_MACRO[data.subEstado] : null;
    }
    if (data.medio !== undefined) updateData.medio = data.medio || null;
    if (data.periodista !== undefined) updateData.periodista = data.periodista || null;
    if (data.estadoRespuesta !== undefined) updateData.estadoRespuesta = data.estadoRespuesta || null;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.plannedDate !== undefined) updateData.plannedDate = data.plannedDate ? new Date(data.plannedDate) : null;
    if (data.isDraftPlan !== undefined) updateData.isDraftPlan = data.isDraftPlan;
    if (data.estadoAprobacionCliente !== undefined) updateData.estadoAprobacionCliente = data.estadoAprobacionCliente;
    if (data.publishedAt !== undefined) updateData.publishedAt = data.publishedAt ? new Date(data.publishedAt) : null;
    if (data.links !== undefined) updateData.links = data.links;
    if (data.linkEntregable !== undefined) updateData.linkEntregable = data.linkEntregable;
    if (data.linkPublicacionReal !== undefined) updateData.linkEntregable = data.linkPublicacionReal;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.copy !== undefined) updateData.content = data.copy;
    if (data.keywords !== undefined) updateData.keywords = data.keywords;
    if (data.copyFinal !== undefined) updateData.copyFinal = data.copyFinal;
    if (data.notasAudiovisual !== undefined) updateData.notasAudiovisual = data.notasAudiovisual;
    // Tickets de referencia (N:N) — máx 3, excluye self, dedup
    if (data.referenceIds !== undefined) {
      const ids = [...new Set(data.referenceIds as string[])]
        .filter((rid) => rid && rid !== id)
        .slice(0, 3);
      updateData.references = { set: ids.map((rid) => ({ id: rid })) };
    }

    const ticket = await prisma.ticket.update({
      where: { id },
      data: updateData,
      include: {
        client: true,
        owner: { select: { id: true, name: true, email: true } },
        ticketType: true,
        pilar: true,
        speaker: true,
        publication: true,
        references: {
          select: {
            id: true,
            title: true,
            status: true,
            ticketType: { select: { id: true, name: true, kind: true } },
          },
        },
      },
    });

    return { data: ticket };
  });

  // Delete ticket
  fastify.delete('/:id', async (request) => {
    const { id } = request.params as { id: string };

    await prisma.ticket.delete({ where: { id } });

    return { message: 'Ticket deleted successfully' };
  });

  // Create/update publication for ticket
  fastify.post('/:id/publication', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;

    const ticket = await prisma.ticket.findUnique({ where: { id }, select: { clientId: true } });
    if (!ticket) return reply.status(404).send({ error: 'Ticket no encontrado' });

    const publication = await prisma.publication.upsert({
      where: { ticketId: id },
      create: {
        ticketId: id,
        clientId: ticket.clientId,
        url: data.url,
        publishedAt: new Date(data.publishedAt),
        canal: data.canal || 'LinkedIn',
        insights: data.insights,
      },
      update: {
        url: data.url,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : undefined,
        canal: data.canal,
        insights: data.insights,
      },
    });

    return { data: publication };
  });

  // Save chat history for ticket
  fastify.patch('/:id/chat-history', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { messages } = request.body as { messages: { id: string; role: string; content: string }[] };

    const ticket = await prisma.ticket.update({
      where: { id },
      data: { chatHistory: messages },
      select: { id: true },
    });

    return { data: ticket };
  });

  // Get publication for ticket
  fastify.get('/:id/publication', async (request) => {
    const { id } = request.params as { id: string };

    const publication = await prisma.publication.findUnique({
      where: { ticketId: id },
    });

    if (!publication) {
      throw new Error('Publication not found');
    }

    return { data: publication };
  });

  // Bulk publish tickets to backlog (Sumario -> Backlog)
  fastify.post('/bulk-publish', async (request) => {
    const { ids } = request.body as { ids: string[] };
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return { count: 0 };
    }

    const result = await prisma.ticket.updateMany({
      where: { id: { in: ids } },
      data: {
        isDraftPlan: false,
        status: 'PENDIENTE',
      },
    });

    return { count: result.count };
  });

  // Bulk create draft tickets (Initialize Sumario)
  fastify.post('/bulk-create', async (request) => {
    const { tickets } = request.body as { tickets: any[] };

    if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
      return { count: 0 };
    }

    const created = [];
    for (const t of tickets) {
      const ticket = await prisma.ticket.create({
        data: {
          title: t.title || 'Contenido Planificado',
          description: t.description || t.referencias || null,
          canales: t.canales || (t.canal ? [t.canal] : []),
          clientId: t.clientId,
          ownerId: t.ownerId,
          ticketTypeId: t.ticketTypeId || null,
          pilarId: t.pilarId || null,
          speakerId: t.speakerId || null,
          status: t.status || 'PENDIENTE',
          area: 'CONTENIDO',
          plannedDate: t.plannedDate ? new Date(t.plannedDate) : null,
          isDraftPlan: t.isDraftPlan !== undefined ? t.isDraftPlan : true,
          estadoAprobacionCliente: t.estadoAprobacionCliente || 'BORRADOR',
          content: t.copy || t.content || null,
          linkEntregable: t.linkPublicacionReal || t.linkEntregable || null,
          keywords: t.keywords || null,
        }
      });
      created.push(ticket);
    }

    return { count: created.length, data: created };
  });

  // Bulk delete tickets (e.g. clear auto-generated drafts)
  fastify.post('/bulk-delete', async (request) => {
    const { ids } = request.body as { ids: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return { count: 0 };
    }

    const result = await prisma.ticket.deleteMany({
      where: { id: { in: ids } },
    });

    return { count: result.count };
  });

  // Bulk update tickets (e.g. set client approval in bulk)
  fastify.post('/bulk-update', async (request) => {
    const { ids, data } = request.body as { ids: string[]; data: any };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return { count: 0 };
    }

    const result = await prisma.ticket.updateMany({
      where: { id: { in: ids } },
      data,
    });

    return { count: result.count };
  });
}
