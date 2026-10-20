import { describe, it, expect } from 'vitest';
import { cleanJunkHtmlBlocks, fixNotionImageUrl } from '../htmlSanitizer';

describe('htmlSanitizer', () => {
  describe('fixNotionImageUrl', () => {
    it('decodes Notion proxy image URLs', () => {
      const notionProxy = '/image/https%3A%2F%2Fimages.unsplash.com%2Fphoto-123%3Fauto%3Dformat?table=block&id=xyz';
      const fixed = fixNotionImageUrl(notionProxy);
      expect(fixed).toContain('https://images.unsplash.com/photo-123?auto=format');
    });

    it('prepends notion domain for root-relative static assets', () => {
      const fixed = fixNotionImageUrl('/secure.notion-static.com/asset.png');
      expect(fixed).toBe('https://www.notion.so/secure.notion-static.com/asset.png');
    });

    it('leaves standard URLs unchanged', () => {
      expect(fixNotionImageUrl('https://example.com/pic.jpg')).toBe('https://example.com/pic.jpg');
    });
  });

  describe('cleanJunkHtmlBlocks', () => {
    it('converts markdown bold to <strong> tags', () => {
      const input = 'Hola **mundo** y __amigos__';
      const output = cleanJunkHtmlBlocks(input);
      expect(output).toContain('<strong>mundo</strong>');
      expect(output).toContain('<strong>amigos</strong>');
    });

    it('strips unsafe script and iframe elements', () => {
      const dirty = '<p>Texto seguro</p><script>alert("xss")</script><iframe src="evil.com"></iframe>';
      const clean = cleanJunkHtmlBlocks(dirty);
      expect(clean).not.toContain('<script');
      expect(clean).not.toContain('<iframe');
      expect(clean).toContain('Texto seguro');
    });

    it('removes truly empty container tags', () => {
      const dirty = '<p>Contenido</p><p></p><div><span>   </span></div>';
      const clean = cleanJunkHtmlBlocks(dirty);
      expect(clean).toBe('<p>Contenido</p>');
    });

    it('removes Notion screenshot figcaptions', () => {
      const dirty = '<p>Texto</p><figcaption>Captura de pantalla 2026-03-01.png</figcaption>';
      const clean = cleanJunkHtmlBlocks(dirty);
      expect(clean).not.toContain('Captura de pantalla');
      expect(clean).toContain('Texto');
    });
  });
});
