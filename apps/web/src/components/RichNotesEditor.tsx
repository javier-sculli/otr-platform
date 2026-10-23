import { useRef } from 'react';
import { RichTextEditor } from './RichTextEditor';
import { TextFormatToolbar } from './TextFormatToolbar';

export { fixNotionImageUrl, cleanJunkHtmlBlocks } from '../lib/htmlSanitizer';

export interface RichNotesEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onPaste?: (info: {
    pastedText: string;
    finalHtml: string;
    isSubstantial: boolean;
  }) => void;
  placeholder?: string;
  minHeight?: string;
  maxHeight?: string;
  className?: string;
}

/**
 * Unified RichNotesEditor component.
 * Shares the core contentEditable engine from RichTextEditor with an integrated TextFormatToolbar.
 */
export function RichNotesEditor({
  value,
  onChange,
  onBlur,
  placeholder = 'Escribí o pegá notas, referencias, links e imágenes...',
  minHeight = '280px',
  maxHeight,
  className = '',
}: RichNotesEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  return (
    <div className={`editor-sticky-section border border-[#d6dde5] rounded-[10px] bg-white relative shadow-xs ${className}`}>
      {/* Toolbar */}
      <div
        data-sticky-toolbar="notes"
        className="editor-sticky-toolbar sticky top-0 z-20 border-b border-[#d6dde5] bg-[#f7fafc]/95 backdrop-blur-xs rounded-t-[9px] shadow-[0_2px_8px_rgba(0,0,51,0.04)]"
      >
        <TextFormatToolbar
          editorRef={editorRef}
          value={value}
          onChange={onChange}
          className="border-b-0"
        />
      </div>

      <RichTextEditor
        ref={editorRef}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        minHeight={minHeight}
        maxHeight={maxHeight}
        className="p-4 sm:p-5 text-[15px] leading-[1.65] rounded-b-[9px]"
      />
    </div>
  );
}
