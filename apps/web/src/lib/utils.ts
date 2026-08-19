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
