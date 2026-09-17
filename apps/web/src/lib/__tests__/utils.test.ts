import { describe, it, expect } from 'vitest';
import { parseLocalDate, formatDateSpan, formatDateISO, ensureAbsoluteUrl, mergeContentPerCanal, getRedesObjetivoForClient } from '../utils';

describe('lib/utils', () => {
  describe('parseLocalDate & Date shift prevention', () => {
    it('parsea correctamente "YYYY-MM-DD" sin retroceder un día por zona horaria UTC', () => {
      const date = parseLocalDate('2026-09-17');
      expect(date).not.toBeNull();
      expect(date!.getFullYear()).toBe(2026);
      expect(date!.getMonth()).toBe(8); // Septiembre (0-indexed)
      expect(date!.getDate()).toBe(17);
    });

    it('parsea strings ISO con timestamp "2026-09-17T00:00:00.000Z" preservando el día 17', () => {
      const date = parseLocalDate('2026-09-17T00:00:00.000Z');
      expect(date).not.toBeNull();
      expect(date!.getDate()).toBe(17);
      expect(date!.getMonth()).toBe(8);
      expect(date!.getFullYear()).toBe(2026);
    });

    it('maneja valores nulos, undefined o strings vacíos', () => {
      expect(parseLocalDate(null)).toBeNull();
      expect(parseLocalDate(undefined)).toBeNull();
      expect(parseLocalDate('')).toBeNull();
      expect(parseLocalDate('   ')).toBeNull();
    });

    it('formatDateISO genera el string exacto YYYY-MM-DD para inputs tipo date', () => {
      expect(formatDateISO('2026-09-17T00:00:00.000Z')).toBe('2026-09-17');
      expect(formatDateISO(new Date(2026, 8, 17))).toBe('2026-09-17');
      expect(formatDateISO(null)).toBe('');
    });

    it('formatDateSpan formatea fechas en español sin desfasaje', () => {
      const formatted = formatDateSpan('2026-09-17');
      expect(formatted).toContain('17');
      expect(formatDateSpan(null)).toBe('—');
    });
  });

  describe('ensureAbsoluteUrl', () => {
    it('agrega https:// a dominios sin protocolo', () => {
      expect(ensureAbsoluteUrl('drive.google.com/folder/123')).toBe('https://drive.google.com/folder/123');
      expect(ensureAbsoluteUrl('figma.com/file/xyz')).toBe('https://figma.com/file/xyz');
    });

    it('respeta URLs que ya tienen https:// o http://', () => {
      expect(ensureAbsoluteUrl('https://notion.so/ticket-1')).toBe('https://notion.so/ticket-1');
      expect(ensureAbsoluteUrl('http://inseguro.com')).toBe('http://inseguro.com');
    });

    it('retorna string vacío ante valores falsy o vacíos', () => {
      expect(ensureAbsoluteUrl('')).toBe('');
      expect(ensureAbsoluteUrl('   ')).toBe('');
      expect(ensureAbsoluteUrl(null)).toBe('');
      expect(ensureAbsoluteUrl(undefined)).toBe('');
    });
  });

  describe('mergeContentPerCanal', () => {
    it('preserva el copy existente de un canal si el mapa entrante envía string vacío o espacios', () => {
      const existing = {
        LinkedIn: 'Copy súper pulido de LinkedIn',
        Instagram: 'Copy original de Instagram',
      };
      const incoming = {
        LinkedIn: 'Nuevo copy actualizado',
        Instagram: '', // Intento accidental de pisar con vacío
      };

      const result = mergeContentPerCanal(existing, incoming);
      expect(result.LinkedIn).toBe('Nuevo copy actualizado');
      expect(result.Instagram).toBe('Copy original de Instagram');
    });

    it('combina canales nuevos sin perder los existentes', () => {
      const existing = { LinkedIn: 'Texto LinkedIn' };
      const incoming = { Twitter: 'Texto Twitter' };

      const result = mergeContentPerCanal(existing, incoming);
      expect(result.LinkedIn).toBe('Texto LinkedIn');
      expect(result.Twitter).toBe('Texto Twitter');
    });

    it('maneja valores nulos o undefined sin romper', () => {
      expect(mergeContentPerCanal(null, { LinkedIn: 'Hola' })).toEqual({ LinkedIn: 'Hola' });
      expect(mergeContentPerCanal({ LinkedIn: 'Hola' }, null)).toEqual({ LinkedIn: 'Hola' });
      expect(mergeContentPerCanal(undefined, undefined)).toEqual({});
    });
  });

  describe('getRedesObjetivoForClient', () => {
    it('muestra únicamente las redes que trabaja el cliente cuando están configuradas', () => {
      const clientCanales = ['LinkedIn', 'Instagram'];
      const redes = getRedesObjetivoForClient(clientCanales);
      expect(redes).toEqual(['LinkedIn', 'Instagram']);
    });

    it('si el cliente solo trabaja una red (ej. LinkedIn), solo muestra esa red', () => {
      const clientCanales = ['LinkedIn'];
      const redes = getRedesObjetivoForClient(clientCanales);
      expect(redes).toEqual(['LinkedIn']);
    });

    it('filtra canales no-redes como blog o newsletter', () => {
      const clientCanales = ['LinkedIn', 'Twitter/X', 'Blog', 'Newsletter'];
      const redes = getRedesObjetivoForClient(clientCanales);
      expect(redes).toEqual(['LinkedIn', 'Twitter/X']);
    });

    it('retorna las redes por defecto (LinkedIn, Instagram, Twitter) si el cliente no tiene canales configurados', () => {
      expect(getRedesObjetivoForClient([])).toEqual(['LinkedIn', 'Instagram', 'Twitter']);
      expect(getRedesObjetivoForClient(null)).toEqual(['LinkedIn', 'Instagram', 'Twitter']);
      expect(getRedesObjetivoForClient(undefined)).toEqual(['LinkedIn', 'Instagram', 'Twitter']);
    });

    it('preserva cualquier red ya seleccionada en el ticket para no perder contexto al editar', () => {
      const clientCanales = ['LinkedIn'];
      const currentSelected = ['Twitter'];
      const redes = getRedesObjetivoForClient(clientCanales, currentSelected);
      expect(redes).toContain('LinkedIn');
      expect(redes).toContain('Twitter');
    });
  });
});
