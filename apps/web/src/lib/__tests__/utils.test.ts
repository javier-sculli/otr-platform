import { describe, it, expect } from 'vitest';
import { parseLocalDate, formatDateSpan, formatDateISO, ensureAbsoluteUrl, mergeContentPerCanal, getRedesObjetivoForClient, stripHtmlToPlainText, recordCopyVersion, filterPilaresBySpeaker } from '../utils';

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

  describe('stripHtmlToPlainText', () => {
    it('elimina etiquetas HTML y entidades decodificándolas a texto plano', () => {
      const html = '<p>Hola <strong>mundo</strong>!&nbsp;¿Cómo estás?</p>';
      expect(stripHtmlToPlainText(html)).toBe('Hola mundo! ¿Cómo estás?');
    });

    it('maneja strings vacíos, nulos o indefinidos', () => {
      expect(stripHtmlToPlainText('')).toBe('');
      expect(stripHtmlToPlainText(null)).toBe('');
      expect(stripHtmlToPlainText(undefined)).toBe('');
    });
  });

  describe('recordCopyVersion', () => {
    it('si el copy anterior no estaba en el historial, lo guarda como Versión 1 y el nuevo como Versión 2', () => {
      const versions = {};
      const result = recordCopyVersion(versions, 'LinkedIn', '<p>Versión nueva pegada</p>', '<p>Copy original que ya estaba</p>');
      expect(result.LinkedIn).toHaveLength(2);
      expect(result.LinkedIn[0]).toBe('<p>Copy original que ya estaba</p>');
      expect(result.LinkedIn[1]).toBe('<p>Versión nueva pegada</p>');
    });

    it('no duplica la versión previa si ya era la última versión en el historial', () => {
      const versions = {
        LinkedIn: ['<p>Copy original que ya estaba</p>'],
      };
      const result = recordCopyVersion(versions, 'LinkedIn', '<p>Versión 2</p>', '<p>Copy original que ya estaba</p>');
      expect(result.LinkedIn).toHaveLength(2);
      expect(result.LinkedIn[0]).toBe('<p>Copy original que ya estaba</p>');
      expect(result.LinkedIn[1]).toBe('<p>Versión 2</p>');
    });

    it('no crea una nueva versión si el nuevo copy es idéntico a la última versión', () => {
      const versions = {
        LinkedIn: ['<p>Copy exacto</p>'],
      };
      const result = recordCopyVersion(versions, 'LinkedIn', '<p>Copy exacto</p>');
      expect(result.LinkedIn).toHaveLength(1);
      expect(result.LinkedIn[0]).toBe('<p>Copy exacto</p>');
    });

    it('permite registrar versión inicial cuando no había contenido previo', () => {
      const versions = {};
      const result = recordCopyVersion(versions, 'Twitter', 'Primer copy para twitter');
      expect(result.Twitter).toHaveLength(1);
      expect(result.Twitter[0]).toBe('Primer copy para twitter');
    });

    it('maneja claves de canales de forma insensible a mayúsculas/minúsculas', () => {
      const versions = {
        linkedin: ['Versión previa'],
      };
      const result = recordCopyVersion(versions, 'LinkedIn', 'Versión nueva');
      expect(result.linkedin).toHaveLength(2);
      expect(result.linkedin[1]).toBe('Versión nueva');
    });
  });

  describe('filterPilaresBySpeaker [VOC-01 / VOC-02]', () => {
    const pilaresMock = [
      { id: '1', nombre: 'Pilar Marca 1', speakerId: null },
      { id: '2', nombre: 'Pilar Marca 2', speakerId: undefined },
      { id: '3', nombre: 'Pilar Vocero A', speakerId: 'spk-a' },
      { id: '4', nombre: 'Pilar Vocero B', speakerId: 'spk-b' },
    ];

    it('retorna solo pilares de marca si no se pasa speakerId (modo contenido de marca)', () => {
      const result = filterPilaresBySpeaker(pilaresMock, null);
      expect(result).toHaveLength(2);
      expect(result.map(p => p.id)).toEqual(['1', '2']);
    });

    it('retorna pilares del vocero + pilares de marca por defecto cuando hay speakerId activo', () => {
      const result = filterPilaresBySpeaker(pilaresMock, 'spk-a');
      expect(result).toHaveLength(3);
      expect(result.map(p => p.id)).toEqual(['1', '2', '3']);
    });

    it('retorna estrictamente los pilares propios del vocero si includeBrand es false', () => {
      const result = filterPilaresBySpeaker(pilaresMock, 'spk-a', false);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('3');
      expect(result[0].nombre).toBe('Pilar Vocero A');
    });

    it('maneja listas vacías o valores inválidos defensivamente', () => {
      expect(filterPilaresBySpeaker([], 'spk-a')).toEqual([]);
      expect(filterPilaresBySpeaker(null as any, 'spk-a')).toEqual([]);
    });
  });
});
