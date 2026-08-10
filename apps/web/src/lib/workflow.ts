// Workflow engine para transiciones inteligentes de estados según tipo de contenido

const FORMATOS_DISENO = [
  'carrusel', 'imagen', 'infografía', 'infografia', 'flyer', 'banner', 'gráfica', 'grafica',
  'ilustración', 'ilustracion', 'diseño', 'diseno', 'portada', 'posteo gráfico', 'posteo grafico',
  'carusel', 'placa'
];

const FORMATOS_EDICION = [
  'reel', 'reels', 'video', 'video largo', 'shorts', 'tiktok', 'animación', 'animacion',
  'audio', 'podcast', 'edición', 'edicion'
];

/**
 * Determina si los formatos seleccionados en un ticket requieren la etapa de Diseño Gráfico.
 * Si no se especificaron formatos (array vacío u omitido), retorna true por defecto.
 */
export function requiresDesign(tiposContenido?: string[]): boolean {
  if (!tiposContenido || tiposContenido.length === 0) return true;
  return tiposContenido.some(t => FORMATOS_DISENO.some(d => t.toLowerCase().includes(d)));
}

/**
 * Determina si los formatos seleccionados en un ticket requieren la etapa de Edición Audiovisual/Video.
 */
export function requiresVideo(tiposContenido?: string[]): boolean {
  if (!tiposContenido || tiposContenido.length === 0) return false;
  return tiposContenido.some(t => FORMATOS_EDICION.some(e => t.toLowerCase().includes(e)));
}

/**
 * Mapeo secuencial estándar entre estados.
 */
export const STANDARD_NEXT_STATUS: Record<string, string> = {
  PENDIENTE: 'REDACCION',
  REDACCION: 'DISENO',
  DISENO: 'EDICION',
  EDICION: 'REVISION_INTERNA',
  REVISION_INTERNA: 'CLIENTE',
  CLIENTE: 'ESPERANDO_FEEDBACK',
  ESPERANDO_FEEDBACK: 'LISTO_PARA_PUBLICAR',
  LISTO_PARA_PUBLICAR: 'PUBLICADO',
};

/**
 * Calcula dinámicamente la siguiente etapa de un ticket según su estado actual y sus tipos de contenido.
 */
export function getNextStatusForTicket(ticket: { status?: string; tiposContenido?: string[]; area?: string }): string | undefined {
  if (!ticket?.status) return undefined;

  const tipos = ticket.tiposContenido || [];
  const needsDesign = requiresDesign(tipos);
  const needsVideo = requiresVideo(tipos);

  switch (ticket.status) {
    case 'PENDIENTE':
      return 'REDACCION';

    case 'REDACCION':
      if (needsDesign) return 'DISENO';
      if (needsVideo) return 'EDICION';
      return 'REVISION_INTERNA'; // Saltea Diseño y Edición para contenido solo texto

    case 'DISENO':
      if (needsVideo) return 'EDICION';
      return 'REVISION_INTERNA'; // Saltea Edición si no requiere video

    case 'EDICION':
      return 'REVISION_INTERNA';

    case 'REVISION_INTERNA':
      return 'CLIENTE';

    case 'CLIENTE':
      return 'ESPERANDO_FEEDBACK';

    case 'ESPERANDO_FEEDBACK':
      return 'LISTO_PARA_PUBLICAR';

    case 'LISTO_PARA_PUBLICAR':
      return 'PUBLICADO';

    default:
      return STANDARD_NEXT_STATUS[ticket.status];
  }
}
