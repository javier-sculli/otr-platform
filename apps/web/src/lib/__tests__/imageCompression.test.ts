import { describe, it, expect } from 'vitest';
import { parseCommentContent, buildCommentContent, isHeicFile, isImageFile } from '../imageCompression';

describe('imageCompression', () => {
  describe('isHeicFile & isImageFile', () => {
    it('detects HEIC files by mime type or file extension', () => {
      const heicMime = new File([''], 'foto.img', { type: 'image/heic' });
      const heifMime = new File([''], 'foto.img', { type: 'image/heif' });
      const heicExt = new File([''], 'IMG_1234.HEIC', { type: '' });
      const pngFile = new File([''], 'screenshot.png', { type: 'image/png' });

      expect(isHeicFile(heicMime)).toBe(true);
      expect(isHeicFile(heifMime)).toBe(true);
      expect(isHeicFile(heicExt)).toBe(true);
      expect(isHeicFile(pngFile)).toBe(false);

      expect(isImageFile(heicExt)).toBe(true);
      expect(isImageFile(pngFile)).toBe(true);
      expect(isImageFile(new File([''], 'doc.pdf', { type: 'application/pdf' }))).toBe(false);
    });
  });
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

    it('extracts server relative attachment image URLs', () => {
      const serverUrl = '/tickets/attachments/724b0551-0290-418f-b6ed-a46b4f8ab6bf';
      const content = `Revisar esto:\n\n![imagen](${serverUrl})`;
      const res = parseCommentContent(content);

      expect(res.text).toBe('Revisar esto:');
      expect(res.images).toEqual([serverUrl]);
    });

    it('extracts attached PDF files and separates them from text', () => {
      const pdfDataUrl = 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9ia...';
      const content = `Adjunto el brief del cliente:\n\n[📎 brief_oficial.pdf](${pdfDataUrl})`;
      const res = parseCommentContent(content);

      expect(res.text).toBe('Adjunto el brief del cliente:');
      expect(res.images).toEqual([]);
      expect(res.files).toEqual([
        { name: 'brief_oficial.pdf', url: pdfDataUrl },
      ]);
    });

    it('extracts both images and PDF documents from the same comment', () => {
      const img = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY44YAAAAASUVORK5CYII=';
      const pdf = 'data:application/pdf;base64,mockPdfData';
      const content = `Nota:\n![captura](${img})\n\n[📎 manual.pdf](${pdf})`;
      const res = parseCommentContent(content);

      expect(res.text).toBe('Nota:');
      expect(res.images).toEqual([img]);
      expect(res.files).toEqual([{ name: 'manual.pdf', url: pdf }]);
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

    it('combines text, images and file attachments cleanly', () => {
      const img = 'data:image/png;base64,imgdata';
      const files = [{ name: 'brief.pdf', url: 'data:application/pdf;base64,pdfdata' }];
      const res = buildCommentContent('Detalle', [img], files);
      expect(res).toBe('Detalle\n\n![imagen](data:image/png;base64,imgdata)\n\n[📎 brief.pdf](data:application/pdf;base64,pdfdata)');
    });

    it('builds comment with only a PDF file attachment', () => {
      const files = [{ name: 'brief.pdf', url: 'data:application/pdf;base64,pdfdata' }];
      const res = buildCommentContent('', [], files);
      expect(res).toBe('[📎 brief.pdf](data:application/pdf;base64,pdfdata)');
    });
  });
});
