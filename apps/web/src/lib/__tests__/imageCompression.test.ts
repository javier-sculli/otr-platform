import { describe, it, expect } from 'vitest';
import { parseCommentContent, buildCommentContent } from '../imageCompression';

describe('imageCompression', () => {
  describe('parseCommentContent', () => {
    it('returns text directly if no images are present', () => {
      const res = parseCommentContent('Un comentario sin imágenes');
      expect(res.text).toBe('Un comentario sin imágenes');
      expect(res.images).toEqual([]);
    });

    it('extracts base64 image and leaves text', () => {
      const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/';
      const content = `Mirá esta captura:\n\n![imagen](${dataUrl})`;
      const res = parseCommentContent(content);

      expect(res.text).toBe('Mirá esta captura:');
      expect(res.images).toEqual([dataUrl]);
    });

    it('handles multiple images and trims text cleanly', () => {
      const img1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY44YAAAAASUVORK5CYII=';
      const img2 = 'https://example.com/screenshot.jpg';
      const content = `Texto antes\n![primera](${img1})\n\n![segunda](${img2})\nTexto después`;
      const res = parseCommentContent(content);

      expect(res.text).toBe('Texto antes\n\nTexto después');
      expect(res.images).toEqual([img1, img2]);
    });

    it('handles comment that is only an image', () => {
      const img = 'https://example.com/img.png';
      const content = `![imagen](${img})`;
      const res = parseCommentContent(content);

      expect(res.text).toBe('');
      expect(res.images).toEqual([img]);
    });
  });

  describe('buildCommentContent', () => {
    it('returns only text when no images are provided', () => {
      expect(buildCommentContent('Comentario solo')).toBe('Comentario solo');
    });

    it('combines text and image markdown', () => {
      const img = 'data:image/jpeg;base64,abc123';
      const res = buildCommentContent('Revisar esto', [img]);
      expect(res).toBe('Revisar esto\n\n![imagen](data:image/jpeg;base64,abc123)');
    });

    it('returns only image markdown when text is empty', () => {
      const img = 'data:image/jpeg;base64,abc123';
      const res = buildCommentContent('   ', [img]);
      expect(res).toBe('![imagen](data:image/jpeg;base64,abc123)');
    });
  });
});
