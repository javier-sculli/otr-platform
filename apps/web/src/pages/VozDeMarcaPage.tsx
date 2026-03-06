import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, ChevronDown, ChevronUp, Check, AlertCircle, ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';

interface Seccion {
  id: string;
  titulo: string;
  placeholder: string;
}

const SECCIONES: Seccion[] = [
  {
    id: 'identidad_verbal',
    titulo: 'Identidad verbal de la marca',
    placeholder: 'Describí el tono característico, el tipo de lenguaje, expresiones aprobadas y estructuras de frase que usa la marca...',
  },
  {
    id: 'estrategia_contenido',
    titulo: 'Estrategia de contenido',
    placeholder: 'Mensajes prioritarios, pilares temáticos, nivel de profundidad buscado y elementos visuales o textuales alineados...',
  },
  {
    id: 'criterios_calidad',
    titulo: 'Criterios de calidad',
    placeholder: 'Qué es contenido bueno, qué rechazás sistemáticamente, nivel de claridad/síntesis/precisión esperado y referencias o benchmarks...',
  },
  {
    id: 'uso_idioma',
    titulo: 'Uso del idioma',
    placeholder: 'Idioma principal de la marca, cuándo usar cada idioma, restricciones de tono por idioma...',
  },
  {
    id: 'elementos_marca',
    titulo: 'Elementos de marca a respetar',
    placeholder: 'Valores centrales, terminología específica, propuesta de valor transversal, público objetivo y diferenciales competitivos...',
  },
  {
    id: 'identidad_comunicacion',
    titulo: 'Identidad de comunicación',
    placeholder: 'Cómo comunica la marca, desde dónde habla, qué busca generar en la audiencia...',
  },
  {
    id: 'estilo_editorial',
    titulo: 'Estilo editorial',
    placeholder: 'Estructura de frases, longitud de títulos, uso de bullets, jerarquía visual preferida, tipos de claims...',
  },
  {
    id: 'mensajes_clave',
    titulo: 'Mensajes clave / Puntos de foco',
    placeholder: 'Las ideas centrales que deben quedar claras en cualquier pieza de contenido...',
  },
  {
    id: 'lineas_editoriales',
    titulo: 'Líneas editoriales',
    placeholder: 'Los ejes temáticos desde los cuales se produce contenido (ej: DNA/cultura, value prop, plataforma, validación, trust)...',
  },
  {
    id: 'formato_preferido',
    titulo: 'Formato preferido',
    placeholder: 'Tipos de formatos que mejor representan la marca: slides, threads, videos, carruseles, long-form, etc...',
  },
  {
    id: 'audiencia_objetivo',
    titulo: 'Audiencia objetivo',
    placeholder: 'Quiénes son, qué saben, qué les importa, cómo toman decisiones...',
  },
];

export function VozDeMarcaPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [content, setContent] = useState<Record<string, string>>(() =>
    Object.fromEntries(SECCIONES.map(s => [s.id, '']))
  );
  const [openSections, setOpenSections] = useState<Set<string>>(new Set([SECCIONES[0].id]));
  const [hasChanges, setHasChanges] = useState(false);

  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.getClients(),
  });

  const { data: brandVoiceData, isLoading } = useQuery({
    queryKey: ['brand-voice', clientId],
    queryFn: () => api.getBrandVoice(clientId!),
    enabled: !!clientId,
  });

  // Populate form when data loads
  useEffect(() => {
    if (brandVoiceData?.data) {
      setContent(prev => ({ ...prev, ...brandVoiceData.data }));
    }
  }, [brandVoiceData]);

  const saveMutation = useMutation({
    mutationFn: () => api.saveBrandVoice(clientId!, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-voice', clientId] });
      setHasChanges(false);
    },
  });

  const clientName = clientsData?.data.find((c: any) => c.id === clientId)?.name;

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleChange = (id: string, value: string) => {
    setContent(prev => ({ ...prev, [id]: value }));
    setHasChanges(true);
  };

  const filledCount = SECCIONES.filter(s => content[s.id]?.trim().length > 0).length;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <div className="bg-white border-b-2 border-[#000033]/10 px-8 py-5 sticky top-0 z-10">
        <div className="max-w-[800px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/clientes')}
              className="p-2 rounded-lg text-[#000033]/40 hover:text-[#000033] hover:bg-[#000033]/5 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div>
              <div className="flex items-center gap-3 mb-0.5">
                <h1 className="text-xl font-bold text-[#000033]">Voz de Marca</h1>
                {clientName && (
                  <span className="px-2.5 py-0.5 bg-[#024fff]/10 border border-[#024fff]/20 text-[#024fff] text-xs font-bold rounded-lg">
                    {clientName}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#000033]/50">
                {filledCount}/{SECCIONES.length} secciones completadas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!hasChanges && !saveMutation.isPending && saveMutation.isSuccess && (
              <span className="text-xs text-[#000033]/40 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#00ff99]" />
                Guardado
              </span>
            )}
            {hasChanges && (
              <span className="text-xs text-[#000033]/50 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                Sin guardar
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

        {/* Progress bar */}
        <div className="max-w-[800px] mx-auto mt-3">
          <div className="h-1 bg-[#000033]/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#024fff] rounded-full transition-all duration-500"
              style={{ width: `${(filledCount / SECCIONES.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Secciones */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-[#000033]/60">Cargando...</div>
      ) : (
        <div className="max-w-[800px] mx-auto px-8 py-6 space-y-2">
          {SECCIONES.map((seccion, index) => {
            const isOpen = openSections.has(seccion.id);
            const isFilled = content[seccion.id]?.trim().length > 0;

            return (
              <div
                key={seccion.id}
                className="bg-white border-2 border-[#000033]/10 rounded-xl overflow-hidden"
              >
                {/* Header del acordeón */}
                <button
                  onClick={() => toggleSection(seccion.id)}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-[#000033]/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-[#000033]/30 w-5 text-right">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="font-bold text-[#000033] text-sm">{seccion.titulo}</span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {isFilled ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-[#00ff99]/25 text-[#000033] text-xs font-bold rounded">
                        <Check className="w-3 h-3" />
                        Completo
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-[#000033]/5 text-[#000033]/40 text-xs font-bold rounded">
                        Vacío
                      </span>
                    )}
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-[#000033]/30" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#000033]/30" />
                    )}
                  </div>
                </button>

                {/* Contenido */}
                {isOpen && (
                  <div className="px-5 pb-5 border-t border-[#000033]/8">
                    <textarea
                      value={content[seccion.id] ?? ''}
                      onChange={e => handleChange(seccion.id, e.target.value)}
                      placeholder={seccion.placeholder}
                      rows={6}
                      className="w-full mt-4 px-3 py-3 border-2 border-[#000033]/10 rounded-lg text-sm text-[#000033] placeholder-[#000033]/25 bg-[#fafafa] focus:outline-none focus:border-[#024fff] focus:bg-white resize-none transition-colors leading-relaxed"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
