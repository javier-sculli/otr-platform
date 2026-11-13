import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { ticketsRoutes } from '../tickets.js';
import { prisma } from '../../lib/prisma.js';

async function withTestApp(
  fn: (ctx: {
    injectPost: (payload: Record<string, any>) => Promise<{ statusCode: number; body: any }>;
    getCapturedCreateData: () => Record<string, any> | null;
  }) => Promise<void>
) {
  let capturedCreateData: Record<string, any> | null = null;

  const origAggregate = prisma.ticket.aggregate;
  const origCreate = prisma.ticket.create;
  const origTypeFindUnique = prisma.ticketType.findUnique;
  const origTypeFindMany = prisma.ticketType.findMany;
  const origUserFindMany = prisma.user.findMany;
  const origUserFindUnique = prisma.user.findUnique;

  (prisma.ticket as any).aggregate = async () => ({ _min: { sortOrder: 0 } });
  (prisma.ticketType as any).findUnique = async () => ({ id: 'type-1', name: 'Texto', kind: 'CONTENIDO' });
  (prisma.ticketType as any).findMany = async () => [{ id: 'type-1', name: 'Texto', kind: 'CONTENIDO' }];
  (prisma.user as any).findMany = async () => [{ id: 'user-1', name: 'Javi', email: 'javi@ontherocks.tech' }];
  (prisma.user as any).findUnique = async () => ({ id: 'user-1', name: 'Javi', email: 'javi@ontherocks.tech' });
  (prisma.ticket as any).create = async (args: any) => {
    capturedCreateData = args.data;
    return {
      id: 'ticket-created-1',
      ...args.data,
      client: { id: 'client-1', name: 'Cliente Test' },
      owner: { id: 'user-1', name: 'Javi', email: 'javi@ontherocks.tech' },
      ticketType: { id: 'type-1', name: 'Texto', kind: 'CONTENIDO' },
      pilar: null,
      speaker: null,
    };
  };

  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret' });
  await app.register(ticketsRoutes);
  const token = app.jwt.sign({ id: 'user-1', email: 'javi@ontherocks.tech' });

  try {
    await fn({
      injectPost: async (payload) => {
        const res = await app.inject({
          method: 'POST',
          url: '/',
          headers: { authorization: `Bearer ${token}` },
          payload,
        });
        return { statusCode: res.statusCode, body: res.json() };
      },
      getCapturedCreateData: () => capturedCreateData,
    });
  } finally {
    (prisma.ticket as any).aggregate = origAggregate;
    (prisma.ticket as any).create = origCreate;
    (prisma.ticketType as any).findUnique = origTypeFindUnique;
    (prisma.ticketType as any).findMany = origTypeFindMany;
    (prisma.user as any).findMany = origUserFindMany;
    (prisma.user as any).findUnique = origUserFindUnique;
    await app.close();
  }
}

test('POST /tickets: payload mínimo del modal responde 200 y guarda keywords como null (nunca [])', async () => {
  await withTestApp(async ({ injectPost, getCapturedCreateData }) => {
    const res = await injectPost({
      title: 'Nuevo ticket de prueba',
      clientId: 'client-1',
      ownerId: 'user-1',
      assigneeIds: ['user-1'],
      ticketTypeId: 'type-1',
      tiposContenido: ['Texto'],
      canales: ['LinkedIn'],
      dueDate: '2026-11-20',
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.id, 'ticket-created-1');

    const data = getCapturedCreateData();
    assert.ok(data);
    assert.equal(data.keywords, null);
    assert.equal(data.title, 'Nuevo ticket de prueba');
    assert.equal(data.clientId, 'client-1');
  });
});

test('POST /tickets: sanitiza campos opcionales mal tipados (keywords como [], fecha 5 dígitos) sin romper', async () => {
  await withTestApp(async ({ injectPost, getCapturedCreateData }) => {
    const res = await injectPost({
      title: 'Ticket con opcionales sucios',
      clientId: 'client-1',
      ownerId: 'user-1',
      tiposContenido: ['Texto'],
      keywords: ['no-deberia-romper'],
      dueDate: '20226-11-13',
      publishedAt: 'fecha-invalida',
    });

    assert.equal(res.statusCode, 200);

    const data = getCapturedCreateData();
    assert.ok(data);
    assert.equal(data.keywords, null);
    assert.equal((data.dueDate as Date).toISOString(), '2026-11-13T12:00:00.000Z');
    assert.equal(data.publishedAt, null);
  });
});
