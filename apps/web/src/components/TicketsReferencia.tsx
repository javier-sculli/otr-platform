import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import { Link2, Plus, Search, X, ExternalLink, ClipboardList } from 'lucide-react';
import { api } from '../lib/api';

interface RefTicket {
  id: string;
  title: string;
  status?: string;
  ticketType?: { id: string; name: string; kind?: string } | null;
}

interface TicketsReferenciaProps {
  ticketId: string;
  clientId: string;
  speakerId?: string | null;
  references: RefTicket[];
}

const MAX_REFS = 3;

export function TicketsReferencia({ ticketId, clientId, speakerId, references }: TicketsReferenciaProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const linked = references ?? [];
  const linkedIds = new Set(linked.map((r) => r.id));
  const atMax = linked.length >= MAX_REFS;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Candidatos: mismo cliente; filtro de vocero y resto client-side (cubre el caso sin vocero)
  const { data: candidatesData, isLoading } = useQuery({
    queryKey: ['tickets', 'refs', clientId],
    queryFn: () => api.getTickets({ clientId }),
    enabled: open && !!clientId,
  });

  const candidates = (candidatesData?.data ?? []).filter((t: any) => {
    if (t.id === ticketId) return false; // no a sí misma
    if (linkedIds.has(t.id)) return false; // ya vinculada
    // mismo vocero (o ambos sin vocero)
    const tSpeaker = t.speaker?.id ?? null;
    if ((speakerId ?? null) !== tSpeaker) return false;
    if (search.trim() && !t.title.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  const mutation = useMutation({
    mutationFn: (referenceIds: string[]) => api.updateTicket(ticketId, { referenceIds }),
    onMutate: () => setOpen(false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  const addRef = (id: string) => {
    if (atMax) return;
    mutation.mutate([...linkedIds, id]);
    setSearch('');
  };

  const removeRef = (id: string) => {
    mutation.mutate([...linkedIds].filter((x) => x !== id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-xs font-bold text-[#000033] uppercase flex items-center gap-2">
          <Link2 className="w-3.5 h-3.5 text-[#024fff]" />
          Tickets de referencia
          <span className="text-[10px] font-medium text-[#000033]/30 normal-case tracking-normal">
            {linked.length}/{MAX_REFS}
          </span>
        </h2>

        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            disabled={atMax}
            title={atMax ? 'Máximo 3 referencias' : 'Agregar referencia'}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-[#024fff] border border-[#024fff]/30 rounded-lg hover:bg-[#024fff]/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-3 h-3" />
            Agregar
          </button>

          {open && !atMax && (
            <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-[#000033]/15 rounded-lg shadow-xl z-30 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-[#000033]/10">
                <Search className="w-3.5 h-3.5 text-[#000033]/30 flex-shrink-0" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre..."
                  className="flex-1 text-xs text-[#000033] bg-transparent outline-none placeholder:text-[#000033]/35"
                />
              </div>
              <div className="max-h-60 overflow-y-auto">
                {isLoading ? (
                  <div className="px-3 py-3 text-xs text-[#000033]/40">Cargando...</div>
                ) : candidates.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-[#000033]/40">
                    {search.trim() ? 'Sin resultados.' : 'No hay tickets del mismo cliente y vocero para referenciar.'}
                  </div>
                ) : (
                  candidates.slice(0, 30).map((t: any) => {
                    const esTarea = t.ticketType?.kind === 'TAREA';
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => addRef(t.id)}
                        className="w-full text-left px-3 py-2 hover:bg-[#024fff]/5 transition-all flex items-center gap-2 group"
                      >
                        {esTarea
                          ? <ClipboardList className="w-3 h-3 text-[#000033]/40 flex-shrink-0" />
                          : <Link2 className="w-3 h-3 text-[#024fff]/50 flex-shrink-0" />}
                        <span className="text-xs text-[#000033] truncate flex-1">{t.title}</span>
                        {t.ticketType && (
                          <span className="text-[10px] text-[#000033]/40 flex-shrink-0">{t.ticketType.name}</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {linked.length === 0 ? (
        <p className="text-xs text-[#000033]/40 italic">
          Vinculá hasta 3 tickets del mismo cliente y vocero para reutilizar su contexto al redactar (sin copiarlo).
        </p>
      ) : (
        <div className="space-y-1.5">
          {linked.map((r) => {
            const esTarea = r.ticketType?.kind === 'TAREA';
            return (
              <div
                key={r.id}
                className="flex items-center gap-2 px-3 py-2 border border-[#024fff]/20 rounded-lg group hover:border-[#024fff]/40 transition-all"
              >
                {esTarea
                  ? <ClipboardList className="w-3.5 h-3.5 text-[#000033]/50 flex-shrink-0" />
                  : <Link2 className="w-3.5 h-3.5 text-[#024fff] flex-shrink-0" />}
                <RouterLink
                  to={`/piezas/${r.id}`}
                  className="text-xs text-[#000033] truncate flex-1 hover:text-[#024fff] hover:underline"
                >
                  {r.title}
                </RouterLink>
                <RouterLink to={`/piezas/${r.id}`} className="text-[#024fff]/40 hover:text-[#024fff] flex-shrink-0">
                  <ExternalLink className="w-3 h-3" />
                </RouterLink>
                <button
                  type="button"
                  onClick={() => removeRef(r.id)}
                  disabled={mutation.isPending}
                  title="Quitar referencia"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-[#000033]/30 hover:text-red-400 flex-shrink-0 disabled:opacity-30"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
