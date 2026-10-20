import React, { useRef, useState, useEffect, useCallback } from 'react';
import { MessageSquare, Image as ImageIcon } from 'lucide-react';
import { ensureAbsoluteUrl } from '../lib/utils';
import { compressImageFile } from '../lib/imageCompression';
import { insertHtmlIntoEditor } from './RichTextEditor';

export async function insertImageIntoEditor(
  editor: HTMLDivElement | null,
  file: File,
  onChange?: (val: string) => void
) {
  if (!editor || !file.type.startsWith('image/')) return;
  try {
    const dataUrl = await compressImageFile(file);
    const imgHtml = `<img src="${dataUrl}" alt="${file.name}" referrerpolicy="no-referrer" style="max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0; display: block;" />`;
    insertHtmlIntoEditor(editor, imgHtml);
    if (onChange) {
      onChange(editor.innerHTML);
    }
  } catch (err) {
    console.error('Error al insertar imagen en editor:', err);
  }
}

export function applyFormatToEditor(
  editor: HTMLDivElement | null,
  format: 'bold' | 'italic' | 'underline' | 'strike' | 'bullet' | 'number' | 'link',
  onChange?: (val: string) => void
) {
  if (!editor) return;
  if (document.activeElement !== editor && !editor.contains(document.activeElement)) {
    editor.focus();
  }

  switch (format) {
    case 'bold':
      document.execCommand('bold', false);
      break;
    case 'italic':
      document.execCommand('italic', false);
      break;
    case 'underline':
      document.execCommand('underline', false);
      break;
    case 'strike':
      document.execCommand('strikeThrough', false);
      break;
    case 'bullet':
      document.execCommand('insertUnorderedList', false);
      break;
    case 'number':
      document.execCommand('insertOrderedList', false);
      break;
    case 'link': {
      const u = prompt('Ingresá la URL del enlace:');
      if (u) {
        const fullUrl = ensureAbsoluteUrl(u);
        document.execCommand('createLink', false, fullUrl);
        const links = editor.querySelectorAll(`a[href="${fullUrl}"]`);
        links.forEach(l => {
          l.setAttribute('target', '_blank');
          l.setAttribute('rel', 'noopener noreferrer');
        });
      }
      break;
    }
  }

  if (onChange) {
    onChange(editor.innerHTML);
  }
}

export function applyFormatToTextarea(
  textarea: HTMLTextAreaElement | null,
  format: 'bold' | 'italic' | 'underline' | 'strike' | 'bullet' | 'number' | 'link',
  currentValue: string,
  onChange: (val: string) => void
) {
  if (!textarea) return;
  const s = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  const val = currentValue || '';
  const selected = val.slice(s, end);

  let next = val;
  let newStart = s;
  let newEnd = end;

  switch (format) {
    case 'bold': {
      const tag = '**';
      next = val.slice(0, s) + tag + (selected || 'texto') + tag + val.slice(end);
      newStart = s + tag.length;
      newEnd = s + tag.length + (selected ? selected.length : 5);
      break;
    }
    case 'italic': {
      const tag = '*';
      next = val.slice(0, s) + tag + (selected || 'texto') + tag + val.slice(end);
      newStart = s + tag.length;
      newEnd = s + tag.length + (selected ? selected.length : 5);
      break;
    }
    case 'underline': {
      const tag = '_';
      next = val.slice(0, s) + tag + (selected || 'texto') + tag + val.slice(end);
      newStart = s + tag.length;
      newEnd = s + tag.length + (selected ? selected.length : 5);
      break;
    }
    case 'strike': {
      const tag = '~';
      next = val.slice(0, s) + tag + (selected || 'texto') + tag + val.slice(end);
      newStart = s + tag.length;
      newEnd = s + tag.length + (selected ? selected.length : 5);
      break;
    }
    case 'bullet': {
      const prefix = s > 0 && val[s - 1] !== '\n' ? '\n• ' : '• ';
      next = val.slice(0, s) + prefix + selected + val.slice(end);
      newStart = s + prefix.length;
      newEnd = s + prefix.length + selected.length;
      break;
    }
    case 'number': {
      const prefix = s > 0 && val[s - 1] !== '\n' ? '\n1. ' : '1. ';
      next = val.slice(0, s) + prefix + selected + val.slice(end);
      newStart = s + prefix.length;
      newEnd = s + prefix.length + selected.length;
      break;
    }
    case 'link': {
      const u = prompt('Ingresá la URL del enlace:');
      if (u) {
        const fullUrl = ensureAbsoluteUrl(u);
        const text = selected || 'enlace';
        next = val.slice(0, s) + `[${text}](${fullUrl})` + val.slice(end);
        newStart = s + 1;
        newEnd = s + 1 + text.length;
      } else {
        return;
      }
      break;
    }
  }

  onChange(next);
  setTimeout(() => {
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(newStart, newEnd);
    }
  }, 0);
}

export interface TextFormatToolbarProps {
  editorRef?: React.RefObject<HTMLDivElement | null>;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  value?: string;
  onChange?: (val: string) => void;
  onComment?: () => void;
  className?: string;
  sticky?: boolean;
  stickyOffset?: number | string;
}

export function TextFormatToolbar({
  editorRef,
  textareaRef,
  value = '',
  onChange,
  onComment,
  className = '',
  sticky = false,
  stickyOffset,
}: TextFormatToolbarProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [bubbleState, setBubbleState] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const handleFormat = (format: 'bold' | 'italic' | 'underline' | 'strike' | 'bullet' | 'number' | 'link') => {
    if (editorRef?.current) {
      applyFormatToEditor(editorRef.current, format, onChange);
    } else if (textareaRef?.current && onChange) {
      applyFormatToTextarea(textareaRef.current, format, value, onChange);
    }
  };

  const updateBubble = useCallback(() => {
    if (!editorRef?.current) {
      setBubbleState(null);
      return;
    }

    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      setBubbleState(null);
      return;
    }

    const editor = editorRef.current;
    const anchorNode = sel.anchorNode;
    const focusNode = sel.focusNode;

    if (!anchorNode || !focusNode || !editor.contains(anchorNode) || !editor.contains(focusNode)) {
      setBubbleState(null);
      return;
    }

    const text = sel.toString().trim();
    if (!text) {
      setBubbleState(null);
      return;
    }

    try {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        setBubbleState(null);
        return;
      }

      if (rect.bottom < 40 || rect.top > window.innerHeight) {
        setBubbleState(null);
        return;
      }

      const bubbleWidth = onComment ? 280 : 200;
      const bubbleHeight = 36;

      let top = rect.top - bubbleHeight - 8;
      if (top < 60) {
        top = rect.bottom + 8;
      }

      let left = rect.left + rect.width / 2 - bubbleWidth / 2;
      left = Math.max(10, Math.min(window.innerWidth - bubbleWidth - 10, left));

      setBubbleState({ top, left });
    } catch {
      setBubbleState(null);
    }
  }, [editorRef, onComment]);

  useEffect(() => {
    if (!editorRef) return;

    const onSelectionChange = () => {
      updateBubble();
    };

    const onScroll = () => {
      updateBubble();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setBubbleState(null);
      }
    };

    document.addEventListener('selectionchange', onSelectionChange);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [editorRef, updateBubble]);

  const stickyStyles: React.CSSProperties = sticky ? {
    position: 'sticky',
    top: typeof stickyOffset === 'number' ? `${stickyOffset}px` : (stickyOffset ?? 'var(--header-sticky-offset, 0px)'),
    zIndex: 20,
  } : {};

  return (
    <>
      <div
        style={stickyStyles}
        className={`flex items-center gap-1 p-1 px-1.5 border-b border-[#d6dde5] bg-[#f7fafc] flex-wrap ${sticky ? 'sticky z-20' : ''} ${className}`}
      >
      <button
        type="button"
        onMouseDown={e => {
          e.preventDefault();
          handleFormat('bold');
        }}
        className="min-w-[28px] h-7 px-1.5 border-0 bg-transparent rounded-md cursor-pointer text-[13px] font-extrabold text-[#3a4655] hover:bg-[#eef3f7] transition-colors"
        title="Negrita"
      >
        B
      </button>
      <button
        type="button"
        onMouseDown={e => {
          e.preventDefault();
          handleFormat('italic');
        }}
        className="min-w-[28px] h-7 px-1.5 border-0 bg-transparent rounded-md cursor-pointer text-[13px] italic font-medium text-[#3a4655] hover:bg-[#eef3f7] transition-colors"
        title="Cursiva"
      >
        I
      </button>
      <button
        type="button"
        onMouseDown={e => {
          e.preventDefault();
          handleFormat('underline');
        }}
        className="min-w-[28px] h-7 px-1.5 border-0 bg-transparent rounded-md cursor-pointer text-[13px] underline font-medium text-[#3a4655] hover:bg-[#eef3f7] transition-colors"
        title="Subrayado"
      >
        U
      </button>
      <button
        type="button"
        onMouseDown={e => {
          e.preventDefault();
          handleFormat('strike');
        }}
        className="min-w-[28px] h-7 px-1.5 border-0 bg-transparent rounded-md cursor-pointer text-[13px] line-through font-medium text-[#3a4655] hover:bg-[#eef3f7] transition-colors"
        title="Tachado"
      >
        S
      </button>
      <button
        type="button"
        onMouseDown={e => {
          e.preventDefault();
          handleFormat('bullet');
        }}
        className="min-w-[28px] h-7 px-1.5 border-0 bg-transparent rounded-md cursor-pointer text-[13px] font-medium text-[#3a4655] hover:bg-[#eef3f7] transition-colors"
        title="Lista con viñetas"
      >
        •
      </button>
      <button
        type="button"
        onMouseDown={e => {
          e.preventDefault();
          handleFormat('number');
        }}
        className="min-w-[28px] h-7 px-1.5 border-0 bg-transparent rounded-md cursor-pointer text-[13px] font-medium text-[#3a4655] hover:bg-[#eef3f7] transition-colors"
        title="Lista numerada"
      >
        1.
      </button>
      <button
        type="button"
        onMouseDown={e => {
          e.preventDefault();
          handleFormat('link');
        }}
        className="min-w-[28px] h-7 px-1.5 border-0 bg-transparent rounded-md cursor-pointer text-[13px] font-bold text-[#3a4655] hover:bg-[#eef3f7] transition-colors"
        title="Enlace"
      >
        Link
      </button>

      <button
        type="button"
        onMouseDown={e => {
          e.preventDefault();
          imageInputRef.current?.click();
        }}
        className="min-w-[28px] h-7 px-1.5 border-0 bg-transparent rounded-md cursor-pointer text-[13px] font-medium text-[#3a4655] hover:bg-[#eef3f7] transition-colors flex items-center justify-center gap-1"
        title="Insertar imagen"
        aria-label="Insertar imagen"
      >
        <ImageIcon className="w-3.5 h-3.5" />
      </button>
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*"
        className="hidden"
        data-testid="toolbar-image-input"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            if (editorRef?.current) {
              await insertImageIntoEditor(editorRef.current, file, onChange);
            }
            e.target.value = '';
          }
        }}
      />

      {onComment && (
        <>
          <span className="w-px h-[18px] bg-[#d6dde5] mx-1"></span>
          <button
            type="button"
            data-comment-trigger="1"
            onMouseDown={e => {
              e.preventDefault();
              onComment();
            }}
            title="Seleccioná texto y dejá un comentario"
            className="h-7 px-2 border-0 bg-transparent rounded-md cursor-pointer font-anek text-[13px] font-bold text-[#024fff] flex items-center gap-1.5 hover:bg-[#024fff]/8 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" /> Comentar
          </button>
        </>
      )}
      </div>

      {bubbleState && (
        <div
          data-floating-format-bar="1"
          style={{
            position: 'fixed',
            top: `${bubbleState.top}px`,
            left: `${bubbleState.left}px`,
            zIndex: 60,
          }}
          className="flex items-center gap-0.5 p-1 px-1.5 bg-[#000033] text-white rounded-xl shadow-[0_8px_24px_rgba(0,14,31,0.32)] border border-white/20 text-xs animate-in fade-in zoom-in-95 duration-150 select-none pointer-events-auto"
        >
          <button
            type="button"
            onMouseDown={e => {
              e.preventDefault();
              handleFormat('bold');
              setTimeout(updateBubble, 10);
            }}
            className="min-w-[26px] h-6 px-1.5 border-0 bg-transparent rounded cursor-pointer text-[12px] font-extrabold text-white hover:bg-white/20 transition-colors"
            title="Negrita"
          >
            B
          </button>
          <button
            type="button"
            onMouseDown={e => {
              e.preventDefault();
              handleFormat('italic');
              setTimeout(updateBubble, 10);
            }}
            className="min-w-[26px] h-6 px-1.5 border-0 bg-transparent rounded cursor-pointer text-[12px] italic font-medium text-white hover:bg-white/20 transition-colors"
            title="Cursiva"
          >
            I
          </button>
          <button
            type="button"
            onMouseDown={e => {
              e.preventDefault();
              handleFormat('underline');
              setTimeout(updateBubble, 10);
            }}
            className="min-w-[26px] h-6 px-1.5 border-0 bg-transparent rounded cursor-pointer text-[12px] underline font-medium text-white hover:bg-white/20 transition-colors"
            title="Subrayado"
          >
            U
          </button>
          <button
            type="button"
            onMouseDown={e => {
              e.preventDefault();
              handleFormat('strike');
              setTimeout(updateBubble, 10);
            }}
            className="min-w-[26px] h-6 px-1.5 border-0 bg-transparent rounded cursor-pointer text-[12px] line-through font-medium text-white hover:bg-white/20 transition-colors"
            title="Tachado"
          >
            S
          </button>
          <button
            type="button"
            onMouseDown={e => {
              e.preventDefault();
              handleFormat('link');
              setTimeout(updateBubble, 10);
            }}
            className="min-w-[26px] h-6 px-1.5 border-0 bg-transparent rounded cursor-pointer text-[12px] font-bold text-white hover:bg-white/20 transition-colors"
            title="Enlace"
          >
            Link
          </button>

          {onComment && (
            <>
              <span className="w-px h-3.5 bg-white/25 mx-0.5" />
              <button
                type="button"
                data-comment-trigger="1"
                onMouseDown={e => {
                  e.preventDefault();
                  setBubbleState(null);
                  onComment();
                }}
                className="h-6 px-2 border-0 bg-[#024fff] hover:bg-[#0c57d3] text-white rounded cursor-pointer font-anek text-[12px] font-bold flex items-center gap-1 transition-colors ml-0.5"
                title="Comentar selección"
              >
                <MessageSquare className="w-3 h-3" />
                <span>Comentar</span>
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
