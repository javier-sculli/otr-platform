import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ArrowRight,
  Archive,
  MoreHorizontal,
  Link2,
  ExternalLink,
  Sparkles,
  X as XIcon,
  Copy as CopyIcon,
  Check,
  Paperclip,
  ChevronDown,
  Loader2,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ensureAbsoluteUrl, formatDateISO, recordCopyVersion, parseDeliverableLinks, serializeDeliverableLinks, highlightQuotesInHtml } from '../lib/utils';
import { api } from '../lib/api';
import { TicketsReferencia } from '../components/TicketsReferencia';
import { TextFormatToolbar } from '../components/TextFormatToolbar';
import { RichTextEditor } from '../components/RichTextEditor';
import { MentionTextarea, formatCommentWithMentions } from '../components/MentionTextarea';
import { SUB_DEF, STATUS_OPTIONS, PRENSA_STATUS_OPTIONS, getNextStatusInfo, type SubEstado } from '../lib/estados';

type AttachedFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string | null;
  contentType: 'text' | 'image' | 'other';
};

const FORMATOS_PIEZA = [
  'Álbum de fotos', 'Carrusel', 'Hilo', 'Imagen', 'Placa gráfica',
  'Reel', 'Repost', 'Story', 'Texto', 'Video'
];

const TIPOS_TAREA = [
  'Artículo de blog', 'Deck', 'Diseño puntual', 'Estrategia',
  'Newsletter', 'Reporte', 'Otro'
];

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

export function TicketDetallePage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => api.getTicket(ticketId!),
    enabled: !!ticketId,
  });

  const ticket = data?.data;

  const updateMutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.updateTicket(ticketId!, patch),
    onSuccess: (res: any) => {
      if (res?.data && ticketId) {
        queryClient.setQueryData(['ticket', ticketId], (old: any) => {
          if (!old?.data) return old;
          return { ...old, data: { ...old.data, ...res.data } };
        });
        queryClient.setQueryData(['tickets'], (old: any) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((t: any) => (t.id === res.data.id ? { ...t, ...res.data } : t)),
          };
        });
      }
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  // Comments
  const [commentText, setCommentText] = useState('');
  const { data: commentsData } = useQuery({
    queryKey: ['comments', ticketId],
    queryFn: () => api.getComments(ticketId!),
    enabled: !!ticketId,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.getUsers(),
  });
  const allUsers: any[] = usersData?.data ?? [];

  const createCommentMutation = useMutation({
    mutationFn: (content: string) => api.createComment(ticketId!, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', ticketId] });
      setCommentText('');
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => api.deleteComment(ticketId!, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', ticketId] });
    },
  });

  const [delOpen, setDelOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [copyCopiado, setCopyCopiado] = useState(false);
  const [tituloTemp, setTituloTemp] = useState('');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [fmtOpen, setFmtOpen] = useState(false);
  const [ownersOpen, setOwnersOpen] = useState(false);
  const [ownerQuery, setOwnerQuery] = useState('');
  const [selectedOwnerIndex, setSelectedOwnerIndex] = useState(0);
  const ownersOpenRef = useRef(ownersOpen);
  ownersOpenRef.current = ownersOpen;
  const [briefOpen, setBriefOpen] = useState(false);

  const [recursoInput, setRecursoInput] = useState('');
  const [activeCopyTab, setActiveCopyTab] = useState<string>('LinkedIn');
  const [copyPerCanal, setCopyPerCanal] = useState<Record<string, string>>({});
  const [notasAudiovisual, setNotasAudiovisual] = useState('');
  const [entregableInput, setEntregableInput] = useState('');
  const [publicacionInput, setPublicacionInput] = useState('');
  const [briefTemp, setBriefTemp] = useState('');

  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>(() => {
    if (!ticketId) return [];
    const saved = sessionStorage.getItem(`ticket-files-${ticketId}`);
    return saved ? JSON.parse(saved) : [];
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inline comment balloon
  const [pop, setPop] = useState<{ id: string; x: number; y: number } | null>(null);
  const [popInput, setPopInput] = useState('');
  const [threads, setThreads] = useState<Record<string, { quote: string; items: { author: string; when: string; text: string }[] }>>({});
  const popRef = useRef<HTMLTextAreaElement>(null);

  const briefRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const notasRef = useRef<HTMLDivElement>(null);

  const { data: speakersData } = useQuery({
    queryKey: ['speakers', ticket?.clientId],
    queryFn: () => (ticket?.clientId ? api.getSpeakers(ticket.clientId) : Promise.resolve({ data: [] })),
    enabled: !!ticket?.clientId,
  });
  const speakers: any[] = speakersData?.data ?? [];
  const [isChangingSpeaker, setIsChangingSpeaker] = useState(false);
  const pickedSpeaker = speakers.find((s: any) => s.id === ticket?.speakerId);
  const getSpeakerName = (s: any) => (s ? s.nombre || s.name || '' : '');
  const getSpeakerCargo = (s: any) => (s ? s.cargo || s.role || 'Vocero' : 'Vocero');

  // Synchronize state when ticket loads
  useEffect(() => {
    if (ticket) {
      setTituloTemp(ticket.title || '');
      setBriefTemp(ticket.objetivo || '');
      setNotasAudiovisual(ticket.notasAudiovisual || '');
      setEntregableInput(ticket.linkEntregable || '');
      const perCanal = (ticket.contentPerCanal && typeof ticket.contentPerCanal === 'object')
        ? { ...ticket.contentPerCanal }
        : {};
      setCopyPerCanal(perCanal);
      const canales = ticket.canales?.length > 0 ? ticket.canales : ['LinkedIn'];
      setActiveCopyTab(canales[0] || 'LinkedIn');
    }
  }, [ticket?.id]);

  // Synchronize comment marks into editors when comments or ticket load
  useEffect(() => {
    const commentsList = commentsData?.data || [];
    if (!ticket || commentsList.length === 0) return;

    const quotesWithIds: { quote: string; id: string }[] = [];
    commentsList.forEach((cm: any) => {
      const rawContent = cm.content || cm.text || '';
      const quoteMatch = rawContent.match(/^«([^»]+)»:\s*([\s\S]*)$/);
      const q = cm.quote || (quoteMatch ? quoteMatch[1] : null);
      if (q && q.trim()) {
        quotesWithIds.push({ quote: q.trim(), id: `c_${cm.id}` });
      }
    });

    if (quotesWithIds.length === 0) return;

    setBriefTemp(prev => highlightQuotesInHtml(prev || '', quotesWithIds));
    setNotasAudiovisual(prev => highlightQuotesInHtml(prev || '', quotesWithIds));
    setCopyPerCanal(prev => {
      let changed = false;
      const next: Record<string, string> = { ...prev };
      Object.keys(next).forEach(canal => {
        const highlighted = highlightQuotesInHtml(next[canal] || '', quotesWithIds);
        if (highlighted !== next[canal]) {
          next[canal] = highlighted;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [commentsData?.data, ticket?.id]);

  useEffect(() => {
    if (ticketId) {
      sessionStorage.setItem(`ticket-files-${ticketId}`, JSON.stringify(attachedFiles));
    }
  }, [attachedFiles, ticketId]);

  const handleSelectStatus = (targetStatus: string, isSubEstado?: boolean) => {
    setShowStatusDropdown(false);
    if (isSubEstado) {
      updateMutation.mutate({ subEstado: targetStatus });
      return;
    }
    if (targetStatus === 'LISTO' || targetStatus === 'CANCELADO') {
      const label = targetStatus === 'LISTO' ? 'Listo (archivado)' : 'Stand-by / Cancelado';
      if (!window.confirm(`¿Mover a "${label}"?\n\nEl ticket desaparecerá del kanban.`)) return;
    }
    updateMutation.mutate({ status: targetStatus });
  };

  const esTarea = (ticket as any)?.ticketType?.kind === 'TAREA';
  const esPrensa = (ticket as any)?.ticketType?.kind === 'PRENSA' || (ticket as any)?.area === 'PRENSA';
  const isPieza = !esTarea && !esPrensa;

  const handleNextStatusClick = () => {
    if (!ticket) return;
    const info = getNextStatusInfo(ticket.status, esPrensa, ticket.subEstado, (ticket as any).tiposContenido, (ticket as any).ticketType, ticket.title);
    handleSelectStatus(info.next, info.isPrensa);
  };

  const handleGuardarTitulo = () => {
    if (tituloTemp.trim() && tituloTemp !== ticket?.title) {
      updateMutation.mutate({ title: tituloTemp.trim() });
    }
  };

  const addRecurso = () => {
    const v = recursoInput.trim();
    if (!v) return;
    const next = [...(ticket?.links || []), ensureAbsoluteUrl(v)];
    setRecursoInput('');
    updateMutation.mutate({ links: next });
  };

  const removeRecurso = (index: number) => {
    const next = (ticket?.links || []).filter((_: string, i: number) => i !== index);
    updateMutation.mutate({ links: next });
  };

  const addEntregableLink = () => {
    const v = entregableInput.trim();
    if (!v) return;
    const current = parseDeliverableLinks(ticket?.linkEntregable);
    const next = [...current, ensureAbsoluteUrl(v)];
    setEntregableInput('');
    updateMutation.mutate({ linkEntregable: serializeDeliverableLinks(next) });
  };

  const removeEntregableLink = (index: number) => {
    const current = parseDeliverableLinks(ticket?.linkEntregable);
    const next = current.filter((_, i) => i !== index);
    updateMutation.mutate({ linkEntregable: serializeDeliverableLinks(next) });
  };

  const addLinkPublicacion = () => {
    const v = publicacionInput.trim();
    if (!v) return;
    const current = parseDeliverableLinks(ticket?.linkPublicacion);
    const next = [...current, ensureAbsoluteUrl(v)];
    setPublicacionInput('');
    updateMutation.mutate({ linkPublicacion: serializeDeliverableLinks(next) });
  };

  const removeLinkPublicacion = (index: number) => {
    const current = parseDeliverableLinks(ticket?.linkPublicacion);
    const next = current.filter((_, i) => i !== index);
    updateMutation.mutate({ linkPublicacion: serializeDeliverableLinks(next) });
  };

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

  const toggleFormato = (f: string) => {
    const list = (ticket as any)?.tiposContenido || [];
    const next = list.includes(f) ? list.filter((x: string) => x !== f) : [...list, f];
    updateMutation.mutate({ tiposContenido: next });
  };

  const toggleRed = (r: string) => {
    const canales = ticket?.canales || [];
    const next = canales.includes(r) ? canales.filter((x: string) => x !== r) : [...canales, r];
    updateMutation.mutate({ canales: next });
    if (!next.includes(activeCopyTab)) {
      setActiveCopyTab(next[0] || 'LinkedIn');
    }
  };

  const saveCopyTab = (tab: string, text: string) => {
    const updated = { ...copyPerCanal, [tab]: text };
    setCopyPerCanal(updated);
    const payload: any = { contentPerCanal: updated };
    if (text.trim().length > 0) {
      const currentVersions = (ticket as any)?.versionsPerCanal || {};
      const prevText = (ticket as any)?.contentPerCanal?.[tab];
      payload.versionsPerCanal = recordCopyVersion(currentVersions, tab, text, prevText);
    }
    updateMutation.mutate(payload);
  };

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteTicket(ticketId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      navigate('/backlog');
    },
    onError: (err: any) => {
      console.error('Error al eliminar ticket:', err);
      alert('Error al eliminar el ticket: ' + (err?.message || 'Error desconocido'));
    },
  });

  const duplicar = async () => {
    if (!ticket) return;
    try {
      const newTicketData = {
        title: `${ticket.title} (copia)`,
        clientId: ticket.clientId || ticket.client?.id,
        ticketType: ticket.ticketType || (isPieza ? 'CONTENIDO' : 'TAREA'),
        status: 'PENDIENTE',
        prioridad: ticket.prioridad || 'MEDIA',
        objetivo: ticket.objetivo,
        contentPerCanal: ticket.contentPerCanal,
        canales: ticket.canales,
        notasAudiovisual: ticket.notasAudiovisual,
        tiposContenido: (ticket as any).tiposContenido,
        speakerId: ticket.speakerId,
        links: ticket.links,
      };
      const res = await api.createTicket(newTicketData);
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      if (res?.data?.id) {
        navigate(`/piezas/${res.data.id}`);
      } else {
        navigate('/backlog');
      }
    } catch (e) {
      console.error('Error al duplicar:', e);
    }
  };

  const copiarLinkTicket = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2000);
    } catch (err) {
      console.error('Error al copiar link:', err);
    }
  };

  const copiarCopy = () => {
    const textToCopy = (copyRef.current?.innerText ?? currentCopy.replace(/<[^>]*>/g, '')).trim();
    if (!textToCopy) return;
    try {
      navigator.clipboard.writeText(textToCopy);
      setCopyCopiado(true);
      setTimeout(() => setCopyCopiado(false), 2000);
    } catch (err) {
      console.error('Error al copiar copy:', err);
    }
  };

  const isArchived = ticket?.status === 'LISTO' || ticket?.status === 'CANCELADO';
  const handleArchivar = () => {
    if (isArchived) {
      updateMutation.mutate({ status: 'PENDIENTE' });
    } else {
      updateMutation.mutate({ status: 'LISTO' });
    }
  };

  const popRefVal = useRef(pop);
  popRefVal.current = pop;
  const threadsRefVal = useRef(threads);
  threadsRefVal.current = threads;

  const closePop = () => {
    const currentPop = popRefVal.current;
    if (!currentPop) return;
    const currentThreads = threadsRefVal.current;
    const t = currentThreads[currentPop.id];
    if (t && (!t.items || t.items.length === 0)) {
      const mark = document.querySelector(`mark[data-c="${currentPop.id}"]`);
      if (mark) mark.replaceWith(...Array.from(mark.childNodes));
    }
    setPop(null);
    setPopInput('');
  };

  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (!target.closest('[data-menu]')) {
        setDelOpen(false);
        setMoreOpen(false);
        setShowStatusDropdown(false);
      }

      if (ownersOpenRef.current && !target.closest('[data-owners-menu]')) {
        setOwnersOpen(false);
      }

      if (
        popRefVal.current &&
        !target.closest('[data-inline-pop]') &&
        !target.closest('mark[data-c]') &&
        !target.closest('[data-comment-trigger]')
      ) {
        closePop();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (popRefVal.current) closePop();
        if (ownersOpenRef.current) setOwnersOpen(false);
      }
    };

    window.addEventListener('mousedown', handleDocClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleDocClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Inline comment balloon methods
  const posFor = (mark: HTMLElement) => {
    const b = mark.getBoundingClientRect();
    const x = Math.max(8, Math.min(b.left, window.innerWidth - 308));
    const below = b.bottom + 8;
    const y = below + 260 > window.innerHeight ? Math.max(8, b.top - 268) : below;
    return { x, y };
  };

  const startInline = (ref: React.RefObject<HTMLDivElement | null>, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const root = ref.current;
    const sel = window.getSelection();
    if (!root || !sel || !sel.rangeCount || sel.isCollapsed || !root.contains(sel.anchorNode)) {
      alert('Seleccioná un fragmento del texto para comentarlo.');
      return;
    }
    const quote = sel.toString().trim();
    if (!quote) return;
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

    setThreads(prev => ({ ...prev, [id]: { quote, items: [] } }));
    setPop({ id, ...posFor(m) });
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
    if (pop) return;

    const quoteText = m.innerText?.trim() || '';
    const threadItems = threads[id]?.items || [];

    const matchedComments = (commentsData?.data || []).filter((cm: any) => {
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
    if (!threads[id]) {
      setThreads(prev => ({ ...prev, [id]: { quote: m.innerText, items: [] } }));
    }
    setPop({ id, ...posFor(m) });
    setPopInput('');
    setTimeout(() => popRef.current?.focus(), 50);
  };

  const locateMark = (quoteText: string) => {
    if (!quoteText) return;
    const cleanQ = quoteText.trim();

    if (copyPerCanal) {
      for (const [canal, text] of Object.entries(copyPerCanal)) {
        if (text?.includes(cleanQ)) {
          setActiveCopyTab(canal);
          break;
        }
      }
    }

    setTimeout(() => {
      const allMarks = Array.from(document.querySelectorAll('mark[data-c]')) as HTMLElement[];
      const found = allMarks.find(el => el.innerText.trim() === cleanQ || el.innerText.trim().includes(cleanQ) || cleanQ.includes(el.innerText.trim()));
      if (found) {
        found.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  const sendPop = () => {
    if (!pop || !popInput.trim()) return;
    const d = new Date();
    const when = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const text = popInput.trim();
    const quote = threads[pop.id]?.quote;
    const item = { author: currentUser?.name || currentUser?.email || 'Usuario', when, text };
    setThreads(prev => ({
      ...prev,
      [pop.id]: {
        ...prev[pop.id],
        items: [...(prev[pop.id]?.items || []), item],
      },
    }));
    if (ticketId) {
      const payload = quote ? `«${quote}»: ${text}` : text;
      createCommentMutation.mutate(payload);
    }
    setPopInput('');
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center text-[#5b6675] font-anek text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-[#024fff]" /> Cargando ticket…
      </div>
    );
  }

  if (isError || !ticket) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center gap-4 font-anek">
        <p className="text-[#5b6675] text-sm">No se pudo cargar el ticket.</p>
        <button
          onClick={() => navigate('/backlog')}
          className="px-4 py-2 text-xs font-bold text-[#024fff] border border-[#024fff]/30 rounded-lg hover:bg-[#024fff]/10 transition-all cursor-pointer"
        >
          Volver al backlog
        </button>
      </div>
    );
  }

  const subEstadoLabel = ticket.subEstado ? (SUB_DEF[ticket.subEstado as SubEstado]?.label ?? ticket.subEstado) : 'Pendiente';
  const statusLabel = esPrensa ? subEstadoLabel : (STATUS_OPTIONS.find(s => s.value === ticket.status)?.label ?? ticket.status);
  const nextInfo = getNextStatusInfo(ticket.status, esPrensa, ticket.subEstado, (ticket as any).tiposContenido, (ticket as any).ticketType, ticket.title);

  const formatList = isPieza ? FORMATOS_PIEZA : TIPOS_TAREA;
  const currentCopy = copyPerCanal[activeCopyTab] || '';
  const copyLimit = LIMITS[activeCopyTab] || 0;
  const visibleCopyLength = (copyRef.current?.innerText ?? currentCopy.replace(/<[^>]*>/g, '')).trim().length;
  const isCopyOver = copyLimit > 0 && visibleCopyLength > copyLimit;

  const comments = commentsData?.data || [];
  const rawAssignedIds: string[] = Array.from(
    new Set(
      (Array.isArray((ticket as any)?.assigneeIds) && (ticket as any).assigneeIds.length > 0)
        ? (ticket as any).assigneeIds
        : (ticket?.ownerId ? [ticket.ownerId] : (ticket?.owner?.id ? [ticket.owner.id] : []))
    )
  );

  const assignedList: any[] = (() => {
    if (rawAssignedIds.length > 0) {
      return rawAssignedIds.map(uid => {
        const fromAllUsers = allUsers.find((u: any) => u.id === uid);
        if (fromAllUsers) return fromAllUsers;
        const fromAssignees = ((ticket as any)?.assignees || []).find((a: any) => a.id === uid);
        if (fromAssignees) return fromAssignees;
        if (ticket?.owner?.id === uid) return ticket.owner;
        return { id: uid, name: 'Usuario' };
      });
    }
    if (Array.isArray((ticket as any)?.assignees) && (ticket as any).assignees.length > 0) {
      return (ticket as any).assignees;
    }
    if (ticket?.owner) {
      return [ticket.owner];
    }
    return [];
  })();

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f7fafc] font-anek">

      {/* TOP HEADER STICKY */}
      <div className="sticky top-0 lg:top-[64px] z-30 bg-white border-b border-[#d6dde5]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-9 py-4 sm:py-[16px] pb-[18px] flex flex-col gap-2 box-border">

          {/* Breadcrumbs & Autosave indicator */}
          <div className="flex items-center justify-between gap-3 text-[14px] text-[#5b6675]">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => navigate('/backlog')}
                className="flex items-center gap-1 border-0 bg-transparent cursor-pointer font-anek text-[14px] text-[#5b6675] py-1 px-2 -ml-1 rounded-md hover:bg-[#eef3f7] hover:text-[#0d0d0d] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Backlog</span>
              </button>
              <span className="text-[#b9c2cd]">/</span>
              <span className="text-[#5b6675] truncate">{ticket.client?.name || 'Cliente'}</span>
              <span className="text-[#b9c2cd]">/</span>
              <span className="text-[#5b6675] shrink-0">{isPieza ? 'Pieza' : 'Tarea'}</span>
            </div>

            <div className="flex items-center gap-1.5 text-[13px] font-semibold shrink-0">
              {updateMutation.isPending ? (
                <span className="text-[#8c96a3] flex items-center gap-1.5 animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#024fff]" />
                  Guardando…
                </span>
              ) : (
                <span className="text-[#00a372] flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 text-[#00a372]" />
                  Guardado
                </span>
              )}
            </div>
          </div>

          {/* Title input + status pill + actions */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-[280px] sm:min-w-[380px] flex items-center gap-3.5">
              <input
                type="text"
                value={tituloTemp}
                onChange={e => setTituloTemp(e.target.value)}
                onBlur={handleGuardarTitulo}
                onKeyDown={e => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
                placeholder="Nombre del ticket"
                className="flex-1 min-w-0 border-0 outline-none font-anek text-[24px] sm:text-[28px] font-[800] tracking-[-0.015em] py-0.5 bg-transparent text-[#0d0d0d] placeholder:text-[#8c96a3]"
              />
              <span className="shrink-0 whitespace-nowrap text-[12px] font-bold tracking-[0.08em] uppercase px-[11px] py-[6px] rounded-full bg-[#eef3f7] text-[#3a4655]">
                {statusLabel}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Archivar */}
              <button
                type="button"
                onClick={handleArchivar}
                title="Archivar ticket"
                className="shrink-0 whitespace-nowrap h-[44px] px-3.5 border border-[#d6dde5] bg-white rounded-lg cursor-pointer font-anek text-[15px] font-bold text-[#3a4655] flex items-center gap-2 hover:bg-[#eef3f7] transition-colors"
              >
                <Archive className="w-[17px] h-[17px] text-[#3a4655]" />
                <span>{isArchived ? 'Desarchivar' : 'Archivar'}</span>
              </button>

              {/* Eliminar */}
              <div className="relative">
                <button
                  type="button"
                  data-menu="1"
                  onClick={() => {
                    setDelOpen(!delOpen);
                    setMoreOpen(false);
                    setShowStatusDropdown(false);
                  }}
                  title="Eliminar ticket"
                  className="shrink-0 whitespace-nowrap h-[44px] px-3.5 border border-[#f1b5a3] bg-white rounded-lg cursor-pointer font-anek text-[15px] font-bold text-[#d4380d] flex items-center gap-2 hover:bg-[#d4380d]/[0.06] transition-colors"
                >
                  <Trash2 className="w-[17px] h-[17px] text-[#d4380d]" />
                  <span>Eliminar</span>
                </button>
                {delOpen && (
                  <div
                    data-menu="1"
                    className="absolute top-[52px] right-0 w-[280px] bg-white border border-[#d6dde5] rounded-[10px] shadow-[0_12px_32px_rgba(0,14,31,.16)] p-4 flex flex-col gap-3 z-40 text-left"
                  >
                    <span className="text-[16px] font-[800] text-[#0d0d0d]">¿Eliminar este ticket?</span>
                    <span className="text-[14px] leading-[1.45] text-[#5b6675]">
                      Se borran el copy, las notas y los comentarios. Si solo querés sacarlo del tablero, archivalo.
                    </span>
                    <div className="flex gap-2 justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => setDelOpen(false)}
                        className="h-[38px] px-3.5 border border-[#d6dde5] bg-white rounded-lg cursor-pointer font-anek text-[14px] font-bold text-[#0d0d0d] hover:bg-[#eef3f7] transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDelOpen(false);
                          deleteMutation.mutate();
                        }}
                        disabled={deleteMutation.isPending}
                        className="h-[38px] px-3.5 border-0 bg-[#d4380d] text-white rounded-lg cursor-pointer font-anek text-[14px] font-bold hover:bg-[#b32b07] transition-colors"
                      >
                        {deleteMutation.isPending ? 'Eliminando…' : 'Eliminar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Más acciones (...) */}
              <div className="relative">
                <button
                  type="button"
                  data-menu="1"
                  onClick={() => {
                    setMoreOpen(!moreOpen);
                    setDelOpen(false);
                    setShowStatusDropdown(false);
                  }}
                  title="Más acciones"
                  className="w-[44px] h-[44px] border border-[#d6dde5] bg-white rounded-lg cursor-pointer text-[#3a4655] flex items-center justify-center hover:bg-[#eef3f7] transition-colors"
                >
                  <MoreHorizontal className="w-[18px] h-[18px]" />
                </button>
                {moreOpen && (
                  <div
                    data-menu="1"
                    className="absolute top-[52px] right-0 w-[220px] bg-white border border-[#d6dde5] rounded-[10px] shadow-[0_12px_32px_rgba(0,14,31,.16)] p-1.5 flex flex-col gap-0.5 z-40 text-left"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setMoreOpen(false);
                        duplicar();
                      }}
                      className="flex items-center gap-2.5 border-0 bg-transparent cursor-pointer font-anek text-[15px] p-2.5 rounded-md text-left text-[#0d0d0d] whitespace-nowrap hover:bg-[#eef3f7] transition-colors w-full"
                    >
                      <CopyIcon className="w-4 h-4 text-[#5b6675]" />
                      <span>Duplicar ticket</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMoreOpen(false);
                        copiarLinkTicket();
                      }}
                      className="flex items-center gap-2.5 border-0 bg-transparent cursor-pointer font-anek text-[15px] p-2.5 rounded-md text-left text-[#0d0d0d] whitespace-nowrap hover:bg-[#eef3f7] transition-colors w-full"
                    >
                      <Link2 className="w-4 h-4 text-[#5b6675]" />
                      <span>{linkCopiado ? 'Link copiado ✓' : 'Copiar link del ticket'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Split advance button: Pasar a [Estado] */}
              <div className="flex relative ml-1 sm:ml-1.5">
                <button
                  type="button"
                  onClick={handleNextStatusClick}
                  className="shrink-0 whitespace-nowrap h-[44px] px-5 sm:px-6 bg-[#024fff] text-white rounded-l-lg cursor-pointer font-anek text-[15px] font-bold flex items-center gap-2.5 hover:bg-[#0c57d3] transition-colors shadow-sm"
                >
                  <ArrowRight className="w-4 h-4 shrink-0" />
                  <span>Pasar a {nextInfo.label}</span>
                </button>
                <button
                  type="button"
                  data-menu="1"
                  onClick={() => {
                    setShowStatusDropdown(!showStatusDropdown);
                    setMoreOpen(false);
                    setDelOpen(false);
                  }}
                  title="Otros estados"
                  className="h-[44px] w-[42px] border-0 border-l border-white/30 bg-[#024fff] text-white rounded-r-lg cursor-pointer flex items-center justify-center hover:bg-[#0c57d3] transition-colors shadow-sm"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>

                {showStatusDropdown && (
                  <div
                    data-menu="1"
                    className="absolute top-[52px] right-0 w-[240px] bg-white border border-[#d6dde5] rounded-[10px] shadow-[0_12px_32px_rgba(0,14,31,.16)] p-1.5 flex flex-col gap-0.5 z-40 text-left"
                  >
                    <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#8c96a3] px-2.5 pt-2 pb-1">
                      Mover a
                    </span>
                    {(esPrensa ? PRENSA_STATUS_OPTIONS : STATUS_OPTIONS).map(opt => {
                      const isCurrent = esPrensa ? (ticket.subEstado ?? 'PENDIENTE') === opt.value : ticket.status === opt.value;
                      const isNext = opt.value === nextInfo.next;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleSelectStatus(opt.value, esPrensa)}
                          className={`w-full border-0 bg-transparent cursor-pointer font-anek text-[15px] p-2.5 rounded-md text-left transition-colors flex items-center justify-between ${
                            isCurrent
                              ? 'text-[#8c96a3] font-normal hover:bg-[#eef3f7]'
                              : isNext
                              ? 'text-[#024fff] font-bold hover:bg-[#eef3f7]'
                              : 'text-[#0d0d0d] font-normal hover:bg-[#eef3f7]'
                          }`}
                        >
                          <span>{isCurrent ? `${opt.label} · actual` : opt.label}</span>
                          {isCurrent && <Check className="w-3.5 h-3.5 text-[#8c96a3]" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* BODY CONTAINER */}
      <div className="flex-1 w-full max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] items-start box-border">

        {/* LEFT COLUMN (MAIN) */}
        <div className="min-w-0 p-6 sm:px-9 sm:pt-7 sm:pb-20 flex flex-col gap-10 box-border">

          {/* 1. Brief (desplegable) */}
          <div className="border border-[#d6dde5] rounded-[12px] bg-white overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => setBriefOpen(!briefOpen)}
              className={`w-full flex items-center gap-4 p-4 px-5 border-0 cursor-pointer font-anek text-left transition-colors ${
                briefOpen ? 'bg-[#f7fafc]' : 'bg-white hover:bg-[#f7fafc]'
              }`}
            >
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="text-[12px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">
                  {isPieza ? 'Brief y material de referencia' : 'Descripción y recursos'}
                </span>
                {!briefOpen && (
                  <span className="text-[16px] leading-[1.45] text-[#1d2a3a] truncate block">
                    {briefTemp ? briefTemp.replace(/<[^>]*>/g, '').trim().split('\n')[0] || 'Sin brief todavía' : 'Sin brief todavía'}
                  </span>
                )}
              </div>
              {((ticket.links || []).length > 0 || attachedFiles.length > 0) && (
                <span className="shrink-0 whitespace-nowrap flex items-center gap-1.5 text-[14px] text-[#5b6675]">
                  <Link2 className="w-[15px] h-[15px] text-[#024fff] shrink-0" />
                  {((ticket.links || []).length + attachedFiles.length) === 1
                    ? '1 recurso'
                    : `${(ticket.links || []).length + attachedFiles.length} recursos`}
                </span>
              )}
              <span className="shrink-0 whitespace-nowrap flex items-center gap-1.5 text-[14px] font-bold text-[#024fff]">
                {briefOpen ? 'Ocultar' : (isPieza ? 'Ver brief' : 'Ver descripción')}
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${briefOpen ? 'rotate-180' : ''}`}
                />
              </span>
            </button>

            {briefOpen && (
              <div className="border-t border-[#eef3f7]">
                <TextFormatToolbar
                  editorRef={briefRef}
                  value={briefTemp}
                  onChange={val => {
                    setBriefTemp(val);
                    updateMutation.mutate({ objetivo: val || null });
                  }}
                  onComment={() => startInline(briefRef)}
                />

                <RichTextEditor
                  ref={briefRef}
                  value={briefTemp}
                  onChange={val => {
                    setBriefTemp(val);
                  }}
                  onBlur={() => {
                    if (briefTemp !== (ticket.objetivo ?? '')) {
                      updateMutation.mutate({ objetivo: briefTemp || null });
                    }
                  }}
                  onMarkClick={handleMarkClick}
                  onMarkHover={handleMarkHover}
                  placeholder={isPieza ? 'Qué querés comunicar y por qué' : 'Qué necesitás, para qué es y cualquier detalle para resolverlo'}
                  minHeight="120px"
                  className="p-5 sm:p-6 text-[16px] leading-[1.65]"
                />

                {/* Resources chips */}
                {((ticket.links || []).length > 0 || attachedFiles.length > 0) && (
                  <div className="flex flex-wrap gap-2 px-5 pb-3.5">
                    {(ticket.links || []).map((link: string, idx: number) => (
                      <span
                        key={`link-${idx}`}
                        className="flex items-center gap-2 max-w-full py-1.5 pl-3 pr-1.5 border border-[#d6dde5] rounded-full bg-[#f7fafc] box-border text-[14px] text-[#1d2a3a]"
                      >
                        <Link2 className="w-[15px] h-[15px] text-[#024fff] shrink-0" />
                        <a
                          href={ensureAbsoluteUrl(link)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="max-w-[320px] truncate text-[#1d2a3a] hover:text-[#024fff]"
                        >
                          {link}
                        </a>
                        <button
                          type="button"
                          onClick={() => removeRecurso(idx)}
                          title="Quitar"
                          className="border-0 bg-transparent cursor-pointer text-[#8c96a3] w-6 h-6 shrink-0 rounded-full flex items-center justify-center hover:bg-[#d6dde5] hover:text-[#0d0d0d]"
                        >
                          <XIcon className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    {attachedFiles.map(file => (
                      <span
                        key={`file-${file.id}`}
                        className="flex items-center gap-2 max-w-full py-1.5 pl-3 pr-1.5 border border-[#d6dde5] rounded-full bg-[#f7fafc] box-border text-[14px] text-[#1d2a3a]"
                      >
                        <Paperclip className="w-[15px] h-[15px] text-[#024fff] shrink-0" />
                        <span className="max-w-[240px] truncate text-[#1d2a3a]">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => setAttachedFiles(prev => prev.filter(f => f.id !== file.id))}
                          title="Quitar"
                          className="border-0 bg-transparent cursor-pointer text-[#8c96a3] w-6 h-6 shrink-0 rounded-full flex items-center justify-center hover:bg-[#d6dde5] hover:text-[#0d0d0d]"
                        >
                          <XIcon className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Input row */}
                <div className="flex items-center gap-2 p-2 px-3 border-t border-[#eef3f7] bg-[#f7fafc]">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Adjuntar archivo"
                    className="w-9 h-9 shrink-0 border-0 bg-transparent rounded-md cursor-pointer text-[#3a4655] flex items-center justify-center hover:bg-[#eef3f7]"
                  >
                    <Paperclip className="w-[18px] h-[18px]" />
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
                    className="flex-1 min-w-0 h-9 font-anek text-[15px] px-2 border-0 outline-none bg-transparent placeholder:text-[#8c96a3]"
                  />
                  {recursoInput.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={addRecurso}
                      className="h-[34px] px-3.5 border-0 bg-[#024fff] rounded-md cursor-pointer font-anek text-[14px] font-bold text-white hover:bg-[#0c57d3]"
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
            )}
          </div>

          {/* 2. [if Tarea] Entrega & Refs tarea */}
          {esTarea && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
              <div className="border border-[#d6dde5] rounded-[12px] p-5 sm:p-6 bg-white flex flex-col gap-4">
                <span className="text-[13px] font-[800] tracking-[0.07em] uppercase text-[#0d0d0d]">Entrega</span>
                <div className="flex flex-col gap-2">
                  <span className="text-[12px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">Links de entrega</span>
                  
                  {/* Lista de links de entrega */}
                  {parseDeliverableLinks(ticket?.linkEntregable).length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      {parseDeliverableLinks(ticket?.linkEntregable).map((link, idx) => (
                        <div
                          key={`entregable-${idx}`}
                          className="flex items-center gap-2 p-2 px-3 bg-[#024fff]/5 border border-[#024fff]/25 rounded-lg group transition-colors hover:bg-[#024fff]/8"
                        >
                          <div className="w-6 h-6 rounded bg-[#024fff]/10 flex items-center justify-center text-[#024fff] shrink-0">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </div>
                          <a
                            href={ensureAbsoluteUrl(link)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 font-anek text-[14px] font-semibold text-[#024fff] hover:underline truncate"
                            title={link}
                          >
                            {link}
                          </a>
                          <button
                            type="button"
                            onClick={() => removeEntregableLink(idx)}
                            className="border-0 bg-transparent cursor-pointer text-[#8c96a3] hover:text-red-500 p-1 rounded hover:bg-white/80 transition-colors"
                            title="Eliminar link"
                          >
                            <XIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Input para agregar link de entrega */}
                  <div className="flex items-center gap-1.5">
                    <input
                      value={entregableInput}
                      onChange={e => setEntregableInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addEntregableLink();
                        }
                      }}
                      placeholder="Pegá un link al archivo o entrega y presioná Enter"
                      className="h-[42px] box-border font-anek text-[15px] px-3 border border-[#d6dde5] rounded-lg bg-white outline-none text-[#0d0d0d] flex-1 focus:border-[#024fff] focus:ring-2 focus:ring-[#024fff]/12"
                    />
                    {entregableInput.trim() && (
                      <button
                        type="button"
                        onClick={addEntregableLink}
                        className="h-[42px] px-3.5 border-0 bg-[#024fff] rounded-lg cursor-pointer font-anek text-[14px] font-bold text-white hover:bg-[#0c57d3] transition-colors shrink-0"
                      >
                        Agregar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="border border-[#d6dde5] rounded-[12px] p-5 sm:p-6 bg-white flex flex-col gap-2.5">
                <TicketsReferencia
                  ticketId={ticket.id}
                  clientId={ticket.client?.id ?? ''}
                  references={ticket.references ?? []}
                />
              </div>
            </div>
          )}

          {/* 3. [if Pieza] Copy */}
          {isPieza && (
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[13px] font-[800] tracking-[0.07em] uppercase text-[#0d0d0d]">Copy</span>
                <span className="flex-1" />
                <button
                  type="button"
                  onClick={() => navigate(`/content/${ticket.id}`)}
                  className="shrink-0 whitespace-nowrap h-[40px] px-3.5 border border-[#024fff] bg-white rounded-lg cursor-pointer font-anek text-[15px] font-bold text-[#024fff] flex items-center gap-2 hover:bg-[#024fff]/8 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Redactar con IA</span>
                </button>
                <button
                  type="button"
                  onClick={copiarCopy}
                  className="shrink-0 whitespace-nowrap h-[40px] px-3.5 border border-[#d6dde5] bg-white rounded-lg cursor-pointer font-anek text-[15px] font-bold text-[#0d0d0d] flex items-center gap-2 hover:bg-[#eef3f7] transition-colors"
                >
                  <CopyIcon className="w-4 h-4" />
                  <span>{copyCopiado ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>

              <div className="border border-[#d6dde5] rounded-[12px] overflow-hidden bg-white shadow-xs">
                {/* Redes tabs */}
                <div className="flex items-center gap-1.5 p-2 border-b border-[#eef3f7] bg-[#f7fafc] flex-wrap">
                  {(ticket.canales?.length > 0 ? ticket.canales : ['LinkedIn']).map((r: string) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setActiveCopyTab(r)}
                      className={`shrink-0 whitespace-nowrap border-0 cursor-pointer font-anek text-[15px] font-bold h-[36px] px-3.5 rounded-md transition-colors ${
                        activeCopyTab === r
                          ? 'bg-white text-[#024fff] shadow-[0_1px_2px_rgba(0,14,31,.12)]'
                          : 'bg-transparent text-[#5b6675] hover:bg-[#eef3f7]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                  {['LinkedIn', 'Instagram', 'Twitter/X']
                    .filter(rd => !(ticket.canales || []).includes(rd))
                    .map(ar => (
                      <button
                        key={ar}
                        type="button"
                        onClick={() => toggleRed(ar)}
                        className="shrink-0 whitespace-nowrap border border-dashed border-[#b9c2cd] bg-transparent cursor-pointer font-anek text-[14px] font-medium h-[34px] px-3 rounded-md text-[#3a4655] hover:border-[#024fff] hover:text-[#024fff] transition-colors"
                      >
                        + {ar}
                      </button>
                    ))}
                </div>

                {/* Toolbar */}
                <TextFormatToolbar
                  editorRef={copyRef}
                  value={currentCopy}
                  onChange={val => {
                    setCopyPerCanal(prev => ({ ...prev, [activeCopyTab]: val }));
                    saveCopyTab(activeCopyTab, val);
                  }}
                  onComment={() => startInline(copyRef)}
                />

                <RichTextEditor
                  ref={copyRef}
                  value={currentCopy}
                  onChange={val => {
                    setCopyPerCanal(prev => ({ ...prev, [activeCopyTab]: val }));
                  }}
                  onBlur={() => saveCopyTab(activeCopyTab, currentCopy)}
                  onMarkClick={handleMarkClick}
                  onMarkHover={handleMarkHover}
                  placeholder={`Copy para ${activeCopyTab}…`}
                  minHeight="260px"
                  className="p-5 sm:p-6 text-[16px] leading-[1.65]"
                />

                <div className="flex justify-between items-center gap-3 p-2.5 px-4 border-t border-[#eef3f7] text-[14px] text-[#5b6675]">
                  <span>{pickedSpeaker ? `Voz: ${getSpeakerName(pickedSpeaker)}` : 'Voz de marca'}</span>
                  <span className={isCopyOver ? 'text-[#d4380d] font-bold' : 'text-[#8c96a3]'}>
                    {copyLimit > 0
                      ? `${visibleCopyLength.toLocaleString('es-AR')} / ${copyLimit.toLocaleString('es-AR')}`
                      : `${visibleCopyLength} caracteres`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 4. [if Pieza] Notas de diseño */}
          {isPieza && (
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-[800] tracking-[0.07em] uppercase text-[#0d0d0d]">Notas de diseño</span>
                <span className="text-[14px] text-[#5b6675]">Indicaciones para quien diseña: estilo, referencias, textos que van en la pieza.</span>
              </div>

              <div className="border border-[#d6dde5] rounded-[12px] overflow-hidden bg-white shadow-xs">
                <TextFormatToolbar
                  editorRef={notasRef}
                  value={notasAudiovisual}
                  onChange={val => {
                    setNotasAudiovisual(val);
                    updateMutation.mutate({ notasAudiovisual: val || null });
                  }}
                  onComment={() => startInline(notasRef)}
                />

                <RichTextEditor
                  ref={notasRef}
                  value={notasAudiovisual}
                  onChange={val => {
                    setNotasAudiovisual(val);
                  }}
                  onBlur={() => {
                    if (notasAudiovisual !== (ticket.notasAudiovisual ?? '')) {
                      updateMutation.mutate({ notasAudiovisual: notasAudiovisual || null });
                    }
                  }}
                  onMarkClick={handleMarkClick}
                  onMarkHover={handleMarkHover}
                  placeholder="Ej.: placa estilo «Newtopia en medios», usar logos de los medios…"
                  minHeight="140px"
                  className="p-5 sm:p-6 text-[16px] leading-[1.65]"
                />
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN (SIDEBAR) */}
        <div className="self-stretch min-w-0 bg-[#f7fafc] border-t lg:border-t-0 lg:border-l border-[#d6dde5] box-border">
          <div className="lg:sticky lg:top-[124px] lg:max-h-[calc(100vh-124px)] lg:overflow-y-auto p-6 sm:p-7 pb-12 flex flex-col gap-7 box-border">

            {/* Link a la Publicación (a partir de listo para publicar en adelante) */}
            {['LISTO_PARA_PUBLICAR', 'PUBLICADO', 'LISTO'].includes(ticket.status) && (
              <div className="flex flex-col gap-3.5">
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] font-[800] tracking-[0.07em] uppercase text-[#0d0d0d]">Link a la Publicación</span>
                  <span className="text-[13px] text-[#5b6675]">Links a las publicaciones finales en redes o medios.</span>
                </div>

                {/* Lista de links de publicación */}
                {parseDeliverableLinks(ticket?.linkPublicacion).length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {parseDeliverableLinks(ticket?.linkPublicacion).map((link, idx) => (
                      <div
                        key={`publicacion-${idx}`}
                        className="flex items-center gap-2 p-2 px-3 bg-[#024fff]/5 border border-[#024fff]/25 rounded-lg group transition-colors hover:bg-[#024fff]/8"
                      >
                        <div className="w-6 h-6 rounded bg-[#024fff]/10 flex items-center justify-center text-[#024fff] shrink-0">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </div>
                        <a
                          href={ensureAbsoluteUrl(link)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 font-anek text-[14px] font-semibold text-[#024fff] hover:underline truncate"
                          title={link}
                        >
                          {link}
                        </a>
                        <button
                          type="button"
                          onClick={() => removeLinkPublicacion(idx)}
                          className="border-0 bg-transparent cursor-pointer text-[#8c96a3] hover:text-red-500 p-1 rounded hover:bg-white/80 transition-colors"
                          title="Eliminar link"
                        >
                          <XIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Input para agregar link de publicación */}
                <div className="flex items-center gap-1.5">
                  <input
                    value={publicacionInput}
                    onChange={e => setPublicacionInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addLinkPublicacion();
                      }
                    }}
                    placeholder="Pegá un link a la publicación y presioná Enter"
                    className="h-[42px] box-border font-anek text-[15px] px-3 border border-[#d6dde5] rounded-lg bg-white outline-none text-[#0d0d0d] min-w-0 w-full flex-1 focus:border-[#024fff] focus:ring-2 focus:ring-[#024fff]/12"
                  />
                  {publicacionInput.trim() && (
                    <button
                      type="button"
                      onClick={addLinkPublicacion}
                      className="h-[42px] px-3.5 border-0 bg-[#024fff] rounded-lg cursor-pointer font-anek text-[14px] font-bold text-white hover:bg-[#0c57d3] transition-colors shrink-0"
                    >
                      Agregar
                    </button>
                  )}
                </div>

                <div className="h-px bg-[#d6dde5] mt-2" />
              </div>
            )}

            {/* 0 Comentarios */}
            <div className="flex flex-col gap-3.5">
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-[800] tracking-[0.07em] uppercase text-[#0d0d0d]">Comentarios</span>
                <span className="text-[14px] text-[#8c96a3]">{comments.length || ''}</span>
              </div>

              {/* Comments list */}
              {comments.map((cm: any) => {
                const isMyComment = (cm.userId && cm.userId === currentUser?.id) || (cm.user?.id && cm.user?.id === currentUser?.id);
                const rawContent = cm.content || cm.text || '';
                const quoteMatch = rawContent.match(/^«([^»]+)»:\s*([\s\S]*)$/);
                const quote = cm.quote || (quoteMatch ? quoteMatch[1] : null);
                const mainContent = quoteMatch ? quoteMatch[2] : rawContent;

                return (
                  <div key={cm.id} className="flex gap-2.5 group">
                    <span className="w-[30px] h-[30px] shrink-0 rounded-full bg-[#eef3f7] text-[#024fff] text-[11px] font-bold flex items-center justify-center">
                      <span className="translate-y-[0.5px] leading-none select-none">{ini(cm.user?.name || cm.author)}</span>
                    </span>
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <div className="flex gap-2 items-baseline">
                        <span className="text-[15px] font-bold text-[#0d0d0d]">{cm.user?.name || cm.author || 'Usuario'}</span>
                        <span className="text-[13px] text-[#8c96a3]">
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
                            className="p-1 text-[#8c96a3] hover:text-red-600 rounded transition-colors ml-auto cursor-pointer border-0 bg-transparent flex items-center justify-center opacity-0 group-hover:opacity-100"
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
                      <span className="text-[15px] leading-[1.5] text-[#1d2a3a] whitespace-pre-wrap">
                        {formatCommentWithMentions(mainContent)}
                      </span>
                    </div>
                  </div>
                );
              })}

              {comments.length === 0 && Object.keys(threads).length === 0 && (
                <span className="text-[14px] leading-[1.45] text-[#8c96a3]">
                  Sin comentarios. Para comentar un fragmento del copy o de las notas, seleccioná el texto.
                </span>
              )}

              {/* Comment input */}
              <div className="flex flex-col gap-2 mt-1">
                <MentionTextarea
                  value={commentText}
                  onChange={setCommentText}
                  placeholder="Comentario general del ticket (@ para mencionar)"
                  rows={2}
                  users={allUsers}
                  className="w-full font-anek text-[15px] leading-[1.5] p-2.5 px-3 border border-[#d6dde5] rounded-[10px] outline-none resize-y min-h-[64px] bg-white focus:border-[#024fff] focus:ring-2 focus:ring-[#024fff]/12 transition-all placeholder:text-[#8c96a3]"
                />
                {commentText.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (commentText.trim()) {
                        createCommentMutation.mutate(commentText.trim());
                      }
                    }}
                    disabled={createCommentMutation.isPending}
                    className="self-end shrink-0 whitespace-nowrap h-[38px] px-4 border-0 bg-[#024fff] rounded-lg cursor-pointer font-anek text-[14px] font-bold text-white hover:bg-[#0c57d3] transition-colors"
                  >
                    {createCommentMutation.isPending ? 'Comentando…' : 'Comentar'}
                  </button>
                )}
              </div>

              <span className="text-[13px] text-[#8c96a3]">
                {ticket.createdAt ? `Creado el ${new Date(ticket.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
                {ticket.updatedAt ? ` · Última edición ${new Date(ticket.updatedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
              </span>
            </div>

            <div className="h-px bg-[#d6dde5]" />

            {/* 1 Seguimiento */}
            <div className="flex flex-col gap-4">
              <span className="text-[13px] font-[800] tracking-[0.07em] uppercase text-[#0d0d0d]">Seguimiento</span>

              {/* Owners */}
              <div data-owners-menu="1" className="flex flex-col gap-2 relative">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">
                    {isPieza ? 'Owners' : 'Responsables'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setOwnersOpen(!ownersOpen);
                      setOwnerQuery('');
                      setSelectedOwnerIndex(0);
                    }}
                    className="shrink-0 whitespace-nowrap border-0 bg-transparent cursor-pointer font-anek text-[14px] font-bold text-[#024fff] px-1.5 py-1 rounded hover:bg-[#024fff]/8 transition-colors"
                  >
                    {ownersOpen ? '✕ Cerrar' : '+ Agregar'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {assignedList.map((u: any) => (
                    <span
                      key={u.id}
                      className="flex items-center gap-2 py-1 pl-1 pr-1.5 bg-white border border-[#d6dde5] rounded-full text-[15px] font-medium whitespace-nowrap"
                    >
                      <span className="w-7 h-7 rounded-full bg-[#024fff] text-white text-[11px] font-bold flex items-center justify-center">
                        <span className="translate-y-[0.5px] leading-none select-none">{ini(u.name)}</span>
                      </span>
                      <span className="text-[#0d0d0d]">{u.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = rawAssignedIds.filter((id: string) => id !== u.id);
                          updateMutation.mutate({
                            assigneeIds: next,
                            ownerId: next[0] || null,
                          });
                        }}
                        title="Quitar"
                        className="border-0 bg-transparent cursor-pointer text-[#8c96a3] w-[22px] h-[22px] rounded-full flex items-center justify-center hover:bg-[#eef3f7] hover:text-[#0d0d0d] p-0"
                      >
                        <XIcon className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {assignedList.length === 0 && (
                    <span className="text-[15px] text-[#8c96a3]">Sin asignar</span>
                  )}
                </div>

                {(() => {
                  const candidateOwners = allUsers.filter(
                    (u: any) => !assignedList.some((a: any) => a.id === u.id) && u.name.toLowerCase().includes(ownerQuery.trim().toLowerCase())
                  );
                  return ownersOpen && (
                    <div
                      className="absolute top-[34px] right-0 w-[260px] bg-white border border-[#d6dde5] rounded-[10px] shadow-[0_12px_32px_rgba(0,14,31,.16)] p-1.5 z-40 flex flex-col gap-0.5 text-left"
                    >
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
                            if (candidateOwners.length > 0) {
                              setSelectedOwnerIndex(prev => (prev + 1) % candidateOwners.length);
                            }
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            if (candidateOwners.length > 0) {
                              setSelectedOwnerIndex(prev => (prev - 1 + candidateOwners.length) % candidateOwners.length);
                            }
                          } else if (e.key === 'Enter') {
                            e.preventDefault();
                            const u = candidateOwners[selectedOwnerIndex];
                            if (u) {
                              if (!rawAssignedIds.includes(u.id)) {
                                const next = [...rawAssignedIds, u.id];
                                updateMutation.mutate({
                                  assigneeIds: next,
                                  ownerId: next[0] || u.id,
                                });
                              }
                              setOwnerQuery('');
                              setOwnersOpen(false);
                            }
                          }
                        }}
                        autoFocus
                        placeholder="Buscar persona…"
                        className="h-[38px] box-border font-anek text-[15px] px-3 border border-[#d6dde5] rounded-md outline-none mb-1 focus:border-[#024fff]"
                      />
                      <div className="flex flex-col max-h-[220px] overflow-y-auto">
                        {candidateOwners.length === 0 && (
                          <span className="text-[13px] text-[#8c96a3] p-2 text-center">Nadie coincide con la búsqueda</span>
                        )}
                        {candidateOwners.map((u: any, idx: number) => {
                          const isSelected = idx === selectedOwnerIndex;
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onMouseEnter={() => setSelectedOwnerIndex(idx)}
                              onClick={() => {
                                if (!rawAssignedIds.includes(u.id)) {
                                  const next = [...rawAssignedIds, u.id];
                                  updateMutation.mutate({
                                    assigneeIds: next,
                                    ownerId: next[0] || u.id,
                                  });
                                }
                                setOwnerQuery('');
                                setOwnersOpen(false);
                              }}
                              className={`flex items-center gap-2.5 border-0 cursor-pointer font-anek text-[15px] p-2 px-2.5 rounded-md text-left transition-colors ${
                                isSelected ? 'bg-[#024fff]/10 text-[#024fff] font-bold' : 'bg-transparent text-[#0d0d0d] hover:bg-[#eef3f7]'
                              }`}
                            >
                              <span className="w-[26px] h-[26px] rounded-full bg-[#024fff] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                <span className="translate-y-[0.5px] leading-none select-none">{ini(u.name)}</span>
                              </span>
                              <span className="flex-1 truncate">{u.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5 min-w-0">
                  <span className="text-[12px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">Fecha de entrega</span>
                  <input
                    type="date"
                    defaultValue={formatDateISO(ticket.dueDate)}
                    onChange={e => updateMutation.mutate({ dueDate: e.target.value || null })}
                    className="h-[42px] box-border font-anek text-[15px] px-3 border border-[#d6dde5] rounded-lg bg-white outline-none text-[#0d0d0d] min-w-0 w-full focus:border-[#024fff]"
                  />
                </div>
                {isPieza && (
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <span className="text-[12px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">Fecha de publicación</span>
                    <input
                      type="date"
                      defaultValue={formatDateISO((ticket as any).plannedDate)}
                      onChange={e => updateMutation.mutate({ plannedDate: e.target.value || null })}
                      className="h-[42px] box-border font-anek text-[15px] px-3 border border-[#d6dde5] rounded-lg bg-white outline-none text-[#0d0d0d] min-w-0 w-full focus:border-[#024fff]"
                    />
                  </div>
                )}
              </div>

              {/* Prioridad */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">Prioridad</span>
                <div className="flex p-1 bg-[#eef3f7] rounded-lg gap-0.5">
                  {PRIORIDADES.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => updateMutation.mutate({ prioridad: p.value })}
                      className={`flex-1 min-w-0 whitespace-nowrap px-1.5 border-0 cursor-pointer font-anek text-[15px] font-bold h-[36px] rounded-md flex items-center justify-center gap-2 transition-all ${
                        ticket.prioridad === p.value
                          ? 'bg-white text-[#0d0d0d] shadow-[0_1px_2px_rgba(0,14,31,.12)]'
                          : 'bg-transparent text-[#5b6675]'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.dot }} />
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="h-px bg-[#d6dde5]" />

            {/* 2 Entrega (for Pieza) */}
            {isPieza && (
              <>
                <div className="flex flex-col gap-4">
                  <span className="text-[13px] font-[800] tracking-[0.07em] uppercase text-[#0d0d0d]">Entrega</span>
                  <div className="flex flex-col gap-2">
                    <span className="text-[12px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">Diseño final</span>
                    
                    {/* Lista de links de diseño final */}
                    {parseDeliverableLinks(ticket?.linkEntregable).length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        {parseDeliverableLinks(ticket?.linkEntregable).map((link, idx) => (
                          <div
                            key={`entregable-pieza-${idx}`}
                            className="flex items-center gap-2 p-2 px-3 bg-[#024fff]/5 border border-[#024fff]/25 rounded-lg group transition-colors hover:bg-[#024fff]/8"
                          >
                            <div className="w-6 h-6 rounded bg-[#024fff]/10 flex items-center justify-center text-[#024fff] shrink-0">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </div>
                            <a
                              href={ensureAbsoluteUrl(link)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 font-anek text-[14px] font-semibold text-[#024fff] hover:underline truncate"
                              title={link}
                            >
                              {link}
                            </a>
                            <button
                              type="button"
                              onClick={() => removeEntregableLink(idx)}
                              className="border-0 bg-transparent cursor-pointer text-[#8c96a3] hover:text-red-500 p-1 rounded hover:bg-white/80 transition-colors"
                              title="Eliminar link"
                            >
                              <XIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Input para agregar link de diseño final */}
                    <div className="flex items-center gap-1.5">
                      <input
                        value={entregableInput}
                        onChange={e => setEntregableInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addEntregableLink();
                          }
                        }}
                        placeholder="Pegá un link al diseño terminado y presioná Enter"
                        className="h-[42px] box-border font-anek text-[15px] px-3 border border-[#d6dde5] rounded-lg bg-white outline-none text-[#0d0d0d] min-w-0 w-full flex-1 focus:border-[#024fff] focus:ring-2 focus:ring-[#024fff]/12"
                      />
                      {entregableInput.trim() && (
                        <button
                          type="button"
                          onClick={addEntregableLink}
                          className="h-[42px] px-3.5 border-0 bg-[#024fff] rounded-lg cursor-pointer font-anek text-[14px] font-bold text-white hover:bg-[#0c57d3] transition-colors shrink-0"
                        >
                          Agregar
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="h-px bg-[#d6dde5]" />
              </>
            )}

            {/* 3 Detalles */}
            <div className="flex flex-col gap-4">
              <span className="text-[13px] font-[800] tracking-[0.07em] uppercase text-[#0d0d0d]">Detalles</span>

              <div className="flex flex-col gap-3">
                {/* Cliente */}
                <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-3 min-w-0">
                  <span className="text-[12px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">Cliente</span>
                  <div className="h-[42px] box-border font-anek text-[15px] px-3 border border-[#d6dde5] rounded-lg bg-white flex items-center text-[#0d0d0d] font-bold truncate">
                    {ticket.client?.name || '—'}
                  </div>
                </div>

                {/* Formato */}
                <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-3 min-w-0">
                  <span className="text-[12px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">
                    {isPieza ? 'Formato' : 'Tipo'}
                  </span>
                  <div className="relative min-w-0">
                    <button
                      type="button"
                      data-menu="1"
                      onClick={() => setFmtOpen(!fmtOpen)}
                      className="w-full h-[42px] box-border flex items-center gap-2 px-3 border border-[#d6dde5] rounded-lg bg-white cursor-pointer font-anek text-[15px] text-left text-[#0d0d0d]"
                    >
                      <span className="flex-1 truncate leading-none">
                        {((ticket as any).tiposContenido || []).length > 0 ? (ticket as any).tiposContenido.join(', ') : 'Seleccionar…'}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-[#5b6675] shrink-0" />
                    </button>

                    {fmtOpen && (
                      <div
                        data-menu="1"
                        className="absolute top-[48px] left-0 right-0 min-w-[220px] max-h-[320px] overflow-y-auto bg-white border border-[#d6dde5] rounded-[10px] shadow-[0_12px_32px_rgba(0,14,31,.16)] p-1.5 z-40 flex flex-col gap-0.5"
                      >
                        <div className="flex items-center justify-between p-1.5 px-2.5 border-b border-[#eef3f7] mb-1">
                          <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#8c96a3]">Elegí 1 o más</span>
                          <button
                            type="button"
                            onClick={() => setFmtOpen(false)}
                            className="border-0 bg-transparent cursor-pointer font-anek text-[14px] font-bold text-[#024fff] p-0.5"
                          >
                            Listo
                          </button>
                        </div>
                        {formatList.map(f => {
                          const on = ((ticket as any).tiposContenido || []).includes(f);
                          return (
                            <label
                              key={f}
                              className={`flex items-center gap-2.5 p-2 px-2.5 rounded-md cursor-pointer text-[15px] text-[#0d0d0d] hover:bg-[#eef3f7] ${
                                on ? 'bg-[#024fff]/6' : ''
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => toggleFormato(f)}
                                className="w-4 h-4 m-0 accent-[#024fff] shrink-0"
                              />
                              <span>{f}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Voz (para Piezas) */}
                {isPieza && (
                  <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-3 min-w-0">
                    <span className="text-[12px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">Voz</span>
                    <div className="flex p-1 bg-[#eef3f7] rounded-lg gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          updateMutation.mutate({ speakerId: null });
                          setIsChangingSpeaker(false);
                        }}
                        className={`flex-1 border-0 cursor-pointer font-anek text-[15px] font-bold h-[36px] rounded-md transition-all flex items-center justify-center leading-none ${
                          !ticket.speakerId && !isChangingSpeaker ? 'bg-white text-[#0d0d0d] shadow-[0_1px_2px_rgba(0,14,31,.12)]' : 'bg-transparent text-[#5b6675]'
                        }`}
                      >
                        Marca
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!ticket.speakerId) {
                            if (speakers.length === 1) {
                              updateMutation.mutate({ speakerId: speakers[0].id });
                              setIsChangingSpeaker(false);
                            } else {
                              setIsChangingSpeaker(true);
                            }
                          }
                        }}
                        className={`flex-1 border-0 cursor-pointer font-anek text-[15px] font-bold h-[36px] rounded-md transition-all flex items-center justify-center leading-none ${
                          ticket.speakerId || isChangingSpeaker ? 'bg-white text-[#0d0d0d] shadow-[0_1px_2px_rgba(0,14,31,.12)]' : 'bg-transparent text-[#5b6675]'
                        }`}
                      >
                        Vocero
                      </button>
                    </div>
                  </div>
                )}

                {/* Speaker selector list if changing */}
                {isChangingSpeaker && (
                  <div className="flex flex-col bg-white border border-[#d6dde5] rounded-[10px] p-2 gap-1.5 shadow-sm">
                    <div className="flex items-center justify-between pb-1 border-b border-[#eef3f7] px-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#5b6675]">Seleccionar vocero</span>
                      <button
                        type="button"
                        onClick={() => setIsChangingSpeaker(false)}
                        className="w-5 h-5 flex items-center justify-center rounded text-[#8c96a3] hover:text-[#0d0d0d] hover:bg-[#eef3f7] cursor-pointer"
                        title="Cerrar"
                      >
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {speakers.length === 0 ? (
                      <span className="text-[13px] text-[#8c96a3] p-2">Este cliente no tiene voceros configurados</span>
                    ) : (
                      <div className="flex flex-col max-h-[200px] overflow-y-auto">
                        {speakers.map((sp: any) => {
                          const isSelected = sp.id === ticket.speakerId;
                          return (
                            <button
                              key={sp.id}
                              type="button"
                              onClick={() => {
                                updateMutation.mutate({ speakerId: sp.id });
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
                )}

                {/* Prensa fields */}
                {esPrensa && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-[#d6dde5]">
                    <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">Datos de Prensa</label>
                    <input
                      defaultValue={(ticket as any).medio || ''}
                      onBlur={e => updateMutation.mutate({ medio: e.target.value || null })}
                      placeholder="Medio (ej. Clarín, Forbes…)"
                      className="h-[36px] px-2.5 border border-[#d6dde5] rounded-lg bg-white text-[13px] outline-none focus:border-[#024fff] py-0 leading-[34px]"
                    />
                    <input
                      defaultValue={(ticket as any).periodista || ''}
                      onBlur={e => updateMutation.mutate({ periodista: e.target.value || null })}
                      placeholder="Periodista / Contacto"
                      className="h-[36px] px-2.5 border border-[#d6dde5] rounded-lg bg-white text-[13px] outline-none focus:border-[#024fff] py-0 leading-[34px]"
                    />
                  </div>
                )}

                {/* Vinculados */}
                <div className="pt-2 border-t border-[#d6dde5]">
                  <TicketsReferencia
                    ticketId={ticket.id}
                    clientId={ticket.client?.id ?? ''}
                    references={ticket.references ?? []}
                  />
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* HOVER COMMENT PREVIEW */}
      {hoverComment && !pop && (
        <div
          data-hover-comment="1"
          style={{
            position: 'fixed',
            left: `${hoverComment.x}px`,
            top: `${hoverComment.y}px`,
            pointerEvents: 'none',
          }}
          className="w-[280px] bg-white border border-[#d6dde5] rounded-[10px] shadow-[0_10px_28px_rgba(0,14,31,.2)] z-[60] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="p-2 px-2.5 text-[11px] text-[#5b6675] truncate border-l-2 border-[#00e39c] m-2 mb-1 pl-2 bg-[#00ff99]/5 rounded-r">
            «{hoverComment.quote}»
          </div>

          {hoverComment.items.length > 0 ? (
            <div className="flex flex-col max-h-[220px] overflow-y-auto">
              {hoverComment.items.map((it, idx) => (
                <div key={idx} className="flex gap-2 p-2 px-2.5 border-b border-[#f0f4f8] last:border-b-0">
                  <span className="w-5 h-5 rounded-full bg-[#eef3f7] text-[#024fff] text-[9px] font-bold flex items-center justify-center shrink-0">
                    {ini(it.author)}
                  </span>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex gap-1.5 items-baseline">
                      <span className="text-[11px] font-bold text-[#0d0d0d]">{it.author}</span>
                      {it.when && <span className="text-[10px] text-[#8c96a3]">{it.when}</span>}
                    </div>
                    <span className="text-[12px] leading-snug text-[#1d2a3a] whitespace-pre-wrap">{formatCommentWithMentions(it.text)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-2 px-2.5 text-[11px] text-[#8c96a3] italic">
              Hacé click para escribir o responder este comentario
            </div>
          )}

          <div className="bg-[#f7fafc] px-2.5 py-1 text-[10px] text-[#8c96a3] border-t border-[#eef3f7] flex items-center justify-between">
            <span>Click para responder o resolver</span>
          </div>
        </div>
      )}

      {/* INLINE COMMENT POPOVER */}
      {pop && (
        <div
          data-inline-pop="1"
          style={{ position: 'fixed', left: `${pop.x}px`, top: `${pop.y}px` }}
          className="w-[300px] bg-white border border-[#d6dde5] rounded-[10px] shadow-[0_12px_32px_rgba(0,14,31,.18)] z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95"
        >
          <div className="p-2.5 px-3 text-[12px] text-[#5b6675] truncate border-l-2 border-[#00e39c] m-2.5 mb-0 pl-2 bg-[#00ff99]/5 rounded-r">
            «{threads[pop.id]?.quote}»
          </div>

          {threads[pop.id]?.items.map((it, idx) => (
            <div key={idx} className="flex gap-2 p-2.5 px-3 pt-2">
              <span className="w-5 h-5 rounded-full bg-[#eef3f7] text-[#024fff] text-[9px] font-bold flex items-center justify-center shrink-0">
                {ini(it.author)}
              </span>
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex gap-1.5 items-baseline">
                  <span className="text-[12px] font-bold text-[#0d0d0d]">{it.author}</span>
                  <span className="text-[11px] text-[#8c96a3]">{it.when}</span>
                </div>
                <span className="text-[13px] leading-snug text-[#1d2a3a] whitespace-pre-wrap">{formatCommentWithMentions(it.text)}</span>
              </div>
            </div>
          ))}

          <div className="p-2.5 pb-3 flex flex-col gap-2">
            <MentionTextarea
              value={popInput}
              onChange={setPopInput}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendPop();
                }
                if (e.key === 'Escape') closePop();
              }}
              placeholder={threads[pop.id]?.items.length ? 'Responder… (@ para mencionar)' : 'Escribí un comentario… (@ para mencionar)'}
              rows={2}
              users={allUsers}
              autoFocus
              className="w-full font-anek text-[13px] p-2 border border-[#d6dde5] rounded-lg outline-none resize-none focus:border-[#024fff] focus:ring-2 focus:ring-[#024fff]/12"
            />
            <div className="flex items-center gap-1.5">
              <span className="flex-1"></span>
              <button
                type="button"
                onClick={closePop}
                className="border-0 bg-transparent cursor-pointer font-anek text-[12px] font-medium text-[#5b6675] p-1.5 rounded hover:bg-[#eef3f7]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={sendPop}
                disabled={!popInput.trim()}
                className={`h-7 border-0 rounded-md cursor-pointer font-anek text-[12px] font-bold text-white px-3 transition-colors ${
                  popInput.trim() ? 'bg-[#024fff] hover:bg-[#0c57d3]' : 'bg-[#b9c2cd] cursor-not-allowed'
                }`}
              >
                {threads[pop.id]?.items.length ? 'Responder' : 'Comentar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
