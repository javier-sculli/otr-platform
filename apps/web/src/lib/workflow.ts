// Workflow engine para transiciones inteligentes de estados según tipo de contenido

/**
 * Regla de formatos por estado de flujo:
 * 1. Pasan por diseño: carrusel, placa con diseño, story, video, reel.
 * 2. Pasan por audiovisual (edición): video, reel.
 * 3. No pasan por diseño ni audiovisual: álbum de fotos, imagen, hilo, texto solo, repost.
 */

// Formatos explícitos que pasan por Diseño Gráfico (Regla 1)
const FORMATOS_DISENO = [
  'carrusel', 'carusel',
  'placa con diseño', 'placa con diseno', 'placa gráfica', 'placa grafica', 'placa',
  'story', 'stories',
  'video', 'video largo',
  'reel', 'reels',
  'diseño puntual', 'diseno puntual', 'infografía', 'infografia', 'flyer', 'banner', 'gráfica', 'grafica', 'ilustración', 'ilustracion', 'portada',
];

// Formatos que pasan por Audiovisual/Edición (Regla 2: video, reel)
const FORMATOS_EDICION = [
  'video', 'video largo',
  'reel', 'reels',
  'shorts', 'tiktok',
  'animación', 'animacion',
  'audio', 'podcast', 'edición', 'edicion',
];

// Formatos explícitos que NO pasan por diseño ni audiovisual (Regla 3: saltean Diseño y Edición)
const NO_DISENO_FORMATS = [
  'álbum de fotos', 'album de fotos', 'álbum', 'album', 'fotogalería', 'fotogaleria', 'galería', 'galeria',
  'imagen', 'imagen estática', 'imagen estatica', 'foto estática', 'foto estatica', 'foto', 'fotos',
  'hilo', 'thread',
  'texto solo', 'texto',
  'repost',
  'blog', 'artículo blog', 'articulo blog', 'news', 'newsletter', 'deck', 'estrategia', 'reporte', 'otro',
  'documento', 'evento', 'base de medios', 'columna de opinión', 'comunicado', 'feedback', 'gestión-pitch', 'gestion-pitch',
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

    // 1. Verificar primero si coincide con formatos explícitos que pasan por Diseño (carrusel, placa con diseño, story, video, reel)
    if (FORMATOS_DISENO.some(d => lower === d || lower.includes(d))) {
      return true;
    }

    // 2. Verificar si es un formato explícito SIN diseño (álbum de fotos, imagen, hilo, texto solo, repost)
    if (NO_DISENO_FORMATS.some(nd => lower === nd || lower.includes(nd))) {
      return false;
    }

    // 3. Fallback genérico para palabras clave de diseño
    if (
      lower.includes('placa') ||
      lower.includes('diseño') ||
      lower.includes('diseno') ||
      lower.includes('gráfica') ||
      lower.includes('grafica')
    ) {
      return true;
    }

    return false;
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
    return FORMATOS_EDICION.some(e => lower === e || lower.includes(e));
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

