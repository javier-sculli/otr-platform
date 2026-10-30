import { useState } from 'react';
import { X, Calendar, User, ExternalLink, Trash2, Edit3, Copy, Check, FileText } from 'lucide-react';
import type { KnowledgeDocument } from '@otr/types';

interface DocumentDetailDrawerProps {
  document: KnowledgeDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onEdit?: (doc: KnowledgeDocument) => void;
}

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  REUNION: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  FEEDBACK: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  DOCUMENTO: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  CLAUDE_CHAT: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  NOTA: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
};

export function DocumentDetailDrawer({
  document,
  isOpen,
  onClose,
  onDelete,
  onEdit,
}: DocumentDetailDrawerProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !document) return null;

  const typeStyle = TYPE_COLORS[document.type.toUpperCase()] || TYPE_COLORS.NOTA;

  const formattedDate = new Date(document.date).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(document.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#000033]/30 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col z-10 border-l border-slate-200 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}
              >
                {document.type}
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Calendar className="w-3.5 h-3.5" />
                {formattedDate}
              </span>
              {document.speakerId && (
                <span className="flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                  <User className="w-3 h-3" />
                  Vocero
                </span>
              )}
            </div>
            <h2 className="text-lg font-semibold text-slate-900 leading-snug">
              {document.title}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata Bar */}
          <div className="flex items-center justify-between text-xs text-slate-500 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <span>{document.content.length} caracteres</span>
            </div>
            {document.sourceUrl && (
              <a
                href={document.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline"
              >
                Ver fuente original
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {/* Tags */}
          {document.tags && document.tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {document.tags.map(t => (
                <span
                  key={t}
                  className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* Summary Block */}
          {document.summary && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Resumen Ejecutivo / Decisiones
              </h4>
              <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {document.summary}
              </div>
            </div>
          )}

          {/* Full Content */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Contenido Completo
              </h4>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 font-medium px-2 py-1 rounded hover:bg-slate-100 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copiar
                  </>
                )}
              </button>
            </div>
            <div className="p-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 font-mono whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto">
              {document.content}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            {onDelete && (
              <button
                onClick={() => {
                  if (confirm('¿Eliminar este documento de la base de conocimiento?')) {
                    onDelete(document.id);
                    onClose();
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => {
                  onEdit(document);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                Editar
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
