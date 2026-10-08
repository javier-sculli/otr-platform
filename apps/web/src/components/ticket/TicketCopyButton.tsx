import { useState, type RefObject } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyHtmlToClipboard } from '../../lib/utils';

export interface TicketCopyButtonProps {
  text?: string;
  editorRef?: RefObject<HTMLElement | null>;
  className?: string;
}

export function TicketCopyButton({
  text = '',
  editorRef,
  className = '',
}: TicketCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const editorText = (editorRef?.current?.innerText ?? editorRef?.current?.textContent)?.trim();
    const contentToCopy = editorText || text;
    if (!contentToCopy) return;

    let success = false;
    if (editorText) {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(editorText);
          success = true;
        } else {
          success = await copyHtmlToClipboard(editorText);
        }
      } catch {
        success = await copyHtmlToClipboard(editorText);
      }
    } else {
      success = await copyHtmlToClipboard(text);
    }

    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copiar copy"
      className={`shrink-0 whitespace-nowrap h-[32px] sm:h-[34px] px-3 border rounded-lg cursor-pointer font-anek text-[13px] font-bold flex items-center gap-1.5 transition-all ${
        copied
          ? 'bg-[#00ff99]/20 text-[#00663a] border-[#00ff99]/50'
          : 'bg-white border-[#d6dde5] text-[#3a4655] hover:bg-[#eef3f7] hover:text-[#0d0d0d]'
      } ${className}`}
      data-testid="ticket-copy-button"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-[#00a86b]" />
          <span>Copiado</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5 text-[#5b6675]" />
          <span>Copiar</span>
        </>
      )}
    </button>
  );
}
