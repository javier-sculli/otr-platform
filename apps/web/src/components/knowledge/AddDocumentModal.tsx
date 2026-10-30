import { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, Calendar, Link as LinkIcon, User } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { KnowledgeDocument, CreateKnowledgeDocumentDTO } from '@otr/types';

interface AddDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  speakers?: Array<{ id: string; nombre: string; cargo?: string | null }>;
  documentToEdit?: KnowledgeDocument | null;
}

const TYPE_PRESETS = [
  { id: 'REUNION', label: 'Reunión', desc: 'Call Google Meet, Granola, 1:1' },
  { id: 'FEEDBACK', label: 'Feedback', desc: 'Corrección, preferencia, directiva' },
  { id: 'DOCUMENTO', label: 'Documento', desc: 'Deck, propuesta, one-pager' },
  { id: 'CLAUDE_CHAT', label: 'Claude Chat', desc: 'Sesión, copys o contexto' },
  { id: 'NOTA', label: 'Nota libre', desc: 'Apunte o contexto suelto' },
];

export function AddDocumentModal({
  isOpen,
  onClose,
  clientId,
  speakers = [],
  documentToEdit,
}: AddDocumentModalProps) {
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [type, setType] = useState('REUNION');
  const [speakerId, setSpeakerId] = useState<string>('');
  const [content, setContent] = useState('');
  const [summary, setSummary] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [tagsInput, setTagsInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Populate if editing
  useEffect(() => {
    if (documentToEdit) {
      setTitle(documentToEdit.title);
      setType(documentToEdit.type.toUpperCase());
      setSpeakerId(documentToEdit.speakerId || '');
      setContent(documentToEdit.content);
      setSummary(documentToEdit.summary || '');
      setSourceUrl(documentToEdit.sourceUrl || '');
      setDate(new Date(documentToEdit.date).toISOString().split('T')[0]);
      setTagsInput(documentToEdit.tags?.join(', ') || '');
    } else {
      setTitle('');
      setType('REUNION');
      setSpeakerId('');
      setContent('');
      setSummary('');
      setSourceUrl('');
      setDate(new Date().toISOString().split('T')[0]);
      setTagsInput('');
    }
    setAnalysisError(null);
  }, [documentToEdit, isOpen]);

  // AI Auto-Analyze Mutation
  const handleAnalyzeWithAI = async () => {
    if (!content.trim() || content.trim().length < 10) {
      setAnalysisError('Ingresá al menos un par de frases en el contenido para que la IA pueda analizarlo.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const res = await api.analyzeKnowledgeContent(content, clientId);
      if (res?.data) {
        if (!title.trim() || title === 'Documento sin título') {
          setTitle(res.data.title);
        }
        setType(res.data.type);
        setSummary(res.data.summary || '');
        if (res.data.tags?.length > 0) {
          setTagsInput(res.data.tags.join(', '));
        }
      }
    } catch (err: any) {
      console.error('Error analyzing content:', err);
      setAnalysisError('No se pudo analizar el contenido con IA, pero podés completar los campos manualmente.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Save / Update Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const tags = tagsInput
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(Boolean);

      const payload: CreateKnowledgeDocumentDTO = {
        clientId,
        speakerId: speakerId || null,
        title: title.trim(),
        type,
        tags,
        content: content.trim(),
        summary: summary.trim() || null,
        date: new Date(date).toISOString(),
        sourceUrl: sourceUrl.trim() || null,
      };

      if (documentToEdit) {
        return api.updateKnowledgeDocument(documentToEdit.id, payload);
      } else {
        return api.createKnowledgeDocument(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-documents', clientId] });
      onClose();
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#000033]/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {documentToEdit ? 'Editar Documento de Conocimiento' : 'Cargar Documento de Conocimiento'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Reuniones de Google Meet, feedbacks, documentos o contexto de Claude.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Content Textarea + AI Trigger */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Contenido / Transcripción / Notas <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleAnalyzeWithAI}
                disabled={isAnalyzing || !content.trim()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Analizando con IA...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    Auto-completar campos con IA
                  </>
                )}
              </button>
            </div>

            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Pegá acá la transcripción de Google Meet, una minuta de reunión, notas de WhatsApp o el feedback recibido del cliente..."
              rows={8}
              className="w-full p-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            {analysisError && (
              <p className="text-xs text-rose-600">{analysisError}</p>
            )}
          </div>

          {/* Type Selector Pills */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Tipo de Documento
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {TYPE_PRESETS.map(preset => {
                const isSelected = type === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setType(preset.id)}
                    className={`p-2.5 text-left rounded-xl border transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 text-blue-900 ring-1 ring-blue-600'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <div className="font-medium text-xs">{preset.label}</div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">{preset.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Título descriptivo <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ej: Weekly de planning - Lanzamiento Feature X"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Speaker & Date Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Vocero Asociado (opcional)
              </label>
              <select
                value={speakerId}
                onChange={e => setSpeakerId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Marca general (sin vocero)</option>
                {speakers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} {s.cargo ? `(${s.cargo})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Fecha del Evento
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
              </input>
            </div>
          </div>

          {/* Summary / Takeaways */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Resumen Ejecutivo / Decisiones Clave (opcional)
            </label>
            <textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="Puntos clave en viñetas que resumen los acuerdos, novedades o directivas..."
              rows={3}
              className="w-full p-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Tags & Source URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Tags (separados por coma)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                placeholder="precios, b2b, producto"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
                Link de Origen (Drive, Meet, Granola)
              </label>
              <input
                type="url"
                value={sourceUrl}
                onChange={e => setSourceUrl(e.target.value)}
                placeholder="https://docs.google.com/..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Los documentos alimentan el chat de conocimiento y la redacción con IA.
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !title.trim() || !content.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#024fff] text-white rounded-lg hover:bg-[#024fff]/90 transition-colors disabled:opacity-50"
            >
              {saveMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {documentToEdit ? 'Guardar Cambios' : 'Agregar a la Base'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
