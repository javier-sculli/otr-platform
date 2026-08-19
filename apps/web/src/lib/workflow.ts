// Workflow engine para transiciones inteligentes de estados según tipo de contenido

/**
 * Regla de formatos por estado de flujo:
 * 1. Pasan por diseño: carrusel, placa con diseño, story, video, reel.
 * 2. Pasan por audiovisual (edición): video, reel.
 * 3. No pasan por diseño ni audiovisual: álbum de fotos, imagen, hilo, texto solo, repost.
 */

// Formatos explícitos que NO pasan por diseño ni audiovisual (saltean Diseño y Edición)
const NO_DISENO_FORMATS = [
  'imagen', 'imagen estática', 'imagen estatica',
  'álbum de fotos', 'album de fotos', 'álbum', 'album',
  'hilo', 'texto solo', 'texto', 'repost',
  'blog', 'news', 'newsletter', 'deck', 'estrategia', 'reporte', 'otro',
  'documento', 'evento', 'base de medios', 'columna de opinión', 'comunicado', 'feedback',
];

// Formatos que pasan por Diseño Gráfico (Regla 1: carrusel, placa con diseño, imagen gráfica, story, video, reel)
const FORMATOS_DISENO = [
  'carrusel', 'carusel',
  'placa', 'placa con diseño', 'placa con diseno', 'diseño puntual', 'diseno puntual',
  'imagen gráfica', 'imagen grafica',
  'story', 'stories',
  'video', 'video largo',
  'reel', 'reels',
  'infografía', 'infografia', 'flyer', 'banner', 'gráfica', 'grafica',
  'ilustración', 'ilustracion', 'diseño', 'diseno', 'portada',
];

// Formatos que pasan por Audiovisual/Edición (Regla 2: video, reel)
const FORMATOS_EDICION = [
  'video', 'video largo',
  'reel', 'reels',
  'shorts', 'tiktok',
  'animación', 'animacion',
  'audio', 'podcast', 'edición', 'edicion',
];

export type TicketFormatInput =
  | {
      tiposContenido?: string[];
      ticketType?: { name?: string } | string | null;
      title?: string;
    }
  | string[];

/**
 * Obtiene la lista de formatos aplicables a un ticket inspeccionando únicamente tiposContenido o ticketType.
 */
export function getEffectiveFormats(ticket?: TicketFormatInput | null): string[] {
  if (!ticket) return [];

  if (Array.isArray(ticket)) {
    if (ticket.length > 0) return ticket;
    return [];
  }

  // 1. Array tiposContenido (tipo de contenido seleccionado en el ticket)
  if (Array.isArray(ticket.tiposContenido) && ticket.tiposContenido.length > 0) {
    return ticket.tiposContenido;
  }

  // 2. Campo ticketType (para lo que no es contenido o si tiposContenido está vacío)
  const typeName = typeof ticket.ticketType === 'string'
    ? ticket.ticketType
    : ticket.ticketType?.name;
  if (typeName && typeName.trim()) {
    return [typeName.trim()];
  }

  return [];
}

/**
 * Determina si los formatos seleccionados en un ticket requieren la etapa de Diseño Gráfico.
 */
export function requiresDesign(ticketOrFormats?: TicketFormatInput | null): boolean {
  const formats = getEffectiveFormats(ticketOrFormats);
  if (formats.length === 0) return true;

  return formats.some(t => {
    const lower = t.toLowerCase().trim();
    if (
      lower.includes('placa') ||
      lower.includes('diseño') ||
      lower.includes('diseno') ||
      lower.includes('gráfica') ||
      lower.includes('grafica')
    ) {
      return true;
    }
    if (
      NO_DISENO_FORMATS.some(
        nd => lower === nd || (lower.startsWith('imagen') && !lower.includes('placa') && !lower.includes('diseño') && !lower.includes('diseno') && !lower.includes('grafica') && !lower.includes('gráfica'))
      )
    ) {
      return false;
    }
    return FORMATOS_DISENO.some(d => lower.includes(d));
  });
}

/**
 * Determina si los formatos seleccionados en un ticket requieren la etapa de Edición Audiovisual.
 */
export function requiresVideo(ticketOrFormats?: TicketFormatInput | null): boolean {
  const formats = getEffectiveFormats(ticketOrFormats);
  if (formats.length === 0) return false;

  return formats.some(t => {
    const lower = t.toLowerCase().trim();
    return FORMATOS_EDICION.some(e => lower.includes(e));
  });
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
export function getNextStatusForTicket(ticket: {
  status?: string;
  tiposContenido?: string[];
  ticketType?: { name?: string } | string | null;
  title?: string;
  area?: string;
}): string | undefined {
  if (!ticket?.status) return undefined;

  const needsDesign = requiresDesign(ticket);
  const needsVideo = requiresVideo(ticket);

  switch (ticket.status) {
    case 'PENDIENTE':
      return 'REDACCION';

    case 'REDACCION':
      if (needsDesign) return 'DISENO';
      if (needsVideo) return 'EDICION';
      return 'REVISION_INTERNA'; // Saltea Diseño y Edición para contenido solo texto / sin gráfica ni video

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

