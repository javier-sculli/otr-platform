import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { ensureAbsoluteUrl } from '../lib/utils';
import { compressImageFile, convertImageUrlToDataUrl } from '../lib/imageCompression';
import { readFileAsDataUrl } from '../lib/attachments';
import { cleanJunkHtmlBlocks } from '../lib/htmlSanitizer';

export function insertHtmlIntoEditor(editor: HTMLDivElement | null, htmlToInsert: string) {
  if (!editor) return;
  if (document.activeElement !== editor && !editor.contains(document.activeElement)) {
    editor.focus();
  }
  const sel = typeof window !== 'undefined' ? window.getSelection() : null;
  if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
    const success = document.execCommand('insertHTML', false, htmlToInsert);
    if (!success) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const fragment = range.createContextualFragment(htmlToInsert);
      const lastChild = fragment.lastChild;
      range.insertNode(fragment);
      if (lastChild) {
        range.setStartAfter(lastChild);
        range.setEndAfter(lastChild);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  } else {
    // If no valid selection inside editor, append to end
    editor.insertAdjacentHTML('beforeend', htmlToInsert);
  }
}

export interface RichTextEditorProps {
  value: string;
  onChange: (val: string) => void;
  onBlur?: () => void;
  onFocus?: (e: React.FocusEvent<HTMLDivElement>) => void;
  placeholder?: string;
  minHeight?: string;
  maxHeight?: string;
  className?: string;
  onMarkClick?: (id: string, element: HTMLElement) => void;
  onMarkHover?: (id: string | null, element: HTMLElement | null) => void;
  editorRef?: React.RefObject<HTMLDivElement | null>;
  onImmediateSave?: () => void;
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
      onFocus,
      placeholder = '',
      minHeight = '110px',
      maxHeight,
      className = '',
      onMarkClick,
      onMarkHover,
      editorRef,
      onImmediateSave,
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

      if (document.activeElement !== el && !el.contains(document.activeElement)) {
        const nextVal = value || '';
        if (el.innerHTML !== nextVal) {
          el.innerHTML = nextVal;
        }
      }
    }, [value, activeRef]);

    const handleFocus = (e: React.FocusEvent<HTMLDivElement>) => {
      onFocus?.(e);
    };

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const rawTarget = e.target as Node | null;
      const target = (rawTarget instanceof Element ? rawTarget : rawTarget?.parentElement) as HTMLElement | null;
      const mark = target?.closest('mark[data-c]') as HTMLElement | null;
      if (mark && onMarkClick) {
        const id = mark.dataset.c;
        if (id) {
          onMarkClick(id, mark);
          return;
        }
      }

      const anchor = target?.closest('a') as HTMLAnchorElement | null;
      if (anchor) {
        const rawHref = anchor.getAttribute('href') || anchor.href;
        if (rawHref) {
          // If the user is currently selecting text via drag, don't trigger navigation
          const sel = typeof window !== 'undefined' ? window.getSelection() : null;
          if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
            return;
          }

          e.preventDefault();
          const targetUrl = ensureAbsoluteUrl(rawHref);
          window.open(targetUrl, '_blank', 'noopener,noreferrer');
          return;
        }
      }
    };

    const handleAuxClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button === 1) {
        const rawTarget = e.target as Node | null;
        const target = (rawTarget instanceof Element ? rawTarget : rawTarget?.parentElement) as HTMLElement | null;
        const anchor = target?.closest('a') as HTMLAnchorElement | null;
        if (anchor) {
          const rawHref = anchor.getAttribute('href') || anchor.href;
          if (rawHref) {
            e.preventDefault();
            const targetUrl = ensureAbsoluteUrl(rawHref);
            window.open(targetUrl, '_blank', 'noopener,noreferrer');
          }
        }
      }
    };

    const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
      // 1. Check for image files in clipboard
      const items = Array.from(e.clipboardData.items || []);
      const imageItem = items.find(it => it.type.startsWith('image/'));
      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) {
          e.preventDefault();
          try {
            const compressed = await compressImageFile(file);
            const imgHtml = `<img src="${compressed}" alt="${file.name || 'imagen'}" referrerpolicy="no-referrer" style="max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0; display: block;" />`;
            insertHtmlIntoEditor(activeRef.current, imgHtml);
            if (activeRef.current) {
              onChange(activeRef.current.innerHTML);
              onImmediateSave?.();
            }
          } catch (err) {
            console.error('Error al procesar imagen pegada:', err);
          }
          return;
        }
      }

      // 2. Check for PDF or document files in clipboard
      const docItem = items.find(it => it.type === 'application/pdf' || it.getAsFile()?.name?.toLowerCase().endsWith('.pdf'));
      if (docItem) {
        const file = docItem.getAsFile();
        if (file) {
          e.preventDefault();
          try {
            const dataUrl = await readFileAsDataUrl(file);
            const docHtml = `<a href="${dataUrl}" download="${file.name}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; margin: 6px 0; border: 1px solid #d6dde5; border-radius: 6px; background-color: #f7fafc; color: #024fff; text-decoration: none; font-size: 13px; font-weight: 600;">📄 ${file.name}</a><br>`;
            insertHtmlIntoEditor(activeRef.current, docHtml);
            if (activeRef.current) {
              onChange(activeRef.current.innerHTML);
              onImmediateSave?.();
            }
          } catch (err) {
            console.error('Error al procesar archivo pegado:', err);
          }
          return;
        }
      }

      const html = e.clipboardData.getData('text/html');
      const text = e.clipboardData.getData('text/plain');

      // 3. Check for HTML containing images (e.g. copied from Google Drive, Google Docs, or web pages)
      const docHtml = html ? new DOMParser().parseFromString(html, 'text/html') : null;
      const htmlImages = docHtml ? Array.from(docHtml.querySelectorAll('img')) : [];
      const htmlText = docHtml?.body?.textContent?.trim() || '';

      if (htmlImages.length > 0) {
        e.preventDefault();
        for (const imgEl of htmlImages) {
          const rawSrc = imgEl.getAttribute('src');
          if (!rawSrc) continue;
          try {
            const dataUrl = await convertImageUrlToDataUrl(rawSrc);
            imgEl.setAttribute('src', dataUrl);
            imgEl.setAttribute('referrerpolicy', 'no-referrer');
            imgEl.setAttribute('style', 'max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0; display: block;');
          } catch (err) {
            console.error('Error al procesar imagen HTML:', err);
          }
        }
        if (htmlText.length < 80) {
          for (const imgEl of htmlImages) {
            insertHtmlIntoEditor(activeRef.current, imgEl.outerHTML);
          }
        } else {
          const cleaned = cleanJunkHtmlBlocks(docHtml?.body?.innerHTML || '');
          insertHtmlIntoEditor(activeRef.current, cleaned);
        }
        if (activeRef.current) {
          onChange(activeRef.current.innerHTML);
          onImmediateSave?.();
        }
        return;
      }

      if (!text && !html) return;

      // 4. Check for Markdown bold formatting in pasted text (**bold** or __bold__)
      if (text && (/\*\*[^*]+\*\*/.test(text) || /__[^_]+__/.test(text))) {
        e.preventDefault();
        const mdHtml = cleanJunkHtmlBlocks(text);
        insertHtmlIntoEditor(activeRef.current, mdHtml);
        if (activeRef.current) {
          onChange(activeRef.current.innerHTML);
          onImmediateSave?.();
        }
        return;
      }

      // If rich HTML is present with actual <a href="...">, let browser paste natively
      if (html && /<a\s+[^>]*href=/i.test(html)) {
        return;
      }

      const urlRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/i;
      if (!urlRegex.test(text)) {
        // 5. Clean rich text pasted from Notion/Docs without URLs
        if (html) {
          e.preventDefault();
          const cleaned = cleanJunkHtmlBlocks(html);
          insertHtmlIntoEditor(activeRef.current, cleaned);
          if (activeRef.current) {
            onChange(activeRef.current.innerHTML);
            onImmediateSave?.();
          }
        }
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
      insertHtmlIntoEditor(activeRef.current, linkHtml);

      if (activeRef.current) {
        onChange(activeRef.current.innerHTML);
      }
    };

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
      const files = Array.from(e.dataTransfer.files || []);
      if (files.length === 0) return;

      const imgFiles = files.filter(f => f.type.startsWith('image/'));
      const docFiles = files.filter(f => !f.type.startsWith('image/'));

      if (imgFiles.length > 0 || docFiles.length > 0) {
        e.preventDefault();
        for (const f of imgFiles) {
          try {
            const compressed = await compressImageFile(f);
            const imgHtml = `<img src="${compressed}" alt="${f.name}" referrerpolicy="no-referrer" style="max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0; display: block;" />`;
            insertHtmlIntoEditor(activeRef.current, imgHtml);
          } catch (err) {
            console.error(err);
          }
        }
        for (const f of docFiles) {
          try {
            const dataUrl = await readFileAsDataUrl(f);
            const docHtml = `<a href="${dataUrl}" download="${f.name}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; margin: 6px 0; border: 1px solid #d6dde5; border-radius: 6px; background-color: #f7fafc; color: #024fff; text-decoration: none; font-size: 13px; font-weight: 600;">📄 ${f.name}</a><br>`;
            insertHtmlIntoEditor(activeRef.current, docHtml);
          } catch (err) {
            console.error(err);
          }
        }
        if (activeRef.current) {
          onChange(activeRef.current.innerHTML);
          onImmediateSave?.();
        }
      }
    };

    const handleMouseOver = (e: React.MouseEvent<HTMLDivElement>) => {
      const rawTarget = e.target as Node | null;
      const target = (rawTarget instanceof Element ? rawTarget : rawTarget?.parentElement) as HTMLElement | null;
      const anchor = target?.closest('a') as HTMLAnchorElement | null;
      if (anchor && !anchor.title) {
        const rawHref = anchor.getAttribute('href') || anchor.href;
        if (rawHref) {
          anchor.title = ensureAbsoluteUrl(rawHref);
        }
      }

      if (!onMarkHover) return;
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
        onAuxClick={handleAuxClick}
        onMouseOver={handleMouseOver}
        onMouseLeave={handleMouseLeave}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
          }
        }}
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
