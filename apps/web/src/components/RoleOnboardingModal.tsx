import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { Shield, Edit3, Newspaper, Palette, Video, Check, Sparkles } from 'lucide-react';

const ROLE_OPTIONS = [
  {
    name: 'Dirección',
    icon: Shield,
    color: 'bg-purple-500/10 text-purple-600 border-purple-200',
    activeBorder: 'border-purple-600 bg-purple-50/50',
    description: 'Dirección general, gerencia y coordinación executive de la agencia.',
    systemRole: 'DIRECCION',
  },
  {
    name: 'Contenido',
    icon: Edit3,
    color: 'bg-blue-500/10 text-blue-600 border-blue-200',
    activeBorder: 'border-blue-600 bg-blue-50/50',
    description: 'Redacción, estrategia editorial y gestión de copys para redes.',
    systemRole: 'CONTENIDISTA',
  },
  {
    name: 'Prensa',
    icon: Newspaper,
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
    activeBorder: 'border-emerald-600 bg-emerald-50/50',
    description: 'Relaciones públicas, gestión de voceros, notas y pitch de prensa.',
    systemRole: 'CONTENIDISTA',
  },
  {
    name: 'Diseño',
    icon: Palette,
    color: 'bg-pink-500/10 text-pink-600 border-pink-200',
    activeBorder: 'border-pink-600 bg-pink-50/50',
    description: 'Diseño gráfico, maquetación visual y entrega de piezas de diseño.',
    systemRole: 'CONTENIDISTA',
  },
  {
    name: 'Video',
    icon: Video,
    color: 'bg-amber-500/10 text-amber-600 border-amber-200',
    activeBorder: 'border-amber-600 bg-amber-50/50',
    description: 'Producción, edición audiovisual y adaptación de video clips.',
    systemRole: 'CONTENIDISTA',
  },
];

export function RoleOnboardingModal() {
  const { user, updateUserArea } = useAuth();
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([]);
  const [selectedRoleName, setSelectedRoleName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const needsRoleAssignment = Boolean(user && !user.areaId && !user.area);

  useEffect(() => {
    if (needsRoleAssignment) {
      api.getAreas()
        .then((res) => setAreas(res.data ?? []))
        .catch((err) => console.error('Error al cargar áreas:', err));
    }
  }, [needsRoleAssignment]);

  if (!needsRoleAssignment) {
    return null;
  }

  const handleSave = async () => {
    if (!selectedRoleName) return;
    setLoading(true);
    setError('');

    try {
      // Buscar el ID del área correspondiente
      const matchedArea = areas.find((a) => a.name.toLowerCase() === selectedRoleName.toLowerCase());
      if (!matchedArea) {
        throw new Error('Área no encontrada en la plataforma');
      }

      const roleOption = ROLE_OPTIONS.find((r) => r.name === selectedRoleName);
      await updateUserArea(matchedArea.id, roleOption?.systemRole);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el rol');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#000033]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border-2 border-[#000033]/10 rounded-2xl shadow-2xl max-w-lg w-full p-6 sm:p-8 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-[#024fff]/10 flex items-center justify-center text-[#024fff]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#000033]">¡Bienvenido/a a OTR!</h2>
            <p className="text-xs text-[#000033]/60">Configuración inicial de tu usuario</p>
          </div>
        </div>

        <p className="text-xs text-[#000033]/80 my-4 leading-relaxed font-medium">
          Para personalizar tu espacio de trabajo en la plataforma, por favor seleccioná tu <strong>rol genérico / área principal</strong> en la agencia:
        </p>

        <div className="space-y-2.5 my-5 max-h-72 overflow-y-auto pr-1">
          {ROLE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = selectedRoleName === opt.name;

            return (
              <div
                key={opt.name}
                onClick={() => setSelectedRoleName(opt.name)}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 ${
                  isSelected ? opt.activeBorder : 'border-[#000033]/10 hover:border-[#000033]/20 bg-white'
                }`}
              >
                <div className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${opt.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#000033]">{opt.name}</span>
                    {isSelected && (
                      <span className="w-4 h-4 bg-[#024fff] rounded-full flex items-center justify-center text-white">
                        <Check className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#000033]/60 leading-tight mt-0.5">{opt.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200 mb-4">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={!selectedRoleName || loading}
          className="w-full bg-[#024fff] text-white py-2.5 rounded-xl font-bold text-xs hover:bg-[#024fff]/90 disabled:bg-[#000033]/20 disabled:cursor-not-allowed transition-all shadow-md"
        >
          {loading ? 'Guardando rol...' : 'Guardar rol y continuar'}
        </button>
      </div>
    </div>
  );
}
