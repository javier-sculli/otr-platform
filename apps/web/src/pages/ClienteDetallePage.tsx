import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Sparkles, Mic, Radio, Save, Check, AlertCircle, Linkedin, Instagram, Twitter, Video, Mail, BookOpen, Settings, User, Target, Plus, Edit3, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { VocerosPage } from './VocerosPage';
import { Toggle } from '../components/Toggle';

type Tab = 'brand' | 'voceros' | 'canales' | 'gestion';

// ── Brand Kit sections (same as VozDeMarcaPage) ──────────────────────────────

const SECCIONES = [
  { id: 'identidad_verbal', titulo: 'Identidad verbal de la marca', placeholder: 'Describí el tono característico, el tipo de lenguaje, expresiones aprobadas y estructuras de frase que usa la marca...' },
  { id: 'estrategia_contenido', titulo: 'Estrategia de contenido', placeholder: 'Mensajes prioritarios, pilares temáticos, nivel de profundidad buscado y elementos visuales o textuales alineados...' },
  { id: 'criterios_calidad', titulo: 'Criterios de calidad', placeholder: 'Qué es contenido bueno, qué rechazás sistemáticamente, nivel de claridad/síntesis/precisión esperado y referencias o benchmarks...' },
  { id: 'uso_idioma', titulo: 'Uso del idioma', placeholder: 'Idioma principal de la marca, cuándo usar cada idioma, restricciones de tono por idioma...' },
  { id: 'elementos_marca', titulo: 'Elementos de marca a respetar', placeholder: 'Valores centrales, terminología específica, propuesta de valor transversal, público objetivo y diferenciales competitivos...' },
  { id: 'identidad_comunicacion', titulo: 'Identidad de comunicación', placeholder: 'Cómo comunica la marca, desde dónde habla, qué busca generar en la audiencia...' },
  { id: 'estilo_editorial', titulo: 'Estilo editorial', placeholder: 'Estructura de frases, longitud de títulos, uso de bullets, jerarquía visual preferida, tipos de claims...' },
  { id: 'mensajes_clave', titulo: 'Mensajes clave / Puntos de foco', placeholder: 'Las ideas centrales que deben quedar claras en cualquier pieza de contenido...' },
  { id: 'lineas_editoriales', titulo: 'Líneas editoriales', placeholder: 'Los ejes temáticos desde los cuales se produce contenido (ej: DNA/cultura, value prop, plataforma, validación, trust)...' },
  { id: 'formato_preferido', titulo: 'Formato preferido', placeholder: 'Tipos de formatos que mejor representan la marca: slides, threads, videos, carruseles, long-form, etc...' },
  { id: 'audiencia_objetivo', titulo: 'Audiencia objetivo', placeholder: 'Quiénes son, qué saben, qué les importa, cómo toman decisiones...' },
];

function BrandKitTab({ clientId }: { clientId: string }) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState<Record<string, string>>(() =>
    Object.fromEntries(SECCIONES.map(s => [s.id, '']))
  );
  const [hasChanges, setHasChanges] = useState(false);

  const { data: brandVoiceData, isLoading } = useQuery({
    queryKey: ['brand-voice', clientId],
    queryFn: () => api.getBrandVoice(clientId),
  });

  useEffect(() => {
    if (brandVoiceData?.data) {
      setContent(prev => ({ ...prev, ...brandVoiceData.data }));
    }
  }, [brandVoiceData]);

  const saveMutation = useMutation({
    mutationFn: () => api.saveBrandVoice(clientId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-voice', clientId] });
      setHasChanges(false);
    },
  });

  const handleChange = (id: string, value: string) => {
    setContent(prev => ({ ...prev, [id]: value }));
    setHasChanges(true);
  };

  const filledCount = SECCIONES.filter(s => content[s.id]?.trim().length > 0).length;

  if (isLoading) {
    return <div className="flex items-center justify-center py-16 text-[#000033]/60 text-sm">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Subheader Brand Kit */}
      <div className="bg-white border-b border-[#000033]/8 px-8 py-4 sticky top-[117px] z-[5]">
        <div className="max-w-[900px] mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-[#000033]/50">{filledCount}/{SECCIONES.length} secciones completadas</p>
            <div className="mt-2 w-48 h-1 bg-[#000033]/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#024fff] rounded-full transition-all duration-500"
                style={{ width: `${(filledCount / SECCIONES.length) * 100}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!hasChanges && saveMutation.isSuccess && (
              <span className="text-xs text-[#000033]/40 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#00ff99]" /> Guardado
              </span>
            )}
            {hasChanges && (
              <span className="text-xs text-[#000033]/50 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> Sin guardar
              </span>
            )}
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!hasChanges || saveMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-[#024fff] text-white text-sm font-bold rounded-lg hover:bg-[#024fff]/90 transition-all shadow-lg shadow-[#024fff]/20 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>

      {/* Secciones */}
      <div className="max-w-[900px] mx-auto px-8 py-6 space-y-4">
        {SECCIONES.map((seccion, index) => (
          <div key={seccion.id} className="bg-white border-2 border-[#000033]/10 rounded-xl px-5 py-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-[#000033]/30 w-5 text-right">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="font-bold text-[#000033] text-sm">{seccion.titulo}</span>
            </div>
            <textarea
              value={content[seccion.id] ?? ''}
              onChange={e => handleChange(seccion.id, e.target.value)}
              placeholder={seccion.placeholder}
              rows={6}
              className="w-full px-3 py-3 border-2 border-[#000033]/10 rounded-lg text-sm text-[#000033] placeholder-[#000033]/25 bg-[#fafafa] focus:outline-none focus:border-[#024fff] focus:bg-white resize-none transition-colors leading-relaxed"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Canales Tab ──────────────────────────────────────────────────────────────

type CanalKey = 'linkedin' | 'instagram' | 'twitter' | 'tiktok' | 'newsletter' | 'blog';

const CANALES_CONFIG: {
  id: CanalKey;
  label: string;
  labelExtra?: string;
  placeholder: string;
  urlField: string;
  icon: React.ReactNode;
  iconBg: string;
}[] = [
  {
    id: 'linkedin',
    label: 'LinkedIn (empresa)',
    placeholder: 'https://linkedin.com/company/...',
    urlField: 'linkedinUrl',
    icon: <Linkedin className="w-6 h-6 text-[#024fff]" />,
    iconBg: 'bg-[#024fff]/10',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    placeholder: 'https://instagram.com/...',
    urlField: 'instagramUrl',
    icon: <Instagram className="w-6 h-6 text-pink-600" />,
    iconBg: 'bg-pink-100',
  },
  {
    id: 'twitter',
    label: 'X / Twitter',
    placeholder: 'https://twitter.com/... o https://x.com/...',
    urlField: 'twitterUrl',
    icon: <Twitter className="w-6 h-6 text-[#000033]" />,
    iconBg: 'bg-[#000033]/10',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    labelExtra: 'opcional',
    placeholder: 'https://tiktok.com/@...',
    urlField: 'tiktokUrl',
    icon: <Video className="w-6 h-6 text-white" />,
    iconBg: 'bg-[#000033]',
  },
  {
    id: 'newsletter',
    label: 'Newsletter',
    labelExtra: 'opcional',
    placeholder: 'https://...',
    urlField: 'newsletterUrl',
    icon: <Mail className="w-6 h-6 text-[#00ff99]" />,
    iconBg: 'bg-[#00ff99]/20',
  },
  {
    id: 'blog',
    label: 'Blog',
    labelExtra: 'opcional',
    placeholder: 'https://...',
    urlField: 'blogUrl',
    icon: <BookOpen className="w-6 h-6 text-[#00ff99]" />,
    iconBg: 'bg-[#00ff99]/20',
  },
];

// Map canal key → canales array label
const CANAL_LABEL: Record<CanalKey, string> = {
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  twitter: 'Twitter/X',
  tiktok: 'TikTok',
  newsletter: 'Newsletter',
  blog: 'Blog',
};

function CanalesTab({ clientId }: { clientId: string }) {
  const queryClient = useQueryClient();

  const { data: clientsData, isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.getClients(),
  });

  const client = clientsData?.data.find((c: any) => c.id === clientId);

  const [urls, setUrls] = useState<Record<string, string>>({
    linkedinUrl: '',
    instagramUrl: '',
    twitterUrl: '',
    tiktokUrl: '',
    newsletterUrl: '',
    blogUrl: '',
  });

  const [habilitados, setHabilitados] = useState<Record<CanalKey, boolean>>({
    linkedin: false,
    instagram: false,
    twitter: false,
    tiktok: false,
    newsletter: false,
    blog: false,
  });

  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!client) return;
    const canalesArr: string[] = client.canales ?? [];
    setHabilitados({
      linkedin: canalesArr.includes('LinkedIn'),
      instagram: canalesArr.includes('Instagram'),
      twitter: canalesArr.includes('Twitter/X'),
      tiktok: canalesArr.includes('TikTok'),
      newsletter: canalesArr.includes('Newsletter'),
      blog: canalesArr.includes('Blog'),
    });
    setUrls({
      linkedinUrl: client.linkedinUrl ?? '',
      instagramUrl: client.instagramUrl ?? '',
      twitterUrl: client.twitterUrl ?? '',
      tiktokUrl: client.tiktokUrl ?? '',
      newsletterUrl: client.newsletterUrl ?? '',
      blogUrl: client.blogUrl ?? '',
    });
    setHasChanges(false);
  }, [client?.id]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const canalesArr = (Object.keys(habilitados) as CanalKey[])
        .filter(k => habilitados[k])
        .map(k => CANAL_LABEL[k]);
      return api.updateClient(clientId, { ...urls, canales: canalesArr });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients-stats'] });
      setHasChanges(false);
    },
  });

  const toggleCanal = (canal: CanalKey) => {
    setHabilitados(prev => {
      const next = { ...prev, [canal]: !prev[canal] };
      return next;
    });
    // Clear URL when disabling
    if (habilitados[canal]) {
      const cfg = CANALES_CONFIG.find(c => c.id === canal)!;
      setUrls(prev => ({ ...prev, [cfg.urlField]: '' }));
    }
    setHasChanges(true);
  };

  const handleUrl = (field: string, value: string) => {
    setUrls(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const canalesActivos = Object.values(habilitados).filter(Boolean).length;

  if (isLoading) {
    return <div className="flex items-center justify-center py-16 text-[#000033]/60 text-sm">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Subheader */}
      <div className="bg-white border-b border-[#000033]/8 px-8 py-4 sticky top-[117px] z-[5]">
        <div className="max-w-[900px] mx-auto flex items-center justify-between">
          <p className="text-sm text-[#000033]/60">
            {canalesActivos} {canalesActivos === 1 ? 'canal activo' : 'canales activos'}
          </p>
          <div className="flex items-center gap-3">
            {!hasChanges && saveMutation.isSuccess && (
              <span className="text-xs text-[#000033]/40 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#00ff99]" /> Guardado
              </span>
            )}
            {hasChanges && (
              <span className="text-xs text-[#000033]/50 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> Sin guardar
              </span>
            )}
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!hasChanges || saveMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-[#024fff] text-white text-sm font-bold rounded-lg hover:bg-[#024fff]/90 transition-all shadow-lg shadow-[#024fff]/20 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>

      {/* Canal list */}
      <div className="max-w-[900px] mx-auto px-8 py-6">
        <div className="bg-white border-2 border-[#000033]/10 rounded-xl overflow-hidden">
          <div className="px-6 py-5 space-y-5">
            {CANALES_CONFIG.map((canal, i) => (
              <div key={canal.id}>
                {i > 0 && <div className="border-t border-[#000033]/10 mb-5" />}
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 ${canal.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    {canal.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Toggle
                        checked={habilitados[canal.id]}
                        onChange={() => toggleCanal(canal.id)}
                      />
                      <label className="text-sm font-bold text-[#000033]">
                        {canal.label}
                        {canal.labelExtra && (
                          <span className="font-normal text-[#000033]/40 text-xs ml-1">({canal.labelExtra})</span>
                        )}
                      </label>
                    </div>
                    {habilitados[canal.id] && (
                      <input
                        type="url"
                        value={urls[canal.urlField]}
                        onChange={e => handleUrl(canal.urlField, e.target.value)}
                        placeholder={canal.placeholder}
                        className="w-full px-4 py-3 border-2 border-[#000033]/10 rounded-lg text-sm text-[#000033] placeholder-[#000033]/25 bg-[#fafafa] focus:outline-none focus:border-[#024fff] focus:bg-white transition-colors"
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}

            <div className="border-t border-[#000033]/10 pt-5">
              <p className="text-xs text-[#000033]/50">
                Estos canales se utilizan en el módulo de Performance para buscar y analizar publicaciones del cliente.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Gestion Tab ──────────────────────────────────────────────────────────────

interface Pilar { id: string; nombre: string; descripcion: string | null }

function GestionTab({ clientId }: { clientId: string }) {
  const queryClient = useQueryClient();

  const { data: clientsData } = useQuery({ queryKey: ['clients'], queryFn: () => api.getClients() });
  const { data: usersData } = useQuery({ queryKey: ['users'], queryFn: () => api.getUsers() });
  const { data: pilaresData, isLoading } = useQuery({
    queryKey: ['pilares', clientId],
    queryFn: () => api.getPilares(clientId),
  });

  const client = clientsData?.data.find((c: any) => c.id === clientId);
  const users: any[] = usersData?.data ?? [];
  const pilares: Pilar[] = pilaresData?.data ?? [];

  // Responsable
  const [editandoResponsable, setEditandoResponsable] = useState(false);
  const [nuevoOwnerId, setNuevoOwnerId] = useState('');

  const updateClientMutation = useMutation({
    mutationFn: (ownerId: string) => api.updateClient(clientId, { ownerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setEditandoResponsable(false);
    },
  });

  // Pilares
  const [showNuevoPilar, setShowNuevoPilar] = useState(false);
  const [nuevoPilar, setNuevoPilar] = useState({ nombre: '', descripcion: '' });
  const [editandoPilarId, setEditandoPilarId] = useState<string | null>(null);
  const [pilarEditado, setPilarEditado] = useState<Pilar | null>(null);

  const createPilarMutation = useMutation({
    mutationFn: (data: { nombre: string; descripcion?: string }) => api.createPilar(clientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pilares', clientId] });
      setShowNuevoPilar(false);
      setNuevoPilar({ nombre: '', descripcion: '' });
    },
  });

  const updatePilarMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; nombre: string; descripcion?: string }) =>
      api.updatePilar(clientId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pilares', clientId] });
      setEditandoPilarId(null);
      setPilarEditado(null);
    },
  });

  const deletePilarMutation = useMutation({
    mutationFn: (id: string) => api.deletePilar(clientId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pilares', clientId] }),
  });

  const responsable = users.find((u: any) => u.id === client?.ownerId);

  if (isLoading) return <div className="flex items-center justify-center py-16 text-[#000033]/60 text-sm">Cargando...</div>;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="max-w-[900px] mx-auto px-8 py-6 space-y-6">

        {/* Responsable */}
        <div className="bg-white border-2 border-[#000033]/10 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <User className="w-4 h-4 text-[#024fff]" />
            <h2 className="text-xs font-bold text-[#000033] uppercase tracking-wider">Responsable del cliente</h2>
          </div>
          {editandoResponsable ? (
            <div className="flex items-center gap-3">
              <select
                value={nuevoOwnerId}
                onChange={e => setNuevoOwnerId(e.target.value)}
                autoFocus
                className="flex-1 px-3 py-2.5 border-2 border-[#024fff]/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033] bg-white"
              >
                <option value="">Sin responsable</option>
                {users.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <button
                onClick={() => updateClientMutation.mutate(nuevoOwnerId)}
                disabled={updateClientMutation.isPending}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#024fff] text-white rounded-lg hover:bg-[#024fff]/90 transition-all font-bold text-sm shadow-lg shadow-[#024fff]/20 disabled:opacity-50"
              >
                <Check className="w-4 h-4" /> Guardar
              </button>
              <button
                onClick={() => setEditandoResponsable(false)}
                className="px-4 py-2.5 text-[#000033]/60 hover:text-[#000033] hover:bg-[#000033]/5 rounded-lg transition-all font-bold text-sm"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-[#fafafa] rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#024fff]/10 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-[#024fff]">
                    {responsable ? responsable.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : '—'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold text-[#000033]">{responsable?.name ?? 'Sin responsable'}</p>
                  <p className="text-xs text-[#000033]/60">Responsable principal</p>
                </div>
              </div>
              <button
                onClick={() => { setNuevoOwnerId(client?.ownerId ?? ''); setEditandoResponsable(true); }}
                className="flex items-center gap-2 px-3 py-2 text-[#024fff] hover:bg-[#024fff]/10 rounded-lg transition-all font-bold text-sm"
              >
                <Edit3 className="w-4 h-4" /> Cambiar
              </button>
            </div>
          )}
        </div>

        {/* Pilares de contenido */}
        <div className="bg-white border-2 border-[#000033]/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-[#024fff]" />
              <h2 className="text-xs font-bold text-[#000033] uppercase tracking-wider">Pilares de contenido</h2>
              <span className="text-xs text-[#000033]/50">({pilares.length})</span>
            </div>
            <button
              onClick={() => setShowNuevoPilar(true)}
              className="flex items-center gap-2 px-3 py-2 bg-[#024fff] text-white rounded-lg hover:bg-[#024fff]/90 transition-all font-bold text-sm shadow-lg shadow-[#024fff]/20"
            >
              <Plus className="w-4 h-4" /> Agregar pilar
            </button>
          </div>

          <div className="space-y-3">
            {pilares.length === 0 && !showNuevoPilar && (
              <div className="text-center py-10">
                <div className="w-14 h-14 bg-[#024fff]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Target className="w-7 h-7 text-[#024fff]" />
                </div>
                <p className="text-sm font-bold text-[#000033] mb-1">Sin pilares definidos</p>
                <p className="text-xs text-[#000033]/60 mb-4 max-w-xs mx-auto">
                  Los pilares son los ejes temáticos desde los que se produce contenido para este cliente
                </p>
                <button
                  onClick={() => setShowNuevoPilar(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#024fff] text-white rounded-lg hover:bg-[#024fff]/90 transition-all font-bold text-sm shadow-lg shadow-[#024fff]/20"
                >
                  <Plus className="w-4 h-4" /> Agregar primer pilar
                </button>
              </div>
            )}

            {pilares.map(pilar => (
              <div key={pilar.id} className="border-2 border-[#000033]/10 rounded-lg p-4 hover:border-[#024fff]/20 transition-all">
                {editandoPilarId === pilar.id && pilarEditado ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={pilarEditado.nombre}
                      onChange={e => setPilarEditado({ ...pilarEditado, nombre: e.target.value })}
                      placeholder="Nombre del pilar"
                      className="w-full px-3 py-2 border-2 border-[#024fff]/20 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033]"
                      autoFocus
                    />
                    <textarea
                      value={pilarEditado.descripcion ?? ''}
                      onChange={e => setPilarEditado({ ...pilarEditado, descripcion: e.target.value })}
                      placeholder="Descripción del pilar"
                      rows={3}
                      className="w-full px-3 py-2 border-2 border-[#024fff]/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033] resize-none"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updatePilarMutation.mutate({ id: pilar.id, nombre: pilarEditado.nombre, descripcion: pilarEditado.descripcion ?? '' })}
                        disabled={!pilarEditado.nombre.trim() || updatePilarMutation.isPending}
                        className="flex items-center gap-2 px-3 py-2 bg-[#024fff] text-white rounded-lg hover:bg-[#024fff]/90 transition-all font-bold text-sm disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" /> Guardar
                      </button>
                      <button
                        onClick={() => { setEditandoPilarId(null); setPilarEditado(null); }}
                        className="px-3 py-2 text-[#000033]/60 hover:text-[#000033] hover:bg-[#000033]/5 rounded-lg transition-all font-bold text-sm"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-[#000033] mb-1">{pilar.nombre}</h3>
                      {pilar.descripcion && (
                        <p className="text-xs text-[#000033]/60 leading-relaxed">{pilar.descripcion}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditandoPilarId(pilar.id); setPilarEditado({ ...pilar }); }}
                        className="p-2 text-[#024fff] hover:bg-[#024fff]/10 rounded-lg transition-all"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deletePilarMutation.mutate(pilar.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Form nuevo pilar */}
            {showNuevoPilar && (
              <div className="border-2 border-[#024fff]/20 rounded-lg p-4 bg-[#024fff]/5">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-[#000033] mb-1.5">
                      Nombre del pilar <span className="text-[#024fff]">*</span>
                    </label>
                    <input
                      type="text"
                      value={nuevoPilar.nombre}
                      onChange={e => setNuevoPilar({ ...nuevoPilar, nombre: e.target.value })}
                      placeholder="Ej: Liderazgo técnico, Cultura de producto..."
                      className="w-full px-3 py-2 border-2 border-[#000033]/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033]"
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && nuevoPilar.nombre.trim() && createPilarMutation.mutate({ nombre: nuevoPilar.nombre.trim(), descripcion: nuevoPilar.descripcion.trim() })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#000033] mb-1.5">
                      Descripción <span className="font-normal text-[#000033]/40">(opcional)</span>
                    </label>
                    <textarea
                      value={nuevoPilar.descripcion}
                      onChange={e => setNuevoPilar({ ...nuevoPilar, descripcion: e.target.value })}
                      placeholder="Describe brevemente de qué trata este pilar..."
                      rows={3}
                      className="w-full px-3 py-2 border-2 border-[#000033]/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033] resize-none"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => createPilarMutation.mutate({ nombre: nuevoPilar.nombre.trim(), descripcion: nuevoPilar.descripcion.trim() })}
                      disabled={!nuevoPilar.nombre.trim() || createPilarMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-[#024fff] text-white rounded-lg hover:bg-[#024fff]/90 transition-all font-bold text-sm shadow-lg shadow-[#024fff]/20 disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" /> Agregar pilar
                    </button>
                    <button
                      onClick={() => { setShowNuevoPilar(false); setNuevoPilar({ nombre: '', descripcion: '' }); }}
                      className="px-4 py-2 text-[#000033]/60 hover:text-[#000033] hover:bg-[#000033]/5 rounded-lg transition-all font-bold text-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export function ClienteDetallePage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('brand');

  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.getClients(),
  });

  const cliente = clientsData?.data.find((c: any) => c.id === clientId);

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <div className="bg-white border-b-2 border-[#000033]/10 px-8 py-0 sticky top-0 z-10">
        <div className="max-w-[900px] mx-auto">
          {/* Breadcrumb + info */}
          <div className="flex items-center gap-3 pt-5 pb-3">
            <button
              onClick={() => navigate('/clientes')}
              className="flex items-center gap-2 text-[#024fff] hover:text-[#024fff]/80 font-bold text-sm transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Clientes
            </button>
            <span className="text-[#000033]/30">/</span>
            <span className="text-[#000033] font-bold text-sm">{cliente?.name ?? '...'}</span>
            {cliente?.canales?.length > 0 && (
              <>
                <span className="text-[#000033]/20">·</span>
                <div className="flex items-center gap-1">
                  {cliente.canales.map((c: string) => (
                    <span key={c} className="px-1.5 py-0.5 bg-[#000033]/5 text-[#000033]/60 text-xs font-bold rounded">
                      {c === 'LinkedIn' ? 'in' : c === 'Instagram' ? 'ig' : c === 'Twitter/X' ? 'x' : c.slice(0, 2).toLowerCase()}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 -mb-[2px]">
            <button
              onClick={() => setTab('brand')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-bold transition-all border-b-2 ${
                tab === 'brand'
                  ? 'text-[#024fff] border-[#024fff]'
                  : 'text-[#000033]/60 border-transparent hover:text-[#000033]'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Brand Kit
            </button>
            <button
              onClick={() => setTab('canales')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-bold transition-all border-b-2 ${
                tab === 'canales'
                  ? 'text-[#024fff] border-[#024fff]'
                  : 'text-[#000033]/60 border-transparent hover:text-[#000033]'
              }`}
            >
              <Radio className="w-4 h-4" />
              Canales
            </button>
            <button
              onClick={() => setTab('voceros')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-bold transition-all border-b-2 ${
                tab === 'voceros'
                  ? 'text-[#024fff] border-[#024fff]'
                  : 'text-[#000033]/60 border-transparent hover:text-[#000033]'
              }`}
            >
              <Mic className="w-4 h-4" />
              Voceros
            </button>
            <button
              onClick={() => setTab('gestion')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-bold transition-all border-b-2 ${
                tab === 'gestion'
                  ? 'text-[#024fff] border-[#024fff]'
                  : 'text-[#000033]/60 border-transparent hover:text-[#000033]'
              }`}
            >
              <Settings className="w-4 h-4" />
              Gestión
            </button>
          </div>
        </div>
      </div>

      {/* Tab content */}
      {tab === 'brand' && clientId && <BrandKitTab clientId={clientId} />}
      {tab === 'voceros' && clientId && <VocerosPage clientId={clientId} />}
      {tab === 'canales' && clientId && <CanalesTab clientId={clientId} />}
      {tab === 'gestion' && clientId && <GestionTab clientId={clientId} />}
    </div>
  );
}
