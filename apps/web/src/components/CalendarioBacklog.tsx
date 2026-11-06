import { useState } from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { parseLocalDate, getFechaPublicacion } from '../lib/utils';
import type { Ticket } from '../pages/BacklogPage';

interface CalendarioBacklogProps {
  tickets: Ticket[];
  onTicketClick: (ticket: Ticket) => void;
}

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const COLOR_ESTADO: Record<string, string> = {
  PENDIENTE: '#8c96a3',
  REDACCION: '#024fff',
  DISENO: '#024fff',
  EDICION: '#024fff',
  REVISION_INTERNA: '#00e39c',
  CLIENTE: '#00e39c',
  ESPERANDO_FEEDBACK: '#00e39c',
  LISTO_PARA_PUBLICAR: '#00a372',
  PUBLICADO: '#00a372',
  CANCELADO: '#b9c2cd',
  LISTO: '#00a372',
};

export function CalendarioBacklog({ tickets, onTicketClick }: CalendarioBacklogProps) {
  const hoy = new Date();
  const [mesActual, setMesActual] = useState(new Date(hoy.getFullYear(), hoy.getMonth()));

  const año = mesActual.getFullYear();
  const mes = mesActual.getMonth();

  // Calendario con semana arrancando el Lunes
  // getDay(): 0 = Dom, 1 = Lun, ..., 6 = Sáb
  const primerDiaSemana = (new Date(año, mes, 1).getDay() + 6) % 7;
  const diasEnMes = new Date(año, mes + 1, 0).getDate();
  const nSemanas = Math.ceil((primerDiaSemana + diasEnMes) / 7);

  const calAnterior = () => setMesActual(new Date(año, mes - 1, 1));
  const calSiguiente = () => setMesActual(new Date(año, mes + 1, 1));
  const calHoy = () => setMesActual(new Date(hoy.getFullYear(), hoy.getMonth(), 1));

  const nombreMes = mesActual.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const calLabel = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);

  const getTicketsDelDia = (fechaStr: string) => {
    return tickets.filter(t => {
      const dateToUse = getFechaPublicacion(t as any);
      if (!dateToUse) return false;
      const d = parseLocalDate(dateToUse);
      if (!d) return false;
      const fStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return fStr === fechaStr;
    });
  };

  const esVencido = (t: Ticket) => {
    if (t.status === 'PUBLICADO' || t.status === 'LISTO' || t.status === 'CANCELADO') return false;
    const dateToUse = getFechaPublicacion(t as any);
    if (!dateToUse) return false;
    const d = parseLocalDate(dateToUse);
    if (!d) return false;
    d.setHours(0, 0, 0, 0);
    const h = new Date();
    h.setHours(0, 0, 0, 0);
    return d < h;
  };

  const semanas = [];
  for (let w = 0; w < nSemanas; w++) {
    const dias = [];
    for (let k = 0; k < 7; k++) {
      const dt = new Date(año, mes, 1 - primerDiaSemana + w * 7 + k);
      const fStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      const delMes = dt.getMonth() === mes;
      const isHoy = (
        dt.getDate() === hoy.getDate() &&
        dt.getMonth() === hoy.getMonth() &&
        dt.getFullYear() === hoy.getFullYear()
      );
      const items = getTicketsDelDia(fStr);
      dias.push({
        date: dt,
        fStr,
        num: dt.getDate(),
        delMes,
        isHoy,
        items,
      });
    }
    semanas.push(dias);
  }

  return (
    <div className="flex flex-col gap-3 p-5 sm:p-6 pb-8 bg-white overflow-hidden">
      {/* Month nav and legend */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={calAnterior}
            aria-label="Mes anterior"
            className="rk-btn rk-btn--quiet rk-btn--icon"
          >
            <ChevronLeft className="w-4 h-4 text-[#3a4655]" />
          </button>
          <button
            type="button"
            onClick={calSiguiente}
            aria-label="Mes siguiente"
            className="rk-btn rk-btn--quiet rk-btn--icon"
          >
            <ChevronRight className="w-4 h-4 text-[#3a4655]" />
          </button>
        </div>

        <span className="text-xl font-extrabold text-[#0d0d0d] tracking-tight">
          {calLabel}
        </span>

        <button
          type="button"
          onClick={calHoy}
          className="rk-btn rk-btn--text font-bold"
        >
          Hoy
        </button>

        <span className="flex-1" />

        <div className="inline-flex items-center gap-4 flex-wrap text-[13px] text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-[#00a372]" />
            Publicado · en su fecha
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="rk-dot bg-[var(--brand)]" />
            En curso · en fecha de entrega
          </span>
          <span className="inline-flex items-center gap-1.5 text-[var(--danger)] font-bold">
            <span className="rk-dot bg-[var(--danger)]" />
            Vencido
          </span>
        </div>
      </div>

      {/* Grid container */}
      <div className="overflow-x-auto">
        <div className="min-w-[840px] border border-[var(--border)] rounded-xl overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 bg-[var(--surface-subtle)] border-b border-[var(--border)]">
            {DIAS_SEMANA.map(d => (
              <span
                key={d}
                className="py-2.5 px-3 text-xs font-bold tracking-wider uppercase text-[var(--text-muted)]"
              >
                {d}
              </span>
            ))}
          </div>

          {/* Weeks */}
          {semanas.map((semana, wIdx) => (
            <div
              key={wIdx}
              className={`grid grid-cols-7 ${wIdx > 0 ? 'border-t border-[var(--border)]' : ''}`}
            >
              {semana.map((dia, dIdx) => {
                const visibleItems = dia.items.slice(0, 3);
                const hasMore = dia.items.length > 3;

                return (
                  <div
                    key={dIdx}
                    className={`min-h-[116px] p-2 flex flex-col gap-1 transition-colors ${
                      dIdx > 0 ? 'border-l border-[var(--border)]' : ''
                    } ${dia.delMes ? 'bg-white' : 'bg-[var(--surface-subtle)]'}`}
                  >
                    <span
                      className={`self-start inline-flex items-center justify-center min-w-[24px] h-6 px-1 rounded-full text-xs transition-all ${
                        dia.isHoy
                          ? 'font-bold text-white bg-[var(--brand)] shadow-sm'
                          : dia.delMes
                          ? 'font-bold text-[#0d0d0d]'
                          : 'font-normal text-[var(--text-subtle)]'
                      }`}
                    >
                      {dia.num}
                    </span>

                    <div className="flex flex-col gap-1 mt-0.5">
                      {visibleItems.map(ticket => {
                        const publicado = ticket.status === 'PUBLICADO';
                        const venc = esVencido(ticket);
                        const dotColor = venc ? '#d4380d' : (COLOR_ESTADO[ticket.status] || '#024fff');
                        const corto = ticket.title.replace(/^[^|]*\|\s*/, '');

                        return (
                          <button
                            key={ticket.id}
                            type="button"
                            onClick={() => onTicketClick(ticket)}
                            title={`${ticket.title} (${ticket.client.name})`}
                            className={`bk-ev flex items-center gap-1.5 w-full py-1 px-1.5 border-0 rounded-md text-left cursor-pointer text-xs font-bold transition-colors ${
                              publicado
                                ? 'text-[var(--text-muted)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-muted)]'
                                : venc
                                ? 'text-[var(--danger)] bg-red-50 hover:bg-red-100'
                                : 'text-[var(--text)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-muted)]'
                            }`}
                          >
                            {publicado ? (
                              <Check className="w-3 h-3 text-[#00a372] flex-shrink-0" />
                            ) : (
                              <span
                                className="rk-dot w-1.5 h-1.5 flex-shrink-0"
                                style={{ background: dotColor }}
                              />
                            )}
                            <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                              {corto}
                            </span>
                          </button>
                        );
                      })}

                      {hasMore && (
                        <span className="text-[11px] text-[var(--text-muted)] px-1 font-semibold">
                          +{dia.items.length - 3} más
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
