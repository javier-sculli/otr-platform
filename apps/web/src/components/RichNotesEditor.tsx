import { useRef, useEffect } from 'react';
import { Bold, Italic, List, ListOrdered, Heading, Link2, ImageIcon } from 'lucide-react';

interface RichNotesEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  minHeight?: string;
}

export function RichNotesEditor({
  value,
  onChange,
  onBlur,
  placeholder = 'Notas de diseño (podés escribir o pegar directamente textos, imágenes y links desde Notion)...',
  minHeight = '280px',
}: RichNotesEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isUpdatingRef = useRef(false);
  const draggedImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (editorRef.current && !isUpdatingRef.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || '';
      }
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      isUpdatingRef.current = true;
      const html = editorRef.current.innerHTML;
      onChange(html === '<br>' ? '' : html);
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 0);
    }
  };

  const execCmd = (cmd: string, arg?: string) => {
    document.execCommand(cmd, false, arg);
    handleInput();
    editorRef.current?.focus();
  };

  const insertImage = (src: string) => {
    const imgHtml = `<img src="${src}" draggable="true" style="width: 320px; max-width: 100%; height: auto; border-radius: 8px; margin: 6px 0; border: 2px solid transparent; cursor: move; display: inline-block;" class="rich-editor-img transition-all hover:border-[#024fff]/50" />&nbsp;`;
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

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    // 1. Pegado de imagen directa (captura de pantalla / archivo de imagen en portapapeles)
    const items = Array.from(e.clipboardData.items || []);
    const imageItem = items.find(item => item.type.startsWith('image/'));
    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) handleImageFile(file);
      return;
    }

    // 2. Pegado de contenido HTML (de cualquier web, Notion, Docs, Figma, ChatGPT)
    const html = e.clipboardData.getData('text/html');
    if (html) {
      e.preventDefault();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Limpiar solo scripts/iframes dañinos
      doc.querySelectorAll('script, style, iframe, meta, input').forEach(el => el.remove());

      // Estilar imágenes para que permitan mover en el centro y escalar en los bordes
      doc.querySelectorAll('img').forEach(img => {
        img.setAttribute('draggable', 'true');
        img.style.maxWidth = '100%';
        img.style.width = '320px';
        img.style.height = 'auto';
        img.style.borderRadius = '8px';
        img.style.margin = '6px 0';
        img.style.border = '2px solid transparent';
        img.style.cursor = 'move';
        img.style.display = 'inline-block';
        img.classList.add('transition-all', 'hover:border-[#024fff]/50');
      });

      const cleanHTML = doc.body.innerHTML;
      document.execCommand('insertHTML', false, cleanHTML);
      handleInput();
      return;
    }

    // 3. Pegado de texto plano
    const text = e.clipboardData.getData('text/plain');
    if (text) {
      e.preventDefault();
      if (/^https?:\/\/[^\s]+$/i.test(text.trim())) {
        const linkHtml = `<a href="${text.trim()}" target="_blank" rel="noopener noreferrer" class="text-[#024fff] underline font-medium">${text.trim()}</a>`;
        document.execCommand('insertHTML', false, linkHtml);
      } else {
        const htmlText = text.replace(/\n/g, '<br>');
        document.execCommand('insertHTML', false, htmlText);
      }
      handleInput();
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target && target.tagName === 'IMG') {
      const img = target as HTMLImageElement;
      const rect = img.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const nearRightEdge = rect.width - x < 18;
      const nearBottomEdge = rect.height - y < 18;
      const nearLeftEdge = x < 18;

      if (nearRightEdge || nearBottomEdge || nearLeftEdge) {
        img.style.cursor = (nearRightEdge && nearBottomEdge) ? 'nwse-resize' : 'ew-resize';
        img.setAttribute('data-resize-zone', 'true');
        img.style.border = '2px dashed #024fff';
      } else {
        img.style.cursor = 'move';
        img.removeAttribute('data-resize-zone');
        img.style.border = '2px solid transparent';
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target && target.tagName === 'IMG') {
      const img = target as HTMLImageElement;
      const isResizeZone = img.getAttribute('data-resize-zone') === 'true';

      if (isResizeZone) {
        e.preventDefault(); // En la zona del borde: escalar tamaño sin arrastrar objeto
        const startX = e.clientX;
        const startWidth = img.offsetWidth;

        const onMouseMove = (moveEvent: MouseEvent) => {
          moveEvent.preventDefault();
          const deltaX = moveEvent.clientX - startX;
          const newWidth = Math.max(80, Math.min(1000, startWidth + deltaX));
          img.style.width = `${newWidth}px`;
          img.style.height = 'auto';
        };

        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          handleInput();
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      } else {
        // En el centro de la imagen: permite arrastrar y soltar la imagen para moverla de lugar en el texto
      }
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target && target.tagName === 'IMG') {
      const isResizeZone = target.getAttribute('data-resize-zone') === 'true';
      if (isResizeZone) {
        e.preventDefault();
      } else {
        draggedImgRef.current = target as HTMLImageElement;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    // 1. Archivos externos
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      Array.from(e.dataTransfer.files).forEach(file => {
        if (file.type.startsWith('image/')) handleImageFile(file);
      });
      return;
    }

    // 2. Imagen interna arrastrada para mover de posición
    if (draggedImgRef.current) {
      e.preventDefault();
      const img = draggedImgRef.current;
      
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

      if (range && editorRef.current?.contains(range.commonAncestorContainer)) {
        img.remove();
        range.insertNode(img);
        const br = document.createElement('br');
        img.after(br);
      } else if (editorRef.current) {
        // Fallback: Si se soltó en un espacio vacío por debajo del texto, mover al final
        img.remove();
        editorRef.current.appendChild(img);
        const br = document.createElement('br');
        editorRef.current.appendChild(br);
      }

      draggedImgRef.current = null;
      handleInput();
    }
  };

  return (
    <div className="border border-[#000033]/15 rounded-xl bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#024fff]/20 focus-within:border-[#024fff]/40 transition-all">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-[#fafafa] border-b border-[#000033]/10 text-[#000033]/60 select-none flex-wrap">
        <button
          type="button"
          onClick={() => execCmd('bold')}
          title="Negrita (Ctrl+B / Cmd+B)"
          className="p-1 hover:bg-[#000033]/5 rounded hover:text-[#000033] transition-all"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCmd('italic')}
          title="Cursiva (Ctrl+I / Cmd+I)"
          className="p-1 hover:bg-[#000033]/5 rounded hover:text-[#000033] transition-all"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-3 bg-[#000033]/15 mx-1" />
        <button
          type="button"
          onClick={() => execCmd('insertUnorderedList')}
          title="Lista de viñetas"
          className="p-1 hover:bg-[#000033]/5 rounded hover:text-[#000033] transition-all"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCmd('insertOrderedList')}
          title="Lista numerada"
          className="p-1 hover:bg-[#000033]/5 rounded hover:text-[#000033] transition-all"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-3 bg-[#000033]/15 mx-1" />
        <button
          type="button"
          onClick={() => execCmd('formatBlock', '<h3>')}
          title="Encabezado"
          className="p-1 hover:bg-[#000033]/5 rounded hover:text-[#000033] transition-all"
        >
          <Heading className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            const url = prompt('Ingresar URL del enlace:');
            if (url) execCmd('createLink', url);
          }}
          title="Agregar Enlace"
          className="p-1 hover:bg-[#000033]/5 rounded hover:text-[#000033] transition-all"
        >
          <Link2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Insertar Imagen desde archivo"
          className="p-1 hover:bg-[#000033]/5 rounded hover:text-[#024fff] transition-all flex items-center gap-1 text-[11px] font-medium"
        >
          <ImageIcon className="w-3.5 h-3.5 text-[#024fff]" />
          <span>Imagen</span>
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

      {/* Editor Content editable */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={onBlur}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragStart={handleDragStart}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onDragOver={(e) => e.preventDefault()}
        data-placeholder={placeholder}
        style={{ minHeight }}
        className="p-3 text-xs text-[#000033] leading-relaxed outline-none overflow-y-auto max-h-[600px] prose prose-xs max-w-none focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-[#000033]/35 empty:before:pointer-events-none"
      />
    </div>
  );
}
