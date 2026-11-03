import { useQuery } from '@tanstack/react-query';
import { Sparkles, Target, Zap, Clock, ShieldCheck, AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';

interface BrandPulseHeaderProps {
  clientId: string;
  clientName: string;
  onOpenAudit: () => void;
}

export function BrandPulseHeader({ clientId, clientName, onOpenAudit }: BrandPulseHeaderProps) {
  const { data: pulseData, isLoading, refetch } = useQuery({
    queryKey: ['brand-pulse', clientId],
    queryFn: () => api.getBrandPulse(clientId),
    staleTime: 1000 * 60 * 5, // 5 min
  });

  const pulse = pulseData?.data;

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs animate-pulse space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-4 bg-slate-200 rounded w-48" />
          <div className="h-6 bg-slate-200 rounded-full w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-16 bg-slate-100 rounded-xl" />
          <div className="h-16 bg-slate-100 rounded-xl" />
          <div className="h-16 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!pulse) return null;

  const isBrandKitSync = pulse.salud.brandKitStatus === 'SINCRONIZADO';
  const isBrandKitUnset = pulse.salud.brandKitStatus === 'SIN_CONFIGURAR';

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-5 shadow-md space-y-4 relative overflow-hidden">
      {/* Decorative Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 relative z-10 border-b border-slate-700/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-400/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-blue-300">
              Brand Pulse (Contexto Vivo)
            </h2>
            <p className="text-sm font-bold text-white">{clientName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Brand Kit Sync Badge */}
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
              isBrandKitSync
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : isBrandKitUnset
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
            }`}
          >
            {isBrandKitSync ? (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>
              {isBrandKitSync
                ? 'Brand Kit Conectado'
                : isBrandKitUnset
                ? 'Brand Kit Sin Configurar'
                : 'Brand Kit Desactualizado'}
            </span>
          </div>

          {/* Audit Button */}
          <button
            type="button"
            onClick={onOpenAudit}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-colors"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>Auditar con Cerebro</span>
            <ArrowRight className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={() => refetch()}
            title="Refrescar Pulso"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Grid of Insights */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 relative z-10 text-xs">
        {/* Col 1: ADN & Posicionamiento (7 cols) */}
        <div className="md:col-span-7 bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 space-y-1.5">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Target className="w-3 h-3 text-blue-400" />
            ADN & Posicionamiento Estratégico
          </div>
          <p className="text-slate-200 leading-relaxed font-normal text-xs">{pulse.adn}</p>
        </div>

        {/* Col 2: Hitos & Focos del Mes (5 cols) */}
        <div className="md:col-span-5 bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 space-y-1.5">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-amber-400" />
            Focos & Hitos Activos del Mes
          </div>
          <ul className="space-y-1 text-slate-200 text-xs">
            {pulse.hitosRecientes.map((hito, idx) => (
              <li key={idx} className="flex items-start gap-1.5 truncate">
                <span className="text-blue-400 font-bold shrink-0">•</span>
                <span className="truncate">{hito}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Footer Metrics */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800 relative z-10">
        <div className="flex items-center gap-4">
          <span>
            <strong className="text-white font-medium">{pulse.salud.totalDocs}</strong> documentos de conocimiento
          </span>
          {pulse.salud.ultimaActualizacion && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              Último movimiento:{' '}
              {new Date(pulse.salud.ultimaActualizacion).toLocaleDateString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </span>
          )}
        </div>
        <span className="text-slate-400 italic text-[10px]">
          Alimenta automáticamente la redacción en tickets de Rocky
        </span>
      </div>
    </div>
  );
}
