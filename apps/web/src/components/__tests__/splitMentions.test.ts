import { describe, it, expect } from 'vitest';
import { splitMentions } from '../MentionTextarea';

// Pedido (2026-11-18): la mención en azul tiene que abarcar nombre y apellido, no sólo el nombre.
const team = [{ name: 'Natalia Heit' }, { name: 'Shaiel Terán' }, { name: 'Camila Montes' }, { name: 'Camila Pardavila' }];
const mentions = (text: string, users = team) => splitMentions(text, users).filter(p => p.mention).map(p => p.text);

describe('splitMentions', () => {
  it('pinta nombre y apellido completos (caso reportado)', () => {
    expect(mentions('@Natalia Heit Tenemos que hacer las portadas de este blog.')).toEqual(['@Natalia Heit']);
  });

  it('no se come la palabra siguiente si no es el apellido', () => {
    expect(mentions('@Natalia hola, mirá esto')).toEqual(['@Natalia']);
  });

  it('distingue personas con el mismo primer nombre', () => {
    expect(mentions('@Camila Pardavila y @Camila Montes')).toEqual(['@Camila Pardavila', '@Camila Montes']);
  });

  it('respeta tildes del nombre real y no cuenta emails', () => {
    expect(mentions('ok @Shaiel Terán, escribí a nat@otr.tech')).toEqual(['@Shaiel Terán']);
  });

  it('el texto se reconstruye igual', () => {
    const text = '@Natalia Heit Tenemos que hacer las portadas.';
    expect(splitMentions(text, team).map(p => p.text).join('')).toBe(text);
  });

  it('sin lista de equipo: toma nombre + apellido en mayúscula, pero no una palabra común', () => {
    expect(mentions('@Natalia Heit fijate', [])).toEqual(['@Natalia Heit']);
    expect(mentions('@Natalia fijate', [])).toEqual(['@Natalia']);
  });

  it('soporta el formato @[Nombre](id)', () => {
    expect(mentions('hola @[Natalia Heit](u1) ok')).toEqual(['@Natalia Heit']);
  });
});
