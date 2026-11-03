import { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, CheckCircle2, AlertTriangle, ShieldCheck, ArrowRight, Check } from 'lucide-react';
import { api } from '../../lib/api';
import type { AuditBrandKitResponse } from '@otr/types';

interface BrandKitAuditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  onAppliedSuccessfully?: () => void;
}

export function BrandKitAuditDrawer({
  isOpen,
  onClose,
  clientId,
  clientName,
  onAppliedSuccessfully,
}: BrandKitAuditDrawerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [auditData, setAuditData] = useState<AuditBrandKitResponse | null>(null);
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({});
  const [appliedCount, setAppliedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedGapsCount = (auditData?.gaps || []).filter((gap) => selectedFields[gap.campo]).length;

  const runAudit = async () => {
    setIsLoading(true);
    setError(null);
    setAppliedCount(null);

    try {
      const res = await api.auditBrandKit(clientId);
      if (res.data) {
        setAuditData(res.data);
        // Select all detected gaps by default
        const initialSelected: Record<string, boolean> = {};
        (res.data.gaps || []).forEach((gap) => {
          initialSelected[gap.campo] = true;
        });
        setSelectedFields(initialSelected);
      }
    } catch (err: any) {
      console.error('Error running brand kit audit:', err);
      setError(err?.response?.data?.error || err.message || 'Error al ejecutar la auditoría de Brand Kit.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runAudit();
    } else {
      setAuditData(null);
      setAppliedCount(null);
      setError(null);
    }
  }, [isOpen, clientId]);

  const handleApply = async () => {
    if (!auditData?.proposedBrandVoice || isApplying) return;

    setIsApplying(true);
    setError(null);

    try {
      // Filter only selected proposed fields from detected gaps
      const contentToApply: Record<string, string> = {};
      (auditData.gaps || []).forEach((gap) => {
        if (selectedFields[gap.campo]) {
          contentToApply[gap.campo] = auditData.proposedBrandVoice?.[gap.campo] || gap.valorSugerido;
        }
      });

      const res = await api.applyBrandKit(clientId, contentToApply);
      if (res.data?.success) {
        setAppliedCount(res.data.updatedFieldsCount);
        onAppliedSuccessfully?.();
      }
    } catch (err: any) {
      console.error('Error applying brand kit sync:', err);
      setError(err?.response?.data?.error || err.message || 'Error al aplicar los cambios al Brand Kit.');
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Auditoría Viva de Brand Kit
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Cerebro Sync
                </span>
              </h2>
              <p className="text-xs text-slate-500">Cliente: {clientName}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {isLoading && (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-800">
                  Cruzando el Brand Kit actual con los datos vivos de Cerebro...
                </p>
                <p className="text-xs text-slate-500 max-w-sm">
                  Claude está analizando 20 documentos y publicaciones recientes para detectar brechas de tono, temas no contemplados y desalineaciones.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Ocurrió un error en la auditoría</p>
                <p>{error}</p>
                <button
                  type="button"
                  onClick={runAudit}
                  className="mt-2 inline-flex items-center gap-1 font-semibold text-rose-700 underline hover:text-rose-900"
                >
                  Reintentar auditoría
                </button>
              </div>
            </div>
          )}

          {appliedCount !== null && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-sm">¡Brand Kit actualizado exitosamente!</p>
                <p className="text-xs">
                  Se sincronizaron <strong>{appliedCount} campos</strong> en la base de datos de {clientName}.
                  A partir de ahora, todos los tickets de redacción se generarán con este contexto actualizado.
                </p>
              </div>
            </div>
          )}

          {auditData && !isLoading && (
            <>
              {/* Resumen Diagnóstico */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  Diagnóstico Estratégico
                </h3>
                <p className="text-slate-600 leading-relaxed whitespace-pre-line text-xs">
                  {auditData.resumenDiagnostico}
                </p>
              </div>

              {/* Lista de Gaps Detectados */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Brechas Detectadas ({auditData.gaps.length})
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Marcá los campos que querés actualizar
                  </span>
                </div>

                {auditData.gaps.length === 0 ? (
                  <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 text-center text-slate-500">
                    No se detectaron brechas significativas. El Brand Kit está bien alineado con los contenidos recientes.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {auditData.gaps.map((gap) => (
                      <div
                        key={gap.campo}
                        className={`border rounded-xl p-4 transition-all ${
                          selectedFields[gap.campo]
                            ? 'border-blue-300 bg-white shadow-xs'
                            : 'border-slate-200 bg-slate-50/50 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-900">
                            <input
                              type="checkbox"
                              checked={!!selectedFields[gap.campo]}
                              onChange={(e) =>
                                setSelectedFields((prev) => ({ ...prev, [gap.campo]: e.target.checked }))
                              }
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                            />
                            <span>{gap.tituloCampo}</span>
                          </label>

                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                              gap.estado === 'DESALINEADO'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}
                          >
                            {gap.estado}
                          </span>
                        </div>

                        <p className="text-slate-600 mb-3 text-[11px]">{gap.observacion}</p>

                        <div className="space-y-2 text-[11px]">
                          <div className="p-2 rounded bg-slate-100/70 border border-slate-200/60">
                            <span className="font-semibold text-slate-500 uppercase text-[9px] block mb-0.5">
                              Valor actual en Brand Kit:
                            </span>
                            <span className="text-slate-700 italic">
                              {gap.valorActual && gap.valorActual.trim() ? gap.valorActual : '(Sin completar)'}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-lg bg-blue-50/60 border border-blue-200/60">
                            <span className="font-semibold text-blue-700 uppercase text-[9px] block mb-0.5">
                              Sugerencia viva de Cerebro:
                            </span>
                            <span className="text-slate-800 font-medium whitespace-pre-line leading-relaxed">
                              {gap.valorSugerido}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Drawer Footer Actions */}
        {auditData && !isLoading && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              Cerrar
            </button>

            <button
              type="button"
              disabled={isApplying || selectedGapsCount === 0}
              onClick={handleApply}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Actualizando Brand Kit...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {selectedGapsCount > 0
                    ? `Aplicar ${selectedGapsCount} sugerencias al Brand Kit`
                    : 'Sin sugerencias para aplicar'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
