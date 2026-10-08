/**
 * Parses deliverable links stored as single URL, newline-separated URLs, or JSON array string.
 */
export function parseDeliverableLinks(raw?: string | null): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(s => String(s).trim()).filter(Boolean);
    } catch {}
  }
  return trimmed.split(/\r?\n+/).map(s => s.trim()).filter(Boolean);
}

/**
 * Serializes deliverable links to newline-separated URLs (or null if empty).
 */
export function serializeDeliverableLinks(links: string[]): string | null {
  const cleaned = links.map(l => l.trim()).filter(Boolean);
  if (cleaned.length === 0) return null;
  return cleaned.join('\n');
}

/**
 * Ensures a URL string is absolute (starts with http:// or https:// or mailto: or tel:).
 * If a domain like "infobae.com" or "www.infobae.com" is passed, it prepends "https://".
 */
export function ensureAbsoluteUrl(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^(https?:\/\/|mailto:|tel:|\/\/)/i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Copies HTML or rich text to clipboard as clean, formatted plain text.
 */
export async function copyHtmlToClipboard(html: string): Promise<boolean> {
  if (!html) return false;
  try {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    tempDiv.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    tempDiv.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li').forEach(el => {
      el.prepend(document.createTextNode('\n'));
    });

    const plainText = tempDiv.textContent?.replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n').trim() || html;
    await navigator.clipboard.writeText(plainText);
    return true;
  } catch (e) {
    try {
      await navigator.clipboard.writeText(html);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Safely parses a date input (string, Date, or null/undefined) into a local Date object.
 * For ISO date strings (e.g. "2026-08-19" or "2026-08-19T00:00:00.000Z"),
 * it extracts year, month, and day to construct a Date at local midnight.
 * This prevents 1-day offset issues caused by UTC-to-local timezone conversion.
 */
export function parseLocalDate(dateInput: string | Date | null | undefined): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput;
  const str = String(dateInput).trim();
  if (!str) return null;

  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    return new Date(year, month, day);
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Formats a date string or Date object for UI display in Spanish without timezone shift.
 */
export function formatDateSpan(
  dateInput: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }
): string {
  const d = parseLocalDate(dateInput);
  if (!d) return '—';
  return d.toLocaleDateString('es-ES', options);
}

/**
 * Formats a date string or Date object as YYYY-MM-DD for HTML <input type="date"> elements.
 */
export function formatDateISO(dateInput: string | Date | null | undefined): string {
  const d = parseLocalDate(dateInput);
  if (!d) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Fusiona de forma defensiva copys por canal nuevos con existentes.
 * Si el mapa entrante trae un valor vacío para una red que ya tenía copy guardado,
 * preserva el copy original para evitar pérdidas de contenido por mutaciones parciales.
 */
export function mergeContentPerCanal(
  existing: Record<string, string> | null | undefined,
  incoming: Record<string, string> | null | undefined
): Record<string, string> {
  const existingMap = existing && typeof existing === 'object' ? { ...existing } : {};
  const incomingMap = incoming && typeof incoming === 'object' ? { ...incoming } : {};
  const result: Record<string, string> = { ...existingMap, ...incomingMap };

  Object.keys(existingMap).forEach(key => {
    if ((!result[key] || !result[key].trim()) && existingMap[key] && existingMap[key].trim()) {
      result[key] = existingMap[key];
    }
  });

  return result;
}

export const DEFAULT_REDES = ['LinkedIn', 'Instagram', 'Twitter'];

const NON_SOCIAL_CANALES = new Set([
  'blog',
  'newsletter',
  'artículo blog',
  'articulo blog',
]);

/**
 * Retorna las redes sociales objetivo a mostrar para un cliente y ticket.
 * Si el cliente tiene canales definidos (ej. LinkedIn e Instagram), solo se muestran esos canales sociales.
 * Si el ticket ya tiene canales seleccionados (ej. por edición de un ticket previo), se preservan.
 * Si el cliente no tiene canales configurados, retorna el default de redes (LinkedIn, Instagram, Twitter).
 */
export function getRedesObjetivoForClient(
  clientCanales?: string[] | null,
  currentSelectedCanales?: string[] | null
): string[] {
  const result = new Set<string>();

  const filteredClientCanales = (clientCanales ?? []).filter(c => {
    if (!c || typeof c !== 'string') return false;
    return !NON_SOCIAL_CANALES.has(c.trim().toLowerCase());
  });

  if (filteredClientCanales.length > 0) {
    filteredClientCanales.forEach(c => result.add(c.trim()));
  } else {
    DEFAULT_REDES.forEach(r => result.add(r));
  }

  // Preservar cualquier red que el ticket ya tuviera seleccionada previamente
  (currentSelectedCanales ?? []).forEach(c => {
    if (c && typeof c === 'string' && c.trim()) {
      result.add(c.trim());
    }
  });

  return Array.from(result);
}

/**
 * Strips HTML tags, entities and normalizes whitespace for comparing copy text.
 */
export function stripHtmlToPlainText(html: string | null | undefined): string {
  if (!html) return '';
  if (typeof document !== 'undefined') {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    tempDiv.querySelectorAll('br').forEach(br => br.replaceWith(' '));
    tempDiv.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li').forEach(el => {
      el.prepend(document.createTextNode(' '));
    });
    return (tempDiv.textContent || '')
      .replace(/[\u00A0\u200B]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return html
    .replace(/<\/(p|div|h[1-6]|li)>/gi, ' ')
    .replace(/<br\s*[\/]?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Helper to record version history when copy changes (via paste, edit, or generation).
 * Ensures:
 * 1. The previous copy in DB/state is preserved in the history if it wasn't already recorded.
 * 2. The new copy is appended to the history if it differs from the last recorded version.
 */
export function recordCopyVersion(
  currentVersionsMap: Record<string, string[]> | undefined | null,
  canal: string,
  newContent: string,
  previousContent?: string
): Record<string, string[]> {
  if (!canal) return currentVersionsMap ? { ...currentVersionsMap } : {};

  const versions: Record<string, string[]> = currentVersionsMap && typeof currentVersionsMap === 'object'
    ? { ...currentVersionsMap }
    : {};

  // Case-insensitive lookup for matching canal key
  const existingKey = Object.keys(versions).find(k => k.toLowerCase() === canal.toLowerCase()) || canal;
  const canalVersions = Array.isArray(versions[existingKey]) ? [...versions[existingKey]] : [];

  // 1. Check previousContent: if it exists, has text, and differs from last version, push it first
  if (previousContent) {
    const prevPlain = stripHtmlToPlainText(previousContent);
    if (prevPlain.length > 0) {
      const lastVer = canalVersions[canalVersions.length - 1];
      const lastVerPlain = stripHtmlToPlainText(lastVer);
      if (prevPlain !== lastVerPlain) {
        canalVersions.push(previousContent);
      }
    }
  }

  // 2. Check newContent: if it exists, has text, and differs from the last version, push it
  if (newContent) {
    const newPlain = stripHtmlToPlainText(newContent);
    if (newPlain.length > 0) {
      const lastVer = canalVersions[canalVersions.length - 1];
      const lastVerPlain = stripHtmlToPlainText(lastVer);
      if (newPlain !== lastVerPlain) {
        canalVersions.push(newContent);
      } else if (canalVersions.length === 0) {
        canalVersions.push(newContent);
      }
    }
  }

  versions[existingKey] = canalVersions;
  return versions;
}

/**
 * Filters pilares according to the active speaker context:
 * - If speakerId is present: returns pilares belonging to that speaker PLUS brand pilares (speakerId === null or undefined).
 *   (If includeBrand === false, returns strictly that speaker's pilares).
 * - If speakerId is empty/null (brand content): returns strictly brand pilares (speakerId === null or undefined).
 */
export function filterPilaresBySpeaker<T extends { speakerId?: string | null }>(
  pilares: T[],
  speakerId?: string | null,
  includeBrand = true
): T[] {
  if (!Array.isArray(pilares)) return [];
  if (!speakerId) {
    return pilares.filter(p => !p.speakerId);
  }
  if (!includeBrand) {
    return pilares.filter(p => p.speakerId === speakerId);
  }
  return pilares.filter(p => p.speakerId === speakerId || !p.speakerId);
}

/**
 * Identifica modelos de IA que deprecian o no admiten el parámetro manual 'temperature' en sus llamadas API
 * (p. ej. familia Anthropic Claude 5, modelos de razonamiento OpenAI o1/o3-mini).
 */
export function shouldOmitTemperature(model: string | null | undefined): boolean {
  if (!model) return false;
  const m = model.toLowerCase().trim();
  return m.startsWith('claude-') || m.startsWith('o1') || m.startsWith('o3');
}

/**
 * Highlights quoted strings in an HTML string by wrapping matching un-marked text nodes
 * in <mark data-c="..."> tags.
 */
export function highlightQuotesInHtml(
  html: string,
  quotesWithIds: { quote: string; id: string }[]
): string {
  if (!html || !quotesWithIds || quotesWithIds.length === 0) return html;
  if (typeof document === 'undefined') return html;

  const validQuotes = quotesWithIds
    .map(q => ({ id: q.id, quote: q.quote ? q.quote.trim() : '' }))
    .filter(q => q.quote.length > 0);

  if (validQuotes.length === 0) return html;

  // Use DOMParser or temp container
  const container = document.createElement('div');
  container.innerHTML = html;

  for (const { id, quote } of validQuotes) {
    // If quote is already inside a mark with data-c, skip
    const existingMarks = Array.from(container.querySelectorAll('mark[data-c]'));
    const alreadyMarked = existingMarks.some(
      m => m.textContent?.trim() === quote || m.textContent?.includes(quote)
    );
    if (alreadyMarked) continue;

    // Traverse all text nodes not inside a mark
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.includes(quote)) {
          return NodeFilter.FILTER_SKIP;
        }
        let parent = node.parentElement;
        while (parent && parent !== container) {
          if (parent.tagName.toLowerCase() === 'mark') {
            return NodeFilter.FILTER_REJECT;
          }
          parent = parent.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const matchingNodes: Text[] = [];
    let currentNode = walker.nextNode();
    while (currentNode) {
      matchingNodes.push(currentNode as Text);
      currentNode = walker.nextNode();
    }

    // Wrap only the first occurrence found per quote to avoid runaway duplicates
    if (matchingNodes.length > 0) {
      const textNode = matchingNodes[0];
      const textVal = textNode.nodeValue || '';
      const idx = textVal.indexOf(quote);
      if (idx !== -1) {
        const before = textVal.slice(0, idx);
        const match = textVal.slice(idx, idx + quote.length);
        const after = textVal.slice(idx + quote.length);

        const parent = textNode.parentNode;
        if (parent) {
          const mark = document.createElement('mark');
          mark.dataset.c = id;
          mark.style.backgroundColor = 'rgba(0, 255, 178, 0.35)';
          mark.style.borderRadius = '2px';
          mark.style.padding = '1px 2px';
          mark.style.cursor = 'pointer';
          mark.textContent = match;

          const frag = document.createDocumentFragment();
          if (before) frag.appendChild(document.createTextNode(before));
          frag.appendChild(mark);
          if (after) frag.appendChild(document.createTextNode(after));

          parent.replaceChild(frag, textNode);
        }
      }
    }
  }

  return container.innerHTML;
}


