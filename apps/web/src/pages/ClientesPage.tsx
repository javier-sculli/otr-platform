import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, X, Building2,
  FileText, ChevronDown, Check, Trash2, Sparkles,
} from 'lucide-react';
import { api } from '../lib/api';

interface ClienteStats {
  id: string;
  name: string;
  active: boolean;
  canales: string[];
  owner: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  tickets: {
    idea: number;
    enProduccion: number;
    publicado: number;
    total: number;
  };
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteClient(id),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['clients-stats'] });
      queryClient.refetchQueries({ queryKey: ['clients'] });
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
      <div className="bg-white border-b-2 border-[#000033]/10 px-6 py-4">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-[#000033] mb-0.5">Clientes</h1>
              <p className="text-xs text-[#000033]/60">
                Gestiona los clientes y su contenido
              </p>
            </div>

            <button
              onClick={() => setShowModalNuevo(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#024fff] text-white rounded-lg hover:bg-[#024fff]/90 transition-all font-bold text-xs shadow-lg shadow-[#024fff]/20"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo cliente
            </button>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-sm relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#000033]/40" />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border-2 border-[#000033]/10 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033]"
            />
          </div>
        </div>
      </div>

      {/* Grid de clientes */}
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-[#000033]/60 text-xs">Cargando...</div>
          </div>
        ) : clientesFiltrados.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-[#000033]/20 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-[#000033] mb-1">
              {searchQuery ? 'No se encontraron clientes' : 'Todavía no hay clientes'}
            </h3>
            <p className="text-xs text-[#000033]/60 mb-4">
              {searchQuery
                ? 'Intenta ajustar la búsqueda'
                : 'Creá el primero para empezar a armar el flujo de contenido.'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowModalNuevo(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#024fff] text-white rounded-lg hover:bg-[#024fff]/90 transition-all font-bold text-xs shadow-lg shadow-[#024fff]/20"
              >
                <Plus className="w-3.5 h-3.5" />
                Nuevo cliente
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {clientesFiltrados.map(cliente => (
              <ClienteCard
                key={cliente.id}
                cliente={cliente}
                onContenido={() => navigate(`/backlog?clientId=${cliente.id}`)}
                onVozDeMarca={() => navigate(`/clientes/${cliente.id}/voz-de-marca`)}
                onDelete={() => deleteMutation.mutate(cliente.id)}
                isDeleting={deleteMutation.isPending && deleteMutation.variables === cliente.id}
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
  onContenido,
  onVozDeMarca,
  onDelete,
  isDeleting,
}: {
  cliente: ClienteStats;
  onContenido: () => void;
  onVozDeMarca: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="bg-white border-2 border-[#000033]/10 rounded-xl p-4 hover:border-[#024fff]/40 transition-all hover:shadow-lg group">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-sm font-bold text-[#000033] mb-1.5">{cliente.name}</h3>

          {/* Canales */}
          {cliente.canales.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {cliente.canales.map(canal => (
                <span
                  key={canal}
                  className="px-1.5 py-0.5 bg-[#000033]/5 text-[#000033]/60 text-xs font-bold rounded"
                >
                  {canalLabel[canal] ?? canal.slice(0, 3).toLowerCase()}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Owner */}
      {cliente.owner && (
        <div className="mb-3 pb-3 border-b border-[#000033]/10">
          <p className="text-xs text-[#000033]/60 truncate">{cliente.owner.name}</p>
        </div>
      )}

      {/* Contenido stats */}
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-[#024fff]" />
            <span className="text-xs font-bold text-[#000033]">Contenido</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[#000033]/60">
              <span className="font-bold text-[#000033]">{cliente.tickets.idea}</span> idea
            </span>
            <span className="text-[#000033]/40">•</span>
            <span className="text-[#000033]/60">
              <span className="font-bold text-[#000033]">{cliente.tickets.enProduccion}</span> prod.
            </span>
            <span className="text-[#000033]/40">•</span>
            <span className="text-[#000033]/60">
              <span className="font-bold text-[#000033]">{cliente.tickets.publicado}</span> pub.
            </span>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="pt-3 border-t border-[#000033]/10 flex items-center gap-1.5">
        <button
          onClick={onContenido}
          className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-[#024fff] text-white rounded-lg hover:bg-[#024fff]/90 transition-all font-bold text-xs shadow-lg shadow-[#024fff]/20"
        >
          <FileText className="w-3.5 h-3.5" />
          Contenido
        </button>
        <button
          onClick={onVozDeMarca}
          className="flex items-center justify-center gap-1 px-2.5 py-1.5 border-2 border-[#024fff]/20 text-[#024fff] rounded-lg hover:bg-[#024fff]/10 transition-all font-bold text-xs"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Voz de Marca
        </button>

        {confirming ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => { onDelete(); setConfirming(false); }}
              disabled={isDeleting}
              className="px-2 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all text-xs font-bold disabled:opacity-50"
            >
              {isDeleting ? '...' : 'Sí'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-2 py-1.5 border-2 border-[#000033]/10 text-[#000033]/60 rounded-lg hover:bg-[#000033]/5 transition-all text-xs font-bold"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="p-1.5 border-2 border-[#000033]/10 text-[#000033]/40 rounded-lg hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
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
    onCrear({
      name: nombre.trim(),
      ownerId: ownerId || undefined,
      canales: canalesSeleccionados,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[#000033]/10">
          <h2 className="text-base font-bold text-[#000033]">Nuevo cliente</h2>
          <button
            onClick={onClose}
            className="text-[#000033]/40 hover:text-[#000033] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Nombre */}
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
              className="w-full px-3 py-2 border-2 border-[#000033]/10 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033]"
              autoFocus
            />
          </div>

          {/* Owner */}
          <div>
            <label className="text-xs font-bold text-[#000033] mb-1.5 block">
              Responsable
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowOwnerDropdown(prev => !prev)}
                className="w-full flex items-center justify-between px-3 py-2 border-2 border-[#000033]/10 rounded-lg text-xs text-left focus:outline-none focus:ring-2 focus:ring-[#024fff]"
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
                    className="w-full px-3 py-1.5 text-xs text-left text-[#000033]/40 hover:bg-[#000033]/5"
                  >
                    Sin responsable
                  </button>
                  {usuarios.map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => { setOwnerId(u.id); setShowOwnerDropdown(false); }}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-[#000033]/5"
                    >
                      <div>
                        <span className="font-medium text-[#000033]">{u.name}</span>
                        <span className="ml-2 text-[#000033]/40">{u.role}</span>
                      </div>
                      {ownerId === u.id && <Check className="w-3.5 h-3.5 text-[#024fff]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Redes sociales */}
          <div>
            <label className="text-xs font-bold text-[#000033] mb-1.5 block">
              Redes sociales
            </label>
            <div className="flex flex-wrap gap-1.5">
              {REDES_DISPONIBLES.map(red => {
                const activa = canalesSeleccionados.includes(red);
                return (
                  <button
                    key={red}
                    type="button"
                    onClick={() => toggleCanal(red)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border-2 transition-all ${
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

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t-2 border-[#000033]/10 bg-[#fafafa]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 border-2 border-[#000033]/10 rounded-lg text-[#000033] font-medium hover:bg-[#000033]/5 transition-all text-xs"
          >
            Cancelar
          </button>
          <button
            onClick={handleCrear}
            disabled={!nombre.trim() || isLoading}
            className="px-3 py-1.5 bg-[#024fff] text-white rounded-lg hover:bg-[#024fff]/90 transition-all font-bold shadow-lg shadow-[#024fff]/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none text-xs"
          >
            {isLoading ? 'Creando...' : 'Crear cliente'}
          </button>
        </div>
      </div>
    </div>
  );
}
