import { describe, it, expect } from 'vitest';
import {
  formatFileSize,
  createAttachmentFromFile,
  MAX_ATTACHMENT_SIZE_BYTES,
} from '../attachments';

describe('attachments utility', () => {
  describe('formatFileSize', () => {
    it('formatea correctamente tamaños en bytes, KB y MB', () => {
      expect(formatFileSize(0)).toBe('');
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(2048)).toBe('2.0 KB');
      expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
    });

    it('maneja valores inválidos o nulos devolviendo string vacío', () => {
      expect(formatFileSize(undefined)).toBe('');
      expect(formatFileSize(null as any)).toBe('');
      expect(formatFileSize(-10)).toBe('');
    });
  });

  describe('createAttachmentFromFile', () => {
    it('rechaza archivos que superen los 15MB', async () => {
      const hugeFile = new File(['x'], 'gran-archivo.pdf', { type: 'application/pdf' });
      Object.defineProperty(hugeFile, 'size', { value: MAX_ATTACHMENT_SIZE_BYTES + 1024 });

      await expect(createAttachmentFromFile(hugeFile)).rejects.toThrow(
        /supera el tamaño máximo permitido de 15MB/i
      );
    });

    it('procesa correctamente un PDF generando un data URL', async () => {
      const file = new File(['dummy-pdf-binary'], 'brief-cliente.pdf', {
        type: 'application/pdf',
      });

      const attachment = await createAttachmentFromFile(file);
      expect(attachment.name).toBe('brief-cliente.pdf');
      expect(attachment.type).toBe('application/pdf');
      expect(attachment.url).toMatch(/^data:application\/pdf;base64,/);
      expect(attachment.id).toBeDefined();
    });
  });
});
