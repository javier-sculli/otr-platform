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
        tickets: {
          where: { status: { not: 'CANCELADO' } },
          select: { status: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const data = clients.map((client: typeof clients[number]) => {
      const tickets = client.tickets;
      const enFlujo = tickets.filter((t: typeof tickets[number]) => t.status !== 'APROBADO').length;
      const aprobados = tickets.filter((t: typeof tickets[number]) => t.status === 'APROBADO').length;

      return {
        id: client.id,
        name: client.name,
        active: client.active,
        canales: client.canales,
        owner: client.owner,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
        tickets: { enFlujo, aprobados },
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
}
