import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, Calendar, MoreVertical, LayoutGrid,
  ChevronDown, X,
} from 'lucide-react';
import { api } from '../lib/api';
import { CreateTicketModal } from '../components/CreateTicketModal';
import { CalendarioBacklog } from '../components/CalendarioBacklog';

interface Ticket {
  id: string;
  title: string;
  objetivo?: string | null;
  canal: string | null;
  status: string;
  prioridad: string;
  dueDate: string | null;
  links: string[];
  linkEntregable?: string | null;
  owner: { id: string; name: string };
  client: { id: string; name: string };
  ticketType?: { id: string; name: string } | null;
}

interface Cliente {
  id: string;
  name: string;
}

const COLUMNAS = [
  { id: 'BACKLOG',   nombre: 'Backlog',   color: 'bg-[#000033]/5',   border: 'border-[#000033]/20' },
  { id: 'BRIEF',     nombre: 'Brief',     color: 'bg-[#024fff]/5',   border: 'border-[#024fff]/20' },
  { id: 'CONTENIDO', nombre: 'Contenido', color: 'bg-[#00ff99]/10',  border: 'border-[#00ff99]/30' },
  { id: 'DISENO',    nombre: 'Diseño',    color: 'bg-[#024fff]/10',  border: 'border-[#024fff]/30' },
  { id: 'REVISION',  nombre: 'Revisión',  color: 'bg-[#00ff99]/20',  border: 'border-[#00ff99]/40' },
  { id: 'APROBADO',  nombre: 'Aprobado',  color: 'bg-[#00ff99]/30',  border: 'border-[#00ff99]/50' },
] as const;

const PRIORIDAD_STYLES: Record<string, string> = {
  ALTA:  'bg-[#024fff]/10 text-[#024fff] border-[#024fff]/30',
  MEDIA: 'bg-[#00ff99]/20 text-[#000033] border-[#00ff99]/40',
  BAJA:  'bg-[#000033]/5 text-[#000033]/60 border-[#000033]/20',
};

const PRIORIDAD_LABEL: Record<string, string> = {
  ALTA: 'Alta', MEDIA: 'Med', BAJA: 'Baja',
};

export function BacklogPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [clientesSeleccionados, setClientesSeleccionados] = useState<string[]>(() => {
    const clientId = searchParams.get('clientId');
    return clientId ? [clientId] : [];
  });
  const [showDropdownClientes, setShowDropdownClientes] = useState(false);
  const [filtroFecha, setFiltroFecha] = useState<'semana' | 'mes' | 'flexible'>('mes');
  const [vista, setVista] = useState<'kanban' | 'calendario'>('kanban');
  const [showModalNueva, setShowModalNueva] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const { data: ticketsData, isLoading } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => api.getTickets(),
  });

  const { data: clientesData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.getClients(),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateTicket(id, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['tickets'] });
      const prev = queryClient.getQueryData(['tickets']);
      queryClient.setQueryData(['tickets'], (old: any) => ({
        ...old,
        data: old?.data?.map((t: Ticket) => t.id === id ? { ...t, status } : t) ?? [],
      }));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['tickets'], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  });

  const allTickets: Ticket[] = ticketsData?.data ?? [];
  const clientes: Cliente[] = clientesData?.data ?? [];

  const ahora = new Date();
  const inicioSemana = new Date(ahora);
  inicioSemana.setDate(ahora.getDate() - ahora.getDay());
  const finSemana = new Date(inicioSemana);
  finSemana.setDate(inicioSemana.getDate() + 6);
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);

  const ticketsFiltrados = allTickets.filter(t => {
    if (t.status === 'CANCELADO') return false;
    if (clientesSeleccionados.length > 0 && !clientesSeleccionados.includes(t.client.id)) return false;
    if (filtroFecha !== 'flexible' && t.dueDate) {
      const due = new Date(t.dueDate);
      if (filtroFecha === 'semana') return due >= inicioSemana && due <= finSemana;
      if (filtroFecha === 'mes') return due >= inicioMes && due <= finMes;
    }
    return true;
  });

  const getTicketsPorColumna = (colId: string) =>
    ticketsFiltrados.filter(t => t.status === colId);

  const toggleCliente = (id: string) =>
    setClientesSeleccionados(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );

  // Drag & drop
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    if (draggedId) {
      const ticket = allTickets.find(t => t.id === draggedId);
      if (ticket && ticket.status !== status) {
        updateStatusMutation.mutate({ id: draggedId, status });
      }
    }
    setDraggedId(null);
  };

  const altaCount = ticketsFiltrados.filter(t => t.prioridad === 'ALTA').length;
  const mediaCount = ticketsFiltrados.filter(t => t.prioridad === 'MEDIA').length;
  const bajaCount = ticketsFiltrados.filter(t => t.prioridad === 'BAJA').length;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-[#fafafa]">
      {/* Header / Filtros */}
      <div className="bg-white border-b-2 border-[#000033]/10 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setVista('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                vista === 'kanban'
                  ? 'bg-[#024fff] text-white shadow-lg shadow-[#024fff]/20'
                  : 'text-[#000033]/60 hover:text-[#000033] hover:bg-[#000033]/5'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Listado
            </button>
            <button
              onClick={() => setVista('calendario')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                vista === 'calendario'
                  ? 'bg-[#024fff] text-white shadow-lg shadow-[#024fff]/20'
                  : 'text-[#000033]/60 hover:text-[#000033] hover:bg-[#000033]/5'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Calendario
            </button>
          </div>

          <button
            onClick={() => setShowModalNueva(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00ff99]/20 border-2 border-[#00ff99]/40 text-[#000033] rounded-lg hover:bg-[#00ff99]/30 font-bold text-xs transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva pieza
          </button>
        </div>

        <div className="flex items-center gap-4">
          {/* Filtro clientes */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#000033]">Cliente:</span>
            <div className="flex items-center gap-2 flex-wrap">
              {clientesSeleccionados.length > 0 ? (
                clientes
                  .filter(c => clientesSeleccionados.includes(c.id))
                  .map(c => (
                    <button
                      key={c.id}
                      onClick={() => toggleCliente(c.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#024fff]/10 text-[#024fff] text-xs font-bold rounded-lg border-2 border-[#024fff]/20 hover:bg-[#024fff]/20"
                    >
                      {c.name}
                      <X className="w-3 h-3" />
                    </button>
                  ))
              ) : (
                <span className="text-xs text-[#000033]/40">Todos los clientes</span>
              )}

              <div className="relative">
                <button
                  onClick={() => setShowDropdownClientes(prev => !prev)}
                  className="px-3 py-1.5 border-2 border-dashed border-[#000033]/20 text-[#000033]/60 text-xs font-bold rounded-lg hover:border-[#024fff]/40 hover:text-[#024fff] flex items-center gap-1.5"
                >
                  + Agregar
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showDropdownClientes && (
                  <div className="absolute top-full left-0 mt-1 bg-white border-2 border-[#000033]/20 rounded-lg shadow-lg z-10 min-w-[160px]">
                    {clientes.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { toggleCliente(c.id); setShowDropdownClientes(false); }}
                        className="block w-full px-3 py-2 text-left text-xs font-bold text-[#000033] hover:bg-[#024fff]/10 hover:text-[#024fff]"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="w-px h-6 bg-[#000033]/20" />

          {/* Filtro fecha */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#000033]">Fecha:</span>
            <div className="flex gap-1.5">
              {(['semana', 'mes', 'flexible'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFiltroFecha(f)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border-2 transition-all ${
                    filtroFecha === f
                      ? 'bg-[#024fff]/10 text-[#024fff] border-[#024fff]/20'
                      : 'border-[#000033]/10 text-[#000033]/60 hover:border-[#024fff]/40 hover:text-[#024fff]'
                  }`}
                >
                  {f === 'semana' ? 'Esta semana' : f === 'mes' ? 'Este mes' : 'Flexible'}
                </button>
              ))}
            </div>
          </div>

          {(clientesSeleccionados.length > 0 || filtroFecha !== 'mes') && (
            <>
              <div className="flex-1" />
              <button
                onClick={() => { setClientesSeleccionados([]); setFiltroFecha('mes'); }}
                className="text-xs font-bold text-[#000033]/60 hover:text-[#024fff] underline"
              >
                Limpiar filtros
              </button>
            </>
          )}
        </div>
      </div>

      {/* Calendario */}
      {vista === 'calendario' && (
        <CalendarioBacklog
          tickets={ticketsFiltrados}
          onTicketClick={ticket => setSelectedTicket(ticket)}
        />
      )}

      {/* Kanban */}
      {vista === 'kanban' && isLoading ? (
        <div className="flex-1 flex items-center justify-center text-[#000033]/60">
          Cargando...
        </div>
      ) : vista === 'kanban' ? (
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-3 p-4 h-full min-w-max">
            {COLUMNAS.map(col => {
              const tickets = getTicketsPorColumna(col.id);
              return (
                <div
                  key={col.id}
                  className="flex flex-col w-[240px] flex-shrink-0"
                >
                  {/* Header columna */}
                  <div className={`${col.color} border-2 ${col.border} rounded-t-xl px-3 py-2 flex items-center justify-between`}>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-xs font-bold text-[#000033]">{col.nombre}</h3>
                      <span className="text-xs font-bold text-[#000033]/60 bg-white/60 px-1.5 py-0.5 rounded-full">
                        {tickets.length}
                      </span>
                    </div>
                    <MoreVertical className="w-3.5 h-3.5 text-[#000033]/40" />
                  </div>

                  {/* Cards */}
                  <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => handleDrop(e, col.id)}
                    className="flex-1 overflow-y-auto bg-[#000033]/[0.02] border-2 border-t-0 border-[#000033]/10 rounded-b-xl p-2 space-y-2 min-h-[400px]"
                  >
                    {tickets.map(ticket => (
                      <TicketCard
                        key={ticket.id}
                        ticket={ticket}
                        isDragging={draggedId === ticket.id}
                        onDragStart={e => handleDragStart(e, ticket.id)}
                        onDragEnd={() => setDraggedId(null)}
                        onClick={() => setSelectedTicket(ticket)}
                      />
                    ))}

                    {col.id === 'BACKLOG' && (
                      <button
                        onClick={() => setShowModalNueva(true)}
                        className="w-full py-2 border-2 border-dashed border-[#000033]/20 rounded-lg text-xs font-bold text-[#000033]/40 hover:border-[#024fff]/40 hover:text-[#024fff] hover:bg-[#024fff]/5 transition-all"
                      >
                        + Nueva idea
                      </button>
                    )}

                    {tickets.length === 0 && col.id !== 'BACKLOG' && (
                      <div className="py-6 text-center text-xs text-[#000033]/30 font-medium">
                        Sin piezas
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Stats footer — solo en kanban */}
      {vista === 'kanban' && <div className="bg-white border-t-2 border-[#000033]/10 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between text-xs text-[#000033]/60">
          <div className="flex items-center gap-6">
            <span>
              <strong className="text-[#024fff] font-bold">{altaCount}</strong> Alta prioridad
            </span>
            <span>
              <strong className="text-[#000033] font-bold">{mediaCount}</strong> Media
            </span>
            <span>
              <strong className="text-[#000033]/60 font-bold">{bajaCount}</strong> Baja
            </span>
          </div>
          <span>{ticketsFiltrados.length} piezas en total</span>
        </div>
      </div>}

      <CreateTicketModal
        isOpen={showModalNueva || !!selectedTicket}
        ticket={selectedTicket}
        onClose={() => { setShowModalNueva(false); setSelectedTicket(null); }}
      />
    </div>
  );
}

function TicketCard({
  ticket,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  ticket: Ticket;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`bg-white border-2 border-[#000033]/10 rounded-lg p-3 hover:shadow-lg hover:border-[#024fff]/30 transition-all cursor-pointer group ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${PRIORIDAD_STYLES[ticket.prioridad] ?? ''}`}>
          {PRIORIDAD_LABEL[ticket.prioridad] ?? ticket.prioridad}
        </span>
        <button className="text-[#000033]/20 hover:text-[#000033] opacity-0 group-hover:opacity-100 transition-opacity">
          <MoreVertical className="w-3 h-3" />
        </button>
      </div>

      {/* Título */}
      <p className="text-xs font-medium text-[#000033] mb-3 leading-relaxed line-clamp-3">
        {ticket.title}
      </p>

      {/* Canal + Tipo */}
      {(ticket.canal || ticket.ticketType) && (
        <div className="flex items-center gap-1.5 text-xs text-[#000033]/60 mb-2 pb-2 border-b border-[#000033]/10">
          {ticket.canal && <span className="font-medium">{ticket.canal}</span>}
          {ticket.canal && ticket.ticketType && <span>•</span>}
          {ticket.ticketType && <span className="font-medium">{ticket.ticketType.name}</span>}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-[#024fff]/10 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-[#024fff] leading-none">
              {ticket.owner.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="font-bold text-[#000033] truncate max-w-[70px]">
            {ticket.owner.name.split(' ')[0]}
          </span>
        </div>
        {ticket.dueDate && (
          <div className="flex items-center gap-1 text-[#000033]/60">
            <Calendar className="w-2.5 h-2.5" />
            <span className="font-medium">
              {new Date(ticket.dueDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
