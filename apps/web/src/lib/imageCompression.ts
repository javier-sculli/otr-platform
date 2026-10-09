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
 * Parses comment content to separate markdown images from textual comment body.
 * Markdown image format: ![alt](url)
 */
export function parseCommentContent(content: string = ''): {
  text: string;
  images: string[];
} {
  const images: string[] = [];
  if (!content) return { text: '', images };

  // Match markdown images: ![alt](url)
  // Handles data URLs as well as http/https URLs
  const imgRegex = /!\[([^\]]*)\]\(((?:data:image\/[a-zA-Z0-9.+_-]+;base64,[A-Za-z0-9+/=]+|https?:\/\/[^\s)]+))\)/g;

  const textWithoutImages = content
    .replace(imgRegex, (_, _alt, url) => {
      images.push(url);
      return '';
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    text: textWithoutImages,
    images,
  };
}

/**
 * Helper to build the final markdown comment string combining text and attached images.
 */
export function buildCommentContent(text: string, images: string[] = []): string {
  const trimmed = text.trim();
  const imageMarkdown = images
    .filter(Boolean)
    .map((img) => `![imagen](${img})`)
    .join('\n\n');

  if (!imageMarkdown) return trimmed;
  if (!trimmed) return imageMarkdown;
  return `${trimmed}\n\n${imageMarkdown}`;
}
