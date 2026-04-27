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
} from 'lucide-react';
import { api } from '../lib/api';

const STATUS_OPTIONS = [
  { value: 'BACKLOG',   label: 'Backlog' },
  { value: 'BRIEF',     label: 'Brief' },
  { value: 'CONTENIDO', label: 'Contenido' },
  { value: 'DISENO',    label: 'Diseño' },
  { value: 'REVISION',  label: 'Revisión' },
  { value: 'APROBADO',  label: 'Aprobado' },
];

function getStatusStyle(status: string) {
  switch (status) {
    case 'APROBADO':   return 'bg-[#00ff99]/30 border-[#00ff99]/60 text-[#000033]';
    case 'CONTENIDO':  return 'bg-[#00ff99]/20 border-[#00ff99]/40 text-[#000033]';
    case 'REVISION':   return 'bg-[#024fff]/10 border-[#024fff]/20 text-[#024fff]';
    case 'BRIEF':      return 'bg-[#024fff]/5 border-[#024fff]/10 text-[#024fff]';
    default:           return 'bg-[#000033]/5 border-[#000033]/20 text-[#000033]/60';
  }
}

export function TicketDetallePage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [tituloTemp, setTituloTemp] = useState('');

  const [newLinkInput, setNewLinkInput] = useState('');
  const [newEntregableInput, setNewEntregableInput] = useState('');
  const [editandoEntregable, setEditandoEntregable] = useState(false);
  const [notasAudiovisual, setNotasAudiovisual] = useState('');
  const [briefTemp, setBriefTemp] = useState('');
  const [copyCopied, setCopyCopied] = useState(false);
  const [activeCopyTab, setActiveCopyTab] = useState<string>('');
  const linkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ticket?.title) setTituloTemp(ticket.title);
    if (ticket?.objetivo !== undefined) setBriefTemp(ticket.objetivo ?? '');
    if ((ticket as any)?.notasAudiovisual !== undefined) {
      setNotasAudiovisual((ticket as any).notasAudiovisual ?? '');
    }
    if (ticket && !activeCopyTab) {
      const canales = (ticket as any).canales;
      setActiveCopyTab(canales?.length > 0 ? canales[0] : '');
    }
  }, [ticket?.title, (ticket as any)?.notasAudiovisual, ticket]);

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

  const statusLabel = STATUS_OPTIONS.find(s => s.value === ticket.status)?.label ?? ticket.status;
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

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/content/${ticket.id}`)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#024fff] text-white rounded-lg text-xs font-bold hover:bg-[#024fff]/90 transition-all shadow-lg shadow-[#024fff]/20"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Redactar
              </button>
            </div>
          </div>

          {/* Row 2: meta badges */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-2.5 py-1 bg-[#024fff]/10 border-2 border-[#024fff]/20 text-[#024fff] text-xs font-bold rounded-lg">
              {ticket.client?.name}
            </span>
            <span className={`px-2.5 py-1 border-2 text-xs font-bold rounded-lg capitalize ${getStatusStyle(ticket.status)}`}>
              {statusLabel}
            </span>
            {ticket.canales?.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-[#000033]/60">
                <Hash className="w-3.5 h-3.5" />
                <span>{ticket.canales.join(', ')}</span>
              </div>
            )}
            <div className="h-3.5 w-px bg-[#000033]/20" />
            <div className="flex items-center gap-1 text-xs text-[#000033]/60">
              <User className="w-3.5 h-3.5" />
              <span>{ticket.owner?.name}</span>
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
                Brief
              </h2>
              <textarea
                value={briefTemp}
                onChange={e => setBriefTemp(e.target.value)}
                onBlur={() => {
                  if (briefTemp !== (ticket.objetivo ?? '')) {
                    updateMutation.mutate({ objetivo: briefTemp || null });
                  }
                }}
                placeholder="Escribí el brief acá..."
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
                      href={link}
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
              </div>
              {/* Add link input */}
              <div className="flex gap-2">
                <input
                  ref={linkInputRef}
                  type="url"
                  value={newLinkInput}
                  onChange={e => setNewLinkInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const url = newLinkInput.trim();
                      if (url) {
                        const current = ticket.links ?? [];
                        if (!current.includes(url)) {
                          updateMutation.mutate({ links: [...current, url] });
                        }
                        setNewLinkInput('');
                      }
                    }
                  }}
                  placeholder="Pegar link y Enter..."
                  className="flex-1 px-3 py-1.5 border-2 border-dashed border-[#000033]/10 rounded-lg text-xs focus:outline-none focus:border-[#024fff]/40 focus:border-solid text-[#000033] hover:border-[#024fff]/30 transition-all placeholder-[#000033]/30"
                />
                <button
                  type="button"
                  onClick={() => {
                    const url = newLinkInput.trim();
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
              </div>
            </div>

            {/* Copy final */}
            <div className="bg-white border-2 border-[#00ff99]/20 rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-[#000033] uppercase flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-[#00ff99]" />
                  Copy
                </h2>
                {(() => {
                  const perCanal = (ticket as any).contentPerCanal as Record<string, string> | null;
                  const activeContent = activeCopyTab && perCanal?.[activeCopyTab];
                  return activeContent ? (
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(activeContent);
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
                const perCanal = (ticket as any).contentPerCanal as Record<string, string> | null;
                const activeContent = activeCopyTab && perCanal?.[activeCopyTab] ? perCanal[activeCopyTab] : (ticket.content ?? '');
                const hasAnyContent = canales.some(c => perCanal?.[c] || ticket.content);
                return (
                  <>
                    {canales.length > 1 && (
                      <div className="flex items-center gap-1 mb-2">
                        {canales.map(canal => (
                          <button
                            key={canal}
                            onClick={() => setActiveCopyTab(canal)}
                            className={`px-3 py-1 text-xs font-bold rounded-t-md border-b-2 transition-all ${
                              activeCopyTab === canal
                                ? 'text-[#024fff] border-[#024fff] bg-[#024fff]/5'
                                : 'text-[#000033]/40 border-transparent hover:text-[#000033]/70'
                            }`}
                          >
                            {canal}
                          </button>
                        ))}
                      </div>
                    )}
                    {hasAnyContent ? (
                      <pre className="text-xs text-[#000033]/80 whitespace-pre-wrap font-mono bg-[#fafafa] border border-[#000033]/10 rounded-lg px-3 py-2 max-h-48 overflow-y-auto">
                        {activeContent || <span className="italic text-[#000033]/30">Sin contenido para este canal aún.</span>}
                      </pre>
                    ) : (
                      <p className="text-xs text-[#000033]/40 italic">
                        Aún no hay copy redactado.{' '}
                        <button onClick={() => navigate(`/content/${ticket.id}`)} className="text-[#024fff] underline hover:no-underline">
                          Ir al workspace
                        </button>
                      </p>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Notas para audiovisual */}
            <div className="bg-white border-2 border-[#000033]/10 rounded-lg p-5">
              <h2 className="text-xs font-bold text-[#000033] uppercase flex items-center gap-2 mb-3">
                <ImageIcon className="w-3.5 h-3.5 text-[#024fff]" />
                Notas para audiovisual
              </h2>
              <textarea
                value={notasAudiovisual}
                onChange={e => setNotasAudiovisual(e.target.value)}
                onBlur={() => updateMutation.mutate({ notasAudiovisual: notasAudiovisual || null })}
                placeholder={`Instrucciones para el equipo de diseño/video:\n• Qué mostrar visualmente\n• Formato requerido (carrusel, reel, video, etc.)\n• Referencias visuales`}
                className="w-full px-3 py-2 border-2 border-dashed border-[#000033]/10 rounded-lg text-xs focus:outline-none focus:border-[#024fff]/40 focus:border-solid text-[#000033] hover:border-[#024fff]/30 transition-all resize-none placeholder-[#000033]/30"
                rows={4}
              />
            </div>

            {/* Entregable visual */}
            <div className="bg-white border-2 border-[#000033]/10 rounded-lg p-5">
              <h2 className="text-xs font-bold text-[#000033] uppercase flex items-center gap-2 mb-3">
                <ImageIcon className="w-3.5 h-3.5" />
                Entregable visual
              </h2>
              {ticket.linkEntregable && !editandoEntregable ? (
                <div className="flex items-center gap-2 px-3 py-2 border border-[#00ff99]/30 rounded-lg group hover:border-[#00ff99]/50 transition-all">
                  <ImageIcon className="w-3.5 h-3.5 text-[#00ff99] flex-shrink-0" />
                  <a
                    href={ticket.linkEntregable}
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
                        const url = newEntregableInput.trim();
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
                      const url = newEntregableInput.trim();
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

            {/* CTA principal */}
            <div className="bg-white border-2 border-[#000033]/10 rounded-lg p-5">
              <h3 className="text-xs font-bold text-[#000033] uppercase mb-3">Acciones</h3>
              <button
                onClick={() => navigate(`/content/${ticket.id}`)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#024fff] text-white rounded-lg text-xs font-bold hover:bg-[#024fff]/90 transition-all shadow-lg shadow-[#024fff]/20"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Redactar contenido
              </button>
            </div>

            {/* Detalles editables */}
            <div className="bg-white border-2 border-[#000033]/10 rounded-lg p-5">
              <h3 className="text-xs font-bold text-[#000033] uppercase mb-3">Detalles</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-[#000033]/60 uppercase block mb-1">
                    Estado
                  </label>
                  <select
                    value={ticket.status}
                    onChange={e => updateMutation.mutate({ status: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-[#000033]/10 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033] bg-white hover:border-[#024fff]/30 transition-all"
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#000033]/60 uppercase block mb-1">
                    Owner
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2 border-2 border-[#000033]/10 rounded-lg bg-[#fafafa]">
                    <div className="w-5 h-5 rounded-full bg-[#024fff]/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-[#024fff] leading-none">
                        {ticket.owner?.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-[#000033]/60">{ticket.owner?.name}</span>
                  </div>
                </div>

                {ticket.canales?.length > 0 && (
                  <div>
                    <label className="text-xs font-bold text-[#000033]/60 uppercase block mb-1">
                      Canal
                    </label>
                    <div className="px-3 py-2 border-2 border-[#000033]/10 rounded-lg bg-[#fafafa] text-xs text-[#000033]/60">
                      {ticket.canales.join(', ')}
                    </div>
                  </div>
                )}


                {ticket.ticketType && (
                  <div>
                    <label className="text-xs font-bold text-[#000033]/60 uppercase block mb-1">
                      Tipo
                    </label>
                    <div className="px-3 py-2 border-2 border-[#000033]/10 rounded-lg bg-[#fafafa] text-xs text-[#000033]/60">
                      {ticket.ticketType.name}
                    </div>
                  </div>
                )}

                {ticket.prioridad && (
                  <div>
                    <label className="text-xs font-bold text-[#000033]/60 uppercase block mb-1">
                      Prioridad
                    </label>
                    <div className="px-3 py-2 border-2 border-[#000033]/10 rounded-lg bg-[#fafafa] text-xs text-[#000033]/60 capitalize">
                      {ticket.prioridad.charAt(0) + ticket.prioridad.slice(1).toLowerCase()}
                    </div>
                  </div>
                )}
              </div>
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
          </div>
        </div>
      </div>
    </div>
  );
}
