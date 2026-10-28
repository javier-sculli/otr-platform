import { compressImageFile } from './imageCompression';

export interface AttachedFileItem {
  id: string;
  name: string;
  size?: number;
  type?: string;
  url: string;
}

export const MAX_ATTACHMENT_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
export const MAX_COMMENT_ATTACHMENT_SIZE_BYTES = 4 * 1024 * 1024; // 4MB for fast comment delivery

export function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        resolve(result);
      } else {
        reject(new Error(`No se pudo leer el archivo ${file.name}`));
      }
    };
    reader.onerror = () => reject(reader.error || new Error(`Error leyendo ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export async function createAttachmentFromFile(file: File): Promise<AttachedFileItem> {
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new Error(`El archivo "${file.name}" supera el tamaño máximo permitido de 15MB.`);
  }

  let url: string;
  if (file.type.startsWith('image/')) {
    try {
      url = await compressImageFile(file);
    } catch {
      url = await readFileAsDataUrl(file);
    }
  } else {
    url = await readFileAsDataUrl(file);
  }

  const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  return {
    id,
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    url,
  };
}
