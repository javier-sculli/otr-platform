import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered, Heading1, Heading2,
  Link2, ImageIcon, AlignLeft, AlignCenter, AlignRight, Trash2,
  RemoveFormatting,
} from 'lucide-react';

interface RichNotesEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  minHeight?: string;
}

interface SelectedImageState {
  img: HTMLImageElement;
  width: string;
  align: 'left' | 'center' | 'right';
  top: number;
  left: number;
}

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
      } catch (e) {}
    }
  }

  // Si es URL relativa tipo /secure.notion-static.com/...
  if (src.startsWith('/') && !src.startsWith('//')) {
    return `https://www.notion.so${src}`;
  }

  return src;
}

export async function convertImageUrlToBase64(url: string): Promise<string> {
  const fixedUrl = fixNotionImageUrl(url);
  if (!fixedUrl || fixedUrl.startsWith('data:image/')) return fixedUrl;
  if (!fixedUrl.startsWith('http://') && !fixedUrl.startsWith('https://') && !fixedUrl.startsWith('//')) return fixedUrl;

  const targetUrl = fixedUrl.startsWith('//') ? `https:${fixedUrl}` : fixedUrl;

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      referrerPolicy: 'no-referrer',
    });
    if (res.ok) {
      const blob = await res.blob();
      if (blob && blob.size > 0) {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string' && reader.result.startsWith('data:image/')) {
              resolve(reader.result);
            } else {
              resolve(targetUrl);
            }
          };
          reader.onerror = () => resolve(targetUrl);
          reader.readAsDataURL(blob);
        });
      }
    }
  } catch (e) {
    // Fetch failed or blocked by CORS
  }

  return targetUrl;
}

export function cleanJunkHtmlBlocks(html: string): string {
  if (!html) return '';
  // Si es texto plano con saltos de línea sin etiquetas HTML, convertir \n a <br>
  if (!/<[a-z][\s\S]*>/i.test(html) && html.includes('\n')) {
    html = html.replace(/\n/g, '<br>');
  }
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 1. Eliminar scripts/iframes/meta
    doc.querySelectorAll('script, style, iframe, meta, input').forEach(el => el.remove());

    // 2. Eliminar contenedores vacíos (pre, code, span, div sin texto ni imágenes)
    doc.querySelectorAll('pre, code, span, div, p, blockquote').forEach(el => {
      const text = el.textContent?.replace(/[\s\u200B]/g, '') || '';
      const hasImages = el.querySelector('img') !== null;
      if (!text && !hasImages) {
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

export function RichNotesEditor({
  value,
  onChange,
  onBlur,
  placeholder = 'Escribí o pegá libremente notas de diseño, especificaciones, referencias, links e imágenes desde Notion, ChatGPT o Google Docs...',
  minHeight = '340px',
}: RichNotesEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isUpdatingRef = useRef(false);
  const draggedImgRef = useRef<HTMLImageElement | null>(null);

  const [selectedImgState, setSelectedImgState] = useState<SelectedImageState | null>(null);

  // Sincronizar HTML externo si cambia desde afuera y convertir imágenes externas a Base64 en segundo plano
  useEffect(() => {
    if (editorRef.current && !isUpdatingRef.current) {
      const cleanedValue = cleanJunkHtmlBlocks(value || '');
      if (editorRef.current.innerHTML !== cleanedValue) {
        editorRef.current.innerHTML = cleanedValue;
      }

      // Convertir imágenes externas a Base64 si aún no están convertidas
      const externalImgs = Array.from(editorRef.current.querySelectorAll('img')).filter(
        img => img.src && !img.src.startsWith('data:image/')
      );
      if (externalImgs.length > 0) {
        (async () => {
          let updated = false;
          for (const img of externalImgs) {
            const src = img.getAttribute('src');
            if (src && !src.startsWith('data:image/')) {
              const base64 = await convertImageUrlToBase64(src);
              if (base64 && base64 !== src) {
                img.setAttribute('src', base64);
                updated = true;
              }
            }
          }
          if (updated && editorRef.current) {
            isUpdatingRef.current = true;
            const html = editorRef.current.innerHTML;
            onChange(html === '<br>' ? '' : html);
            setTimeout(() => {
              isUpdatingRef.current = false;
            }, 0);
          }
        })();
      }
    }
  }, [value, onChange]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      isUpdatingRef.current = true;
      const html = editorRef.current.innerHTML;
      onChange(html === '<br>' ? '' : html);
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 0);
    }
  }, [onChange]);

  // Actualizar posición y estado de la barra flotante de imagen seleccionada
  const updateSelectedImgState = useCallback((img: HTMLImageElement | null) => {
    if (!img || !containerRef.current) {
      setSelectedImgState(null);
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();

    // Determinar alineación actual según estilo margin
    let align: 'left' | 'center' | 'right' = 'left';
    if (img.style.marginLeft === 'auto' && img.style.marginRight === 'auto') {
      align = 'center';
    } else if (img.style.marginLeft === 'auto') {
      align = 'right';
    }

    const top = imgRect.top - containerRect.top - 46; // posicionar arriba de la imagen
    const left = Math.max(10, Math.min(containerRect.width - 280, imgRect.left - containerRect.left + (imgRect.width / 2) - 130));

    setSelectedImgState({
      img,
      width: img.style.width || '100%',
      align,
      top: Math.max(8, top),
      left,
    });
  }, []);

  // Manejar selección de imagen
  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target && target.tagName === 'IMG') {
      const img = target as HTMLImageElement;
      // Desmarcar otras imágenes
      editorRef.current?.querySelectorAll('img').forEach(el => {
        el.classList.remove('ring-2', 'ring-[#024fff]', 'ring-offset-2');
      });
      img.classList.add('ring-2', 'ring-[#024fff]', 'ring-offset-2');
      updateSelectedImgState(img);
    } else {
      // Desmarcar selección si hace clic afuera
      editorRef.current?.querySelectorAll('img').forEach(el => {
        el.classList.remove('ring-2', 'ring-[#024fff]', 'ring-offset-2');
      });
      setSelectedImgState(null);
    }
  };

  const execCmd = (cmd: string, arg?: string) => {
    document.execCommand(cmd, false, arg);
    handleInput();
    editorRef.current?.focus();
  };

  const insertImage = (src: string) => {
    const imgHtml = `<img src="${src}" referrerpolicy="no-referrer" draggable="true" style="width: 75%; max-width: 100%; height: auto; border-radius: 12px; margin: 12px 0; display: block; border: 2px solid transparent;" class="rich-editor-img transition-all cursor-pointer hover:shadow-md" />&nbsp;`;
    document.execCommand('insertHTML', false, imgHtml);
    handleInput();
  };

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        insertImage(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const html = e.clipboardData.getData('text/html');
    const items = Array.from(e.clipboardData.items || []);
    const imageItem = items.find(item => item.type.startsWith('image/'));

    // 1. Si hay un archivo directo de imagen en el portapapeles y el HTML no contiene texto real (o es solo un wrapper de imagen)
    if (imageItem && (!html || !html.includes('<p>') && !html.includes('<span>'))) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) {
        handleImageFile(file);
        return;
      }
    }

    // 2. Contenido HTML (de Notion, Google Docs, Figma, ChatGPT, etc.)
    if (html) {
      e.preventDefault();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Limpiar solo elementos dañinos/inseguros
      doc.querySelectorAll('script, style, iframe, meta, input').forEach(el => el.remove());

      // Formatear imágenes pegadas para que sean interactivas y tengan buen estilo Notion
      const imgs = Array.from(doc.querySelectorAll('img'));
      imgs.forEach(img => {
        // Extraer src real y reparar proxy de Notion (/image/https%3A%2F%2F...)
        const rawSrc = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-original-src') || img.closest('a')?.getAttribute('href') || '';
        const fixedSrc = fixNotionImageUrl(rawSrc);
        if (fixedSrc) {
          img.setAttribute('src', fixedSrc);
        }

        // Eliminar textos alt feos tipo "Captura de pantalla..." para que el navegador no muestre cajas con texto feo si tarda la carga
        const alt = img.getAttribute('alt') || '';
        if (/^captura de pantalla|untitled|image|screenshot/i.test(alt) || alt.endsWith('.png') || alt.endsWith('.jpg')) {
          img.removeAttribute('alt');
        }

        img.setAttribute('draggable', 'true');
        img.setAttribute('referrerpolicy', 'no-referrer');
        img.style.maxWidth = '100%';
        if (!img.style.width) img.style.width = '80%';
        img.style.height = 'auto';
        img.style.borderRadius = '12px';
        img.style.margin = '12px 0';
        img.style.display = 'block';
        img.classList.add('transition-all', 'cursor-pointer', 'hover:shadow-md');
      });

      // Eliminar figcaption o subtítulos de capturas de pantalla de Notion
      doc.querySelectorAll('figcaption, figcaption span, .image-caption').forEach(el => {
        const text = el.textContent?.trim() || '';
        if (/^captura de pantalla|untitled|image|screenshot/i.test(text) || text.endsWith('.png') || text.endsWith('.jpg')) {
          el.remove();
        }
      });

      // Formatear enlaces pegados
      doc.querySelectorAll('a').forEach(a => {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
        a.classList.add('text-[#024fff]', 'underline', 'font-medium');
      });

      const cleanHTML = doc.body.innerHTML;
      document.execCommand('insertHTML', false, cleanHTML);
      handleInput();

      // Convertir imágenes externas (Notion AWS S3, etc.) a Base64 en segundo plano para persistencia permanente
      if (editorRef.current) {
        const editorImgs = Array.from(editorRef.current.querySelectorAll('img'));
        let updated = false;
        for (const img of editorImgs) {
          const src = img.getAttribute('src');
          if (src && !src.startsWith('data:image/')) {
            const base64 = await convertImageUrlToBase64(src);
            if (base64 && base64 !== src) {
              img.setAttribute('src', base64);
              updated = true;
            }
          }
        }
        if (updated) {
          handleInput();
        }
      }
      return;
    }

    // 3. Texto plano o URL directa
    const text = e.clipboardData.getData('text/plain');
    if (text) {
      e.preventDefault();
      const trimmed = text.trim();
      if (/^https?:\/\/[^\s]+\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(trimmed)) {
        insertImage(trimmed);
        if (editorRef.current) {
          const lastImg = editorRef.current.querySelector(`img[src="${trimmed}"]`) as HTMLImageElement;
          if (lastImg) {
            const base64 = await convertImageUrlToBase64(trimmed);
            if (base64 && base64 !== trimmed) {
              lastImg.setAttribute('src', base64);
              handleInput();
            }
          }
        }
      } else if (/^https?:\/\/[^\s]+$/i.test(trimmed)) {
        const linkHtml = `<a href="${trimmed}" target="_blank" rel="noopener noreferrer" class="text-[#024fff] underline font-medium">${trimmed}</a>`;
        document.execCommand('insertHTML', false, linkHtml);
        handleInput();
      } else {
        const htmlText = text.replace(/\n/g, '<br>');
        document.execCommand('insertHTML', false, htmlText);
        handleInput();
      }
    }
  };

  // Ajustar alineación de la imagen seleccionada
  const setImageAlign = (align: 'left' | 'center' | 'right') => {
    if (!selectedImgState) return;
    const img = selectedImgState.img;
    img.style.display = 'block';
    if (align === 'left') {
      img.style.marginLeft = '0';
      img.style.marginRight = 'auto';
    } else if (align === 'center') {
      img.style.marginLeft = 'auto';
      img.style.marginRight = 'auto';
    } else if (align === 'right') {
      img.style.marginLeft = 'auto';
      img.style.marginRight = '0';
    }
    handleInput();
    setTimeout(() => updateSelectedImgState(img), 50);
  };

  // Ajustar tamaño de la imagen seleccionada por porcentaje
  const setImageSize = (pct: string) => {
    if (!selectedImgState) return;
    const img = selectedImgState.img;
    img.style.width = pct;
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    handleInput();
    setTimeout(() => updateSelectedImgState(img), 50);
  };

  // Eliminar la imagen seleccionada
  const removeSelectedImage = () => {
    if (!selectedImgState) return;
    selectedImgState.img.remove();
    setSelectedImgState(null);
    handleInput();
  };

  // Escalar imagen arrastrando el tirador de la esquina
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target && target.tagName === 'IMG') {
      const img = target as HTMLImageElement;
      const rect = img.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const nearRightEdge = rect.width - x < 20;
      const nearBottomEdge = rect.height - y < 20;

      if (nearRightEdge && nearBottomEdge) {
        img.style.cursor = 'nwse-resize';
        img.setAttribute('data-resize-zone', 'true');
      } else {
        img.style.cursor = 'pointer';
        img.removeAttribute('data-resize-zone');
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target && target.tagName === 'IMG') {
      const img = target as HTMLImageElement;
      const isResizeZone = img.getAttribute('data-resize-zone') === 'true';

      if (isResizeZone) {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = img.offsetWidth;

        const onMouseMove = (moveEvent: MouseEvent) => {
          moveEvent.preventDefault();
          const deltaX = moveEvent.clientX - startX;
          const newWidth = Math.max(100, Math.min(1200, startWidth + deltaX));
          img.style.width = `${newWidth}px`;
          img.style.height = 'auto';
        };

        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          handleInput();
          updateSelectedImgState(img);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      }
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target && target.tagName === 'IMG') {
      draggedImgRef.current = target as HTMLImageElement;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    // 1. Archivos externos soltados
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      Array.from(e.dataTransfer.files).forEach(file => {
        if (file.type.startsWith('image/')) handleImageFile(file);
      });
      return;
    }

    // 2. Imagen movida de posición dentro del texto
    if (draggedImgRef.current) {
      e.preventDefault();
      const img = draggedImgRef.current;
      const editor = editorRef.current;

      if (!editor) return;

      const editorRect = editor.getBoundingClientRect();
      const isNearTop = e.clientY <= editorRect.top + 45;

      img.remove();

      if (isNearTop && editor.firstChild) {
        // Mover a la parte superior absoluta (arriba del texto)
        editor.insertBefore(img, editor.firstChild);
        const br = document.createElement('br');
        img.after(br);
      } else {
        let range: Range | null = null;
        if (document.caretRangeFromPoint) {
          range = document.caretRangeFromPoint(e.clientX, e.clientY);
        } else if ((document as any).caretPositionFromPoint) {
          const pos = (document as any).caretPositionFromPoint(e.clientX, e.clientY);
          if (pos) {
            range = document.createRange();
            range.setStart(pos.offsetNode, pos.offset);
            range.collapse(true);
          }
        }

        if (range && editor.contains(range.commonAncestorContainer)) {
          range.insertNode(img);
          const br = document.createElement('br');
          img.after(br);
        } else {
          editor.appendChild(img);
          const br = document.createElement('br');
          editor.appendChild(br);
        }
      }

      draggedImgRef.current = null;
      handleInput();
      setTimeout(() => updateSelectedImgState(img), 50);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-white border-2 border-[#000033]/10 rounded-2xl shadow-sm transition-all focus-within:border-[#024fff]/40 focus-within:shadow-md"
    >
      {/* Notion Canvas Sheet Header Bar */}
      <div className="flex items-center justify-end px-3 py-1.5 bg-[#fafafa]/80 border-b border-[#000033]/8 rounded-t-2xl flex-wrap gap-2">

        {/* Action Toolbar */}
        <div className="flex items-center gap-1 text-[#000033]/60 flex-wrap">
          <button
            type="button"
            onClick={() => execCmd('bold')}
            title="Negrita"
            className="p-1 hover:bg-[#000033]/8 rounded hover:text-[#000033] transition-all"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => execCmd('italic')}
            title="Cursiva"
            className="p-1 hover:bg-[#000033]/8 rounded hover:text-[#000033] transition-all"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => execCmd('underline')}
            title="Subrayado"
            className="p-1 hover:bg-[#000033]/8 rounded hover:text-[#000033] transition-all"
          >
            <Underline className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => execCmd('strikeThrough')}
            title="Tachado"
            className="p-1 hover:bg-[#000033]/8 rounded hover:text-[#000033] transition-all"
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-3 bg-[#000033]/15 mx-1" />

          <button
            type="button"
            onClick={() => execCmd('insertUnorderedList')}
            title="Lista de viñetas"
            className="p-1 hover:bg-[#000033]/8 rounded hover:text-[#000033] transition-all"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => execCmd('insertOrderedList')}
            title="Lista numerada"
            className="p-1 hover:bg-[#000033]/8 rounded hover:text-[#000033] transition-all"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-3 bg-[#000033]/15 mx-1" />

          <button
            type="button"
            onClick={() => execCmd('formatBlock', '<h2>')}
            title="Título principal"
            className="p-1 hover:bg-[#000033]/8 rounded hover:text-[#000033] transition-all"
          >
            <Heading1 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => execCmd('formatBlock', '<h3>')}
            title="Subtítulo"
            className="p-1 hover:bg-[#000033]/8 rounded hover:text-[#000033] transition-all"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-3 bg-[#000033]/15 mx-1" />

          <button
            type="button"
            onClick={() => {
              const url = prompt('Ingresar URL del enlace:');
              if (url) execCmd('createLink', url);
            }}
            title="Agregar Enlace"
            className="p-1 hover:bg-[#000033]/8 rounded hover:text-[#000033] transition-all"
          >
            <Link2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Insertar Imagen"
            className="px-2 py-1 bg-[#024fff]/10 border border-[#024fff]/20 text-[#024fff] hover:bg-[#024fff]/20 rounded-md transition-all flex items-center gap-1 text-[11px] font-bold"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Imagen</span>
          </button>

          <button
            type="button"
            onClick={() => {
              execCmd('removeFormat');
              if (editorRef.current) {
                const cleaned = cleanJunkHtmlBlocks(editorRef.current.innerHTML);
                editorRef.current.innerHTML = cleaned;
                handleInput();
              }
            }}
            title="Limpiar Formato y Cajas Grises"
            className="p-1 hover:bg-[#000033]/8 rounded hover:text-[#000033] transition-all ml-1"
          >
            <RemoveFormatting className="w-3.5 h-3.5" />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleImageFile(e.target.files[0]);
                e.target.value = '';
              }
            }}
          />
        </div>
      </div>

      {/* Floating Toolbar para la Imagen Seleccionada */}
      {selectedImgState && (
        <div
          style={{ top: selectedImgState.top, left: selectedImgState.left }}
          className="absolute z-20 flex items-center gap-1.5 px-3 py-1.5 bg-[#000033] text-white rounded-xl shadow-xl border border-white/20 text-xs animate-in fade-in zoom-in-95 duration-150 select-none"
        >
          <span className="text-[10px] text-white/60 font-bold uppercase mr-1">Imagen</span>

          {/* Alineación */}
          <div className="flex items-center gap-0.5 bg-white/10 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setImageAlign('left')}
              title="Alinear Izquierda"
              className={`p-1 rounded hover:bg-white/20 transition-all ${selectedImgState.align === 'left' ? 'bg-white/30 text-white' : 'text-white/70'}`}
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setImageAlign('center')}
              title="Alinear Centro"
              className={`p-1 rounded hover:bg-white/20 transition-all ${selectedImgState.align === 'center' ? 'bg-white/30 text-white' : 'text-white/70'}`}
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setImageAlign('right')}
              title="Alinear Derecha"
              className={`p-1 rounded hover:bg-white/20 transition-all ${selectedImgState.align === 'right' ? 'bg-white/30 text-white' : 'text-white/70'}`}
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="w-px h-3 bg-white/20 mx-0.5" />

          {/* Tamaño rápido */}
          <div className="flex items-center gap-1">
            {(['25%', '50%', '75%', '100%'] as const).map(sz => (
              <button
                key={sz}
                type="button"
                onClick={() => setImageSize(sz)}
                className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-all ${selectedImgState.width === sz ? 'bg-[#024fff] text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
              >
                {sz}
              </button>
            ))}
          </div>

          <div className="w-px h-3 bg-white/20 mx-0.5" />

          {/* Eliminar */}
          <button
            type="button"
            onClick={removeSelectedImage}
            title="Eliminar imagen"
            className="p-1 text-red-300 hover:text-red-100 hover:bg-red-500/30 rounded transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Notion Canvas Body (Editable) */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onClick={handleEditorClick}
        onInput={handleInput}
        onBlur={onBlur}
        onKeyDown={(e) => {
          if (e.key === 'Backspace' || e.key === 'Delete') {
            const selection = window.getSelection();
            if (selection && selection.anchorNode) {
              let parent: HTMLElement | null = selection.anchorNode instanceof HTMLElement
                ? selection.anchorNode
                : selection.anchorNode.parentElement;

              while (parent && parent !== editorRef.current) {
                if (['PRE', 'BLOCKQUOTE', 'CODE', 'DIV', 'SPAN'].includes(parent.tagName)) {
                  const text = parent.textContent?.replace(/[\s\u200B]/g, '') || '';
                  const hasImg = parent.querySelector('img') !== null;
                  if (!text && !hasImg) {
                    e.preventDefault();
                    parent.remove();
                    handleInput();
                    return;
                  }
                }
                parent = parent.parentElement;
              }
            }
          }
        }}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragStart={handleDragStart}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onDragOver={(e) => e.preventDefault()}
        data-placeholder={placeholder}
        style={{ minHeight }}
        className="p-6 sm:p-8 text-sm text-[#000033] leading-relaxed outline-none overflow-y-auto max-h-[650px] prose prose-sm max-w-none focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-[#000033]/35 empty:before:pointer-events-none"
      />
    </div>
  );
}
