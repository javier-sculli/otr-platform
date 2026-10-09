import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  Archive,
  MoreHorizontal,
  Link2,
  ExternalLink,
  Sparkles,
  X as XIcon,
  Copy as CopyIcon,
  Check,
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
} from '../components/ticket';
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
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => api.deleteComment(ticketId!, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', ticketId] });
    },
  });

  const {
    pop,
    threads,
    hoverComment,
    popRefVal,
    handleMarkHover,
    handleMarkClick,
    closePop,
    sendPop,
    startInlineComment,
    locateMark: locateMarkBase,
  } = useInlineComments({
    comments: commentsData?.data || [],
    currentUser,
    onSubmitComment: ({ fullContent }) => {
      if (ticketId) {
        createCommentMutation.mutate(fullContent);
      }
    },
  });

  const [delOpen, setDelOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [tituloTemp, setTituloTemp] = useState('');
  const [briefOpen, setBriefOpen] = useState(false);
  const [notasOpen, setNotasOpen] = useState(false);

  const [activeCopyTab, setActiveCopyTab] = useState<string>('LinkedIn');
  const [copyPerCanal, setCopyPerCanal] = useState<Record<string, string>>({});
  const [notasAudiovisual, setNotasAudiovisual] = useState('');
  const [entregableInput, setEntregableInput] = useState('');
  const [briefTemp, setBriefTemp] = useState('');

  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>(() => {
    if (!ticketId) return [];
    const saved = sessionStorage.getItem(`ticket-files-${ticketId}`);
    return saved ? JSON.parse(saved) : [];
  });


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

  const isArchived = ticket?.status === 'LISTO' || ticket?.status === 'CANCELADO';
  const handleArchivar = () => {
    if (isArchived) {
      updateMutation.mutate({ status: 'PENDIENTE' });
    } else {
      updateMutation.mutate({ status: 'LISTO' });
    }
  };


  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (!target.closest('[data-menu]')) {
        setDelOpen(false);
        setMoreOpen(false);
      }

      const path = (e.composedPath ? e.composedPath() : []) as HTMLElement[];
      const isInsidePop = Boolean(
        target.closest?.('[data-inline-pop]') ||
        target.closest?.('[data-mention-dropdown]') ||
        path.some((el) => el instanceof HTMLElement && (el.hasAttribute?.('data-inline-pop') || el.hasAttribute?.('data-mention-dropdown')))
      );

      if (
        popRefVal.current &&
        !isInsidePop &&
        !target.closest?.('mark[data-c]') &&
        !target.closest?.('[data-comment-trigger]')
      ) {
        closePop();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (popRefVal.current) closePop();
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
  const startInline = (ref: React.RefObject<HTMLDivElement | null>, e?: React.MouseEvent) => {
    startInlineComment(ref, undefined, e);
  };

  const locateMark = (quoteText: string) => {
    locateMarkBase(quoteText, (cleanQ) => {
      if (copyPerCanal) {
        for (const [canal, text] of Object.entries(copyPerCanal)) {
          if (text?.includes(cleanQ)) {
            setActiveCopyTab(canal);
            break;
          }
        }
      }
    });
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
  const isPendiente = ['PENDIENTE', 'Pendiente'].includes(ticket.status);
  const isDisenoOEdicion = ['DISENO', 'EDICION', 'Diseño', 'Edición'].includes(ticket.status);

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
              <TicketStatusPicker
                variant="page"
                currentStatus={esPrensa ? (ticket.subEstado ?? 'PENDIENTE') : ticket.status}
                nextStatusLabel={nextInfo.label}
                nextStatusValue={nextInfo.next}
                options={esPrensa ? PRENSA_STATUS_OPTIONS : STATUS_OPTIONS}
                onAdvance={handleNextStatusClick}
                onSelectStatus={(status) => handleSelectStatus(status, esPrensa)}
              />
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

                {/* Resources */}
                <TicketResources
                  links={ticket.links || []}
                  attachedFiles={attachedFiles}
                  onAddLink={(url) => {
                    const next = [...(ticket.links || []), url];
                    updateMutation.mutate({ links: next });
                  }}
                  onRemoveLink={(idx) => {
                    const next = (ticket.links || []).filter((_: string, i: number) => i !== idx);
                    updateMutation.mutate({ links: next });
                  }}
                  onAddFiles={(files) => {
                    const newFiles: AttachedFile[] = files.map(file => {
                      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                      const isImg = file.type.startsWith('image/');
                      const isTxt = file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.txt');
                      return {
                        id,
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        content: null,
                        contentType: isImg ? 'image' : isTxt ? 'text' : 'other',
                      };
                    });
                    setAttachedFiles(prev => [...prev, ...newFiles]);
                  }}
                  onRemoveFile={(fileId) => setAttachedFiles(prev => prev.filter(f => f.id !== fileId))}
                  placeholder={isPieza ? 'Pegá un link a fotos, logos o documentos y presioná Enter' : 'Pegá un link a documentos o ejemplos y presioná Enter'}
                  variant="page"
                />
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

          {/* Notas de diseño y Copy (en Pendiente y Redacción el copy aparece primero y las notas son colapsables) */}
          {(() => {
            const copyNode = isPieza && (
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
                </div>

                <div className="border border-[#d6dde5] rounded-[12px] overflow-hidden bg-white shadow-xs">
                  {/* Redes tabs */}
                  <div className="flex items-center justify-between gap-2 p-2 border-b border-[#eef3f7] bg-[#f7fafc] flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
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

                    <TicketCopyButton
                      text={currentCopy}
                      editorRef={copyRef}
                    />
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
            );

            const notasNode = isPieza && (
              <div className="flex flex-col gap-3.5">
                {isPendiente ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setNotasOpen(!notasOpen)}
                      className="flex items-center gap-3 w-full p-3.5 px-4 border border-[#d6dde5] rounded-[12px] bg-[#f7fafc] hover:bg-[#eef3f7] cursor-pointer font-anek text-left transition-colors"
                    >
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className="text-[12px] font-bold tracking-[0.06em] uppercase text-[#5b6675]">
                          Notas de diseño
                        </span>
                        {!notasOpen && (
                          <span className="text-[14px] text-[#1d2a3a] truncate block">
                            {notasAudiovisual?.replace(/<[^>]+>/g, '').trim().split('\n')[0] || 'Sin notas de diseño'}
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 whitespace-nowrap flex items-center gap-1.5 text-[14px] font-bold text-[#024fff]">
                        {notasOpen ? 'Ocultar' : 'Ver notas'}
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${notasOpen ? 'rotate-180' : ''}`} />
                      </span>
                    </button>

                    {notasOpen && (
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
                    )}
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>
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

        </div>

        {/* RIGHT COLUMN (SIDEBAR) */}
        <div className="self-stretch min-w-0 bg-[#f7fafc] border-t lg:border-t-0 lg:border-l border-[#d6dde5] box-border">
          <div className="lg:sticky lg:top-[124px] lg:max-h-[calc(100vh-124px)] lg:overflow-y-auto p-6 sm:p-7 pb-12 flex flex-col gap-7 box-border">

            {/* Link a la Publicación (a partir de listo para publicar en adelante) */}
            {(['LISTO_PARA_PUBLICAR', 'PUBLICADO', 'LISTO'].includes(ticket.status) ||
              (ticket.area === 'PRENSA' && ['PENDIENTE_PUBLICACION', 'LISTO'].includes(ticket.subEstado))) && (
              <div className="flex flex-col gap-3.5">
                <TicketPublishLinks
                  value={ticket?.linkPublicacion}
                  onChange={(nextVal) => updateMutation.mutate({ linkPublicacion: nextVal || null })}
                  variant="page"
                />
                <div className="h-px bg-[#d6dde5] mt-2" />
              </div>
            )}

            {/* 0 Comentarios */}
            <TicketCommentsThread
              comments={comments}
              currentUserId={currentUser?.id}
              currentUserName={currentUser?.name || currentUser?.email || 'YO'}
              teamList={allUsers}
              onAddComment={(content) => {
                createCommentMutation.mutate(content);
              }}
              onDeleteComment={(commentId) => {
                deleteCommentMutation.mutate(commentId);
              }}
              onLocateQuote={locateMark}
              isPendingAdd={createCommentMutation.isPending}
              variant="page"
              createdDate={ticket.createdAt}
              updatedDate={ticket.updatedAt}
            />

            <div className="h-px bg-[#d6dde5]" />

            {/* 1 Seguimiento */}
            <div className="flex flex-col gap-4">
              <span className="text-[13px] font-[800] tracking-[0.07em] uppercase text-[#0d0d0d]">Seguimiento</span>

              {/* Owners */}
              <TicketOwnersPicker
                assigneeIds={rawAssignedIds}
                users={allUsers}
                label={isPieza ? 'Owners' : 'Responsables'}
                variant="page"
                onChange={(next) => {
                  updateMutation.mutate({
                    assigneeIds: next,
                    ownerId: next[0] || null,
                  });
                }}
              />

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
                  <TicketFormatPicker
                    selectedFormats={(ticket as any).tiposContenido || []}
                    availableFormats={formatList}
                    onChange={(next) => {
                      updateMutation.mutate({ tiposContenido: next });
                    }}
                    label={isPieza ? 'Formato' : 'Tipo'}
                  />
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
      <InlineCommentHoverTooltip
        hoverComment={hoverComment}
        isVisible={!pop}
      />

      {/* INLINE COMMENT POPOVER */}
      <InlineCommentPopover
        pop={pop}
        thread={pop ? threads[pop.id] : undefined}
        users={allUsers}
        onSend={(text) => sendPop(text)}
        onClose={closePop}
      />

    </div>
  );
}
