import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  X, ChevronDown, Check, Loader2, Trash2,
  Paperclip, Copy as CopyIcon, Link2, ExternalLink
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { STATUS_OPTIONS, PRENSA_STATUS_OPTIONS, getNextStatusInfo } from '../lib/estados';
import { ensureAbsoluteUrl, formatDateISO, getRedesObjetivoForClient, parseDeliverableLinks, serializeDeliverableLinks, highlightQuotesInHtml } from '../lib/utils';
import { TextFormatToolbar } from './TextFormatToolbar';
import { RichTextEditor } from './RichTextEditor';
import { MentionTextarea, formatCommentWithMentions } from './MentionTextarea';
import { TicketPublishLinks } from './ticket/TicketPublishLinks';
import { InlineCommentHoverTooltip } from './ticket/InlineCommentHoverTooltip';
import { InlineCommentPopover } from './ticket/InlineCommentPopover';

export type AttachedFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string | null;
  contentType: 'text' | 'image' | 'other';
};

export interface TicketData {
  id: string;
  title: string;
  objetivo?: string | null;
  canal?: string | null;
  canales?: string[];
  prioridad: string;
  status: string;
  dueDate?: string | null;
  plannedDate?: string | null;
  links?: string[];
  linkEntregable?: string | null;
  linkPublicacion?: string | null;
  copyFinal?: string | null;
  content?: string | null;
  contentPerCanal?: Record<string, string>;
  versionsPerCanal?: Record<string, string[]>;
  notasAudiovisual?: string | null;
  tiposContenido?: string[];
  client: { id: string; name: string; canales?: string[] };
  owner: { id: string; name: string };
  assigneeIds?: string[];
  assignees?: { id: string; name: string }[];
  pilar?: { id: string; nombre: string } | null;
  speaker?: { id: string; name?: string; nombre?: string; role?: string } | null;
  area?: string;
  subEstado?: string | null;
  medio?: string | null;
  periodista?: string | null;
  estadoRespuesta?: string | null;
  ticketType?: { id: string; name: string; kind?: string } | null;
  estadoAprobacionCliente?: string | null;
  aprobadoPor?: string | null;
  references?: any[];
}

export interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket?: TicketData | null;
  area?: 'CONTENIDO' | 'PRENSA';
  defaultClientId?: string;
}

const FORMATOS_PIEZA = [
  'Álbum de fotos', 'Carrusel', 'Hilo', 'Imagen', 'Placa gráfica',
  'Reel', 'Repost', 'Story', 'Texto', 'Video'
];

const TIPOS_TAREA = [
  'Artículo de blog', 'Deck', 'Diseño puntual', 'Estrategia',
  'Newsletter', 'Reporte', 'Otro'
];

const TPL_TAREA: Record<string, string> = {
  'Artículo de blog': 'Tema y enfoque:\nPúblico:\nPalabras clave o SEO:\nExtensión aproximada:',
  'Deck': 'Para qué instancia es (reunión, evento, pitch):\nAudiencia:\nCantidad aproximada de slides:\nQué tiene que incluir:',
  'Diseño puntual': 'Qué pieza es y dónde se usa:\nMedidas o formato:\nTextos que lleva:',
  'Estrategia': 'Objetivo:\nHorizonte de tiempo:\nQué tiene que responder:',
  'Newsletter': 'Edición o período:\nTemas a incluir:\nA quién se envía:',
  'Reporte': 'Período que cubre:\nQuién lo recibe:\nMétricas o datos a incluir:'
};

const DESIGN_STATES = ['DISENO', 'EDICION', 'Diseño', 'Edición'];

const LIMITS: Record<string, number> = {
  'LinkedIn': 3000,
  'Instagram': 2200,
  'Twitter/X': 280,
  'Twitter': 280,
  'X': 280
};

const PRIORIDADES = [
  { value: 'ALTA', label: 'Alta', dot: '#ff9e22' },
  { value: 'MEDIA', label: 'Media', dot: '#00e39c' },
  { value: 'BAJA', label: 'Baja', dot: '#8c96a3' },
];

const ini = (n?: string) => {
  if (!n) return '??';
  return n.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
};

function buildFormData(ticket?: TicketData | null, defaultClientId?: string) {
  if (!ticket) {
    return {
      title: '',
      brief: '',
      canales: [] as string[],
      clientId: defaultClientId ?? '',
      ownerId: '',
      assigneeIds: [] as string[],
      ticketTypeId: '',
      tiposContenido: [] as string[],
      pilarId: '',
      speakerId: '',
      prioridad: 'MEDIA',
      status: 'PENDIENTE',
      subEstado: 'PENDIENTE',
      dueDate: '',
      fechaPub: '',
      links: [] as string[],
      linkEntregable: '',
      linkPublicacion: '',
      entLinks: [''] as string[],
      content: '',
      contentPerCanal: {} as Record<string, string>,
      notasAudiovisual: '',
      medio: '',
      periodista: '',
      estadoRespuesta: '',
      vinculado: '',
      aprobado: false,
      aprobadoPor: '',
      pub: {} as Record<string, string>,
    };
  }

  const initialTipos = (ticket as any).tiposContenido?.length > 0
    ? (ticket as any).tiposContenido
    : (ticket.ticketType?.name ? [ticket.ticketType.name] : []);
  const initialAssignees = Array.isArray((ticket as any).assigneeIds) && (ticket as any).assigneeIds.length > 0
    ? (ticket as any).assigneeIds
    : (ticket.owner?.id ? [ticket.owner.id] : []);

  return {
    title: ticket.title || '',
    brief: ticket.objetivo ?? '',
    canales: (ticket as any).canales?.length > 0 ? (ticket as any).canales : [],
    clientId: ticket.client?.id || '',
    ownerId: ticket.owner?.id || '',
    assigneeIds: initialAssignees,
    ticketTypeId: ticket.ticketType?.id ?? '',
    tiposContenido: initialTipos,
    pilarId: (ticket as any).pilar?.id ?? '',
    speakerId: (ticket as any).speaker?.id ?? '',
    prioridad: ticket.prioridad || 'MEDIA',
    status: ticket.status || 'PENDIENTE',
    dueDate: formatDateISO(ticket.dueDate),
    fechaPub: formatDateISO((ticket as any).plannedDate),
    links: ticket.links ?? [],
    linkEntregable: ticket.linkEntregable ?? '',
    linkPublicacion: ticket.linkPublicacion ?? '',
    entLinks: ticket.links && ticket.links.length > 0 ? ticket.links : [''],
    content: (ticket as any).content ?? '',
    contentPerCanal: (() => {
      const perCanal: Record<string, string> = (ticket as any).contentPerCanal && typeof (ticket as any).contentPerCanal === 'object' ? { ...(ticket as any).contentPerCanal } : {};
      const versions: Record<string, string[]> = (ticket as any).versionsPerCanal && typeof (ticket as any).versionsPerCanal === 'object' ? (ticket as any).versionsPerCanal : {};
      const canalesList: string[] = (ticket as any).canales?.length > 0 ? (ticket as any).canales : ['LinkedIn'];
      canalesList.forEach((canal: string) => {
        if (!perCanal[canal] || !perCanal[canal].trim()) {
          const canalVersions = versions[canal] || Object.entries(versions).find(([k]) => k.toLowerCase() === canal.toLowerCase())?.[1];
          if (Array.isArray(canalVersions) && canalVersions.length > 0) {
            const lastNonEmpty = [...canalVersions].reverse().find(v => v && v.trim().length > 0);
            if (lastNonEmpty) {
              perCanal[canal] = lastNonEmpty;
            }
          }
        }
      });
      return perCanal;
    })(),
    notasAudiovisual: (ticket as any).notasAudiovisual ?? '',
    medio: (ticket as any).medio ?? '',
    periodista: (ticket as any).periodista ?? '',
    estadoRespuesta: (ticket as any).estadoRespuesta ?? '',
    vinculado: (ticket as any).references?.[0]?.id ?? '',
    aprobado: (ticket as any).estadoAprobacionCliente === 'APROBADO',
    aprobadoPor: (ticket as any).aprobadoPor ?? '',
    pub: {} as Record<string, string>,
  };
}

export function CreateTicketModal({ isOpen, onClose, ticket, area = 'CONTENIDO', defaultClientId }: CreateTicketModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isEditing = !!ticket;
  const preferredIds = user?.preferredClientIds ?? [];

  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState(() => buildFormData(ticket, defaultClientId));

  const initTipo = (t?: TicketData | null): 'CONTENIDO' | 'TAREA' | 'PRENSA' => {
    if (t?.ticketType?.kind === 'PRENSA' || (!t && area === 'PRENSA')) return 'PRENSA';
    if (t?.ticketType?.kind === 'TAREA') return 'TAREA';
    return 'CONTENIDO';
  };

  const [tipoTicket, setTipoTicket] = useState<'CONTENIDO' | 'TAREA' | 'PRENSA'>(() => initTipo(ticket));
  const isPieza = tipoTicket === 'CONTENIDO';
  const esTarea = tipoTicket === 'TAREA';
  const esPrensa = tipoTicket === 'PRENSA';
  const noContenido = esTarea || esPrensa;

  const [recursoInput, setRecursoInput] = useState('');
  const [activeCopyTab, setActiveCopyTab] = useState<string>('LinkedIn');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fmtOpen, setFmtOpen] = useState(false);
  const fmtMenuRef = useRef<HTMLDivElement>(null);

  const [linkCopiado, setLinkCopiado] = useState(false);

  const [ownersOpen, setOwnersOpen] = useState(false);
  const [ownerQuery, setOwnerQuery] = useState('');
  const [selectedOwnerIndex, setSelectedOwnerIndex] = useState(0);
  const ownersMenuRef = useRef<HTMLDivElement>(null);

  const [statesOpen, setStatesOpen] = useState(false);
  const statesMenuRef = useRef<HTMLDivElement>(null);

  const [briefOpen, setBriefOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [notasOpen, setNotasOpen] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [entregableInput, setEntregableInput] = useState('');

  // Inline comment popover state
  const [pop, setPop] = useState<{ id: string; x: number; y: number; isDraft?: boolean } | null>(null);
  const [popInput, setPopInput] = useState('');
  const [threads, setThreads] = useState<Record<string, { quote: string; items: { author: string; when: string; text: string }[] }>>({});
  const popRef = useRef<HTMLTextAreaElement>(null);
  const popRefVal = useRef(pop);
  popRefVal.current = pop;
  const threadsRefVal = useRef(threads);
  threadsRefVal.current = threads;

  const [isChangingSpeaker, setIsChangingSpeaker] = useState(false);

  const briefRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const notasRef = useRef<HTMLDivElement>(null);

  const lastTicketIdRef = useRef<string | null>(null);
  const loadedDetailTicketIdRef = useRef<string | null>(null);
  const dirtyFieldsRef = useRef<Set<string>>(new Set());
  const pendingSaveDataRef = useRef<Partial<typeof formData> | null>(null);
  const isSavingRef = useRef(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  // Queries
  const { data: ticketDetailQuery, isFetching: isFetchingTicket } = useQuery({
    queryKey: ['ticket', ticket?.id],
    queryFn: () => api.getTicket(ticket!.id),
    enabled: isOpen && !!ticket?.id,
    staleTime: 30 * 1000,
  });

  const isTicketLoading = isEditing && isFetchingTicket;

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.getClients(),
    enabled: isOpen,
    staleTime: 10 * 60 * 1000,
  });

  const availableClients = (clients?.data ?? []).filter((c: any) =>
    preferredIds.length === 0 || preferredIds.includes(c.id) || (isEditing && ticket?.client?.id === c.id)
  );

  const selectedClient = (clients?.data ?? []).find((c: any) => c.id === formData.clientId)
    ?? (ticket?.client?.id === formData.clientId ? (ticket.client as any) : null);

  const redesDisponibles = useMemo(() => {
    return getRedesObjetivoForClient(selectedClient?.canales, formData.canales);
  }, [selectedClient?.canales, formData.canales]);

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.getUsers(),
    enabled: isOpen,
    staleTime: 10 * 60 * 1000,
  });

  const { data: pilaresData } = useQuery({
    queryKey: ['pilares', formData.clientId],
    queryFn: () => api.getPilares(formData.clientId),
    enabled: isOpen && !!formData.clientId && !noContenido,
    staleTime: 5 * 60 * 1000,
  });
  const pilares = pilaresData?.data ?? [];

  const { data: speakersData } = useQuery({
    queryKey: ['speakers', formData.clientId],
    queryFn: () => api.getSpeakers(formData.clientId),
    enabled: isOpen && !!formData.clientId && !noContenido,
    staleTime: 5 * 60 * 1000,
  });
  const speakers = speakersData?.data ?? [];

  const { data: commentsData } = useQuery({
    queryKey: ['comments', ticket?.id],
    queryFn: () => api.getComments(ticket!.id),
    enabled: isOpen && !!ticket?.id,
  });
  const comments = commentsData?.data ?? [];

  // Reset or populate on modal open/ticket change
  useEffect(() => {
    if (isOpen) {
      const currentId = ticket?.id ?? null;
      const isNewTicket = currentId !== lastTicketIdRef.current;
      lastTicketIdRef.current = currentId;

      if (isNewTicket) {
        loadedDetailTicketIdRef.current = null;
        dirtyFieldsRef.current.clear();
        const newFormData = buildFormData(ticket, defaultClientId);
        setFormData(newFormData);
        setTipoTicket(initTipo(ticket));
        const initialCanales = newFormData.canales.length > 0 ? newFormData.canales : ['LinkedIn'];
        setActiveCopyTab(initialCanales[0] || 'LinkedIn');
        setBriefOpen(false);
        setCopyOpen(false);
        setNotasOpen(false);
        setEntregableInput('');
        setError(null);
        setPop(null);
        if (ticket?.id) {
          const saved = sessionStorage.getItem(`ticket-files-${ticket.id}`);
          setAttachedFiles(saved ? JSON.parse(saved) : []);
        } else {
          setAttachedFiles([]);
        }
      }
    } else {
      lastTicketIdRef.current = null;
      loadedDetailTicketIdRef.current = null;
      dirtyFieldsRef.current.clear();
    }
  }, [ticket?.id, isOpen, defaultClientId]);

  // Synchronize from GET /tickets/:id
  useEffect(() => {
    if (ticketDetailQuery?.data && isEditing && ticket?.id) {
      if (loadedDetailTicketIdRef.current === ticket.id) return;
      loadedDetailTicketIdRef.current = ticket.id;

      const full = ticketDetailQuery.data as any;
      const fullFormData = buildFormData(full, defaultClientId);

      setFormData(prev => {
        const dirty = dirtyFieldsRef.current;
        if (dirty.size === 0) return fullFormData;
        const merged = { ...fullFormData };
        dirty.forEach(field => {
          (merged as any)[field] = (prev as any)[field];
        });
        return merged;
      });

      if (!dirtyFieldsRef.current.has('ticketTypeId')) {
        setTipoTicket(initTipo(full));
      }
      if (!dirtyFieldsRef.current.has('canales')) {
        const canales = fullFormData.canales.length > 0 ? fullFormData.canales : ['LinkedIn'];
        setActiveCopyTab(prevTab => (canales.includes(prevTab) ? prevTab : canales[0]));
      }

      if (pendingSaveDataRef.current) {
        const toSave = pendingSaveDataRef.current;
        pendingSaveDataRef.current = null;
        performAutoSave(toSave);
      }
    }
  }, [ticketDetailQuery?.data, isEditing, ticket?.id, defaultClientId]);

  // Synchronize comment marks into formData when comments or ticket details load
  useEffect(() => {
    if (!isOpen || !comments || comments.length === 0) return;

    const quotesWithIds: { quote: string; id: string }[] = [];
    comments.forEach((cm: any) => {
      const rawContent = cm.content || cm.text || '';
      const quoteMatch = rawContent.match(/^«([^»]+)»:\s*([\s\S]*)$/);
      const q = cm.quote || (quoteMatch ? quoteMatch[1] : null);
      if (q && q.trim()) {
        quotesWithIds.push({ quote: q.trim(), id: `c_${cm.id}` });
      }
    });

    if (quotesWithIds.length === 0) return;

    setFormData(prev => {
      let changed = false;
      const nextBrief = highlightQuotesInHtml(prev.brief || '', quotesWithIds);
      if (nextBrief !== prev.brief) changed = true;

      const nextNotas = highlightQuotesInHtml(prev.notasAudiovisual || '', quotesWithIds);
      if (nextNotas !== prev.notasAudiovisual) changed = true;

      const nextPerCanal: Record<string, string> = { ...prev.contentPerCanal };
      Object.keys(nextPerCanal).forEach(canal => {
        const highlighted = highlightQuotesInHtml(nextPerCanal[canal] || '', quotesWithIds);
        if (highlighted !== nextPerCanal[canal]) {
          nextPerCanal[canal] = highlighted;
          changed = true;
        }
      });

      if (!changed) return prev;
      return {
        ...prev,
        brief: nextBrief,
        notasAudiovisual: nextNotas,
        contentPerCanal: nextPerCanal,
      };
    });
  }, [comments, isOpen]);

  // Click outside menus
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (fmtMenuRef.current && !fmtMenuRef.current.contains(target)) setFmtOpen(false);
      if (ownersMenuRef.current && !ownersMenuRef.current.contains(target)) setOwnersOpen(false);
      if (statesMenuRef.current && !statesMenuRef.current.contains(target)) setStatesOpen(false);
      const path = (e.composedPath ? e.composedPath() : []) as HTMLElement[];
      const isInsidePop = Boolean(
        target.closest?.('[data-inline-pop]') ||
        target.closest?.('[data-mention-dropdown]') ||
        path.some((el) => el instanceof HTMLElement && (el.hasAttribute?.('data-inline-pop') || el.hasAttribute?.('data-mention-dropdown')))
      );

      if (pop && !isInsidePop && !target.closest?.('mark[data-c]') && !target.closest?.('[data-comment-trigger]')) {
        closePop();
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [pop]);

  // Auto-save logic
  const performAutoSave = async (overrideData?: Partial<typeof formData>) => {
    if (!isEditing || !ticket?.id) return;
    if (isTicketLoading || isSavingRef.current) {
      pendingSaveDataRef.current = { ...(pendingSaveDataRef.current || {}), ...(overrideData || {}) };
      return;
    }

    const current = { ...formDataRef.current, ...overrideData };
    const primaryOwner = current.ownerId || current.assigneeIds?.[0];
    if (!current.title || !current.clientId || !primaryOwner) return;

    const payload: any = {
      title: current.title,
      ownerId: primaryOwner,
      assigneeIds: current.assigneeIds || [],
      status: current.status,
      prioridad: current.prioridad,
      objetivo: current.brief || undefined,
      canales: noContenido ? [] : (current.canales.length > 0 ? current.canales : ['LinkedIn']),
      dueDate: current.dueDate || null,
      plannedDate: current.fechaPub || null,
      ticketTypeId: current.ticketTypeId || null,
      tiposContenido: current.tiposContenido,
      pilarId: noContenido ? null : (current.pilarId || null),
      speakerId: noContenido ? null : (current.speakerId || null),
      ...(current.links.length > 0 ? { links: current.links.map(ensureAbsoluteUrl) } : { links: [] }),
      ...(current.linkEntregable ? { linkEntregable: ensureAbsoluteUrl(current.linkEntregable) } : { linkEntregable: null }),
      ...(current.linkPublicacion ? { linkPublicacion: ensureAbsoluteUrl(current.linkPublicacion) } : { linkPublicacion: null }),
      ...(current.notasAudiovisual ? { notasAudiovisual: current.notasAudiovisual } : {}),
      content: noContenido ? undefined : (current.content || null),
      contentPerCanal: noContenido ? undefined : current.contentPerCanal,
    };

    if (esPrensa) {
      payload.area = 'PRENSA';
      payload.subEstado = (ticket as any)?.subEstado ?? 'PENDIENTE';
      payload.medio = current.medio || null;
      payload.periodista = current.periodista || null;
      payload.estadoRespuesta = current.estadoRespuesta || null;
    }

    isSavingRef.current = true;
    setSaveStatus('saving');
    try {
      const res = await api.updateTicket(ticket.id, payload);
      if (res?.data) {
        queryClient.setQueryData(['tickets'], (old: any) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((t: any) => (t.id === res.data.id ? { ...t, ...res.data } : t)),
          };
        });
        queryClient.setQueryData(['ticket', ticket.id], (old: any) => {
          if (!old?.data) return old;
          return { ...old, data: { ...old.data, ...res.data } };
        });
      }
      setSaveStatus('saved');
      dirtyFieldsRef.current.clear();
    } catch {
      setSaveStatus('error');
    } finally {
      isSavingRef.current = false;
      if (pendingSaveDataRef.current) {
        const nextSave = pendingSaveDataRef.current;
        pendingSaveDataRef.current = null;
        performAutoSave(nextSave);
      }
    }
  };

  const triggerDebouncedAutoSave = (overrideData?: Partial<typeof formData>) => {
    if (!isEditing || !ticket?.id) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus('saving');
    saveTimeoutRef.current = setTimeout(() => {
      performAutoSave(overrideData);
    }, 800);
  };

  const triggerImmediateAutoSave = (overrideData?: Partial<typeof formData>) => {
    if (!isEditing || !ticket?.id) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    performAutoSave(overrideData);
  };

  const handleChange = (field: string, value: any, immediate = false) => {
    dirtyFieldsRef.current.add(field);
    const updated = { ...formDataRef.current, [field]: value };
    setFormData(updated);
    if (immediate) triggerImmediateAutoSave(updated);
    else triggerDebouncedAutoSave(updated);
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createTicket(data),
    onSuccess: (res: any) => {
      if (res?.data) {
        queryClient.setQueryData(['tickets'], (old: any) => {
          if (!old?.data) return old;
          return { ...old, data: [res.data, ...old.data] };
        });
      }
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: (err: any) => {
      setError(err.message || 'Error al crear');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.updateTicket(ticket!.id, data),
    onSuccess: (res: any) => {
      if (res?.data && ticket?.id) {
        queryClient.setQueryData(['tickets'], (old: any) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((t: any) => (t.id === res.data.id ? { ...t, ...res.data } : t)),
          };
        });
        queryClient.setQueryData(['ticket', ticket.id], (old: any) => {
          if (!old?.data) return old;
          return { ...old, data: { ...old.data, ...res.data } };
        });
      }
    },
    onError: (err: any) => {
      setError(err.message || 'Error al guardar los cambios');
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: (text: string) => api.createComment(ticket!.id, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', ticket?.id] });
      setCommentInput('');
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => api.deleteComment(ticket!.id, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', ticket?.id] });
    },
  });

  const handleClose = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (isEditing && dirtyFieldsRef.current.size > 0) {
      performAutoSave();
    }
    setSaveStatus(null);
    setFormData(buildFormData(null));
    setError(null);
    if (!isEditing) setAttachedFiles([]);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        handlePrimary();
      }
      if (e.key === 'Escape') {
        if (pop) closePop();
        else if (ownersOpen) setOwnersOpen(false);
        else if (fmtOpen) setFmtOpen(false);
        else if (statesOpen) setStatesOpen(false);
        else handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pop, ownersOpen, fmtOpen, statesOpen, formData]);

  // Formats handling
  const toggleFormato = (f: string) => {
    const list = formData.tiposContenido || [];
    const next = list.includes(f) ? list.filter((x: string) => x !== f) : [...list, f];
    let briefUpdate: any = {};
    if (esTarea && !list.includes(f) && list.length === 0 && (!formData.brief.trim() || Object.values(TPL_TAREA).includes(formData.brief))) {
      briefUpdate.brief = TPL_TAREA[f] || '';
    }
    const updated = { ...formData, tiposContenido: next, ...briefUpdate };
    dirtyFieldsRef.current.add('tiposContenido');
    if (briefUpdate.brief !== undefined) dirtyFieldsRef.current.add('brief');
    setFormData(updated);
    triggerImmediateAutoSave(updated);
  };

  // Channels handling
  const toggleRed = (r: string) => {
    const next = formData.canales.includes(r) ? formData.canales.filter((x: string) => x !== r) : [...formData.canales, r];
    const updated = { ...formData, canales: next };
    dirtyFieldsRef.current.add('canales');
    setFormData(updated);
    if (!next.includes(activeCopyTab)) {
      setActiveCopyTab(next[0] || 'LinkedIn');
    }
    triggerImmediateAutoSave(updated);
  };

  // Add resource link
  const addRecurso = () => {
    const v = recursoInput.trim();
    if (!v) return;
    const next = [...formData.links, ensureAbsoluteUrl(v)];
    setRecursoInput('');
    handleChange('links', next, true);
  };

  const removeRecurso = (index: number) => {
    const next = formData.links.filter((_, i) => i !== index);
    handleChange('links', next, true);
  };

  // Add files
  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const newFiles: AttachedFile[] = [];
    Array.from(e.target.files).forEach(file => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const isImg = file.type.startsWith('image/');
      const isTxt = file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.txt');
      newFiles.push({
        id,
        name: file.name,
        type: file.type,
        size: file.size,
        content: null,
        contentType: isImg ? 'image' : isTxt ? 'text' : 'other',
      });
    });
    setAttachedFiles(prev => [...prev, ...newFiles]);
    e.target.value = '';
  };

  // Inline Comment Balloon logic
  const posFor = (mark: HTMLElement) => {
    const b = mark.getBoundingClientRect();
    const x = Math.max(8, Math.min(b.left, window.innerWidth - 308));
    const below = b.bottom + 8;
    const y = below + 260 > window.innerHeight ? Math.max(8, b.top - 268) : below;
    return { x, y };
  };

  const triggerCommentForEditor = (ref: React.RefObject<HTMLDivElement | null>) => {
    const root = ref.current;
    const sel = window.getSelection();
    if (!root || !sel || !sel.rangeCount || sel.isCollapsed || !root.contains(sel.anchorNode)) {
      alert('Seleccioná un fragmento del texto para comentarlo.');
      return;
    }
    const quote = sel.toString().trim();
    if (!quote) return;
    if (popRefVal.current?.isDraft) {
      const prevT = threadsRefVal.current[popRefVal.current.id];
      if (!prevT || !prevT.items || !prevT.items.length) {
        const prevMark = document.querySelector(`mark[data-c="${popRefVal.current.id}"]`);
        if (prevMark) prevMark.replaceWith(...Array.from(prevMark.childNodes));
        setThreads(prev => {
          const c = { ...prev };
          delete c[popRefVal.current!.id];
          return c;
        });
      }
    }

    const id = 'c' + Date.now();
    const range = sel.getRangeAt(0);
    const m = document.createElement('mark');
    m.dataset.c = id;
    m.style.backgroundColor = 'rgba(0, 255, 178, 0.35)';
    m.style.borderRadius = '2px';
    m.style.padding = '1px 2px';
    m.style.cursor = 'pointer';
    try {
      m.appendChild(range.extractContents());
      range.insertNode(m);
    } catch {
      return;
    }
    sel.removeAllRanges();

    // Sync newly inserted mark HTML into formData state and storage
    if (ref.current) {
      const newHtml = ref.current.innerHTML;
      if (ref === briefRef) {
        handleChange('brief', newHtml);
      } else if (ref === copyRef) {
        handleChange('contentPerCanal', { ...formData.contentPerCanal, [activeCopyTab]: newHtml });
      } else if (ref === notasRef) {
        handleChange('notasAudiovisual', newHtml);
      }
    }

    setThreads(prev => ({ ...prev, [id]: { quote, items: [] } }));
    setPop({ id, ...posFor(m), isDraft: true });
    setPopInput('');
    setTimeout(() => popRef.current?.focus(), 50);
  };

  const [hoverComment, setHoverComment] = useState<{
    id: string;
    x: number;
    y: number;
    quote: string;
    items: { author: string; when: string; text: string }[];
  } | null>(null);

  const handleMarkHover = (id: string | null, m: HTMLElement | null) => {
    if (!id || !m) {
      setHoverComment(null);
      return;
    }
    // If pop is open for this or another mark, let user interact with pop without distraction
    if (pop) return;

    const quoteText = (m.innerText || m.textContent || '').trim();
    const threadItems = threads[id]?.items || [];

    // Also look up any persisted comments matching this quote
    const matchedComments = comments.filter((cm: any) => {
      const rawContent = cm.content || cm.text || '';
      const quoteMatch = rawContent.match(/^«([^»]+)»:\s*([\s\S]*)$/);
      const q = cm.quote || (quoteMatch ? quoteMatch[1] : null);
      return q && (q.trim() === quoteText || quoteText.includes(q.trim()) || q.trim().includes(quoteText));
    });

    const persistedItems = matchedComments.map((cm: any) => {
      const rawContent = cm.content || cm.text || '';
      const quoteMatch = rawContent.match(/^«([^»]+)»:\s*([\s\S]*)$/);
      const mainContent = quoteMatch ? quoteMatch[2] : rawContent;
      const when = cm.createdAt
        ? new Date(cm.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        : (cm.when || '');
      return {
        author: cm.user?.name || cm.author || 'Usuario',
        when,
        text: mainContent,
      };
    });

    const allItems = [...threadItems, ...persistedItems];

    setHoverComment({
      id,
      ...posFor(m),
      quote: quoteText || threads[id]?.quote || '',
      items: allItems,
    });
  };

  const handleMarkClick = (id: string, m: HTMLElement) => {
    setHoverComment(null);

    if (popRefVal.current?.isDraft && popRefVal.current.id !== id) {
      const prevT = threadsRefVal.current[popRefVal.current.id];
      if (!prevT || !prevT.items || !prevT.items.length) {
        const prevMark = document.querySelector(`mark[data-c="${popRefVal.current.id}"]`);
        if (prevMark) prevMark.replaceWith(...Array.from(prevMark.childNodes));
        setThreads(prev => {
          const c = { ...prev };
          delete c[popRefVal.current!.id];
          return c;
        });
      }
    }

    const quoteText = (m.innerText || m.textContent || '').trim();

    // Also look up any persisted comments matching this quote or id
    const matchedComments = comments.filter((cm: any) => {
      const rawContent = cm.content || cm.text || '';
      const quoteMatch = rawContent.match(/^«([^»]+)»:\s*([\s\S]*)$/);
      const q = cm.quote || (quoteMatch ? quoteMatch[1] : null);
      const matchById = id && (id === `c_${cm.id}` || id === String(cm.id));
      const matchByQuote = q && (q.trim() === quoteText || quoteText.includes(q.trim()) || q.trim().includes(quoteText));
      return matchById || matchByQuote;
    });

    const persistedItems = matchedComments.map((cm: any) => {
      const rawContent = cm.content || cm.text || '';
      const quoteMatch = rawContent.match(/^«([^»]+)»:\s*([\s\S]*)$/);
      const mainContent = quoteMatch ? quoteMatch[2] : rawContent;
      const when = cm.createdAt
        ? new Date(cm.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        : (cm.when || '');
      return {
        author: cm.user?.name || cm.author || 'Usuario',
        when,
        text: mainContent,
      };
    });

    const existingLocalItems = threads[id]?.items || [];
    const combinedItems = [...persistedItems];
    for (const localItem of existingLocalItems) {
      if (!combinedItems.some(p => p.text === localItem.text && p.author === localItem.author)) {
        combinedItems.push(localItem);
      }
    }

    setThreads(prev => ({
      ...prev,
      [id]: {
        quote: quoteText || prev[id]?.quote || '',
        items: combinedItems,
      },
    }));

    setPop({ id, ...posFor(m), isDraft: false });
    setPopInput('');
    setTimeout(() => popRef.current?.focus(), 50);
  };

  const locateMark = (quoteText: string) => {
    if (!quoteText) return;
    const cleanQ = quoteText.trim();

    // Check if the quote belongs to brief, notas, or a specific copy tab and ensure it's visible
    if (formData.brief?.includes(cleanQ)) {
      setBriefOpen(true);
    }
    if (formData.notasAudiovisual?.includes(cleanQ)) {
      setNotasOpen(true);
    }
    if (formData.contentPerCanal) {
      for (const [canal, text] of Object.entries(formData.contentPerCanal)) {
        if (text?.includes(cleanQ)) {
          setActiveCopyTab(canal);
          setCopyOpen(true);
          break;
        }
      }
    }

    setTimeout(() => {
      const allMarks = Array.from(document.querySelectorAll('mark[data-c]')) as HTMLElement[];
      const found = allMarks.find(el => {
        const text = (el.innerText || el.textContent || '').trim();
        return text === cleanQ || text.includes(cleanQ) || cleanQ.includes(text);
      });
      if (found) {
        found.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        found.style.transition = 'box-shadow 0.3s ease, background-color 0.3s ease';
        const origBg = found.style.backgroundColor;
        found.style.backgroundColor = '#00ff99';
        found.style.boxShadow = '0 0 0 3px rgba(2, 79, 255, 0.4)';
        setTimeout(() => {
          found.style.backgroundColor = origBg;
          found.style.boxShadow = '';
        }, 1500);
        const markId = found.dataset.c;
        if (markId) {
          handleMarkClick(markId, found);
        }
      }
    }, 60);
  };



  const closePop = () => {
    const currentPop = popRefVal.current;
    if (!currentPop) return;
    if (currentPop.isDraft) {
      const currentThreads = threadsRefVal.current;
      const t = currentThreads[currentPop.id];
      if (!t || !t.items || !t.items.length) {
        const mark = document.querySelector(`mark[data-c="${currentPop.id}"]`);
        if (mark) mark.replaceWith(...Array.from(mark.childNodes));
        setThreads(prev => {
          const c = { ...prev };
          delete c[currentPop.id];
          return c;
        });
      }
    }
    setPop(null);
    setPopInput('');
  };

  const sendPop = (incomingText?: string) => {
    const text = (incomingText ?? popInput).trim();
    if (!pop || !text) return;
    const d = new Date();
    const when = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const quote = threads[pop.id]?.quote;
    const item = { author: user?.name || user?.email || 'Usuario', when, text };
    setThreads(prev => ({
      ...prev,
      [pop.id]: {
        ...prev[pop.id],
        items: [...(prev[pop.id]?.items || []), item],
      },
    }));
    setPop(prev => (prev ? { ...prev, isDraft: false } : null));
    if (ticket?.id) {
      const payload = quote ? `«${quote}»: ${text}` : text;
      createCommentMutation.mutate(payload);
    }
    setPopInput('');
  };

  const resolvePop = () => {
    if (!pop) return;
    const mark = document.querySelector(`mark[data-c="${pop.id}"]`);
    if (mark) mark.replaceWith(...Array.from(mark.childNodes));
    setThreads(prev => {
      const c = { ...prev };
      delete c[pop.id];
      return c;
    });
    setPop(null);
    setPopInput('');
  };

  // Missing fields validation (requeridos para crear ticket nuevo)
  const missing: string[] = [];
  if (!formData.title.trim()) missing.push('nombre');
  if (!formData.clientId) missing.push('cliente');
  if (!(formData.ownerId || formData.assigneeIds.length)) missing.push('responsable');
  if (!isEditing && !(formData.tiposContenido || []).length) missing.push(isPieza ? 'formato' : 'tipo de entregable');

  // Submit / Next Status Primary Action
  const handlePrimary = async () => {
    if (!isEditing && missing.length > 0) {
      setError(`Completá los campos requeridos: ${missing.join(' y ')}`);
      return;
    }
    if (isEditing) {
      handleNextStatusClickModal();
    } else {
      const primaryOwner = formData.ownerId || formData.assigneeIds[0];
      const payload: any = {
        title: formData.title,
        clientId: formData.clientId,
        ownerId: primaryOwner,
        assigneeIds: formData.assigneeIds,
        status: formData.status,
        prioridad: formData.prioridad,
        objetivo: formData.brief || null,
        canales: noContenido ? [] : (formData.canales.length > 0 ? formData.canales : ['LinkedIn']),
        dueDate: formData.dueDate || null,
        plannedDate: formData.fechaPub || null,
        ticketTypeId: formData.ticketTypeId || null,
        tiposContenido: formData.tiposContenido,
        pilarId: noContenido ? null : (formData.pilarId || null),
        speakerId: noContenido ? null : (formData.speakerId || null),
        links: formData.links.map(ensureAbsoluteUrl),
        linkEntregable: formData.linkEntregable ? ensureAbsoluteUrl(formData.linkEntregable) : null,
        linkPublicacion: formData.linkPublicacion ? ensureAbsoluteUrl(formData.linkPublicacion) : null,
      };
      if (esPrensa) {
        payload.area = 'PRENSA';
        payload.medio = formData.medio || null;
        payload.periodista = formData.periodista || null;
        payload.estadoRespuesta = formData.estadoRespuesta || null;
      }
      try {
        await createMutation.mutateAsync(payload);
        handleClose();
      } catch {
        // error already set
      }
    }
  };

  const handleSelectStatusModal = async (targetStatus: string) => {
    setStatesOpen(false);
    if (!ticket?.id) return;
    if (esPrensa) {
      handleChange('subEstado', targetStatus, true);
    } else {
      handleChange('status', targetStatus, true);
    }
  };

  const nextStatusInfo = getNextStatusInfo(
    formData.status,
    esPrensa,
    (ticket as any)?.subEstado ?? formData.estadoRespuesta,
    formData.tiposContenido,
    (ticket as any)?.ticketType,
    formData.title
  );

  const handleNextStatusClickModal = () => {
    handleSelectStatusModal(nextStatusInfo.next);
  };

  const duplicar = async () => {
    if (!ticket?.id || isDuplicating) return;
    try {
      setIsDuplicating(true);
      if (dirtyFieldsRef.current.size > 0) {
        await performAutoSave();
      }

      const primaryOwner = formData.ownerId || formData.assigneeIds[0] || (ticket as any).ownerId || ticket.owner?.id;
      const baseTitle = (ticket.title || formData.title || '').trim();
      const newTitle = baseTitle.startsWith('Copia de ') ? baseTitle : `Copia de ${baseTitle}`;

      const payload: any = {
        title: newTitle,
        clientId: formData.clientId || (ticket as any).clientId || ticket.client?.id,
        ownerId: primaryOwner,
        assigneeIds: formData.assigneeIds?.length > 0 ? formData.assigneeIds : (ticket.assigneeIds || []),
        status: 'PENDIENTE',
        prioridad: formData.prioridad || ticket.prioridad || 'MEDIA',
        objetivo: formData.brief || ticket.objetivo || null,
        canales: noContenido ? [] : (formData.canales?.length > 0 ? formData.canales : (ticket.canales || ['LinkedIn'])),
        dueDate: null,
        plannedDate: null,
        ticketTypeId: formData.ticketTypeId || (ticket as any).ticketTypeId || ticket.ticketType?.id || null,
        tiposContenido: formData.tiposContenido || (ticket as any).tiposContenido || [],
        pilarId: noContenido ? null : (formData.pilarId || (ticket as any).pilarId || ticket.pilar?.id || null),
        speakerId: noContenido ? null : (formData.speakerId || (ticket as any).speakerId || ticket.speaker?.id || null),
        links: formData.links || ticket.links || [],
        linkEntregable: null,
        contentPerCanal: formData.contentPerCanal || (ticket as any).contentPerCanal || {},
        notasAudiovisual: formData.notasAudiovisual || (ticket as any).notasAudiovisual || null,
        referenciasGraficas: (ticket as any).referenciasGraficas || null,
      };

      if (esPrensa) {
        payload.area = 'PRENSA';
        payload.medio = formData.medio || (ticket as any).medio || null;
        payload.periodista = formData.periodista || (ticket as any).periodista || null;
        payload.estadoRespuesta = formData.estadoRespuesta || (ticket as any).estadoRespuesta || null;
      }

      const res = await api.createTicket(payload);
      if (res?.data) {
        queryClient.setQueryData(['tickets'], (old: any) => {
          if (!old?.data) return old;
          return { ...old, data: [res.data, ...old.data] };
        });
      }
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      handleClose();
    } catch (err: any) {
      console.error('Error al duplicar ticket:', err);
      setError(err?.message || 'Error al duplicar el ticket');
    } finally {
      setIsDuplicating(false);
    }
  };

  if (!isOpen) return null;

  const currentCopyText = formData.contentPerCanal[activeCopyTab] || '';
  const copyLimit = LIMITS[activeCopyTab] || 0;
  const visibleCopyLength = (copyRef.current?.innerText ?? currentCopyText.replace(/<[^>]*>/g, '')).trim().length;
  const isCopyOver = copyLimit > 0 && visibleCopyLength > copyLimit;

  // Speaker suggestion
  const pickedSpeaker = speakers.find((s: any) => s.id === formData.speakerId);
  const getSpeakerName = (s: any) => (s ? s.nombre || s.name || '' : '');
  const getSpeakerCargo = (s: any) => (s ? s.cargo || s.role || 'Vocero' : 'Vocero');
  const suggestedSpeaker = !formData.speakerId && speakers.length > 0
    ? speakers.find((s: any) => {
        const sName = getSpeakerName(s);
        return sName ? (formData.title || '').toLowerCase().includes(sName.toLowerCase()) : false;
      })
    : null;

  // Status pills
  const statusLabel = esPrensa
    ? (formData.subEstado || 'Pendiente')
    : (STATUS_OPTIONS.find(s => s.value === formData.status)?.label ?? formData.status);

  const isPendiente = ['PENDIENTE', 'Pendiente'].includes(formData.status);
  const isRedaccion = ['REDACCION', 'Redacción', 'Redaccion'].includes(formData.status);
  const isPendienteORedaccion = isPendiente || isRedaccion;
  const isDisenoOEdicion = DESIGN_STATES.includes(formData.status);

  const isCollapsibleBrief = isEditing && ['REVISION_INTERNA', 'CLIENTE', 'ESPERANDO_FEEDBACK', 'LISTO_PARA_PUBLICAR', 'PUBLICADO', 'LISTO'].includes(formData.status);
  const showBriefContent = !isCollapsibleBrief || briefOpen;

  // En Diseño y estados posteriores, el copy aparece colapsado por defecto
  const isCollapsibleCopy = isPieza && isEditing && ['DISENO', 'EDICION', 'REVISION_INTERNA', 'CLIENTE', 'ESPERANDO_FEEDBACK', 'LISTO_PARA_PUBLICAR', 'PUBLICADO', 'LISTO'].includes(formData.status);
  const showCopyContent = !isCollapsibleCopy || copyOpen;

  // Notas de diseño se muestran en Pendiente, Redacción, Diseño y estados posteriores.
  // En Pendiente son colapsables (el copy aparece antes). En Redacción aparecen abiertas (el copy aparece antes).
  // En Diseño y Edición aparecen abiertas (antes del copy). De Revisión interna en adelante, aparecen colapsadas.
  const showNotas = isPieza && (
    isPendienteORedaccion ||
    DESIGN_STATES.includes(formData.status) ||
    ['REVISION_INTERNA', 'CLIENTE', 'ESPERANDO_FEEDBACK', 'LISTO_PARA_PUBLICAR', 'PUBLICADO', 'LISTO'].includes(formData.status) ||
    !!formData.notasAudiovisual?.trim()
  );
  const isCollapsibleNotas = isPieza && (
    isPendiente ||
    ['REVISION_INTERNA', 'CLIENTE', 'ESPERANDO_FEEDBACK', 'LISTO_PARA_PUBLICAR', 'PUBLICADO', 'LISTO'].includes(formData.status)
  );
  const showNotasContent = !isCollapsibleNotas || notasOpen;

  const teamList = (users?.data ?? []) as any[];
  const filteredTeam = teamList.filter((u: any) =>
    !formData.assigneeIds.includes(u.id) &&
    u.name.toLowerCase().includes(ownerQuery.trim().toLowerCase())
  );

  const formatList = isPieza ? FORMATOS_PIEZA : TIPOS_TAREA;

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 md:p-4 bg-[rgba(0,14,31,.55)] bg-black/40 backdrop-blur-[2px]"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[1100px] h-[calc(100vh-20px)] sm:h-[calc(100vh-32px)] bg-white rounded-[14px] flex flex-col overflow-hidden shadow-[0_24px_64px_rgba(0,14,31,.35)] font-anek animate-in fade-in zoom-in-95 duration-150"
      >

        {/* HEADER */}
        <div className="flex items-center gap-4 px-5 sm:px-6 py-3.5 border-b border-[#d6dde5] flex-wrap bg-white shrink-0">
          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="text-[18px] font-extrabold text-[#0d0d0d] tracking-[-0.01em]">
                {isEditing ? 'Editar ticket' : 'Nuevo ticket'}
              </span>
              {isTicketLoading && (
                <span className="text-xs text-[#8c96a3] font-medium flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando…
                </span>
              )}
              {isEditing && !isTicketLoading && (
                <span className="text-[10px] font-bold tracking-[0.08em] uppercase px-2 py-0.5 rounded-full bg-[#eef3f7] text-[#3a4655]">
                  {statusLabel}
                </span>
              )}
              {saveStatus === 'saving' && <span className="text-[11px] text-[#8c96a3]">Guardando…</span>}
              {saveStatus === 'saved' && <span className="text-[11px] text-[#00a86b] font-medium">Guardado</span>}
            </div>
            <span className="text-[12px] text-[#5b6675] truncate">
              {isEditing
                ? (selectedClient?.name || 'Ticket')
                : (isPieza ? 'Pieza de contenido para un cliente' : esPrensa ? 'Gestión de prensa' : 'Tarea interna o para un cliente')}
            </span>
          </div>

          {!isEditing && (
            <div className="flex p-[3px] bg-[#eef3f7] rounded-[9px] gap-0.5">
              <button
                type="button"
                onClick={() => setTipoTicket('CONTENIDO')}
                className={`border-0 cursor-pointer font-anek text-[13px] font-bold px-4 py-1.5 rounded-[7px] transition-all ${
                  isPieza ? 'bg-white text-[#024fff] shadow-[0_1px_2px_rgba(0,14,31,.12)]' : 'bg-transparent text-[#5b6675]'
                }`}
              >
                Pieza
              </button>
              <button
                type="button"
                onClick={() => setTipoTicket('TAREA')}
                className={`border-0 cursor-pointer font-anek text-[13px] font-bold px-4 py-1.5 rounded-[7px] transition-all ${
                  esTarea ? 'bg-white text-[#024fff] shadow-[0_1px_2px_rgba(0,14,31,.12)]' : 'bg-transparent text-[#5b6675]'
                }`}
              >
                Tarea
              </button>
            </div>
          )}

          {isEditing && ticket?.id && (
            <button
              type="button"
              onClick={() => {
                try {
                  navigator.clipboard.writeText(window.location.href);
                  setLinkCopiado(true);
                  setTimeout(() => setLinkCopiado(false), 2000);
                } catch (err) {
                  console.error('Error al copiar link:', err);
                }
              }}
              title="Copiar link al ticket"
              className={`flex items-center gap-1.5 border border-[#d6dde5] cursor-pointer font-anek text-[13px] font-bold px-3 py-1.5 rounded-[8px] transition-all ${
                linkCopiado
                  ? 'bg-[#00ff99]/20 text-[#00663a] border-[#00ff99]/50'
                  : 'bg-white text-[#3a4655] hover:bg-[#eef3f7] hover:text-[#0d0d0d]'
              }`}
            >
              {linkCopiado ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#00a86b]" />
                  <span>¡Link copiado!</span>
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5 text-[#5b6675]" />
                  <span>Copiar link</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleClose}
            title="Cerrar (Esc)"
            className="w-8 h-8 border-0 bg-transparent rounded-lg cursor-pointer text-[#5b6675] hover:bg-[#eef3f7] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col md:flex-row items-stretch min-h-full">

            {/* MAIN COLUMN */}
            <div className="flex-1 min-w-0 p-6 sm:p-7 pb-12 flex flex-col gap-6 box-border bg-white">

            {/* Title input */}
            <input
              value={formData.title}
              onChange={e => handleChange('title', e.target.value)}
              onBlur={() => triggerImmediateAutoSave()}
              placeholder={isPieza ? 'Nombre de la pieza' : 'Nombre del pedido'}
              autoFocus
              className="border-0 border-b-2 border-[#d6dde5] focus:border-[#024fff] outline-none font-anek text-[20px] font-extrabold tracking-[-0.015em] py-1 pb-2 text-[#0d0d0d] bg-transparent w-full transition-colors placeholder:text-[#8c96a3]"
            />

            {/* Brief collapsible banner */}
            {isCollapsibleBrief && (
              <button
                type="button"
                onClick={() => setBriefOpen(!briefOpen)}
                className="flex items-center gap-3 w-full p-3 px-3.5 border border-[#d6dde5] rounded-[10px] bg-[#f7fafc] hover:bg-[#eef3f7] cursor-pointer font-anek text-left transition-colors"
              >
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">
                    {isPieza ? 'Brief' : 'Descripción'} <span className="font-normal">y {isPieza ? 'material de referencia' : 'recursos'}</span>
                  </span>
                  {!briefOpen && (
                    <span className="text-[14px] text-[#1d2a3a] truncate block">
                      {formData.brief?.trim().split('\n')[0] || 'Sin brief todavía'}
                    </span>
                  )}
                </div>
                {formData.links.length > 0 && (
                  <span className="shrink-0 whitespace-nowrap text-[12px] text-[#5b6675]">
                    {formData.links.length === 1 ? '1 recurso' : `${formData.links.length} recursos`}
                  </span>
                )}
                <span className="shrink-0 whitespace-nowrap flex items-center gap-1 text-[13px] font-bold text-[#024fff]">
                  {briefOpen ? 'Ocultar' : 'Ver brief'}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${briefOpen ? 'rotate-180' : ''}`} />
                </span>
              </button>
            )}

            {/* Brief & Recursos Content */}
            {showBriefContent && (
              <div className="flex flex-col gap-2">
                {!isCollapsibleBrief && (
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">
                      {isPieza ? 'Brief' : 'Descripción'} <span className="font-normal">y {isPieza ? 'material de referencia' : 'recursos'}</span>
                    </label>
                    <span className="text-[13px] text-[#5b6675]">
                      {isPieza
                        ? 'Insumos para armar la pieza: fotos, logos, documentos o ejemplos que sirvan de guía.'
                        : 'Lo que haga falta para resolver el pedido: documentos, datos, ejemplos o versiones anteriores.'}
                    </span>
                  </div>
                )}

                <div className="border border-[#d6dde5] rounded-[10px] overflow-hidden bg-white">
                  {/* Toolbar */}
                  <TextFormatToolbar
                    editorRef={briefRef}
                    value={formData.brief || ''}
                    onChange={val => handleChange('brief', val)}
                    onComment={() => triggerCommentForEditor(briefRef)}
                  />

                  {/* RichTextEditor */}
                  <RichTextEditor
                    ref={briefRef}
                    value={formData.brief || ''}
                    onChange={val => handleChange('brief', val)}
                    onBlur={() => triggerImmediateAutoSave()}
                    onMarkClick={handleMarkClick}
                    onMarkHover={handleMarkHover}
                    placeholder={isPieza ? 'Qué querés comunicar y por qué' : 'Descripción — detalle del pedido'}
                    minHeight="110px"
                    maxHeight="320px"
                    className="p-3 sm:p-3.5"
                  />

                  {/* Attached resources chips */}
                  {(formData.links.length > 0 || attachedFiles.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 p-3 pt-0">
                      {formData.links.map((link, idx) => (
                        <span
                          key={`link-${idx}`}
                          className="flex items-center gap-1.5 max-w-full py-1 pl-2.5 pr-1 border border-[#d6dde5] rounded-full bg-[#f7fafc] box-border text-[13px] text-[#1d2a3a]"
                        >
                          <Link2 className="w-3.5 h-3.5 text-[#024fff] shrink-0" />
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="max-w-[260px] truncate text-[#1d2a3a] hover:text-[#024fff]"
                          >
                            {link}
                          </a>
                          <button
                            type="button"
                            onClick={() => removeRecurso(idx)}
                            title="Quitar"
                            className="border-0 bg-transparent cursor-pointer text-[#8c96a3] w-5 h-5 shrink-0 rounded-full flex items-center justify-center hover:bg-[#d6dde5] hover:text-[#0d0d0d]"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      {attachedFiles.map(file => (
                        <span
                          key={`file-${file.id}`}
                          className="flex items-center gap-1.5 max-w-full py-1 pl-2.5 pr-1 border border-[#d6dde5] rounded-full bg-[#f7fafc] box-border text-[13px] text-[#1d2a3a]"
                        >
                          <Paperclip className="w-3.5 h-3.5 text-[#024fff] shrink-0" />
                          <span className="max-w-[200px] truncate text-[#1d2a3a]">
                            {file.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => setAttachedFiles(prev => prev.filter(f => f.id !== file.id))}
                            title="Quitar"
                            className="border-0 bg-transparent cursor-pointer text-[#8c96a3] w-5 h-5 shrink-0 rounded-full flex items-center justify-center hover:bg-[#d6dde5] hover:text-[#0d0d0d]"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Resource input row */}
                  <div className="flex items-center gap-1.5 p-1.5 px-2 border-t border-[#eef3f7] bg-[#f7fafc]">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Adjuntar archivo"
                      className="w-7 h-7 shrink-0 border-0 bg-transparent rounded-md cursor-pointer text-[#3a4655] flex items-center justify-center hover:bg-[#eef3f7]"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <input
                      value={recursoInput}
                      onChange={e => setRecursoInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addRecurso();
                        }
                      }}
                      placeholder={isPieza ? 'Pegá un link a fotos, logos o documentos y presioná Enter' : 'Pegá un link a documentos o ejemplos y presioná Enter'}
                      className="flex-1 min-w-0 h-7 font-anek text-[13px] px-1.5 border-0 outline-none bg-transparent placeholder:text-[#8c96a3]"
                    />
                    {recursoInput.trim().length > 0 && (
                      <button
                        type="button"
                        onClick={addRecurso}
                        className="h-7 px-3 border-0 bg-[#024fff] rounded-md cursor-pointer font-anek text-[12px] font-bold text-white hover:bg-[#0c57d3]"
                      >
                        Agregar
                      </button>
                    )}
                    <input
                      type="file"
                      multiple
                      ref={fileInputRef}
                      onChange={handleFiles}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Diseño final / Entregable */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">
                {isPieza ? 'Diseño final' : 'Link del entregable'}
              </label>
              <span className="text-[13px] text-[#5b6675] -mt-1">
                {isPieza
                  ? 'Links a la pieza terminada, lista para revisar. Lo carga quien diseña.'
                  : 'Links a lo que se entregó, listo para revisar. Lo carga quien resuelve el pedido.'}
              </span>

              {/* Lista de links de entrega */}
              {parseDeliverableLinks(formData.linkEntregable).length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {parseDeliverableLinks(formData.linkEntregable).map((link, idx) => (
                    <div
                      key={`modal-entregable-${idx}`}
                      className="flex items-center gap-2.5 p-2 px-3 bg-[#024fff]/5 border border-[#024fff]/25 rounded-lg group transition-colors hover:bg-[#024fff]/8"
                    >
                      <div className="w-7 h-7 rounded-md bg-[#024fff]/10 flex items-center justify-center text-[#024fff] shrink-0">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </div>
                      <a
                        href={ensureAbsoluteUrl(link)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 font-anek text-[14px] font-semibold text-[#024fff] hover:underline truncate"
                        title={link}
                      >
                        <span className="truncate">{link}</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          const current = parseDeliverableLinks(formData.linkEntregable);
                          const next = current.filter((_, i) => i !== idx);
                          handleChange('linkEntregable', serializeDeliverableLinks(next) || '', true);
                        }}
                        className="border-0 bg-transparent cursor-pointer text-[#8c96a3] hover:text-red-500 p-1 rounded hover:bg-white/80 transition-colors"
                        title="Eliminar link"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input para agregar link de entrega */}
              <div className="flex items-center gap-2">
                <input
                  value={entregableInput}
                  onChange={e => setEntregableInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const v = entregableInput.trim();
                      if (v) {
                        const current = parseDeliverableLinks(formData.linkEntregable);
                        const next = [...current, ensureAbsoluteUrl(v)];
                        setEntregableInput('');
                        handleChange('linkEntregable', serializeDeliverableLinks(next) || '', true);
                      }
                    }
                  }}
                  placeholder={isPieza ? 'Pegá un link al diseño terminado y presioná Enter' : 'Pegá un link a la entrega y presioná Enter'}
                  className="flex-1 h-10 px-3 border border-[#d6dde5] rounded-lg text-[14px] text-[#0d0d0d] font-anek outline-none focus:border-[#024fff] focus:ring-2 focus:ring-[#024fff]/12 transition-all placeholder:text-[#8c96a3]"
                />
                {entregableInput.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      const v = entregableInput.trim();
                      if (v) {
                        const current = parseDeliverableLinks(formData.linkEntregable);
                        const next = [...current, ensureAbsoluteUrl(v)];
                        setEntregableInput('');
                        handleChange('linkEntregable', serializeDeliverableLinks(next) || '', true);
                      }
                    }}
                    className="h-10 px-3 border border-[#024fff] bg-[#024fff] text-white rounded-lg text-[13px] font-bold font-anek cursor-pointer hover:bg-[#0c57d3] transition-colors shrink-0"
                  >
                    Agregar
                  </button>
                )}
              </div>
            </div>

            {/* Notas de diseño y Copy (en Pendiente y Redacción el copy aparece primero) */}
            {(() => {
              const notasNode = showNotas && (
                <div className="flex flex-col gap-2">
                  {isCollapsibleNotas && (
                    <button
                      type="button"
                      onClick={() => setNotasOpen(!notasOpen)}
                      className="flex items-center gap-3 w-full p-3 px-3.5 border border-[#d6dde5] rounded-[10px] bg-[#f7fafc] hover:bg-[#eef3f7] cursor-pointer font-anek text-left transition-colors"
                    >
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">
                          Notas de diseño
                        </span>
                        {!notasOpen && (
                          <span className="text-[14px] text-[#1d2a3a] truncate block">
                            {formData.notasAudiovisual?.replace(/<[^>]+>/g, '').trim().split('\n')[0] || 'Sin notas de diseño'}
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 whitespace-nowrap flex items-center gap-1 text-[13px] font-bold text-[#024fff]">
                        {notasOpen ? 'Ocultar' : 'Ver notas'}
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${notasOpen ? 'rotate-180' : ''}`} />
                      </span>
                    </button>
                  )}

                  {showNotasContent && (
                    <div className="flex flex-col gap-1.5">
                      {!isCollapsibleNotas && (
                        <div className="flex flex-col gap-0.5">
                          <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">
                            Notas de diseño
                          </label>
                          <span className="text-[13px] text-[#5b6675]">
                            Indicaciones para quien diseña o edita: estilo, referencias, textos que van en la pieza.
                          </span>
                        </div>
                      )}
                      <div className="border border-[#d6dde5] rounded-[10px] overflow-hidden bg-white">
                        <TextFormatToolbar
                          editorRef={notasRef}
                          value={formData.notasAudiovisual || ''}
                          onChange={val => handleChange('notasAudiovisual', val)}
                          onComment={() => triggerCommentForEditor(notasRef)}
                        />
                        <RichTextEditor
                          ref={notasRef}
                          value={formData.notasAudiovisual || ''}
                          onChange={val => handleChange('notasAudiovisual', val)}
                          onBlur={() => triggerImmediateAutoSave()}
                          onMarkClick={handleMarkClick}
                          onMarkHover={handleMarkHover}
                          placeholder="Ej.: placa estilo «en medios», usar logos de los medios, foto del vocero…"
                          minHeight="110px"
                          className="p-3.5"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );

              const copyNode = isPieza && (
                <>
                  {formData.canales.length === 0 && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">Copy</label>
                      <div className="flex items-center gap-3 flex-wrap p-4 border border-dashed border-[#b9c2cd] rounded-[10px] bg-[#f7fafc]">
                        <span className="flex-1 text-[14px] text-[#5b6675]">Elegí para qué red es el copy.</span>
                        <div className="flex gap-1.5 flex-wrap">
                          {redesDisponibles.map(rd => (
                            <button
                              key={rd}
                              type="button"
                              onClick={() => toggleRed(rd)}
                              className="border border-[#024fff] bg-white text-[#024fff] cursor-pointer font-anek text-[13px] font-bold px-3 py-1.5 rounded-full hover:bg-[#024fff]/8 transition-colors"
                            >
                              + {rd}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.canales.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {isCollapsibleCopy && (
                        <button
                          type="button"
                          onClick={() => setCopyOpen(!copyOpen)}
                          className="flex items-center gap-3 w-full p-3 px-3.5 border border-[#d6dde5] rounded-[10px] bg-[#f7fafc] hover:bg-[#eef3f7] cursor-pointer font-anek text-left transition-colors"
                        >
                          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">Copy</span>
                              <span className="text-[11px] text-[#8c96a3]">({formData.canales.join(', ')})</span>
                            </div>
                            {!copyOpen && (
                              <span className="text-[14px] text-[#1d2a3a] truncate block">
                                {currentCopyText?.replace(/<[^>]+>/g, '').trim().split('\n')[0] || 'Sin copy redactado'}
                              </span>
                            )}
                          </div>
                          <span className="shrink-0 whitespace-nowrap flex items-center gap-1 text-[13px] font-bold text-[#024fff]">
                            {copyOpen ? 'Ocultar' : 'Ver copy'}
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${copyOpen ? 'rotate-180' : ''}`} />
                          </span>
                        </button>
                      )}

                      {showCopyContent && (
                        <div className="flex flex-col gap-1.5">
                          {!isCollapsibleCopy && (
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">Copy</label>
                            </div>
                          )}
                          <div className="border border-[#d6dde5] rounded-[10px] overflow-hidden bg-white">
                            {/* Network tabs row */}
                            <div className="flex items-center justify-between gap-2 p-1.5 px-2 bg-[#f7fafc] border-b border-[#d6dde5] flex-wrap">
                              <div className="flex items-center gap-1 p-0.5 bg-[#eef3f7] rounded-lg">
                                {formData.canales.map((r: string) => (
                                  <button
                                    key={r}
                                    type="button"
                                    onClick={() => setActiveCopyTab(r)}
                                    className={`border-0 cursor-pointer font-anek text-[13px] font-bold px-3 py-1 rounded-md transition-all ${
                                      activeCopyTab === r ? 'bg-white text-[#024fff] shadow-sm' : 'bg-transparent text-[#5b6675] hover:bg-white/50'
                                    }`}
                                  >
                                    {r}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Standard consistent toolbar */}
                            <TextFormatToolbar
                              editorRef={copyRef}
                              value={currentCopyText}
                              onChange={val => {
                                const nextPerCanal = { ...formData.contentPerCanal, [activeCopyTab]: val };
                                handleChange('contentPerCanal', nextPerCanal);
                              }}
                              onComment={() => triggerCommentForEditor(copyRef)}
                            />

                            {/* RichTextEditor */}
                            <RichTextEditor
                              ref={copyRef}
                              value={currentCopyText}
                              onChange={val => {
                                const nextPerCanal = { ...formData.contentPerCanal, [activeCopyTab]: val };
                                handleChange('contentPerCanal', nextPerCanal);
                              }}
                              onBlur={() => triggerImmediateAutoSave()}
                              onMarkClick={handleMarkClick}
                              onMarkHover={handleMarkHover}
                              placeholder={`Copy para ${activeCopyTab}…`}
                              minHeight="140px"
                              className="p-3.5 sm:p-4"
                            />

                            <div className="flex justify-end p-2 px-3 border-t border-[#eef3f7] text-[12px] text-[#8c96a3]">
                              <span className={isCopyOver ? 'text-[#d4380d] font-bold' : ''}>
                                {copyLimit > 0
                                  ? `${visibleCopyLength.toLocaleString('es-AR')} / ${copyLimit.toLocaleString('es-AR')}`
                                  : `${visibleCopyLength} caracteres`}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              );

              // Las notas de diseño quedan siempre abajo del copy, excepto en Diseño/Edición donde van arriba
              return isDisenoOEdicion ? (
                <>
                  {notasNode}
                  {copyNode}
                </>
              ) : (
                <>
                  {copyNode}
                  {notasNode}
                </>
              );
            })()}

            {/* Link a la Publicación (a partir de listo para publicar en adelante) */}
            {['LISTO_PARA_PUBLICAR', 'PUBLICADO', 'LISTO'].includes(formData.status) && (
              <TicketPublishLinks
                value={formData.linkPublicacion}
                onChange={(nextVal) => handleChange('linkPublicacion', nextVal, true)}
                variant="modal"
              />
            )}

            {/* Comments list & input */}
            <div className="flex flex-col gap-2.5 pt-5 border-t border-[#eef3f7]">
              <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">
                Comentarios {comments.length > 0 && <span className="text-[#8c96a3] font-normal tracking-normal lowercase">({comments.length})</span>}
              </label>

              {comments.map((cm: any) => {
                const isMyComment = (cm.userId && cm.userId === user?.id) || (cm.user?.id && cm.user?.id === user?.id);
                const rawContent = cm.content || cm.text || '';
                const quoteMatch = rawContent.match(/^«([^»]+)»:\s*([\s\S]*)$/);
                const quote = cm.quote || (quoteMatch ? quoteMatch[1] : null);
                const mainContent = quoteMatch ? quoteMatch[2] : rawContent;

                return (
                  <div key={cm.id} className="flex gap-2.5 group">
                    <span className="w-7 h-7 shrink-0 rounded-full bg-[#eef3f7] text-[#024fff] text-[10px] font-bold flex items-center justify-center">
                      <span className="translate-y-[0.5px] leading-none select-none">{ini(cm.user?.name || cm.author)}</span>
                    </span>
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <div className="flex gap-2 items-center">
                        <span className="text-[13px] font-bold text-[#0d0d0d]">{cm.user?.name || cm.author || 'Usuario'}</span>
                        <span className="text-[12px] text-[#8c96a3]">
                          {cm.createdAt ? new Date(cm.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : cm.when}
                        </span>
                        {isMyComment && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('¿Eliminar este comentario?')) {
                                deleteCommentMutation.mutate(cm.id);
                              }
                            }}
                            title="Eliminar comentario"
                            className="p-1 text-[#8c96a3] hover:text-red-600 hover:bg-red-50 rounded transition-colors ml-auto cursor-pointer border-0 bg-transparent flex items-center justify-center"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      {quote && (
                        <button
                          type="button"
                          onClick={() => locateMark(quote)}
                          title="Ver fragmento en el texto"
                          className="text-[13px] text-[#5b6675] hover:text-[#024fff] p-1 pl-2.5 border-0 border-l-2 border-[#00e39c] my-0.5 bg-[#00ff99]/5 hover:bg-[#00ff99]/15 rounded-r truncate block text-left w-fit max-w-full cursor-pointer transition-colors"
                        >
                          «{quote}»
                        </button>
                      )}
                      <span className="text-[14px] leading-relaxed text-[#1d2a3a] whitespace-pre-wrap">
                        {formatCommentWithMentions(mainContent)}
                      </span>
                    </div>
                  </div>
                );
              })}

              <div className="flex gap-2.5 items-start mt-3 mb-8">
                <span className="w-7 h-7 shrink-0 rounded-full bg-[#024fff] text-white text-[10px] font-bold flex items-center justify-center">
                  <span className="translate-y-[0.5px] leading-none select-none">{ini(user?.name || user?.email || 'YO')}</span>
                </span>
                <div className="flex-1 min-w-0 flex flex-col gap-2.5">
                  <MentionTextarea
                    value={commentInput}
                    onChange={setCommentInput}
                    placeholder="Escribí un comentario para el equipo (usá @ para mencionar)…"
                    rows={3}
                    users={teamList}
                    className="w-full font-anek text-[14px] p-2.5 px-3 border border-[#d6dde5] rounded-lg outline-none resize-y min-h-[64px] focus:border-[#024fff] focus:ring-2 focus:ring-[#024fff]/12 transition-all placeholder:text-[#8c96a3]"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (ticket?.id && commentInput.trim()) {
                          createCommentMutation.mutate(commentInput.trim());
                        }
                      }}
                      disabled={!commentInput.trim() || createCommentMutation.isPending}
                      className={`h-8 px-4 rounded-lg font-anek text-[13px] font-bold transition-all flex items-center gap-1.5 ${
                        commentInput.trim() && !createCommentMutation.isPending
                          ? 'bg-[#024fff] hover:bg-[#0c57d3] text-white cursor-pointer shadow-sm'
                          : 'bg-[#eef3f7] text-[#8c96a3] cursor-not-allowed border border-[#d6dde5]'
                      }`}
                    >
                      {createCommentMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Comentar</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* SIDEBAR COLUMN */}
          <div className="w-full md:w-[320px] lg:w-[340px] bg-[#f7fafc] border-t md:border-t-0 md:border-l border-[#d6dde5] p-6 pb-8 flex flex-col gap-5 shrink-0">

            <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center row-gap-2.5 col-gap-3">
              {/* Cliente */}
              <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">Cliente</label>
              <div className="relative min-w-0">
                <select
                  value={formData.clientId}
                  onChange={e => handleChange('clientId', e.target.value, true)}
                  className="w-full h-[36px] font-anek text-[14px] pl-2.5 pr-8 border border-[#d6dde5] rounded-lg bg-white outline-none text-[#0d0d0d] min-w-0 focus:border-[#024fff] appearance-none py-0 leading-[34px] cursor-pointer"
                >
                  {!formData.clientId && <option value="">Seleccionar</option>}
                  {availableClients.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#5b6675] pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
              </div>

              {/* Formato / Tipo de entregable */}
              <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5b6675] mt-2">
                {isPieza ? 'Formato' : 'Tipo de entregable'} <span className="text-[#024fff]">*</span>
              </label>
              <div ref={fmtMenuRef} className="relative min-w-0 mt-2">
                <button
                  type="button"
                  onClick={() => setFmtOpen(!fmtOpen)}
                  className={`w-full h-[36px] flex items-center gap-2 px-2.5 border rounded-lg bg-white cursor-pointer font-anek text-[14px] text-left transition-colors ${
                    formData.tiposContenido.length > 0 ? 'text-[#0d0d0d] border-[#d6dde5]' : 'text-[#8c96a3] border-[#b9c2cd]'
                  }`}
                >
                  <span className="flex-1 min-w-0 truncate leading-none flex items-center">
                    {formData.tiposContenido.length > 0 ? formData.tiposContenido.join(', ') : 'Seleccionar…'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#5b6675] shrink-0" />
                </button>

                {fmtOpen && (
                  <div className="absolute top-[42px] left-0 right-0 min-w-[220px] max-h-[300px] overflow-auto bg-white border border-[#d6dde5] rounded-[10px] shadow-[0_12px_32px_rgba(0,14,31,.16)] p-1.5 z-40 flex flex-col gap-0.5">
                    <div className="flex items-center justify-between p-1.5 px-2 border-b border-[#eef3f7] mb-1">
                      <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#8c96a3]">Elegí 1 o más</span>
                      <button
                        type="button"
                        onClick={() => setFmtOpen(false)}
                        className="border-0 bg-transparent cursor-pointer font-anek text-[13px] font-bold text-[#024fff] p-1"
                      >
                        Listo
                      </button>
                    </div>
                    {formatList.map(f => {
                      const on = formData.tiposContenido.includes(f);
                      return (
                        <label
                          key={f}
                          className={`flex items-center gap-2.5 p-1.5 px-2 rounded-md cursor-pointer text-[14px] text-[#0d0d0d] hover:bg-[#eef3f7] ${
                            on ? 'bg-[#024fff]/5' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggleFormato(f)}
                            className="w-4 h-4 rounded accent-[#024fff] shrink-0 m-0"
                          />
                          {f}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Fecha de entrega */}
              <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5b6675] mt-2">
                Fecha de entrega
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={e => handleChange('dueDate', e.target.value, true)}
                className="h-[36px] font-anek text-[14px] px-2.5 border border-[#d6dde5] rounded-lg bg-white outline-none text-[#0d0d0d] min-w-0 mt-2 focus:border-[#024fff] py-0 leading-[34px] flex items-center"
              />

              {/* Fecha de publicación (para piezas) */}
              {isPieza && (
                <>
                  <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5b6675] mt-2">
                    Fecha publicación
                  </label>
                  <input
                    type="date"
                    value={formData.fechaPub}
                    onChange={e => handleChange('fechaPub', e.target.value, true)}
                    className="h-[36px] font-anek text-[14px] px-2.5 border border-[#d6dde5] rounded-lg bg-white outline-none text-[#0d0d0d] min-w-0 mt-2 focus:border-[#024fff] py-0 leading-[34px] flex items-center"
                  />
                </>
              )}

              {/* Prioridad */}
              <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5b6675] mt-2">
                Prioridad
              </label>
              <div className="flex p-[3px] bg-[#eef3f7] rounded-lg gap-0.5 min-w-0 mt-2">
                {PRIORIDADES.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => handleChange('prioridad', p.value, true)}
                    className={`flex-1 min-w-0 border-0 cursor-pointer font-anek text-[13px] font-bold h-[30px] rounded-md flex items-center justify-center gap-1.5 transition-all ${
                      formData.prioridad === p.value
                        ? 'bg-white text-[#0d0d0d] shadow-[0_1px_2px_rgba(0,14,31,.12)]'
                        : 'bg-transparent text-[#5b6675]'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.dot }}></span>
                    <span className="leading-none flex items-center">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-[#d6dde5]"></div>

            {/* Owners / Responsables */}
            <div ref={ownersMenuRef} className="flex flex-col gap-2 relative">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">
                  {isPieza ? 'Owners' : 'Responsables'}
                </label>
                <button
                  type="button"
                  onClick={() => setOwnersOpen(!ownersOpen)}
                  className="border-0 bg-transparent cursor-pointer font-anek text-[13px] font-bold text-[#024fff] p-0.5 hover:bg-[#024fff]/8 rounded flex items-center gap-1"
                >
                  {ownersOpen ? '✕ Cerrar' : '+ Agregar'}
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 items-center">
                {formData.assigneeIds.map((uid: string) => {
                  const u = teamList.find((m: any) => m.id === uid);
                  if (!u) return null;
                  return (
                    <span
                      key={uid}
                      className="inline-flex items-center gap-1.5 h-[28px] pl-[3px] pr-2 bg-white border border-[#d6dde5] rounded-full text-[13px] font-medium leading-none box-border"
                    >
                      <span className="w-[22px] h-[22px] shrink-0 rounded-full bg-[#024fff] text-white text-[10px] font-bold flex items-center justify-center leading-none select-none">
                        <span className="translate-y-[0.5px] leading-none select-none">{ini(u.name)}</span>
                      </span>
                      <span className="leading-none select-none -translate-y-[1.5px] text-[#0d0d0d]">{u.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = formData.assigneeIds.filter((id: string) => id !== uid);
                          handleChange('assigneeIds', next, true);
                          if (formData.ownerId === uid) {
                            handleChange('ownerId', next[0] || '', true);
                          }
                        }}
                        className="border-0 bg-transparent cursor-pointer text-[#8c96a3] w-[18px] h-[18px] rounded-full flex items-center justify-center hover:bg-[#eef3f7] hover:text-[#0d0d0d] p-0 shrink-0 ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
                {formData.assigneeIds.length === 0 && (
                  <span className="text-[13px] text-[#8c96a3] py-1 flex items-center leading-none">Sin asignar</span>
                )}
              </div>

              {ownersOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20 cursor-default"
                    onClick={() => setOwnersOpen(false)}
                  />
                  <div className="absolute top-8 right-0 w-[260px] bg-white border border-[#d6dde5] rounded-[10px] shadow-[0_12px_32px_rgba(0,14,31,.16)] p-2 z-30 flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-100">
                    <div className="flex items-center justify-between pb-1 border-b border-[#eef3f7] px-0.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#5b6675]">Asignar persona</span>
                      <button
                        type="button"
                        onClick={() => setOwnersOpen(false)}
                        className="w-5 h-5 flex items-center justify-center rounded text-[#8c96a3] hover:text-[#0d0d0d] hover:bg-[#eef3f7] cursor-pointer"
                        title="Cerrar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <input
                      value={ownerQuery}
                      onChange={e => {
                        setOwnerQuery(e.target.value);
                        setSelectedOwnerIndex(0);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          setOwnersOpen(false);
                        } else if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          if (filteredTeam.length > 0) {
                            setSelectedOwnerIndex(prev => (prev + 1) % filteredTeam.length);
                          }
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          if (filteredTeam.length > 0) {
                            setSelectedOwnerIndex(prev => (prev - 1 + filteredTeam.length) % filteredTeam.length);
                          }
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          const u = filteredTeam[selectedOwnerIndex];
                          if (u) {
                            const next = [...formData.assigneeIds, u.id];
                            handleChange('assigneeIds', next, true);
                            if (!formData.ownerId) handleChange('ownerId', u.id, true);
                            setOwnerQuery('');
                            setOwnersOpen(false);
                          }
                        }
                      }}
                      autoFocus
                      placeholder="Buscar persona…"
                      className="h-8 font-anek text-[13px] px-2.5 border border-[#d6dde5] rounded-md outline-none focus:border-[#024fff]"
                    />
                    {filteredTeam.length === 0 && (
                      <span className="text-[13px] text-[#8c96a3] p-2">Nadie coincide con la búsqueda</span>
                    )}
                    {filteredTeam.map((u: any, idx: number) => {
                      const isSelected = idx === selectedOwnerIndex;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onMouseEnter={() => setSelectedOwnerIndex(idx)}
                          onClick={() => {
                            const next = [...formData.assigneeIds, u.id];
                            handleChange('assigneeIds', next, true);
                            if (!formData.ownerId) handleChange('ownerId', u.id, true);
                            setOwnerQuery('');
                            setOwnersOpen(false);
                          }}
                          className={`flex items-center gap-2.5 border-0 cursor-pointer font-anek text-[13px] p-1.5 px-2 rounded-md text-left transition-colors ${
                            isSelected ? 'bg-[#024fff]/10 text-[#024fff] font-bold' : 'bg-transparent text-[#0d0d0d] hover:bg-[#eef3f7]'
                          }`}
                        >
                          <span className="w-5 h-5 rounded-full bg-[#024fff] text-white text-[9px] font-bold flex items-center justify-center">
                            <span className="translate-y-[0.5px] leading-none select-none">{ini(u.name)}</span>
                          </span>
                          <span className="flex-1 truncate">{u.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Prensa specific fields */}
            {esPrensa && (
              <div className="flex flex-col gap-2 pt-2 border-t border-[#d6dde5]">
                <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">Datos de Prensa</label>
                <input
                  value={formData.medio}
                  onChange={e => handleChange('medio', e.target.value)}
                  onBlur={() => triggerImmediateAutoSave()}
                  placeholder="Medio (ej. Clarín, Forbes…)"
                  className="h-[36px] px-2.5 border border-[#d6dde5] rounded-lg bg-white text-[13px] outline-none focus:border-[#024fff] py-0 leading-[34px]"
                />
                <input
                  value={formData.periodista}
                  onChange={e => handleChange('periodista', e.target.value)}
                  onBlur={() => triggerImmediateAutoSave()}
                  placeholder="Periodista / Contacto"
                  className="h-[36px] px-2.5 border border-[#d6dde5] rounded-lg bg-white text-[13px] outline-none focus:border-[#024fff] py-0 leading-[34px]"
                />
              </div>
            )}

            {/* Voz del contenido (Voceros) */}
            {isPieza && (
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">Voz del contenido</label>
                <div className="flex p-[3px] bg-[#eef3f7] rounded-lg gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      handleChange('speakerId', '', true);
                      setIsChangingSpeaker(false);
                    }}
                    className={`flex-1 border-0 cursor-pointer font-anek text-[13px] font-bold h-[30px] rounded-md transition-all flex items-center justify-center leading-none ${
                      !formData.speakerId && !isChangingSpeaker ? 'bg-white text-[#024fff] shadow-sm' : 'bg-transparent text-[#5b6675]'
                    }`}
                  >
                    Marca
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!formData.speakerId) {
                        if (speakers.length === 1) {
                          handleChange('speakerId', speakers[0].id, true);
                          setIsChangingSpeaker(false);
                        } else {
                          setIsChangingSpeaker(true);
                        }
                      }
                    }}
                    className={`flex-1 border-0 cursor-pointer font-anek text-[13px] font-bold h-[30px] rounded-md transition-all flex items-center justify-center leading-none ${
                      formData.speakerId || isChangingSpeaker ? 'bg-white text-[#024fff] shadow-sm' : 'bg-transparent text-[#5b6675]'
                    }`}
                  >
                    Vocero
                  </button>
                </div>

                {suggestedSpeaker && !isChangingSpeaker && !formData.speakerId && (
                  <div className="flex items-center gap-2 p-2 bg-[#024fff]/6 rounded-lg text-[13px] text-[#1d2a3a]">
                    <span className="flex-1 truncate">El nombre menciona a <strong>{getSpeakerName(suggestedSpeaker)}</strong></span>
                    <button
                      type="button"
                      onClick={() => {
                        handleChange('speakerId', suggestedSpeaker.id, true);
                        setIsChangingSpeaker(false);
                      }}
                      className="border-0 bg-[#024fff] text-white cursor-pointer font-anek text-[12px] font-bold h-6.5 px-2.5 rounded-md"
                    >
                      Usar
                    </button>
                  </div>
                )}

                {/* Speaker selection list */}
                {isChangingSpeaker ? (
                  <div className="flex flex-col bg-white border border-[#d6dde5] rounded-[10px] p-2 gap-1.5 shadow-sm">
                    <div className="flex items-center justify-between pb-1 border-b border-[#eef3f7] px-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#5b6675]">Seleccionar vocero</span>
                      <button
                        type="button"
                        onClick={() => setIsChangingSpeaker(false)}
                        className="w-5 h-5 flex items-center justify-center rounded text-[#8c96a3] hover:text-[#0d0d0d] hover:bg-[#eef3f7] cursor-pointer"
                        title="Cerrar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {speakers.length === 0 ? (
                      <span className="text-[13px] text-[#8c96a3] p-2">Este cliente no tiene voceros configurados</span>
                    ) : (
                      <div className="flex flex-col max-h-[200px] overflow-y-auto">
                        {speakers.map((sp: any) => {
                          const isSelected = sp.id === formData.speakerId;
                          return (
                            <button
                              key={sp.id}
                              type="button"
                              onClick={() => {
                                handleChange('speakerId', sp.id, true);
                                setIsChangingSpeaker(false);
                              }}
                              className={`flex items-center gap-2.5 border-0 cursor-pointer font-anek p-2 px-2.5 rounded-md text-left transition-colors ${
                                isSelected ? 'bg-[#024fff]/10 text-[#024fff]' : 'bg-transparent text-[#0d0d0d] hover:bg-[#eef3f7]'
                              }`}
                            >
                              <span className="w-[26px] h-[26px] shrink-0 rounded-full bg-[#024fff] text-white text-[10px] font-bold flex items-center justify-center leading-none select-none">
                                {ini(getSpeakerName(sp))}
                              </span>
                              <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <span className="text-[13px] font-bold truncate leading-tight">{getSpeakerName(sp)}</span>
                                <span className="text-[12px] text-[#5b6675] truncate leading-tight">{getSpeakerCargo(sp)}</span>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-[#024fff] shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : pickedSpeaker ? (
                  <div className="flex items-center gap-2.5 p-2 px-2.5 bg-white border border-[#024fff] rounded-[10px]">
                    <span className="w-[26px] h-[26px] shrink-0 rounded-full bg-[#024fff] text-white text-[10px] font-bold flex items-center justify-center leading-none select-none">
                      {ini(getSpeakerName(pickedSpeaker))}
                    </span>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <span className="text-[13px] font-bold text-[#0d0d0d] truncate leading-tight">{getSpeakerName(pickedSpeaker)}</span>
                      <span className="text-[12px] text-[#5b6675] truncate leading-tight">{getSpeakerCargo(pickedSpeaker)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsChangingSpeaker(true)}
                      className="border-0 bg-transparent cursor-pointer font-anek text-[13px] font-bold text-[#024fff] hover:bg-[#024fff]/8 rounded p-1 leading-none shrink-0"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            {/* Pilares de contenido */}
            {isPieza && pilares.length > 0 && (
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">Pilar de contenido</label>
                <div className="flex flex-wrap gap-1.5">
                  {pilares.map((p: any) => {
                    const on = formData.pilarId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleChange('pilarId', on ? '' : p.id, true)}
                        className={`border cursor-pointer font-anek text-[13px] font-bold px-3 py-1.5 rounded-full transition-all ${
                          on ? 'border-[#024fff] bg-[#024fff] text-white' : 'border-[#d6dde5] bg-white text-[#1d2a3a] hover:bg-[#f7fafc]'
                        }`}
                      >
                        {p.nombre}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Redes objetivo */}
            {isPieza && (
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">
                  Redes objetivo <span className="font-normal text-[#8c96a3] tracking-normal lowercase">activa el copy por red</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {redesDisponibles.map(rd => {
                    const on = formData.canales.includes(rd);
                    return (
                      <button
                        key={rd}
                        type="button"
                        onClick={() => toggleRed(rd)}
                        className={`border cursor-pointer font-anek text-[13px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all ${
                          on ? 'border-[#024fff] bg-[#024fff] text-white' : 'border-[#d6dde5] bg-white text-[#1d2a3a] hover:bg-[#f7fafc]'
                        }`}
                      >
                        {on ? '✓ ' : ''}{rd}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
          </div>
        </div>

        {/* HOVER COMMENT PREVIEW */}
        <InlineCommentHoverTooltip
          hoverComment={hoverComment}
          isVisible={!pop}
        />

        {/* INLINE COMMENT POPOVER */}
        <InlineCommentPopover
          pop={pop}
          thread={pop ? threads[pop.id] : undefined}
          users={teamList}
          onSend={(text) => sendPop(text)}
          onResolve={resolvePop}
          onClose={closePop}
        />

        {/* FOOTER */}
        <div className="flex items-center gap-3 px-5 sm:px-6 py-3 border-t border-[#d6dde5] bg-white flex-wrap shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="h-[38px] border-0 bg-transparent cursor-pointer font-anek text-[14px] font-medium text-[#3a4655] px-3 rounded-lg hover:bg-[#eef3f7] transition-colors leading-none flex items-center justify-center shrink-0 whitespace-nowrap"
          >
            {isEditing ? 'Cerrar' : 'Cancelar'}
          </button>

          {isEditing && (
            <button
              type="button"
              onClick={duplicar}
              disabled={isDuplicating}
              title="Crear un ticket nuevo con los mismos datos"
              className="h-[38px] flex items-center gap-1.5 border-0 bg-transparent cursor-pointer font-anek text-[14px] font-medium text-[#3a4655] px-3 rounded-lg hover:bg-[#eef3f7] transition-colors leading-none shrink-0 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CopyIcon className="w-3.5 h-3.5 shrink-0" /> {isDuplicating ? 'Duplicando...' : 'Duplicar'}
            </button>
          )}

          <span className="flex-1 text-[12px] text-[#5b6675] text-right truncate px-2">
            {error ? (
              <span className="text-red-600 font-medium">{error}</span>
            ) : (!isEditing && missing.length > 0) ? (
              `Falta completar: ${missing.join(' y ')}`
            ) : ''}
          </span>

          {isEditing && (
            <button
              type="button"
              onClick={() => {
                handleClose();
                navigate(`/piezas/${ticket.id}`);
              }}
              className="h-[38px] px-4 border border-[#d6dde5] bg-white rounded-lg cursor-pointer font-anek text-[13px] sm:text-[14px] font-bold text-[#0d0d0d] hover:bg-[#eef3f7] transition-colors leading-none flex items-center justify-center shrink-0 whitespace-nowrap"
            >
              Ver ticket
            </button>
          )}

          <div ref={statesMenuRef} className="flex relative shrink-0">
            <button
              type="button"
              onClick={handlePrimary}
              disabled={isEditing ? (createMutation.isPending || updateMutation.isPending) : (missing.length > 0 || createMutation.isPending || updateMutation.isPending)}
              className={`h-[38px] px-4 sm:px-4.5 border-0 font-anek text-[13px] sm:text-[14px] font-bold flex items-center justify-center gap-2 text-white transition-all whitespace-nowrap leading-none shrink-0 ${
                isEditing ? 'rounded-l-lg' : 'rounded-lg'
              } ${
                (!isEditing && missing.length > 0)
                  ? 'bg-[#b9c2cd] cursor-not-allowed'
                  : 'bg-[#024fff] hover:bg-[#0c57d3] cursor-pointer'
              }`}
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
              <span className="leading-none flex items-center whitespace-nowrap">
                {isEditing ? `Pasar a ${nextStatusInfo.label}` : 'Crear ticket'}
              </span>
              {(isEditing || missing.length === 0) && <span className="text-[11px] font-medium opacity-75 leading-none shrink-0 ml-0.5">⌘↵</span>}
            </button>

            {isEditing && (
              <>
                <button
                  type="button"
                  onClick={() => setStatesOpen(!statesOpen)}
                  title="Otros estados"
                  className="h-[38px] w-[34px] border-0 border-l border-white/30 bg-[#024fff] hover:bg-[#0c57d3] text-white rounded-r-lg cursor-pointer flex items-center justify-center transition-colors shrink-0"
                >
                  <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                </button>

                {statesOpen && (
                  <div className="absolute bottom-11 right-0 w-[220px] bg-white border border-[#d6dde5] rounded-[10px] shadow-[0_12px_32px_rgba(0,14,31,.16)] p-1.5 z-50 flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-[#8c96a3] p-1.5 pb-1">
                      Mover a
                    </span>
                    {(esPrensa ? PRENSA_STATUS_OPTIONS : STATUS_OPTIONS).map(st => {
                      const isCurrent = esPrensa
                        ? ((ticket as any)?.subEstado ?? formData.estadoRespuesta) === st.value
                        : formData.status === st.value;
                      const isNext = st.value === nextStatusInfo.next;
                      return (
                        <button
                          key={st.value}
                          type="button"
                          onClick={() => handleSelectStatusModal(st.value)}
                          className={`border-0 bg-transparent cursor-pointer font-anek text-[13px] p-2 rounded-md text-left transition-colors flex items-center justify-between ${
                            isCurrent
                              ? 'text-[#8c96a3] bg-[#f7fafc]'
                              : isNext
                              ? 'text-[#024fff] font-bold hover:bg-[#024fff]/6'
                              : 'text-[#0d0d0d] hover:bg-[#eef3f7]'
                          }`}
                        >
                          <span>{st.label}</span>
                          {isCurrent && <span className="text-[11px] text-[#8c96a3]">actual</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
