import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  X, ChevronDown, Check, Loader2,
  Copy as CopyIcon, Link2, ExternalLink, Newspaper
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { STATUS_OPTIONS, PRENSA_STATUS_OPTIONS, getNextStatusInfo } from '../lib/estados';
import { ensureAbsoluteUrl, formatDateISO, getRedesObjetivoForClient, parseDeliverableLinks, serializeDeliverableLinks, highlightQuotesInHtml, getCollapsedRichTextSnippet, filterPilaresBySpeaker } from '../lib/utils';
import { TextFormatToolbar } from './TextFormatToolbar';
import { RichTextEditor } from './RichTextEditor';
import {
  TicketPublishLinks,
  TicketCopyButton,
  InlineCommentHoverTooltip,
  InlineCommentPopover,
  TicketOwnersPicker,
  TicketStatusPicker,
  useInlineComments,
  TicketCommentsThread,
  TicketResources,
  TicketFormatPicker,
} from './ticket';
import { createAttachmentFromFile, type AttachedFileItem } from '../lib/attachments';

export type AttachedFile = AttachedFileItem;

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
  clientId?: string;
  client?: { id: string; name: string; canales?: string[] } | null;
  ownerId?: string;
  owner?: { id: string; name: string } | null;
  assigneeIds?: string[];
  assignees?: { id: string; name: string }[];
  pilarId?: string | null;
  pilar?: { id: string; nombre: string } | null;
  speakerId?: string | null;
  speaker?: { id: string; name?: string; nombre?: string; role?: string } | null;
  area?: string;
  subEstado?: string | null;
  medio?: string | null;
  periodista?: string | null;
  estadoRespuesta?: string | null;
  ticketTypeId?: string | null;
  tipoTicket?: 'CONTENIDO' | 'TAREA' | 'PRENSA';
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

const FORMATOS_PRENSA = [
  'Base de Medios', 'Brief', 'Clipping', 'Columna de opinión',
  'Comunicado', 'Cuestionario/Vocería', 'Documento', 'Estrategia',
  'Evento', 'Feedback', 'Gestión-pitch', 'Otro'
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

function cleanDeliverableLinks(raw?: string | null): string | null {
  if (!raw) return null;
  const parsed = parseDeliverableLinks(raw).map(ensureAbsoluteUrl).filter(Boolean);
  return serializeDeliverableLinks(parsed);
}

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
      referenciasGraficas: [] as AttachedFile[],
    };
  }

  const initialTipos = (ticket as any).tiposContenido?.length > 0
    ? (ticket as any).tiposContenido
    : (ticket.ticketType?.name ? [ticket.ticketType.name] : []);
  const initialAssignees = Array.isArray((ticket as any).assigneeIds) && (ticket as any).assigneeIds.length > 0
    ? (ticket as any).assigneeIds
    : (ticket.ownerId ? [ticket.ownerId] : (ticket.owner?.id ? [ticket.owner.id] : []));

  return {
    title: ticket.title || '',
    brief: ticket.objetivo ?? '',
    canales: ticket.canales?.length ? ticket.canales : [],
    clientId: ticket.clientId || ticket.client?.id || '',
    ownerId: ticket.ownerId || ticket.owner?.id || '',
    assigneeIds: initialAssignees,
    ticketTypeId: ticket.ticketTypeId || ticket.ticketType?.id || '',
    tiposContenido: initialTipos,
    pilarId: ticket.pilarId || ticket.pilar?.id || '',
    speakerId: ticket.speakerId || ticket.speaker?.id || '',
    prioridad: ticket.prioridad || 'MEDIA',
    status: ticket.status || 'PENDIENTE',
    subEstado: (ticket as any).subEstado || 'PENDIENTE',
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
    referenciasGraficas: Array.isArray((ticket as any).referenciasGraficas) ? (ticket as any).referenciasGraficas : [],
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
    if (t?.ticketType?.kind === 'PRENSA' || (!t && area === 'PRENSA') || (t as any)?.area === 'PRENSA' || t?.tipoTicket === 'PRENSA') return 'PRENSA';
    if (t?.tipoTicket) return t.tipoTicket;
    if (t?.ticketType?.kind === 'TAREA') return 'TAREA';
    if (t && (t as any).tiposContenido?.some((fmt: string) => TIPOS_TAREA.includes(fmt))) return 'TAREA';
    return 'CONTENIDO';
  };

  const [tipoTicket, setTipoTicket] = useState<'CONTENIDO' | 'TAREA' | 'PRENSA'>(() => initTipo(ticket));
  const isPieza = tipoTicket === 'CONTENIDO';
  const esTarea = tipoTicket === 'TAREA';
  const esPrensa = tipoTicket === 'PRENSA';
  const noContenido = esTarea || esPrensa;

  const [activeCopyTab, setActiveCopyTab] = useState<string>('LinkedIn');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [linkCopiado, setLinkCopiado] = useState(false);

  const [briefOpen, setBriefOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [notasOpen, setNotasOpen] = useState(false);
  const [entregableInput, setEntregableInput] = useState('');


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
  const dragStartedInsideRef = useRef(false);
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
    ?? (ticket?.client?.id === formData.clientId ? (ticket?.client as any) : null);

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

  const filteredPilares = useMemo(() => {
    return filterPilaresBySpeaker(pilares, formData.speakerId, false);
  }, [pilares, formData.speakerId]);

  const { data: speakersData } = useQuery({
    queryKey: ['speakers', formData.clientId],
    queryFn: () => api.getSpeakers(formData.clientId),
    enabled: isOpen && !!formData.clientId && !noContenido,
    staleTime: 5 * 60 * 1000,
  });
  const speakers = speakersData?.data ?? [];

  const { data: ticketTypesData } = useQuery({
    queryKey: ['ticket-types'],
    queryFn: () => api.getTicketTypes(),
    enabled: isOpen,
    staleTime: 10 * 60 * 1000,
  });
  const ticketTypes = (ticketTypesData?.data ?? []) as { id: string; name: string; kind?: string }[];

  const findTicketType = (name?: string, kind?: 'CONTENIDO' | 'TAREA' | 'PRENSA') => {
    if (!name) return null;
    const lower = name.toLowerCase().trim();
    return ticketTypes.find(t =>
      (!kind || t.kind === kind) && (
        t.name.toLowerCase() === lower ||
        t.name.toLowerCase().replace(/\s+/g, '') === lower.replace(/\s+/g, '') ||
        (lower.includes('blog') && t.name.toLowerCase().includes('blog')) ||
        (lower.includes('news') && t.name.toLowerCase().includes('news')) ||
        (lower.includes('pitch') && t.name.toLowerCase().includes('pitch'))
      )
    ) || null;
  };

  const defaultTareaType = ticketTypes.find(t => t.kind === 'TAREA' && t.name.toLowerCase() === 'otro')
    || ticketTypes.find(t => t.kind === 'TAREA') || null;

  const defaultPrensaType = ticketTypes.find(t => t.kind === 'PRENSA' && t.name.toLowerCase() === 'otro')
    || ticketTypes.find(t => t.kind === 'PRENSA') || null;

  const { data: commentsData } = useQuery({
    queryKey: ['comments', ticket?.id],
    queryFn: () => api.getComments(ticket!.id),
    enabled: isOpen && !!ticket?.id,
  });
  const comments = commentsData?.data ?? [];

  const createCommentMutation = useMutation({
    mutationFn: (text: string) => api.createComment(ticket!.id, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', ticket?.id] });
    },
  });

  const resolveCommentRef = useRef<((markId: string, quote?: string) => Promise<void>) | null>(null);

  const {
    pop,
    setPop,
    threads,
    hoverComment,
    handleMarkHover,
    handleMarkClick,
    closePop,
    resolvePop,
    sendPop,
    startInlineComment,
    locateMark: locateMarkBase,
  } = useInlineComments({
    comments,
    currentUser: user,
    onSubmitComment: async ({ fullContent }) => {
      if (ticket?.id) {
        await createCommentMutation.mutateAsync(fullContent);
      }
    },
    onResolveComment: (markId, quote) => resolveCommentRef.current?.(markId, quote),
  });
  useEffect(() => {
    if (isOpen) {
      const currentId = ticket?.id ?? null;
      const isNewTicket = currentId !== lastTicketIdRef.current;
      lastTicketIdRef.current = currentId;

      if (isNewTicket) {
        loadedDetailTicketIdRef.current = null;
        dirtyFieldsRef.current.clear();
        const newFormData = buildFormData(ticket, defaultClientId);
        formDataRef.current = newFormData;
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
          const backendFiles = Array.isArray((ticket as any).referenciasGraficas)
            ? (ticket as any).referenciasGraficas
            : [];
          const saved = sessionStorage.getItem(`ticket-files-${ticket.id}`);
          const sessionFiles = saved ? JSON.parse(saved) : [];
          setAttachedFiles(backendFiles.length > 0 ? backendFiles : sessionFiles);
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
      if (isFetchingTicket) return;
      if (loadedDetailTicketIdRef.current === ticket.id) return;
      loadedDetailTicketIdRef.current = ticket.id;

      const full = ((ticketDetailQuery as any)?.data ?? ticketDetailQuery) as any;
      const fullFormData = buildFormData(full, defaultClientId);
      if (ticket.status && !dirtyFieldsRef.current.has('status')) {
        fullFormData.status = ticket.status;
      }
      if ((ticket as any).subEstado && !dirtyFieldsRef.current.has('subEstado')) {
        fullFormData.subEstado = (ticket as any).subEstado;
      }

      setFormData(prev => {
        const dirty = dirtyFieldsRef.current;
        const merged = dirty.size === 0 ? fullFormData : (() => {
          const next = { ...fullFormData };
          dirty.forEach(field => {
            (next as any)[field] = (prev as any)[field];
          });
          return next;
        })();
        formDataRef.current = merged;
        return merged;
      });

      if (!dirtyFieldsRef.current.has('ticketTypeId')) {
        setTipoTicket(initTipo(full));
      }
      if (!dirtyFieldsRef.current.has('canales')) {
        const canales = fullFormData.canales.length > 0 ? fullFormData.canales : ['LinkedIn'];
        setActiveCopyTab(prevTab => (canales.includes(prevTab) ? prevTab : canales[0]));
      }
      if (!dirtyFieldsRef.current.has('referenciasGraficas') && Array.isArray(full.referenciasGraficas)) {
        setAttachedFiles(full.referenciasGraficas);
      }

      if (pendingSaveDataRef.current) {
        const toSave = pendingSaveDataRef.current;
        pendingSaveDataRef.current = null;
        performAutoSave(toSave);
      }
    }
  }, [ticketDetailQuery?.data, isFetchingTicket, isEditing, ticket?.id, defaultClientId]);

  // Flush any queued save once ticket loading finishes
  useEffect(() => {
    if (!isTicketLoading && !isSavingRef.current && pendingSaveDataRef.current) {
      const toSave = pendingSaveDataRef.current;
      pendingSaveDataRef.current = null;
      performAutoSave(toSave);
    }
  }, [isTicketLoading]);

  // Synchronize comment marks into formData when comments or ticket details load
  useEffect(() => {
    if (!isOpen) return;
    if (ticket?.id && !commentsData) return;

    const draftId = pop?.isDraft ? pop.id : null;
    const quotesWithIds: { quote: string; id: string }[] = [];
    (comments || []).forEach((cm: any) => {
      const rawContent = cm.content || cm.text || '';
      const quoteMatch = rawContent.match(/^«([^»]+)»:\s*([\s\S]*)$/);
      const q = cm.quote || (quoteMatch ? quoteMatch[1] : null);
      if (q && q.trim()) {
        quotesWithIds.push({ quote: q.trim(), id: `c_${cm.id}` });
      }
    });

    setFormData(prev => {
      let changed = false;
      const nextBrief = highlightQuotesInHtml(prev.brief || '', quotesWithIds, draftId);
      if (nextBrief !== prev.brief) changed = true;

      const nextNotas = highlightQuotesInHtml(prev.notasAudiovisual || '', quotesWithIds, draftId);
      if (nextNotas !== prev.notasAudiovisual) changed = true;

      const nextPerCanal: Record<string, string> = { ...prev.contentPerCanal };
      Object.keys(nextPerCanal).forEach(canal => {
        const highlighted = highlightQuotesInHtml(nextPerCanal[canal] || '', quotesWithIds, draftId);
        if (highlighted !== nextPerCanal[canal]) {
          nextPerCanal[canal] = highlighted;
          changed = true;
        }
      });

      if (!changed) return prev;
      const updated = {
        ...prev,
        brief: nextBrief,
        notasAudiovisual: nextNotas,
        contentPerCanal: nextPerCanal,
      };
      formDataRef.current = updated;
      if (ticket?.id) {
        triggerImmediateAutoSave(updated);
      }
      return updated;
    });
  }, [commentsData, ticketDetailQuery?.data, isOpen, ticket?.id]);

  // Click outside menus
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const path = (e.composedPath ? e.composedPath() : []) as HTMLElement[];
      const isInsidePop = Boolean(
        target.closest?.('[data-inline-pop]') ||
        target.closest?.('[data-mention-dropdown]') ||
        path.some((el) => el instanceof HTMLElement && (el.hasAttribute?.('data-inline-pop') || el.hasAttribute?.('data-mention-dropdown')))
      );

      if (pop && !isInsidePop && !target.closest?.('mark[data-c]') && !target.closest?.('[data-comment-trigger]')) {
        const popEl = document.querySelector('[data-inline-pop]');
        const textarea = popEl?.querySelector('textarea');
        if (textarea && textarea.value.trim().length > 0) {
          return;
        }
        closePop();
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [pop]);

  // Auto-save logic
  const performAutoSave = async (overrideData?: Partial<typeof formData>) => {
    const targetTicketId = (overrideData as any)?.__ticketId || ticket?.id;
    if (!targetTicketId) return;
    if (!isEditing && !(overrideData as any)?.__ticketId) return;
    if (isTicketLoading || isSavingRef.current) {
      pendingSaveDataRef.current = {
        ...formDataRef.current,
        ...(pendingSaveDataRef.current || {}),
        ...(overrideData || {}),
        __ticketId: targetTicketId,
      } as any;
      return;
    }

    const current = { ...formDataRef.current, ...overrideData };
    const primaryOwner = current.ownerId || current.assigneeIds?.[0] || null;
    if (!current.title || !current.clientId) return;

    const resolvedType = esPrensa
      ? (current.ticketTypeId ? ticketTypes.find(t => t.id === current.ticketTypeId) : null) || findTicketType(current.tiposContenido[0], 'PRENSA') || defaultPrensaType
      : esTarea
      ? (current.ticketTypeId ? ticketTypes.find(t => t.id === current.ticketTypeId) : null) || findTicketType(current.tiposContenido[0], 'TAREA') || defaultTareaType
      : (isPieza ? (current.ticketTypeId ? ticketTypes.find(t => t.id === current.ticketTypeId) : null) || findTicketType(current.tiposContenido[0], 'CONTENIDO') : null);

    const finalTicketTypeId = resolvedType?.id || current.ticketTypeId || null;

    const payload: any = {
      title: current.title,
      ownerId: primaryOwner,
      assigneeIds: current.assigneeIds || [],
      status: current.status,
      prioridad: current.prioridad,
      objetivo: current.brief !== undefined ? (current.brief || null) : undefined,
      tipoTicket,
      canales: noContenido ? [] : (current.canales.length > 0 ? current.canales : ['LinkedIn']),
      dueDate: current.dueDate || null,
      plannedDate: current.fechaPub || null,
      ticketTypeId: finalTicketTypeId,
      tiposContenido: current.tiposContenido,
      pilarId: noContenido ? null : (current.pilarId || null),
      speakerId: noContenido ? null : (current.speakerId || null),
      ...(current.links.length > 0 ? { links: current.links.map(ensureAbsoluteUrl) } : { links: [] }),
      ...(dirtyFieldsRef.current.has('linkEntregable')
        ? { linkEntregable: cleanDeliverableLinks(current.linkEntregable) }
        : {}),
      ...(dirtyFieldsRef.current.has('linkPublicacion')
        ? { linkPublicacion: cleanDeliverableLinks(current.linkPublicacion) }
        : {}),
      ...(current.notasAudiovisual ? { notasAudiovisual: current.notasAudiovisual } : {}),
      content: noContenido ? undefined : (current.content || null),
      contentPerCanal: noContenido ? undefined : current.contentPerCanal,
      referenciasGraficas: (current as any).referenciasGraficas !== undefined
        ? (current as any).referenciasGraficas
        : attachedFiles,
    };

    if (esPrensa) {
      payload.area = 'PRENSA';
      payload.subEstado = current.subEstado || (ticket as any)?.subEstado || 'PENDIENTE';
      payload.medio = current.medio || null;
      payload.periodista = current.periodista || null;
      payload.estadoRespuesta = current.estadoRespuesta || null;
    }

    isSavingRef.current = true;
    setSaveStatus('saving');
    try {
      const res = await api.updateTicket(targetTicketId, payload);
      if (res?.data) {
        const pendingPatch = pendingSaveDataRef.current as any;
        const enrichedTicket = {
          ...res.data,
          ...(pendingPatch?.status ? { status: pendingPatch.status } : {}),
          ...(pendingPatch?.subEstado ? { subEstado: pendingPatch.subEstado } : {}),
          pilar: res.data.pilar !== undefined
            ? res.data.pilar
            : (res.data.pilarId ? pilares.find((p: any) => p.id === res.data.pilarId) || null : null),
          speaker: res.data.speaker !== undefined
            ? res.data.speaker
            : (res.data.speakerId ? speakers.find((s: any) => s.id === res.data.speakerId) || null : null),
        };
        queryClient.setQueryData(['tickets'], (old: any) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((t: any) => (t.id === res.data.id ? { ...t, ...enrichedTicket } : t)),
          };
        });
        queryClient.setQueryData(['tickets', 'PRENSA'], (old: any) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((t: any) => (t.id === res.data.id ? { ...t, ...enrichedTicket } : t)),
          };
        });
        queryClient.setQueryData(['ticket', targetTicketId], (old: any) => {
          if (!old?.data) return old;
          return { ...old, data: { ...old.data, ...enrichedTicket } };
        });
        if (!pendingSaveDataRef.current) {
          queryClient.invalidateQueries({ queryKey: ['tickets'] });
        }
      }
      setSaveStatus('saved');
      if (!pendingSaveDataRef.current) {
        dirtyFieldsRef.current.clear();
      }
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
      saveTimeoutRef.current = null;
      performAutoSave(overrideData);
    }, 800);
  };

  const triggerImmediateAutoSave = (overrideData?: Partial<typeof formData>) => {
    if (!isEditing || !ticket?.id) return;
    const hadPendingTimer = Boolean(saveTimeoutRef.current);
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (!overrideData && dirtyFieldsRef.current.size === 0 && !pendingSaveDataRef.current && !hadPendingTimer) {
      return;
    }
    performAutoSave(overrideData);
  };

  const handleMultipleChanges = (changes: Partial<typeof formData>, immediate = false) => {
    Object.keys(changes).forEach(k => dirtyFieldsRef.current.add(k));
    const updated = { ...formDataRef.current, ...changes };
    formDataRef.current = updated;
    setFormData(updated);
    if (immediate) triggerImmediateAutoSave(updated);
    else triggerDebouncedAutoSave(updated);
  };

  const handleChange = (field: string, value: any, immediate = false) => {
    handleMultipleChanges({ [field]: value }, immediate);
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
        const enrichedTicket = {
          ...res.data,
          pilar: res.data.pilar !== undefined
            ? res.data.pilar
            : (res.data.pilarId ? pilares.find((p: any) => p.id === res.data.pilarId) || null : null),
          speaker: res.data.speaker !== undefined
            ? res.data.speaker
            : (res.data.speakerId ? speakers.find((s: any) => s.id === res.data.speakerId) || null : null),
        };
        queryClient.setQueryData(['tickets'], (old: any) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((t: any) => (t.id === res.data.id ? { ...t, ...enrichedTicket } : t)),
          };
        });
        queryClient.setQueryData(['ticket', ticket.id], (old: any) => {
          if (!old?.data) return old;
          return { ...old, data: { ...old.data, ...enrichedTicket } };
        });
        queryClient.invalidateQueries({ queryKey: ['tickets'] });
        queryClient.invalidateQueries({ queryKey: ['ticket', ticket.id] });
      }
    },
    onError: (err: any) => {
      setError(err.message || 'Error al guardar los cambios');
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => api.deleteComment(ticket!.id, commentId),
    onSuccess: (_data, commentId) => {
      queryClient.invalidateQueries({ queryKey: ['comments', ticket?.id] });
      const markSelector = `mark[data-c="c_${commentId}"], mark[data-c="${commentId}"]`;
      document.querySelectorAll(markSelector).forEach(m => m.replaceWith(...Array.from(m.childNodes)));
      const stripRegex = new RegExp(`<mark[^>]*data-c=["'](c_)?${commentId}["'][^>]*>([\\s\\S]*?)</mark>`, 'gi');
      setFormData(prev => {
        let changed = false;
        const nextBrief = prev.brief ? prev.brief.replace(stripRegex, '$2') : prev.brief;
        if (nextBrief !== prev.brief) changed = true;
        const nextNotas = prev.notasAudiovisual ? prev.notasAudiovisual.replace(stripRegex, '$2') : prev.notasAudiovisual;
        if (nextNotas !== prev.notasAudiovisual) changed = true;
        const nextPerCanal: Record<string, string> = { ...prev.contentPerCanal };
        Object.keys(nextPerCanal).forEach(canal => {
          if (nextPerCanal[canal]) {
            const stripped = nextPerCanal[canal].replace(stripRegex, '$2');
            if (stripped !== nextPerCanal[canal]) {
              nextPerCanal[canal] = stripped;
              changed = true;
            }
          }
        });
        if (changed) {
          triggerImmediateAutoSave({
            brief: nextBrief,
            notasAudiovisual: nextNotas,
            contentPerCanal: nextPerCanal,
          });
          return { ...prev, brief: nextBrief, notasAudiovisual: nextNotas, contentPerCanal: nextPerCanal };
        }
        return prev;
      });
    },
  });

  const handleResolveInlineComment = async (markId: string, quote?: string) => {
    if (!ticket?.id) return;
    const rawId = markId.startsWith('c_') ? markId.slice(2) : markId;

    const list = comments || [];
    const matching = list.filter((cm: any) => {
      const cmId = String(cm.id);
      if (cmId === rawId || `c_${cmId}` === markId) return true;
      if (quote && quote.trim()) {
        const rawContent = cm.content || cm.text || '';
        const match = rawContent.match(/^«([^»]+)»:\s*([\s\S]*)$/);
        const q = cm.quote || (match ? match[1] : null);
        if (q && (q.trim() === quote.trim() || quote.trim().includes(q.trim()) || q.trim().includes(quote.trim()))) {
          return true;
        }
      }
      return false;
    });

    for (const cm of matching) {
      try {
        await api.deleteComment(ticket.id, cm.id);
      } catch (err) {
        console.error('Error al eliminar comentario resuelto:', err);
      }
    }
    queryClient.invalidateQueries({ queryKey: ['comments', ticket.id] });

    const markSelector = `mark[data-c="${markId}"], mark[data-c="c_${rawId}"], mark[data-c="${rawId}"]`;
    document.querySelectorAll(markSelector).forEach(m => m.replaceWith(...Array.from(m.childNodes)));
    const stripRegex = new RegExp(`<mark[^>]*data-c=["'](c_)?(${rawId}|${markId})["'][^>]*>([\\s\\S]*?)</mark>`, 'gi');

    setFormData(prev => {
      let changed = false;
      let nextBrief = prev.brief ? prev.brief.replace(stripRegex, '$3') : prev.brief;
      if (nextBrief !== prev.brief) changed = true;
      let nextNotas = prev.notasAudiovisual ? prev.notasAudiovisual.replace(stripRegex, '$3') : prev.notasAudiovisual;
      if (nextNotas !== prev.notasAudiovisual) changed = true;
      const nextPerCanal: Record<string, string> = { ...prev.contentPerCanal };
      Object.keys(nextPerCanal).forEach(canal => {
        if (nextPerCanal[canal]) {
          const stripped = nextPerCanal[canal].replace(stripRegex, '$3');
          if (stripped !== nextPerCanal[canal]) {
            nextPerCanal[canal] = stripped;
            changed = true;
          }
        }
      });

      if (quote && quote.trim()) {
        const quoteRegex = new RegExp(`<mark[^>]*>(${quote.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})</mark>`, 'gi');
        if (nextBrief && quoteRegex.test(nextBrief)) {
          nextBrief = nextBrief.replace(quoteRegex, '$1');
          changed = true;
        }
        if (nextNotas && quoteRegex.test(nextNotas)) {
          nextNotas = nextNotas.replace(quoteRegex, '$1');
          changed = true;
        }
        Object.keys(nextPerCanal).forEach(canal => {
          if (nextPerCanal[canal] && quoteRegex.test(nextPerCanal[canal])) {
            nextPerCanal[canal] = nextPerCanal[canal].replace(quoteRegex, '$1');
            changed = true;
          }
        });
      }

      if (changed) {
        triggerImmediateAutoSave({
          brief: nextBrief,
          notasAudiovisual: nextNotas,
          contentPerCanal: nextPerCanal,
        });
        return { ...prev, brief: nextBrief, notasAudiovisual: nextNotas, contentPerCanal: nextPerCanal };
      }
      return prev;
    });
  };
  resolveCommentRef.current = handleResolveInlineComment;

  const handleClose = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (isEditing && ticket?.id && dirtyFieldsRef.current.size > 0) {
      performAutoSave({ ...formDataRef.current, __ticketId: ticket.id } as any);
    }
    setSaveStatus(null);
    if (!isEditing) {
      setFormData(buildFormData(null));
      setAttachedFiles([]);
    }
    setError(null);
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
        else handleClose();
      }
    };
    const handleMouseUp = () => {
      dragStartedInsideRef.current = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isOpen, pop, formData]);

  // Formats handling
  const handleFormatChange = (next: string[]) => {
    let briefUpdate: any = {};
    const list = formData.tiposContenido || [];
    const added = next.find(x => !list.includes(x));
    if (esTarea && added && list.length === 0 && (!formData.brief.trim() || Object.values(TPL_TAREA).includes(formData.brief))) {
      briefUpdate.brief = TPL_TAREA[added] || '';
    }

    const matchingType = esPrensa
      ? (findTicketType(next[0], 'PRENSA') || defaultPrensaType)
      : esTarea
      ? (findTicketType(next[0], 'TAREA') || defaultTareaType)
      : (isPieza ? findTicketType(next[0], 'CONTENIDO') : null);

    const updated = {
      ...formData,
      tiposContenido: next,
      ticketTypeId: matchingType?.id || formData.ticketTypeId || '',
      ...briefUpdate
    };
    dirtyFieldsRef.current.add('tiposContenido');
    if (matchingType?.id) dirtyFieldsRef.current.add('ticketTypeId');
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

  // Inline Comment Balloon logic
  // Inline Comment Balloon logic
  const triggerCommentForEditor = (ref: React.RefObject<HTMLDivElement | null>) => {
    startInlineComment(ref, (newHtml) => {
      if (ref === briefRef) {
        handleChange('brief', newHtml);
      } else if (ref === copyRef) {
        handleChange('contentPerCanal', { ...formData.contentPerCanal, [activeCopyTab]: newHtml });
      } else if (ref === notasRef) {
        handleChange('notasAudiovisual', newHtml);
      }
    });
  };

  const locateMark = (quoteText: string) => {
    locateMarkBase(quoteText, (cleanQ) => {
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
    });
  };

  // Missing fields validation (requeridos para crear ticket nuevo)
  const missing: string[] = [];
  if (!formData.title.trim()) missing.push('nombre');
  if (!formData.clientId) missing.push('cliente');
  if (!(formData.ownerId || formData.assigneeIds.length)) missing.push('responsable');
  if (!isEditing && !(formData.tiposContenido || []).length) missing.push(isPieza ? 'formato' : esPrensa ? 'tipo de tarea' : 'tipo de entregable');

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
      const resolvedType = esPrensa
        ? (formData.ticketTypeId ? ticketTypes.find(t => t.id === formData.ticketTypeId) : null) || findTicketType(formData.tiposContenido[0], 'PRENSA') || defaultPrensaType
        : esTarea
        ? (formData.ticketTypeId ? ticketTypes.find(t => t.id === formData.ticketTypeId) : null) || findTicketType(formData.tiposContenido[0], 'TAREA') || defaultTareaType
        : (isPieza ? (formData.ticketTypeId ? ticketTypes.find(t => t.id === formData.ticketTypeId) : null) || findTicketType(formData.tiposContenido[0], 'CONTENIDO') : null);

      const finalTicketTypeId = resolvedType?.id || formData.ticketTypeId || null;

      const payload: any = {
        title: formData.title,
        clientId: formData.clientId,
        ownerId: primaryOwner,
        assigneeIds: formData.assigneeIds,
        status: formData.status,
        prioridad: formData.prioridad,
        objetivo: formData.brief || null,
        tipoTicket,
        canales: noContenido ? [] : (formData.canales.length > 0 ? formData.canales : ['LinkedIn']),
        dueDate: formData.dueDate || null,
        plannedDate: formData.fechaPub || null,
        ticketTypeId: finalTicketTypeId,
        tiposContenido: formData.tiposContenido,
        pilarId: noContenido ? null : (formData.pilarId || null),
        speakerId: noContenido ? null : (formData.speakerId || null),
        links: formData.links.map(ensureAbsoluteUrl),
        linkEntregable: cleanDeliverableLinks(formData.linkEntregable),
        linkPublicacion: cleanDeliverableLinks(formData.linkPublicacion),
        referenciasGraficas: attachedFiles,
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
    if (!ticket?.id) return;
    const optimisticField = esPrensa ? { subEstado: targetStatus } : { status: targetStatus };
    queryClient.setQueryData(['tickets'], (old: any) => {
      if (!old?.data) return old;
      return {
        ...old,
        data: old.data.map((t: any) => (t.id === ticket.id ? { ...t, ...optimisticField } : t)),
      };
    });
    queryClient.setQueryData(['tickets', 'PRENSA'], (old: any) => {
      if (!old?.data) return old;
      return {
        ...old,
        data: old.data.map((t: any) => (t.id === ticket.id ? { ...t, ...optimisticField } : t)),
      };
    });
    queryClient.setQueryData(['ticket', ticket.id], (old: any) => {
      if (!old?.data) return old;
      return { ...old, data: { ...old.data, ...optimisticField } };
    });
    if (esPrensa) {
      handleChange('subEstado', targetStatus, true);
    } else {
      handleChange('status', targetStatus, true);
    }
  };

  const nextStatusInfo = getNextStatusInfo(
    formData.status,
    esPrensa,
    formData.subEstado || (ticket as any)?.subEstado || formData.estadoRespuesta,
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

  const formatList = (() => {
    if (isPieza) return FORMATOS_PIEZA;
    if (esPrensa) {
      const dbPrensa = ticketTypes.filter(t => t.kind === 'PRENSA').map(t => t.name);
      if (dbPrensa.length > 0) {
        const set = new Set([...dbPrensa, ...FORMATOS_PRENSA]);
        return Array.from(set).sort((a, b) => {
          const ao = /^otros?$/i.test(a) ? 1 : 0;
          const bo = /^otros?$/i.test(b) ? 1 : 0;
          if (ao !== bo) return ao - bo;
          return a.localeCompare(b);
        });
      }
      return FORMATOS_PRENSA;
    }
    return TIPOS_TAREA;
  })();

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

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          dragStartedInsideRef.current = false;
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !dragStartedInsideRef.current) {
          handleClose();
        }
        dragStartedInsideRef.current = false;
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 md:p-4 bg-[rgba(0,14,31,.55)] bg-black/40 backdrop-blur-[2px]"
    >
      <div
        onMouseDown={() => {
          dragStartedInsideRef.current = true;
        }}
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
            esPrensa ? (
              <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-[#7C3AED]/30 text-[#7C3AED] bg-[#7C3AED]/5 font-anek">
                <Newspaper className="w-3.5 h-3.5" />
                Prensa
              </span>
            ) : (
              <div className="flex p-[3px] bg-[#eef3f7] rounded-[9px] gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setTipoTicket('CONTENIDO');
                    const currentIsPieza = formData.tiposContenido.some((fmt: string) => FORMATOS_PIEZA.includes(fmt));
                    const newFormats = currentIsPieza ? formData.tiposContenido : [];
                    const matching = findTicketType(newFormats[0], 'CONTENIDO');
                    handleMultipleChanges({
                      ticketTypeId: matching?.id || '',
                      tiposContenido: newFormats,
                    });
                  }}
                  className={`border-0 cursor-pointer font-anek text-[13px] font-bold px-4 py-1.5 rounded-[7px] transition-all ${
                    isPieza ? 'bg-white text-[#024fff] shadow-[0_1px_2px_rgba(0,14,31,.12)]' : 'bg-transparent text-[#5b6675]'
                  }`}
                >
                  Pieza
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTipoTicket('TAREA');
                    const currentIsTarea = formData.tiposContenido.some((fmt: string) => TIPOS_TAREA.includes(fmt));
                    const newFormats = currentIsTarea ? formData.tiposContenido : [];
                    const matching = findTicketType(newFormats[0], 'TAREA') || defaultTareaType;
                    handleMultipleChanges({
                      ticketTypeId: matching?.id || '',
                      tiposContenido: newFormats,
                      canales: [],
                      pilarId: '',
                      speakerId: '',
                    });
                  }}
                  className={`border-0 cursor-pointer font-anek text-[13px] font-bold px-4 py-1.5 rounded-[7px] transition-all ${
                    esTarea ? 'bg-white text-[#024fff] shadow-[0_1px_2px_rgba(0,14,31,.12)]' : 'bg-transparent text-[#5b6675]'
                  }`}
                >
                  Tarea
                </button>
              </div>
            )
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
                  {!briefOpen && (() => {
                    const preview = getCollapsedRichTextSnippet(
                      formData.brief,
                      isPieza ? 'Sin brief todavía' : 'Sin descripción todavía'
                    );
                    return (
                      <span
                        className={`text-[14px] truncate block [&_*]:inline ${
                          preview.isEmpty ? 'text-[#8c96a3]' : 'text-[#1d2a3a]'
                        }`}
                        dangerouslySetInnerHTML={{ __html: preview.html }}
                      />
                    );
                  })()}
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

                <div className="border border-[#d6dde5] rounded-[10px] bg-white relative editor-sticky-section">
                  {/* Sticky Toolbar */}
                  <div
                    data-sticky-toolbar="brief"
                    className="sticky top-0 z-20 border-b border-[#d6dde5] bg-[#f7fafc]/95 backdrop-blur-xs rounded-t-[9px] shadow-[0_2px_8px_rgba(0,14,31,0.06)] editor-sticky-toolbar"
                  >
                    <TextFormatToolbar
                      editorRef={briefRef}
                      value={formData.brief || ''}
                      onChange={val => handleChange('brief', val)}
                      onComment={() => triggerCommentForEditor(briefRef)}
                      className="border-b-0"
                    />
                  </div>

                  {/* RichTextEditor */}
                  <RichTextEditor
                    ref={briefRef}
                    value={formData.brief || ''}
                    onChange={val => handleChange('brief', val)}
                    onBlur={() => {
                      if (briefRef.current) {
                        handleChange('brief', briefRef.current.innerHTML);
                      }
                      triggerImmediateAutoSave();
                    }}
                    onMarkClick={handleMarkClick}
                    onMarkHover={handleMarkHover}
                    placeholder={isPieza ? 'Qué querés comunicar y por qué' : 'Descripción — detalle del pedido'}
                    minHeight="110px"
                    className="p-3 sm:p-3.5"
                  />

                  {/* Resources */}
                  <TicketResources
                    links={formData.links}
                    attachedFiles={attachedFiles}
                    onAddLink={(url) => handleChange('links', [...formData.links, url], true)}
                    onRemoveLink={(idx) => handleChange('links', formData.links.filter((_, i) => i !== idx), true)}
                    onAddFiles={async (files) => {
                      try {
                        const newFiles: AttachedFile[] = [];
                        for (const file of files) {
                          const item = await createAttachmentFromFile(file);
                          newFiles.push(item);
                        }
                        const nextFiles = [...attachedFiles, ...newFiles];
                        setAttachedFiles(nextFiles);
                        if (ticket?.id) {
                          try {
                            sessionStorage.setItem(`ticket-files-${ticket.id}`, JSON.stringify(nextFiles));
                          } catch {}
                        }
                        handleChange('referenciasGraficas', nextFiles, true);
                      } catch (err: any) {
                        alert(err?.message || 'Error al procesar archivo');
                      }
                    }}
                    onRemoveFile={(fileId) => {
                      const nextFiles = attachedFiles.filter(f => f.id !== fileId);
                      setAttachedFiles(nextFiles);
                      if (ticket?.id) {
                        try {
                          sessionStorage.setItem(`ticket-files-${ticket.id}`, JSON.stringify(nextFiles));
                        } catch {}
                      }
                      handleChange('referenciasGraficas', nextFiles, true);
                    }}
                    placeholder={isPieza ? 'Pegá un link a fotos, logos o documentos y presioná Enter' : 'Pegá un link a documentos o ejemplos y presioná Enter'}
                    variant="modal"
                  />
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
                        {!notasOpen && (() => {
                          const preview = getCollapsedRichTextSnippet(
                            formData.notasAudiovisual,
                            'Sin notas de diseño'
                          );
                          return (
                            <span
                              className={`text-[14px] truncate block [&_*]:inline ${
                                preview.isEmpty ? 'text-[#8c96a3]' : 'text-[#1d2a3a]'
                              }`}
                              dangerouslySetInnerHTML={{ __html: preview.html }}
                            />
                          );
                        })()}
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
                      <div className="border border-[#d6dde5] rounded-[10px] bg-white relative editor-sticky-section">
                        <div
                          data-sticky-toolbar="notas"
                          className="sticky top-0 z-20 border-b border-[#d6dde5] bg-[#f7fafc]/95 backdrop-blur-xs rounded-t-[9px] shadow-[0_2px_8px_rgba(0,14,31,0.06)] editor-sticky-toolbar"
                        >
                          <TextFormatToolbar
                            editorRef={notasRef}
                            value={formData.notasAudiovisual || ''}
                            onChange={val => handleChange('notasAudiovisual', val)}
                            onComment={() => triggerCommentForEditor(notasRef)}
                            className="border-b-0"
                          />
                        </div>
                        <RichTextEditor
                          ref={notasRef}
                          value={formData.notasAudiovisual || ''}
                          onChange={val => handleChange('notasAudiovisual', val)}
                          onBlur={() => {
                            if (notasRef.current) {
                              handleChange('notasAudiovisual', notasRef.current.innerHTML);
                            }
                            triggerImmediateAutoSave();
                          }}
                          onMarkClick={handleMarkClick}
                          onMarkHover={handleMarkHover}
                          placeholder="Ej.: placa estilo «en medios», usar logos de los medios, foto del vocero…"
                          minHeight="110px"
                          className="p-3.5 rounded-b-[9px]"
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
                            {!copyOpen && (() => {
                              const preview = getCollapsedRichTextSnippet(
                                currentCopyText,
                                'Sin copy redactado'
                              );
                              return (
                                <span
                                  className={`text-[14px] truncate block [&_*]:inline ${
                                    preview.isEmpty ? 'text-[#8c96a3]' : 'text-[#1d2a3a]'
                                  }`}
                                  dangerouslySetInnerHTML={{ __html: preview.html }}
                                />
                              );
                            })()}
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
                          <div className="border border-[#d6dde5] rounded-[10px] bg-white relative editor-sticky-section">
                            {/* Sticky Tabs + Toolbar */}
                            <div
                              data-sticky-toolbar="copy"
                              className="sticky top-0 z-20 border-b border-[#d6dde5] bg-[#f7fafc]/95 backdrop-blur-xs rounded-t-[9px] shadow-[0_2px_8px_rgba(0,14,31,0.06)] editor-sticky-toolbar"
                            >
                              {/* Network tabs row */}
                              <div className="flex items-center justify-between gap-2 p-1.5 px-2 border-b border-[#d6dde5] flex-wrap">
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

                                <TicketCopyButton
                                  text={currentCopyText}
                                  editorRef={copyRef}
                                />
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
                                className="border-b-0"
                              />
                            </div>

                            {/* RichTextEditor */}
                            <RichTextEditor
                              ref={copyRef}
                              value={currentCopyText}
                              onChange={val => {
                                const nextPerCanal = { ...formData.contentPerCanal, [activeCopyTab]: val };
                                handleChange('contentPerCanal', nextPerCanal);
                              }}
                              onBlur={() => {
                                if (copyRef.current) {
                                  const nextPerCanal = { ...formData.contentPerCanal, [activeCopyTab]: copyRef.current.innerHTML };
                                  handleChange('contentPerCanal', nextPerCanal);
                                }
                                triggerImmediateAutoSave();
                              }}
                              onMarkClick={handleMarkClick}
                              onMarkHover={handleMarkHover}
                              placeholder={`Copy para ${activeCopyTab}…`}
                              minHeight="140px"
                              className="p-3.5 sm:p-4"
                            />

                            <div className="flex justify-end p-2 px-3 border-t border-[#eef3f7] text-[12px] text-[#8c96a3] rounded-b-[9px] bg-white">
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


            {/* Comments list & input */}
            <TicketCommentsThread
              ticketId={ticket?.id}
              comments={comments}
              currentUserId={user?.id}
              currentUserName={user?.name || user?.email || 'YO'}
              teamList={teamList}
              onAddComment={async (content) => {
                if (!ticket?.id) {
                  throw new Error('Primero debés guardar el ticket para poder agregar comentarios.');
                }
                await createCommentMutation.mutateAsync(content);
              }}
              onDeleteComment={(commentId) => {
                deleteCommentMutation.mutate(commentId);
              }}
              onLocateQuote={locateMark}
              isPendingAdd={createCommentMutation.isPending}
              variant="modal"
            />

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

              {/* Formato / Tipo de entregable / Tipo de tarea */}
              <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5b6675] mt-2">
                {isPieza ? 'Formato' : esPrensa ? 'Tipo de tarea' : 'Tipo de entregable'} <span className="text-[#024fff]">*</span>
              </label>
              <TicketFormatPicker
                selectedFormats={formData.tiposContenido}
                availableFormats={formatList}
                onChange={handleFormatChange}
                label={isPieza ? 'Formato' : esPrensa ? 'Tipo de tarea' : 'Tipo de entregable'}
                className="mt-2"
              />

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
            <TicketOwnersPicker
              assigneeIds={formData.assigneeIds}
              users={teamList}
              label={isPieza ? 'Owners' : 'Responsables'}
              variant="modal"
              onChange={(next) => {
                let nextOwnerId = formDataRef.current.ownerId;
                if (!nextOwnerId && next.length > 0) {
                  nextOwnerId = next[0];
                } else if (nextOwnerId && !next.includes(nextOwnerId)) {
                  nextOwnerId = next[0] || '';
                }
                handleMultipleChanges({
                  assigneeIds: next,
                  ownerId: nextOwnerId,
                }, true);
              }}
            />

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
                      const nextFiltered = filterPilaresBySpeaker(pilares, '', false);
                      const nextPilarId = nextFiltered.some(p => p.id === formData.pilarId) ? formData.pilarId : '';
                      handleMultipleChanges({ speakerId: '', pilarId: nextPilarId }, true);
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
                          const nextFiltered = filterPilaresBySpeaker(pilares, speakers[0].id, false);
                          const nextPilarId = nextFiltered.some(p => p.id === formData.pilarId) ? formData.pilarId : '';
                          handleMultipleChanges({ speakerId: speakers[0].id, pilarId: nextPilarId }, true);
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
                        const nextFiltered = filterPilaresBySpeaker(pilares, suggestedSpeaker.id, false);
                        const nextPilarId = nextFiltered.some(p => p.id === formData.pilarId) ? formData.pilarId : '';
                        handleMultipleChanges({ speakerId: suggestedSpeaker.id, pilarId: nextPilarId }, true);
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
                                const nextFiltered = filterPilaresBySpeaker(pilares, sp.id, false);
                                const nextPilarId = nextFiltered.some(p => p.id === formData.pilarId) ? formData.pilarId : '';
                                handleMultipleChanges({ speakerId: sp.id, pilarId: nextPilarId }, true);
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
            {isPieza && (
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">Pilar de contenido</label>
                {filteredPilares.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {filteredPilares.map((p: any) => {
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
                ) : (
                  <span className="text-[12px] text-[#8c96a3] italic">
                    {formData.speakerId
                      ? 'Este vocero no tiene pilares específicos asignados.'
                      : 'Esta marca no tiene pilares de contenido configurados.'}
                  </span>
                )}
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

            {/* Link a la Publicación (a partir de listo para publicar en adelante - abajo de todo) */}
            {(['LISTO_PARA_PUBLICAR', 'PUBLICADO', 'LISTO'].includes(formData.status) ||
              (esPrensa && ['PENDIENTE_PUBLICACION', 'LISTO'].includes((ticket as any)?.subEstado || formData.subEstado))) && (
              <>
                <div className="h-px bg-[#d6dde5]" />
                <TicketPublishLinks
                  value={formData.linkPublicacion}
                  onChange={(nextVal) => handleChange('linkPublicacion', nextVal, true)}
                  variant="modal"
                />
              </>
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
          ticketId={ticket?.id}
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

          <TicketStatusPicker
            variant="modal"
            currentStatus={
              esPrensa
                ? (formData.subEstado || (ticket as any)?.subEstado || formData.estadoRespuesta)
                : formData.status
            }
            nextStatusLabel={nextStatusInfo.label}
            nextStatusValue={nextStatusInfo.next}
            options={esPrensa ? PRENSA_STATUS_OPTIONS : STATUS_OPTIONS}
            onAdvance={handlePrimary}
            onSelectStatus={handleSelectStatusModal}
            primaryLabel={isEditing ? `Pasar a ${nextStatusInfo.label}` : 'Crear ticket'}
            shortcutHint={isEditing || missing.length === 0 ? '⌘↵' : undefined}
            isLoading={createMutation.isPending || updateMutation.isPending}
            disabled={
              isEditing
                ? (createMutation.isPending || updateMutation.isPending)
                : (missing.length > 0 || createMutation.isPending || updateMutation.isPending)
            }
            showDropdown={isEditing}
          />
        </div>

      </div>
    </div>
  );
}
