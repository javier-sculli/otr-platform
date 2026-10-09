import React, { useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';

export interface CommentImageViewerModalProps {
  src: string | null;
  onClose: () => void;
  alt?: string;
}

export const CommentImageViewerModal: React.FC<CommentImageViewerModalProps> = ({
  src,
  onClose,
  alt = 'Imagen adjunta',
}) => {
  useEffect(() => {
    if (!src) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [src, onClose]);

  if (!src) return null;

  const handleOpenNewTab = () => {
    const w = window.open('');
    if (w) {
      w.document.write(`<img src="${src}" style="max-width:100%;height:auto;margin:auto;display:block;" alt="${alt}" />`);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visualizador de imagen de comentario"
      data-testid="comment-image-viewer-modal"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative max-w-[92vw] max-h-[90vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Actions bar */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenNewTab}
            title="Abrir en pestaña nueva"
            aria-label="Abrir en pestaña nueva"
            className="p-2 rounded-full bg-black/60 hover:bg-black/85 text-white/90 hover:text-white transition-colors cursor-pointer border-0"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Cerrar imagen"
            aria-label="Cerrar imagen"
            className="p-2 rounded-full bg-black/60 hover:bg-black/85 text-white/90 hover:text-white transition-colors cursor-pointer border-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Full Image */}
        <img
          src={src}
          alt={alt}
          className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl select-none"
        />
      </div>
    </div>
  );
};
