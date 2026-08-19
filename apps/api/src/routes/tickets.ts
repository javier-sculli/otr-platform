import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

// Catálogo subestado → macroEstado de Prensa (HU Fase 2). Espejo de
// PRENSA_SUBESTADOS en @otr/types; inline acá porque el API no consume el
// paquete compartido en runtime.
const SUBESTADO_TO_MACRO: Record<string, string> = {
  PENDIENTE: 'BACKLOG',
  EN_CURSO: 'EN_PROGRESO',
  REVISION_INTERNA: 'EN_REVISION',
  ENVIADO_CLIENTE: 'EN_REVISION',
  LISTO: 'FINALIZADO',
};

function parseApiDate(val: string | null | undefined): Date | null {
  if (!val) return null;
  const str = String(val).trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(`${str}T12:00:00.000Z`);
  }
  return new Date(str);
}

const STATUS_DISPLAY_NAMES: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  REDACCION: 'Redacción',
  DISENO: 'Diseño',
  EDICION: 'Edición',
  REVISION_INTERNA: 'Revisión interna',
  CLIENTE: 'Cliente',
  ESPERANDO_FEEDBACK: 'Esperando feedback',
  LISTO_PARA_PUBLICAR: 'Listo para publicar',
  PUBLICADO: 'Publicado',
  CANCELADO: 'Cancelado',
  LISTO: 'Listo',
  EN_CURSO: 'En curso',
  ENVIADO_CLIENTE: 'Enviado al cliente',
  PENDIENTE_PUBLICACION: 'Pendiente de publicación',
};

async function notifyOrCoalesce({
  userId,
  ticketId,
  type,
  fromName,
  message,
}: {
  userId: string;
  ticketId: string;
  type: 'ASSIGNED' | 'STATUS_CHANGE' | 'MENTION';
  fromName: string;
  message: string;
}) {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      ticketId,
      type,
      read: false,
      createdAt: { gte: fiveMinAgo },
    },
  });

  if (existing) {
    await prisma.notification.update({
      where: { id: existing.id },
      data: {
        fromName,
        message,
        createdAt: new Date(),
      },
    });
  } else {
    await prisma.notification.create({
      data: {
        userId,
        ticketId,
        type,
        fromName,
        message,
      },
    });
  }
}

async function attachAssignees(tickets: any[]) {
  if (!tickets || tickets.length === 0) return tickets;
  const missingUserIds = new Set<string>();

  tickets.forEach(t => {
    const knownUsers = new Map<string, any>();
    if (t.owner?.id) knownUsers.set(t.owner.id, t.owner);
    if (t.reviewer?.id) knownUsers.set(t.reviewer.id, t.reviewer);

    if (Array.isArray(t.assigneeIds) && t.assigneeIds.length > 0) {
      t.assigneeIds.forEach((id: string) => {
        if (id && !knownUsers.has(id)) missingUserIds.add(id);
      });
    }
    if (t.ownerId && !knownUsers.has(t.ownerId)) {
      missingUserIds.add(t.ownerId);
    }
  });

  const usersMap = new Map<string, any>();
  if (missingUserIds.size > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(missingUserIds) } },
      select: { id: true, name: true, email: true, role: true },
    });
    users.forEach(u => usersMap.set(u.id, u));
  }

  return tickets.map(t => {
    const knownUsers = new Map<string, any>();
    if (t.owner?.id) knownUsers.set(t.owner.id, t.owner);
    if (t.reviewer?.id) knownUsers.set(t.reviewer.id, t.reviewer);

    const rawIds: string[] = (Array.isArray(t.assigneeIds) && t.assigneeIds.length > 0)
      ? t.assigneeIds
      : (t.ownerId ? [t.ownerId] : []);
    const assignees = rawIds.map(id => usersMap.get(id) || knownUsers.get(id)).filter(Boolean);
    return { ...t, assigneeIds: rawIds, assignees };
  });
}

const ticketsCache = new Map<string, { timestamp: number; data: any }>();
const ticketDetailCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 60 * 1000;

let catalogCache: {
  timestamp: number;
  clients: Map<string, any>;
  users: Map<string, any>;
  ticketTypes: Map<string, any>;
  pilares: Map<string, any>;
  speakers: Map<string, any>;
} | null = null;
const CATALOG_TTL_MS = 5 * 60 * 1000;

export function clearTicketsCache() {
  ticketsCache.clear();
  ticketDetailCache.clear();
}

async function getCatalogs() {
  if (catalogCache && Date.now() - catalogCache.timestamp < CATALOG_TTL_MS) {
    return catalogCache;
  }
  const [clients, users, ticketTypes, pilares, speakers] = await Promise.all([
    prisma.client.findMany({ select: { id: true, name: true, active: true, canales: true, linkedinUrl: true, instagramUrl: true, webUrl: true } }),
    prisma.user.findMany({ select: { id: true, name: true, email: true } }),
    prisma.ticketType.findMany({ select: { id: true, name: true, kind: true } }),
    prisma.pilar.findMany({ select: { id: true, nombre: true, descripcion: true } }),
    prisma.speaker.findMany({ select: { id: true, nombre: true } }),
  ]);
  catalogCache = {
    timestamp: Date.now(),
    clients: new Map(clients.map(c => [c.id, c])),
    users: new Map(users.map(u => [u.id, u])),
    ticketTypes: new Map(ticketTypes.map(t => [t.id, t])),
    pilares: new Map(pilares.map(p => [p.id, p])),
    speakers: new Map(speakers.map(s => [s.id, s])),
  };
  return catalogCache;
}

export async function ticketsRoutes(fastify: FastifyInstance) {
  // Pre-calentar catálogos en memoria al arrancar
  getCatalogs().catch(() => {});

  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  // List tickets with filters
  fastify.get('/', async (request, reply) => {
    const t0 = Date.now();
    const cacheKey = JSON.stringify(request.query || {});
    const cached = ticketsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      reply.header('x-cache', 'HIT');
      reply.header('x-response-time', `${Date.now() - t0}ms`);
      return cached.data;
    }

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

    const [tickets, clients, users, ticketTypes, pilares, speakers] = await Promise.all([
      prisma.ticket.findMany({
        where,
        select: {
          id: true,
          title: true,
          objetivo: true,
          description: true,
          canales: true,
          clientId: true,
          ownerId: true,
          assigneeIds: true,
          ticketTypeId: true,
          pilarId: true,
          speakerId: true,
          status: true,
          prioridad: true,
          area: true,
          macroEstado: true,
          subEstado: true,
          reviewerId: true,
          medio: true,
          periodista: true,
          estadoRespuesta: true,
          dueDate: true,
          plannedDate: true,
          isDraftPlan: true,
          publishedAt: true,
          estadoAprobacionCliente: true,
          keywords: true,
          links: true,
          linkEntregable: true,
          tiposContenido: true,
          referenciasGraficas: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy,
      }),
      prisma.client.findMany({ select: { id: true, name: true } }),
      prisma.user.findMany({ select: { id: true, name: true, email: true } }),
      prisma.ticketType.findMany({ select: { id: true, name: true, kind: true } }),
      prisma.pilar.findMany({ select: { id: true, nombre: true } }),
      prisma.speaker.findMany({ select: { id: true, nombre: true } }),
    ]);

    const clientsMap = new Map(clients.map(c => [c.id, c]));
    const usersMap = new Map(users.map(u => [u.id, u]));
    const typesMap = new Map(ticketTypes.map(t => [t.id, t]));
    const pilaresMap = new Map(pilares.map(p => [p.id, p]));
    const speakersMap = new Map(speakers.map(s => [s.id, s]));

    const enriched = tickets.map(t => {
      const rawIds: string[] = (Array.isArray(t.assigneeIds) && t.assigneeIds.length > 0)
        ? t.assigneeIds
        : (t.ownerId ? [t.ownerId] : []);
      const assignees = rawIds.map(id => usersMap.get(id)).filter(Boolean);
      return {
        ...t,
        client: clientsMap.get(t.clientId) || null,
        owner: usersMap.get(t.ownerId) || null,
        reviewer: t.reviewerId ? usersMap.get(t.reviewerId) || null : null,
        ticketType: t.ticketTypeId ? typesMap.get(t.ticketTypeId) || null : null,
        pilar: t.pilarId ? pilaresMap.get(t.pilarId) || null : null,
        speaker: t.speakerId ? speakersMap.get(t.speakerId) || null : null,
        assigneeIds: rawIds,
        assignees,
      };
    });

    const result = { data: enriched };
    ticketsCache.set(cacheKey, { timestamp: Date.now(), data: result });
    reply.header('x-cache', 'MISS');
    reply.header('x-response-time', `${Date.now() - t0}ms`);
    return result;
  });

  // Get single ticket
  fastify.get('/:id', async (request, reply) => {
    const t0 = Date.now();
    const { id } = request.params as { id: string };

    const detailCacheKey = `ticket_detail_${id}`;
    const cached = ticketDetailCache.get(detailCacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      reply.header('x-cache', 'HIT');
      reply.header('x-response-time', `${Date.now() - t0}ms`);
      return cached.data;
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
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

    const catalogs = await getCatalogs();
    const rawAssigneeIds: string[] = (Array.isArray(ticket.assigneeIds) && ticket.assigneeIds.length > 0)
      ? ticket.assigneeIds
      : (ticket.ownerId ? [ticket.ownerId] : []);

    const owner = ticket.ownerId ? catalogs.users.get(ticket.ownerId) || null : null;
    const reviewer = ticket.reviewerId ? catalogs.users.get(ticket.reviewerId) || null : null;
    const assignees = rawAssigneeIds.map(uid => catalogs.users.get(uid)).filter(Boolean);

    const enriched = {
      ...ticket,
      client: ticket.clientId ? catalogs.clients.get(ticket.clientId) || null : null,
      owner,
      reviewer,
      ticketType: ticket.ticketTypeId ? catalogs.ticketTypes.get(ticket.ticketTypeId) || null : null,
      pilar: ticket.pilarId ? catalogs.pilares.get(ticket.pilarId) || null : null,
      speaker: ticket.speakerId ? catalogs.speakers.get(ticket.speakerId) || null : null,
      assigneeIds: rawAssigneeIds,
      assignees,
    };

    const result = { data: enriched };
    ticketDetailCache.set(detailCacheKey, { timestamp: Date.now(), data: result });
    reply.header('x-cache', 'MISS');
    reply.header('x-response-time', `${Date.now() - t0}ms`);
    return result;
  });

  // Create ticket
  fastify.post('/', async (request) => {
    const data = request.body as any;

    const initialAssigneeIds = (Array.isArray(data.assigneeIds) && data.assigneeIds.length > 0)
      ? data.assigneeIds
      : (data.ownerId ? [data.ownerId] : []);
    const primaryOwnerId = data.ownerId || initialAssigneeIds[0];

    const ticket = await prisma.ticket.create({
      data: {
        title: data.title,
        description: data.referencias !== undefined ? data.referencias : data.description,
        objetivo: data.objetivo,
        canales: (data.canales && data.canales.length > 0) ? data.canales : (data.canal ? [data.canal] : (data.area === 'PRENSA' ? [] : ['LinkedIn'])),
        prioridad: data.prioridad || 'MEDIA',
        clientId: data.clientId,
        ownerId: primaryOwnerId,
        assigneeIds: initialAssigneeIds,
        ticketTypeId: data.ticketTypeId || null,
        pilarId: data.pilarId || null,
        speakerId: data.speakerId || null,
        status: data.status || 'PENDIENTE',
        area: data.area || 'CONTENIDO',
        subEstado: data.subEstado || null,
        macroEstado: (data.subEstado ? SUBESTADO_TO_MACRO[data.subEstado] : null) as any,
        reviewerId: data.reviewerId || null,
        medio: data.medio || null,
        periodista: data.periodista || null,
        estadoRespuesta: data.estadoRespuesta || null,
        dueDate: parseApiDate(data.dueDate) ?? undefined,
        plannedDate: parseApiDate(data.plannedDate),
        isDraftPlan: data.isDraftPlan !== undefined ? data.isDraftPlan : false,
        estadoAprobacionCliente: data.estadoAprobacionCliente || 'BORRADOR',
        content: data.copy !== undefined ? data.copy : data.content,
        linkEntregable: data.linkPublicacionReal !== undefined ? data.linkPublicacionReal : data.linkEntregable,
        links: data.links || [],
        tiposContenido: data.tiposContenido || [],
        notasAudiovisual: data.notasAudiovisual !== undefined ? data.notasAudiovisual : (data.notasGrafica !== undefined ? data.notasGrafica : null),
        referenciasGraficas: data.referenciasGraficas || null,
      },
      include: {
        client: true,
        owner: { select: { id: true, name: true, email: true } },
        ticketType: true,
      },
    });

    clearTicketsCache();
    const [enriched] = await attachAssignees([ticket]);

    const currentUser = (request as any).user;
    if (currentUser && primaryOwnerId && primaryOwnerId !== currentUser.id) {
      setImmediate(async () => {
        try {
          let senderName = currentUser.name || currentUser.email;
          if (!senderName && currentUser.id) {
            const senderUser = await prisma.user.findUnique({ where: { id: currentUser.id }, select: { name: true, email: true } });
            senderName = senderUser?.name || senderUser?.email || 'Un usuario';
          }
          await notifyOrCoalesce({
            userId: primaryOwnerId,
            ticketId: ticket.id,
            type: 'ASSIGNED',
            fromName: senderName || 'Un usuario',
            message: `${senderName || 'Un usuario'} te asignó el ticket "${ticket.title}"`,
          });
        } catch (e) {
          // ignorar errores de notificación en background
        }
      });
    }

    return { data: enriched };
  });

  // Update ticket
  fastify.patch('/:id', async (request, reply) => {
    const t0 = Date.now();
    const { id } = request.params as { id: string };
    const data = request.body as any;

    const existingTicket = await prisma.ticket.findUnique({
      where: { id },
      select: { id: true, title: true, ownerId: true, status: true, subEstado: true }
    });
    if (!existingTicket) return reply.status(404).send({ error: 'Ticket no encontrado' });

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
    if (data.assigneeIds !== undefined) {
      const arr = Array.isArray(data.assigneeIds) ? data.assigneeIds : [];
      updateData.assigneeIds = arr;
      if (arr.length > 0) {
        updateData.ownerId = arr[0];
      }
    }
    if (data.ticketTypeId !== undefined) updateData.ticketTypeId = data.ticketTypeId;
    if (data.pilarId !== undefined) updateData.pilarId = data.pilarId || null;
    if (data.speakerId !== undefined) updateData.speakerId = data.speakerId || null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.area !== undefined) updateData.area = data.area;
    if (data.subEstado !== undefined) {
      updateData.subEstado = data.subEstado || null;
      updateData.macroEstado = data.subEstado ? SUBESTADO_TO_MACRO[data.subEstado] : null;
    }
    if (data.reviewerId !== undefined) updateData.reviewerId = data.reviewerId || null;
    if (data.medio !== undefined) updateData.medio = data.medio || null;
    if (data.periodista !== undefined) updateData.periodista = data.periodista || null;
    if (data.estadoRespuesta !== undefined) updateData.estadoRespuesta = data.estadoRespuesta || null;
    if (data.dueDate !== undefined) updateData.dueDate = parseApiDate(data.dueDate);
    if (data.plannedDate !== undefined) updateData.plannedDate = parseApiDate(data.plannedDate);
    if (data.isDraftPlan !== undefined) updateData.isDraftPlan = data.isDraftPlan;
    if (data.estadoAprobacionCliente !== undefined) updateData.estadoAprobacionCliente = data.estadoAprobacionCliente;
    if (data.publishedAt !== undefined) updateData.publishedAt = parseApiDate(data.publishedAt);
    if (data.links !== undefined) updateData.links = data.links;
    if (data.linkEntregable !== undefined) updateData.linkEntregable = data.linkEntregable;
    if (data.linkPublicacionReal !== undefined) updateData.linkEntregable = data.linkPublicacionReal;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.copy !== undefined) updateData.content = data.copy;
    if (data.keywords !== undefined) updateData.keywords = data.keywords;
    if (data.copyFinal !== undefined) updateData.copyFinal = data.copyFinal;
    if (data.notasAudiovisual !== undefined) updateData.notasAudiovisual = data.notasAudiovisual;
    else if (data.notasGrafica !== undefined) updateData.notasAudiovisual = data.notasGrafica;
    if (data.tiposContenido !== undefined) updateData.tiposContenido = data.tiposContenido;
    if (data.referenciasGraficas !== undefined) updateData.referenciasGraficas = data.referenciasGraficas;
    if (data.versionsPerCanal !== undefined) updateData.versionsPerCanal = data.versionsPerCanal;
    // Tickets de referencia (N:N) — máx 3, excluye self, dedup
    if (data.referenceIds !== undefined) {
      const ids = [...new Set(data.referenceIds as string[])]
        .filter((rid) => rid && rid !== id)
        .slice(0, 3);
      updateData.references = { set: ids.map((rid) => ({ id: rid })) };
    }

    const currentUser = (request as any).user;
    const ticket = await prisma.ticket.update({
      where: { id },
      data: updateData,
      select: {
        id: true, title: true, objetivo: true, description: true, canales: true,
        clientId: true, ownerId: true, assigneeIds: true, ticketTypeId: true,
        pilarId: true, speakerId: true, status: true, prioridad: true, area: true,
        macroEstado: true, subEstado: true, reviewerId: true, medio: true,
        periodista: true, estadoRespuesta: true, dueDate: true, plannedDate: true,
        isDraftPlan: true, publishedAt: true, estadoAprobacionCliente: true,
        keywords: true, links: true, linkEntregable: true, tiposContenido: true,
        referenciasGraficas: true, createdAt: true, updatedAt: true,
      },
    });

    clearTicketsCache();

    reply.header('x-response-time', `${Date.now() - t0}ms`);

    // Notificaciones no invasivas (completamente asincrónico fuera del ciclo HTTP)
    if (currentUser) {
      setImmediate(async () => {
        try {
          let senderName = currentUser.name || currentUser.email;
          if (!senderName && currentUser.id) {
            const senderUser = await prisma.user.findUnique({ where: { id: currentUser.id }, select: { name: true, email: true } });
            senderName = senderUser?.name || senderUser?.email || 'Un usuario';
          } else if (!senderName) {
            senderName = 'Un usuario';
          }

          // 1. Notificar asignación solo si ownerId cambió respecto al anterior
          const newOwnerId = ticket.ownerId;
          const ownerChanged = newOwnerId && newOwnerId !== existingTicket.ownerId && newOwnerId !== currentUser.id;

          if (ownerChanged) {
            await notifyOrCoalesce({
              userId: newOwnerId,
              ticketId: ticket.id,
              type: 'ASSIGNED',
              fromName: senderName,
              message: `${senderName} te asignó el ticket "${ticket.title}"`,
            });
          }

          // 2. Notificar cambio de estado solo si cambió respecto al anterior
          const statusChanged = (ticket.status !== existingTicket.status) || (ticket.subEstado !== existingTicket.subEstado);
          const targetRecipientId = ticket.ownerId;

          if (statusChanged && targetRecipientId && targetRecipientId !== currentUser.id) {
            const statusKey = ticket.subEstado || ticket.status;
            const statusLabel = STATUS_DISPLAY_NAMES[statusKey] || statusKey;
            await notifyOrCoalesce({
              userId: targetRecipientId,
              ticketId: ticket.id,
              type: 'STATUS_CHANGE',
              fromName: senderName,
              message: `${senderName} movió "${ticket.title}" a ${statusLabel}`,
            });
          }
        } catch (e) {
          // ignorar errores de notificación en background
        }
      });
    }

    return { data: ticket };
  });

  // Delete ticket
  fastify.delete('/:id', async (request) => {
    const { id } = request.params as { id: string };

    clearTicketsCache();
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
        publishedAt: parseApiDate(data.publishedAt)!,
        canal: data.canal || 'LinkedIn',
        insights: data.insights,
      },
      update: {
        url: data.url,
        publishedAt: parseApiDate(data.publishedAt) ?? undefined,
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

    clearTicketsCache();
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

    clearTicketsCache();
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

    clearTicketsCache();
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
