import { useState } from 'react';
import { Check } from 'lucide-react';
import { MentionTextarea, formatCommentWithMentions } from '../MentionTextarea';

export interface CommentThreadItem {
  author: string;
  when?: string;
  text: string;
}

export interface CommentThread {
  quote: string;
  items: CommentThreadItem[];
}

export interface PopPosition {
  id: string;
  x: number;
  y: number;
}

export interface InlineCommentPopoverProps {
  pop: PopPosition | null;
  thread?: CommentThread;
  users?: { id: string; name: string }[];
  onSend: (text: string) => void;
  onResolve?: () => void;
  onClose: () => void;
}

const ini = (n?: string) =>
  (n || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?';

export function InlineCommentPopover({
  pop,
  thread,
  users = [],
  onSend,
  onResolve,
  onClose,
}: InlineCommentPopoverProps) {
  const [popInput, setPopInput] = useState('');

  if (!pop) return null;

  const handleSend = () => {
    const trimmed = popInput.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setPopInput('');
  };

  const items = thread?.items || [];
  const hasItems = items.length > 0;

  return (
    <div
      data-inline-pop="1"
      data-testid="inline-comment-popover"
      style={{ position: 'fixed', left: `${pop.x}px`, top: `${pop.y}px` }}
      className="w-[300px] bg-white border border-[#d6dde5] rounded-[10px] shadow-[0_12px_32px_rgba(0,14,31,.18)] z-50 flex flex-col overflow-visible animate-in fade-in zoom-in-95"
    >
      {thread?.quote && (
        <div className="p-2.5 px-3 text-[12px] text-[#5b6675] truncate border-l-2 border-[#00e39c] m-2.5 mb-0 pl-2 bg-[#00ff99]/5 rounded-r">
          «{thread.quote}»
        </div>
      )}

      {hasItems && (
        <div className="flex flex-col max-h-[220px] overflow-y-auto" data-testid="popover-thread-items">
          {items.map((it, idx) => (
            <div key={idx} className="flex gap-2 p-2.5 px-3 pt-2">
              <span className="w-5 h-5 rounded-full bg-[#eef3f7] text-[#024fff] text-[9px] font-bold flex items-center justify-center shrink-0">
                {ini(it.author)}
              </span>
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex gap-1.5 items-baseline">
                  <span className="text-[12px] font-bold text-[#0d0d0d]">{it.author}</span>
                  {it.when && <span className="text-[11px] text-[#8c96a3]">{it.when}</span>}
                </div>
                <span className="text-[13px] leading-snug text-[#1d2a3a] whitespace-pre-wrap">
                  {formatCommentWithMentions(it.text)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="p-2.5 pb-3 flex flex-col gap-2">
        <MentionTextarea
          value={popInput}
          onChange={setPopInput}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
            if (e.key === 'Escape') {
              onClose();
            }
          }}
          placeholder={hasItems ? 'Responder… (@ para mencionar)' : 'Escribí un comentario… (@ para mencionar)'}
          rows={2}
          users={users}
          autoFocus
          className="w-full font-anek text-[13px] p-2 border border-[#d6dde5] rounded-lg outline-none resize-none focus:border-[#024fff] focus:ring-2 focus:ring-[#024fff]/12"
        />
        <div className="flex items-center gap-1.5">
          {hasItems && onResolve && (
            <button
              type="button"
              onClick={onResolve}
              className="border-0 bg-transparent cursor-pointer font-anek text-[12px] font-bold text-[#3a4655] p-1.5 rounded hover:bg-[#eef3f7] flex items-center gap-1"
              title="Marcar como resuelto"
            >
              <Check className="w-3.5 h-3.5" /> Resolver
            </button>
          )}
          <span className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="border-0 bg-transparent cursor-pointer font-anek text-[12px] font-medium text-[#5b6675] p-1.5 rounded hover:bg-[#eef3f7]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!popInput.trim()}
            className={`h-7 border-0 rounded-md cursor-pointer font-anek text-[12px] font-bold text-white px-3 transition-colors ${
              popInput.trim() ? 'bg-[#024fff] hover:bg-[#0c57d3]' : 'bg-[#b9c2cd] cursor-not-allowed'
            }`}
          >
            {hasItems ? 'Responder' : 'Comentar'}
          </button>
        </div>
      </div>
    </div>
  );
}
