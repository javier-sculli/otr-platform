import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { SumarioTab } from '../components/SumarioTab';
import { ChevronDown, Building2 } from 'lucide-react';

export function SumarioPage() {
  const { data: clientsData, isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.getClients(),
  });

  const clients = clientsData?.data ?? [];
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  useEffect(() => {
    if (clients.length > 0 && !selectedClientId) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center text-sm text-[#000033]/60">
        Cargando clientes...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Selector de Cliente - Barra Sticky debajo del nav principal */}
      <div className="bg-white border-b border-[#000033]/10 px-8 py-3.5 sticky top-[64px] z-[6] shadow-sm">
        <div className="max-w-[1200px] mx-auto flex items-center gap-3">
          <Building2 className="w-4 h-4 text-[#024fff]" />
          <span className="text-xs font-bold text-[#000033] uppercase tracking-wide">Cliente:</span>
          
          <div className="relative min-w-[200px]">
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="appearance-none w-full pl-3 pr-8 py-1.5 bg-white border border-[#000033]/15 text-sm font-bold text-[#000033] rounded-lg focus:outline-none focus:border-[#024fff] cursor-pointer"
            >
              {clients.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-[#000033]/50 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Renderizar el Sumario de Contenidos */}
      {selectedClientId ? (
        <SumarioTab clientId={selectedClientId} />
      ) : (
        <div className="max-w-[1200px] mx-auto px-8 py-16 text-center text-[#000033]/50 text-sm">
          No hay clientes registrados en la plataforma.
        </div>
      )}
    </div>
  );
}
