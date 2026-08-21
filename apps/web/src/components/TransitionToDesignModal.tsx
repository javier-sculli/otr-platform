import { useState, useEffect } from 'react';
import { X, Sparkles, Image as ImageIcon, Link2, Plus, ExternalLink, Trash2 } from 'lucide-react';
import { ensureAbsoluteUrl } from '../lib/utils';

import { RichNotesEditor } from './RichNotesEditor';

interface TransitionToDesignModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: {
    id: string;
    title: string;
    objetivo?: string | null;
    notasAudiovisual?: string | null;
    links?: string[];
    referenciasGraficas?: any[];
    client?: { name: string };
  } | null;
  onConfirm: (data: { notasAudiovisual: string; links: string[] }) => Promise<void>;
}

const labelCls = 'flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#000033]/50 mb-1.5';
const fieldCls = 'w-full px-3 py-2 border border-[#000033]/12 rounded-lg text-sm text-[#000033] bg-white focus:outline-none focus:ring-2 focus:ring-[#024fff]/25 focus:border-[#024fff]/40 hover:border-[#000033]/20 transition-all placeholder:text-[#000033]/35';

export function TransitionToDesignModal({
  isOpen,
  onClose,
  ticket,
  onConfirm,
}: TransitionToDesignModalProps) {
  const [notasAudiovisual, setNotasAudiovisual] = useState('');
  const [links, setLinks] = useState<string[]>([]);
  const [newLink, setNewLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (ticket) {
      setNotasAudiovisual(ticket.notasAudiovisual || '');
      setLinks(ticket.links || []);
    }
  }, [ticket]);

  if (!isOpen || !ticket) return null;

  const handleAddLink = () => {
    const url = ensureAbsoluteUrl(newLink.trim());
    if (url && !links.includes(url)) {
      setLinks([...links, url]);
      setNewLink('');
    }
  };

  const handleRemoveLink = (urlToRemove: string) => {
    setLinks(links.filter(l => l !== urlToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onConfirm({ notasAudiovisual, links });
      onClose();
    } catch (err) {
      console.error('Error al actualizar notas de diseño:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#000033]/10 flex items-center justify-between bg-[#fafafa] flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#024fff]/10 text-[#024fff] flex items-center justify-center">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#000033]">Pase a Etapa de Diseño</h3>
              <p className="text-[11px] text-[#000033]/60 line-clamp-1">
                {ticket.title} {ticket.client?.name ? `(${ticket.client.name})` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-[#000033]/5 flex items-center justify-center text-[#000033]/40 hover:text-[#000033] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
          <div>
            <label className={labelCls}>
              <ImageIcon className="w-3 h-3 text-[#024fff]" />
              Notas de diseño
            </label>
            <RichNotesEditor
              value={notasAudiovisual}
              onChange={setNotasAudiovisual}
              placeholder="Especificaciones visuales por formato, paleta, textos clave o guías (podés pegar texto con formato desde Notion, Word o ChatGPT)..."
              minHeight="140px"
              maxHeight="250px"
            />
          </div>

          {/* Links de referencia */}
          <div>
            <label className={labelCls}>
              <Link2 className="w-3 h-3 text-[#024fff]" />
              Links de Referencia Visual (Figma, Canva, Drive, Pinterest)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newLink}
                onChange={e => setNewLink(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddLink(); } }}
                placeholder="https://figma.com/file/..."
                className={fieldCls}
              />
              <button
                type="button"
                onClick={handleAddLink}
                className="px-3 py-2 bg-[#024fff]/10 hover:bg-[#024fff]/20 text-[#024fff] font-bold text-xs rounded-lg transition-all flex items-center gap-1 flex-shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Sumar
              </button>
            </div>

            {links.length > 0 && (
              <div className="space-y-1.5 mt-2">
                {links.map((link, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-[#fafafa] border border-[#000033]/10 text-xs">
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#024fff] hover:underline font-medium truncate max-w-[340px] flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{link}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleRemoveLink(link)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#000033]/10 flex-shrink-0 mt-auto bg-white">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-bold text-[#000033]/60 hover:bg-[#000033]/5 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#024fff] hover:bg-[#024fff]/90 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isSubmitting ? 'Guardando...' : 'Guardar y Pasar a Diseño'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
