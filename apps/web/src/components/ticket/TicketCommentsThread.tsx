import React, { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { MentionTextarea } from '../MentionTextarea';

export interface TicketCommentItem {
  id: string;
  content?: string;
  text?: string;
  quote?: string | null;
  createdAt?: string | null;
  when?: string;
  userId?: string | null;
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
  } | null;
  author?: string;
}

export interface TicketCommentsThreadProps {
  comments: TicketCommentItem[];
  currentUserId?: string;
  currentUserName?: string;
  teamList: { id: string; name: string }[];
  onAddComment: (content: string) => void | Promise<any>;
  onDeleteComment?: (commentId: string) => void | Promise<any>;
  onLocateQuote?: (quote: string) => void;
  isPendingAdd?: boolean;
  variant?: 'modal' | 'page';
  createdDate?: string | null;
  updatedDate?: string | null;
  className?: string;
}

function getInitials(name?: string | null): string {
  if (!name) return 'U';
  return name
    .split(' ')
    .filter(Boolean)
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatCommentWithMentions(text: string) {
  const parts = text.split(/(@\[[^\]]+\]\([^\)]+\)|@[a-zA-Z0-9_.-]+)/g);
  return parts.map((part, i) => {
    const matchBracket = part.match(/^@\[([^\]]+)\]\(([^\)]+)\)$/);
    if (matchBracket) {
      return (
        <span key={i} className="font-semibold text-[#024fff] bg-[#024fff]/10 px-1 py-0.5 rounded">
          @{matchBracket[1]}
        </span>
      );
    }
    if (part.startsWith('@') && part.length > 1) {
      return (
        <span key={i} className="font-semibold text-[#024fff] bg-[#024fff]/10 px-1 py-0.5 rounded">
          {part}
        </span>
      );
    }
    return part;
  });
}

function formatCommentDate(cm: TicketCommentItem): string {
  if (cm.createdAt) {
    try {
      return new Date(cm.createdAt).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return cm.when || '';
    }
  }
  return cm.when || '';
}

export const TicketCommentsThread: React.FC<TicketCommentsThreadProps> = ({
  comments,
  currentUserId,
  currentUserName,
  teamList,
  onAddComment,
  onDeleteComment,
  onLocateQuote,
  isPendingAdd = false,
  variant = 'modal',
  createdDate,
  updatedDate,
  className = '',
}) => {
  const [commentInput, setCommentInput] = useState('');

  const handleSend = () => {
    const trimmed = commentInput.trim();
    if (!trimmed || isPendingAdd) return;
    onAddComment(trimmed);
    setCommentInput('');
  };

  const isPage = variant === 'page';

  return (
    <div
      className={`flex flex-col gap-2.5 ${
        isPage ? '' : 'pt-5 border-t border-[#eef3f7]'
      } ${className}`}
      data-testid="ticket-comments-thread"
    >
      <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">
        Comentarios{' '}
        {comments.length > 0 && (
          <span className="text-[#8c96a3] font-normal tracking-normal lowercase">
            ({comments.length})
          </span>
        )}
      </label>

      {comments.length === 0 && isPage && (
        <span className="text-[14px] leading-[1.45] text-[#8c96a3]">
          Sin comentarios. Para comentar un fragmento del copy o de las notas, seleccioná el texto.
        </span>
      )}

      {comments.map(cm => {
        const isMyComment =
          Boolean(currentUserId) &&
          ((cm.userId && cm.userId === currentUserId) ||
            (cm.user?.id && cm.user?.id === currentUserId));

        const rawContent = cm.content || cm.text || '';
        const quoteMatch = rawContent.match(/^«([^»]+)»:\s*([\s\S]*)$/);
        const quote = cm.quote || (quoteMatch ? quoteMatch[1] : null);
        const mainContent = quoteMatch ? quoteMatch[2] : rawContent;
        const authorName = cm.user?.name || cm.author || 'Usuario';
        const dateStr = formatCommentDate(cm);

        return (
          <div key={cm.id} className="flex gap-2.5 group" data-testid={`comment-${cm.id}`}>
            <span className="w-7 h-7 shrink-0 rounded-full bg-[#eef3f7] text-[#024fff] text-[10px] font-bold flex items-center justify-center">
              <span className="translate-y-[0.5px] leading-none select-none">
                {getInitials(authorName)}
              </span>
            </span>

            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <div className="flex gap-2 items-center">
                <span
                  className={`${
                    isPage ? 'text-[15px]' : 'text-[13px]'
                  } font-bold text-[#0d0d0d]`}
                >
                  {authorName}
                </span>
                {dateStr && (
                  <span
                    className={`${
                      isPage ? 'text-[13px]' : 'text-[12px]'
                    } text-[#8c96a3]`}
                  >
                    {dateStr}
                  </span>
                )}
                {isMyComment && onDeleteComment && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('¿Eliminar este comentario?')) {
                        onDeleteComment(cm.id);
                      }
                    }}
                    title="Eliminar comentario"
                    aria-label="Eliminar comentario"
                    className={`p-1 text-[#8c96a3] hover:text-red-600 rounded transition-colors ml-auto cursor-pointer border-0 bg-transparent flex items-center justify-center ${
                      isPage ? 'opacity-0 group-hover:opacity-100' : 'hover:bg-red-50'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {quote && (
                <button
                  type="button"
                  onClick={() => onLocateQuote?.(quote)}
                  title="Ver fragmento en el texto"
                  className="text-[13px] text-[#5b6675] hover:text-[#024fff] p-1 pl-2.5 border-0 border-l-2 border-[#00e39c] my-0.5 bg-[#00ff99]/5 hover:bg-[#00ff99]/15 rounded-r truncate block text-left w-fit max-w-full cursor-pointer transition-colors"
                >
                  «{quote}»
                </button>
              )}

              <span
                className={`${
                  isPage ? 'text-[15px] leading-[1.5]' : 'text-[14px] leading-relaxed'
                } text-[#1d2a3a] whitespace-pre-wrap`}
              >
                {formatCommentWithMentions(mainContent)}
              </span>
            </div>
          </div>
        );
      })}

      {/* Input box */}
      <div className={`flex gap-2.5 items-start ${isPage ? 'mt-1 flex-col' : 'mt-3 mb-8'}`}>
        {!isPage && (
          <span className="w-7 h-7 shrink-0 rounded-full bg-[#024fff] text-white text-[10px] font-bold flex items-center justify-center">
            <span className="translate-y-[0.5px] leading-none select-none">
              {getInitials(currentUserName || 'YO')}
            </span>
          </span>
        )}

        <div className={`flex-1 min-w-0 flex flex-col ${isPage ? 'w-full gap-2' : 'gap-2.5'}`}>
          <MentionTextarea
            value={commentInput}
            onChange={setCommentInput}
            placeholder={
              isPage
                ? 'Comentario general del ticket (@ para mencionar)'
                : 'Escribí un comentario para el equipo (usá @ para mencionar)…'
            }
            rows={isPage ? 2 : 3}
            users={teamList}
            className={`w-full font-anek ${
              isPage
                ? 'text-[15px] leading-[1.5] p-2.5 px-3 border border-[#d6dde5] rounded-[10px] outline-none resize-y min-h-[64px] bg-white focus:border-[#024fff] focus:ring-2 focus:ring-[#024fff]/12 transition-all placeholder:text-[#8c96a3]'
                : 'text-[14px] p-2.5 px-3 border border-[#d6dde5] rounded-lg outline-none resize-y min-h-[64px] focus:border-[#024fff] focus:ring-2 focus:ring-[#024fff]/12 transition-all placeholder:text-[#8c96a3]'
            }`}
          />

          <div
            className={`flex items-center ${
              isPage ? 'justify-end' : 'justify-end gap-2'
            }`}
          >
            {isPage ? (
              commentInput.trim().length > 0 && (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={isPendingAdd}
                  className="self-end shrink-0 whitespace-nowrap h-[38px] px-4 border-0 bg-[#024fff] rounded-lg cursor-pointer font-anek text-[14px] font-bold text-white hover:bg-[#0c57d3] transition-colors flex items-center gap-1.5"
                >
                  {isPendingAdd && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isPendingAdd ? 'Comentando…' : 'Comentar'}</span>
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!commentInput.trim() || isPendingAdd}
                className={`h-8 px-4 rounded-lg font-anek text-[13px] font-bold transition-all flex items-center gap-1.5 ${
                  commentInput.trim() && !isPendingAdd
                    ? 'bg-[#024fff] hover:bg-[#0c57d3] text-white cursor-pointer shadow-sm'
                    : 'bg-[#eef3f7] text-[#8c96a3] cursor-not-allowed border border-[#d6dde5]'
                }`}
              >
                {isPendingAdd && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Comentar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {isPage && (createdDate || updatedDate) && (
        <span className="text-[13px] text-[#8c96a3]">
          {createdDate
            ? `Creado el ${new Date(createdDate).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}`
            : ''}
          {updatedDate
            ? ` · Última edición ${new Date(updatedDate).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}`
            : ''}
        </span>
      )}
    </div>
  );
};
