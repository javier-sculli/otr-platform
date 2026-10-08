import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

export interface RichTextEditorProps {
  value: string;
  onChange: (val: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  minHeight?: string;
  maxHeight?: string;
  className?: string;
  onMarkClick?: (id: string, element: HTMLElement) => void;
  onMarkHover?: (id: string | null, element: HTMLElement | null) => void;
  editorRef?: React.RefObject<HTMLDivElement | null>;
}

function linkifyText(text: string): string {
  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const urlRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
  let lastIndex = 0;
  let html = '';
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(text)) !== null) {
    html += escapeHtml(text.slice(lastIndex, match.index));
    let rawUrl = match[0];
    let trailingPunct = '';
    const punctMatch = rawUrl.match(/[.,;!?:)]+$/);
    if (punctMatch) {
      trailingPunct = punctMatch[0];
      rawUrl = rawUrl.slice(0, -trailingPunct.length);
    }

    const href = rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
      ? rawUrl
      : `https://${rawUrl}`;

    html += `<a href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(rawUrl)}</a>${escapeHtml(trailingPunct)}`;
    lastIndex = match.index + match[0].length;
  }

  html += escapeHtml(text.slice(lastIndex));
  return html.replace(/\r\n|\r|\n/g, '<br>');
}

export const RichTextEditor = forwardRef<HTMLDivElement, RichTextEditorProps>(
  (
    {
      value,
      onChange,
      onBlur,
      placeholder = '',
      minHeight = '110px',
      maxHeight,
      className = '',
      onMarkClick,
      onMarkHover,
      editorRef,
    },
    ref
  ) => {
    const localRef = useRef<HTMLDivElement>(null);
    const activeRef = (editorRef || localRef) as React.RefObject<HTMLDivElement>;

    useImperativeHandle(ref, () => activeRef.current!, [activeRef]);

    // Initial mount and external sync (only when not focused to preserve caret/typing)
    useEffect(() => {
      const el = activeRef.current;
      if (!el) return;

      if (!('value' in el)) {
        Object.defineProperty(el, 'value', {
          configurable: true,
          get() {
            return this.innerText || this.textContent || '';
          },
          set(v: string) {
            this.innerHTML = v;
          },
        });
      }

      if (document.activeElement !== el) {
        const nextVal = value || '';
        if (el.innerHTML !== nextVal) {
          el.innerHTML = nextVal;
        }
      }
    }, [value, activeRef]);

    const handleFocus = (e: React.FocusEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      if (el && typeof window !== 'undefined' && window.getSelection) {
        try {
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(el);
          range.collapse(false);
          sel?.removeAllRanges();
          sel?.addRange(range);
        } catch {
          // ignore
        }
      }
    };

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      const mark = target?.closest('mark[data-c]') as HTMLElement | null;
      if (mark && onMarkClick) {
        const id = mark.dataset.c;
        if (id) {
          onMarkClick(id, mark);
          return;
        }
      }

      const anchor = target?.closest('a') as HTMLAnchorElement | null;
      if (anchor && anchor.href && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        window.open(anchor.href, '_blank', 'noopener,noreferrer');
        return;
      }

      if (typeof window !== 'undefined' && window.getSelection) {
        const sel = window.getSelection();
        if (sel && sel.isCollapsed && sel.anchorOffset === 0 && e.currentTarget.textContent) {
          try {
            const range = document.createRange();
            range.selectNodeContents(e.currentTarget);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          } catch {
            // ignore
          }
        }
      }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
      const html = e.clipboardData.getData('text/html');
      const text = e.clipboardData.getData('text/plain');
      if (!text && !html) return;

      // If rich HTML is present with actual <a href="...">, let browser paste natively
      if (html && /<a\s+[^>]*href=/i.test(html)) {
        return;
      }

      const urlRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/i;
      if (!urlRegex.test(text)) {
        return;
      }

      e.preventDefault();

      const trimmed = text.trim();
      const isSingleUrl = /^(https?:\/\/[^\s<]+|www\.[^\s<]+)$/i.test(trimmed);
      const sel = window.getSelection();

      // Case 1: Text was selected and a single URL was pasted -> turn selection into link
      if (isSingleUrl && sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        const href = trimmed.startsWith('http://') || trimmed.startsWith('https://')
          ? trimmed
          : `https://${trimmed}`;

        const success = document.execCommand('createLink', false, href);
        if (!success) {
          const range = sel.getRangeAt(0);
          const selectedContent = range.extractContents();
          const a = document.createElement('a');
          a.href = href;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.appendChild(selectedContent);
          range.insertNode(a);
          range.setStartAfter(a);
          range.setEndAfter(a);
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          const links = activeRef.current?.querySelectorAll(`a[href="${href}"]`);
          links?.forEach(l => {
            l.setAttribute('target', '_blank');
            l.setAttribute('rel', 'noopener noreferrer');
          });
        }

        if (activeRef.current) {
          onChange(activeRef.current.innerHTML);
        }
        return;
      }

      // Case 2: Pasted URL or text containing URLs -> insert linkified HTML
      const linkHtml = linkifyText(text);
      const success = document.execCommand('insertHTML', false, linkHtml);
      if (!success && sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const fragment = range.createContextualFragment(linkHtml);
        const last = fragment.lastChild;
        range.insertNode(fragment);
        if (last) {
          range.setStartAfter(last);
          range.setEndAfter(last);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }

      if (activeRef.current) {
        onChange(activeRef.current.innerHTML);
      }
    };

    const handleMouseOver = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onMarkHover) return;
      const target = e.target as HTMLElement | null;
      const mark = target?.closest('mark[data-c]') as HTMLElement | null;
      if (mark) {
        const id = mark.dataset.c || '';
        onMarkHover(id, mark);
      } else {
        onMarkHover(null, null);
      }
    };

    const handleMouseLeave = () => {
      if (onMarkHover) {
        onMarkHover(null, null);
      }
    };

    return (
      <div
        ref={activeRef}
        contentEditable
        suppressContentEditableWarning
        data-ph={placeholder}
        {...({ placeholder } as any)}
        onFocus={handleFocus}
        onClick={handleClick}
        onMouseOver={handleMouseOver}
        onMouseLeave={handleMouseLeave}
        onPaste={handlePaste}
        onInput={e => {
          onChange(e.currentTarget.innerHTML);
        }}
        onBlur={onBlur}
        style={{
          minHeight,
          maxHeight,
          overflowY: maxHeight ? 'auto' : undefined,
        }}
        className={`outline-none text-[#1d2a3a] text-[14px] leading-[1.6] bg-transparent whitespace-pre-wrap break-words ${className}`}
      />
    );
  }
);

RichTextEditor.displayName = 'RichTextEditor';
