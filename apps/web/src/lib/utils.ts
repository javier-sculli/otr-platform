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

