import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp, RefreshCw, CheckCircle2, AlertCircle,
  Heart, MessageSquare, Share2, Star,
  ArrowUpDown, ChevronDown, ChevronUp,
  Linkedin, Instagram, Facebook, Twitter, Globe, X,
} from 'lucide-react';
import { api } from '../lib/api';

type SortKey = 'fecha' | 'likes' | 'comments' | 'shares';
type SortDir = 'asc' | 'desc';

const CANAL_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  linkedin:  { icon: Linkedin,  color: '#0077B5' },
  instagram: { icon: Instagram, color: '#E4405F' },
  facebook:  { icon: Facebook,  color: '#1877F2' },
  twitter:   { icon: Twitter,   color: '#1DA1F2' },
};

function getCanalConfig(canal?: string) {
  const key = (canal ?? '').toLowerCase();
  return CANAL_CONFIG[key] ?? { icon: Globe, color: '#000033' };
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return {
    main: d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
    year: d.getFullYear().toString(),
  };
}

function formatDayTime(dateStr: string) {
  const d = new Date(dateStr);
  const dia = d.toLocaleDateString('es-ES', { weekday: 'short' });
  const hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
  return { dia: dia.replace('.', ''), hora };
}

function formatNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function PerformancePage() {
  const queryClient = useQueryClient();
  const [syncStatus, setSyncStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [clientesSeleccionados, setClientesSeleccionados] = useState<string[]>([]);
  const [showDropdownClientes, setShowDropdownClientes] = useState(false);
  const [vocerosSeleccionados, setVocerosSeleccionados] = useState<string[]>([]);
  const [showDropdownVoceros, setShowDropdownVoceros] = useState(false);
  const [filtroFecha, setFiltroFecha] = useState<'semana' | 'mes' | 'rango' | null>(null);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [canalesSeleccionados, setCanalesSeleccionados] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('fecha');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.getClients(),
  });

  const { data: speakersData } = useQuery({
    queryKey: ['speakers'],
    queryFn: () => api.getAllSpeakers(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => api.getMetrics(),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.syncMetrics(),
    onMutate: () => setSyncStatus('running'),
    onSuccess: () => {
      setSyncStatus('done');
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['metrics'] });
        setSyncStatus('idle');
      }, 3000);
    },
    onError: () => {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 4000);
    },
  });

  const toggleHighlight = async (e: React.MouseEvent, pub: any) => {
    e.stopPropagation();
    await api.updatePublication(pub.id, { isHighlight: !pub.isHighlight });
    queryClient.invalidateQueries({ queryKey: ['metrics'] });
  };

  const publications: any[] = data?.data ?? [];
  const clients: any[] = clientsData?.data ?? [];
  const vocerosUnicos: any[] = speakersData?.data ?? [];

  const toggleCliente = (id: string) =>
    setClientesSeleccionados(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const toggleVocero = (id: string) =>
    setVocerosSeleccionados(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);

  const toggleCanal = (canal: string) =>
    setCanalesSeleccionados(prev => prev.includes(canal) ? prev.filter(c => c !== canal) : [...prev, canal]);

  const ahora = new Date();
  const inicioSemana = new Date(ahora); inicioSemana.setDate(ahora.getDate() - ahora.getDay());
  const finSemana = new Date(inicioSemana); finSemana.setDate(inicioSemana.getDate() + 6);
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);

  // Filtrar
  const filtered = publications.filter(pub => {
    if (clientesSeleccionados.length > 0 && !clientesSeleccionados.includes(pub.client?.id)) return false;
    if (vocerosSeleccionados.length > 0 && (!pub.speaker || !vocerosSeleccionados.includes(pub.speaker.id))) return false;
    if (canalesSeleccionados.length > 0 && !canalesSeleccionados.includes((pub.canal ?? '').toLowerCase())) return false;
    if (filtroFecha && pub.publishedAt) {
      const d = new Date(pub.publishedAt);
      if (filtroFecha === 'semana') return d >= inicioSemana && d <= finSemana;
      if (filtroFecha === 'mes') return d >= inicioMes && d <= finMes;
      if (filtroFecha === 'rango') {
        if (fechaDesde && d < new Date(fechaDesde)) return false;
        if (fechaHasta) { const hasta = new Date(fechaHasta); hasta.setHours(23, 59, 59); if (d > hasta) return false; }
      }
    }
    return true;
  });

  // Ordenar
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'fecha') {
      cmp = new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
    } else {
      const aSnap = a.snapshots?.slice(-1)[0];
      const bSnap = b.snapshots?.slice(-1)[0];
      cmp = (aSnap?.[sortKey] ?? 0) - (bSnap?.[sortKey] ?? 0);
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3" />
      : <ChevronDown className="w-3 h-3" />;
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-[#fafafa]">

      {/* Header */}
      <div className="bg-white border-b-2 border-[#000033]/10 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#000033]">Performance de Posteos</h1>
            <p className="text-xs text-[#000033]/60 mt-0.5">Seguimiento y análisis de contenido publicado</p>
          </div>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncStatus === 'running'}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
              syncStatus === 'done'    ? 'bg-[#00ff99]/20 border-[#00ff99]/50 text-[#000033]'
              : syncStatus === 'error'  ? 'bg-red-50 border-red-200 text-red-600'
              : syncStatus === 'running'? 'bg-[#024fff]/5 border-[#024fff]/20 text-[#024fff]/60 cursor-not-allowed'
              : 'bg-[#024fff] border-[#024fff] text-white hover:bg-[#024fff]/90 shadow-lg shadow-[#024fff]/20'
            }`}
          >
            {syncStatus === 'running' && <RefreshCw className="w-4 h-4 animate-spin" />}
            {syncStatus === 'done'    && <CheckCircle2 className="w-4 h-4" />}
            {syncStatus === 'error'   && <AlertCircle className="w-4 h-4" />}
            {syncStatus === 'idle'    && <RefreshCw className="w-4 h-4" />}
            {syncStatus === 'running' ? 'Sincronizando...'
              : syncStatus === 'done'   ? 'Listo — actualizando'
              : syncStatus === 'error'  ? 'Error al sincronizar'
              : 'Sincronizar LinkedIn'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b-2 border-[#000033]/10 px-6 py-3 flex-shrink-0">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Filtro clientes */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#000033]">Cliente:</span>
            <div className="flex items-center gap-2 flex-wrap">
              {clientesSeleccionados.length > 0 ? (
                clients
                  .filter((c: any) => clientesSeleccionados.includes(c.id))
                  .map((c: any) => (
                    <button key={c.id} onClick={() => toggleCliente(c.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#024fff]/10 text-[#024fff] text-xs font-bold rounded-lg border-2 border-[#024fff]/20 hover:bg-[#024fff]/20">
                      {c.name}<X className="w-3 h-3" />
                    </button>
                  ))
              ) : (
                <span className="text-xs text-[#000033]/40">Todos los clientes</span>
              )}
              <div className="relative">
                <button onClick={() => setShowDropdownClientes(prev => !prev)}
                  className="px-3 py-1.5 border-2 border-dashed border-[#000033]/20 text-[#000033]/60 text-xs font-bold rounded-lg hover:border-[#024fff]/40 hover:text-[#024fff] flex items-center gap-1.5">
                  + Agregar<ChevronDown className="w-3 h-3" />
                </button>
                {showDropdownClientes && (
                  <div className="absolute top-full left-0 mt-1 bg-white border-2 border-[#000033]/20 rounded-lg shadow-lg z-10 min-w-[160px]">
                    {clients.map((c: any) => (
                      <button key={c.id} onClick={() => { toggleCliente(c.id); setShowDropdownClientes(false); }}
                        className="block w-full px-3 py-2 text-left text-xs font-bold text-[#000033] hover:bg-[#024fff]/10 hover:text-[#024fff]">
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="w-px h-6 bg-[#000033]/20" />

          {/* Filtro voceros */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#000033]">Vocero:</span>
            <div className="flex items-center gap-2 flex-wrap">
              {vocerosSeleccionados.length > 0 ? (
                vocerosUnicos
                  .filter((v: any) => vocerosSeleccionados.includes(v.id))
                  .map((v: any) => (
                    <button key={v.id} onClick={() => toggleVocero(v.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#024fff]/10 text-[#024fff] text-xs font-bold rounded-lg border-2 border-[#024fff]/20 hover:bg-[#024fff]/20">
                      {v.nombre}<X className="w-3 h-3" />
                    </button>
                  ))
              ) : (
                <span className="text-xs text-[#000033]/40">Todos los voceros</span>
              )}
              {vocerosUnicos.length > 0 && (
                <div className="relative">
                  <button onClick={() => setShowDropdownVoceros(prev => !prev)}
                    className="px-3 py-1.5 border-2 border-dashed border-[#000033]/20 text-[#000033]/60 text-xs font-bold rounded-lg hover:border-[#024fff]/40 hover:text-[#024fff] flex items-center gap-1.5">
                    + Agregar<ChevronDown className="w-3 h-3" />
                  </button>
                  {showDropdownVoceros && (
                    <div className="absolute top-full left-0 mt-1 bg-white border-2 border-[#000033]/20 rounded-lg shadow-lg z-10 min-w-[160px]">
                      {vocerosUnicos.map((v: any) => (
                        <button key={v.id} onClick={() => { toggleVocero(v.id); setShowDropdownVoceros(false); }}
                          className="block w-full px-3 py-2 text-left text-xs font-bold text-[#000033] hover:bg-[#024fff]/10 hover:text-[#024fff]">
                          {v.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="w-px h-6 bg-[#000033]/20" />

          {/* Filtro fecha */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#000033]">Fecha:</span>
            <div className="flex items-center gap-1.5">
              {(['semana', 'mes', 'rango'] as const).map(f => (
                <button key={f} onClick={() => setFiltroFecha(prev => prev === f ? null : f)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border-2 transition-all ${
                    filtroFecha === f
                      ? 'bg-[#024fff]/10 text-[#024fff] border-[#024fff]/20'
                      : 'border-[#000033]/10 text-[#000033]/60 hover:border-[#024fff]/40 hover:text-[#024fff]'
                  }`}>
                  {f === 'semana' ? 'Esta semana' : f === 'mes' ? 'Este mes' : 'Rango'}
                </button>
              ))}
              {filtroFecha === 'rango' && (
                <div className="flex items-center gap-1.5 ml-1">
                  <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
                    className="px-2 py-1.5 border-2 border-[#024fff]/20 rounded-lg text-xs text-[#000033] bg-white focus:outline-none focus:border-[#024fff]/50" />
                  <span className="text-xs text-[#000033]/40">—</span>
                  <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
                    className="px-2 py-1.5 border-2 border-[#024fff]/20 rounded-lg text-xs text-[#000033] bg-white focus:outline-none focus:border-[#024fff]/50" />
                </div>
              )}
            </div>
          </div>

          <div className="w-px h-6 bg-[#000033]/20" />

          {/* Filtro canal — toggles con icono */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#000033]">Red:</span>
            <div className="flex gap-1.5">
              {([
                { id: 'linkedin',  Icon: Linkedin,  label: 'LinkedIn',  color: '#0077B5' },
                { id: 'instagram', Icon: Instagram, label: 'Instagram', color: '#E4405F' },
                { id: 'facebook',  Icon: Facebook,  label: 'Facebook',  color: '#1877F2' },
                { id: 'twitter',   Icon: Twitter,   label: 'Twitter',   color: '#1DA1F2' },
              ] as const).map(({ id, Icon, label, color }) => {
                const active = canalesSeleccionados.includes(id);
                return (
                  <button key={id} onClick={() => toggleCanal(id)}
                    title={label}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg border-2 transition-all ${
                      active
                        ? 'border-[#024fff]/20 bg-[#024fff]/10 text-[#024fff]'
                        : 'border-[#000033]/10 text-[#000033]/50 hover:border-[#000033]/30 hover:text-[#000033]'
                    }`}
                    style={active ? {} : {}}>
                    <Icon className="w-3.5 h-3.5" style={{ color: active ? color : undefined }} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sort — pegado a la derecha */}
          <div className="ml-auto flex items-center gap-2">
            {(clientesSeleccionados.length > 0 || vocerosSeleccionados.length > 0 || canalesSeleccionados.length > 0 || filtroFecha !== null) && (
              <button
                onClick={() => { setClientesSeleccionados([]); setVocerosSeleccionados([]); setCanalesSeleccionados([]); setFiltroFecha(null); setFechaDesde(''); setFechaHasta(''); }}
                className="text-xs font-bold text-[#000033]/60 hover:text-[#024fff] underline mr-2">
                Limpiar filtros
              </button>
            )}
            <div className="w-px h-6 bg-[#000033]/20" />
            <span className="text-xs font-bold text-[#000033]">Ordenar:</span>
            <div className="relative">
              <select
                value={sortKey}
                onChange={e => setSortKey(e.target.value as SortKey)}
                className="appearance-none pl-3 pr-7 py-1.5 border-2 border-[#000033]/10 rounded-lg text-xs font-medium text-[#000033] hover:border-[#024fff]/40 focus:outline-none focus:ring-2 focus:ring-[#024fff] transition-all cursor-pointer bg-white"
              >
                <option value="fecha">Fecha</option>
                <option value="likes">Likes</option>
                <option value="comments">Comentarios</option>
                <option value="shares">Compartidos</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#000033]/50 pointer-events-none" />
            </div>
            <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              className="p-1.5 border-2 border-[#000033]/10 rounded-lg hover:border-[#024fff]/40 hover:text-[#024fff] transition-all text-[#000033]/60">
              {sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {isLoading && (
          <p className="text-center text-sm text-[#000033]/40 py-20">Cargando publicaciones...</p>
        )}

        {!isLoading && sorted.length === 0 && (
          <div className="text-center py-20">
            <TrendingUp className="w-10 h-10 text-[#000033]/10 mx-auto mb-4" />
            <p className="text-sm font-bold text-[#000033]/40 mb-1">Sin publicaciones todavía</p>
            <p className="text-xs text-[#000033]/30 max-w-xs mx-auto">
              Asegurate de que los clientes tengan su LinkedIn URL cargada y hacé clic en "Sincronizar LinkedIn".
            </p>
          </div>
        )}

        {!isLoading && sorted.length > 0 && (
          <div className="bg-white border-2 border-[#000033]/10 rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="border-b-2 border-[#000033]/10 bg-[#fafafa]">
              <div className="grid grid-cols-[90px_80px_56px_1fr_120px_120px_80px_80px_80px_44px] gap-3 px-4 py-3">
                <button
                  onClick={() => handleSort('fecha')}
                  className="flex items-center gap-1 text-[10px] font-bold text-[#000033]/60 uppercase tracking-wide hover:text-[#024fff] transition-colors"
                >
                  Fecha <SortIcon col="fecha" />
                </button>
                <div className="text-[10px] font-bold text-[#000033]/60 uppercase tracking-wide">Día / Hora</div>
                <div className="text-[10px] font-bold text-[#000033]/60 uppercase tracking-wide">Red</div>
                <div className="text-[10px] font-bold text-[#000033]/60 uppercase tracking-wide">Contenido</div>
                <div className="text-[10px] font-bold text-[#000033]/60 uppercase tracking-wide">Cliente</div>
                <div className="text-[10px] font-bold text-[#000033]/60 uppercase tracking-wide">Vocero</div>
                <button
                  onClick={() => handleSort('likes')}
                  className="flex items-center gap-1 justify-end text-[10px] font-bold text-[#000033]/60 uppercase tracking-wide hover:text-[#024fff] transition-colors"
                >
                  Likes <SortIcon col="likes" />
                </button>
                <button
                  onClick={() => handleSort('comments')}
                  className="flex items-center gap-1 justify-end text-[10px] font-bold text-[#000033]/60 uppercase tracking-wide hover:text-[#024fff] transition-colors"
                >
                  Comments <SortIcon col="comments" />
                </button>
                <button
                  onClick={() => handleSort('shares')}
                  className="flex items-center gap-1 justify-end text-[10px] font-bold text-[#000033]/60 uppercase tracking-wide hover:text-[#024fff] transition-colors"
                >
                  Shares <SortIcon col="shares" />
                </button>
                <div />
              </div>
            </div>

            {/* Table rows */}
            <div>
              {sorted.map((pub: any, index: number) => {
                const lastSnap = pub.snapshots?.slice(-1)[0];
                const canal = getCanalConfig(pub.canal);
                const CanalIcon = canal.icon;
                const { main: dateMain, year: dateYear } = pub.publishedAt
                  ? formatDate(pub.publishedAt)
                  : { main: '—', year: '' };
                const { dia, hora } = pub.publishedAt
                  ? formatDayTime(pub.publishedAt)
                  : { dia: '—', hora: '' };

                return (
                  <div
                    key={pub.id}
                    onClick={() => pub.url && window.open(pub.url, '_blank', 'noopener,noreferrer')}
                    className={`group grid grid-cols-[90px_80px_56px_1fr_120px_120px_80px_80px_80px_44px] gap-3 px-4 py-3 transition-all ${pub.url ? 'cursor-pointer hover:bg-[#024fff]/5' : ''} ${
                      index !== sorted.length - 1 ? 'border-b border-[#000033]/5' : ''
                    }`}
                  >
                    {/* Fecha */}
                    <div className="flex flex-col justify-center">
                      <span className="text-xs font-bold text-[#000033]">{dateMain}</span>
                      <span className="text-[10px] text-[#000033]/40">{dateYear}</span>
                    </div>

                    {/* Día / Hora */}
                    <div className="flex flex-col justify-center">
                      <span className="text-xs font-medium text-[#000033] capitalize">{dia}</span>
                      <span className="text-[10px] text-[#000033]/40">{hora}</span>
                    </div>

                    {/* Red */}
                    <div className="flex items-center justify-center">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${canal.color}18` }}
                      >
                        <CanalIcon className="w-4 h-4" style={{ color: canal.color }} />
                      </div>
                    </div>

                    {/* Contenido */}
                    <div className="flex items-center min-w-0">
                      <span className="text-sm font-bold text-[#000033] truncate">
                        {pub.postContent || <span className="text-[#000033]/30 italic text-xs font-normal">{pub.url}</span>}
                      </span>
                    </div>

                    {/* Cliente */}
                    <div className="flex items-center">
                      <span className="text-xs text-[#000033]/60 truncate">
                        {pub.client?.name ?? '—'}
                      </span>
                    </div>

                    {/* Vocero */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      {pub.speaker ? (
                        <>
                          <div className="w-5 h-5 rounded-full bg-[#024fff]/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-[9px] font-bold text-[#024fff] leading-none">
                              {pub.speaker.nombre.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                            </span>
                          </div>
                          <span className="text-xs font-medium text-[#000033] truncate">{pub.speaker.nombre}</span>
                        </>
                      ) : (
                        <span className="text-xs text-[#000033]/25">—</span>
                      )}
                    </div>

                    {/* Likes */}
                    <div className="flex items-center justify-end gap-1.5">
                      <Heart className="w-3 h-3 text-[#E4405F]" />
                      <span className="text-sm font-bold text-[#000033]">
                        {lastSnap ? formatNum(lastSnap.likes) : '—'}
                      </span>
                    </div>

                    {/* Comments */}
                    <div className="flex items-center justify-end gap-1.5">
                      <MessageSquare className="w-3 h-3 text-[#024fff]" />
                      <span className="text-sm font-bold text-[#000033]">
                        {lastSnap ? formatNum(lastSnap.comments) : '—'}
                      </span>
                    </div>

                    {/* Shares */}
                    <div className="flex items-center justify-end gap-1.5">
                      <Share2 className="w-3 h-3 text-[#000033]/50" />
                      <span className="text-sm font-bold text-[#000033]">
                        {lastSnap ? formatNum(lastSnap.shares) : '—'}
                      </span>
                    </div>

                    {/* Lineamiento */}
                    <div className="flex items-center justify-center">
                      <button
                        onClick={(e) => toggleHighlight(e, pub)}
                        title={pub.isHighlight ? 'Quitar lineamiento' : 'Marcar como lineamiento'}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                          pub.isHighlight
                            ? 'bg-[#FFD700]/20 hover:bg-[#FFD700]/30'
                            : 'opacity-0 group-hover:opacity-100 hover:bg-[#000033]/5'
                        }`}
                      >
                        <Star
                          className="w-3.5 h-3.5"
                          style={{ color: pub.isHighlight ? '#FFD700' : '#000033' }}
                          fill={pub.isHighlight ? '#FFD700' : 'none'}
                          strokeWidth={pub.isHighlight ? 0 : 1.5}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
