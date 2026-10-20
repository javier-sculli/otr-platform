/**
 * Compresses and resizes an image file so it doesn't overburden
 * network transfers, memory, and database storage.
 *
 * @param file The image File or Blob to compress.
 * @param maxDimension The maximum allowed width or height in pixels (default 1400px).
 * @param quality JPEG compression quality between 0 and 1 (default 0.82).
 * @returns Promise resolving to a base64 data URL string.
 */
export function compressImageFile(
  file: File | Blob,
  maxDimension = 1400,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('El archivo no es una imagen válida.'));
      return;
    }

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

      img.onerror = () => resolve(dataUrl);
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
  maxDimension = 1400,
  quality = 0.82
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
  // Handles data URLs as well as http/https URLs
  const imgRegex = /!\[([^\]]*)\]\(((?:data:image\/[a-zA-Z0-9.+_-]+;base64,[A-Za-z0-9+/=]+|https?:\/\/[^\s)]+))\)/g;

  let cleaned = content.replace(imgRegex, (_, _alt, url) => {
    images.push(url);
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
