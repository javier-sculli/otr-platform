import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { subscribeToasts, dismissToast, type ToastItem } from '../lib/toast';

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return subscribeToasts(setToasts);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-[380px] w-[calc(100vw-32px)] pointer-events-none font-anek"
      data-testid="toast-container"
      role="region"
      aria-label="Notificaciones del sistema"
    >
      {toasts.map((t) => {
        const isError = t.type === 'error';
        const isWarning = t.type === 'warning';
        const isSuccess = t.type === 'success';

        const borderClass = isError
          ? 'border-[#d4380d]/35 bg-[#fff5f2]'
          : isWarning
          ? 'border-[#ff9e22]/40 bg-[#fff9f0]'
          : isSuccess
          ? 'border-[#00a372]/35 bg-[#f0fdf8]'
          : 'border-[#024fff]/30 bg-white';

        const iconColor = isError
          ? 'text-[#d4380d]'
          : isWarning
          ? 'text-[#d97706]'
          : isSuccess
          ? 'text-[#00a372]'
          : 'text-[#024fff]';

        return (
          <div
            key={t.id}
            data-testid="global-toast"
            data-toast-type={t.type}
            role="alert"
            className={`pointer-events-auto flex items-start gap-2.5 p-3.5 rounded-[10px] border shadow-[0_8px_28px_rgba(0,14,31,0.16)] transition-all ${borderClass}`}
          >
            <div className={`shrink-0 mt-0.5 ${iconColor}`}>
              {isError ? (
                <AlertCircle className="w-4 h-4" />
              ) : isWarning ? (
                <AlertTriangle className="w-4 h-4" />
              ) : isSuccess ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Info className="w-4 h-4" />
              )}
            </div>

            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              {t.title && (
                <span className="text-[14px] font-bold text-[#0d0d0d] leading-snug">
                  {t.title}
                </span>
              )}
              <span className="text-[13px] text-[#3a4655] leading-snug break-words">
                {t.message}
              </span>
            </div>

            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              title="Cerrar aviso"
              aria-label="Cerrar aviso"
              className="shrink-0 p-1 -mr-1 -mt-1 rounded-md text-[#8c96a3] hover:text-[#0d0d0d] hover:bg-black/5 border-0 bg-transparent cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
