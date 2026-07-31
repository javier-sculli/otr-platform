import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronRight,
  Search,
  Layers,
  Inbox,
  TrendingUp,
} from 'lucide-react';
import { api } from '../lib/api';

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export function ReportesPage() {
  const navigate = useNavigate();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [activeTab, setActiveTab] = useState<'cumplimiento' | 'carga' | 'calidad'>('cumplimiento');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientModal, setSelectedClientModal] = useState<any | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['cumplimiento-clientes', selectedYear, selectedMonth],
    queryFn: () => api.getCumplimientoClientes(selectedYear, selectedMonth),
  });

  const reportData = data?.data;
  const summary = reportData?.summary;
  const calendarWeeks = reportData?.calendarWeeks ?? [];
  const weeksSummary = reportData?.weeksSummary ?? [];
  const clients = reportData?.clients ?? [];

  const filteredClients = clients.filter((c: any) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <div className="bg-white border-b-2 border-[#000033]/10 px-8 py-6">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#024fff]" />
                <h1 className="text-xl font-bold text-[#000033]">Reportes de Agencia</h1>
                <span className="px-2 py-0.5 bg-[#024fff]/10 text-[#024fff] text-[10px] font-extrabold rounded-full uppercase tracking-wider">
                  Solo Dirección
                </span>
              </div>
              <p className="text-xs text-[#000033]/60 mt-0.5">
                Seguimiento de entregas listas del mes, volumen en progreso, backlog y cumplimiento por semana.
              </p>
            </div>

            {/* Selector de Período */}
            <div className="flex items-center gap-2 bg-[#fafafa] p-1.5 rounded-xl border-2 border-[#000033]/10">
              <Calendar className="w-4 h-4 text-[#000033]/40 ml-2" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                className="bg-transparent text-xs font-bold text-[#000033] focus:outline-none cursor-pointer py-1 pr-2"
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className="bg-transparent text-xs font-bold text-[#000033] focus:outline-none cursor-pointer py-1 pr-2 border-l border-[#000033]/10 pl-2"
              >
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </select>
            </div>
          </div>

          {/* Sub-tabs bar */}
          <div className="flex items-center gap-2 border-b border-[#000033]/10">
            <button
              onClick={() => setActiveTab('cumplimiento')}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 ${
                activeTab === 'cumplimiento'
                  ? 'border-[#024fff] text-[#024fff]'
                  : 'border-transparent text-[#000033]/60 hover:text-[#000033]'
              }`}
            >
              Cumplimiento Clientes
            </button>
            <button
              disabled
              className="px-4 py-2.5 text-xs font-bold text-[#000033]/30 cursor-not-allowed flex items-center gap-1.5"
            >
              <span>Carga de Equipo</span>
              <span className="text-[9px] bg-[#000033]/5 text-[#000033]/40 px-1.5 py-0.5 rounded">Próximamente</span>
            </button>
            <button
              disabled
              className="px-4 py-2.5 text-xs font-bold text-[#000033]/30 cursor-not-allowed flex items-center gap-1.5"
            >
              <span>Calidad y Eficiencia</span>
              <span className="text-[9px] bg-[#000033]/5 text-[#000033]/40 px-1.5 py-0.5 rounded">Próximamente</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-8 py-8 space-y-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-[#000033]/60 text-sm font-medium">
            Cargando reporte de cumplimiento...
          </div>
        ) : isError ? (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 text-center text-red-700 text-sm">
            {(error as any)?.message || 'No tenés permisos para acceder a esta sección.'}
          </div>
        ) : (
          <>
            {/* 1. Tarjetas KPI Superiores (Listas, En Progreso, Backlog General, Alertas) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Card 1: Publicaciones Listas del Mes */}
              <div className="bg-white border-2 border-[#000033]/10 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#000033]/50 uppercase tracking-wide">
                    Publicaciones Listas (Mes)
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-3xl font-black text-emerald-600 mb-1">
                  {summary?.publicadasListas ?? 0}
                </div>
                <p className="text-xs text-[#000033]/60">
                  Completadas o listas para publicar en {MONTH_NAMES[selectedMonth - 1]}
                </p>
              </div>

              {/* Card 2: En Progreso */}
              <div className="bg-white border-2 border-[#000033]/10 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#000033]/50 uppercase tracking-wide">
                    En Progreso
                  </span>
                  <Layers className="w-4 h-4 text-[#024fff]" />
                </div>
                <div className="text-3xl font-black text-[#024fff] mb-1">
                  {summary?.enProgreso ?? 0}
                </div>
                <p className="text-xs text-[#000033]/60">
                  En redacción, diseño, edición o revisión
                </p>
              </div>

              {/* Card 3: Backlog General */}
              <div className="bg-white border-2 border-[#000033]/10 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#000033]/50 uppercase tracking-wide">
                    Backlog General
                  </span>
                  <Inbox className="w-4 h-4 text-[#000033]/60" />
                </div>
                <div className="text-3xl font-black text-[#000033] mb-1">
                  {summary?.backlogGeneral ?? 0}
                </div>
                <p className="text-xs text-[#000033]/60">
                  Tareas pendientes sin iniciar en el sistema
                </p>
              </div>

              {/* Card 4: Alertas (En Riesgo / Atrasos) */}
              <div className="bg-white border-2 border-[#000033]/10 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#000033]/50 uppercase tracking-wide">
                    Atención de Fechas
                  </span>
                  <AlertTriangle
                    className={`w-4 h-4 ${
                      (summary?.atrasadas ?? 0) > 0
                        ? 'text-rose-600'
                        : (summary?.enRiesgo ?? 0) > 0
                        ? 'text-amber-500'
                        : 'text-emerald-600'
                    }`}
                  />
                </div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xl font-black text-amber-600">
                    🟡 {summary?.enRiesgo ?? 0} <span className="text-xs font-bold text-[#000033]/60">riesgo</span>
                  </span>
                  <span className="text-xl font-black text-rose-600">
                    🔴 {summary?.atrasadas ?? 0} <span className="text-xs font-bold text-[#000033]/60">atraso</span>
                  </span>
                </div>
                <p className="text-xs text-[#000033]/60">Requieren seguimiento de dirección</p>
              </div>
            </div>

            {/* 2. Sección: Cumplimiento por Semana (Semanas Calendario: Lunes a Domingo) */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-[#000033] flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#024fff]" />
                    Cumplimiento por Semana (Fecha Objetivo - Lunes a Domingo)
                  </h3>
                  <p className="text-xs text-[#000033]/60">
                    Porcentaje de entregas a tiempo según las semanas calendario reales del mes
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {weeksSummary.map((w: any) => {
                  const pct = w.percentCumplimiento;
                  return (
                    <div
                      key={w.weekNumber}
                      className="bg-white border-2 border-[#000033]/10 rounded-xl p-5 shadow-sm hover:border-[#024fff]/40 transition-all"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-extrabold text-[#000033] uppercase tracking-wide">
                          Semana {w.weekNumber}
                        </span>
                        <span className="text-[10px] text-[#000033]/50 font-bold bg-[#000033]/5 px-2 py-0.5 rounded">
                          {w.startDay} al {w.endDay} {MONTH_NAMES[selectedMonth - 1].slice(0, 3)}
                        </span>
                      </div>

                      {/* Big Percentage */}
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-3xl font-black text-[#000033]">{pct}%</span>
                        <span className="text-xs font-bold text-[#000033]/50">
                          {w.completadas} / {w.total} listas
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-2 bg-[#000033]/10 rounded-full overflow-hidden mb-3">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct >= 90
                              ? 'bg-emerald-500'
                              : pct >= 60
                              ? 'bg-[#024fff]'
                              : pct > 0
                              ? 'bg-amber-500'
                              : 'bg-[#000033]/20'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      {/* Breakdown */}
                      <div className="text-[11px] text-[#000033]/60 space-y-1 font-medium pt-2 border-t border-[#000033]/5">
                        <div className="flex justify-between">
                          <span>Completadas:</span>
                          <span className="font-bold text-emerald-600">{w.completadas}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>En progreso:</span>
                          <span className="font-bold text-[#024fff]">{w.enProgreso}</span>
                        </div>
                        {w.atrasadas > 0 && (
                          <div className="flex justify-between text-rose-600 font-bold">
                            <span>Atrasadas:</span>
                            <span>{w.atrasadas}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Tabla Principal: Cumplimiento por Cliente */}
            <div className="bg-white border-2 border-[#000033]/10 rounded-xl overflow-hidden shadow-sm">
              {/* Table Header Controls */}
              <div className="p-5 border-b-2 border-[#000033]/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-[#000033]">Apertura de Demanda y Progreso por Cliente</h3>
                  <div className="flex items-center gap-4 text-xs text-[#000033]/60 mt-1">
                    <span>Leyenda por semana:</span>
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      🟢 Completadas / Listas
                    </span>
                    <span className="inline-flex items-center gap-1 font-bold text-[#024fff] bg-[#024fff]/5 px-1.5 py-0.5 rounded border border-[#024fff]/20">
                      🔵 En Progreso
                    </span>
                    <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                      🔴 Atrasadas
                    </span>
                  </div>
                </div>

                <div className="relative w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#000033]/40" />
                  <input
                    type="text"
                    placeholder="Filtrar cliente..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border-2 border-[#000033]/10 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033]"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#fafafa] border-b border-[#000033]/10 text-[11px] font-extrabold text-[#000033]/60 uppercase tracking-wider">
                      <th className="py-3.5 px-5">Cliente</th>
                      <th className="py-3.5 px-4 text-center border-r border-[#000033]/10">Target Mes</th>
                      
                      {/* Sub-columnas dinámicas por Semana Calendario */}
                      {calendarWeeks.map((w: any) => (
                        <th key={w.weekNumber} className="py-3.5 px-3 text-center border-r border-[#000033]/10 min-w-[110px]">
                          <div>Semana {w.weekNumber}</div>
                          <div className="text-[9px] font-semibold text-[#000033]/40 normal-case">
                            ({w.startDay} al {w.endDay} {MONTH_NAMES[selectedMonth - 1].slice(0, 3)})
                          </div>
                        </th>
                      ))}

                      <th className="py-3.5 px-4 text-center">Total Mes</th>
                      <th className="py-3.5 px-4">Cumplimiento Target</th>
                      <th className="py-3.5 px-4 text-center">Estado / Alertas</th>
                      <th className="py-3.5 px-4 text-right">Detalles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#000033]/5 text-xs text-[#000033]">
                    {filteredClients.length === 0 ? (
                      <tr>
                        <td colSpan={6 + calendarWeeks.length} className="py-8 text-center text-[#000033]/40 text-xs">
                          No se encontraron clientes para este período
                        </td>
                      </tr>
                    ) : (
                      filteredClients.map((client: any) => {
                        const hasTarget = client.monthlyContentTarget > 0;
                        const pct = client.percentCumplimiento;
                        const hasRiesgo = client.statusBreakdown.enRiesgo > 0;
                        const hasAtraso = client.statusBreakdown.atrasadas > 0;

                        return (
                          <tr
                            key={client.id}
                            className="hover:bg-[#024fff]/5 transition-colors cursor-pointer"
                            onClick={() => setSelectedClientModal(client)}
                          >
                            {/* Cliente */}
                            <td className="py-4 px-5 font-bold text-[#000033]">
                              <span className="hover:text-[#024fff] transition-colors">{client.name}</span>
                            </td>

                            {/* Target Mes */}
                            <td className="py-4 px-4 text-center border-r border-[#000033]/10">
                              {hasTarget ? (
                                <span className="px-2 py-0.5 bg-[#024fff]/10 text-[#024fff] font-bold text-xs rounded-md">
                                  {client.monthlyContentTarget} pz
                                </span>
                              ) : (
                                <span className="text-[#000033]/30 text-[11px] font-medium">Sin target</span>
                              )}
                            </td>

                            {/* Celdas Semanales con Desglose: Completadas (verde), En Progreso (azul), Atrasadas (rojo) */}
                            {client.weeksBreakdown.map((wb: any) => {
                              const total = wb.total;
                              return (
                                <td key={wb.weekNumber} className="py-4 px-3 text-center border-r border-[#000033]/10">
                                  {total === 0 ? (
                                    <span className="text-[#000033]/20 font-medium">-</span>
                                  ) : (
                                    <div className="flex items-center justify-center gap-1 font-bold text-[11px]">
                                      {/* Completadas / Listas */}
                                      <span
                                        className={`px-1.5 py-0.5 rounded ${
                                          wb.completadas > 0
                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                            : 'bg-gray-100 text-gray-400'
                                        }`}
                                        title="Completadas / Listas"
                                      >
                                        {wb.completadas}
                                      </span>

                                      {/* En Progreso */}
                                      <span
                                        className={`px-1.5 py-0.5 rounded ${
                                          wb.enProgreso > 0
                                            ? 'bg-[#024fff]/10 text-[#024fff] border border-[#024fff]/20'
                                            : 'bg-gray-100 text-gray-400'
                                        }`}
                                        title="En Progreso"
                                      >
                                        {wb.enProgreso}
                                      </span>

                                      {/* Atrasadas */}
                                      {wb.atrasadas > 0 && (
                                        <span
                                          className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300"
                                          title="Atrasadas"
                                        >
                                          {wb.atrasadas}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>
                              );
                            })}

                            {/* Total Mes */}
                            <td className="py-4 px-4 text-center font-black text-sm text-[#000033]">
                              {client.totalMonth}
                            </td>

                            {/* Cumplimiento Target % */}
                            <td className="py-4 px-4">
                              {hasTarget ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-2 bg-[#000033]/10 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${
                                        pct >= 100
                                          ? 'bg-emerald-500'
                                          : pct >= 70
                                          ? 'bg-[#024fff]'
                                          : 'bg-amber-500'
                                      }`}
                                      style={{ width: `${Math.min(pct, 100)}%` }}
                                    />
                                  </div>
                                  <span className="font-bold text-xs text-[#000033]">{pct}%</span>
                                </div>
                              ) : (
                                <span className="text-xs text-[#000033]/40">{client.totalMonth} tareas acumuladas</span>
                              )}
                            </td>

                            {/* Estado y Alertas */}
                            <td className="py-4 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {hasAtraso && (
                                  <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[11px] font-bold rounded-md flex items-center gap-1">
                                    🔴 {client.statusBreakdown.atrasadas} atraso
                                  </span>
                                )}
                                {hasRiesgo && (
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[11px] font-bold rounded-md flex items-center gap-1">
                                    🟡 {client.statusBreakdown.enRiesgo} riesgo
                                  </span>
                                )}
                                {!hasAtraso && !hasRiesgo && (
                                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-md flex items-center gap-1">
                                    🟢 Al día
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Detalle Link */}
                            <td className="py-4 px-4 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedClientModal(client);
                                }}
                                className="px-2.5 py-1 text-xs font-bold text-[#024fff] bg-[#024fff]/10 rounded-lg hover:bg-[#024fff]/20 transition-all inline-flex items-center gap-1"
                              >
                                Ver
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal Detalle Cliente */}
      {selectedClientModal && (
        <ModalDetalleCumplimiento
          client={selectedClientModal}
          onClose={() => setSelectedClientModal(null)}
          onNavigateTicket={(id) => navigate(`/piezas/${id}`)}
        />
      )}
    </div>
  );
}

function ModalDetalleCumplimiento({
  client,
  onClose,
  onNavigateTicket,
}: {
  client: any;
  onClose: () => void;
  onNavigateTicket: (id: string) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b-2 border-[#000033]/10 flex items-center justify-between bg-[#fafafa]">
          <div>
            <h2 className="text-base font-bold text-[#000033]">{client.name}</h2>
            <p className="text-xs text-[#000033]/60">
              {client.monthlyContentTarget > 0
                ? `Target Mensual: ${client.monthlyContentTarget} piezas (${client.percentCumplimiento}% alcanzado)`
                : 'Sin target asignado'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-bold text-[#000033]/60 hover:text-[#000033] border border-[#000033]/10 rounded-lg hover:bg-[#000033]/5"
          >
            Cerrar
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Resumen de alertas del cliente */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <div className="text-lg font-black text-emerald-700">
                {client.statusBreakdown.publicadas}
              </div>
              <div className="text-[11px] font-bold text-emerald-800">Publicadas / Listas</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="text-lg font-black text-amber-700">
                {client.statusBreakdown.enRiesgo}
              </div>
              <div className="text-[11px] font-bold text-amber-800">En Riesgo (Próx. 48h)</div>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
              <div className="text-lg font-black text-rose-700">
                {client.statusBreakdown.atrasadas}
              </div>
              <div className="text-[11px] font-bold text-rose-800">Atrasadas</div>
            </div>
          </div>

          {/* Tickets Atrasados */}
          {client.ticketsAtrasados.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Tickets Atrasados ({client.ticketsAtrasados.length})
              </h4>
              <div className="space-y-2">
                {client.ticketsAtrasados.map((t: any) => (
                  <div
                    key={t.id}
                    onClick={() => onNavigateTicket(t.id)}
                    className="p-3 bg-rose-50/60 border border-rose-200 rounded-lg flex items-center justify-between hover:bg-rose-100/60 cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="text-xs font-bold text-[#000033]">{t.title}</p>
                      <p className="text-[11px] text-[#000033]/60">
                        {t.typeName} · Responsable: {t.ownerName}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 bg-rose-600 text-white text-[10px] font-bold rounded">
                      Ver ticket
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tickets En Riesgo */}
          {client.ticketsEnRiesgo.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Tickets En Riesgo ({client.ticketsEnRiesgo.length})
              </h4>
              <div className="space-y-2">
                {client.ticketsEnRiesgo.map((t: any) => (
                  <div
                    key={t.id}
                    onClick={() => onNavigateTicket(t.id)}
                    className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg flex items-center justify-between hover:bg-amber-100/60 cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="text-xs font-bold text-[#000033]">{t.title}</p>
                      <p className="text-[11px] text-[#000033]/60">
                        {t.typeName} · Responsable: {t.ownerName}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded">
                      Ver ticket
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {client.ticketsAtrasados.length === 0 && client.ticketsEnRiesgo.length === 0 && (
            <div className="py-6 text-center text-xs text-[#000033]/60 bg-[#fafafa] rounded-lg border-2 border-dashed border-[#000033]/10">
              ✨ Este cliente no tiene tickets atrasados ni en riesgo en este período.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
