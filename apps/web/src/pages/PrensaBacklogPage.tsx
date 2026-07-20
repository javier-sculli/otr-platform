import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus, Calendar, MoreVertical, ChevronDown, ChevronUp, X, Search, Newspaper, Mail, Archive,
} from 'lucide-react';
import { api } from '../lib/api';
import { CreateTicketModal } from '../components/CreateTicketModal';
import {
  MACROS, PRENSA_SUBESTADOS, SUB_DEF, subsDeMacro,
  ESTADO_RESPUESTA_LABEL, TIPO_GESTION_PITCH, MACRO_DEFAULT_SUB,
  type GeneralStatus, type SubEstado,
} from '../lib/estados';

interface Ticket {
  id: string;
  title: string;
  objetivo?: string | null;
  status: string;
  prioridad: string;
  area?: string;
  macroEstado?: string | null;
  subEstado?: SubEstado | null;
  medio?: string | null;
  periodista?: string | null;
  estadoRespuesta?: string | null;
  dueDate: string | null;
  links: string[];
  owner: { id: string; name: string };
  client: { id: string; name: string };
  ticketType?: { id: string; name: string; kind?: string } | null;
  updatedAt: string;
}

interface Cliente { id: string; name: string }

const PRIORIDAD_STYLES: Record<string, string> = {
  ALTA:  'bg-[#024fff]/10 text-[#024fff] border-[#024fff]/30',
  MEDIA: 'bg-[#00ff99]/20 text-[#000033] border-[#00ff99]/40',
  BAJA:  'bg-[#000033]/5 text-[#000033]/60 border-[#000033]/20',
};
const PRIORIDAD_LABEL: Record<string, string> = { ALTA: 'Alta', MEDIA: 'Med', BAJA: 'Baja' };

const RESPUESTA_STYLES: Record<string, string> = {
  ENVIADO:      'bg-[#024fff]/10 text-[#024fff] border-[#024fff]/30',
  RESPONDIDO:   'bg-[#00ff99]/20 text-[#000033] border-[#00ff99]/45',
  SIN_RESPUESTA:'bg-[#000033]/5 text-[#000033]/50 border-[#000033]/20',
};

// ─── Empty slot ───────────────────────────────────────────────────────────────
function EmptySlot() {
  return (
    <div className="flex items-center justify-center py-5 border-2 border-dashed border-[#000033]/10 rounded-lg">
      <span className="text-[11px] font-medium text-[#000033]/25">Sin tareas</span>
    </div>
  );
}

// ─── Client block header ──────────────────────────────────────────────────────
function ClienteHeader({
  nombre, count, expanded, onToggle,
}: {
  nombre: string; count: number; expanded: boolean; onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-5 py-3.5 bg-white border-2 border-[#000033]/10 rounded-xl hover:bg-[#000033]/[0.015] transition-all text-left"
    >
      <div className="w-8 h-8 rounded-lg bg-[#024fff]/10 flex items-center justify-center flex-shrink-0">
        <span className="text-sm font-bold text-[#024fff]">{nombre.charAt(0).toUpperCase()}</span>
      </div>
      <span className="text-sm font-bold text-[#000033]">{nombre}</span>
      <span className="text-xs font-bold text-[#000033]/40 bg-[#000033]/[0.05] px-2 py-0.5 rounded-full">
        {count}
      </span>
      <div className="ml-auto text-[#000033]/30">
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </div>
    </button>
  );
}

// ─── Segmented control helper ─────────────────────────────────────────────
function Seg<T extends string>({ label, opts, value, onChange }: {
  label: string; opts: T[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold text-[#000033]/50">{label}</span>
      <div className="flex items-center gap-0.5 bg-[#000033]/[0.04] rounded-lg p-0.5">
        {opts.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
              value === opt
                ? "bg-white text-[#000033] shadow-sm"
                : "text-[#000033]/40 hover:text-[#000033]/70"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PrensaBacklogPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  // existing filter states
  const [clientesSeleccionados, setClientesSeleccionados] = useState<string[]>(() => {
    const clientId = searchParams.get('clientId');
    if (clientId) return [clientId];
    return user?.preferredClientIds ?? [];
  });
  const [showDropdownClientes, setShowDropdownClientes] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [showBusqueda, setShowBusqueda] = useState(false);
  const [showModalNueva, setShowModalNueva] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // new layout states
  const [agruparPor, setAgruparPor] = useState<'Estado' | 'Cliente'>('Estado');
  const [densidad, setDensidad] = useState<'Compacta' | 'Expandida'>('Compacta');
  const [expandedClientes, setExpandedClientes] = useState<Set<string>>(new Set());

  // Date filters states (replicated from Contenido)
  const [filtroFecha, setFiltroFecha] = useState<'hoy' | 'semana' | 'mes0' | 'mes1' | 'mes2' | 'rango' | null>('mes0');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [expandedFinalizados, setExpandedFinalizados] = useState(false);
  const [showHistorialModal, setShowHistorialModal] = useState(false);

  const { data: ticketsData, isLoading } = useQuery({
    queryKey: ['tickets', 'PRENSA'],
    queryFn: () => api.getTickets({ area: 'PRENSA' }),
  });

  const { data: clientesData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.getClients(),
  });

  const updateSubEstadoMutation = useMutation({
    mutationFn: ({ id, subEstado }: { id: string; subEstado: SubEstado }) =>
      api.updateTicket(id, { subEstado }),
    onMutate: async ({ id, subEstado }) => {
      await queryClient.cancelQueries({ queryKey: ['tickets', 'PRENSA'] });
      const prev = queryClient.getQueryData(['tickets', 'PRENSA']);
      const macro = SUB_DEF[subEstado]?.macro;
      queryClient.setQueryData(['tickets', 'PRENSA'], (old: any) => ({
        ...old,
        data: old?.data?.map((t: Ticket) =>
          t.id === id ? { ...t, subEstado, macroEstado: macro } : t) ?? [],
      }));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['tickets', 'PRENSA'], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  });

  const allTickets: Ticket[] = ticketsData?.data ?? [];
  const clientes: Cliente[] = clientesData?.data ?? [];

  // Date ranges calculation (same as BacklogPage)
  const ahora = new Date();

  const inicioHoy = new Date(ahora);
  inicioHoy.setHours(0, 0, 0, 0);
  const finHoy = new Date(ahora);
  finHoy.setHours(23, 59, 59, 999);

  const inicioSemana = new Date(ahora);
  const currentDay = ahora.getDay();
  const mondayDiff = ahora.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
  inicioSemana.setDate(mondayDiff);
  inicioSemana.setHours(0, 0, 0, 0);

  const finSemana = new Date(inicioSemana);
  finSemana.setDate(inicioSemana.getDate() + 6);
  finSemana.setHours(23, 59, 59, 999);

  const meses = [0, 1, 2].map(offset => ({
    inicio: new Date(ahora.getFullYear(), ahora.getMonth() - offset, 1),
    fin: new Date(ahora.getFullYear(), ahora.getMonth() - offset + 1, 0),
    label: new Date(ahora.getFullYear(), ahora.getMonth() - offset, 1)
      .toLocaleDateString('es-ES', { month: 'long' }),
  }));

  const limite30Dias = new Date();
  limite30Dias.setDate(limite30Dias.getDate() - 30);

  const ticketsFiltrados = allTickets.filter(t => {
    if (clientesSeleccionados.length > 0 && !clientesSeleccionados.includes(t.client.id)) return false;

    // Filter out finalized tickets older than 30 days on the main board
    const isFinalized = t.subEstado === 'LISTO' || t.subEstado === 'CANCELADO';
    if (isFinalized && t.updatedAt) {
      if (new Date(t.updatedAt) < limite30Dias) return false;
    }

    // Date Filter (replicated from Contenido)
    // Para tickets finalizados no aplicamos el filtro de fecha general del backlog
    if (!isFinalized && filtroFecha && t.dueDate) {
      const due = new Date(t.dueDate);
      if (filtroFecha === 'hoy') return due >= inicioHoy && due <= finHoy;
      if (filtroFecha === 'semana') return due >= inicioSemana && due <= finSemana;
      if (filtroFecha === 'mes0') return due >= meses[0].inicio && due <= meses[0].fin;
      if (filtroFecha === 'mes1') return due >= meses[1].inicio && due <= meses[1].fin;
      if (filtroFecha === 'mes2') return due >= meses[2].inicio && due <= meses[2].fin;
      if (filtroFecha === 'rango') {
        if (fechaDesde && due < new Date(fechaDesde)) return false;
        if (fechaHasta) {
          const hasta = new Date(fechaHasta);
          hasta.setHours(23, 59, 59);
          if (due > hasta) return false;
        }
      }
    }

    if (busqueda) {
      const q = busqueda.toLowerCase();
      const match = t.title.toLowerCase().includes(q)
        || (t.objetivo?.toLowerCase().includes(q) ?? false)
        || (t.medio?.toLowerCase().includes(q) ?? false)
        || (t.periodista?.toLowerCase().includes(q) ?? false);
      if (!match) return false;
    }
    return true;
  });

  // Effective subState of a ticket (fallback PENDIENTE if not set).
  const subOf = (t: Ticket): SubEstado => (t.subEstado && SUB_DEF[t.subEstado] ? t.subEstado : 'PENDIENTE');

  const ticketsDeSub = (sub: SubEstado, items = ticketsFiltrados) => {
    const list = items.filter(t => subOf(t) === sub);
    const subDef = SUB_DEF[sub];
    if (subDef?.macro === 'FINALIZADO') {
      return [...list].sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      });
    }
    return list;
  };

  const countMacro = (macro: GeneralStatus, items = ticketsFiltrados) =>
    items.filter(t => SUB_DEF[subOf(t)].macro === macro).length;

  const getClientesList = (): Cliente[] => {
    if (clientesSeleccionados.length > 0) {
      return clientes.filter(c => clientesSeleccionados.includes(c.id));
    }
    return clientes;
  };

  const getTicketsDeCliente = (clientId: string) =>
    ticketsFiltrados.filter(t => t.client.id === clientId);

  const toggleCliente = (id: string) =>
    setClientesSeleccionados(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const toggleExpandedCliente = (nombre: string) =>
    setExpandedClientes(prev => {
      const next = new Set(prev);
      next.has(nombre) ? next.delete(nombre) : next.add(nombre);
      return next;
    });

  const handleAgruparChange = (val: 'Estado' | 'Cliente') => {
    setAgruparPor(val);
    if (val === 'Cliente') {
      const allClientNames = getClientesList().map(c => c.name);
      setExpandedClientes(densidad === 'Compacta' ? new Set(allClientNames) : new Set());
    }
  };

  const handleDensidadChange = (val: 'Compacta' | 'Expandida') => {
    setDensidad(val);
    if (agruparPor === 'Cliente') {
      const allClientNames = getClientesList().map(c => c.name);
      setExpandedClientes(val === 'Compacta' ? new Set(allClientNames) : new Set());
    }
  };

  const handleDrop = (subEstado: SubEstado) => {
    if (draggedId) {
      const t = allTickets.find(x => x.id === draggedId);
      if (t && subOf(t) !== subEstado) updateSubEstadoMutation.mutate({ id: draggedId, subEstado });
    }
    setDraggedId(null);
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-[#fafafa]">
      {/* Toolbar */}
      <div className="bg-white border-b-2 border-[#000033]/10 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-[#024fff]" />
            <h1 className="text-sm font-bold text-[#000033]">Backlog de Prensa</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistorialModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#000033]/5 border-2 border-[#000033]/10 text-[#000033]/70 rounded-lg hover:bg-[#000033]/10 font-bold text-xs transition-all"
            >
              <Archive className="w-3.5 h-3.5" />
              Historial
            </button>
            <button
              onClick={() => setShowModalNueva(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#024fff]/10 border-2 border-[#024fff]/30 text-[#024fff] rounded-lg hover:bg-[#024fff]/20 font-bold text-xs transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Search bar */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBusqueda(!showBusqueda)}
              className={`p-1.5 rounded-lg border-2 transition-all ${
                showBusqueda ? 'bg-[#024fff]/10 text-[#024fff] border-[#024fff]/30'
                  : 'text-[#000033]/40 border-[#000033]/10 hover:text-[#024fff] hover:border-[#024fff]/30'
              }`}
            >
              <Search className="w-4 h-4" />
            </button>
            {showBusqueda && (
              <input
                type="text"
                placeholder="Buscar por título, medio o periodista..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="px-3 py-1.5 border-2 border-[#024fff]/20 rounded-lg text-xs text-[#000033] bg-white focus:outline-none focus:border-[#024fff]/50 w-56"
              />
            )}
          </div>

          <div className="w-px h-6 bg-[#000033]/20" />

          {/* Group controls */}
          <Seg
            label="Agrupar:"
            opts={['Estado', 'Cliente']}
            value={agruparPor}
            onChange={handleAgruparChange}
          />

          {/* Density controls */}
          <Seg
            label="Vista:"
            opts={['Compacta', 'Expandida']}
            value={densidad}
            onChange={handleDensidadChange}
          />

          <div className="w-px h-6 bg-[#000033]/20" />

          {/* Date Filter (replicated from Contenido) */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#000033]">Fecha:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {([
                { key: 'hoy',    label: 'Hoy' },
                { key: 'semana', label: 'Esta semana' },
                { key: 'mes0',   label: meses[0].label },
                { key: 'mes1',   label: meses[1].label },
                { key: 'mes2',   label: meses[2].label },
                { key: 'rango',  label: 'Rango' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFiltroFecha(prev => prev === key ? null : key)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border-2 transition-all capitalize ${
                    filtroFecha === key
                      ? 'bg-[#024fff]/10 text-[#024fff] border-[#024fff]/20'
                      : 'border-[#000033]/10 text-[#000033]/60 hover:border-[#024fff]/40 hover:text-[#024fff]'
                  }`}
                >
                  {label}
                </button>
              ))}
              {filtroFecha === 'rango' && (
                <div className="flex items-center gap-1.5 ml-1">
                  <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
                    className="px-2 py-1.5 border-2 border-[#024fff]/20 rounded-lg text-xs text-[#000033] bg-white focus:outline-none focus:border-[#024fff]/50" />
                  <span className="text-xs text-[#000033]/40">—</span>
                  <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
                    className="px-2 py-1.5 border-2 border-[#024fff]/20 rounded-lg text-xs text-[#000033] bg-white focus:outline-none focus:border-[#024fff]/50" />
                </div>
              )}
            </div>
          </div>

          <div className="w-px h-6 bg-[#000033]/20" />

          {/* Client Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#000033]">Cliente:</span>
            <div className="flex items-center gap-2 flex-wrap">
              {clientesSeleccionados.length > 0 ? (
                clientes.filter(c => clientesSeleccionados.includes(c.id)).map(c => (
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
                  onClick={() => setShowDropdownClientes(p => !p)}
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

          {(clientesSeleccionados.length > 0 || busqueda || filtroFecha !== null) && (
            <>
              <div className="flex-1" />
              <button
                onClick={() => { setClientesSeleccionados([]); setBusqueda(''); setFiltroFecha(null); setFechaDesde(''); setFechaHasta(''); }}
                className="text-xs font-bold text-[#000033]/60 hover:text-[#024fff] underline"
              >
                Limpiar filtros
              </button>
            </>
          )}
        </div>
      </div>

      {/* Board Rendering */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-[#000033]/60">Cargando...</div>
      ) : (
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          
          {/* ── VIEW 1: Estado + Compacta (4 macro cols, sub-sections) ── */}
          {agruparPor === 'Estado' && densidad === 'Compacta' && (
            <div className="flex gap-3 p-4 h-full w-full">
              {MACROS.map(macro => (
                <div 
                  key={macro.id} 
                  className="flex flex-col flex-1 min-w-[240px]"
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => handleDrop(MACRO_DEFAULT_SUB[macro.id])}
                >
                  <div className={`${macro.color} border-2 ${macro.border} rounded-t-xl px-3 py-2 flex items-center justify-between`}>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-xs font-bold text-[#000033]">{macro.label}</h3>
                      <span className="text-xs font-bold text-[#000033]/60 bg-white/60 px-1.5 py-0.5 rounded-full">
                        {countMacro(macro.id)}
                      </span>
                    </div>
                    <MoreVertical className="w-3.5 h-3.5 text-[#000033]/40" />
                  </div>

                  <div className="flex-1 overflow-y-auto bg-[#000033]/[0.02] border-2 border-t-0 border-[#000033]/10 rounded-b-xl p-2 space-y-3 min-h-[400px]">
                    {macro.id === 'FINALIZADO' && !expandedFinalizados ? (
                      <div
                        onClick={() => setExpandedFinalizados(true)}
                        className="flex-grow flex flex-col items-center justify-center py-16 text-center bg-[#00ff99]/[0.02] hover:bg-[#00ff99]/5 border-2 border-dashed border-[#00ff99]/20 hover:border-[#00ff99]/40 rounded-xl cursor-pointer transition-all m-1 min-h-[320px]"
                      >
                        <Archive className="w-8 h-8 text-[#000033]/30 mb-2" />
                        <p className="text-xs font-bold text-[#000033] mb-1">
                          Ver finalizadas ({countMacro('FINALIZADO')})
                        </p>
                        <p className="text-[10px] text-[#000033]/45 max-w-[200px] px-3 leading-relaxed">
                          Haz clic para desplegar las tareas de los últimos 30 días
                        </p>
                      </div>
                    ) : (
                      <>
                        {macro.id === 'FINALIZADO' && (
                          <div className="sticky top-0 left-0 right-0 pb-3 pt-1 bg-gradient-to-b from-[#fafafa] via-[#fafafa]/90 to-transparent text-center z-[2]">
                            <button
                              onClick={(e) => { e.stopPropagation(); setExpandedFinalizados(false); }}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-white hover:bg-gray-50 border border-[#000033]/20 shadow-sm rounded-full text-[10px] font-bold text-[#000033]/70 hover:text-[#000033] transition-all"
                            >
                              Colapsar columna ↑
                            </button>
                          </div>
                        )}
                        {subsDeMacro(macro.id).map((subDef, si) => {
                          const tickets = ticketsDeSub(subDef.sub);
                          return (
                            <div
                              key={subDef.sub}
                              onDragOver={e => e.preventDefault()}
                              onDrop={(e) => { e.stopPropagation(); handleDrop(subDef.sub); }}
                              className="rounded-lg"
                            >
                              {si > 0 && <div className="border-t border-[#000033]/[0.07] my-3" />}
                              <div className="flex items-center justify-between px-1 mb-1.5">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded border ${subDef.chip}`}>
                                  {subDef.label}
                                </span>
                                <span className="text-[10px] font-bold text-[#000033]/40">{tickets.length}</span>
                              </div>
                              <div className="space-y-2 min-h-[8px]">
                                {tickets.length === 0 ? (
                                  <EmptySlot />
                                ) : (
                                  tickets.map(ticket => (
                                    <TicketCard
                                      key={ticket.id}
                                      ticket={ticket}
                                      isDragging={draggedId === ticket.id}
                                      onDragStart={() => setDraggedId(ticket.id)}
                                      onDragEnd={() => setDraggedId(null)}
                                      onClick={() => setSelectedTicket(ticket)}
                                    />
                                  ))
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}

                    {macro.id === 'BACKLOG' && (
                      <button
                        onClick={() => setShowModalNueva(true)}
                        className="w-full py-2 border-2 border-dashed border-[#000033]/20 rounded-lg text-xs font-bold text-[#000033]/40 hover:border-[#024fff]/40 hover:text-[#024fff] hover:bg-[#024fff]/5 transition-all"
                      >
                        + Nuevo ticket
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── VIEW 2: Estado + Expandida (9 flat sub-state columns) ── */}
          {agruparPor === 'Estado' && densidad === 'Expandida' && (
            <div className="flex gap-3 p-4 h-full min-w-max">
              {PRENSA_SUBESTADOS.map(subDef => {
                const tickets = ticketsDeSub(subDef.sub);
                return (
                  <div
                    key={subDef.sub}
                    className="flex flex-col w-[260px] flex-shrink-0"
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => handleDrop(subDef.sub)}
                  >
                    <div className={`bg-white border-2 rounded-t-xl px-3 py-2 flex items-center justify-between border-[#000033]/15`}>
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded border ${subDef.chip}`}>
                          {subDef.label}
                        </span>
                        <span className="text-xs font-bold text-[#000033]/60 bg-white/60 px-1.5 py-0.5 rounded-full">
                          {tickets.length}
                        </span>
                      </div>
                      <MoreVertical className="w-3.5 h-3.5 text-[#000033]/40" />
                    </div>

                    <div className="flex-1 overflow-y-auto bg-[#000033]/[0.02] border-2 border-t-0 border-[#000033]/10 rounded-b-xl p-2 space-y-2 min-h-[400px]">
                      {subDef.macro === 'FINALIZADO' && !expandedFinalizados ? (
                        <div
                          onClick={() => setExpandedFinalizados(true)}
                          className="flex-1 flex flex-col items-center justify-center py-12 text-center bg-[#00ff99]/[0.02] hover:bg-[#00ff99]/5 border-2 border-dashed border-[#00ff99]/20 hover:border-[#00ff99]/40 rounded-xl cursor-pointer transition-all h-full min-h-[320px]"
                        >
                          <Archive className="w-8 h-8 text-[#000033]/30 mb-2" />
                          <p className="text-xs font-bold text-[#000033] mb-1">
                            Ver finalizadas ({tickets.length})
                          </p>
                          <p className="text-[10px] text-[#000033]/45 px-2">
                            Haz clic para desplegar las tareas de los últimos 30 días
                          </p>
                        </div>
                      ) : (
                        <>
                          {subDef.macro === 'FINALIZADO' && (
                            <div className="sticky top-0 left-0 right-0 pb-3 pt-1 bg-gradient-to-b from-[#fafafa] via-[#fafafa]/90 to-transparent text-center z-[2]">
                              <button
                                onClick={(e) => { e.stopPropagation(); setExpandedFinalizados(false); }}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-white hover:bg-gray-50 border border-[#000033]/20 shadow-sm rounded-full text-[10px] font-bold text-[#000033]/70 hover:text-[#000033] transition-all"
                              >
                                Colapsar columna ↑
                              </button>
                            </div>
                          )}
                          {tickets.length === 0 ? (
                            <div className="py-6 text-center text-xs text-[#000033]/30 font-medium">
                              Sin tickets
                            </div>
                          ) : (
                            tickets.map(ticket => (
                              <TicketCard
                                key={ticket.id}
                                ticket={ticket}
                                isDragging={draggedId === ticket.id}
                                onDragStart={() => setDraggedId(ticket.id)}
                                onDragEnd={() => setDraggedId(null)}
                                onClick={() => setSelectedTicket(ticket)}
                              />
                            ))
                          )}
                        </>
                      )}

                      {subDef.sub === 'PENDIENTE' && (
                        <button
                          onClick={() => setShowModalNueva(true)}
                          className="w-full py-2 border-2 border-dashed border-[#000033]/20 rounded-lg text-xs font-bold text-[#000033]/40 hover:border-[#024fff]/40 hover:text-[#024fff] hover:bg-[#024fff]/5 transition-all"
                        >
                          + Nuevo ticket
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── VIEW 3: Cliente + Compacta (Collapsible list, 4 macro columns) ── */}
          {agruparPor === 'Cliente' && densidad === 'Compacta' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 h-full">
              {getClientesList().map(cliente => {
                const clienteTickets = getTicketsDeCliente(cliente.id);
                const isExpanded = expandedClientes.has(cliente.name);
                return (
                  <div key={cliente.id} className="space-y-2">
                    <ClienteHeader
                      nombre={cliente.name}
                      count={clienteTickets.length}
                      expanded={isExpanded}
                      onToggle={() => toggleExpandedCliente(cliente.name)}
                    />
                    {isExpanded && (
                      <div className="mt-3 ml-2 flex gap-3 w-full pb-2 overflow-x-auto">
                        {MACROS.map(macro => (
                          <div
                            key={macro.id}
                            className="flex flex-col flex-1 min-w-[200px]"
                            onDragOver={e => e.preventDefault()}
                            onDrop={() => handleDrop(MACRO_DEFAULT_SUB[macro.id])}
                          >
                            <div className={`${macro.color} border-2 ${macro.border} rounded-t-xl px-3 py-2 flex items-center justify-between`}>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-[#000033]">{macro.label}</span>
                      <span className="text-[10px] font-bold text-[#000033]/50 bg-white/60 px-1.5 py-0.5 rounded-full">
                                  {countMacro(macro.id, clienteTickets)}
                                </span>
                              </div>
                            </div>
                            <div className="flex-1 bg-[#000033]/[0.02] border-2 border-t-0 border-[#000033]/10 rounded-b-xl p-2 space-y-3 relative overflow-y-auto max-h-[400px]">
                              {macro.id === 'FINALIZADO' && !expandedFinalizados ? (
                                <div
                                  onClick={() => setExpandedFinalizados(true)}
                                  className="flex flex-col items-center justify-center py-8 text-center bg-[#00ff99]/[0.02] hover:bg-[#00ff99]/5 border-2 border-dashed border-[#00ff99]/20 hover:border-[#00ff99]/40 rounded-xl cursor-pointer transition-all m-1"
                                >
                                  <Archive className="w-6 h-6 text-[#000033]/30 mb-1" />
                                  <p className="text-[10px] font-bold text-[#000033] mb-1">
                                    Ver finalizadas ({countMacro('FINALIZADO', clienteTickets)})
                                  </p>
                                  <p className="text-[9px] text-[#000033]/40">Haz clic para ver</p>
                                </div>
                              ) : (
                                <>
                                  {macro.id === 'FINALIZADO' && (
                                    <div className="sticky top-0 left-0 right-0 pb-2.5 pt-0.5 bg-gradient-to-b from-white via-white/90 to-transparent text-center z-[2]">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setExpandedFinalizados(false); }}
                                        className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-white hover:bg-gray-50 border border-[#000033]/15 shadow-sm rounded-full text-[9px] font-bold text-[#000033]/70 hover:text-[#000033] transition-all"
                                      >
                                        Colapsar ↑
                                      </button>
                                    </div>
                                  )}
                                  {subsDeMacro(macro.id).map((subDef, si) => {
                                    const tickets = ticketsDeSub(subDef.sub, clienteTickets);
                                    return (
                                      <div
                                        key={subDef.sub}
                                        onDragOver={e => e.preventDefault()}
                                        onDrop={(e) => { e.stopPropagation(); handleDrop(subDef.sub); }}
                                      >
                                        {si > 0 && <div className="border-t border-[#000033]/[0.07] my-2" />}
                                        <div className="flex items-center justify-between mb-1">
                                          <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold rounded border ${subDef.chip}`}>
                                            {subDef.label}
                                          </span>
                                          <span className="text-[9px] font-bold text-[#000033]/30">{tickets.length}</span>
                                        </div>
                                        <div className="space-y-2 min-h-[8px]">
                                          {tickets.length === 0 ? (
                                            <EmptySlot />
                                          ) : (
                                            tickets.map(ticket => (
                                              <TicketCard
                                                key={ticket.id}
                                                ticket={ticket}
                                                isDragging={draggedId === ticket.id}
                                                onDragStart={() => setDraggedId(ticket.id)}
                                                onDragEnd={() => setDraggedId(null)}
                                                onClick={() => setSelectedTicket(ticket)}
                                              />
                                            ))
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── VIEW 4: Cliente + Expandida (Collapsible list, 9 flat columns) ── */}
          {agruparPor === 'Cliente' && densidad === 'Expandida' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 h-full">
              {getClientesList().map(cliente => {
                const clienteTickets = getTicketsDeCliente(cliente.id);
                const isExpanded = expandedClientes.has(cliente.name);
                return (
                  <div key={cliente.id} className="space-y-2">
                    <ClienteHeader
                      nombre={cliente.name}
                      count={clienteTickets.length}
                      expanded={isExpanded}
                      onToggle={() => toggleExpandedCliente(cliente.name)}
                    />
                    {isExpanded && (
                      <div className="mt-3 ml-2 overflow-x-auto pb-2">
                        <div className="flex gap-3 min-w-max">
                          {PRENSA_SUBESTADOS.map(subDef => {
                            const tickets = ticketsDeSub(subDef.sub, clienteTickets);
                            return (
                              <div
                                key={subDef.sub}
                                className="flex-shrink-0 w-[220px] flex flex-col"
                                onDragOver={e => e.preventDefault()}
                                onDrop={() => handleDrop(subDef.sub)}
                              >
                                <div className="bg-white border-2 border-[#000033]/15 rounded-t-xl px-2.5 py-1.5 flex items-center justify-between">
                                  <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold rounded border ${subDef.chip}`}>
                                    {subDef.label}
                                  </span>
                                  <span className="text-[10px] font-bold text-[#000033]/50 bg-white/60 px-1.5 py-0.5 rounded-full">
                                    {tickets.length}
                                  </span>
                                </div>
                                <div className="flex-1 bg-[#000033]/[0.02] border-2 border-t-0 border-[#000033]/10 rounded-b-xl p-2 space-y-2 relative overflow-y-auto max-h-[300px]">
                                  {subDef.macro === 'FINALIZADO' && !expandedFinalizados ? (
                                    <div
                                      onClick={() => setExpandedFinalizados(true)}
                                      className="flex flex-col items-center justify-center py-6 text-center h-full min-h-[120px] bg-[#00ff99]/[0.02] hover:bg-[#00ff99]/5 border-2 border-dashed border-[#00ff99]/20 hover:border-[#00ff99]/40 rounded-xl cursor-pointer transition-all m-1"
                                    >
                                      <Archive className="w-5 h-5 text-[#000033]/30 mb-1" />
                                      <span className="text-[10px] font-bold text-[#000033]">
                                        Desplegar ({tickets.length})
                                      </span>
                                    </div>
                                  ) : (
                                    <>
                                      {subDef.macro === 'FINALIZADO' && (
                                        <div className="sticky top-0 left-0 right-0 pb-2 pt-0.5 bg-gradient-to-b from-white via-white/90 to-transparent text-center z-[2]">
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setExpandedFinalizados(false); }}
                                            className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-white hover:bg-gray-50 border border-[#000033]/15 shadow-sm rounded-full text-[9px] font-bold text-[#000033]/70 hover:text-[#000033] transition-all"
                                          >
                                            Colapsar ↑
                                          </button>
                                        </div>
                                      )}
                                      {tickets.length === 0 ? (
                                        <EmptySlot />
                                      ) : (
                                        tickets.map(ticket => (
                                          <TicketCard
                                            key={ticket.id}
                                            ticket={ticket}
                                            isDragging={draggedId === ticket.id}
                                            onDragStart={() => setDraggedId(ticket.id)}
                                            onDragEnd={() => setDraggedId(null)}
                                            onClick={() => setSelectedTicket(ticket)}
                                          />
                                        ))
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* Footer */}
      <div className="bg-white border-t-2 border-[#000033]/10 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between text-xs text-[#000033]/60">
          <span>{PRENSA_SUBESTADOS.length} subestados · {MACROS.length} columnas consolidadas</span>
          <span>{ticketsFiltrados.length} tickets de prensa en total</span>
        </div>
      </div>

      <CreateTicketModal
        isOpen={showModalNueva || !!selectedTicket}
        area="PRENSA"
        ticket={selectedTicket as any}
        onClose={() => { setShowModalNueva(false); setSelectedTicket(null); }}
      />

      <HistorialPrensaModal
        isOpen={showHistorialModal}
        onClose={() => setShowHistorialModal(false)}
        tickets={allTickets.filter(t => t.subEstado === 'LISTO' || t.subEstado === 'CANCELADO')}
        onSelectTicket={(t) => setSelectedTicket(t)}
      />
    </div>
  );
}

// ── Historial Prensa Modal ───────────────────────────────────────────────────

function HistorialPrensaModal({
  isOpen,
  onClose,
  tickets,
  onSelectTicket,
}: {
  isOpen: boolean;
  onClose: () => void;
  tickets: Ticket[];
  onSelectTicket: (t: Ticket) => void;
}) {
  const [query, setQuery] = useState('');
  
  if (!isOpen) return null;

  const filtered = tickets.filter(t => {
    const q = query.toLowerCase();
    return t.title.toLowerCase().includes(q)
      || t.client.name.toLowerCase().includes(q)
      || (t.medio?.toLowerCase().includes(q) ?? false)
      || (t.periodista?.toLowerCase().includes(q) ?? false);
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-[#000033]/10 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-[#000033]">Historial de Tareas Finalizadas</h2>
            <p className="text-xs text-[#000033]/55 mt-0.5">Todas las tareas completadas o canceladas de prensa</p>
          </div>
          <button onClick={onClose} className="text-[#000033]/40 hover:text-[#000033] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-[#000033]/10 bg-[#fafafa] flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#000033]/40" />
            <input
              type="text"
              placeholder="Buscar por título, cliente, medio..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border-2 border-[#000033]/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033] bg-white"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-[#000033]/40 text-sm">
              No se encontraron tareas finalizadas.
            </div>
          ) : (
            filtered.map(t => (
              <div
                key={t.id}
                onClick={() => { onSelectTicket(t); onClose(); }}
                className="bg-white border-2 border-[#000033]/10 rounded-xl p-4 hover:border-[#024fff]/40 cursor-pointer hover:shadow transition-all flex items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-[#024fff] bg-[#024fff]/10 px-2 py-0.5 rounded border border-[#024fff]/20">
                      {t.client.name}
                    </span>
                    {t.ticketType && (
                      <span className="text-[10px] font-medium text-violet-700 bg-violet-50 px-2 py-0.5 rounded border border-violet-100">
                        {t.ticketType.name}
                      </span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      t.subEstado === 'LISTO' 
                        ? 'bg-[#00ff99]/20 text-[#000033] border-[#00ff99]/40' 
                        : 'bg-[#000033]/5 text-[#000033]/50 border-[#000033]/15'
                    }`}>
                      {t.subEstado === 'LISTO' ? 'Completado' : 'Cancelado'}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-[#000033] leading-snug truncate">
                    {t.title}
                  </h3>
                  {(t.medio || t.periodista) && (
                    <p className="text-[10px] text-[#000033]/60 mt-1 font-medium flex items-center gap-1">
                      <Mail className="w-2.5 h-2.5" />
                      {t.medio} {t.periodista ? `· ${t.periodista}` : ''}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0 text-[10px] text-[#000033]/45 font-medium">
                  <p>Finalizado:</p>
                  <p className="font-semibold text-[#000033]/65">
                    {new Date(t.updatedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-6 py-4 border-t-2 border-[#000033]/10 bg-[#fafafa] flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border-2 border-[#000033]/10 rounded-lg text-[#000033] font-medium hover:bg-[#000033]/5 transition-all text-xs"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function TicketCard({
  ticket, isDragging, onDragStart, onDragEnd, onClick,
}: {
  ticket: Ticket;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  const esGestionPitch = ticket.ticketType?.name === TIPO_GESTION_PITCH;
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`bg-white border border-[#000033]/[0.08] rounded-lg p-3.5 hover:shadow-md hover:border-violet-200 transition-all cursor-pointer group relative overflow-hidden ${
        isDragging ? 'opacity-40' : ''
      }`}
      style={{ borderLeftWidth: 3, borderLeftColor: '#7C3AED' }}
    >
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="text-[10px] font-bold text-[#024fff]/70 truncate max-w-[90px]">
          {ticket.client.name}
        </span>
        <span className="text-[10px] font-medium text-[#000033]/40">·</span>
        {ticket.ticketType && (
          <span className="inline-flex items-center px-1.5 py-0.5 bg-violet-50 text-violet-700 text-[10px] font-bold rounded flex-shrink-0">
            {ticket.ticketType.name}
          </span>
        )}
        <button
          type="button"
          className="ml-auto text-[#000033]/15 hover:text-[#000033]/50 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-xs font-medium text-[#000033] mb-3 leading-snug line-clamp-2">
        {ticket.title}
      </p>

      {esGestionPitch && (ticket.medio || ticket.periodista || ticket.estadoRespuesta) && (
        <div className="flex items-center flex-wrap gap-1.5 mb-3 pb-2 border-b border-[#000033]/10">
          {(ticket.medio || ticket.periodista) && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#000033]/60 truncate max-w-[150px]">
              <Mail className="w-2.5 h-2.5" />
              {[ticket.medio, ticket.periodista].filter(Boolean).join(' · ')}
            </span>
          )}
          {ticket.estadoRespuesta && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${RESPUESTA_STYLES[ticket.estadoRespuesta] ?? ''}`}>
              {ESTADO_RESPUESTA_LABEL[ticket.estadoRespuesta] ?? ticket.estadoRespuesta}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-violet-50 flex items-center justify-center text-[9px] font-bold text-violet-600 flex-shrink-0">
            {ticket.owner.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-[11px] font-medium text-[#000033]/50 truncate max-w-[70px]">
            {ticket.owner.name.split(' ')[0]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {ticket.dueDate && (
            <div className="flex items-center gap-1 text-[#000033]/35">
              <Calendar className="w-3 h-3" />
              <span className="text-[10px] font-medium">
                {new Date(ticket.dueDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
              </span>
            </div>
          )}
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${PRIORIDAD_STYLES[ticket.prioridad] ?? ''}`}>
            {PRIORIDAD_LABEL[ticket.prioridad] ?? ticket.prioridad}
          </span>
        </div>
      </div>
    </div>
  );
}
