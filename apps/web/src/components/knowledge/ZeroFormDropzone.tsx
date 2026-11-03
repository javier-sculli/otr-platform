import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { UploadCloud, Sparkles, FileText, Loader2, CheckCircle, AlertCircle, Clipboard, X } from 'lucide-react';
import { api } from '../../lib/api';

interface ZeroFormDropzoneProps {
  clientId: string;
  speakerId?: string | null;
  onSuccess: () => void;
}

export function ZeroFormDropzone({ clientId, speakerId, onSuccess }: ZeroFormDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setFeedback(null);

    try {
      if (file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const pdfBase64 = e.target?.result as string;
            const res = await api.uploadInferredDocument({
              clientId,
              speakerId,
              pdfBase64,
              fileName: file.name,
            });
            setFeedback({
              type: 'success',
              message: `¡Documento procesado con éxito! Se infirió: "${res.data.title}" (${res.data.type})`,
            });
            onSuccess();
          } catch (err: any) {
            setFeedback({
              type: 'error',
              message: err?.response?.data?.error || err.message || 'Error al procesar el archivo PDF.',
            });
          } finally {
            setIsProcessing(false);
          }
        };
        reader.readAsDataURL(file);
      } else {
        // Read as text
        const text = await file.text();
        const res = await api.uploadInferredDocument({
          clientId,
          speakerId,
          text,
          fileName: file.name,
        });
        setFeedback({
          type: 'success',
          message: `¡Documento procesado con éxito! Se infirió: "${res.data.title}" (${res.data.type})`,
        });
        setIsProcessing(false);
        onSuccess();
      }
    } catch (err: any) {
      console.error('Error processing file in dropzone:', err);
      setFeedback({
        type: 'error',
        message: err?.response?.data?.error || err.message || 'Error al subir e inferir el documento.',
      });
      setIsProcessing(false);
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await processFile(file);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      await processFile(file);
      e.target.value = '';
    }
  };

  const handleSendPastedText = async () => {
    if (!pastedText.trim() || isProcessing) return;

    setIsProcessing(true);
    setFeedback(null);

    try {
      const res = await api.uploadInferredDocument({
        clientId,
        speakerId,
        text: pastedText.trim(),
      });
      setFeedback({
        type: 'success',
        message: `¡Texto analizado y guardado! Se infirió: "${res.data.title}" (${res.data.type})`,
      });
      setPastedText('');
      setShowPasteModal(false);
      onSuccess();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.error || err.message || 'Error al procesar el texto.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md,.json,.csv"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Drop Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-blue-500 bg-blue-50/70 scale-[1.01]'
            : 'border-slate-300 hover:border-blue-400 bg-white hover:bg-slate-50/50 shadow-xs'
        } ${isProcessing ? 'pointer-events-none opacity-80' : ''}`}
      >
        <div className="flex flex-col items-center justify-center gap-2">
          {isProcessing ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center animate-pulse">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-slate-800 flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                  La IA está leyendo y clasificando el documento...
                </p>
                <p className="text-[11px] text-slate-500">
                  Extrayendo título, tipo de documento, relevancia de marca, resumen y tags.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                <UploadCloud className="w-5 h-5" />
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-800">
                  Arrastrá acá archivos de marca, decks, PDFs o notas
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Cero formularios: la IA infiere título, tipo, relevancia estratégica y resumen automáticamente.
                </p>
              </div>

              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <FileText className="w-3 h-3" />
                  Examinar archivos (.pdf, .txt, .md)
                </button>

                <span className="text-[11px] text-slate-300">|</span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPasteModal(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <Clipboard className="w-3 h-3" />
                  Pegar texto o transcripción
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`flex items-center justify-between p-3 rounded-xl text-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Ingesta Asistida de Texto</h3>
                  <p className="text-[11px] text-slate-500">Pegá transcripciones de Meet, notas o feedbacks</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              rows={8}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Pegá acá el texto completo... La IA extraerá los puntos clave y lo guardará en el Cerebro automáticamente."
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none leading-relaxed"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!pastedText.trim() || isProcessing}
                onClick={handleSendPastedText}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Inferenciando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Procesar e Ingestar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
