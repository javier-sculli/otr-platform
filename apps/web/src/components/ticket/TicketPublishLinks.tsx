import { useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { ensureAbsoluteUrl, parseDeliverableLinks, serializeDeliverableLinks } from '../../lib/utils';

export interface TicketPublishLinksProps {
  value?: string | null;
  onChange: (newValue: string) => void;
  variant?: 'modal' | 'page';
  disabled?: boolean;
}

export function TicketPublishLinks({
  value,
  onChange,
  variant = 'modal',
  disabled = false,
}: TicketPublishLinksProps) {
  const [inputVal, setInputVal] = useState('');
  const links = parseDeliverableLinks(value);

  const handleAdd = () => {
    const trimmed = inputVal.trim();
    if (!trimmed || disabled) return;
    const incoming = parseDeliverableLinks(trimmed).map(ensureAbsoluteUrl).filter(Boolean);
    if (incoming.length === 0) {
      setInputVal('');
      return;
    }
    const combined = Array.from(new Set([...links, ...incoming]));
    setInputVal('');
    onChange(serializeDeliverableLinks(combined) || '');
  };

  const handleRemove = (indexToRemove: number) => {
    if (disabled) return;
    const next = links.filter((_, idx) => idx !== indexToRemove);
    onChange(serializeDeliverableLinks(next) || '');
  };

  const isPage = variant === 'page';

  return (
    <div className={`flex flex-col ${isPage ? 'gap-3.5' : 'gap-2 pt-2'}`} data-testid="ticket-publish-links">
      <div className="flex flex-col gap-1">
        <label
          className={
            isPage
              ? 'text-[13px] font-[800] tracking-[0.07em] uppercase text-[#0d0d0d]'
              : 'text-[11px] font-bold tracking-[0.06em] uppercase text-[#5b6675]'
          }
        >
          Link a la Publicación
        </label>
        <span className="text-[13px] text-[#5b6675] -mt-0.5">
          Links a las publicaciones finales en redes o medios.
        </span>
      </div>

      {links.length > 0 && (
        <div className="flex flex-col gap-1.5" data-testid="publish-links-list">
          {links.map((link, idx) => (
            <div
              key={`publish-link-${idx}`}
              className="flex items-center gap-2.5 p-2 px-3 bg-[#024fff]/5 border border-[#024fff]/25 rounded-lg group transition-colors hover:bg-[#024fff]/8"
              data-testid={`publish-link-item-${idx}`}
            >
              <div
                className={`rounded-md bg-[#024fff]/10 flex items-center justify-center text-[#024fff] shrink-0 ${
                  isPage ? 'w-6 h-6' : 'w-7 h-7'
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </div>
              <a
                href={ensureAbsoluteUrl(link)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 font-anek text-[14px] font-semibold text-[#024fff] hover:underline truncate"
                title={link}
              >
                <span className="truncate">{link}</span>
              </a>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="border-0 bg-transparent cursor-pointer text-[#8c96a3] hover:text-red-500 p-1 rounded hover:bg-white/80 transition-colors"
                  title="Eliminar link"
                  aria-label={`Eliminar link ${link}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!disabled && (
        <div className="flex items-center gap-2">
          <input
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onBlur={handleAdd}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="Pegá un link a la publicación y presioná Enter"
            className={
              isPage
                ? 'h-[42px] box-border font-anek text-[15px] px-3 border border-[#d6dde5] rounded-lg bg-white outline-none text-[#0d0d0d] min-w-0 w-full flex-1 focus:border-[#024fff] focus:ring-2 focus:ring-[#024fff]/12'
                : 'flex-1 h-10 px-3 border border-[#d6dde5] rounded-lg text-[14px] text-[#0d0d0d] font-anek outline-none focus:border-[#024fff] focus:ring-2 focus:ring-[#024fff]/12 transition-all placeholder:text-[#8c96a3]'
            }
          />
          {inputVal.trim() && (
            <button
              type="button"
              onClick={handleAdd}
              className={
                isPage
                  ? 'h-[42px] px-3.5 border-0 bg-[#024fff] rounded-lg cursor-pointer font-anek text-[14px] font-bold text-white hover:bg-[#0c57d3] transition-colors shrink-0'
                  : 'h-10 px-3 border border-[#024fff] bg-[#024fff] text-white rounded-lg text-[13px] font-bold font-anek cursor-pointer hover:bg-[#0c57d3] transition-colors shrink-0'
              }
            >
              Agregar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
