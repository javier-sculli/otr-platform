import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { commentsRoutes } from '../comments.js';
import { prisma } from '../../lib/prisma.js';

// Bug reportado (2026-11-18): la contenidista no podía resolver un comentario en línea
// que había dejado otra persona ("No se pudo eliminar el comentario — Sin permiso").

const COMMENT = { id: 'cm-1', ticketId: 'ticket-1', userId: 'autora', content: '«texto»: cambiar esto' };

async function withTestApp(
  fn: (ctx: {
    inject: (method: 'POST' | 'DELETE', url: string, asUser: string) => Promise<number>;
    deletedIds: string[];
  }) => Promise<void>
) {
  const deletedIds: string[] = [];
  const orig = {
    findUnique: prisma.ticketComment.findUnique,
    del: prisma.ticketComment.delete,
    ticketFind: prisma.ticket.findUnique,
    userFind: prisma.user.findUnique,
  };
  (prisma.ticketComment as any).findUnique = async ({ where }: any) => (where.id === COMMENT.id ? COMMENT : null);
  (prisma.ticketComment as any).delete = async ({ where }: any) => {
    deletedIds.push(where.id);
    return COMMENT;
  };
  (prisma.ticket as any).findUnique = async () => null;
  (prisma.user as any).findUnique = async ({ where }: any) => ({ id: where.id, name: where.id, email: `${where.id}@otr.tech`, role: 'CONTENIDISTA' });

  const app = Fastify();
  await app.register(jwt, { secret: 'test-secret' });
  await app.register(commentsRoutes);

  try {
    await fn({
      inject: async (method, url, asUser) => {
        const token = app.jwt.sign({ id: asUser, email: `${asUser}@otr.tech` });
        const res = await app.inject({ method, url, headers: { authorization: `Bearer ${token}` } });
        return res.statusCode;
      },
      deletedIds,
    });
  } finally {
    (prisma.ticketComment as any).findUnique = orig.findUnique;
    (prisma.ticketComment as any).delete = orig.del;
    (prisma.ticket as any).findUnique = orig.ticketFind;
    (prisma.user as any).findUnique = orig.userFind;
    await app.close();
  }
}

test('resolve: otra persona del equipo puede resolver un comentario ajeno', async () => {
  await withTestApp(async ({ inject, deletedIds }) => {
    const status = await inject('POST', '/ticket-1/comments/cm-1/resolve', 'contenidista');
    assert.equal(status, 204);
    assert.deepEqual(deletedIds, ['cm-1']);
  });
});

test('resolve: no permite tocar un comentario de otro ticket', async () => {
  await withTestApp(async ({ inject, deletedIds }) => {
    const status = await inject('POST', '/otro-ticket/comments/cm-1/resolve', 'contenidista');
    assert.equal(status, 404);
    assert.deepEqual(deletedIds, []);
  });
});

test('delete: borrar a mano un comentario sigue siendo sólo del autor', async () => {
  await withTestApp(async ({ inject, deletedIds }) => {
    assert.equal(await inject('DELETE', '/ticket-1/comments/cm-1', 'contenidista'), 403);
    assert.deepEqual(deletedIds, []);
    assert.equal(await inject('DELETE', '/ticket-1/comments/cm-1', 'autora'), 204);
    assert.deepEqual(deletedIds, ['cm-1']);
  });
});
