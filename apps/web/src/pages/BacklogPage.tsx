import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus, Calendar, ChevronDown, X, Search, FileText, CheckSquare,
} from 'lucide-react';
import { api } from '../lib/api';
import { CreateTicketModal } from '../components/CreateTicketModal';
import { CalendarioBacklog } from '../components/CalendarioBacklog';
import {
  parseLocalDate,
  sortTicketsByOrder,
  calculateDropSortOrder,
  MESES_OFFSETS,
  filtrarMesesValidos,
  getFechaVencimiento,
  esMesManual,
  claveMesManual,
  fechaEnMes,
  etiquetaMes,
} from '../lib/utils';

export interface Ticket {
  id: string;
  title: string;
  objetivo?: string | null;
  canales: string[];
  status: string;
  prioridad: string;
  area?: string;
  dueDate: string | null;
  links: string[];
  linkEntregable?: string | null;
  owner: { id: string; name: string };
  assigneeIds?: string[];
  assignees?: { id: string; name: string }[];
  client: { id: string; name: string };
  ticketType?: { id: string; name: string; kind?: string } | null;
  tipoTicket?: 'CONTENIDO' | 'TAREA' | 'PRENSA';
  tiposContenido?: string[];
  pilarId?: string | null;
  pilar?: { id: string; nombre: string } | null;
  speakerId?: string | null;
  speaker?: { id: string; nombre: string; role?: string } | null;
  sortOrder?: number | null;
}

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface Cliente {
  id: string;
  name: string;
}

// ─── Grupos para Vista Compacta ───────────────────────────────────────────────
const GRUPOS_COMPACTA = [
  {
    id: 'POR_HACER',
    name: 'Por hacer',
    color: '#8c96a3',
    estados: ['PENDIENTE'] as const,
    sub: 'Pendiente',
    defaultEstado: 'PENDIENTE',
  },
  {
    id: 'EN_PRODUCCION',
    name: 'En producción',
    color: '#024fff',
    estados: ['REDACCION', 'DISENO', 'EDICION'] as const,
    sub: 'Redacción · Diseño · Edición',
    defaultEstado: 'REDACCION',
  },
  {
    id: 'EN_REVISION',
    name: 'En revisión',
    color: '#00e39c',
    estados: ['REVISION_INTERNA', 'CLIENTE', 'ESPERANDO_FEEDBACK'] as const,
    sub: 'Revisión Interna · Cliente · Esperando feedback',
    defaultEstado: 'REVISION_INTERNA',
  },
  {
    id: 'LISTO',
    name: 'Listo',
    color: '#00a372',
    estados: ['LISTO_PARA_PUBLICAR', 'PUBLICADO', 'LISTO'] as const,
    sub: 'Listo para publicar · Publicado',
    defaultEstado: 'PUBLICADO',
  },
] as const;

// ─── Columnas para Vista Completa (11 estados individuales) ───────────────────
const COLUMNAS_COMPLETA = [
  { id: 'PENDIENTE',           nombre: 'Pendiente',            color: '#8c96a3' },
  { id: 'REDACCION',           nombre: 'Redacción',            color: '#024fff' },
  { id: 'DISENO',              nombre: 'Diseño',               color: '#024fff' },
  { id: 'EDICION',             nombre: 'Edición',              color: '#024fff' },
  { id: 'REVISION_INTERNA',    nombre: 'Revisión Interna',     color: '#00e39c' },
  { id: 'CLIENTE',             nombre: 'Cliente',              color: '#00e39c' },
  { id: 'ESPERANDO_FEEDBACK',  nombre: 'Esperando feedback',   color: '#00e39c' },
  { id: 'LISTO_PARA_PUBLICAR', nombre: 'Listo para publicar',  color: '#00a372' },
  { id: 'PUBLICADO',           nombre: 'Publicado',            color: '#00a372' },
  { id: 'CANCELADO',           nombre: 'Stand-by / Cancelados',color: '#b9c2cd' },
  { id: 'LISTO',               nombre: 'Listo (archivado)',    color: '#00a372' },
] as const;

const PRIORIDAD_CONFIG: Record<string, { label: string; dot: string; bg: string }> = {
  ALTA:  { label: 'Alta',  dot: '#ff9e22', bg: 'rgba(255,158,34,0.16)' },
  MEDIA: { label: 'Media', dot: '#00e39c', bg: 'rgba(0,227,156,0.16)' },
  BAJA:  { label: 'Baja',  dot: '#8c96a3', bg: '#eef3f7' },
};

const loadSavedBacklogFilters = () => {
  try {
    const saved = sessionStorage.getItem('backlog_filters');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return null;
};

export function BacklogPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const savedFilters = useRef(loadSavedBacklogFilters()).current;
  const preferredIds = user?.preferredClientIds ?? [];

  const urlClientId = searchParams.get('clientId');

  // Vistas: 'compacta' | 'completa' | 'calendario'
  const [vista, setVista] = useState<'compacta' | 'completa' | 'calendario'>(() => {
    const v = savedFilters?.vista;
    if (v === 'calendario' || v === 'completa') return v;
    return 'compacta';
  });

  const [clientesSeleccionados, setClientesSeleccionados] = useState<string[]>(() => {
    if (urlClientId) return [urlClientId];
    if (savedFilters && Array.isArray(savedFilters.clientesSeleccionados)) {
      return savedFilters.clientesSeleccionados;
    }
    return [];
  });
  const [mostrarTodosClientes, setMostrarTodosClientes] = useState<boolean>(() =>
    urlClientId ? true : (savedFilters?.mostrarTodosClientes ?? false)
  );
  const [showDropdownClientes, setShowDropdownClientes] = useState(false);

  const [vocerosSeleccionados, setVocerosSeleccionados] = useState<string[]>(() =>
    urlClientId ? [] : (savedFilters?.vocerosSeleccionados ?? [])
  );
  const [marcaSinVocero, setMarcaSinVocero] = useState<boolean>(() =>
    urlClientId ? false : (savedFilters?.marcaSinVocero ?? false)
  );
  const [showDropdownVoceros, setShowDropdownVoceros] = useState(false);

  const [mesesSeleccionados, setMesesSeleccionados] = useState<string[]>(() =>
    urlClientId ? [] : filtrarMesesValidos(savedFilters?.mesesSeleccionados ?? [])
  );
  const [showDropdownMeses, setShowDropdownMeses] = useState(false);

  const [soloMios, setSoloMios] = useState<boolean>(() =>
    urlClientId ? false : (savedFilters?.soloMios ?? false)
  );
  const [soloVencidos, setSoloVencidos] = useState<boolean>(() =>
    urlClientId ? false : (savedFilters?.soloVencidos ?? false)
  );
  const [busqueda, setBusqueda] = useState<string>(() =>
    urlClientId ? '' : (savedFilters?.busqueda ?? '')
  );
  const [qCliente, setQCliente] = useState('');

  // Si cambia el clientId por URL (ej. desde Clientes -> Ver Backlog), sincronizar y limpiar filtros secundarios
  useEffect(() => {
    if (!urlClientId) return;
    setClientesSeleccionados([urlClientId]);
    setMostrarTodosClientes(true);
    setVocerosSeleccionados([]);
    setMarcaSinVocero(false);
    setMesesSeleccionados([]);
    setSoloMios(false);
    setSoloVencidos(false);
    setBusqueda('');
  }, [urlClientId]);

  const [showModalNueva, setShowModalNueva] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  // Drag and Drop state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);
  const draggedIdRef = useRef<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    ticketId: string;
    position: 'before' | 'after';
    colId: string;
  } | null>(null);
  const dropTargetRef = useRef<{
    ticketId: string;
    position: 'before' | 'after';
    colId: string;
  } | null>(null);

  // Dropdown container refs for outside click
  const clientMenuRef = useRef<HTMLDivElement>(null);
  const voceroMenuRef = useRef<HTMLDivElement>(null);
  const mesMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (clientMenuRef.current && !clientMenuRef.current.contains(target)) {
        setShowDropdownClientes(false);
      }
      if (voceroMenuRef.current && !voceroMenuRef.current.contains(target)) {
        setShowDropdownVoceros(false);
      }
      if (mesMenuRef.current && !mesMenuRef.current.contains(target)) {
        setShowDropdownMeses(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const queryTicketId = searchParams.get('ticketId');

  const effectiveClientIds = useMemo(() => {
    if (clientesSeleccionados.length > 0) return clientesSeleccionados;
    if (mostrarTodosClientes) return [];
    return preferredIds;
  }, [clientesSeleccionados, preferredIds, mostrarTodosClientes]);

  useEffect(() => {
    sessionStorage.setItem('backlog_filters', JSON.stringify({
      clientesSeleccionados,
      mostrarTodosClientes,
      vocerosSeleccionados,
      marcaSinVocero,
      mesesSeleccionados,
      soloMios,
      soloVencidos,
      busqueda,
      vista,
    }));
  }, [
    clientesSeleccionados,
    mostrarTodosClientes,
    vocerosSeleccionados,
    marcaSinVocero,
    mesesSeleccionados,
    soloMios,
    soloVencidos,
    busqueda,
    vista,
  ]);

  const { data: ticketsData, isLoading } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => api.getTickets(),
  });

  const { data: clientesData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.getClients(),
  });

  const allTickets: Ticket[] = ticketsData?.data ?? [];
  const clientes: Cliente[] = clientesData?.data ?? [];

  // Sync ticketId from URL query param to open modal (deep linking / back/forward)
  useEffect(() => {
    if (!queryTicketId) {
      if (selectedTicket) setSelectedTicket(null);
      return;
    }

    const found = allTickets.find(t => t.id === queryTicketId);
    if (found) {
      setSelectedTicket(found);
    } else if (!selectedTicket || selectedTicket.id !== queryTicketId) {
      Promise.resolve(api.getTicket(queryTicketId))
        .then(res => {
          if (res?.data) setSelectedTicket(res.data);
        })
        .catch(err => {
          console.error('Error fetching ticket from URL param:', err);
        });
    }
  }, [queryTicketId, allTickets]);

  const handleOpenTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('ticketId', ticket.id);
      return next;
    }, { replace: true });
  };

  const handleCloseModal = () => {
    setShowModalNueva(false);
    setSelectedTicket(null);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('ticketId');
      return next;
    }, { replace: true });
  };

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, sortOrder }: { id: string; status?: string; sortOrder?: number }) => {
      const payload: { status?: string; sortOrder?: number } = {};
      if (status !== undefined) payload.status = status;
      if (sortOrder !== undefined) payload.sortOrder = sortOrder;
      return api.updateTicket(id, payload);
    },
    onMutate: async ({ id, status, sortOrder }) => {
      await queryClient.cancelQueries({ queryKey: ['tickets'] });
      await queryClient.cancelQueries({ queryKey: ['ticket', id] });
      const prevTickets = queryClient.getQueryData(['tickets']);
      const prevTicket = queryClient.getQueryData(['ticket', id]);

      queryClient.setQueryData(['tickets'], (old: any) => {
        if (!old) return old;
        const updater = (t: Ticket) =>
          t.id === id
            ? {
                ...t,
                ...(status !== undefined ? { status } : {}),
                ...(sortOrder !== undefined ? { sortOrder } : {}),
              }
            : t;
        if (Array.isArray(old)) return old.map(updater);
        return {
          ...old,
          data: old.data?.map(updater) ?? [],
        };
      });

      queryClient.setQueryData(['ticket', id], (old: any) => {
        const prevData = old?.data || allTickets.find(t => t.id === id) || { id };
        return {
          ...old,
          data: {
            ...prevData,
            ...(status !== undefined ? { status } : {}),
            ...(sortOrder !== undefined ? { sortOrder } : {}),
          },
        };
      });

      return { prevTickets, prevTicket };
    },
    onSuccess: (res, vars) => {
      if (res?.data) {
        queryClient.setQueryData(['tickets'], (old: any) => {
          if (!old) return old;
          if (Array.isArray(old)) {
            return old.map((t: Ticket) => (t.id === vars.id ? { ...t, ...res.data } : t));
          }
          return {
            ...old,
            data: old.data?.map((t: Ticket) => (t.id === vars.id ? { ...t, ...res.data } : t)) ?? [],
          };
        });
        queryClient.setQueryData(['ticket', vars.id], (old: any) => {
          if (!old?.data) return old;
          return { ...old, data: { ...old.data, ...res.data } };
        });
      }
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prevTickets) queryClient.setQueryData(['tickets'], ctx.prevTickets);
      if (ctx?.prevTicket) queryClient.setQueryData(['ticket', vars.id], ctx.prevTicket);
    },
    onSettled: (_data, _error, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      if (vars?.id) queryClient.invalidateQueries({ queryKey: ['ticket', vars.id] });
    },
  });

  const ahora = new Date();
  const hoyStart = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

  // Lista de meses cronológica: 1 (anterior), 0 (actual), -1 (próximo mes)
  const listaMeses = MESES_OFFSETS.map(offset => {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - offset, 1);
    const key = `mes_${offset}`;
    const labelRaw = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const label = labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1);
    const inicio = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    return { key, label, inicio, fin, offset, esActual: offset === 0 };
  });

  const toggleMes = (key: string) => {
    setMesesSeleccionados(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Meses elegidos a mano ("Otro mes"), en orden cronológico
  const mesesManuales = mesesSeleccionados.filter(esMesManual).sort();

  const [otroMes, setOtroMes] = useState(() => ahora.getMonth());
  const [otroAnio, setOtroAnio] = useState(() => ahora.getFullYear());
  const aniosDisponibles = [-2, -1, 0, 1].map(d => ahora.getFullYear() + d);

  const agregarOtroMes = () => {
    // Si coincide con un acceso rápido (anterior/actual/próximo), se marca ese en lugar de duplicarlo
    const rapido = listaMeses.find(m => m.inicio.getFullYear() === otroAnio && m.inicio.getMonth() === otroMes);
    const key = rapido ? rapido.key : claveMesManual(otroAnio, otroMes);
    setMesesSeleccionados(prev => (prev.includes(key) ? prev : [...prev, key]));
  };

  // Helper check ticket overdue
  const checkVencido = (t: Ticket) => {
    if (t.status === 'PUBLICADO' || t.status === 'LISTO' || t.status === 'CANCELADO') return false;
    const dateToUse = getFechaVencimiento(t as any);
    if (!dateToUse) return false;
    const d = parseLocalDate(dateToUse);
    if (!d) return false;
    d.setHours(0, 0, 0, 0);
    return d < hoyStart;
  };

  // Conteo total vencidos en la cartera activa
  const totalVencidosCount = useMemo(() => {
    return allTickets.filter(t => {
      if (t.area === 'PRENSA') return false;
      if (effectiveClientIds.length > 0 && !effectiveClientIds.includes(t.client.id)) return false;
      return checkVencido(t);
    }).length;
  }, [allTickets, effectiveClientIds]);

  // Lista de voceros según clientes efectivos
  const ticketsParaVoceros = effectiveClientIds.length > 0
    ? allTickets.filter(t => effectiveClientIds.includes(t.client.id))
    : allTickets;

  const vocerosPorCliente = useMemo(() => {
    const map = new Map<string, { cliente: string; items: { id: string; name: string; role?: string }[] }>();
    ticketsParaVoceros.forEach(t => {
      if (t.speaker) {
        const cId = t.client.id;
        if (!map.has(cId)) {
          map.set(cId, { cliente: t.client.name, items: [] });
        }
        const group = map.get(cId)!;
        if (!group.items.some(v => v.id === t.speaker!.id)) {
          group.items.push({
            id: t.speaker.id,
            name: t.speaker.nombre,
            role: (t.speaker as any).role || (t.speaker as any).headline,
          });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.cliente.localeCompare(b.cliente));
  }, [ticketsParaVoceros]);

  // Limpiar voceros seleccionados que no pertenezcan a los clientes efectivos actuales
  useEffect(() => {
    if (isLoading || !ticketsData) return;
    if (vocerosSeleccionados.length === 0) return;
    const validIds = new Set(vocerosPorCliente.flatMap(g => g.items.map(v => v.id)));
    const filtered = vocerosSeleccionados.filter(id => validIds.has(id));
    if (filtered.length !== vocerosSeleccionados.length) {
      setVocerosSeleccionados(filtered);
    }
  }, [vocerosPorCliente, vocerosSeleccionados, isLoading, ticketsData]);

  // Filtrado de tickets
  const ticketsFiltrados = useMemo(() => {
    return allTickets.filter(t => {
      if (t.area === 'PRENSA') return false;
      if (effectiveClientIds.length > 0 && !effectiveClientIds.includes(t.client.id)) return false;

      // Filtro vocero o marca
      if (vocerosSeleccionados.length > 0 || marcaSinVocero) {
        const matchesVocero = t.speaker && vocerosSeleccionados.includes(t.speaker.id);
        const matchesMarca = marcaSinVocero && !t.speaker;
        if (!matchesVocero && !matchesMarca) return false;
      }

      // Filtro mis tickets
      if (soloMios) {
        const isMine = t.owner.id === user?.id || (t.assigneeIds && t.assigneeIds.includes(user?.id || ''));
        if (!isMine) return false;
      }

      // Filtro vencidos
      if (soloVencidos && !checkVencido(t)) return false;

      // Filtro de meses (misma fecha que "Vencidos")
      if (mesesSeleccionados.length > 0) {
        const dateToUse = getFechaVencimiento(t as any);
        if (dateToUse) {
          const due = parseLocalDate(dateToUse);
          if (due) {
            const matchesAnyMonth = mesesSeleccionados.some(key => fechaEnMes(due, key, ahora));
            if (!matchesAnyMonth) return false;
          }
        }
      }

      // Buscador
      if (busqueda.trim()) {
        const searchLower = busqueda.toLowerCase().trim();
        const titleMatch = t.title.toLowerCase().includes(searchLower);
        const briefMatch = t.objetivo?.toLowerCase().includes(searchLower) ?? false;
        if (!titleMatch && !briefMatch) return false;
      }

      return true;
    });
  }, [allTickets, effectiveClientIds, vocerosSeleccionados, marcaSinVocero, soloMios, soloVencidos, mesesSeleccionados, busqueda, user?.id]);

  const hayFiltrosActivos = (
    busqueda.trim() !== '' ||
    clientesSeleccionados.length > 0 ||
    vocerosSeleccionados.length > 0 ||
    marcaSinVocero ||
    mesesSeleccionados.length > 0 ||
    soloMios ||
    soloVencidos
  );

  const limpiarFiltros = () => {
    setBusqueda('');
    setClientesSeleccionados([]);
    setMostrarTodosClientes(false);
    setVocerosSeleccionados([]);
    setMarcaSinVocero(false);
    setMesesSeleccionados([]);
    setSoloMios(false);
    setSoloVencidos(false);
  };

  // ─── Drag and Drop Handlers ────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, id: string) => {
    draggedIdRef.current = id;
    setDraggedId(id);
    try {
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.setData('text', id);
    } catch {}
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    draggedIdRef.current = null;
    dropTargetRef.current = null;
    setDraggedId(null);
    setDragOverColId(null);
    setDropTarget(null);
  };

  const handleColDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColId !== colId) {
      setDragOverColId(colId);
    }
  };

  const handleCardDragOver = (e: React.DragEvent, targetTicketId: string, colId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    if (dragOverColId !== colId) setDragOverColId(colId);

    const rect = e.currentTarget.getBoundingClientRect();
    const rawClientY = (e as any).clientY ?? (e as any).nativeEvent?.clientY;
    const clientY = typeof rawClientY === 'number' && Number.isFinite(rawClientY) ? rawClientY : rect.top;
    const midY = rect.top + rect.height / 2;
    const position: 'before' | 'after' = clientY < midY ? 'before' : 'after';

    const current = dropTargetRef.current;
    if (
      !current ||
      current.ticketId !== targetTicketId ||
      current.position !== position ||
      current.colId !== colId
    ) {
      const next = { ticketId: targetTicketId, position, colId };
      dropTargetRef.current = next;
      setDropTarget(next);
    }
  };

  const handleColDrop = (e: React.DragEvent, colId: string, isCompactGroup: boolean) => {
    e.preventDefault();
    e.stopPropagation();

    const tId = draggedIdRef.current || e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text');
    if (!tId) {
      handleDragEnd();
      return;
    }

    const draggedTicket = allTickets.find(t => t.id === tId);
    if (!draggedTicket) {
      handleDragEnd();
      return;
    }

    let targetStatus = colId;
    if (isCompactGroup) {
      const grupo = GRUPOS_COMPACTA.find(g => g.id === colId);
      if (grupo) {
        targetStatus = (grupo.estados as readonly string[]).includes(draggedTicket.status)
          ? draggedTicket.status
          : grupo.defaultEstado;
      }
    }

    // Calcular sortOrder
    const target = dropTargetRef.current;
    const columnTickets = sortTicketsByOrder(
      allTickets.filter(t => {
        if (isCompactGroup) {
          const g = GRUPOS_COMPACTA.find(x => x.id === colId);
          return g ? (g.estados as readonly string[]).includes(t.status) : t.status === targetStatus;
        }
        return t.status === targetStatus;
      })
    );

    const newSortOrder = calculateDropSortOrder(
      columnTickets,
      tId,
      target?.colId === colId ? target.ticketId : null,
      target?.colId === colId ? target.position : null
    );

    const payload: { id: string; status?: string; sortOrder?: number } = { id: tId };
    if (draggedTicket.status !== targetStatus) {
      payload.status = targetStatus;
    }
    if (newSortOrder !== null && newSortOrder !== undefined) {
      payload.sortOrder = newSortOrder;
    }

    if (payload.status !== undefined || payload.sortOrder !== undefined) {
      updateStatusMutation.mutate(payload);
    }

    handleDragEnd();
  };

  // Label del dropdown de Clientes
  const clienteDropdownLabel = useMemo(() => {
    if (clientesSeleccionados.length === 1) {
      return clientes.find(c => c.id === clientesSeleccionados[0])?.name || '1 cliente';
    }
    if (clientesSeleccionados.length > 1) {
      return `${clientesSeleccionados.length} clientes`;
    }
    if (preferredIds.length > 0 && !mostrarTodosClientes) {
      return `Mis clientes (${preferredIds.length})`;
    }
    return 'Todos los clientes';
  }, [clientesSeleccionados, clientes, preferredIds, mostrarTodosClientes]);

  // Label del dropdown de Voceros
  const voceroDropdownLabel = useMemo(() => {
    if (marcaSinVocero && vocerosSeleccionados.length === 0) return 'Marca (sin vocero)';
    if (vocerosSeleccionados.length === 1) {
      const vObj = vocerosPorCliente.flatMap(g => g.items).find(v => v.id === vocerosSeleccionados[0]);
      return vObj?.name || '1 vocero';
    }
    if (vocerosSeleccionados.length > 1) {
      return `${vocerosSeleccionados.length} voceros`;
    }
    return 'Todos los voceros';
  }, [marcaSinVocero, vocerosSeleccionados, vocerosPorCliente]);

  // Label del dropdown de Meses
  const mesesDropdownLabel = useMemo(() => {
    if (mesesSeleccionados.length === 1) {
      return etiquetaMes(mesesSeleccionados[0], ahora);
    }
    if (mesesSeleccionados.length > 1) {
      return `${mesesSeleccionados.length} meses`;
    }
    return 'Todos los meses';
  }, [mesesSeleccionados, listaMeses]);

  // Otros clientes para el dropdown
  const { misClientesList, otrosClientesList } = useMemo(() => {
    const mis = clientes.filter(c => preferredIds.includes(c.id));
    const otros = clientes.filter(c => !preferredIds.includes(c.id));
    const filteredOtros = qCliente.trim()
      ? otros.filter(c => c.name.toLowerCase().includes(qCliente.toLowerCase().trim()))
      : otros;
    return { misClientesList: mis, otrosClientesList: filteredOtros };
  }, [clientes, preferredIds, qCliente]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white text-[#0d0d0d] font-sans">
      {/* ── Barra de vista & Botón Nuevo Ticket ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-6 pt-3 pb-2">
        <div className="rk-seg rk-seg--inline rk-seg--brand" role="group" aria-label="Vista">
          <button
            type="button"
            className="rk-seg__opt"
            aria-pressed={vista === 'compacta'}
            onClick={() => setVista('compacta')}
          >
            Compacta
          </button>
          <button
            type="button"
            className="rk-seg__opt"
            aria-pressed={vista === 'completa'}
            onClick={() => setVista('completa')}
          >
            Completa
          </button>
          <button
            type="button"
            className="rk-seg__opt"
            aria-pressed={vista === 'calendario'}
            onClick={() => setVista('calendario')}
          >
            Calendario
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowModalNueva(true)}
          className="rk-btn rk-btn--primary rk-btn--sm shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Nuevo ticket
        </button>
      </div>

      {/* ── Barra de Filtros ── */}
      <div className="flex items-center gap-2 flex-wrap px-6 pb-3 border-b border-[var(--border)]">
        {/* Buscador */}
        <label className="flex items-center gap-2 w-60 max-w-full h-7 px-3 border border-[var(--border)] rounded-lg bg-white text-[var(--text-subtle)] focus-within:border-[var(--brand)] focus-within:ring-2 focus-within:ring-[var(--brand-tint-hover)]">
          <Search className="w-4 h-4 text-[var(--text-subtle)] flex-shrink-0" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar ticket"
            aria-label="Buscar ticket"
            className="flex-1 min-w-0 border-0 outline-none bg-transparent text-xs text-[#0d0d0d] placeholder:text-[var(--text-subtle)]"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              className="text-[var(--text-subtle)] hover:text-[#0d0d0d]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </label>

        {/* Dropdown Clientes */}
        <div className="relative" ref={clientMenuRef}>
          <button
            type="button"
            className="rk-chip"
            aria-pressed={clientesSeleccionados.length > 0}
            onClick={() => setShowDropdownClientes(prev => !prev)}
          >
            <span className="truncate max-w-[160px]">{clienteDropdownLabel}</span>
            <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
          </button>

          {showDropdownClientes && (
            <div className="rk-menu absolute top-[36px] left-0 z-30 w-72 max-h-96 overflow-y-auto">
              <div className="rk-menu__head">
                <span className="rk-menu-heading">Mis clientes</span>
                <button
                  type="button"
                  onClick={() => {
                    setClientesSeleccionados([]);
                    setMostrarTodosClientes(false);
                    setShowDropdownClientes(false);
                  }}
                  className="rk-btn rk-btn--text text-xs py-0.5"
                >
                  Solo los míos
                </button>
              </div>

              {misClientesList.map(c => {
                const isChecked = clientesSeleccionados.includes(c.id);
                return (
                  <label key={c.id} className="rk-menu__item text-xs">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        setClientesSeleccionados(prev =>
                          isChecked ? prev.filter(id => id !== c.id) : [...prev, c.id]
                        );
                        setMostrarTodosClientes(true);
                      }}
                    />
                    <span className="truncate">{c.name}</span>
                  </label>
                );
              })}

              <div className="rk-menu__head mt-2 pt-2 border-t border-[var(--surface-muted)]">
                <span className="rk-menu-heading">Otros clientes</span>
                <button
                  type="button"
                  onClick={() => {
                    setClientesSeleccionados([]);
                    setMostrarTodosClientes(true);
                    setShowDropdownClientes(false);
                  }}
                  className="rk-btn rk-btn--text text-xs py-0.5"
                >
                  Ver todos
                </button>
              </div>

              <div className="px-2 pb-1">
                <input
                  type="text"
                  value={qCliente}
                  onChange={e => setQCliente(e.target.value)}
                  placeholder="Buscar cliente…"
                  className="w-full h-8 px-2 text-xs border border-[var(--border)] rounded-md outline-none focus:border-[var(--brand)]"
                />
              </div>

              {otrosClientesList.map(c => {
                const isChecked = clientesSeleccionados.includes(c.id);
                return (
                  <label key={c.id} className="rk-menu__item text-xs">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        setClientesSeleccionados(prev =>
                          isChecked ? prev.filter(id => id !== c.id) : [...prev, c.id]
                        );
                        setMostrarTodosClientes(true);
                      }}
                    />
                    <span className="truncate">{c.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Dropdown Voceros */}
        <div className="relative" ref={voceroMenuRef}>
          <button
            type="button"
            className="rk-chip"
            aria-pressed={vocerosSeleccionados.length > 0 || marcaSinVocero}
            onClick={() => setShowDropdownVoceros(prev => !prev)}
          >
            <span className="truncate max-w-[160px]">{voceroDropdownLabel}</span>
            <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
          </button>

          {showDropdownVoceros && (
            <div className="rk-menu absolute top-[36px] left-0 z-30 w-72 max-h-96 overflow-y-auto">
              <div className="rk-menu__head">
                <span className="rk-menu-heading">Voz del contenido</span>
                <button
                  type="button"
                  onClick={() => {
                    setVocerosSeleccionados([]);
                    setMarcaSinVocero(false);
                    setShowDropdownVoceros(false);
                  }}
                  className="rk-btn rk-btn--text text-xs py-0.5"
                >
                  Todos
                </button>
              </div>

              <label className="rk-menu__item text-xs">
                <input
                  type="checkbox"
                  checked={marcaSinVocero}
                  onChange={e => setMarcaSinVocero(e.target.checked)}
                />
                <span>Marca (sin vocero)</span>
              </label>

              {vocerosPorCliente.map(g => (
                <div key={g.cliente}>
                  <span className="rk-menu-heading block mt-2 pt-2 border-t border-[var(--surface-muted)]">
                    {g.cliente}
                  </span>
                  {g.items.map(v => {
                    const isChecked = vocerosSeleccionados.includes(v.id);
                    return (
                      <label key={v.id} className="rk-menu__item text-xs items-start">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setVocerosSeleccionados(prev =>
                              isChecked ? prev.filter(id => id !== v.id) : [...prev, v.id]
                            );
                          }}
                          className="mt-0.5"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold truncate">{v.name}</span>
                          {v.role && <span className="text-[11px] text-[var(--text-muted)] truncate">{v.role}</span>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              ))}

              {vocerosPorCliente.length === 0 && (
                <span className="p-3 text-xs text-[var(--text-subtle)] text-center block">
                  Los clientes elegidos no tienen voceros asignados.
                </span>
              )}
            </div>
          )}
        </div>

        {/* Dropdown Meses */}
        <div className="relative" ref={mesMenuRef}>
          <button
            type="button"
            className="rk-chip"
            aria-pressed={mesesSeleccionados.length > 0}
            onClick={() => setShowDropdownMeses(prev => !prev)}
          >
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate max-w-[140px]">{mesesDropdownLabel}</span>
            <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
          </button>

          {showDropdownMeses && (
            <div className="rk-menu absolute top-[36px] left-0 z-30 w-80">
              <div className="rk-menu__head">
                <span className="rk-menu-heading">Elegí 1 o más meses</span>
                <button
                  type="button"
                  onClick={() => setShowDropdownMeses(false)}
                  className="rk-btn rk-btn--text text-xs py-0.5"
                >
                  Listo
                </button>
              </div>

              {listaMeses.map(m => {
                const isChecked = mesesSeleccionados.includes(m.key);
                return (
                  <label key={m.key} className="rk-menu__item text-xs">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleMes(m.key)}
                    />
                    <span className="truncate">{m.label}</span>
                    {m.esActual && (
                      <span className="ml-auto text-[10px] text-[var(--text-muted)] font-medium">este mes</span>
                    )}
                  </label>
                );
              })}

              {mesesManuales.map(key => (
                <div key={key} className="rk-menu__item text-xs">
                  <input
                    type="checkbox"
                    checked
                    onChange={() => toggleMes(key)}
                    aria-label={`Quitar ${etiquetaMes(key, ahora)}`}
                  />
                  <span className="truncate">{etiquetaMes(key, ahora)}</span>
                  <button
                    type="button"
                    onClick={() => toggleMes(key)}
                    className="ml-auto p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--surface-muted)]"
                    title="Quitar mes"
                    aria-label={`Quitar ${etiquetaMes(key, ahora)}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              <div className="flex items-center gap-1.5 px-2.5 py-2 border-t border-[var(--surface-muted)] mt-1">
                <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">Otro mes</span>
                <select
                  value={otroMes}
                  onChange={e => setOtroMes(Number(e.target.value))}
                  aria-label="Mes"
                  className="h-7 min-w-0 flex-1 px-1.5 text-xs border border-[var(--border)] rounded-md bg-white outline-none focus:border-[var(--brand)]"
                >
                  {NOMBRES_MESES.map((nombre, i) => (
                    <option key={i} value={i}>{nombre}</option>
                  ))}
                </select>
                <select
                  value={otroAnio}
                  onChange={e => setOtroAnio(Number(e.target.value))}
                  aria-label="Año"
                  className="h-7 w-[64px] px-1.5 text-xs border border-[var(--border)] rounded-md bg-white outline-none focus:border-[var(--brand)]"
                >
                  {aniosDisponibles.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={agregarOtroMes}
                  className="rk-btn rk-btn--text rk-btn--sm"
                >
                  Agregar
                </button>
              </div>

              <div className="flex items-center gap-1 p-2 pt-2 border-t border-[var(--surface-muted)] mt-1">
                <button
                  type="button"
                  onClick={() => {
                    const actual = listaMeses.find(m => m.esActual);
                    if (actual) setMesesSeleccionados([actual.key]);
                    setShowDropdownMeses(false);
                  }}
                  className="rk-btn rk-btn--text rk-btn--sm"
                >
                  Solo este mes
                </button>
                <span className="flex-1" />
                <button
                  type="button"
                  onClick={() => {
                    setMesesSeleccionados([]);
                    setShowDropdownMeses(false);
                  }}
                  className="rk-btn rk-btn--text rk-btn--sm"
                >
                  Todos los meses
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quick chip: Mis tickets */}
        <button
          type="button"
          className="rk-chip"
          aria-pressed={soloMios}
          onClick={() => setSoloMios(prev => !prev)}
        >
          Mis tickets
        </button>

        {/* Quick chip: Vencidos */}
        <button
          type="button"
          className="rk-chip"
          aria-pressed={soloVencidos}
          onClick={() => setSoloVencidos(prev => !prev)}
        >
          <span
            className="rk-dot"
            style={{ background: totalVencidosCount > 0 ? '#d4380d' : '#8c96a3' }}
          />
          Vencidos · {totalVencidosCount}
        </button>

        <span className="flex-1" />

        {/* Restablecer filtros */}
        {hayFiltrosActivos && (
          <button
            type="button"
            onClick={limpiarFiltros}
            className="rk-btn rk-btn--text text-xs font-bold"
          >
            Restablecer filtros
          </button>
        )}
      </div>

      {/* ── Contenido Principal ── */}
      <div className="flex-1 min-h-0 bg-white overflow-hidden flex flex-col">
        {/* Empty state si no hay tickets filtrados */}
        {ticketsFiltrados.length === 0 && vista !== 'calendario' && !isLoading && (
          <div className="flex flex-col items-center justify-center gap-3 p-16 text-center">
            <span className="text-base text-[var(--text-muted)]">
              No hay tickets con estos filtros.
            </span>
            {hayFiltrosActivos && (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="rk-btn rk-btn--secondary text-xs"
              >
                Restablecer filtros
              </button>
            )}
          </div>
        )}

        {/* ── VISTA KANBAN COMPACTA (4 columnas agrupadas) ── */}
        {vista === 'compacta' && (
          <div className="flex-1 overflow-x-auto bk-scroll px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-start min-w-[1000px]">
              {GRUPOS_COMPACTA.map(grupo => {
                const columnTickets = sortTicketsByOrder(
                  ticketsFiltrados.filter(t => (grupo.estados as readonly string[]).includes(t.status))
                );
                const isColActive = dragOverColId === grupo.id;

                return (
                  <div
                    key={grupo.id}
                    className="flex flex-col gap-2 min-w-0"
                    onDragOver={e => handleColDragOver(e, grupo.id)}
                    onDrop={e => handleColDrop(e, grupo.id, true)}
                  >
                    {/* Header Columna */}
                    <div className="flex items-center gap-2 px-1">
                      <span className="rk-dot" style={{ background: grupo.color }} />
                      <h3 className="font-semibold text-sm text-[#0d0d0d]">{grupo.name}</h3>
                      <span className="text-xs text-[var(--text-subtle)] font-medium">
                        {columnTickets.length}
                      </span>
                    </div>

                    {/* Subtítulo con estados incluidos */}
                    <div className="px-1 -mt-1 text-xs text-[var(--text-muted)] truncate">
                      {grupo.sub}
                    </div>

                    {/* Headings accesibles para tests y screen readers */}
                    <div className="sr-only">
                      {grupo.estados.map(st => (
                        <h4 key={st}>
                          {COLUMNAS_COMPLETA.find(c => c.id === st)?.nombre || st}
                        </h4>
                      ))}
                    </div>

                    {/* Droppable cards container */}
                    <div
                      className={`bk-scroll flex flex-col gap-1.5 p-1.5 min-h-[140px] max-h-[calc(100vh-200px)] overflow-y-auto rounded-[10px] transition-all ${
                        isColActive
                          ? 'bg-[rgba(2,79,255,0.04)] ring-2 ring-[rgba(2,79,255,0.25)]'
                          : 'bg-[#f7fafc]'
                      }`}
                    >
                      {columnTickets.length === 0 && (
                        <div className="py-7 text-center text-xs text-[var(--text-subtle)]">
                          {draggedId ? 'Soltá acá' : 'Sin tickets'}
                        </div>
                      )}

                      {columnTickets.map(ticket => {
                        const showSlotBefore = (
                          dropTarget?.ticketId === ticket.id &&
                          dropTarget?.position === 'before' &&
                          dropTarget?.colId === grupo.id &&
                          draggedId !== ticket.id
                        );
                        const showSlotAfter = (
                          dropTarget?.ticketId === ticket.id &&
                          dropTarget?.position === 'after' &&
                          dropTarget?.colId === grupo.id &&
                          draggedId !== ticket.id
                        );

                        return (
                          <div key={ticket.id} className="flex flex-col gap-2">
                            {showSlotBefore && (
                              <div className="h-12 border-2 border-dashed border-[var(--brand)] rounded-[10px] bg-[var(--brand-tint)] flex items-center justify-center text-xs font-bold text-[var(--brand)]">
                                Soltá acá
                              </div>
                            )}

                            <TicketCard
                              ticket={ticket}
                              onOpen={() => handleOpenTicket(ticket)}
                              onDragStart={e => handleDragStart(e, ticket.id)}
                              onDragEnd={handleDragEnd}
                              onDragOver={e => handleCardDragOver(e, ticket.id, grupo.id)}
                              isDragged={draggedId === ticket.id}
                            />

                            {showSlotAfter && (
                              <div className="h-12 border-2 border-dashed border-[var(--brand)] rounded-[10px] bg-[var(--brand-tint)] flex items-center justify-center text-xs font-bold text-[var(--brand)]">
                                Soltá acá
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── VISTA KANBAN COMPLETA (11 columnas individuales) ── */}
        {vista === 'completa' && (
          <div className="flex-1 overflow-x-auto bk-scroll px-6 py-4">
            <div className="grid grid-flow-col auto-cols-[280px] gap-3 items-start min-w-[3100px]">
              {COLUMNAS_COMPLETA.map(col => {
                const columnTickets = sortTicketsByOrder(
                  ticketsFiltrados.filter(t => t.status === col.id)
                );
                const isColActive = dragOverColId === col.id;

                return (
                  <div
                    key={col.id}
                    className="flex flex-col gap-2 min-w-0"
                    onDragOver={e => handleColDragOver(e, col.id)}
                    onDrop={e => handleColDrop(e, col.id, false)}
                  >
                    {/* Header Columna */}
                    <div className="flex items-center gap-2 px-1">
                      <span className="rk-dot" style={{ background: col.color }} />
                      <h3 className="font-semibold text-sm text-[#0d0d0d]">{col.nombre}</h3>
                      <span className="text-xs text-[var(--text-subtle)] font-medium">
                        {columnTickets.length}
                      </span>
                    </div>

                    {/* Droppable cards container */}
                    <div
                      className={`bk-scroll flex flex-col gap-1.5 p-1.5 min-h-[140px] max-h-[calc(100vh-200px)] overflow-y-auto rounded-[10px] transition-all ${
                        isColActive
                          ? 'bg-[rgba(2,79,255,0.04)] ring-2 ring-[rgba(2,79,255,0.25)]'
                          : 'bg-[#f7fafc]'
                      }`}
                    >
                      {columnTickets.length === 0 && (
                        <div className="py-7 text-center text-xs text-[var(--text-subtle)]">
                          {draggedId ? 'Soltá acá' : 'Sin tickets'}
                        </div>
                      )}

                      {columnTickets.map(ticket => {
                        const showSlotBefore = (
                          dropTarget?.ticketId === ticket.id &&
                          dropTarget?.position === 'before' &&
                          dropTarget?.colId === col.id &&
                          draggedId !== ticket.id
                        );
                        const showSlotAfter = (
                          dropTarget?.ticketId === ticket.id &&
                          dropTarget?.position === 'after' &&
                          dropTarget?.colId === col.id &&
                          draggedId !== ticket.id
                        );

                        return (
                          <div key={ticket.id} className="flex flex-col gap-2">
                            {showSlotBefore && (
                              <div className="h-12 border-2 border-dashed border-[var(--brand)] rounded-[10px] bg-[var(--brand-tint)] flex items-center justify-center text-xs font-bold text-[var(--brand)]">
                                Soltá acá
                              </div>
                            )}

                            <TicketCard
                              ticket={ticket}
                              onOpen={() => handleOpenTicket(ticket)}
                              onDragStart={e => handleDragStart(e, ticket.id)}
                              onDragEnd={handleDragEnd}
                              onDragOver={e => handleCardDragOver(e, ticket.id, col.id)}
                              isDragged={draggedId === ticket.id}
                            />

                            {showSlotAfter && (
                              <div className="h-12 border-2 border-dashed border-[var(--brand)] rounded-[10px] bg-[var(--brand-tint)] flex items-center justify-center text-xs font-bold text-[var(--brand)]">
                                Soltá acá
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── VISTA CALENDARIO ── */}
        {vista === 'calendario' && (
          <div className="flex-1 overflow-y-auto bk-scroll">
            <CalendarioBacklog
              tickets={ticketsFiltrados}
              onTicketClick={handleOpenTicket}
            />
          </div>
        )}
      </div>

      {/* Modal de Detalle / Creación */}
      <CreateTicketModal
        isOpen={showModalNueva || selectedTicket !== null}
        onClose={handleCloseModal}
        ticket={selectedTicket as any}
        defaultClientId={
          effectiveClientIds.length === 1
            ? effectiveClientIds[0]
            : clientesSeleccionados.length === 1
            ? clientesSeleccionados[0]
            : undefined
        }
      />
    </div>
  );
}

// ─── Componente Tarjeta de Ticket (Rocky Design System) ────────────────────────
function TicketCard({
  ticket,
  onOpen,
  onDragStart,
  onDragEnd,
  onDragOver,
  isDragged,
}: {
  ticket: Ticket;
  onOpen: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  isDragged: boolean;
}) {
  const isDraggingRef = useRef(false);

  const isTarea = ticket.tipoTicket === 'TAREA' || ticket.ticketType?.kind === 'TAREA';
  const tipoLabel = isTarea ? 'Tarea' : (ticket.ticketType?.name || 'Pieza');

  // Top Label: Speaker si tiene, sino Cliente
  const topLabel = ticket.speaker
    ? `${ticket.speaker.nombre} · ${ticket.client.name}`
    : ticket.client.name;

  // Prioridad
  const pri = PRIORIDAD_CONFIG[ticket.prioridad?.toUpperCase()] || PRIORIDAD_CONFIG.MEDIA;

  // Fecha de la tarjeta: la misma que usa el filtro "Vencidos"
  const dateToUse = getFechaVencimiento(ticket as any);
  const parsedDue = dateToUse ? parseLocalDate(dateToUse) : null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  let dateLabel = 'Sin fecha';
  let isOverdue = false;
  let isToday = false;

  if (parsedDue) {
    parsedDue.setHours(0, 0, 0, 0);
    const day = parsedDue.getDate();
    const month = parsedDue.toLocaleDateString('es-ES', { month: 'short' });
    isToday = parsedDue.getTime() === hoy.getTime();
    isOverdue = (
      parsedDue.getTime() < hoy.getTime() &&
      ticket.status !== 'PUBLICADO' &&
      ticket.status !== 'LISTO' &&
      ticket.status !== 'CANCELADO'
    );

    if (isOverdue) {
      dateLabel = `Vencido · ${day} ${month}`;
    } else if (isToday) {
      dateLabel = 'Hoy';
    } else {
      dateLabel = `${day} ${month}`;
    }
  }

  const handleDragStartInternal = (e: React.DragEvent) => {
    isDraggingRef.current = true;
    onDragStart(e);
  };

  const handleDragEndInternal = (e: React.DragEvent) => {
    onDragEnd(e);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 150);
  };

  const handleClick = (_e: React.MouseEvent) => {
    if (isDraggingRef.current) return;
    onOpen();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen();
    }
  };

  return (
    <div
      draggable
      onDragStart={handleDragStartInternal}
      onDragEnd={handleDragEndInternal}
      onDragOver={onDragOver}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      className={`bk-card ${
        isTarea ? 'bk-card--tarea' : 'bk-card--contenido'
      } relative flex flex-col gap-1.5 w-full pt-2.5 pb-2 px-3 rounded-[10px] bg-white border border-[var(--border)] shadow-sm transition-all select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-transparent ${
        isDragged ? 'opacity-40' : 'opacity-100'
      }`}
    >
      {/* Top Header: Tipo Badge + TopLabel + Drag Grip */}
      <div className="flex items-center justify-between gap-1.5 min-w-0 w-full">
        <span
          className={`inline-flex items-center gap-1 h-[18px] px-1.5 rounded text-[10px] font-semibold tracking-wider uppercase whitespace-nowrap overflow-hidden shrink-0 max-w-[60%] ${
            isTarea
              ? 'bg-[#eef3f7] text-[#0d0d0d]'
              : 'bg-[rgba(2,79,255,0.08)] text-[var(--brand)]'
          }`}
          title={tipoLabel}
        >
          {isTarea ? (
            <CheckSquare className="w-3 h-3 text-[#0d0d0d] shrink-0" />
          ) : (
            <FileText className="w-3 h-3 text-[var(--brand)] shrink-0" />
          )}
          <span className="truncate block min-w-0">{tipoLabel}</span>
        </span>

        <div className="inline-flex items-center justify-end gap-1.5 min-w-0 flex-1">
          <span
            className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-normal text-[var(--text-muted)] text-right"
            title={topLabel}
          >
            {topLabel}
          </span>
          <span className="bk-grip shrink-0 cursor-pointer" title="Arrastrá para mover" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <circle cx="9" cy="6" r="1.5" />
              <circle cx="15" cy="6" r="1.5" />
              <circle cx="9" cy="12" r="1.5" />
              <circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="18" r="1.5" />
              <circle cx="15" cy="18" r="1.5" />
            </svg>
          </span>
        </div>
      </div>

      {/* Título */}
      <div className="bk-open text-left">
        <span className="bk-clamp font-semibold text-[12px] leading-[1.35] text-[#0d0d0d] hover:text-[var(--brand)] transition-colors">
          {ticket.title}
        </span>
      </div>

      {/* Footer: Prioridad + Due Date */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--surface-muted)]">
        <span
          className="inline-flex items-center gap-1 py-0 px-1.5 rounded-full text-xs font-medium text-[#0d0d0d]"
          style={{ background: pri.bg }}
        >
          <span className="rk-dot" style={{ background: pri.dot }} />
          {pri.label}
        </span>

        <span
          className={`inline-flex items-center gap-1 text-xs ${
            isOverdue
              ? 'text-[var(--danger)] font-semibold'
              : isToday
              ? 'text-[var(--brand)] font-medium'
              : 'text-[var(--text-muted)] font-medium'
          }`}
        >
          {dateLabel}
        </span>
      </div>
    </div>
  );
}
