import { describe, it, expect } from 'vitest';
import { requiresDesign, requiresVideo, getNextStatusForTicket } from '../workflow';

describe('lib/workflow', () => {
  describe('requiresDesign', () => {
    it('requiere diseño para formatos visuales estándar', () => {
      expect(requiresDesign({ tiposContenido: ['Carrusel'] })).toBe(true);
      expect(requiresDesign({ tiposContenido: ['Placa Gráfica'] })).toBe(true);
      expect(requiresDesign({ tiposContenido: ['Story'] })).toBe(true);
    });

    it('no requiere diseño para formatos de solo texto o notas', () => {
      expect(requiresDesign({ tiposContenido: ['Texto solo'] })).toBe(false);
      expect(requiresDesign({ tiposContenido: ['Hilo'] })).toBe(false);
      expect(requiresDesign({ tiposContenido: ['Newsletter'] })).toBe(false);
    });

    it('por defecto asume true si no hay tipos especificados para no omitir revisión', () => {
      expect(requiresDesign({})).toBe(true);
      expect(requiresDesign(null)).toBe(true);
    });
  });

  describe('requiresVideo', () => {
    it('identifica correctamente formatos audiovisuales', () => {
      expect(requiresVideo({ tiposContenido: ['Reel'] })).toBe(true);
      expect(requiresVideo({ tiposContenido: ['Video'] })).toBe(true);
      expect(requiresVideo({ tiposContenido: ['TikTok'] })).toBe(true);
    });

    it('retorna false para formatos gráficos o de texto estático', () => {
      expect(requiresVideo({ tiposContenido: ['Carrusel'] })).toBe(false);
      expect(requiresVideo({ tiposContenido: ['Placa Gráfica'] })).toBe(false);
      expect(requiresVideo({ tiposContenido: ['Texto solo'] })).toBe(false);
    });
  });

  describe('getNextStatusForTicket', () => {
    it('para contenido solo texto: saltea Diseño y Edición directo a REVISION_INTERNA desde REDACCION', () => {
      const ticket = {
        status: 'REDACCION',
        tiposContenido: ['Texto solo'],
      };
      expect(getNextStatusForTicket(ticket)).toBe('REVISION_INTERNA');
    });

    it('para Carrusel: avanza a DISENO desde REDACCION y luego a REVISION_INTERNA (salteando Edición)', () => {
      const ticketDiseno = {
        status: 'REDACCION',
        tiposContenido: ['Carrusel'],
      };
      expect(getNextStatusForTicket(ticketDiseno)).toBe('DISENO');

      const ticketEnDiseno = {
        status: 'DISENO',
        tiposContenido: ['Carrusel'],
      };
      expect(getNextStatusForTicket(ticketEnDiseno)).toBe('REVISION_INTERNA');
    });

    it('para Reel / Video: pasa por DISENO, luego EDICION y luego REVISION_INTERNA', () => {
      const ticketRedaccion = {
        status: 'REDACCION',
        tiposContenido: ['Reel'],
      };
      expect(getNextStatusForTicket(ticketRedaccion)).toBe('DISENO');

      const ticketDiseno = {
        status: 'DISENO',
        tiposContenido: ['Reel'],
      };
      expect(getNextStatusForTicket(ticketDiseno)).toBe('EDICION');

      const ticketEdicion = {
        status: 'EDICION',
        tiposContenido: ['Reel'],
      };
      expect(getNextStatusForTicket(ticketEdicion)).toBe('REVISION_INTERNA');
    });

    it('cuando no tiene formato elegido o no puede inferirlo: avanza siempre al estado siguiente secuencial sin trabarse', () => {
      // Sin formato especificado desde REDACCION -> avanza al siguiente (DISENO)
      expect(getNextStatusForTicket({ status: 'REDACCION', tiposContenido: [] })).toBe('DISENO');
      expect(getNextStatusForTicket({ status: 'REDACCION', tiposContenido: undefined, ticketType: null })).toBe('DISENO');

      // Sin formato especificado desde DISENO -> avanza al siguiente (EDICION) en lugar de saltearlo
      expect(getNextStatusForTicket({ status: 'DISENO', tiposContenido: [] })).toBe('EDICION');

      // Secuencia completa estándar sin formato
      expect(getNextStatusForTicket({ status: 'PENDIENTE' })).toBe('REDACCION');
      expect(getNextStatusForTicket({ status: 'EDICION' })).toBe('REVISION_INTERNA');
      expect(getNextStatusForTicket({ status: 'REVISION_INTERNA' })).toBe('CLIENTE');
      expect(getNextStatusForTicket({ status: 'CLIENTE' })).toBe('ESPERANDO_FEEDBACK');
      expect(getNextStatusForTicket({ status: 'ESPERANDO_FEEDBACK' })).toBe('LISTO_PARA_PUBLICAR');
      expect(getNextStatusForTicket({ status: 'LISTO_PARA_PUBLICAR' })).toBe('PUBLICADO');
      expect(getNextStatusForTicket({ status: 'PUBLICADO' })).toBe('LISTO');
    });
  });
});
