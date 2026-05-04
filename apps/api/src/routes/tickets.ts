import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export async function ticketsRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  // List tickets with filters
  fastify.get('/', async (request) => {
    const { clientId, ownerId, status } = request.query as {
      clientId?: string;
      ownerId?: string;
      status?: string;
    };

    const where: any = {};
    if (clientId) where.clientId = clientId;
    if (ownerId) where.ownerId = ownerId;
    if (status) where.status = status;

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true, email: true } },
        ticketType: { select: { id: true, name: true } },
        pilar: { select: { id: true, nombre: true } },
        speaker: { select: { id: true, nombre: true } },
      },
      orderBy: { createdAt: 'desc' },
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
        description: data.description,
        objetivo: data.objetivo,
        canales: data.canales || [],
        prioridad: data.prioridad,
        clientId: data.clientId,
        ownerId: data.ownerId,
        ticketTypeId: data.ticketTypeId,
        pilarId: data.pilarId || null,
        speakerId: data.speakerId || null,
        status: data.status || 'BACKLOG',
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
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
    if (data.objetivo !== undefined) updateData.objetivo = data.objetivo;
    if (data.canales !== undefined) updateData.canales = data.canales;
    if (data.contentPerCanal !== undefined) updateData.contentPerCanal = data.contentPerCanal;
    if (data.prioridad !== undefined) updateData.prioridad = data.prioridad;
    if (data.ownerId !== undefined) updateData.ownerId = data.ownerId;
    if (data.ticketTypeId !== undefined) updateData.ticketTypeId = data.ticketTypeId;
    if (data.pilarId !== undefined) updateData.pilarId = data.pilarId || null;
    if (data.speakerId !== undefined) updateData.speakerId = data.speakerId || null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.links !== undefined) updateData.links = data.links;
    if (data.linkEntregable !== undefined) updateData.linkEntregable = data.linkEntregable;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.keywords !== undefined) updateData.keywords = data.keywords;
    if (data.copyFinal !== undefined) updateData.copyFinal = data.copyFinal;
    if (data.notasAudiovisual !== undefined) updateData.notasAudiovisual = data.notasAudiovisual;

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
}
