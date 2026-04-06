import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Save, Link2, Calendar, FileText, TrendingUp,
  Star, Plus, MessageSquare, Heart, Share2, Tag, ExternalLink,
} from 'lucide-react';
import { api } from '../lib/api';

export function PublicationDetailPage() {
  const { publicationId } = useParams<{ publicationId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['publication', publicationId],
    queryFn: () => api.getPublication(publicationId!),
    enabled: !!publicationId,
  });

  const pub = data?.data;

  // Form state
  const [url, setUrl] = useState('');
  const [canal, setCanal] = useState('LinkedIn');
  const [publishedAt, setPublishedAt] = useState('');
  const [isHighlight, setIsHighlight] = useState(false);
  const [tagsInput, setTagsInput] = useState('');
  const [nota, setNota] = useState('');

  // Snapshots editables
  const [snapshots, setSnapshots] = useState<{ dayNumber: number; likes: string; comments: string; shares: string }[]>([]);

  useEffect(() => {
    if (!pub) return;
    setUrl(pub.url ?? '');
    setCanal(pub.canal ?? 'LinkedIn');
    setPublishedAt(pub.publishedAt ? pub.publishedAt.slice(0, 10) : '');
    setIsHighlight(pub.isHighlight ?? false);
    setTagsInput(pub.tags?.join(', ') ?? '');
    setNota(pub.insights ?? '');
    setSnapshots(
      (pub.snapshots ?? []).map((s: any) => ({
        dayNumber: s.dayNumber,
        likes: String(s.likes),
        comments: String(s.comments),
        shares: String(s.shares),
      }))
    );
  }, [pub?.id]);

  const updateMutation = useMutation({
    mutationFn: (patch: any) => api.updatePublication(publicationId!, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['publication', publicationId] }),
  });

  const snapshotMutation = useMutation({
    mutationFn: ({ dayNumber, likes, comments, shares }: any) =>
      api.upsertSnapshot(publicationId!, { dayNumber, likes: Number(likes), comments: Number(comments), shares: Number(shares) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['publication', publicationId] }),
  });

  const handleGuardar = async () => {
    // Guarda datos del post e insight
    await updateMutation.mutateAsync({
      url,
      canal,
      publishedAt,
      isHighlight,
      tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
      insights: nota,
    });

    // Guarda cada snapshot modificado
    for (const s of snapshots) {
      await snapshotMutation.mutateAsync(s);
    }
  };

  const handleAgregarMedicion = () => {
    const nextDay = snapshots.length > 0
      ? Math.min(snapshots[snapshots.length - 1].dayNumber + 1, 98)
      : 1;
    setSnapshots(prev => [...prev, { dayNumber: nextDay, likes: '0', comments: '0', shares: '0' }]);
  };

  const updateSnapshot = (idx: number, field: 'likes' | 'comments' | 'shares', value: string) => {
    setSnapshots(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const dayLabel = (day: number) => day === 99 ? 'Final' : `Día ${day}`;

  const isPending = updateMutation.isPending || snapshotMutation.isPending;

  if (isLoading) {
    return <div className="min-h-[calc(100vh-64px)] flex items-center justify-center text-sm text-[#000033]/40">Cargando...</div>;
  }
  if (isError || !pub) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-[#000033]/40">No se pudo cargar la publicación.</p>
        <button onClick={() => navigate('/performance')} className="text-xs font-bold text-[#024fff] hover:underline">Volver al listado</button>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#fafafa]">
      <div className="max-w-[1200px] mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/performance')}
            className="flex items-center gap-2 text-[#000033]/60 hover:text-[#000033] mb-4 transition-colors font-medium text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al listado
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-[#000033] mb-2">Publicación & Performance</h1>
              <p className="text-[#000033]/60">Esta pantalla no busca analizar, sino registrar aprendizaje</p>
            </div>
            <button
              onClick={handleGuardar}
              disabled={isPending}
              className="flex items-center gap-2 px-6 py-3 bg-[#024fff] text-white rounded-xl hover:bg-[#024fff]/90 transition-all font-medium shadow-lg shadow-[#024fff]/20 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {isPending ? 'Guardando...' : 'Guardar datos'}
            </button>
          </div>
        </div>

        {/* Bloque 1 - Publicación */}
        <div className="bg-white rounded-xl border-2 border-[#000033]/10 shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-[#024fff]/10 rounded-xl flex items-center justify-center">
              <Link2 className="w-5 h-5 text-[#024fff]" />
            </div>
            <h2 className="text-xl font-bold text-[#000033]">Publicación</h2>
          </div>

          <div className="bg-[#024fff]/5 border-2 border-[#024fff]/20 rounded-xl p-4 mb-5 flex items-center justify-between">
            <p className="text-sm text-[#000033] font-medium">Link del post publicado</p>
            <a href={pub.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-[#024fff] font-medium hover:underline">
              Ver en LinkedIn <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="space-y-5">
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-[#000033] mb-2">
                <Link2 className="w-4 h-4" /> URL del post
              </label>
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://linkedin.com/posts/..."
                className="w-full px-4 py-2.5 border-2 border-[#000033]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#024fff] focus:border-transparent text-[#000033] placeholder:text-[#000033]/40 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-[#000033] mb-2">
                  <FileText className="w-4 h-4" /> Canal
                </label>
                <select
                  value={canal}
                  onChange={e => setCanal(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-[#000033]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#024fff] focus:border-transparent bg-white text-[#000033] text-sm"
                >
                  <option>LinkedIn</option>
                  <option>Instagram</option>
                  <option>Twitter</option>
                  <option>Facebook</option>
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-[#000033] mb-2">
                  <Calendar className="w-4 h-4" /> Fecha de publicación
                </label>
                <input
                  type="date"
                  value={publishedAt}
                  onChange={e => setPublishedAt(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-[#000033]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#024fff] focus:border-transparent text-[#000033] text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bloque 2 - Métricas */}
        <div className="bg-white rounded-xl border-2 border-[#000033]/10 shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#00ff99]/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[#000033]" />
            </div>
            <h2 className="text-xl font-bold text-[#000033]">Métricas (Snapshots)</h2>
          </div>

          <div className="border-2 border-[#000033]/10 rounded-xl overflow-hidden">
            {/* Header tabla */}
            <div className="grid grid-cols-4 bg-[#000033]/[0.03] border-b-2 border-[#000033]/10">
              <div className="px-5 py-4 text-xs font-bold text-[#000033] uppercase tracking-wider">Momento</div>
              <div className="px-5 py-4 text-xs font-bold text-[#000033] uppercase tracking-wider flex items-center gap-2">
                <Heart className="w-4 h-4" /> Likes
              </div>
              <div className="px-5 py-4 text-xs font-bold text-[#000033] uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Comentarios
              </div>
              <div className="px-5 py-4 text-xs font-bold text-[#000033] uppercase tracking-wider flex items-center gap-2">
                <Share2 className="w-4 h-4" /> Compartidos
              </div>
            </div>

            {snapshots.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-[#000033]/30 italic">
                Sin métricas registradas — el sync automático las irá cargando, o agregá una medición manual.
              </div>
            )}

            {snapshots.map((s, idx) => (
              <div key={idx} className="grid grid-cols-4 border-b-2 border-[#000033]/10 last:border-b-0 hover:bg-[#000033]/[0.02] transition-colors">
                <div className="px-5 py-4 text-sm text-[#000033] font-bold flex items-center">{dayLabel(s.dayNumber)}</div>
                <div className="px-5 py-4">
                  <input
                    type="text"
                    value={s.likes}
                    onChange={e => updateSnapshot(idx, 'likes', e.target.value)}
                    className="w-24 px-3 py-2 border-2 border-[#000033]/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#024fff] focus:border-transparent text-[#000033]"
                  />
                </div>
                <div className="px-5 py-4">
                  <input
                    type="text"
                    value={s.comments}
                    onChange={e => updateSnapshot(idx, 'comments', e.target.value)}
                    className="w-24 px-3 py-2 border-2 border-[#000033]/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#024fff] focus:border-transparent text-[#000033]"
                  />
                </div>
                <div className="px-5 py-4">
                  <input
                    type="text"
                    value={s.shares}
                    onChange={e => updateSnapshot(idx, 'shares', e.target.value)}
                    className="w-24 px-3 py-2 border-2 border-[#000033]/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#024fff] focus:border-transparent text-[#000033]"
                  />
                </div>
              </div>
            ))}

            <div className="px-5 py-4 bg-[#000033]/[0.02] border-t-2 border-[#000033]/10">
              <button
                onClick={handleAgregarMedicion}
                className="flex items-center gap-2 text-sm text-[#024fff] hover:text-[#024fff]/80 font-bold"
              >
                <Plus className="w-4 h-4" /> Agregar medición
              </button>
            </div>
          </div>
        </div>

        {/* Bloque 3 - Insight manual */}
        <div className="bg-white rounded-xl border-2 border-[#000033]/10 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#00ff99]/20 rounded-xl flex items-center justify-center">
              <Star className="w-5 h-5 text-[#000033]" />
            </div>
            <h2 className="text-xl font-bold text-[#000033]">Insight manual</h2>
          </div>

          <div className="space-y-5">
            <div className="flex items-center gap-3 p-4 bg-[#000033]/[0.02] rounded-xl border-2 border-[#000033]/10">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isHighlight}
                  onChange={e => setIsHighlight(e.target.checked)}
                  className="w-5 h-5 text-[#024fff] border-2 border-[#000033]/20 rounded focus:ring-[#024fff]"
                />
                <span className="text-sm font-bold text-[#000033]">Contenido destacado</span>
              </label>
              <span className="text-xs text-[#000033]/60 ml-auto">Marca si este contenido tuvo un impacto notable</span>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-[#000033] mb-2">
                <Tag className="w-4 h-4" /> Tags
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                placeholder="Ej: autoridad / research / banal"
                className="w-full px-4 py-2.5 border-2 border-[#000033]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#024fff] focus:border-transparent text-[#000033] placeholder:text-[#000033]/40 text-sm"
              />
              <p className="text-xs text-[#000033]/60 mt-2">Separar con comas para categorizar el tipo de contenido</p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-[#000033] mb-2">
                <FileText className="w-4 h-4" /> Nota
              </label>
              <textarea
                rows={4}
                value={nota}
                onChange={e => setNota(e.target.value)}
                placeholder="Por qué creemos que funcionó o no..."
                className="w-full px-4 py-2.5 border-2 border-[#000033]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#024fff] focus:border-transparent resize-none text-[#000033] placeholder:text-[#000033]/40 text-sm"
              />
              <p className="text-xs text-[#000033]/60 mt-2">Explica por qué crees que este contenido funcionó o no funcionó</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
