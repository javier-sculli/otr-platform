import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  X, FileText, CheckSquare, Package, Building2, AlignLeft, Calendar, User,
  Flag, Share2, Link2, Plus, ExternalLink, Sparkles, Check, Copy,
  Image as ImageIcon, Paperclip, File, Layers,
} from 'lucide-react';
import { api } from '../lib/api';

type AttachedFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string | null;
  contentType: 'text' | 'image' | 'other';
};

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
  ticketType?: { id: string; name: string; kind?: string } | null;
}

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket?: TicketData | null;
}

const REDES = ['LinkedIn', 'Instagram', 'Twitter'];

const PRIORIDADES = [
  { value: 'ALTA',  label: 'Alta',  on: 'bg-[#024fff]/10 text-[#024fff] border-[#024fff]/40' },
  { value: 'MEDIA', label: 'Media', on: 'bg-[#00ff99]/20 text-[#000033] border-[#00ff99]/50' },
  { value: 'BAJA',  label: 'Baja',  on: 'bg-[#000033]/5 text-[#000033]/60 border-[#000033]/25' },
];

// Estilos compartidos — diseño minimalista del Figma
const labelCls = 'flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#000033]/40 mb-1.5';
const fieldCls = 'w-full px-3 py-2 border border-[#000033]/12 rounded-lg text-sm text-[#000033] bg-white focus:outline-none focus:ring-2 focus:ring-[#024fff]/25 focus:border-[#024fff]/40 hover:border-[#000033]/20 transition-all placeholder:text-[#000033]/35';

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
      status: 'PENDIENTE',
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
  const [tipoTicket, setTipoTicket] = useState<'CONTENIDO' | 'TAREA'>(
    ticket?.ticketType?.kind === 'TAREA' ? 'TAREA' : 'CONTENIDO'
  );
  const esTarea = tipoTicket === 'TAREA';
  const [newLinkInput, setNewLinkInput] = useState('');
  const [copyCopied, setCopyCopied] = useState(false);
  const [activeCopyTab, setActiveCopyTab] = useState(() => formData.canales[0] ?? 'LinkedIn');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-populate when ticket changes (e.g. opening different card)
  useEffect(() => {
    setFormData(buildFormData(ticket));
    setTipoTicket(ticket?.ticketType?.kind === 'TAREA' ? 'TAREA' : 'CONTENIDO');
    setError(null);
    if (ticket?.id) {
      const saved = sessionStorage.getItem(`ticket-files-${ticket.id}`);
      setAttachedFiles(saved ? JSON.parse(saved) : []);
    } else {
      setAttachedFiles([]);
    }
  }, [ticket?.id]);

  useEffect(() => {
    if (ticket?.id) {
      sessionStorage.setItem(`ticket-files-${ticket.id}`, JSON.stringify(attachedFiles));
    }
  }, [attachedFiles, ticket?.id]);

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
    enabled: isOpen && !!formData.clientId && !esTarea,
  });
  const pilares = pilaresData?.data ?? [];

  const { data: speakersData } = useQuery({
    queryKey: ['speakers', formData.clientId],
    queryFn: () => api.getSpeakers(formData.clientId),
    enabled: isOpen && !!formData.clientId && !esTarea,
  });
  const speakers = speakersData?.data ?? [];

  // Tipos disponibles según Pieza vs Tarea
  const tiposFiltrados = (ticketTypes?.data ?? []).filter((t: any) =>
    esTarea ? t.kind === 'TAREA' : t.kind !== 'TAREA'
  );

  const handleTipoTicketChange = (next: 'CONTENIDO' | 'TAREA') => {
    if (isEditing) return; // no se cambia la naturaleza al editar
    setTipoTicket(next);
    setFormData(prev => ({ ...prev, ticketTypeId: '' }));
    setError(null);
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createTicket(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      handleClose();
    },
    onError: (err: any) => {
      setError(err.message || 'Error al crear');
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

  const addLink = () => {
    const url = newLinkInput.trim();
    if (url && !formData.links.includes(url)) {
      setFormData(prev => ({ ...prev, links: [...prev.links, url] }));
    }
    setNewLinkInput('');
  };

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

  const handleRemoveFile = (id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  const toggleRed = (red: string) => {
    setFormData(prev => {
      const newCanales = prev.canales.includes(red)
        ? prev.canales.filter((r: string) => r !== red)
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
      setError('Completá los campos requeridos: nombre, cliente y responsable');
      return;
    }

    const payload: any = {
      title: formData.title,
      ownerId: formData.ownerId,
      status: formData.status,
      prioridad: formData.prioridad,
      objetivo: formData.brief || null,
      canales: esTarea ? [] : formData.canales,
      dueDate: formData.dueDate || null,
      ticketTypeId: formData.ticketTypeId || null,
      pilarId: esTarea ? null : (formData.pilarId || null),
      speakerId: esTarea ? null : (formData.speakerId || null),
    };

    if (isEditing) {
      updateMutation.mutate({
        ...payload,
        links: formData.links,
        linkEntregable: formData.linkEntregable || null,
        content: esTarea ? undefined : (formData.content || null),
        contentPerCanal: esTarea ? undefined : formData.contentPerCanal,
        notasAudiovisual: esTarea ? undefined : (formData.notasAudiovisual || null),
      });
    } else {
      createMutation.mutate({
        ...payload,
        clientId: formData.clientId,
        // Pieza puede llevar recursos (links a Drive) ya en la creación
        ...(!esTarea && formData.links.length > 0 ? { links: formData.links } : {}),
      });
    }
  };

  const handleClose = () => {
    setFormData(buildFormData(null));
    setError(null);
    if (!isEditing) setAttachedFiles([]);
    onClose();
  };

  if (!isOpen) return null;

  const showRecursos = !esTarea || isEditing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#000033]">{isEditing ? 'Editar' : 'Nuevo'}</h2>
            <button
              onClick={handleClose}
              className="w-7 h-7 rounded-lg hover:bg-[#000033]/5 flex items-center justify-center transition-all text-[#000033]/40 hover:text-[#000033]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Toggle Pieza / Tarea */}
          <div className="flex items-center gap-2 mt-3">
            {([
              { value: 'CONTENIDO', label: 'Pieza', Icon: FileText, active: 'border-[#024fff] text-[#024fff]' },
              { value: 'TAREA', label: 'Tarea', Icon: CheckSquare, active: 'border-[#00b87f] text-[#00b87f]' },
            ] as const).map(({ value, label, Icon, active }) => {
              const isActive = tipoTicket === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleTipoTicketChange(value)}
                  disabled={isEditing}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border bg-white transition-all disabled:cursor-not-allowed ${
                    isActive ? active : 'border-[#000033]/10 text-[#000033]/40 hover:text-[#000033]/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-[#000033]/10 flex-shrink-0" />

        {/* Form */}
        <form id="ticket-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="px-3 py-2 bg-red-50 border-2 border-red-200 rounded-lg text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Nombre */}
          <div>
            <input
              type="text"
              value={formData.title}
              onChange={e => handleChange('title', e.target.value)}
              placeholder={esTarea ? 'Nombre del pedido' : 'Nombre de la pieza'}
              className={fieldCls}
              autoFocus
            />
          </div>

          {/* Tipo + Cliente */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                <Package className="w-3 h-3" />
                {esTarea ? 'Tipo de entregable' : 'Tipo de contenido'}
              </label>
              <select
                value={formData.ticketTypeId}
                onChange={e => handleChange('ticketTypeId', e.target.value)}
                className={fieldCls}
              >
                <option value="">Seleccionar</option>
                {tiposFiltrados.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>
                <Building2 className="w-3 h-3" />
                Cliente
              </label>
              <select
                value={formData.clientId}
                onChange={e => handleChange('clientId', e.target.value)}
                disabled={isEditing}
                className={`${fieldCls} disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <option value="">Seleccionar</option>
                {clients?.data.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Descripción / Brief */}
          <div>
            <label className={labelCls}>
              <AlignLeft className="w-3 h-3" />
              {esTarea ? 'Descripción' : 'Brief'}
            </label>
            <textarea
              value={formData.brief}
              onChange={e => handleChange('brief', e.target.value)}
              placeholder={esTarea ? 'Descripción — detalle del pedido' : 'Brief — qué querés comunicar y por qué'}
              className={`${fieldCls} resize-none`}
              rows={3}
            />
          </div>

          {/* Fecha + Responsable/Owner */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                <Calendar className="w-3 h-3" />
                {esTarea ? 'Fecha de entrega' : 'Fecha objetivo'}
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={e => handleChange('dueDate', e.target.value)}
                className={fieldCls}
              />
            </div>

            <div>
              <label className={labelCls}>
                <User className="w-3 h-3" />
                {esTarea ? 'Responsable' : 'Owner'}
              </label>
              <select
                value={formData.ownerId}
                onChange={e => handleChange('ownerId', e.target.value)}
                className={fieldCls}
              >
                <option value="">Asignar</option>
                {users?.data.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Vocero — solo Pieza, si el cliente tiene voceros */}
          {!esTarea && formData.clientId && speakers.length > 0 && (
            <div>
              <label className={labelCls}>
                <User className="w-3 h-3" />
                Vocero
                <span className="lowercase font-medium text-[#000033]/30 tracking-normal">opcional · define la voz</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {speakers.map((s: any) => {
                  const selected = formData.speakerId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleChange('speakerId', selected ? '' : s.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        selected
                          ? 'bg-[#024fff]/10 text-[#024fff] border-[#024fff]/30'
                          : 'bg-white text-[#000033]/50 border-[#000033]/10 hover:border-[#024fff]/30 hover:text-[#024fff]'
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

          {/* Pilar — solo Pieza, si el cliente tiene pilares */}
          {!esTarea && formData.clientId && pilares.length > 0 && (
            <div>
              <label className={labelCls}>
                <Layers className="w-3 h-3" />
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
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all text-left ${
                        selected
                          ? 'bg-[#024fff]/10 text-[#024fff] border-[#024fff]/30'
                          : 'bg-white text-[#000033]/50 border-[#000033]/10 hover:border-[#024fff]/30 hover:text-[#024fff]'
                      }`}
                    >
                      {p.nombre}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Red(es) objetivo — solo Pieza */}
          {!esTarea && (
            <div>
              <label className={labelCls}>
                <Share2 className="w-3 h-3" />
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
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        selected
                          ? 'bg-[#024fff]/10 text-[#024fff] border-[#024fff]/30'
                          : 'bg-white text-[#000033]/50 border-[#000033]/10 hover:border-[#024fff]/30 hover:text-[#024fff]'
                      }`}
                    >
                      {red}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recursos — link(s) a Drive */}
          {showRecursos && (
            <div>
              <label className={labelCls}>
                <Link2 className="w-3 h-3" />
                Recursos
                <span className="lowercase font-medium text-[#000033]/30 tracking-normal">opcional</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={newLinkInput}
                  onChange={e => setNewLinkInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
                  onBlur={addLink}
                  placeholder="https://drive.google.com/..."
                  className={`${fieldCls} flex-1`}
                />
                <button
                  type="button"
                  onClick={addLink}
                  className="px-3 py-2 bg-[#000033]/5 border border-[#000033]/10 text-[#000033]/50 rounded-lg hover:bg-[#000033]/10 hover:text-[#000033] transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
                {isEditing && (
                  <>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Adjuntar archivo"
                      className="px-3 py-2 bg-[#000033]/5 border border-[#000033]/10 text-[#000033]/50 rounded-lg hover:bg-[#000033]/10 hover:text-[#000033] transition-all"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
                  </>
                )}
              </div>
              {(formData.links.length > 0 || attachedFiles.length > 0) && (
                <div className="space-y-1.5 mt-2">
                  {formData.links.map((link, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 border border-[#024fff]/20 rounded-lg group hover:border-[#024fff]/40 transition-all">
                      <Link2 className="w-3.5 h-3.5 text-[#024fff] flex-shrink-0" />
                      <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-[#024fff] truncate flex-1 hover:underline">{link}</a>
                      <ExternalLink className="w-2.5 h-2.5 text-[#024fff]/40 flex-shrink-0" />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, links: prev.links.filter((_, j) => j !== i) }))}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[#000033]/30 hover:text-red-400 flex-shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {attachedFiles.map(file => (
                    <div key={file.id} className="flex items-center gap-2 px-3 py-1.5 border border-[#000033]/15 rounded-lg group hover:border-[#000033]/30 transition-all">
                      {file.contentType === 'image' ? <ImageIcon className="w-3.5 h-3.5 text-[#000033]/50 flex-shrink-0" /> : <File className="w-3.5 h-3.5 text-[#000033]/50 flex-shrink-0" />}
                      <span className="text-xs text-[#000033]/70 truncate flex-1">{file.name}</span>
                      <span className="text-xs text-[#000033]/30 flex-shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(file.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[#000033]/30 hover:text-red-400 flex-shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* COPY — solo Pieza en edición */}
          {isEditing && !esTarea && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`${labelCls} mb-0`}>
                  <FileText className="w-3 h-3" />
                  Copy
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
                  {formData.canales.map((canal: string) => (
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
                className={`${fieldCls} resize-none font-mono`}
                rows={6}
              />
            </div>
          )}

          {/* ENTREGABLE VISUAL — solo Pieza en edición */}
          {isEditing && !esTarea && (
            <div>
              <label className={labelCls}>
                <ImageIcon className="w-3 h-3" />
                Entregable visual
              </label>
              <input
                type="url"
                value={formData.linkEntregable}
                onChange={e => setFormData(prev => ({ ...prev, linkEntregable: e.target.value }))}
                placeholder="https://drive.google.com/..."
                className={fieldCls}
              />
            </div>
          )}

          {/* Prioridad — siempre, abajo de todo, mitad de ancho */}
          <div className="w-1/2">
            <label className={labelCls}>
              <Flag className="w-3 h-3" />
              Prioridad
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PRIORIDADES.map(p => {
                const selected = formData.prioridad === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => handleChange('prioridad', p.value)}
                    className={`px-2 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      selected ? p.on : 'bg-white text-[#000033]/40 border-[#000033]/10 hover:border-[#000033]/25'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="border-t border-[#000033]/10 px-5 py-3 flex items-center justify-between flex-shrink-0">
          <button
            type="button"
            onClick={() => { if (isEditing) { handleClose(); navigate(`/piezas/${ticket!.id}`); } }}
            disabled={!isEditing}
            className="flex items-center gap-1.5 text-xs font-bold text-[#000033]/50 hover:text-[#000033] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-[#000033]/50"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Ver completo
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-1.5 text-xs font-bold text-[#000033]/50 hover:text-[#000033] transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="ticket-form"
              disabled={isPending}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                esTarea ? 'bg-[#00b87f] hover:bg-[#00a070]' : 'bg-[#024fff] hover:bg-[#024fff]/90'
              }`}
            >
              {isPending ? 'Guardando...' : (
                <>
                  {esTarea ? <Check className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {isEditing ? 'Guardar' : (esTarea ? 'Crear tarea' : 'Crear pieza')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
