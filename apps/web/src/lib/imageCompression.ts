/**
 * Detects if a file or blob is an HEIC/HEIF image (common on iOS and macOS).
 */
export function isHeicFile(file: File | Blob): boolean {
  if (file.type && (file.type.toLowerCase().includes('heic') || file.type.toLowerCase().includes('heif'))) {
    return true;
  }
  if (file instanceof File) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.heic') || name.endsWith('.heif')) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether a file or blob is an image, including cases where
 * the browser omits file.type for certain extensions like .heic.
 */
export function isImageFile(file: File | Blob): boolean {
  if (file.type && file.type.startsWith('image/')) return true;
  if (isHeicFile(file)) return true;
  if (file instanceof File) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext && ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'heic', 'heif', 'bmp', 'tiff', 'ico'].includes(ext)) {
      return true;
    }
  }
  return false;
}

/**
 * Decodes an HEIC/HEIF file or blob (iPhone/Mac) into a standard JPEG Data URL.
 */
export async function convertHeicToJpegDataUrl(
  file: File | Blob,
  maxDimension = 1000,
  quality = 0.75
): Promise<string> {
  // @ts-ignore
  const decodeModule = await import('heic-decode');
  const decode = decodeModule.default || decodeModule;
  const arrayBuffer = await file.arrayBuffer();
  const { width, height, data } = await decode({ buffer: new Uint8Array(arrayBuffer) });

  let targetWidth = width;
  let targetHeight = height;

  if (targetWidth > maxDimension || targetHeight > maxDimension) {
    if (targetWidth >= targetHeight) {
      targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
      targetWidth = maxDimension;
    } else {
      targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
      targetHeight = maxDimension;
    }
  }

  // Draw decoded RGBA pixels to full-size canvas first
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = width;
  srcCanvas.height = height;
  const srcCtx = srcCanvas.getContext('2d');
  if (!srcCtx) throw new Error('No se pudo inicializar canvas para HEIC.');

  const imageData = srcCtx.createImageData(width, height);
  imageData.data.set(data);
  srcCtx.putImageData(imageData, 0, 0);

  if (targetWidth === width && targetHeight === height) {
    return srcCanvas.toDataURL('image/jpeg', quality);
  }

  // Scale down if larger than maxDimension
  const destCanvas = document.createElement('canvas');
  destCanvas.width = targetWidth;
  destCanvas.height = targetHeight;
  const destCtx = destCanvas.getContext('2d');
  if (!destCtx) throw new Error('No se pudo inicializar canvas de destino para HEIC.');

  destCtx.fillStyle = '#ffffff';
  destCtx.fillRect(0, 0, targetWidth, targetHeight);
  destCtx.drawImage(srcCanvas, 0, 0, targetWidth, targetHeight);

  return destCanvas.toDataURL('image/jpeg', quality);
}

/**
 * Compresses and resizes an image file so it doesn't overburden
 * network transfers, memory, and database storage.
 * Automatically converts HEIC (iPhone/Mac) to standard JPEG before compressing.
 *
 * @param rawFile The image File or Blob to compress.
 * @param maxDimension The maximum allowed width or height in pixels (default 1000px).
 * @param quality JPEG compression quality between 0 and 1 (default 0.72).
 * @returns Promise resolving to a base64 data URL string.
 */
export async function compressImageFile(
  rawFile: File | Blob,
  maxDimension = 1000,
  quality = 0.72
): Promise<string> {
  if (!isImageFile(rawFile)) {
    throw new Error('El archivo no es una imagen válida.');
  }

  // If it's an HEIC file (iPhone/Mac), decode directly to JPEG Data URL
  if (isHeicFile(rawFile)) {
    try {
      return await convertHeicToJpegDataUrl(rawFile, maxDimension, quality);
    } catch (err) {
      console.error('Error al decodificar imagen HEIC en cliente:', err);
    }
  }

  const file = rawFile;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        reject(new Error('No se pudo leer la imagen.'));
        return;
      }

      // If SVG or gif animation, do not draw to canvas (keep original)
      if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
        resolve(dataUrl);
        return;
      }

      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        // If dimensions and file size are already small, resolve directly
        if (width <= maxDimension && height <= maxDimension && file.size < 200 * 1024) {
          resolve(dataUrl);
          return;
        }

        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        // Fill white background for JPEGs to prevent black backgrounds on transparent PNGs
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        try {
          const compressed = canvas.toDataURL('image/jpeg', quality);
          // Return the smaller of original or compressed
          resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
        } catch {
          resolve(dataUrl);
        }
      };

      img.onerror = () => {
        if (dataUrl.startsWith('data:image/')) {
          resolve(dataUrl);
        } else {
          reject(new Error('Formato de imagen no soportado por el navegador.'));
        }
      };
      img.src = dataUrl;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Converts a remote or blob image URL (such as images pasted from Google Drive or Docs)
 * into a compressed base64 Data URL so it is fully self-contained in the ticket.
 */
export async function convertImageUrlToDataUrl(
  url: string,
  maxDimension = 1000,
  quality = 0.72
): Promise<string> {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('data:image/')) return url;

  let targetUrl = url;
  const driveMatch = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    targetUrl = `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
  }

  // 1. Try fetching directly (works for blob: URLs and CORS-enabled CDNs)
  try {
    const res = await fetch(targetUrl, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      if (blob.type.startsWith('image/')) {
        return await compressImageFile(blob, maxDimension, quality);
      }
    }
  } catch {
    // Fetch failed or blocked by CORS, proceed to image element fallback
  }

  // 2. Try Image + Canvas fallback with crossOrigin
  return new Promise<string>((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width >= height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(url);
            return;
          }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch {
          resolve(url);
        }
      };
      img.onerror = () => resolve(url);
      img.src = url;
    } catch {
      resolve(url);
    }
  });
}

export interface CommentAttachment {
  name: string;
  url: string;
}

/**
 * Parses comment content to separate markdown images and file attachments from textual comment body.
 * Markdown image format: ![alt](url)
 * Markdown file attachment format: [📎 filename](url) or [archivo:filename](url)
 */
export function parseCommentContent(content: string = ''): {
  text: string;
  images: string[];
  files: CommentAttachment[];
} {
  const images: string[] = [];
  const files: CommentAttachment[] = [];
  if (!content) return { text: '', images, files };

  // Match markdown images: ![alt](url)
  // Handles data URLs, relative paths (/tickets/attachments/...), and http/https URLs
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;

  let cleaned = content.replace(imgRegex, (_, _alt, url) => {
    images.push(url.trim());
    return '';
  });

  // Match markdown files: [📎 filename](url) or [archivo:filename](url)
  const fileRegex = /\[(?:📎\s*|archivo:\s*)([^\]]+)\]\(([^)]+)\)/gi;

  cleaned = cleaned.replace(fileRegex, (_, fileName, fileUrl) => {
    files.push({ name: fileName.trim(), url: fileUrl.trim() });
    return '';
  });

  const textWithoutMedia = cleaned
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    text: textWithoutMedia,
    images,
    files,
  };
}

/**
 * Helper to build the final markdown comment string combining text, attached images, and attached files.
 */
export function buildCommentContent(
  text: string,
  images: string[] = [],
  files: CommentAttachment[] = []
): string {
  const trimmed = text.trim();
  const imageMarkdown = images
    .filter(Boolean)
    .map((img) => `![imagen](${img})`)
    .join('\n\n');

  const fileMarkdown = files
    .filter((f) => f && f.name && f.url)
    .map((f) => `[📎 ${f.name}](${f.url})`)
    .join('\n\n');

  const parts = [trimmed, imageMarkdown, fileMarkdown].filter(Boolean);
  return parts.join('\n\n');
}
