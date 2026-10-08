import React from 'react';
import { MessageSquare } from 'lucide-react';

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
        document.execCommand('createLink', false, u);
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
        const text = selected || 'enlace';
        next = val.slice(0, s) + `[${text}](${u})` + val.slice(end);
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
}

export function TextFormatToolbar({
  editorRef,
  textareaRef,
  value = '',
  onChange,
  onComment,
  className = '',
}: TextFormatToolbarProps) {
  const handleFormat = (format: 'bold' | 'italic' | 'underline' | 'strike' | 'bullet' | 'number' | 'link') => {
    if (editorRef?.current) {
      applyFormatToEditor(editorRef.current, format, onChange);
    } else if (textareaRef?.current && onChange) {
      applyFormatToTextarea(textareaRef.current, format, value, onChange);
    }
  };

  return (
    <div className={`flex items-center gap-1 p-1 px-1.5 border-b border-[#d6dde5] bg-[#f7fafc] flex-wrap ${className}`}>
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
  );
}
