import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { X, Target, FileText, User, Building2, Package, Calendar, Info, Save, PenLine, Link2, Plus, ExternalLink, Copy, Check, Image as ImageIcon, Layers } from 'lucide-react';
import { api } from '../lib/api';

interface TicketData {
  id: string;
  title: string;
  objetivo?: string | null;
  canal?: string | null;
  prioridad: string;
  status: string;
  dueDate?: string | null;
  links?: string[];
  linkEntregable?: string | null;
  copyFinal?: string | null;
  notasAudiovisual?: string | null;
  client: { id: string; name: string };
  owner: { id: string; name: string };
  area?: { id: string; name: string } | null;
  ticketType?: { id: string; name: string } | null;
}

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket?: TicketData | null;
}

const REDES = ['LinkedIn', 'Instagram', 'Twitter', 'Facebook', 'YouTube'];

const PRIORIDADES = [
  { value: 'ALTA', label: 'Alta', style: 'bg-[#024fff]/10 text-[#024fff] border-[#024fff]/30' },
  { value: 'MEDIA', label: 'Med', style: 'bg-[#00ff99]/20 text-[#000033] border-[#00ff99]/40' },
  { value: 'BAJA', label: 'Baja', style: 'bg-[#000033]/5 text-[#000033]/60 border-[#000033]/20' },
];

function buildFormData(ticket?: TicketData | null) {
  if (!ticket) {
    return {
      title: '',
      brief: '',
      canales: ['LinkedIn'] as string[],
      clientId: '',
      ownerId: '',
      ticketTypeId: '',
      pilarId: '',
      speakerId: '',
      prioridad: 'MEDIA',
      status: 'BACKLOG',
      dueDate: '',
      links: [] as string[],
      linkEntregable: '',
      content: '',
      contentPerCanal: {} as Record<string, string>,
      notasAudiovisual: '',
    };
  }
  return {
    title: ticket.title,
    brief: ticket.objetivo ?? '',
    canales: (ticket as any).canales?.length > 0 ? (ticket as any).canales : ['LinkedIn'],
    clientId: ticket.client.id,
    ownerId: ticket.owner.id,
    ticketTypeId: ticket.ticketType?.id ?? '',
    pilarId: (ticket as any).pilar?.id ?? '',
    speakerId: (ticket as any).speaker?.id ?? '',
    prioridad: ticket.prioridad,
    status: ticket.status,
    dueDate: ticket.dueDate ? ticket.dueDate.slice(0, 10) : '',
    links: ticket.links ?? [],
    linkEntregable: ticket.linkEntregable ?? '',
    content: (ticket as any).content ?? '',
    contentPerCanal: (ticket as any).contentPerCanal && typeof (ticket as any).contentPerCanal === 'object' ? (ticket as any).contentPerCanal : {},
    notasAudiovisual: (ticket as any).notasAudiovisual ?? '',
  };
}

export function CreateTicketModal({ isOpen, onClose, ticket }: CreateTicketModalProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isEditing = !!ticket;
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState(() => buildFormData(ticket));
  const [newLinkInput, setNewLinkInput] = useState('');
  const [copyCopied, setCopyCopied] = useState(false);
  const [activeCopyTab, setActiveCopyTab] = useState(() => formData.canales[0] ?? 'LinkedIn');

  // Re-populate when ticket changes (e.g. opening different card)
  useEffect(() => {
    setFormData(buildFormData(ticket));
    setError(null);
  }, [ticket]);

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.getClients(),
    enabled: isOpen,
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.getUsers(),
    enabled: isOpen,
  });

  const { data: ticketTypes } = useQuery({
    queryKey: ['ticketTypes'],
    queryFn: () => api.getTicketTypes(),
    enabled: isOpen,
  });

  const { data: pilaresData } = useQuery({
    queryKey: ['pilares', formData.clientId],
    queryFn: () => api.getPilares(formData.clientId),
    enabled: isOpen && !!formData.clientId,
  });
  const pilares = pilaresData?.data ?? [];

  const { data: speakersData } = useQuery({
    queryKey: ['speakers', formData.clientId],
    queryFn: () => api.getSpeakers(formData.clientId),
    enabled: isOpen && !!formData.clientId,
  });
  const speakers = speakersData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createTicket(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      handleClose();
    },
    onError: (err: any) => {
      setError(err.message || 'Error al crear la pieza');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.updateTicket(ticket!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      handleClose();
    },
    onError: (err: any) => {
      setError(err.message || 'Error al guardar los cambios');
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      ...(field === 'clientId' ? { pilarId: '', speakerId: '' } : {}),
    }));
    setError(null);
  };

  const toggleRed = (red: string) => {
    setFormData(prev => {
      const newCanales = prev.canales.includes(red)
        ? prev.canales.filter(r => r !== red)
        : [...prev.canales, red];

      if (isEditing && ticket) {
        api.updateTicket(ticket.id, { canales: newCanales })
          .then(() => queryClient.invalidateQueries({ queryKey: ['tickets'] }))
          .catch(() => {});
      }

      return { ...prev, canales: newCanales };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title || !formData.clientId || !formData.ownerId) {
      setError('Completá los campos requeridos: título, cliente y owner');
      return;
    }

    const payload: any = {
      title: formData.title,
      ownerId: formData.ownerId,
      status: formData.status,
      prioridad: formData.prioridad,
      objetivo: formData.brief || null,
      canales: formData.canales,
      dueDate: formData.dueDate || null,
      ticketTypeId: formData.ticketTypeId || null,
      pilarId: formData.pilarId || null,
      speakerId: formData.speakerId || null,
    };

    if (isEditing) {
      updateMutation.mutate({
        ...payload,
        links: formData.links,
        linkEntregable: formData.linkEntregable || null,
        content: formData.content || null,
        contentPerCanal: formData.contentPerCanal,
        notasAudiovisual: formData.notasAudiovisual || null,
      });
    } else {
      createMutation.mutate({ ...payload, clientId: formData.clientId });
    }
  };

  const handleClose = () => {
    setFormData(buildFormData(null));
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#000033] px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#024fff] rounded-lg flex items-center justify-center">
              <Target className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                {isEditing ? 'Editar pieza' : 'Nueva pieza'}
              </h2>
              <p className="text-xs text-white/60">Brief rápido para iniciar</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form id="ticket-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="px-3 py-2 bg-red-50 border-2 border-red-200 rounded-lg text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Nombre */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-[#000033] mb-1.5">
              Nombre de la pieza <span className="text-[#024fff]">*</span>
              <Info className="w-3 h-3 text-[#000033]/40" />
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={e => handleChange('title', e.target.value)}
              placeholder="ej: Post liderazgo – semana 1"
              className="w-full px-3 py-2 border-2 border-[#000033]/10 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033] hover:border-[#024fff]/40 transition-all font-medium"
              autoFocus
            />
          </div>

          {/* Brief */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-[#000033] mb-1.5">
              <FileText className="w-3 h-3 text-[#024fff]" />
              Brief
              <Info className="w-3 h-3 text-[#000033]/40" />
            </label>
            <textarea
              value={formData.brief}
              onChange={e => handleChange('brief', e.target.value)}
              placeholder={`Describe en pocas líneas qué querés comunicar y por qué.\nEj: Posicionar al CEO como líder de opinión en temas de escalabilidad tech.`}
              className="w-full px-3 py-2 border-2 border-[#000033]/10 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033] hover:border-[#024fff]/40 transition-all resize-none"
              rows={3}
            />
          </div>

          {/* Cliente + Owner */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-[#000033] mb-1.5">
                <Building2 className="w-3 h-3 text-[#024fff]" />
                Cliente <span className="text-[#024fff]">*</span>
              </label>
              <select
                value={formData.clientId}
                onChange={e => handleChange('clientId', e.target.value)}
                disabled={isEditing}
                className="w-full px-3 py-2 border-2 border-[#000033]/10 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033] hover:border-[#024fff]/40 transition-all bg-white font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">Seleccionar cliente</option>
                {clients?.data.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-[#000033] mb-1.5">
                <User className="w-3 h-3 text-[#024fff]" />
                Owner <span className="text-[#024fff]">*</span>
              </label>
              <select
                value={formData.ownerId}
                onChange={e => handleChange('ownerId', e.target.value)}
                className="w-full px-3 py-2 border-2 border-[#000033]/10 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033] hover:border-[#024fff]/40 transition-all bg-white font-medium"
              >
                <option value="">Seleccionar owner</option>
                {users?.data.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Vocero — solo si el cliente tiene voceros */}
          {formData.clientId && speakers.length > 0 && (
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-[#000033] mb-1.5">
                <User className="w-3 h-3 text-[#024fff]" />
                Vocero
                <span className="text-[#000033]/40 font-normal">(opcional — define voz del contenido)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {speakers.map((s: any) => {
                  const selected = formData.speakerId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleChange('speakerId', selected ? '' : s.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border-2 transition-all ${
                        selected
                          ? 'bg-[#024fff]/10 text-[#024fff] border-[#024fff]/30'
                          : 'bg-white text-[#000033]/60 border-[#000033]/10 hover:border-[#024fff]/40 hover:text-[#024fff]'
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full bg-[#024fff]/10 flex items-center justify-center text-[#024fff] font-bold text-[9px]">
                        {s.nombre.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                      </span>
                      {s.nombre}
                      {s.cargo && <span className="font-normal opacity-60">· {s.cargo}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pilar — solo si el cliente tiene pilares definidos */}
          {formData.clientId && pilares.length > 0 && (
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-[#000033] mb-1.5">
                <Layers className="w-3 h-3 text-[#024fff]" />
                Pilar de contenido
              </label>
              <div className="flex flex-wrap gap-1.5">
                {pilares.map((p: any) => {
                  const selected = formData.pilarId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleChange('pilarId', selected ? '' : p.id)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border-2 transition-all text-left ${
                        selected
                          ? 'bg-[#024fff]/10 text-[#024fff] border-[#024fff]/30'
                          : 'bg-white text-[#000033]/60 border-[#000033]/10 hover:border-[#024fff]/40 hover:text-[#024fff]'
                      }`}
                    >
                      {p.nombre}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tipo de contenido */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-[#000033] mb-1.5">
              <Package className="w-3 h-3 text-[#024fff]" />
              Tipo de contenido
            </label>
            <select
              value={formData.ticketTypeId}
              onChange={e => handleChange('ticketTypeId', e.target.value)}
              className="w-full px-3 py-2 border-2 border-[#000033]/10 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033] hover:border-[#024fff]/40 transition-all bg-white font-medium"
            >
              <option value="">Seleccionar tipo</option>
              {ticketTypes?.data.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Redes + Fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-[#000033] mb-1.5">
                Red(es) objetivo
              </label>
              <div className="flex flex-wrap gap-1.5">
                {REDES.map(red => {
                  const selected = formData.canales.includes(red);
                  return (
                    <button
                      key={red}
                      type="button"
                      onClick={() => toggleRed(red)}
                      className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border-2 transition-all ${
                        selected
                          ? 'bg-[#024fff]/10 text-[#024fff] border-[#024fff]/20'
                          : 'bg-white text-[#000033]/60 border-[#000033]/10 hover:border-[#024fff]/40 hover:text-[#024fff]'
                      }`}
                    >
                      {red}
                      {selected && <X className="w-3 h-3 inline ml-1" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-[#000033] mb-1.5">
                <Calendar className="w-3 h-3 text-[#024fff]" />
                Fecha objetivo
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={e => handleChange('dueDate', e.target.value)}
                className="w-full px-3 py-2 border-2 border-[#000033]/10 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033] hover:border-[#024fff]/40 transition-all"
              />
            </div>
          </div>

          {/* Prioridad */}
          <div>
            <label className="text-xs font-bold text-[#000033] mb-1.5 block">Prioridad</label>
            <div className="flex gap-2">
              {PRIORIDADES.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => handleChange('prioridad', p.value)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border-2 transition-all ${
                    formData.prioridad === p.value
                      ? p.style
                      : 'bg-white text-[#000033]/40 border-[#000033]/10 hover:border-[#000033]/30'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Links — solo en modo edición */}
          {isEditing && (
            <>
              {/* INFO / RECURSOS */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-[#000033] mb-2">
                  <Link2 className="w-4 h-4 text-[#024fff]" />
                  Info / Recursos
                  <span className="text-[#000033]/40 font-normal">Links a docs, briefs, referencias</span>
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="url"
                    value={newLinkInput}
                    onChange={e => setNewLinkInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const url = newLinkInput.trim();
                        if (url && !formData.links.includes(url)) {
                          setFormData(prev => ({ ...prev, links: [...prev.links, url] }));
                        }
                        setNewLinkInput('');
                      }
                    }}
                    onBlur={() => {
                      const url = newLinkInput.trim();
                      if (url && !formData.links.includes(url)) {
                        setFormData(prev => ({ ...prev, links: [...prev.links, url] }));
                      }
                      setNewLinkInput('');
                    }}
                    placeholder="https://..."
                    className="flex-1 px-3 py-2 border-2 border-[#000033]/10 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033] hover:border-[#024fff]/40 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const url = newLinkInput.trim();
                      if (url && !formData.links.includes(url)) {
                        setFormData(prev => ({ ...prev, links: [...prev.links, url] }));
                      }
                      setNewLinkInput('');
                    }}
                    className="px-3 py-2 bg-[#024fff]/10 border-2 border-[#024fff]/20 text-[#024fff] rounded-lg hover:bg-[#024fff]/20 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {formData.links.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {formData.links.map((link, i) => (
                      <div key={i} className="flex items-center gap-1 px-2.5 py-1 bg-[#024fff]/5 border border-[#024fff]/20 rounded-lg text-xs text-[#024fff]">
                        <a href={link} target="_blank" rel="noopener noreferrer" className="max-w-[200px] truncate hover:underline">
                          {link.split('/').pop() || link}
                        </a>
                        <ExternalLink className="w-2.5 h-2.5 opacity-50 flex-shrink-0" />
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, links: prev.links.filter((_, j) => j !== i) }))}
                          className="ml-0.5 hover:text-red-500 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* COPY */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-[#000033]">
                    <FileText className="w-3.5 h-3.5 text-[#00ff99]" />
                    Copy
                    <span className="text-[#000033]/40 font-normal">Texto listo para publicar</span>
                  </label>
                  {(formData.contentPerCanal[activeCopyTab] ?? formData.content).trim() && (
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(formData.contentPerCanal[activeCopyTab] ?? formData.content);
                        setCopyCopied(true);
                        setTimeout(() => setCopyCopied(false), 2000);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 bg-[#00ff99]/20 border-2 border-[#00ff99]/40 text-[#000033] rounded-lg hover:bg-[#00ff99]/30 transition-all text-xs font-bold"
                    >
                      {copyCopied ? <><Check className="w-3 h-3" />Copiado</> : <><Copy className="w-3 h-3" />Copiar</>}
                    </button>
                  )}
                </div>
                {formData.canales.length > 1 && (
                  <div className="flex items-center gap-1 mb-2">
                    {formData.canales.map(canal => (
                      <button
                        key={canal}
                        type="button"
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
                <textarea
                  value={formData.contentPerCanal[activeCopyTab] ?? (activeCopyTab === formData.canales[0] ? formData.content : '')}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    contentPerCanal: { ...prev.contentPerCanal, [activeCopyTab]: e.target.value },
                    content: activeCopyTab === prev.canales[0] ? e.target.value : prev.content,
                  }))}
                  placeholder={`Copy para ${activeCopyTab}...`}
                  className="w-full px-3 py-2 border-2 border-[#000033]/10 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033] hover:border-[#024fff]/40 transition-all resize-none font-mono"
                  rows={6}
                />
              </div>

              {/* ENTREGABLE VISUAL */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-[#000033] mb-2">
                  <ImageIcon className="w-4 h-4 text-[#00ff99]" />
                  Entregable visual
                  <span className="text-[#000033]/40 font-normal">Link a Drive con el contenido gráfico</span>
                </label>
                <input
                  type="url"
                  value={formData.linkEntregable}
                  onChange={e => setFormData(prev => ({ ...prev, linkEntregable: e.target.value }))}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-3 py-2 border-2 border-[#000033]/10 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#00ff99]/50 text-[#000033] hover:border-[#00ff99]/40 transition-all"
                />
              </div>
            </>
          )}
        </form>

        {/* Footer */}
        <div className="bg-[#fafafa] border-t-2 border-[#000033]/10 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-3 py-1.5 text-xs font-bold text-[#000033]/60 hover:text-[#000033] transition-all"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            {isEditing && (
              <>
                <button
                  type="button"
                  onClick={() => { handleClose(); navigate(`/piezas/${ticket!.id}`); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-[#000033]/10 text-[#000033]/60 rounded-lg hover:bg-[#000033]/5 hover:text-[#000033] transition-all font-bold text-xs"
                >
                  Ver completo
                  <ExternalLink className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => { handleClose(); navigate(`/content/${ticket!.id}`); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#024fff]/10 border-2 border-[#024fff]/20 text-[#024fff] rounded-lg hover:bg-[#024fff]/20 transition-all font-bold text-xs"
                >
                  <PenLine className="w-3.5 h-3.5" />
                  Redactar
                </button>
              </>
            )}
            <button
              type="submit"
              form="ticket-form"
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00ff99]/30 border-2 border-[#00ff99]/50 text-[#000033] rounded-lg hover:bg-[#00ff99]/40 transition-all font-bold text-xs shadow-lg shadow-[#00ff99]/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? 'Guardando...' : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Guardar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
