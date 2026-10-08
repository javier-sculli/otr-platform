import { describe, it, expect } from 'vitest';
import { highlightQuotesInHtml } from '../utils';

describe('highlightQuotesInHtml', () => {
  it('returns unmodified html if no quotes are provided', () => {
    const html = '<p>Hola mundo</p>';
    expect(highlightQuotesInHtml(html, [])).toBe(html);
  });

  it('wraps matching text in mark tag with data-c and style', () => {
    const html = '<p>Este es un texto con una frase importante para resaltar.</p>';
    const result = highlightQuotesInHtml(html, [{ id: 'c_1', quote: 'frase importante' }]);
    expect(result).toContain('<mark data-c="c_1"');
    expect(result).toContain('frase importante</mark>');
  });

  it('does not re-wrap text already inside a mark tag', () => {
    const html = '<p>Este es un <mark data-c="c_0">texto con una frase importante</mark> ya marcado.</p>';
    const result = highlightQuotesInHtml(html, [{ id: 'c_1', quote: 'frase importante' }]);
    expect(result).toBe(html);
  });

  it('handles multiple quotes without breaking HTML structure', () => {
    const html = '<div><p>Primer párrafo con alfa.</p><p>Segundo párrafo con beta y más texto.</p></div>';
    const result = highlightQuotesInHtml(html, [
      { id: 'c_1', quote: 'alfa' },
      { id: 'c_2', quote: 'beta' },
    ]);
    expect(result).toContain('<mark data-c="c_1"');
    expect(result).toContain('>alfa</mark>');
    expect(result).toContain('<mark data-c="c_2"');
    expect(result).toContain('>beta</mark>');
  });

  it('handles html with links and preserves href attributes', () => {
    const html = '<p>Visita <a href="https://example.com">el enlace aquí</a> para más info.</p>';
    const result = highlightQuotesInHtml(html, [{ id: 'c_1', quote: 'enlace aquí' }]);
    expect(result).toContain('<a href="https://example.com">el <mark data-c="c_1"');
    expect(result).toContain('enlace aquí</mark></a>');
  });
});
