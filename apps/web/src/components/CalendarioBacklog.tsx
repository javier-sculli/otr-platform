import { useState } from 'react';
import { ChevronLeft, ChevronRight, AlertCircle, Clock } from 'lucide-react';

interface Ticket {
  id: string;
  title: string;
  canal: string | null;
  status: string;
  prioridad: string;
  dueDate: string | null;
  links: string[];
  linkEntregable?: string | null;
  owner: { id: string; name: string };
  client: { id: string; name: string };
}

interface CalendarioBacklogProps {
  tickets: Ticket[];
  onTicketClick: (ticket: Ticket) => void;
}

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function getColorPorFecha(dueDate: string) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(dueDate);
  fecha.setHours(0, 0, 0, 0);
  const diff = Math.floor((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) {
    return {
      bg: 'bg-red-500/20',
      border: 'border-red-500/60',
      text: 'text-red-700',
      Icon: AlertCircle,
      label: 'Vencida',
    };
  } else if (diff <= 3) {
    return {
      bg: 'bg-orange-400/20',
      border: 'border-orange-400/60',
      text: 'text-orange-700',
      Icon: Clock,
      label: 'Urgente',
    };
  }
  return {
    bg: 'bg-[#024fff]/10',
    border: 'border-[#024fff]/30',
    text: 'text-[#024fff]',
    Icon: null,
    label: null,
  };
}

export function CalendarioBacklog({ tickets, onTicketClick }: CalendarioBacklogProps) {
  const hoy = new Date();
  const [mesActual, setMesActual] = useState(new Date(hoy.getFullYear(), hoy.getMonth()));

  const año = mesActual.getFullYear();
  const mes = mesActual.getMonth();

  const primerDia = new Date(año, mes, 1).getDay();
  const diasEnMes = new Date(año, mes + 1, 0).getDate();

  const dias: (Date | null)[] = [
    ...Array(primerDia).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => new Date(año, mes, i + 1)),
  ];

  const getTicketsDelDia = (fecha: Date) =>
    tickets.filter(t => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return (
        d.getFullYear() === fecha.getFullYear() &&
        d.getMonth() === fecha.getMonth() &&
        d.getDate() === fecha.getDate()
      );
    });

  const esHoy = (fecha: Date) => {
    return (
      fecha.getDate() === hoy.getDate() &&
      fecha.getMonth() === hoy.getMonth() &&
      fecha.getFullYear() === hoy.getFullYear()
    );
  };

  const ticketsConFecha = tickets.filter(t => t.dueDate);
  const vencidos = ticketsConFecha.filter(t => {
    const d = new Date(t.dueDate!);
    d.setHours(0, 0, 0, 0);
    const h = new Date(); h.setHours(0, 0, 0, 0);
    return d < h;
  }).length;
  const urgentes = ticketsConFecha.filter(t => {
    const d = new Date(t.dueDate!);
    d.setHours(0, 0, 0, 0);
    const h = new Date(); h.setHours(0, 0, 0, 0);
    const diff = Math.floor((d.getTime() - h.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= 3;
  }).length;

  const nombreMes = mesActual.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  // Tickets en el mes visible
  const ticketsDelMes = tickets.filter(t => {
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate);
    return d.getFullYear() === año && d.getMonth() === mes;
  });

  return (
    <div className="flex-1 flex flex-col bg-[#fafafa] overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b-2 border-[#000033]/10 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-[#000033] capitalize">{nombreMes}</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMesActual(new Date(año, mes - 1))}
                className="p-2 rounded-lg border-2 border-[#000033]/10 hover:border-[#024fff]/30 hover:bg-[#024fff]/5 transition-all"
              >
                <ChevronLeft className="w-4 h-4 text-[#000033]" />
              </button>
              <button
                onClick={() => setMesActual(new Date(año, mes + 1))}
                className="p-2 rounded-lg border-2 border-[#000033]/10 hover:border-[#024fff]/30 hover:bg-[#024fff]/5 transition-all"
              >
                <ChevronRight className="w-4 h-4 text-[#000033]" />
              </button>
              <button
                onClick={() => setMesActual(new Date(hoy.getFullYear(), hoy.getMonth()))}
                className="px-3 py-2 text-xs font-bold text-[#024fff] border-2 border-[#024fff]/20 rounded-lg hover:bg-[#024fff]/10 transition-all"
              >
                Hoy
              </button>
            </div>
          </div>

          {/* Leyenda */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500/20 border-2 border-red-500/60 rounded" />
              <span className="text-[#000033]/60 font-medium">Vencida</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-400/20 border-2 border-orange-400/60 rounded" />
              <span className="text-[#000033]/60 font-medium">Urgente (≤3 días)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-[#024fff]/10 border-2 border-[#024fff]/30 rounded" />
              <span className="text-[#000033]/60 font-medium">Normal</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-[1600px] mx-auto">
          {/* Días semana */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {DIAS_SEMANA.map(d => (
              <div key={d} className="text-center py-2 text-xs font-bold text-[#000033]/60">
                {d}
              </div>
            ))}
          </div>

          {/* Celdas */}
          <div className="grid grid-cols-7 gap-2">
            {dias.map((fecha, i) => {
              const ticketsDia = fecha ? getTicketsDelDia(fecha) : [];
              const hoyFlag = fecha && esHoy(fecha);

              return (
                <div
                  key={i}
                  className={`min-h-[140px] border-2 rounded-lg p-2 transition-all ${
                    !fecha
                      ? 'bg-[#000033]/[0.02] border-[#000033]/5'
                      : hoyFlag
                      ? 'bg-[#00ff99]/10 border-[#00ff99]/40 shadow-md'
                      : 'bg-white border-[#000033]/10 hover:border-[#024fff]/30 hover:shadow-sm'
                  }`}
                >
                  {fecha && (
                    <>
                      <div className={`text-sm font-bold mb-2 ${
                        hoyFlag
                          ? 'text-[#000033] bg-[#00ff99]/30 w-6 h-6 rounded-full flex items-center justify-center'
                          : 'text-[#000033]/60'
                      }`}>
                        {fecha.getDate()}
                      </div>

                      <div className="space-y-1.5">
                        {ticketsDia.map(ticket => {
                          const { bg, border, text, Icon, label } = getColorPorFecha(ticket.dueDate!);
                          return (
                            <div
                              key={ticket.id}
                              onClick={() => onTicketClick(ticket)}
                              className={`${bg} border-2 ${border} rounded-lg p-2 cursor-pointer hover:shadow-md transition-all`}
                            >
                              <div className="flex items-start gap-1.5 mb-1">
                                {Icon && <Icon className={`w-3 h-3 ${text} flex-shrink-0 mt-0.5`} />}
                                <p className={`text-xs font-bold ${text} leading-tight line-clamp-2 flex-1`}>
                                  {ticket.title}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-[#000033]/60">
                                <span className="font-medium truncate">{ticket.canal ?? ticket.client.name}</span>
                              </div>
                              {label && (
                                <div className={`text-[10px] font-bold ${text} mt-1`}>{label}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t-2 border-[#000033]/10 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between text-xs text-[#000033]/60">
          <div className="flex items-center gap-6">
            <span>
              <strong className="text-red-600 font-bold">{vencidos}</strong> Vencidas
            </span>
            <span>
              <strong className="text-orange-600 font-bold">{urgentes}</strong> Urgentes
            </span>
            <span>
              <strong className="text-[#024fff] font-bold">{ticketsDelMes.length}</strong> Total este mes
            </span>
          </div>
          <span>
            Hoy: {hoy.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
      </div>
    </div>
  );
}
