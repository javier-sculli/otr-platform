import { useState } from 'react';
import {
  Plus, X, ArrowLeft, Save, Trash2,
  Linkedin, Instagram, Twitter,
  Mail, BookOpen, Video, ExternalLink, Mic, Check, AlertCircle,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Toggle } from '../components/Toggle';

interface Speaker {
  id: string;
  clientId: string;
  nombre: string;
  cargo: string | null;
  linkedinUrl: string | null;
  instagramUrl: string | null;
  twitterUrl: string | null;
  tiktokUrl: string | null;
  newsletterUrl: string | null;
  blogUrl: string | null;
  canalesHabilitados: Record<string, boolean>;
  personalidadArquetipo: string | null;
  tonoVozPersonal: string | null;
  contextoExperiencia: string | null;
  temasHabla: string | null;
  posicionamientoOpinion: string | null;
  estructuraNarrativa: string | null;
  usoIdioma: string | null;
  criteriosCalidad: string | null;
  contextoMarca: string | null;
}

const CAMPOS_VOZ = [
  { id: 'personalidadArquetipo', titulo: 'Personalidad y arquetipo', placeholder: 'Ej: Líder visionario con enfoque práctico...' },
  { id: 'tonoVozPersonal', titulo: 'Tono y voz personal', placeholder: 'Cómo habla, registro, nivel de formalidad, expresiones propias...' },
  { id: 'contextoExperiencia', titulo: 'Contexto y experiencia', placeholder: 'Trayectoria, industria, rol actual, logros relevantes...' },
  { id: 'temasHabla', titulo: 'De qué temas habla', placeholder: 'Listado de temáticas o áreas de contenido del vocero...' },
  { id: 'posicionamientoOpinion', titulo: 'Posicionamiento y opinión', placeholder: 'Puntos de vista diferenciadores, postura frente a temas de la industria...' },
  { id: 'estructuraNarrativa', titulo: 'Estructura narrativa', placeholder: 'Ej: Hook personal → Aprendizaje → Aplicación práctica → CTA reflexivo...' },
  { id: 'usoIdioma', titulo: 'Uso del idioma', placeholder: 'Expresiones propias, giros lingüísticos, palabras que usa o evita...' },
  { id: 'criteriosCalidad', titulo: 'Criterios de calidad', placeholder: 'Qué hace que un texto suene a él/ella y qué lo invalida...' },
  { id: 'contextoMarca', titulo: 'Contexto de la marca', placeholder: 'Cómo se relaciona este vocero con el cliente: rol, mensaje alineado...' },
] as const;

type CampoId = typeof CAMPOS_VOZ[number]['id'];

function estadoVocero(s: Speaker): 'completo' | 'borrador' {
  const filled = CAMPOS_VOZ.filter(c => (s[c.id] ?? '').trim().length > 0).length;
  return filled >= 6 ? 'completo' : 'borrador';
}

function iniciales(nombre: string) {
  return nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function VocerosPage({ clientId }: { clientId: string }) {
  const [vistaDetalle, setVistaDetalle] = useState<string | null>(null);
  const [showDialogNuevo, setShowDialogNuevo] = useState(false);

  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['speakers', clientId],
    queryFn: () => api.getSpeakers(clientId),
  });

  const createMutation = useMutation({
    mutationFn: (datos: { nombre: string; cargo: string; linkedinUrl: string }) =>
      api.createSpeaker(clientId, datos),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['speakers', clientId] });
      setShowDialogNuevo(false);
      setVistaDetalle(res.data.id);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (speakerId: string) => api.deleteSpeaker(clientId, speakerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['speakers', clientId] });
      setVistaDetalle(null);
    },
  });

  const speakers: Speaker[] = data?.data ?? [];
  const speakerActual = speakers.find(s => s.id === vistaDetalle);

  if (isLoading) {
    return <div className="flex items-center justify-center py-16 text-[#000033]/60 text-sm">Cargando...</div>;
  }

  if (vistaDetalle && speakerActual) {
    return (
      <DetalleVocero
        speaker={speakerActual}
        clientId={clientId}
        onVolver={() => setVistaDetalle(null)}
        onDelete={() => deleteMutation.mutate(speakerActual.id)}
        isDeleting={deleteMutation.isPending}
      />
    );
  }

  const completados = speakers.filter(s => estadoVocero(s) === 'completo').length;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="bg-white border-b-2 border-[#000033]/10 px-8 py-6">
        <div className="max-w-[900px] mx-auto flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#000033] mb-0.5">Voceros</h2>
            <p className="text-xs text-[#000033]/60">
              {speakers.length} {speakers.length === 1 ? 'vocero' : 'voceros'} · {completados} con kit completo
            </p>
          </div>
          <button
            onClick={() => setShowDialogNuevo(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#024fff] text-white rounded-lg hover:bg-[#024fff]/90 transition-all font-bold text-sm shadow-lg shadow-[#024fff]/20"
          >
            <Plus className="w-4 h-4" />
            Nuevo vocero
          </button>
        </div>
      </div>

      <div className="max-w-[900px] mx-auto px-8 py-8">
        {speakers.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-[#024fff]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mic className="w-8 h-8 text-[#024fff]" />
            </div>
            <h3 className="text-base font-bold text-[#000033] mb-2">Sin voceros cargados</h3>
            <p className="text-xs text-[#000033]/60 mb-6">
              Creá el primero para armar su kit de voz
            </p>
            <button
              onClick={() => setShowDialogNuevo(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#024fff] text-white rounded-lg hover:bg-[#024fff]/90 transition-all font-bold text-sm shadow-lg shadow-[#024fff]/20"
            >
              <Plus className="w-4 h-4" />
              Nuevo vocero
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {speakers.map(speaker => {
              const estado = estadoVocero(speaker);
              return (
                <div
                  key={speaker.id}
                  onClick={() => setVistaDetalle(speaker.id)}
                  className="bg-white border-2 border-[#000033]/10 rounded-xl p-5 hover:border-[#024fff]/40 transition-all hover:shadow-lg cursor-pointer group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-[#024fff]/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-[#024fff]">{iniciales(speaker.nombre)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-base font-bold text-[#000033]">{speaker.nombre}</h3>
                        <ExternalLink className="w-3.5 h-3.5 text-[#000033]/30 group-hover:text-[#024fff] transition-colors" />
                      </div>
                      {speaker.cargo && (
                        <p className="text-xs text-[#000033]/60 mb-2">{speaker.cargo}</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border-2 ${
                          estado === 'completo'
                            ? 'bg-[#00ff99]/10 text-[#000033] border-[#00ff99]/30'
                            : 'bg-[#000033]/5 text-[#000033]/60 border-[#000033]/10'
                        }`}>
                          {estado === 'completo' ? 'Completo' : 'Borrador'}
                        </span>
                        {speaker.linkedinUrl && (
                          <span className="px-2.5 py-1 bg-[#024fff]/5 text-[#024fff] text-xs font-bold rounded-lg border border-[#024fff]/20 flex items-center gap-1">
                            <Linkedin className="w-3 h-3" /> LinkedIn
                          </span>
                        )}
                        {speaker.instagramUrl && (
                          <span className="px-2.5 py-1 bg-pink-50 text-pink-600 text-xs font-bold rounded-lg border border-pink-200 flex items-center gap-1">
                            <Instagram className="w-3 h-3" /> Instagram
                          </span>
                        )}
                        {speaker.twitterUrl && (
                          <span className="px-2.5 py-1 bg-[#000033]/5 text-[#000033] text-xs font-bold rounded-lg border border-[#000033]/10 flex items-center gap-1">
                            <Twitter className="w-3 h-3" /> X
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              onClick={() => setShowDialogNuevo(true)}
              className="w-full border-2 border-dashed border-[#000033]/20 rounded-xl p-5 hover:border-[#024fff]/40 hover:bg-[#024fff]/5 transition-all text-[#000033]/60 hover:text-[#024fff] font-bold text-sm flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Agregar otro vocero
            </button>
          </div>
        )}
      </div>

      {showDialogNuevo && (
        <DialogNuevoVocero
          onClose={() => setShowDialogNuevo(false)}
          onCreate={(datos) => createMutation.mutate(datos)}
          isLoading={createMutation.isPending}
        />
      )}
    </div>
  );
}

function DialogNuevoVocero({
  onClose, onCreate, isLoading,
}: {
  onClose: () => void;
  onCreate: (datos: { nombre: string; cargo: string; linkedinUrl: string }) => void;
  isLoading: boolean;
}) {
  const [nombre, setNombre] = useState('');
  const [cargo, setCargo] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[#000033]">Nuevo vocero</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-[#000033]/5 hover:bg-[#000033]/10 flex items-center justify-center transition-all">
            <X className="w-5 h-5 text-[#000033]" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#000033] mb-2">
              Nombre <span className="text-[#024fff]">*</span>
            </label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Juan Martínez"
              className="w-full px-4 py-3 border-2 border-[#000033]/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033]"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && nombre.trim() && onCreate({ nombre: nombre.trim(), cargo: cargo.trim(), linkedinUrl: '' })}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#000033] mb-2">
              Cargo/Rol <span className="text-[#000033]/40 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={cargo}
              onChange={e => setCargo(e.target.value)}
              placeholder="CEO & Co-founder"
              className="w-full px-4 py-3 border-2 border-[#000033]/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033]"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-[#000033]/10">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-[#000033]/60 hover:text-[#000033] transition-all">
            Cancelar
          </button>
          <button
            onClick={() => nombre.trim() && onCreate({ nombre: nombre.trim(), cargo: cargo.trim(), linkedinUrl: '' })}
            disabled={!nombre.trim() || isLoading}
            className="px-5 py-2 bg-[#024fff] text-white rounded-lg hover:bg-[#024fff]/90 transition-all font-bold text-sm shadow-lg shadow-[#024fff]/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Creando...' : 'Crear vocero'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetalleVocero({
  speaker, clientId, onVolver, onDelete, isDeleting,
}: {
  speaker: Speaker;
  clientId: string;
  onVolver: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const queryClient = useQueryClient();
  const [local, setLocal] = useState<Speaker>({ ...speaker });
  const [hasChanges, setHasChanges] = useState(false);
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, any> = {
        nombre: local.nombre,
        cargo: local.cargo,
        linkedinUrl: local.linkedinUrl,
        instagramUrl: local.instagramUrl,
        twitterUrl: local.twitterUrl,
        tiktokUrl: local.tiktokUrl,
        newsletterUrl: local.newsletterUrl,
        blogUrl: local.blogUrl,
        canalesHabilitados: local.canalesHabilitados,
      };
      for (const c of CAMPOS_VOZ) payload[c.id] = local[c.id];
      return api.updateSpeaker(clientId, speaker.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['speakers', clientId] });
      setHasChanges(false);
    },
  });

  const update = (field: string, value: any) => {
    setLocal(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const toggleCanal = (canal: string) => {
    const enabled = !local.canalesHabilitados[canal];
    setLocal(prev => ({
      ...prev,
      canalesHabilitados: { ...prev.canalesHabilitados, [canal]: enabled },
      ...((!enabled) ? { [`${canal}Url`]: null } : {}),
    }));
    setHasChanges(true);
  };

  const camposLlenos = CAMPOS_VOZ.filter(c => local[c.id]?.trim?.()).length;
  const estado = camposLlenos >= 6 ? 'completo' : 'borrador';

  const CANALES = [
    { key: 'linkedin', label: 'LinkedIn (personal)', field: 'linkedinUrl', icon: <Linkedin className="w-5 h-5 text-[#024fff]" />, bg: 'bg-[#024fff]/10', placeholder: 'https://linkedin.com/in/...' },
    { key: 'instagram', label: 'Instagram', field: 'instagramUrl', icon: <Instagram className="w-5 h-5 text-pink-600" />, bg: 'bg-pink-100', placeholder: 'https://instagram.com/...' },
    { key: 'twitter', label: 'X / Twitter', field: 'twitterUrl', icon: <Twitter className="w-5 h-5 text-[#000033]" />, bg: 'bg-[#000033]/10', placeholder: 'https://x.com/...' },
    { key: 'tiktok', label: 'TikTok (opcional)', field: 'tiktokUrl', icon: <Video className="w-5 h-5 text-white" />, bg: 'bg-[#000033]', placeholder: 'https://tiktok.com/@...' },
    { key: 'newsletter', label: 'Newsletter (opcional)', field: 'newsletterUrl', icon: <Mail className="w-5 h-5 text-[#00cc77]" />, bg: 'bg-[#00ff99]/20', placeholder: 'https://...' },
    { key: 'blog', label: 'Blog (opcional)', field: 'blogUrl', icon: <BookOpen className="w-5 h-5 text-[#00cc77]" />, bg: 'bg-[#00ff99]/20', placeholder: 'https://...' },
  ] as const;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <div className="bg-white border-b-2 border-[#000033]/10 px-8 py-5 sticky top-0 z-10">
        <div className="max-w-[900px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onVolver}
              className="flex items-center gap-2 text-[#024fff] hover:text-[#024fff]/80 font-bold text-sm transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Voceros
            </button>
            <div className="w-px h-5 bg-[#000033]/10" />
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-[#000033]">{local.nombre}</h1>
              <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border-2 ${
                estado === 'completo'
                  ? 'bg-[#00ff99]/10 text-[#000033] border-[#00ff99]/30'
                  : 'bg-[#000033]/5 text-[#000033]/60 border-[#000033]/10'
              }`}>
                {estado === 'completo' ? 'Completo' : 'Borrador'}
              </span>
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
            {confirmarBorrar ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#000033]/60">¿Borrar vocero?</span>
                <button
                  onClick={onDelete}
                  disabled={isDeleting}
                  className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-all disabled:opacity-50"
                >
                  {isDeleting ? '...' : 'Sí, borrar'}
                </button>
                <button
                  onClick={() => setConfirmarBorrar(false)}
                  className="px-3 py-1.5 border-2 border-[#000033]/10 rounded-lg text-xs font-bold text-[#000033]/60 hover:bg-[#000033]/5 transition-all"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmarBorrar(true)}
                className="p-2 border-2 border-[#000033]/10 rounded-lg text-[#000033]/40 hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!hasChanges || saveMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-[#024fff] text-white rounded-lg hover:bg-[#024fff]/90 transition-all font-bold text-sm shadow-lg shadow-[#024fff]/20 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[900px] mx-auto px-8 py-6 space-y-4">
        {/* Datos del vocero */}
        <div className="bg-white border-2 border-[#000033]/10 rounded-xl p-6">
          <h2 className="text-xs font-bold text-[#000033]/50 uppercase tracking-wider mb-5">Datos del vocero</h2>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs font-bold text-[#000033]/60 uppercase mb-2">Nombre</label>
              <input
                type="text"
                value={local.nombre}
                onChange={e => update('nombre', e.target.value)}
                className="w-full px-3 py-2 border-2 border-[#000033]/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#000033]/60 uppercase mb-2">Cargo/Rol</label>
              <input
                type="text"
                value={local.cargo ?? ''}
                onChange={e => update('cargo', e.target.value)}
                placeholder="CEO & Co-founder"
                className="w-full px-3 py-2 border-2 border-[#000033]/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033]"
              />
            </div>
          </div>

          {/* Canales del vocero */}
          <div>
            <label className="block text-xs font-bold text-[#000033]/60 uppercase mb-4">Canales del vocero</label>
            <div className="space-y-4">
              {CANALES.map(canal => (
                <div key={canal.key} className="flex items-start gap-3">
                  <div className={`w-9 h-9 ${canal.bg} rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    {canal.icon}
                  </div>
                  <div className="flex-1">
                    <div className="mb-1.5">
                      <Toggle
                        checked={!!local.canalesHabilitados[canal.key]}
                        onChange={() => toggleCanal(canal.key)}
                        label={canal.label}
                      />
                    </div>
                    {local.canalesHabilitados[canal.key] && (
                      <input
                        type="url"
                        value={(local[canal.field as keyof Speaker] as string) ?? ''}
                        onChange={e => update(canal.field, e.target.value)}
                        placeholder={canal.placeholder}
                        className="w-full px-3 py-2 border-2 border-[#000033]/10 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033]"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Voz del Vocero */}
        <div className="bg-white border-2 border-[#000033]/10 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#000033]/8">
            <div className="flex items-center gap-2">
              <Mic className="w-4 h-4 text-[#024fff]" />
              <h2 className="text-xs font-bold text-[#000033]/50 uppercase tracking-wider">Voz del Vocero</h2>
              <span className="text-xs text-[#000033]/50">({camposLlenos}/{CAMPOS_VOZ.length} completados)</span>
            </div>
            {/* Progress bar */}
            <div className="mt-3 h-1 bg-[#000033]/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#024fff] rounded-full transition-all duration-500"
                style={{ width: `${(camposLlenos / CAMPOS_VOZ.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="divide-y divide-[#000033]/8">
            {CAMPOS_VOZ.map((campo, index) => {
              const value = local[campo.id as CampoId] ?? '';

              return (
                <div key={campo.id} className="px-6 py-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold text-[#000033]/30 w-5 text-right">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="font-bold text-[#000033] text-sm">{campo.titulo}</span>
                  </div>
                  <textarea
                    value={value}
                    onChange={e => update(campo.id, e.target.value)}
                    placeholder={campo.placeholder}
                    rows={5}
                    className="w-full px-3 py-3 border-2 border-[#000033]/10 rounded-lg text-sm text-[#000033] placeholder-[#000033]/25 bg-[#fafafa] focus:outline-none focus:border-[#024fff] focus:bg-white resize-none transition-colors leading-relaxed"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
