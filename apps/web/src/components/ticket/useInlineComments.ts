import { useState, useRef, useCallback } from 'react';

export interface ThreadItem {
  author: string;
  when: string;
  text: string;
}

export interface Thread {
  quote: string;
  items: ThreadItem[];
}

export interface PopoverState {
  id: string;
  x: number;
  y: number;
  isDraft?: boolean;
}

export interface HoverCommentState {
  id: string;
  x: number;
  y: number;
  quote: string;
  items: ThreadItem[];
}

export interface UseInlineCommentsOptions {
  comments?: any[];
  currentUser?: { name?: string | null; email?: string | null } | null;
  onSubmitComment?: (payload: { quote?: string; text: string; fullContent: string }) => void;
}

export const posFor = (mark: HTMLElement) => {
  const b = mark.getBoundingClientRect();
  const x = Math.max(8, Math.min(b.left, window.innerWidth - 308));
  const below = b.bottom + 8;
  const y = below + 260 > window.innerHeight ? Math.max(8, b.top - 268) : below;
  return { x, y };
};

export function useInlineComments({
  comments = [],
  currentUser,
  onSubmitComment,
}: UseInlineCommentsOptions = {}) {
  const [pop, setPop] = useState<PopoverState | null>(null);
  const [popInput, setPopInput] = useState('');
  const [threads, setThreads] = useState<Record<string, Thread>>({});
  const [hoverComment, setHoverComment] = useState<HoverCommentState | null>(null);

  const popRef = useRef<HTMLTextAreaElement>(null);
  const popRefVal = useRef(pop);
  popRefVal.current = pop;

  const threadsRefVal = useRef(threads);
  threadsRefVal.current = threads;

  const commentsRefVal = useRef(comments);
  commentsRefVal.current = comments;

  const draftCleanupRef = useRef<{
    ref: React.RefObject<HTMLDivElement | null>;
    onHtmlChange?: (html: string) => void;
  } | null>(null);

  const getPersistedItems = useCallback((quoteText: string, markId: string | null): ThreadItem[] => {
    const list = commentsRefVal.current || [];
    const matched = list.filter((cm: any) => {
      const rawContent = cm.content || cm.text || '';
      const quoteMatch = rawContent.match(/^«([^»]+)»:\s*([\s\S]*)$/);
      const q = cm.quote || (quoteMatch ? quoteMatch[1] : null);
      const matchById = markId && (markId === `c_${cm.id}` || markId === String(cm.id));
      const matchByQuote = q && (q.trim() === quoteText || quoteText.includes(q.trim()) || q.trim().includes(quoteText));
      return matchById || matchByQuote;
    });

    const seenIds = new Set<string>();
    const uniqueMatched = matched.filter((cm: any) => {
      const idKey = cm.id || `${cm.user?.name || cm.author || ''}:${cm.content || cm.text || ''}`;
      if (seenIds.has(idKey)) return false;
      seenIds.add(idKey);
      return true;
    });

    return uniqueMatched.map((cm: any) => {
      const rawContent = cm.content || cm.text || '';
      const quoteMatch = rawContent.match(/^«([^»]+)»:\s*([\s\S]*)$/);
      const mainContent = quoteMatch ? quoteMatch[2] : rawContent;
      const when = cm.createdAt
        ? new Date(cm.createdAt).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })
        : cm.when || '';
      return {
        author: cm.user?.name || cm.author || 'Usuario',
        when,
        text: mainContent,
      };
    });
  }, []);

  const closePop = useCallback(() => {
    const currentPop = popRefVal.current;
    if (!currentPop) return;

    if (currentPop.isDraft) {
      const currentThreads = threadsRefVal.current;
      const t = currentThreads[currentPop.id];
      if (!t || !t.items || !t.items.length) {
        const mark = document.querySelector(`mark[data-c="${currentPop.id}"]`);
        if (mark) {
          mark.replaceWith(...Array.from(mark.childNodes));
          if (draftCleanupRef.current?.ref?.current && draftCleanupRef.current.onHtmlChange) {
            draftCleanupRef.current.onHtmlChange(draftCleanupRef.current.ref.current.innerHTML);
          }
        }
        setThreads(prev => {
          const c = { ...prev };
          delete c[currentPop.id];
          return c;
        });
      }
      draftCleanupRef.current = null;
    }
    setPop(null);
    setPopInput('');
  }, []);

  const resolvePop = useCallback(() => {
    const currentPop = popRefVal.current;
    if (!currentPop) return;
    const mark = document.querySelector(`mark[data-c="${currentPop.id}"]`);
    if (mark) mark.replaceWith(...Array.from(mark.childNodes));
    setThreads(prev => {
      const c = { ...prev };
      delete c[currentPop.id];
      return c;
    });
    setPop(null);
    setPopInput('');
  }, []);

  const sendPop = useCallback((incomingText?: string) => {
    const currentPop = popRefVal.current;
    if (!currentPop) return;
    const text = (incomingText ?? popInput).trim();
    if (!text) return;

    const d = new Date();
    const when = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const quote = threadsRefVal.current[currentPop.id]?.quote;
    const authorName = currentUser?.name || currentUser?.email || 'Usuario';
    const item: ThreadItem = { author: authorName, when, text };

    setThreads(prev => ({
      ...prev,
      [currentPop.id]: {
        ...prev[currentPop.id],
        items: [...(prev[currentPop.id]?.items || []), item],
      },
    }));

    setPop(prev => (prev ? { ...prev, isDraft: false } : null));
    draftCleanupRef.current = null;

    const fullContent = quote ? `«${quote}»: ${text}` : text;
    onSubmitComment?.({ quote, text, fullContent });
    setPopInput('');
  }, [currentUser, popInput, onSubmitComment]);

  const handleMarkClick = useCallback((id: string, m: HTMLElement) => {
    setHoverComment(null);

    if (popRefVal.current?.isDraft && popRefVal.current.id !== id) {
      const prevT = threadsRefVal.current[popRefVal.current.id];
      if (!prevT || !prevT.items || !prevT.items.length) {
        const prevMark = document.querySelector(`mark[data-c="${popRefVal.current.id}"]`);
        if (prevMark) {
          prevMark.replaceWith(...Array.from(prevMark.childNodes));
          if (draftCleanupRef.current?.ref?.current && draftCleanupRef.current.onHtmlChange) {
            draftCleanupRef.current.onHtmlChange(draftCleanupRef.current.ref.current.innerHTML);
          }
        }
        setThreads(prev => {
          const c = { ...prev };
          delete c[popRefVal.current!.id];
          return c;
        });
      }
      draftCleanupRef.current = null;
    }

    const quoteText = (m.innerText || m.textContent || '').trim();
    const persistedItems = getPersistedItems(quoteText, id);
    const existingLocalItems = threadsRefVal.current[id]?.items || [];

    const combinedItems = [...persistedItems];
    for (const localItem of existingLocalItems) {
      if (!combinedItems.some(p => p.text === localItem.text && p.author === localItem.author)) {
        combinedItems.push(localItem);
      }
    }

    setThreads(prev => ({
      ...prev,
      [id]: {
        quote: quoteText || prev[id]?.quote || '',
        items: combinedItems,
      },
    }));

    setPop({ id, ...posFor(m), isDraft: false });
    setPopInput('');
    setTimeout(() => popRef.current?.focus(), 50);
  }, [getPersistedItems]);

  const handleMarkHover = useCallback((id: string | null, m: HTMLElement | null) => {
    if (!id || !m) {
      setHoverComment(null);
      return;
    }
    if (popRefVal.current) return;

    const quoteText = (m.innerText || m.textContent || '').trim();
    const threadItems = threadsRefVal.current[id]?.items || [];
    const persistedItems = getPersistedItems(quoteText, id);
    const combined: ThreadItem[] = [...persistedItems];
    for (const item of threadItems) {
      if (!combined.some(p => p.text === item.text && p.author === item.author)) {
        combined.push(item);
      }
    }

    setHoverComment({
      id,
      ...posFor(m),
      quote: quoteText || threadsRefVal.current[id]?.quote || '',
      items: combined,
    });
  }, [getPersistedItems]);

  const startInlineComment = useCallback((
    ref: React.RefObject<HTMLDivElement | null>,
    onHtmlChange?: (html: string) => void,
    e?: React.MouseEvent
  ) => {
    if (e) e.preventDefault();
    const root = ref.current;
    const sel = window.getSelection();
    if (!root || !sel || !sel.rangeCount || sel.isCollapsed || !root.contains(sel.anchorNode)) {
      alert('Seleccioná un fragmento del texto para comentarlo.');
      return;
    }

    const quote = sel.toString().trim();
    if (!quote) return;

    const range = sel.getRangeAt(0);

    // Evitar anidar marcas dentro de otra marca existente
    const commonNode = range.commonAncestorContainer;
    const parentMark = commonNode.nodeType === Node.ELEMENT_NODE
      ? (commonNode as HTMLElement).closest('mark[data-c]')
      : commonNode.parentElement?.closest('mark[data-c]');
    if (parentMark) {
      alert('Este texto ya forma parte de un comentario. Podés hacer click sobre él para responder.');
      return;
    }

    if (popRefVal.current?.isDraft) {
      const prevT = threadsRefVal.current[popRefVal.current.id];
      if (!prevT || !prevT.items || prevT.items.length === 0) {
        const prevMark = document.querySelector(`mark[data-c="${popRefVal.current.id}"]`);
        if (prevMark) {
          prevMark.replaceWith(...Array.from(prevMark.childNodes));
          if (draftCleanupRef.current?.ref?.current && draftCleanupRef.current.onHtmlChange) {
            draftCleanupRef.current.onHtmlChange(draftCleanupRef.current.ref.current.innerHTML);
          }
        }
        setThreads(prev => {
          const c = { ...prev };
          delete c[popRefVal.current!.id];
          return c;
        });
      }
      draftCleanupRef.current = null;
    }

    const id = 'c' + Date.now();
    const m = document.createElement('mark');
    m.dataset.c = id;
    m.style.backgroundColor = 'rgba(0, 255, 178, 0.35)';
    m.style.borderRadius = '2px';
    m.style.padding = '1px 2px';
    m.style.cursor = 'pointer';

    try {
      m.appendChild(range.extractContents());
      range.insertNode(m);
    } catch {
      return;
    }
    sel.removeAllRanges();

    draftCleanupRef.current = { ref, onHtmlChange };

    if (ref.current && onHtmlChange) {
      onHtmlChange(ref.current.innerHTML);
    }

    setThreads(prev => ({ ...prev, [id]: { quote, items: [] } }));
    setPop({ id, ...posFor(m), isDraft: true });
    setPopInput('');
    setTimeout(() => popRef.current?.focus(), 50);
  }, []);

  const locateMark = useCallback((
    quoteText: string,
    onBeforeLocate?: (cleanQuote: string) => void
  ) => {
    if (!quoteText) return;
    const cleanQ = quoteText.trim();
    onBeforeLocate?.(cleanQ);

    setTimeout(() => {
      const allMarks = Array.from(document.querySelectorAll('mark[data-c]')) as HTMLElement[];
      const found = allMarks.find(el => {
        const text = (el.innerText || el.textContent || '').trim();
        return text === cleanQ || text.includes(cleanQ) || cleanQ.includes(text);
      });

      if (found) {
        found.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        found.style.transition = 'box-shadow 0.3s ease, background-color 0.3s ease';
        const origBg = found.style.backgroundColor;
        found.style.backgroundColor = '#00ff99';
        found.style.boxShadow = '0 0 0 3px rgba(2, 79, 255, 0.4)';
        setTimeout(() => {
          found.style.backgroundColor = origBg;
          found.style.boxShadow = '';
        }, 1500);
        const markId = found.dataset.c;
        if (markId) {
          handleMarkClick(markId, found);
        }
      }
    }, 60);
  }, [handleMarkClick]);

  return {
    pop,
    setPop,
    popInput,
    setPopInput,
    threads,
    setThreads,
    hoverComment,
    setHoverComment,
    popRef,
    popRefVal,
    posFor,
    closePop,
    resolvePop,
    sendPop,
    handleMarkClick,
    handleMarkHover,
    startInlineComment,
    locateMark,
  };
}
