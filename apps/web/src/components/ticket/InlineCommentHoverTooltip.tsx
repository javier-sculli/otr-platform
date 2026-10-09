import { formatCommentWithMentions } from '../MentionTextarea';
import { parseCommentContent } from '../../lib/imageCompression';

export interface CommentItem {
  author: string;
  when?: string;
  text: string;
}

export interface HoverCommentData {
  x: number;
  y: number;
  quote: string;
  items: CommentItem[];
}

export interface InlineCommentHoverTooltipProps {
  hoverComment: HoverCommentData | null;
  isVisible?: boolean;
}

const ini = (n?: string) =>
  (n || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?';

export function InlineCommentHoverTooltip({
  hoverComment,
  isVisible = true,
}: InlineCommentHoverTooltipProps) {
  if (!hoverComment || !isVisible) return null;

  return (
    <div
      data-hover-comment="1"
      data-testid="inline-comment-hover-tooltip"
      style={{
        position: 'fixed',
        left: `${hoverComment.x}px`,
        top: `${hoverComment.y}px`,
        pointerEvents: 'none',
      }}
      className="w-[280px] bg-white border border-[#d6dde5] rounded-[10px] shadow-[0_10px_28px_rgba(0,14,31,.2)] z-[60] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      <div className="p-2 px-2.5 text-[11px] text-[#5b6675] truncate border-l-2 border-[#00e39c] m-2 mb-1 pl-2 bg-[#00ff99]/5 rounded-r">
        «{hoverComment.quote}»
      </div>

      {hoverComment.items.length > 0 ? (
        <div className="flex flex-col max-h-[220px] overflow-y-auto" data-testid="hover-comment-items">
          {hoverComment.items.map((it, idx) => {
            const { text: cleanText, images: itemImages } = parseCommentContent(it.text);
            return (
              <div key={idx} className="flex gap-2 p-2 px-2.5 border-b border-[#f0f4f8] last:border-b-0">
                <span className="w-5 h-5 rounded-full bg-[#eef3f7] text-[#024fff] text-[9px] font-bold flex items-center justify-center shrink-0">
                  {ini(it.author)}
                </span>
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex gap-1.5 items-baseline">
                    <span className="text-[11px] font-bold text-[#0d0d0d]">{it.author}</span>
                    {it.when && <span className="text-[10px] text-[#8c96a3]">{it.when}</span>}
                  </div>
                  {cleanText && (
                    <span className="text-[12px] leading-snug text-[#1d2a3a] whitespace-pre-wrap">
                      {formatCommentWithMentions(cleanText)}
                    </span>
                  )}
                  {itemImages.length > 0 && (
                    <div className="flex flex-col gap-1 mt-1">
                      {itemImages.map((src, i) => (
                        <img
                          key={i}
                          src={src}
                          alt="Imagen adjunta"
                          className="max-w-full max-h-[100px] object-contain rounded border border-[#d6dde5] bg-white"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-2 px-2.5 text-[11px] text-[#8c96a3] italic">
          Hacé click para escribir o responder este comentario
        </div>
      )}

      <div className="bg-[#f7fafc] px-2.5 py-1 text-[10px] text-[#8c96a3] border-t border-[#eef3f7] flex items-center justify-between">
        <span>Click para responder o resolver</span>
      </div>
    </div>
  );
}
