import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Calendar,
  User,
  Hash,
  Edit3,
  FileText,
  Link2,
  Image as ImageIcon,
  ExternalLink,
  Sparkles,
  Clock,
  Plus,
  X as XIcon,
  Copy,
  Check,
  Paperclip,
  File,
  MessageSquare,
  Send,
  Trash2,
  ClipboardList,
  Newspaper,
  Package,
  ArrowRight,
  ChevronDown,
  Archive,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ensureAbsoluteUrl, copyHtmlToClipboard } from '../lib/utils';
import { RichNotesEditor } from '../components/RichNotesEditor';
import { TransitionToDesignModal } from '../components/TransitionToDesignModal';

type AttachedFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string | null;
  contentType: 'text' | 'image' | 'other';
};
import { api } from '../lib/api';
import { TicketsReferencia } from '../components/TicketsReferencia';
import { ResponsablesSelect } from '../components/ResponsablesSelect';
import { SUB_DEF, STATUS_OPTIONS, getNextStatusInfo, type SubEstado } from '../lib/estados';

function getStatusStyle(status: string, esPrensa?: boolean, subEstado?: string | null) {
  if (esPrensa && subEstado) {
    switch (subEstado) {
      case 'LISTO':           return 'bg-[#00ff99]/20 border-[#00ff99]/45 text-[#000033]';
      case 'EN_CURSO':
      case 'REVISION_INTERNA':
      case 'ENVIADO_CLIENTE':  return 'bg-[#024fff]/10 border-[#024fff]/30 text-[#024fff]';
      case 'CANCELADO':
      case 'PENDIENTE':       return 'bg-[#000033]/5 border-[#000033]/20 text-[#000033]/60';
      default:                return 'bg-[#000033]/5 border-[#000033]/20 text-[#000033]/60';
    }
  }
  switch (status) {
    case 'LISTO':                return 'bg-[#00ff99]/40 border-[#00ff99]/70 text-[#000033]';
    case 'PUBLICADO':            return 'bg-[#00ff99]/30 border-[#00ff99]/60 text-[#000033]';
    case 'LISTO_PARA_PUBLICAR':  return 'bg-[#00ff99]/20 border-[#00ff99]/40 text-[#000033]';
    case 'ESPERANDO_FEEDBACK':   return 'bg-[#00ff99]/10 border-[#00ff99]/30 text-[#000033]';
    case 'CLIENTE':              return 'bg-[#00ff99]/10 border-[#00ff99]/20 text-[#000033]';
    case 'REVISION_INTERNA':     return 'bg-[#024fff]/10 border-[#024fff]/20 text-[#024fff]';
    case 'EDICION':              return 'bg-[#024fff]/8 border-[#024fff]/15 text-[#024fff]';
    case 'DISENO':               return 'bg-[#024fff]/5 border-[#024fff]/10 text-[#024fff]';
    case 'REDACCION':            return 'bg-[#024fff]/5 border-[#024fff]/10 text-[#024fff]';
    case 'CANCELADO':            return 'bg-[#000033]/5 border-[#000033]/15 text-[#000033]/50';
    default:                     return 'bg-[#000033]/5 border-[#000033]/20 text-[#000033]/60';
  }
}

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteTicket(ticketId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      navigate('/backlog');
    },
  });

  // Comments
  const [commentText, setCommentText] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(-1);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

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
  const mentionSuggestions = mentionQuery !== null
    ? allUsers.filter(u => u.name.toLowerCase().includes(mentionQuery.toLowerCase()) && u.id !== (currentUser as any)?.id)
    : [];

  const createCommentMutation = useMutation({
    mutationFn: (content: string) => api.createComment(ticketId!, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', ticketId] });
      setCommentText('');
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => api.deleteComment(ticketId!, commentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', ticketId] }),
  });

  const handleCommentInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCommentText(val);
    const cursor = e.target.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursor);
    const atIdx = textBeforeCursor.lastIndexOf('@');
    if (atIdx !== -1 && (atIdx === 0 || /\s/.test(textBeforeCursor[atIdx - 1]))) {
      const query = textBeforeCursor.slice(atIdx + 1);
      if (!query.includes(' ') || query.length <= 20) {
        setMentionQuery(query);
        setMentionStart(atIdx);
        return;
      }
    }
    setMentionQuery(null);
  };

  const insertMention = (userName: string) => {
    const before = commentText.slice(0, mentionStart);
    const after = commentText.slice(commentInputRef.current?.selectionStart ?? commentText.length);
    setCommentText(`${before}@${userName} ${after}`);
    setMentionQuery(null);
    setTimeout(() => commentInputRef.current?.focus(), 0);
  };

  const handleCommentSubmit = () => {
    if (!commentText.trim()) return;
    createCommentMutation.mutate(commentText.trim());
  };

  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [tituloTemp, setTituloTemp] = useState('');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [isDesignModalOpen, setIsDesignModalOpen] = useState(false);

  const handleSelectStatus = (targetStatus: string, isSubEstado?: boolean) => {
    setShowStatusDropdown(false);
    if (isSubEstado) {
      updateMutation.mutate({ subEstado: targetStatus });
      return;
    }
    if (targetStatus === 'DISENO') {
      setIsDesignModalOpen(true);
      return;
    }
    if (targetStatus === 'LISTO' || targetStatus === 'CANCELADO') {
      const label = targetStatus === 'LISTO' ? 'Listo (archivado)' : 'Stand-by / Cancelado';
      if (!window.confirm(`¿Mover a "${label}"?\n\nEl ticket desaparecerá del kanban.`)) return;
    }
    updateMutation.mutate({ status: targetStatus });
  };

  const handleNextStatusClick = () => {
    if (!ticket) return;
    const info = getNextStatusInfo(ticket.status, esPrensa, ticket.subEstado, (ticket as any).tiposContenido);
    handleSelectStatus(info.next, info.isPrensa);
  };

  const [newLinkInput, setNewLinkInput] = useState('');
  const [newEntregableInput, setNewEntregableInput] = useState('');
  const [editandoEntregable, setEditandoEntregable] = useState(false);
  const [notasAudiovisual, setNotasAudiovisual] = useState('');
  const [briefTemp, setBriefTemp] = useState('');
  const [copyCopied, setCopyCopied] = useState(false);
  const [activeCopyTab, setActiveCopyTab] = useState<string>('');
  const [copyPerCanal, setCopyPerCanal] = useState<Record<string, string>>({});
  const [contentSingle, setContentSingle] = useState<string>('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>(() => {
    if (!ticketId) return [];
    const saved = sessionStorage.getItem(`ticket-files-${ticketId}`);
    return saved ? JSON.parse(saved) : [];
  });
  const linkInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const id = `${Date.now()}-${file.name}`;
      const isImage = file.type.startsWith('image/');
      const isText = file.type.startsWith('text/') || /\.(txt|md|csv)$/i.test(file.name);
      if (isImage) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setAttachedFiles(prev => [...prev, { id, name: file.name, type: file.type, size: file.size, content: ev.target?.result as string, contentType: 'image' }]);
        };
        reader.readAsDataURL(file);
      } else if (isText) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setAttachedFiles(prev => [...prev, { id, name: file.name, type: file.type, size: file.size, content: ev.target?.result as string, contentType: 'text' }]);
        };
        reader.readAsText(file);
      } else {
        setAttachedFiles(prev => [...prev, { id, name: file.name, type: file.type, size: file.size, content: null, contentType: 'other' }]);
      }
    });
    e.target.value = '';
  };

  useEffect(() => {
    if (ticket?.title) setTituloTemp(ticket.title);
    if (ticket?.objetivo !== undefined) setBriefTemp(ticket.objetivo ?? '');
    if ((ticket as any)?.notasAudiovisual !== undefined) {
      setNotasAudiovisual((ticket as any).notasAudiovisual ?? '');
    }
    if (ticket) {
      const perCanal = (ticket as any).contentPerCanal && typeof (ticket as any).contentPerCanal === 'object'
        ? { ...(ticket as any).contentPerCanal as Record<string, string> }
        : {};
      setCopyPerCanal(perCanal);
      setContentSingle(ticket.content ?? '');

      if (!activeCopyTab) {
        const canales = (ticket as any).canales;
        setActiveCopyTab(canales?.length > 0 ? canales[0] : 'LinkedIn');
      }
    }
  }, [ticket?.title, (ticket as any)?.notasAudiovisual, ticket]);

  useEffect(() => {
    if (ticketId) {
      sessionStorage.setItem(`ticket-files-${ticketId}`, JSON.stringify(attachedFiles));
    }
  }, [attachedFiles, ticketId]);

  const handleGuardarTitulo = () => {
    if (tituloTemp.trim() && tituloTemp !== ticket?.title) {
      updateMutation.mutate({ title: tituloTemp });
    }
    setEditandoTitulo(false);
  };

  const handleCancelarTitulo = () => {
    setTituloTemp(ticket?.title ?? '');
    setEditandoTitulo(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center text-[#000033]/60 text-sm">
        Cargando ticket...
      </div>
    );
  }

  if (isError || !ticket) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center gap-4">
        <p className="text-[#000033]/60 text-sm">No se pudo cargar el ticket.</p>
        <button
          onClick={() => navigate('/backlog')}
          className="px-4 py-2 text-xs font-bold text-[#024fff] border-2 border-[#024fff]/20 rounded-lg hover:bg-[#024fff]/10 transition-all"
        >
          Volver al backlog
        </button>
      </div>
    );
  }

  const esTarea = (ticket as any).ticketType?.kind === 'TAREA';
  const esPrensa = (ticket as any).ticketType?.kind === 'PRENSA' || (ticket as any).area === 'PRENSA';
  const esNoContenido = esTarea || esPrensa;
  const subEstadoLabel = ticket.subEstado ? (SUB_DEF[ticket.subEstado as SubEstado]?.label ?? ticket.subEstado) : 'Pendiente';
  const statusLabel = esPrensa ? subEstadoLabel : (STATUS_OPTIONS.find(s => s.value === ticket.status)?.label ?? ticket.status);
  const createdAt = ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const updatedAt = ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#fafafa]">
      {/* Header sticky */}
      <div className="bg-white border-b-2 border-[#000033]/10 px-6 py-3 sticky top-[64px] z-10">
        <div className="max-w-[1400px] mx-auto">
          {/* Row 1: back + title + CTAs */}
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/backlog')}
                className="flex items-center gap-1.5 text-xs font-bold text-[#000033]/60 hover:text-[#000033] transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Backlog
              </button>
              <div className="h-4 w-px bg-[#000033]/20" />

              {editandoTitulo ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tituloTemp}
                    onChange={e => setTituloTemp(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleGuardarTitulo();
                      if (e.key === 'Escape') handleCancelarTitulo();
                    }}
                    autoFocus
                    className="text-base font-bold text-[#000033] border-2 border-[#024fff] rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#024fff] min-w-[300px]"
                  />
                  <button
                    onClick={handleGuardarTitulo}
                    className="px-3 py-1 bg-[#00ff99]/20 border-2 border-[#00ff99]/40 text-[#000033] rounded text-xs font-bold hover:bg-[#00ff99]/30 transition-all"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={handleCancelarTitulo}
                    className="px-3 py-1 border-2 border-[#000033]/10 text-[#000033]/60 rounded text-xs font-medium hover:bg-[#000033]/5 transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h1 className="text-base font-bold text-[#000033]">{ticket.title}</h1>
                  <button
                    onClick={() => setEditandoTitulo(true)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[#024fff]"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Botón Principal: Pasar a [próximo estado] + Dropdown Opcional */}
              {(() => {
                const nextInfo = getNextStatusInfo(ticket.status, esPrensa, ticket.subEstado, (ticket as any).tiposContenido);
                return (
                  <div className="relative inline-flex items-center rounded-lg shadow-sm">
                    <button
                      onClick={handleNextStatusClick}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-[#024fff] text-white font-bold text-xs rounded-l-lg hover:bg-[#024fff]/90 transition-all"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>Pasar a {nextInfo.label}</span>
                    </button>
                    <button
                      onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                      className="px-2 py-2 bg-[#024fff] border-l border-white/25 text-white rounded-r-lg hover:bg-[#024fff]/90 transition-all"
                      title="Cambiar a otro estado..."
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>

                    {/* Popover desplegable de estados */}
                    {showStatusDropdown && (
                      <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border-2 border-[#000033]/15 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                        <div className="px-3 py-1.5 border-b border-[#000033]/10 text-[10px] font-bold text-[#000033]/40 uppercase tracking-wider">
                          Cambiar estado a:
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {(esPrensa ? [
                            { value: 'PENDIENTE', label: 'Pendiente' },
                            { value: 'EN_CURSO', label: 'Ongoing' },
                            { value: 'REVISION_INTERNA', label: 'Revisión Interna' },
                            { value: 'ENVIADO_CLIENTE', label: 'Enviado Cliente' },
                            { value: 'LISTO', label: 'Completado' },
                            { value: 'CANCELADO', label: 'Cancelado' },
                          ] : STATUS_OPTIONS).map(opt => {
                            const isCurrent = esPrensa ? (ticket.subEstado ?? 'PENDIENTE') === opt.value : ticket.status === opt.value;
                            return (
                              <button
                                key={opt.value}
                                onClick={() => handleSelectStatus(opt.value, esPrensa)}
                                className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center justify-between hover:bg-[#024fff]/5 transition-all ${
                                  isCurrent ? 'text-[#024fff] font-bold bg-[#024fff]/5' : 'text-[#000033]/80'
                                }`}
                              >
                                <span>{opt.label}</span>
                                {isCurrent && <Check className="w-3.5 h-3.5 text-[#024fff]" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Botón Redactar contenido */}
              {!esNoContenido && (
                <button
                  onClick={() => navigate(`/content/${ticket.id}`, { state: { attachedFiles: attachedFiles.length > 0 ? attachedFiles : undefined } })}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#024fff] to-[#0040e0] text-white rounded-lg text-xs font-bold hover:opacity-95 transition-all shadow-md shadow-[#024fff]/20"
                >
                  <Sparkles className="w-4 h-4 text-white" />
                  <span>Redactar</span>
                </button>
              )}
            </div>
          </div>

          {/* Row 2: meta badges */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-2.5 py-1 bg-[#024fff]/10 border-2 border-[#024fff]/20 text-[#024fff] text-xs font-bold rounded-lg">
              {ticket.client?.name}
            </span>
            {(ticket as any).tiposContenido?.map((fmt: string, idx: number) => (
              <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#024fff]/10 border border-[#024fff]/30 text-[#024fff] text-xs font-bold rounded-lg">
                <Package className="w-3 h-3" />
                {fmt}
              </span>
            ))}
            {esTarea && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#000033] text-white text-xs font-bold rounded-lg">
                <ClipboardList className="w-3 h-3" />
                Tarea
              </span>
            )}
            {esPrensa && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-600 text-white text-xs font-bold rounded-lg">
                <Newspaper className="w-3 h-3" />
                Prensa
              </span>
            )}
            <span className={`px-2.5 py-1 border-2 text-xs font-bold rounded-lg capitalize ${getStatusStyle(ticket.status, esPrensa, ticket.subEstado)}`}>
              {statusLabel}
            </span>
            {ticket.canales?.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-[#000033]/60">
                <Hash className="w-3.5 h-3.5" />
                <span>{ticket.canales.join(', ')}</span>
              </div>
            )}
            <div className="h-3.5 w-px bg-[#000033]/20" />
            <div className="flex items-center gap-1.5 text-xs text-[#000033]/60 flex-wrap">
              <User className="w-3.5 h-3.5 text-[#000033]/40" />
              {(Array.isArray((ticket as any).assignees)
                ? (ticket as any).assignees
                : ticket.owner ? [ticket.owner] : []
              ).map((u: any) => (
                <span key={u.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#024fff]/10 text-[#024fff] border border-[#024fff]/20 text-xs font-bold rounded-md">
                  <span className="w-3.5 h-3.5 rounded-full bg-[#024fff]/20 flex items-center justify-center text-[9px] font-extrabold text-[#024fff]">
                    {u.name ? u.name.charAt(0).toUpperCase() : '?'}
                  </span>
                  {u.name}
                </span>
              ))}
            </div>
            {ticket.dueDate && (
              <div className="flex items-center gap-1 text-xs text-[#000033]/60">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {new Date(ticket.dueDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1 text-xs text-[#000033]/60">
              <Clock className="w-3.5 h-3.5" />
              <span>Editado {updatedAt}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="grid grid-cols-3 gap-6">

          {/* Main column — 2/3 */}
          <div className="col-span-2 space-y-5">

            {/* Brief */}
            <div className="bg-white border-2 border-[#000033]/10 rounded-lg p-5">
              <h2 className="text-xs font-bold text-[#000033] uppercase flex items-center gap-2 mb-3">
                <FileText className="w-3.5 h-3.5" />
                {esNoContenido ? 'Descripción' : 'Brief'}
              </h2>
              <textarea
                value={briefTemp}
                onChange={e => setBriefTemp(e.target.value)}
                onBlur={() => {
                  if (briefTemp !== (ticket.objetivo ?? '')) {
                    updateMutation.mutate({ objetivo: briefTemp || null });
                  }
                }}
                placeholder={esNoContenido ? 'Describí el entregable acá...' : 'Escribí el brief acá...'}
                rows={3}
                className="w-full text-xs text-[#000033] leading-relaxed resize-none border-none outline-none bg-transparent placeholder:text-[#000033]/30 hover:bg-[#000033]/3 focus:bg-[#000033]/5 rounded transition-all"
              />
            </div>

            {/* Info / Recursos */}
            <div className="bg-white border-2 border-[#000033]/10 rounded-lg p-5">
              <h2 className="text-xs font-bold text-[#000033] uppercase flex items-center gap-2 mb-3">
                <Link2 className="w-3.5 h-3.5" />
                Info / Recursos
              </h2>
              <div className="space-y-2 mb-3">
                {(ticket.links ?? []).map((link: string, i: number) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 border border-[#024fff]/20 rounded-lg group hover:border-[#024fff]/40 transition-all">
                    <Link2 className="w-3.5 h-3.5 text-[#024fff] flex-shrink-0" />
                    <a
                      href={ensureAbsoluteUrl(link)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#024fff] truncate flex-1 hover:underline"
                    >
                      {link}
                    </a>
                    <ExternalLink className="w-3 h-3 text-[#024fff]/40 flex-shrink-0" />
                    <button
                      onClick={() => {
                        const updated = ticket.links.filter((_: string, j: number) => j !== i);
                        updateMutation.mutate({ links: updated });
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-[#000033]/30 hover:text-red-400 ml-1 flex-shrink-0"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {attachedFiles.map(file => (
                  <div key={file.id} className="flex items-center gap-2 px-3 py-2 border border-[#000033]/15 rounded-lg group hover:border-[#000033]/30 transition-all">
                    {file.contentType === 'image' ? (
                      <ImageIcon className="w-3.5 h-3.5 text-[#000033]/50 flex-shrink-0" />
                    ) : (
                      <File className="w-3.5 h-3.5 text-[#000033]/50 flex-shrink-0" />
                    )}
                    <span className="text-xs text-[#000033]/70 truncate flex-1">{file.name}</span>
                    <span className="text-xs text-[#000033]/30 flex-shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
                    <button
                      onClick={() => setAttachedFiles(prev => prev.filter(f => f.id !== file.id))}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-[#000033]/30 hover:text-red-400 ml-1 flex-shrink-0"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              {/* Add link / file input */}
              <div className="flex gap-2">
                <input
                  ref={linkInputRef}
                  type="url"
                  value={newLinkInput}
                  onChange={e => setNewLinkInput(e.target.value)}
                  onPaste={e => {
                    const pasted = e.clipboardData.getData('text');
                    if (pasted) {
                      e.preventDefault();
                      const url = ensureAbsoluteUrl(pasted.trim());
                      if (url) {
                        const current = ticket.links ?? [];
                        if (!current.includes(url)) {
                          updateMutation.mutate({ links: [...current, url] });
                        }
                        setNewLinkInput('');
                      }
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const url = ensureAbsoluteUrl(newLinkInput.trim());
                      if (url) {
                        const current = ticket.links ?? [];
                        if (!current.includes(url)) {
                          updateMutation.mutate({ links: [...current, url] });
                        }
                        setNewLinkInput('');
                      }
                    }
                  }}
                  onBlur={() => {
                    if (newLinkInput.trim()) {
                      const url = ensureAbsoluteUrl(newLinkInput.trim());
                      if (url) {
                        const current = ticket.links ?? [];
                        if (!current.includes(url)) {
                          updateMutation.mutate({ links: [...current, url] });
                        }
                        setNewLinkInput('');
                      }
                    }
                  }}
                  placeholder="Pegar link..."
                  className="flex-1 px-3 py-1.5 border-2 border-dashed border-[#000033]/10 rounded-lg text-xs focus:outline-none focus:border-[#024fff]/40 focus:border-solid text-[#000033] hover:border-[#024fff]/30 transition-all placeholder-[#000033]/30"
                />
                <button
                  type="button"
                  onClick={() => {
                    const url = ensureAbsoluteUrl(newLinkInput.trim());
                    if (url) {
                      const current = ticket.links ?? [];
                      if (!current.includes(url)) {
                        updateMutation.mutate({ links: [...current, url] });
                      }
                      setNewLinkInput('');
                    }
                  }}
                  className="px-2.5 py-1.5 bg-[#024fff]/10 border-2 border-[#024fff]/20 text-[#024fff] rounded-lg hover:bg-[#024fff]/20 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Adjuntar archivo"
                  className="px-2.5 py-1.5 bg-[#000033]/5 border-2 border-[#000033]/10 text-[#000033]/50 rounded-lg hover:bg-[#000033]/10 hover:text-[#000033] transition-all"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            {/* Tickets de referencia */}
            {(!esPrensa || (ticket.references && ticket.references.length > 0)) && (
              <div className="bg-white border-2 border-[#000033]/10 rounded-lg p-5">
                <TicketsReferencia
                  ticketId={ticket.id}
                  clientId={ticket.client?.id}
                  references={(ticket as any).references ?? []}
                />
              </div>
            )}

            {!esNoContenido && (
              /* Copy final */
              <div className="bg-white border-2 border-[#00ff99]/20 rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-bold text-[#000033] uppercase flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-[#00ff99]" />
                    Copy
                  </h2>
                  {(() => {
                    const canales: string[] = (ticket as any).canales?.length > 0 ? (ticket as any).canales : ['LinkedIn'];
                    const currentTab = activeCopyTab && canales.includes(activeCopyTab) ? activeCopyTab : canales[0];
                    const activeContent = copyPerCanal[currentTab] ?? (canales.length === 1 || currentTab === canales[0] ? contentSingle : '');

                    return activeContent?.trim() ? (
                      <button
                        onClick={async () => {
                          await copyHtmlToClipboard(activeContent);
                          setCopyCopied(true);
                          setTimeout(() => setCopyCopied(false), 2000);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 bg-[#00ff99]/20 border-2 border-[#00ff99]/40 text-[#000033] rounded-lg hover:bg-[#00ff99]/30 transition-all text-xs font-bold"
                      >
                        {copyCopied ? <><Check className="w-3 h-3" />Copiado</> : <><Copy className="w-3 h-3" />Copiar</>}
                      </button>
                    ) : null;
                  })()}
                </div>
                {(() => {
                  const canales: string[] = (ticket as any).canales?.length > 0 ? (ticket as any).canales : ['LinkedIn'];
                  const currentTab = activeCopyTab && canales.includes(activeCopyTab) ? activeCopyTab : canales[0];
                  const activeContent = copyPerCanal[currentTab] ?? (canales.length === 1 || currentTab === canales[0] ? contentSingle : '');

                  const handleCopyChange = (val: string) => {
                    const nextPerCanal = { ...copyPerCanal, [currentTab]: val };
                    setCopyPerCanal(nextPerCanal);
                    if (currentTab === (canales[0] ?? 'LinkedIn')) {
                      setContentSingle(val);
                    }
                  };

                  const handleCopySave = () => {
                    const nextPerCanal = { ...copyPerCanal };
                    const mainContent = currentTab === (canales[0] ?? 'LinkedIn') ? (copyPerCanal[currentTab] ?? contentSingle) : contentSingle;
                    updateMutation.mutate({
                      contentPerCanal: nextPerCanal,
                      content: mainContent || null,
                    });
                  };

                  return (
                    <>
                      {canales.length > 1 && (
                        <div className="flex items-center gap-1 mb-3 overflow-x-auto">
                          {canales.map(canal => (
                            <button
                              key={canal}
                              type="button"
                              onClick={() => setActiveCopyTab(canal)}
                              className={`px-3 py-1 text-xs font-bold rounded-t-md border-b-2 transition-all ${
                                currentTab === canal
                                  ? 'text-[#024fff] border-[#024fff] bg-[#024fff]/5'
                                  : 'text-[#000033]/40 border-transparent hover:text-[#000033]/70'
                              }`}
                            >
                              {canal}
                            </button>
                          ))}
                        </div>
                      )}
                      <RichNotesEditor
                        value={activeContent}
                        onChange={handleCopyChange}
                        onBlur={handleCopySave}
                        placeholder={`Escribí o formateá el copy para ${currentTab} (negrita, cursiva, listas, links)...`}
                        minHeight="220px"
                      />
                    </>
                  );
                })()}
              </div>
            )}

            {/* Notas de diseño */}
            <div className="bg-white border-2 border-[#000033]/10 rounded-lg p-5">
              <h2 className="text-xs font-bold text-[#000033] uppercase flex items-center gap-2 mb-3">
                <ImageIcon className="w-3.5 h-3.5 text-[#024fff]" />
                Notas de diseño
              </h2>
              <RichNotesEditor
                value={notasAudiovisual}
                onChange={setNotasAudiovisual}
                onBlur={() => {
                  const currentNotas = (ticket as any).notasGrafica ?? (ticket as any).notasAudiovisual ?? '';
                  if (notasAudiovisual !== currentNotas) {
                    updateMutation.mutate({ notasGrafica: notasAudiovisual || null, notasAudiovisual: notasAudiovisual || null });
                  }
                }}
                placeholder="Notas de diseño (podés pegar libremente textos con formato, imágenes o links desde Notion)..."
                minHeight="320px"
              />
            </div>

            {/* Entregable visual */}
            <div className="bg-white border-2 border-[#000033]/10 rounded-lg p-5">
              <h2 className="text-xs font-bold text-[#000033] uppercase flex items-center gap-2 mb-3">
                <ImageIcon className="w-3.5 h-3.5" />
                {esNoContenido ? 'Link del entregable' : 'Entregable visual'}
              </h2>
              {ticket.linkEntregable && !editandoEntregable ? (
                <div className="flex items-center gap-2 px-3 py-2 border border-[#00ff99]/30 rounded-lg group hover:border-[#00ff99]/50 transition-all">
                  <ImageIcon className="w-3.5 h-3.5 text-[#00ff99] flex-shrink-0" />
                  <a
                    href={ensureAbsoluteUrl(ticket.linkEntregable)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#000033] truncate flex-1 hover:underline"
                  >
                    {ticket.linkEntregable}
                  </a>
                  <ExternalLink className="w-3 h-3 text-[#000033]/40 flex-shrink-0" />
                  <button
                    onClick={() => { setNewEntregableInput(ticket.linkEntregable); setEditandoEntregable(true); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[#024fff] ml-1 flex-shrink-0"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => updateMutation.mutate({ linkEntregable: null })}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[#000033]/30 hover:text-red-400 flex-shrink-0"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    autoFocus={editandoEntregable}
                    type="url"
                    value={newEntregableInput}
                    onChange={e => setNewEntregableInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const url = ensureAbsoluteUrl(newEntregableInput.trim());
                        if (url) { updateMutation.mutate({ linkEntregable: url }); }
                        setNewEntregableInput('');
                        setEditandoEntregable(false);
                      }
                      if (e.key === 'Escape') {
                        setNewEntregableInput('');
                        setEditandoEntregable(false);
                      }
                    }}
                    placeholder="https://drive.google.com/..."
                    className="flex-1 px-3 py-1.5 border-2 border-dashed border-[#000033]/10 rounded-lg text-xs focus:outline-none focus:border-[#00ff99]/50 focus:border-solid text-[#000033] hover:border-[#00ff99]/30 transition-all placeholder-[#000033]/30"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const url = ensureAbsoluteUrl(newEntregableInput.trim());
                      if (url) { updateMutation.mutate({ linkEntregable: url }); }
                      setNewEntregableInput('');
                      setEditandoEntregable(false);
                    }}
                    className="px-2.5 py-1.5 bg-[#00ff99]/20 border-2 border-[#00ff99]/40 text-[#000033] rounded-lg hover:bg-[#00ff99]/30 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  {editandoEntregable && (
                    <button
                      type="button"
                      onClick={() => { setNewEntregableInput(''); setEditandoEntregable(false); }}
                      className="px-2.5 py-1.5 border-2 border-[#000033]/10 text-[#000033]/40 rounded-lg hover:bg-[#000033]/5 transition-all"
                    >
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Sidebar — 1/3 */}
          <div className="space-y-5">

            {/* Comentarios — Ubicado arriba en la columna derecha */}
            <div className="bg-white border-2 border-[#000033]/10 rounded-lg p-5">
              <h2 className="text-xs font-bold text-[#000033] uppercase flex items-center gap-2 mb-4">
                <MessageSquare className="w-3.5 h-3.5 text-[#024fff]" />
                Comentarios
                {(commentsData?.data?.length ?? 0) > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-[#024fff]/10 text-[#024fff] rounded-full text-[10px] font-bold">
                    {commentsData!.data.length}
                  </span>
                )}
              </h2>

              {/* Lista de comentarios */}
              <div className="space-y-3 mb-4 max-h-[380px] overflow-y-auto pr-1">
                {(commentsData?.data ?? []).length === 0 ? (
                  <p className="text-xs text-[#000033]/30 italic">Sin comentarios aún. Usá @nombre para mencionar a alguien.</p>
                ) : (
                  (commentsData!.data).map((c: any) => (
                    <div key={c.id} className="flex gap-2.5 group">
                      <div className="w-6 h-6 rounded-full bg-[#024fff]/10 border border-[#024fff]/20 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-[#024fff] mt-0.5">
                        {c.user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-bold text-[#000033]">{c.user.name}</span>
                          <span className="text-[10px] text-[#000033]/40">
                            {new Date(c.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-[#000033]/80 mt-0.5 leading-relaxed whitespace-pre-wrap break-words">
                          {c.content.split(/(@[\w\sáéíóúÁÉÍÓÚñÑ]+?)(?=[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]|$)/).map((part: string, i: number) =>
                            part.startsWith('@')
                              ? <span key={i} className="text-[#024fff] font-bold">{part}</span>
                              : part
                          )}
                        </p>
                      </div>
                      {c.user.id === (currentUser as any)?.id && (
                        <button
                          onClick={() => deleteCommentMutation.mutate(c.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-[#000033]/20 hover:text-red-400 flex-shrink-0 p-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Input nuevo comentario */}
              <div className="relative">
                {mentionQuery !== null && mentionSuggestions.length > 0 && (
                  <div className="absolute bottom-full mb-1 left-0 bg-white border-2 border-[#000033]/10 rounded-lg shadow-lg z-20 overflow-hidden w-48">
                    {mentionSuggestions.slice(0, 5).map((u: any) => (
                      <button
                        key={u.id}
                        onMouseDown={e => { e.preventDefault(); insertMention(u.name); }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-[#024fff]/5 flex items-center gap-2"
                      >
                        <span className="w-5 h-5 rounded-full bg-[#024fff]/10 flex items-center justify-center text-[9px] font-bold text-[#024fff]">
                          {u.name.charAt(0).toUpperCase()}
                        </span>
                        {u.name}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={commentInputRef}
                    value={commentText}
                    onChange={handleCommentInput}
                    onKeyDown={e => {
                      if (mentionQuery !== null && mentionSuggestions.length > 0 && (e.key === 'Enter' || e.key === 'Tab')) {
                        e.preventDefault();
                        insertMention(mentionSuggestions[0].name);
                        return;
                      }
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleCommentSubmit();
                      }
                      if (e.key === 'Escape') setMentionQuery(null);
                    }}
                    placeholder="Comentar... Usá @nombre para mencionar"
                    rows={2}
                    className="flex-1 px-3 py-2 border-2 border-[#000033]/10 rounded-lg text-xs text-[#000033] resize-none focus:outline-none focus:border-[#024fff]/40 focus:ring-2 focus:ring-[#024fff]/10 transition-all placeholder:text-[#000033]/30"
                  />
                  <button
                    onClick={handleCommentSubmit}
                    disabled={!commentText.trim() || createCommentMutation.isPending}
                    className="p-2 bg-[#024fff] text-white rounded-lg hover:bg-[#024fff]/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Responsables */}
            <div className="bg-white border-2 border-[#000033]/10 rounded-lg p-5">
              <h3 className="text-xs font-bold text-[#000033] uppercase flex items-center gap-2 mb-3">
                <User className="w-3.5 h-3.5 text-[#024fff]" />
                Responsables
              </h3>
              <ResponsablesSelect
                users={allUsers}
                selectedIds={Array.isArray((ticket as any).assigneeIds) ? (ticket as any).assigneeIds : (ticket.owner?.id ? [ticket.owner.id] : [])}
                onChange={(ids) => {
                  updateMutation.mutate({
                    assigneeIds: ids,
                    ownerId: ids[0] ?? ticket.ownerId,
                  });
                }}
                placeholder="Asignar responsables"
              />
            </div>

            {/* Historial */}
            <div className="bg-white border-2 border-[#000033]/10 rounded-lg p-5">
              <h3 className="text-xs font-bold text-[#000033] uppercase mb-3">Historial</h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="font-bold text-[#000033]/60">Creado</span>
                  <span className="text-[#000033]">{createdAt}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-[#000033]/60">Última edición</span>
                  <span className="text-[#000033]">{updatedAt}</span>
                </div>
                {ticket.dueDate && (
                  <div className="flex justify-between">
                    <span className="font-bold text-[#000033]/60">Fecha objetivo</span>
                    <span className="text-[#000033]">
                      {new Date(ticket.dueDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Acciones de pie: Archivar y Eliminar */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => {
                  if (window.confirm('¿Archivar esta tarjeta?\n\nEl ticket pasará a estado Listo y se archivará del kanban.')) {
                    updateMutation.mutate({ status: 'LISTO' });
                  }
                }}
                disabled={updateMutation.isPending || ticket.status === 'LISTO'}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white border-2 border-[#000033]/15 text-[#000033]/70 hover:bg-[#000033]/5 hover:border-[#000033]/30 hover:text-[#000033] rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>{ticket.status === 'LISTO' ? 'Archivado' : 'Archivar'}</span>
              </button>

              <button
                onClick={() => {
                  if (window.confirm('¿Eliminar esta tarjeta? Esta acción no se puede deshacer.')) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de transicion a diseno */}
      <TransitionToDesignModal
        isOpen={isDesignModalOpen}
        onClose={() => setIsDesignModalOpen(false)}
        ticket={ticket}
        onConfirm={async (data) => {
          await updateMutation.mutateAsync({
            status: 'DISENO',
            notasGrafica: data.notasGrafica || null,
            links: data.links,
          });
          setIsDesignModalOpen(false);
        }}
      />
    </div>
  );
}
