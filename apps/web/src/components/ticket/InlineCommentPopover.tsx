import { useState, useRef, useEffect } from 'react';
import { Check, X, Image as ImageIcon, Loader2, FileText, Paperclip } from 'lucide-react';
import { MentionTextarea, formatCommentWithMentions } from '../MentionTextarea';
import { compressImageFile, parseCommentContent, buildCommentContent } from '../../lib/imageCompression';
import { readFileAsDataUrl, MAX_ATTACHMENT_SIZE_BYTES } from '../../lib/attachments';
import { CommentImageViewerModal } from './CommentImageViewerModal';

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
  isDraft?: boolean;
}

export interface InlineCommentPopoverProps {
  pop: PopPosition | null;
  thread?: CommentThread;
  users?: { id: string; name: string }[];
  onSend: (text: string) => void | Promise<any>;
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
  const [popImages, setPopImages] = useState<string[]>([]);
  const [popFiles, setPopFiles] = useState<Array<{ name: string; url: string; size?: number }>>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileAttachmentInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const draftStorageKey = pop ? `otr_draft_inline_${pop.id}` : null;

  useEffect(() => {
    if (draftStorageKey) {
      try {
        const saved = sessionStorage.getItem(draftStorageKey);
        if (saved && !popInput) {
          setPopInput(saved);
        }
      } catch {}
    }
  }, [draftStorageKey]);

  if (!pop) return null;

  const handleInputChange = (val: string) => {
    setPopInput(val);
    if (sendError) setSendError(null);
    if (draftStorageKey) {
      try {
        if (val) {
          sessionStorage.setItem(draftStorageKey, val);
        } else {
          sessionStorage.removeItem(draftStorageKey);
        }
      } catch {}
    }
  };

  const handleCancel = () => {
    if (draftStorageKey) {
      try {
        sessionStorage.removeItem(draftStorageKey);
      } catch {}
    }
    setPopInput('');
    setPopImages([]);
    setPopFiles([]);
    onClose();
  };

  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    try {
      setIsCompressing(true);
      const compressed = await compressImageFile(file);
      setPopImages(prev => [...prev, compressed]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleAttachFile = async (file: File) => {
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      alert(`El archivo "${file.name}" supera el tamaño máximo permitido de 15MB.`);
      return;
    }
    if (file.type.startsWith('image/')) {
      await handleImageFile(file);
      return;
    }
    try {
      setIsCompressing(true);
      const dataUrl = await readFileAsDataUrl(file);
      setPopFiles(prev => [...prev, { name: file.name, url: dataUrl, size: file.size }]);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Error al leer el archivo');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSend = async () => {
    const trimmed = popInput.trim();
    if ((!trimmed && popImages.length === 0 && popFiles.length === 0) || isCompressing || isSubmitting) return;
    const fullContent = buildCommentContent(trimmed, popImages, popFiles);
    try {
      setIsSubmitting(true);
      setSendError(null);
      await onSend(fullContent);
      setPopInput('');
      setPopImages([]);
      setPopFiles([]);
      if (draftStorageKey) {
        try {
          sessionStorage.removeItem(draftStorageKey);
        } catch {}
      }
      onClose();
    } catch (err: any) {
      console.error('Error al enviar comentario inline:', err);
      setSendError(err?.message || 'Error al guardar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const items = thread?.items || [];
  const hasItems = items.length > 0;
  const canSend = (popInput.trim().length > 0 || popImages.length > 0 || popFiles.length > 0) && !isCompressing;

  return (
    <>
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
            {items.map((it, idx) => {
              const { text: cleanText, images: itemImages, files: itemFiles } = parseCommentContent(it.text);
              return (
                <div key={idx} className="flex gap-2 p-2.5 px-3 pt-2">
                  <span className="w-5 h-5 rounded-full bg-[#eef3f7] text-[#024fff] text-[9px] font-bold flex items-center justify-center shrink-0">
                    {ini(it.author)}
                  </span>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex gap-1.5 items-baseline">
                      <span className="text-[12px] font-bold text-[#0d0d0d]">{it.author}</span>
                      {it.when && <span className="text-[11px] text-[#8c96a3]">{it.when}</span>}
                    </div>
                    {cleanText && (
                      <span className="text-[13px] leading-snug text-[#1d2a3a] whitespace-pre-wrap">
                        {formatCommentWithMentions(cleanText)}
                      </span>
                    )}
                    {itemImages.length > 0 && (
                      <div className="flex flex-col gap-1.5 mt-1.5">
                        {itemImages.map((src, i) => (
                          <img
                            key={i}
                            src={src}
                            alt="Imagen en comentario"
                            onClick={() => setViewerImage(src)}
                            className="max-w-full max-h-[140px] object-contain rounded border border-[#d6dde5] bg-white cursor-pointer hover:opacity-95 shadow-xs"
                          />
                        ))}
                      </div>
                    )}
                    {itemFiles && itemFiles.length > 0 && (
                      <div className="flex flex-col gap-1.5 mt-1.5">
                        {itemFiles.map((cf, i) => {
                          const isPdf = cf.name.toLowerCase().endsWith('.pdf');
                          return (
                            <a
                              key={i}
                              href={cf.url}
                              download={cf.name}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`Descargar ${cf.name}`}
                              className="flex items-center gap-1.5 p-1.5 px-2 rounded border border-[#d6dde5] bg-[#f7fafc] text-[12px] text-[#1d2a3a] hover:text-[#024fff] no-underline truncate"
                            >
                              {isPdf ? (
                                <FileText className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              ) : (
                                <Paperclip className="w-3.5 h-3.5 text-[#024fff] shrink-0" />
                              )}
                              <span className="truncate">{cf.name}</span>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="p-2.5 pb-3 flex flex-col gap-2">
          <MentionTextarea
            value={popInput}
            onChange={handleInputChange}
            onPasteImage={handleImageFile}
            onPasteFile={handleAttachFile}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
              if (e.key === 'Escape') {
                handleCancel();
              }
            }}
            placeholder={hasItems ? 'Responder… (@ para mencionar, pegá imagen o archivo)' : 'Escribí un comentario… (@ o pegá imagen/archivo)'}
            rows={2}
            users={users}
            autoFocus
            className="w-full font-anek text-[13px] p-2 border border-[#d6dde5] rounded-lg outline-none resize-none focus:border-[#024fff] focus:ring-2 focus:ring-[#024fff]/12"
          />

          {popImages.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {popImages.map((img, idx) => (
                <div key={idx} className="relative group border border-[#d6dde5] rounded overflow-hidden max-w-[80px] max-h-[56px] shrink-0">
                  <img src={img} alt="Preview" className="w-full h-full object-cover max-h-[56px]" />
                  <button
                    type="button"
                    onClick={() => setPopImages(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 border-0 cursor-pointer flex items-center justify-center"
                    title="Quitar"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {popFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5" data-testid="inline-comment-files-preview">
              {popFiles.map((file, idx) => {
                const isPdf = file.name.toLowerCase().endsWith('.pdf');
                return (
                  <div key={idx} className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-[#d6dde5] bg-[#f7fafc] text-[11px] text-[#1d2a3a]">
                    {isPdf ? (
                      <FileText className="w-3 h-3 text-rose-600 shrink-0" />
                    ) : (
                      <Paperclip className="w-3 h-3 text-[#024fff] shrink-0" />
                    )}
                    <span className="max-w-[130px] truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setPopFiles(prev => prev.filter((_, i) => i !== idx))}
                      className="border-0 bg-transparent text-[#8c96a3] hover:text-[#0d0d0d] p-0.5 cursor-pointer flex items-center justify-center"
                      title="Quitar"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {isCompressing && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#5b6675]">
              <Loader2 className="w-3 h-3 animate-spin text-[#024fff]" />
              <span>Optimizando…</span>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            {(!pop.isDraft || hasItems) && onResolve && (
              <button
                type="button"
                onClick={onResolve}
                className="border-0 bg-transparent cursor-pointer font-anek text-[12px] font-bold text-[#3a4655] p-1.5 rounded hover:bg-[#eef3f7] flex items-center gap-1"
                title="Marcar como resuelto"
              >
                <Check className="w-3.5 h-3.5" /> Resolver
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Adjuntar imagen"
              className="p-1 rounded text-[#5b6675] hover:text-[#024fff] hover:bg-[#eef3f7] border-0 bg-transparent cursor-pointer flex items-center justify-center"
            >
              <ImageIcon className="w-3.5 h-3.5" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageFile(file);
                e.target.value = '';
              }}
            />

            <button
              type="button"
              onClick={() => fileAttachmentInputRef.current?.click()}
              title="Adjuntar PDF o archivo"
              aria-label="Adjuntar PDF o archivo"
              className="p-1 rounded text-[#5b6675] hover:text-[#024fff] hover:bg-[#eef3f7] border-0 bg-transparent cursor-pointer flex items-center justify-center"
            >
              <Paperclip className="w-3.5 h-3.5" />
            </button>
            <input
              type="file"
              ref={fileAttachmentInputRef}
              accept="application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
              className="hidden"
              data-testid="inline-comment-attachment-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAttachFile(file);
                e.target.value = '';
              }}
            />

            <span className="flex-1" />
            {sendError && (
              <span className="text-[11px] font-medium text-[#d4380d] mr-1" data-testid="inline-comment-error">
                {sendError}
              </span>
            )}
            <button
              type="button"
              onClick={handleCancel}
              className="border-0 bg-transparent cursor-pointer font-anek text-[12px] font-medium text-[#5b6675] p-1.5 rounded hover:bg-[#eef3f7]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={(!canSend && !sendError) || isSubmitting}
              className={`h-7 border-0 rounded-md cursor-pointer font-anek text-[12px] font-bold text-white px-3 transition-colors flex items-center gap-1 ${
                isSubmitting
                  ? 'bg-[#024fff] opacity-75 cursor-wait'
                  : sendError
                  ? 'bg-[#d4380d] hover:bg-[#b02a06]'
                  : canSend
                  ? 'bg-[#024fff] hover:bg-[#0c57d3]'
                  : 'bg-[#b9c2cd] cursor-not-allowed'
              }`}
            >
              {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
              <span>{isSubmitting ? 'Guardando…' : sendError ? 'Reintentar' : (hasItems ? 'Responder' : 'Comentar')}</span>
            </button>
          </div>
        </div>
      </div>

      {viewerImage && (
        <CommentImageViewerModal
          src={viewerImage}
          onClose={() => setViewerImage(null)}
        />
      )}
    </>
  );
}
