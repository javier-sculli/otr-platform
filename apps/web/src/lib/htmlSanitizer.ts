/**
 * Utilities for cleaning and normalizing pasted HTML/Markdown
 * from Google Docs, Notion, ChatGPT, and rich text editors.
 */

export function fixNotionImageUrl(src: string): string {
  if (!src) return '';

  // Si la URL es relativa de proxy de Notion tipo /image/https%3A%2F%2F... o contiene /image/http
  if (src.startsWith('/image/') || src.includes('/image/http')) {
    const parts = src.split('/image/');
    if (parts.length > 1) {
      const encoded = parts[1].split('?')[0];
      try {
        const decoded = decodeURIComponent(encoded);
        if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
          const queryIndex = src.indexOf('?');
          const queryString = queryIndex !== -1 ? src.substring(queryIndex) : '';
          return decoded.includes('?') ? decoded : `${decoded}${queryString}`;
        }
      } catch {}
    }
  }

  // Si es URL relativa tipo /secure.notion-static.com/...
  if (src.startsWith('/') && !src.startsWith('//')) {
    return `https://www.notion.so${src}`;
  }

  return src;
}

export function cleanJunkHtmlBlocks(html: string): string {
  if (!html) return '';

  // Convertir marcado Markdown (**bold**, __bold__) a HTML
  let converted = html;
  converted = converted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  converted = converted.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // Si es texto plano (sin etiquetas HTML), convertir saltos de línea a <br>
  if (!/<[a-z][\s\S]*>/i.test(html) && converted.includes('\n')) {
    converted = converted.replace(/\n/g, '<br>');
  }
  html = converted;

  if (typeof DOMParser === 'undefined') {
    return html;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 1. Eliminar scripts/iframes/meta
    doc.querySelectorAll('script, style, iframe, meta, input').forEach(el => el.remove());

    // 2. Eliminar contenedores verdaderamente vacíos (que no tengan texto, ni imágenes, ni <br>, ni &nbsp;)
    doc.querySelectorAll('pre, code, span, div, p, blockquote').forEach(el => {
      const text = el.textContent?.replace(/[\s\u200B]/g, '') || '';
      const hasMediaOrBr = el.querySelector('img, br, hr, iframe, svg') !== null || el.innerHTML.includes('&nbsp;');
      if (!text && !hasMediaOrBr) {
        el.remove();
      }
    });

    // 3. Eliminar figcaption de capturas de pantalla de Notion
    doc.querySelectorAll('figcaption, figcaption span, .image-caption').forEach(el => {
      const text = el.textContent?.trim() || '';
      if (/^captura de pantalla|untitled|image|screenshot/i.test(text) || text.endsWith('.png') || text.endsWith('.jpg')) {
        el.remove();
      }
    });

    // 4. Eliminar estilos de fondo inline y reparar imágenes de Notion
    doc.querySelectorAll('*').forEach(el => {
      if (el.tagName !== 'IMG') {
        const styleAttr = el.getAttribute('style');
        if (styleAttr) {
          const newStyle = styleAttr
            .replace(/background-color:[^;"]+;?/gi, '')
            .replace(/background:[^;"]+;?/gi, '')
            .replace(/font-family:[^;"]+;?/gi, '')
            .replace(/font-size:[^;"]+;?/gi, '')
            .replace(/--tw-[^;"]+;?/gi, '')
            .trim();
          if (newStyle) {
            el.setAttribute('style', newStyle);
          } else {
            el.removeAttribute('style');
          }
        }
        if (el.className && typeof el.className === 'string') {
          const newClass = el.className
            .replace(/\bbg-\[[^\]]+\]\b/g, '')
            .replace(/\bbg-gray-\d+\b/g, '')
            .replace(/\bmax-h-\d+\b/g, '')
            .replace(/\boverflow-y-auto\b/g, '')
            .trim();
          if (newClass) {
            el.setAttribute('class', newClass);
          } else {
            el.removeAttribute('class');
          }
        }
      } else {
        const rawSrc = el.getAttribute('src') || el.getAttribute('data-src') || el.getAttribute('data-original-src') || el.closest('a')?.getAttribute('href') || '';
        const fixedSrc = fixNotionImageUrl(rawSrc);
        if (fixedSrc && fixedSrc !== el.getAttribute('src')) {
          el.setAttribute('src', fixedSrc);
        }
        el.setAttribute('referrerpolicy', 'no-referrer');
        const alt = el.getAttribute('alt') || '';
        if (/^captura de pantalla|untitled|image|screenshot/i.test(alt) || alt.endsWith('.png') || alt.endsWith('.jpg')) {
          el.removeAttribute('alt');
        }
      }
    });

    return doc.body.innerHTML;
  } catch {
    return html;
  }
}
