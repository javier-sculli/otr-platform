import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, X, Building2, User,
  FileText, ChevronDown, Check, Sparkles, Mic,
} from 'lucide-react';
import { api } from '../lib/api';

interface ClienteStats {
  id: string;
  name: string;
  active: boolean;
  canales: string[];
  owner: { id: string; name: string } | null;
  brandKit: { completitud: number };
  voceros: number;
  contenido: { draft: number; enRevision: number; programadas: number };
  createdAt: string;
  updatedAt: string;
}

interface Usuario {
  id: string;
  name: string;
  email: string;
  role: string;
}

const REDES_DISPONIBLES = ['LinkedIn', 'Instagram', 'Twitter/X', 'TikTok', 'YouTube', 'Facebook'];

const canalLabel: Record<string, string> = {
  LinkedIn: 'in',
  Instagram: 'ig',
  'Twitter/X': 'x',
  Twitter: 'x',
  TikTok: 'tk',
  YouTube: 'yt',
  Facebook: 'fb',
};

export function ClientesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showModalNuevo, setShowModalNuevo] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['clients-stats'],
    queryFn: () => api.getClientsStats(),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.getUsers(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; ownerId?: string; canales?: string[] }) =>
      api.createClient(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients-stats'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setShowModalNuevo(false);
    },
  });

  const clientes: ClienteStats[] = data?.data ?? [];
  const usuarios: Usuario[] = usersData?.data ?? [];

  const clientesFiltrados = clientes.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <div className="bg-white border-b-2 border-[#000033]/10 px-8 py-6">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-[#000033] mb-0.5">Clientes</h1>
              <p className="text-xs text-[#000033]/60">
                Gestiona los clientes, su Voz de Marca y contenido
              </p>
            </div>
            <button
              onClick={() => setShowModalNuevo(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-[#024fff] text-white rounded-lg hover:bg-[#024fff]/90 transition-all font-bold text-sm shadow-lg shadow-[#024fff]/20"
            >
              <Plus className="w-4 h-4" />
              Nuevo cliente
            </button>
          </div>

          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#000033]/40" />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border-2 border-[#000033]/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033]"
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-[1600px] mx-auto px-8 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-[#000033]/60 text-sm">Cargando...</div>
        ) : clientesFiltrados.length === 0 ? (
          <div className="text-center py-16">
            <Building2 className="w-14 h-14 text-[#000033]/20 mx-auto mb-4" />
            <h3 className="text-base font-bold text-[#000033] mb-2">
              {searchQuery ? 'No se encontraron clientes' : 'Todavía no hay clientes'}
            </h3>
            <p className="text-xs text-[#000033]/60 mb-6">
              {searchQuery
                ? 'Intenta ajustar la búsqueda'
                : 'Creá el primero para empezar a armar la Voz de Marca y el flujo de contenido.'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowModalNuevo(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#024fff] text-white rounded-lg hover:bg-[#024fff]/90 transition-all font-bold text-sm shadow-lg shadow-[#024fff]/20"
              >
                <Plus className="w-4 h-4" />
                Nuevo cliente
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {clientesFiltrados.map(cliente => (
              <ClienteCard
                key={cliente.id}
                cliente={cliente}
                onClick={() => navigate(`/clientes/${cliente.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {showModalNuevo && (
        <ModalNuevoCliente
          usuarios={usuarios}
          onClose={() => setShowModalNuevo(false)}
          onCrear={(payload) => createMutation.mutate(payload)}
          isLoading={createMutation.isPending}
        />
      )}
    </div>
  );
}

function ClienteCard({
  cliente,
  onClick,
}: {
  cliente: ClienteStats;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="bg-white border-2 border-[#000033]/10 rounded-xl p-6 hover:border-[#024fff]/40 transition-all hover:shadow-lg cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-2">
            <h3 className="text-base font-bold text-[#000033] group-hover:text-[#024fff] transition-colors truncate">
              {cliente.name}
            </h3>
          </div>
          {cliente.canales.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {cliente.canales.map(canal => (
                <span key={canal} className="px-1.5 py-0.5 bg-[#000033]/5 text-[#000033]/60 text-xs font-bold rounded">
                  {canalLabel[canal] ?? canal.slice(0, 2).toLowerCase()}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Owner */}
      <div className="mb-4 pb-4 border-b border-[#000033]/10">
        {cliente.owner ? (
          <div className="flex items-center gap-1.5 text-sm text-[#000033]/60">
            <User className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{cliente.owner.name}</span>
          </div>
        ) : (
          <span className="text-xs text-[#000033]/30 italic">Sin responsable</span>
        )}
      </div>

      {/* Stats */}
      <div className="space-y-3">
        {/* Voz de Marca */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#024fff]" />
            <span className="text-sm font-bold text-[#000033]">Voz de Marca</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-[#000033]/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#024fff] rounded-full transition-all"
                style={{ width: `${cliente.brandKit.completitud}%` }}
              />
            </div>
            <span className="text-xs font-bold text-[#024fff] w-8 text-right">
              {cliente.brandKit.completitud}%
            </span>
          </div>
        </div>

        {/* Voceros */}
        {cliente.voceros > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic className="w-3.5 h-3.5 text-[#024fff]" />
              <span className="text-sm font-bold text-[#000033]">Voceros</span>
            </div>
            <span className="text-sm font-bold text-[#024fff]">{cliente.voceros}</span>
          </div>
        )}

        {/* Contenido */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-[#024fff]" />
            <span className="text-sm font-bold text-[#000033]">Contenido</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[#000033]/60">
              <span className="font-bold text-[#000033]">{cliente.contenido.draft}</span> draft
            </span>
            <span className="text-[#000033]/30">·</span>
            <span className="text-[#000033]/60">
              <span className="font-bold text-[#000033]">{cliente.contenido.enRevision}</span> rev.
            </span>
            <span className="text-[#000033]/30">·</span>
            <span className="text-[#000033]/60">
              <span className="font-bold text-[#000033]">{cliente.contenido.programadas}</span> prog.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalNuevoCliente({
  usuarios,
  onClose,
  onCrear,
  isLoading,
}: {
  usuarios: Usuario[];
  onClose: () => void;
  onCrear: (payload: { name: string; ownerId?: string; canales?: string[] }) => void;
  isLoading: boolean;
}) {
  const [nombre, setNombre] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [canalesSeleccionados, setCanalesSeleccionados] = useState<string[]>([]);
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false);

  const toggleCanal = (canal: string) => {
    setCanalesSeleccionados(prev =>
      prev.includes(canal) ? prev.filter(c => c !== canal) : [...prev, canal]
    );
  };

  const ownerSeleccionado = usuarios.find(u => u.id === ownerId);

  const handleCrear = () => {
    if (!nombre.trim()) return;
    onCrear({ name: nombre.trim(), ownerId: ownerId || undefined, canales: canalesSeleccionados });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-[#000033]/10">
          <h2 className="text-base font-bold text-[#000033]">Nuevo cliente</h2>
          <button onClick={onClose} className="text-[#000033]/40 hover:text-[#000033] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-[#000033] mb-1.5">
              Nombre del cliente <span className="text-[#024fff]">*</span>
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCrear()}
              placeholder="Ej: TechCorp, StartupHub..."
              className="w-full px-3 py-2.5 border-2 border-[#000033]/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033]"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#000033] mb-1.5 block">Responsable</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowOwnerDropdown(prev => !prev)}
                className="w-full flex items-center justify-between px-3 py-2.5 border-2 border-[#000033]/10 rounded-lg text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#024fff]"
              >
                <span className={ownerSeleccionado ? 'text-[#000033]' : 'text-[#000033]/40'}>
                  {ownerSeleccionado ? ownerSeleccionado.name : 'Seleccionar responsable...'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#000033]/40 flex-shrink-0" />
              </button>
              {showOwnerDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-[#000033]/10 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => { setOwnerId(''); setShowOwnerDropdown(false); }}
                    className="w-full px-3 py-2 text-sm text-left text-[#000033]/40 hover:bg-[#000033]/5"
                  >
                    Sin responsable
                  </button>
                  {usuarios.map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => { setOwnerId(u.id); setShowOwnerDropdown(false); }}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-[#000033]/5"
                    >
                      <div>
                        <span className="font-medium text-[#000033]">{u.name}</span>
                        <span className="ml-2 text-[#000033]/40 text-xs">{u.role}</span>
                      </div>
                      {ownerId === u.id && <Check className="w-3.5 h-3.5 text-[#024fff]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[#000033] mb-1.5 block">
              Canales activos <span className="text-[#000033]/40 font-normal">(opcional)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {REDES_DISPONIBLES.map(red => {
                const activa = canalesSeleccionados.includes(red);
                return (
                  <button
                    key={red}
                    type="button"
                    onClick={() => toggleCanal(red)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${
                      activa
                        ? 'bg-[#024fff] text-white border-[#024fff]'
                        : 'bg-white text-[#000033]/60 border-[#000033]/10 hover:border-[#024fff]/40'
                    }`}
                  >
                    {red}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t-2 border-[#000033]/10 bg-[#fafafa]">
          <button
            onClick={onClose}
            className="px-4 py-2 border-2 border-[#000033]/10 rounded-lg text-[#000033] font-medium hover:bg-[#000033]/5 transition-all text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleCrear}
            disabled={!nombre.trim() || isLoading}
            className="px-4 py-2 bg-[#024fff] text-white rounded-lg hover:bg-[#024fff]/90 transition-all font-bold text-sm shadow-lg shadow-[#024fff]/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isLoading ? 'Creando...' : 'Crear cliente'}
          </button>
        </div>
      </div>
    </div>
  );
}
