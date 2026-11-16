import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveMentions } from '../mentions.js';

const users = [
  { id: 'cami-m', name: 'Camila Montes', email: 'cmontes@otr.tech' },
  { id: 'cami-o', name: 'Camila Rossi', email: 'crossi@otr.tech' },
  { id: 'sofi-o', name: 'Sofía Oliva', email: 'soliva@otr.tech' },
  { id: 'sofi-c', name: 'Sofía Castro', email: 'scastro@otr.tech' },
  { id: 'manu', name: 'Manuela Ghitta', email: 'manu@otr.tech' },
];
const sorted = (a: string[]) => [...a].sort();

test('mencionar nombre completo NO notifica a otra persona con el mismo primer nombre', () => {
  assert.deepEqual(resolveMentions('Hola @Camila Montes, mirá esto', users), ['cami-m']);
  assert.deepEqual(resolveMentions('@Sofía Oliva te toca', users), ['sofi-o']);
  assert.deepEqual(resolveMentions('@Sofía Castro te toca', users), ['sofi-c']);
});

test('caso inverso también queda bien', () => {
  assert.deepEqual(resolveMentions('@Camila Rossi ok?', users), ['cami-o']);
});

test('varias menciones en el mismo comentario', () => {
  assert.deepEqual(sorted(resolveMentions('@Camila Montes y @Sofía Castro', users)), ['cami-m', 'sofi-c']);
});

test('apodo + apellido resuelve unívoco; apodo solo ambiguo notifica a ambas', () => {
  assert.deepEqual(resolveMentions('@sofi oliva', users), ['sofi-o']);
  assert.deepEqual(sorted(resolveMentions('@sofi', users)), ['sofi-c', 'sofi-o']);
});

test('apodo único y prefijo de email siguen funcionando', () => {
  assert.deepEqual(resolveMentions('@manu fijate', users), ['manu']);
  assert.deepEqual(resolveMentions('@crossi', users), ['cami-o']);
});

test('excluye al autor y no lo usa como fallback', () => {
  // Camila Rossi menciona a Camila Montes: sólo notifica a Montes
  assert.deepEqual(resolveMentions('@Camila Montes', users, 'cami-o'), ['cami-m']);
  assert.deepEqual(resolveMentions('@Camila Montes', users, 'cami-m'), []);
});

test('caso reportado: escribo "@Cami", elijo Camila Montes del desplegable → sólo Montes', () => {
  const team = [
    { id: 'montes', name: 'Camila Montes', email: 'cmontes@otr.tech' },
    { id: 'pardavila', name: 'Camila Pardavila', email: 'cpardavila@otr.tech' },
    { id: 'autora', name: 'Shaiel Terán', email: 'shaiel@otr.tech' },
  ];
  // El desplegable (MentionTextarea) reemplaza "@Cami" por "@<nombre completo> "
  const enviado = 'Revisá esto @Camila Montes porfa';
  assert.deepEqual(resolveMentions(enviado, team, 'autora'), ['montes']);
  assert.deepEqual(resolveMentions('@Camila Pardavila ok', team, 'autora'), ['pardavila']);
});

test('emails en el texto no son menciones', () => {
  assert.deepEqual(resolveMentions('escribile a manu@otr.tech', users), []);
});
