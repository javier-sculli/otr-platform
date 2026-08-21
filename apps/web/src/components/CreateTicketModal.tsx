import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  X, FileText, CheckSquare, Package, Building2, AlignLeft, Calendar, User,
  Flag, Share2, Link2, Plus, ExternalLink, Check, Copy, ChevronDown,
  Image as ImageIcon, Paperclip, File, Layers, Newspaper, ArrowRight,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { TIPO_GESTION_PITCH, STATUS_OPTIONS, PRENSA_STATUS_OPTIONS, getNextStatusInfo } from '../lib/estados';
import { ensureAbsoluteUrl, copyHtmlToClipboard, formatDateISO } from '../lib/utils';
import { RichNotesEditor } from './RichNotesEditor';
import { ResponsablesSelect } from './ResponsablesSelect';
import { AutoResizeTextarea } from './AutoResizeTextarea';

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
  tiposContenido?: string[];
  client: { id: string; name: string };
  owner: { id: string; name: string };
  assigneeIds?: string[];
  assignees?: { id: string; name: string }[];
  area?: string;
  subEstado?: string | null;
  medio?: string | null;
  periodista?: string | null;
  estadoRespuesta?: string | null;
  ticketType?: { id: string; name: string; kind?: string } | null;
}

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket?: TicketData | null;
  /** Área en la que se crea el ticket. 'PRENSA' fuerza tipos y campos de Prensa. */
  area?: 'CONTENIDO' | 'PRENSA';
  defaultClientId?: string;
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
      dueDate: '',
      links: [] as string[],
      linkEntregable: '',
      content: '',
      contentPerCanal: {} as Record<string, string>,
      notasAudiovisual: '',
      medio: '',
      periodista: '',
      estadoRespuesta: '',
    };
  }
  const initialTipos = (ticket as any).tiposContenido?.length > 0
    ? (ticket as any).tiposContenido
    : (ticket.ticketType?.name ? [ticket.ticketType.name] : []);
  const initialAssignees = Array.isArray((ticket as any).assigneeIds)
    ? (ticket as any).assigneeIds
    : (ticket.owner?.id ? [ticket.owner.id] : []);
  return {
    title: ticket.title,
    brief: ticket.objetivo ?? '',
    canales: (ticket as any).canales?.length > 0 ? (ticket as any).canales : [],
    clientId: ticket.client.id,
    ownerId: ticket.owner.id,
    assigneeIds: initialAssignees,
    ticketTypeId: ticket.ticketType?.id ?? '',
    tiposContenido: initialTipos,
    pilarId: (ticket as any).pilar?.id ?? '',
    speakerId: (ticket as any).speaker?.id ?? '',
    prioridad: ticket.prioridad,
    status: ticket.status,
    dueDate: formatDateISO(ticket.dueDate),
    links: ticket.links ?? [],
    linkEntregable: ticket.linkEntregable ?? '',
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
  const esTarea = tipoTicket === 'TAREA';
  const esPrensa = tipoTicket === 'PRENSA';
  // Prensa comparte el gateo de campos de no-contenido con Tarea (sin canales/pilar/vocero).
  const noContenido = esTarea || esPrensa;
  const [newLinkInput, setNewLinkInput] = useState('');
  const [copyCopied, setCopyCopied] = useState(false);
  const [activeCopyTab, setActiveCopyTab] = useState(() => formData.canales[0] ?? 'Contenido');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isTiposOpen, setIsTiposOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsTiposOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setShowStatusDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectStatusModal = async (targetStatus: string) => {
    setShowStatusDropdown(false);
    if (!ticket?.id) return;

    if (esPrensa) {
      setFormData(prev => ({ ...prev, subEstado: targetStatus }));
      await updateMutation.mutateAsync({ subEstado: targetStatus });
    } else {
      if (targetStatus === 'LISTO' || targetStatus === 'CANCELADO') {
        const label = targetStatus === 'LISTO' ? 'Listo (archivado)' : 'Stand-by / Cancelado';
        if (!window.confirm(`¿Mover a "${label}"?\n\nEl ticket desaparecerá del kanban.`)) return;
      }
      setFormData(prev => ({ ...prev, status: targetStatus }));
      await updateMutation.mutateAsync({ status: targetStatus });
    }
  };

  const handleNextStatusClickModal = () => {
    const currentSub = (ticket as any)?.subEstado ?? formData.estadoRespuesta;
    const info = getNextStatusInfo(formData.status, esPrensa, currentSub, formData.tiposContenido, selectedType || (ticket as any)?.ticketType, formData.title);
    handleSelectStatusModal(info.next);
  };

  const lastTicketIdRef = useRef<string | null>(null);

  // Re-populate when ticket ID changes or modal opens/closes (no sobrescribir edición activa si el ticket es el mismo)
  useEffect(() => {
    if (isOpen) {
      const currentId = ticket?.id ?? null;
      const isNewTicket = currentId !== lastTicketIdRef.current;
      lastTicketIdRef.current = currentId;

      if (isNewTicket) {
        const newFormData = buildFormData(ticket, defaultClientId);
        setFormData(newFormData);
        setTipoTicket(initTipo(ticket));
        const initialCanales = newFormData.canales.length > 0 ? newFormData.canales : ['LinkedIn'];
        setActiveCopyTab(initialCanales[0]);
        setError(null);
        if (ticket?.id) {
          const saved = sessionStorage.getItem(`ticket-files-${ticket.id}`);
          setAttachedFiles(saved ? JSON.parse(saved) : []);
        } else {
          setAttachedFiles([]);
        }
      }
    } else {
      lastTicketIdRef.current = null;
    }
  }, [ticket?.id, isOpen, defaultClientId]);

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

  const availableClients = (clients?.data ?? []).filter((c: any) =>
    preferredIds.length === 0 || preferredIds.includes(c.id) || (isEditing && ticket?.client?.id === c.id)
  );

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.getUsers(),
    enabled: isOpen,
    staleTime: 10 * 60 * 1000,
  });

  const { data: ticketTypes } = useQuery({
    queryKey: ['ticketTypes'],
    queryFn: () => api.getTicketTypes(),
    enabled: isOpen,
    staleTime: 10 * 60 * 1000,
  });

  const { data: pilaresData } = useQuery({
    queryKey: ['pilares', formData.clientId],
    queryFn: () => api.getPilares(formData.clientId),
    enabled: isOpen && !!formData.clientId && !noContenido,
    staleTime: 10 * 60 * 1000,
  });
  const pilares = pilaresData?.data ?? [];

  const { data: speakersData } = useQuery({
    queryKey: ['speakers', formData.clientId],
    queryFn: () => api.getSpeakers(formData.clientId),
    enabled: isOpen && !!formData.clientId && !noContenido,
    staleTime: 10 * 60 * 1000,
  });
  const speakers = speakersData?.data ?? [];

  // Tipos disponibles según Pieza / Tarea / Prensa — "Otro/Otros" siempre al final
  const tiposFiltrados = (ticketTypes?.data ?? [])
    .filter((t: any) =>
      esPrensa ? t.kind === 'PRENSA'
        : esTarea ? t.kind === 'TAREA'
        : (t.kind !== 'TAREA' && t.kind !== 'PRENSA'))
    .sort((a: any, b: any) => {
      const ao = /^otros?$/i.test(a.name) ? 1 : 0;
      const bo = /^otros?$/i.test(b.name) ? 1 : 0;
      if (ao !== bo) return ao - bo;
      return a.name.localeCompare(b.name);
    });

  const handleTipoTicketChange = (next: 'CONTENIDO' | 'TAREA' | 'PRENSA') => {
    if (isEditing) return; // no se cambia la naturaleza al editar
    setTipoTicket(next);
    setFormData(prev => ({ ...prev, ticketTypeId: '' }));
    setError(null);
  };

  const selectedType = (ticketTypes?.data ?? []).find((t: any) => t.id === formData.ticketTypeId);
  const esGestionPitch = esPrensa && selectedType?.name === TIPO_GESTION_PITCH;

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

  const isPending = createMutation.isPending || updateMutation.isPending;

  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  const performAutoSave = async (overrideData?: Partial<typeof formData>) => {
    if (!isEditing || !ticket?.id) return;
    const current = { ...formDataRef.current, ...overrideData };
    const primaryOwner = current.ownerId || current.assigneeIds?.[0];
    if (!current.title || !current.clientId || !primaryOwner) return;

    const payload: any = {
      title: current.title,
      ownerId: primaryOwner,
      assigneeIds: current.assigneeIds || [],
      status: current.status,
      prioridad: current.prioridad,
      objetivo: current.brief || null,
      canales: noContenido ? [] : (current.canales.length > 0 ? current.canales : ['LinkedIn']),
      dueDate: current.dueDate || null,
      ticketTypeId: current.ticketTypeId || null,
      notasAudiovisual: current.notasAudiovisual || null,
      pilarId: noContenido ? null : (current.pilarId || null),
      speakerId: noContenido ? null : (current.speakerId || null),
      links: current.links.map(ensureAbsoluteUrl),
      linkEntregable: current.linkEntregable ? ensureAbsoluteUrl(current.linkEntregable) : null,
      content: noContenido ? undefined : (current.content || null),
    };

    if (!noContenido) {
      const hasSomeContent = Object.values(current.contentPerCanal || {}).some((val: any) => typeof val === 'string' && val.trim().length > 0);
      if (hasSomeContent) {
        payload.contentPerCanal = current.contentPerCanal;
      }
    }

    if (esPrensa) {
      payload.area = 'PRENSA';
      payload.subEstado = (ticket as any)?.subEstado ?? 'PENDIENTE';
      payload.medio = current.medio || null;
      payload.periodista = current.periodista || null;
      payload.estadoRespuesta = current.estadoRespuesta || null;
    }

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
    } catch (err: any) {
      setSaveStatus('error');
    }
  };

  const triggerDebouncedAutoSave = (overrideData?: Partial<typeof formData>) => {
    if (!isEditing || !ticket?.id) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus('saving');
    saveTimeoutRef.current = setTimeout(() => {
      performAutoSave(overrideData);
    }, 500);
  };

  const triggerImmediateAutoSave = (overrideData?: Partial<typeof formData>) => {
    if (!isEditing || !ticket?.id) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    performAutoSave(overrideData);
  };

  const handleChange = (field: string, value: string, immediate = false) => {
    const updated = {
      ...formDataRef.current,
      [field]: value,
      ...(field === 'clientId' ? { pilarId: '', speakerId: '' } : {}),
    };
    setFormData(updated);
    setError(null);
    if (isEditing) {
      if (immediate || ['prioridad', 'ownerId', 'dueDate', 'estadoRespuesta', 'speakerId', 'pilarId', 'ticketTypeId'].includes(field)) {
        triggerImmediateAutoSave(updated);
      } else {
        triggerDebouncedAutoSave(updated);
      }
    }
  };

  const processAndAddLink = (rawText: string) => {
    const url = ensureAbsoluteUrl(rawText.trim());
    if (url && !formDataRef.current.links.includes(url)) {
      const updatedLinks = [...formDataRef.current.links, url];
      setFormData(prev => ({ ...prev, links: updatedLinks }));
      setNewLinkInput('');
      if (isEditing) {
        triggerImmediateAutoSave({ links: updatedLinks });
      }
    } else {
      setNewLinkInput('');
    }
  };

  const addLink = () => {
    processAndAddLink(newLinkInput);
  };

  const removeLink = (index: number) => {
    const updatedLinks = formData.links.filter((_, j) => j !== index);
    setFormData(prev => ({ ...prev, links: updatedLinks }));
    if (isEditing) {
      triggerImmediateAutoSave({ links: updatedLinks });
    }
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
      const updated = { ...prev, canales: newCanales };
      if (isEditing) triggerImmediateAutoSave(updated);
      return updated;
    });
  };

  const goRedactar = (id: string, files: AttachedFile[]) => {
    if (files.length > 0) {
      sessionStorage.setItem(`ticket-files-${id}`, JSON.stringify(files));
    }
    navigate(`/content/${id}`, { state: { attachedFiles: files.length > 0 ? files : undefined } });
  };

  const submitTicket = async ({ action }: { action: 'SAVE' | 'REDACTAR' | 'VER_TICKET' }) => {
    setError(null);

    const primaryOwner = formData.ownerId || formData.assigneeIds?.[0];
    if (!formData.title || !formData.clientId || !primaryOwner) {
      setError('Completá los campos requeridos: nombre, cliente y responsable');
      return;
    }

    const payload: any = {
      title: formData.title,
      ownerId: primaryOwner,
      assigneeIds: formData.assigneeIds || [],
      status: formData.status,
      prioridad: formData.prioridad,
      objetivo: formData.brief || null,
      canales: noContenido ? [] : (formData.canales.length > 0 ? formData.canales : ['LinkedIn']),
      dueDate: formData.dueDate || null,
      ticketTypeId: formData.ticketTypeId || null,
      tiposContenido: formData.tiposContenido,
      notasAudiovisual: formData.notasAudiovisual || null,
      pilarId: noContenido ? null : (formData.pilarId || null),
      speakerId: noContenido ? null : (formData.speakerId || null),
    };

    if (esPrensa) {
      payload.area = 'PRENSA';
      payload.subEstado = (ticket as any)?.subEstado ?? 'PENDIENTE';
      payload.medio = formData.medio || null;
      payload.periodista = formData.periodista || null;
      payload.estadoRespuesta = formData.estadoRespuesta || null;
    }

    const files = attachedFiles;

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({
          ...payload,
          links: formData.links.map(ensureAbsoluteUrl),
          linkEntregable: formData.linkEntregable ? ensureAbsoluteUrl(formData.linkEntregable) : null,
          content: noContenido ? undefined : (formData.content || null),
          contentPerCanal: noContenido ? undefined : formData.contentPerCanal,
          notasAudiovisual: noContenido ? undefined : (formData.notasAudiovisual || null),
        });
        const id = ticket!.id;
        handleClose();
        if (action === 'REDACTAR') goRedactar(id, files);
        else if (action === 'VER_TICKET') navigate(`/piezas/${id}`);
      } else {
        const res = await createMutation.mutateAsync({
          ...payload,
          clientId: formData.clientId,
          ...(formData.links.length > 0 ? { links: formData.links.map(ensureAbsoluteUrl) } : {}),
        });
        const newId = res?.data?.id;
        handleClose();
        if (action === 'REDACTAR' && newId) goRedactar(newId, files);
        else if (action === 'VER_TICKET' && newId) navigate(`/piezas/${newId}`);
      }
    } catch {
      // onError de la mutación ya seteó el mensaje
    }
  };

  const handleVerTicket = async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      await performAutoSave();
    }
    const id = ticket?.id;
    handleClose();
    if (id) navigate(`/piezas/${id}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing) {
      submitTicket({ action: 'SAVE' });
    }
  };

  const handleClose = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      if (isEditing) {
        performAutoSave();
      }
    }
    setSaveStatus(null);
    setFormData(buildFormData(null));
    setError(null);
    if (!isEditing) setAttachedFiles([]);
    onClose();
  };

  if (!isOpen) return null;

  const showRecursos = true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full md:w-[50vw] md:min-w-[560px] md:max-w-[1200px] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#000033]">{isEditing ? 'Editar' : 'Nuevo'}</h2>
            <div className="flex items-center gap-3">
              {isEditing && (
                <span className="text-xs font-medium transition-all">
                  {saveStatus === 'saving' && <span className="text-[#024fff] flex items-center gap-1.5 font-bold"><span className="w-2 h-2 rounded-full bg-[#024fff] animate-pulse" />Guardando…</span>}
                  {saveStatus === 'saved' && <span className="text-emerald-600 font-bold flex items-center gap-1"><Check className="w-3.5 h-3.5" />Guardado</span>}
                  {saveStatus === 'error' && <span className="text-red-500 font-bold">Error al guardar</span>}
                </span>
              )}
              <button
                onClick={handleClose}
                className="w-7 h-7 rounded-lg hover:bg-[#000033]/5 flex items-center justify-center transition-all text-[#000033]/40 hover:text-[#000033]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tipo de ticket — Prensa muestra chip estático; resto, toggle Pieza/Tarea */}
          <div className="flex items-center gap-2 mt-3">
            {esPrensa ? (
              <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-[#024fff] text-[#024fff] bg-white">
                <Newspaper className="w-3.5 h-3.5" />
                Prensa
              </span>
            ) : (
              ([
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
              })
            )}
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
              placeholder={esPrensa ? 'Título del ticket de prensa' : esTarea ? 'Nombre del pedido' : 'Nombre de la pieza'}
              className={fieldCls}
              autoFocus
            />
          </div>

          {/* Tipo + Cliente */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative" ref={dropdownRef}>
              <label className={labelCls}>
                <Package className="w-3 h-3" />
                {esPrensa ? 'Tipo de prensa' : esTarea ? 'Tipo de entregable' : 'Tipo de contenido (formatos)'}
              </label>
              <button
                type="button"
                onClick={() => setIsTiposOpen(!isTiposOpen)}
                className={`${fieldCls} flex items-center justify-between text-left cursor-pointer`}
              >
                <span className="truncate font-medium">
                  {formData.tiposContenido.length === 0
                    ? 'Seleccionar tipo…'
                    : formData.tiposContenido.length === 1
                    ? formData.tiposContenido[0]
                    : `${formData.tiposContenido[0]} (+${formData.tiposContenido.length - 1} formatos)`}
                </span>
                <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0 ml-1" />
              </button>

              {isTiposOpen && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-[#000033]/15 rounded-xl shadow-xl py-1 max-h-64 overflow-y-auto">
                  <div className="px-3 py-1.5 border-b border-[#000033]/10 text-[10px] font-bold uppercase tracking-wider text-[#000033]/40 flex items-center justify-between bg-[#fafafa]">
                    <span>Elegí 1 o más formatos</span>
                    <button
                      type="button"
                      onClick={() => setIsTiposOpen(false)}
                      className="text-[#024fff] hover:underline text-xs font-bold"
                    >
                      Listo ✓
                    </button>
                  </div>
                  {tiposFiltrados.map((t: any) => {
                    const isChecked = formData.tiposContenido.includes(t.name);
                    return (
                      <div
                        key={t.id}
                        className={`flex items-center justify-between px-3 py-2 hover:bg-[#024fff]/5 cursor-pointer text-xs transition-colors ${
                          isChecked ? 'bg-[#024fff]/[0.03]' : ''
                        }`}
                        onClick={() => {
                          const exists = formData.tiposContenido.includes(t.name);
                          const next = exists
                            ? formData.tiposContenido.filter((name: string) => name !== t.name)
                            : [...formData.tiposContenido, t.name];
                          const newTicketTypeId = next.length > 0
                            ? (tiposFiltrados.find((tf: any) => tf.name === next[0])?.id ?? formData.ticketTypeId)
                            : '';
                          const updated = {
                            ...formDataRef.current,
                            tiposContenido: next,
                            ticketTypeId: newTicketTypeId,
                          };
                          setFormData(updated);
                          if (isEditing) {
                            triggerImmediateAutoSave(updated);
                          }
                        }}
                      >
                        <div className="flex items-center gap-2 font-medium text-[#000033]">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            readOnly
                            className="w-3.5 h-3.5 rounded border-[#000033]/20 text-[#024fff] focus:ring-[#024fff] cursor-pointer"
                          />
                          <span>{t.name}</span>
                        </div>
                        {isChecked && <Check className="w-3.5 h-3.5 text-[#024fff]" />}
                      </div>
                    );
                  })}
                </div>
              )}
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
                {availableClients.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Descripción / Brief */}
          <div>
            <label className={labelCls}>
              <AlignLeft className="w-3 h-3" />
              {noContenido ? 'Descripción' : 'Brief'}
            </label>
            <AutoResizeTextarea
              value={formData.brief}
              onChange={e => handleChange('brief', e.target.value)}
              placeholder={noContenido ? 'Descripción — detalle del pedido' : 'Brief — qué querés comunicar y por qué'}
              className={fieldCls}
              minRows={formData.brief?.trim() ? 6 : 2}
            />
          </div>

          {/* Gestión-pitch (Prensa): contacto con medios */}
          {esGestionPitch && (
            <div className="grid grid-cols-3 gap-3 p-3 rounded-xl border border-[#024fff]/20 bg-[#024fff]/[0.03]">
              <div>
                <label className={labelCls}>
                  <Newspaper className="w-3 h-3" />
                  Medio
                </label>
                <input
                  type="text"
                  value={formData.medio}
                  onChange={e => handleChange('medio', e.target.value)}
                  placeholder="La Nación, Clarín…"
                  className={fieldCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  <User className="w-3 h-3" />
                  Periodista
                </label>
                <input
                  type="text"
                  value={formData.periodista}
                  onChange={e => handleChange('periodista', e.target.value)}
                  placeholder="Nombre del cronista"
                  className={fieldCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  <Flag className="w-3 h-3" />
                  Respuesta
                </label>
                <select
                  value={formData.estadoRespuesta}
                  onChange={e => handleChange('estadoRespuesta', e.target.value)}
                  className={fieldCls}
                >
                  <option value="">—</option>
                  <option value="ENVIADO">Enviado</option>
                  <option value="RESPONDIDO">Respondido</option>
                  <option value="SIN_RESPUESTA">Sin respuesta</option>
                </select>
              </div>
            </div>
          )}

          {/* Fecha + Responsable/Owner */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                <Calendar className="w-3 h-3" />
                {noContenido ? 'Fecha de entrega' : 'Fecha objetivo'}
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
                {noContenido ? 'Responsables' : 'Owners / Responsables'}
              </label>
              <ResponsablesSelect
                users={users?.data ?? []}
                selectedIds={formData.assigneeIds}
                onChange={ids => {
                  setFormData(prev => ({
                    ...prev,
                    assigneeIds: ids,
                    ownerId: ids[0] ?? prev.ownerId,
                  }));
                  performAutoSave({
                    assigneeIds: ids,
                    ownerId: ids[0] ?? formDataRef.current.ownerId,
                  });
                }}
                placeholder={noContenido ? 'Asignar responsables' : 'Asignar owners'}
              />
            </div>
          </div>

          {/* Vocero — solo Pieza, si el cliente tiene voceros */}
          {!noContenido && formData.clientId && speakers.length > 0 && (
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

          {/* Pilar y Red(es) objetivo en 2 columnas para ahorrar espacio */}
          {!noContenido && (
            <div className={`grid gap-3 ${formData.clientId && pilares.length > 0 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
              {/* Pilar — solo Pieza, si el cliente tiene pilares */}
              {formData.clientId && pilares.length > 0 && (
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
              <div>
                <label className={labelCls}>
                  <Share2 className="w-3 h-3" />
                  Red(es) objetivo
                  <span className="lowercase font-medium text-[#000033]/30 tracking-normal ml-1">opcional</span>
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
                  onPaste={e => {
                    const pasted = e.clipboardData.getData('text');
                    if (pasted) {
                      e.preventDefault();
                      processAndAddLink(pasted);
                    }
                  }}
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
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Adjuntar archivo"
                  className="px-3 py-2 bg-[#000033]/5 border border-[#000033]/10 text-[#000033]/50 rounded-lg hover:bg-[#000033]/10 hover:text-[#000033] transition-all"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
              </div>
              {(formData.links.length > 0 || attachedFiles.length > 0) && (
                <div className="space-y-1.5 mt-2">
                  {formData.links.map((link, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 border border-[#024fff]/20 rounded-lg group hover:border-[#024fff]/40 transition-all">
                      <Link2 className="w-3.5 h-3.5 text-[#024fff] flex-shrink-0" />
                      <a href={ensureAbsoluteUrl(link)} target="_blank" rel="noopener noreferrer" className="text-xs text-[#024fff] truncate flex-1 hover:underline">{link}</a>
                      <ExternalLink className="w-2.5 h-2.5 text-[#024fff]/40 flex-shrink-0" />
                      <button
                        type="button"
                        onClick={() => removeLink(i)}
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

          {/* NOTAS DE DISEÑO — solo Pieza en edición */}
          {isEditing && !noContenido && (
            <div>
              <label className={labelCls}>
                <ImageIcon className="w-3 h-3 text-[#024fff]" />
                Notas de diseño
              </label>
              <RichNotesEditor
                value={formData.notasAudiovisual}
                onChange={val => {
                  const updated = { ...formData, notasAudiovisual: val };
                  setFormData(updated);
                  triggerDebouncedAutoSave(updated);
                }}
                onBlur={() => triggerImmediateAutoSave()}
                placeholder="Notas de diseño (indicaciones visuales, estilo, imágenes, links)..."
                minHeight="140px"
              />
            </div>
          )}

          {/* COPY — solo Pieza en edición */}
          {isEditing && !noContenido && (() => {
            const canales = formData.canales.length > 0 ? formData.canales : ['LinkedIn'];
            const currentTab = activeCopyTab && canales.includes(activeCopyTab) ? activeCopyTab : canales[0];
            const currentCopy = formData.contentPerCanal[currentTab] ?? '';

            return (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`${labelCls} mb-0`}>
                    <FileText className="w-3 h-3" />
                    Copy ({currentTab})
                  </label>
                  {currentCopy.trim() && (
                    <button
                      type="button"
                      onClick={async () => {
                        await copyHtmlToClipboard(currentCopy);
                        setCopyCopied(true);
                        setTimeout(() => setCopyCopied(false), 2000);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 bg-[#00ff99]/20 border-2 border-[#00ff99]/40 text-[#000033] rounded-lg hover:bg-[#00ff99]/30 transition-all text-xs font-bold"
                    >
                      {copyCopied ? <><Check className="w-3 h-3" />Copiado</> : <><Copy className="w-3 h-3" />Copiar</>}
                    </button>
                  )}
                </div>
                {canales.length > 1 && (
                  <div className="flex items-center gap-1 mb-2 overflow-x-auto">
                    {canales.map((canal: string) => (
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
                  value={currentCopy}
                  onChange={val => {
                    const nextContentPerCanal: Record<string, string> = { ...formData.contentPerCanal, [currentTab]: val };
                    const firstCanal = (formData.canales[0] as string) || 'LinkedIn';
                    const updated = {
                      ...formData,
                      contentPerCanal: nextContentPerCanal,
                      content: nextContentPerCanal[firstCanal] || null,
                    };
                    setFormData(updated);
                    if (isEditing) triggerDebouncedAutoSave(updated);
                  }}
                  onBlur={() => { if (isEditing) triggerImmediateAutoSave(); }}
                  placeholder={`Copy para ${currentTab}...`}
                  minHeight="180px"
                />
              </div>
            );
          })()}

          {/* ENTREGABLE VISUAL — solo Pieza en edición */}
          {isEditing && !noContenido && (
            <div>
              <label className={labelCls}>
                <ImageIcon className="w-3 h-3" />
                Entregable visual
              </label>
              <input
                type="url"
                value={formData.linkEntregable}
                onChange={e => handleChange('linkEntregable', e.target.value)}
                onBlur={() => { if (isEditing) triggerImmediateAutoSave(); }}
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
        <div className="border-t border-[#000033]/10 px-5 py-3 flex items-center justify-between flex-shrink-0 bg-[#fafafa]">
          <button
            type="button"
            onClick={handleClose}
            className="px-3 py-1.5 text-xs font-bold text-[#000033]/50 hover:text-[#000033] transition-all"
          >
            {isEditing ? 'Cerrar' : 'Cancelar'}
          </button>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                {/* Botón cambiar estado: Próximo estado + Dropdown */}
                {(() => {
                  const currentSub = (ticket as any)?.subEstado ?? null;
                  const nextInfo = getNextStatusInfo(formData.status, esPrensa, currentSub, formData.tiposContenido);
                  return (
                    <div className="relative inline-flex items-center rounded-lg shadow-sm" ref={statusDropdownRef}>
                      <button
                        type="button"
                        onClick={handleNextStatusClickModal}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-3 py-2 bg-[#024fff] text-white font-bold text-xs rounded-l-lg hover:bg-[#024fff]/90 transition-all active:scale-95 disabled:opacity-50"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>Pasar a {nextInfo.label}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                        disabled={isPending}
                        className="px-2 py-2 bg-[#024fff] border-l border-white/25 text-white rounded-r-lg hover:bg-[#024fff]/90 transition-all disabled:opacity-50"
                        title="Cambiar a otro estado..."
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>

                      {/* Popover desplegable hacia arriba */}
                      {showStatusDropdown && (
                        <div className="absolute right-0 bottom-full mb-2 w-56 bg-white border-2 border-[#000033]/15 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                          <div className="px-3 py-1.5 border-b border-[#000033]/10 text-[10px] font-bold text-[#000033]/40 uppercase tracking-wider">
                            Cambiar estado a:
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                            {(esPrensa ? PRENSA_STATUS_OPTIONS : STATUS_OPTIONS).map(opt => {
                              const isCurrent = esPrensa
                                ? (currentSub ?? 'PENDIENTE') === opt.value
                                : formData.status === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => handleSelectStatusModal(opt.value)}
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

                <button
                  type="button"
                  onClick={handleVerTicket}
                  disabled={isPending}
                  className="px-4 py-2 text-xs font-bold text-[#024fff] border-2 border-[#024fff]/30 bg-[#024fff]/5 rounded-lg hover:bg-[#024fff]/10 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ver Ticket
                </button>
              </>
            ) : (
              <button
                type="submit"
                form="ticket-form"
                disabled={isPending}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                  esTarea ? 'bg-[#00b87f] hover:bg-[#00a070]' : 'bg-[#024fff] hover:bg-[#024fff]/90'
                }`}
              >
                {isPending ? 'Creando...' : (
                  <><Check className="w-3.5 h-3.5" />Crear ticket</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
