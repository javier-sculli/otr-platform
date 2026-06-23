import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus, Calendar, MoreVertical, ChevronDown, ChevronUp, X, Search, Newspaper, Mail,
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

  const ticketsFiltrados = allTickets.filter(t => {
    if (clientesSeleccionados.length > 0 && !clientesSeleccionados.includes(t.client.id)) return false;
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

  const ticketsDeSub = (sub: SubEstado, items = ticketsFiltrados) =>
    items.filter(t => subOf(t) === sub);

  const countMacro = (macro: GeneralStatus, items = ticketsFiltrados) =>
    items.filter(t => SUB_DEF[subOf(t)].macro === macro).length;

  const getClientesList = (): Cliente[] => {
    const ids = Array.from(new Set(ticketsFiltrados.map(t => t.client.id)));
    return clientes.filter(c => ids.includes(c.id));
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
          <button
            onClick={() => setShowModalNueva(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#024fff]/10 border-2 border-[#024fff]/30 text-[#024fff] rounded-lg hover:bg-[#024fff]/20 font-bold text-xs transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo
          </button>
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

          {(clientesSeleccionados.length > 0 || busqueda) && (
            <>
              <div className="flex-1" />
              <button
                onClick={() => { setClientesSeleccionados([]); setBusqueda(''); }}
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
            <div className="flex gap-3 p-4 h-full min-w-max">
              {MACROS.map(macro => (
                <div 
                  key={macro.id} 
                  className="flex flex-col w-[280px] flex-shrink-0"
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
                      <div className="mt-3 ml-2 flex gap-3 overflow-x-auto pb-2">
                        {MACROS.map(macro => (
                          <div
                            key={macro.id}
                            className="flex flex-col w-[260px] flex-shrink-0"
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
                            <div className="flex-1 bg-[#000033]/[0.02] border-2 border-t-0 border-[#000033]/10 rounded-b-xl p-2 space-y-3">
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
                                <div className="flex-1 bg-[#000033]/[0.02] border-2 border-t-0 border-[#000033]/10 rounded-b-xl p-2 space-y-2">
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
