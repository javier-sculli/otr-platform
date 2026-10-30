import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Brain, Search, Plus, Calendar, User, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { AddDocumentModal } from '../components/knowledge/AddDocumentModal';
import { DocumentDetailDrawer } from '../components/knowledge/DocumentDetailDrawer';
import { KnowledgeChatPanel } from '../components/knowledge/KnowledgeChatPanel';
import type { KnowledgeDocument } from '@otr/types';

const FILTER_PILLS = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'REUNION', label: 'Reuniones' },
  { id: 'FEEDBACK', label: 'Feedbacks' },
  { id: 'DOCUMENTO', label: 'Documentos' },
  { id: 'CLAUDE_CHAT', label: 'Claude Chats' },
  { id: 'NOTA', label: 'Notas' },
];

const TYPE_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  REUNION: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  FEEDBACK: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  DOCUMENTO: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  CLAUDE_CHAT: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  NOTA: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
};

export function KnowledgeBasePage() {
  const queryClient = useQueryClient();

  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('TODOS');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [documentToEdit, setDocumentToEdit] = useState<KnowledgeDocument | null>(null);
  const [selectedDocForDrawer, setSelectedDocForDrawer] = useState<KnowledgeDocument | null>(null);
  const [mobileTab, setMobileTab] = useState<'docs' | 'chat'>('docs');

  // Load Clients
  const { data: clientsData, isLoading: isLoadingClients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.getClients(),
  });

  const clients = useMemo(() => {
    return (clientsData?.data ?? []).filter((c: any) => c.active);
  }, [clientsData]);

  // Set default client once loaded
  const activeClientId = selectedClientId || (clients[0]?.id ?? '');
  const activeClient = clients.find((c: any) => c.id === activeClientId);

  // Load Speakers for selected client
  const { data: speakersData } = useQuery({
    queryKey: ['speakers', activeClientId],
    queryFn: () => api.getSpeakers(activeClientId),
    enabled: !!activeClientId,
  });

  const speakers = speakersData?.data ?? [];

  // Load Knowledge Documents
  const { data: docsData, isLoading: isLoadingDocs } = useQuery({
    queryKey: ['knowledge-documents', activeClientId, selectedSpeakerId, selectedType, searchQuery],
    queryFn: () =>
      api.getKnowledgeDocuments({
        clientId: activeClientId,
        speakerId: selectedSpeakerId || undefined,
        type: selectedType !== 'TODOS' ? selectedType : undefined,
        search: searchQuery || undefined,
      }),
    enabled: !!activeClientId,
  });

  const documents: KnowledgeDocument[] = docsData?.data ?? [];

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteKnowledgeDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-documents', activeClientId] });
    },
  });

  const handleOpenDocById = (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    if (doc) {
      setSelectedDocForDrawer(doc);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#fafafa]">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
            <Brain className="w-5 h-5 text-[#024fff]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">
              Knowledge Base & Cerebro
            </h1>
            <p className="text-xs text-slate-500">
              Repositorio consolidado de reuniones, directivas, feedbacks y contexto por cliente.
            </p>
          </div>
        </div>

        {/* Client Selector & Add CTA */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500">Cliente:</label>
            <select
              value={activeClientId}
              onChange={e => {
                setSelectedClientId(e.target.value);
                setSelectedSpeakerId('');
              }}
              disabled={isLoadingClients || clients.length === 0}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
            >
              {clients.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              setDocumentToEdit(null);
              setShowAddModal(true);
            }}
            disabled={!activeClientId}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#024fff] text-white rounded-lg hover:bg-[#024fff]/90 transition-colors shadow-xs disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            + Cargar Documento
          </button>
        </div>
      </div>

      {/* Mobile Tab Switcher */}
      <div className="sm:hidden flex border-b border-slate-200 bg-white">
        <button
          onClick={() => setMobileTab('docs')}
          className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 ${
            mobileTab === 'docs' ? 'border-[#024fff] text-[#024fff]' : 'border-transparent text-slate-500'
          }`}
        >
          Documentos ({documents.length})
        </button>
        <button
          onClick={() => setMobileTab('chat')}
          className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 ${
            mobileTab === 'chat' ? 'border-[#024fff] text-[#024fff]' : 'border-transparent text-slate-500'
          }`}
        >
          Chat con la Base
        </button>
      </div>

      {/* Main Two-Column Container */}
      <div className="flex-1 flex overflow-hidden p-4 sm:p-6 gap-6">
        {/* Left Column: Filters and Documents List */}
        <div
          className={`flex-1 flex flex-col min-w-0 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden ${
            mobileTab === 'chat' ? 'hidden sm:flex' : 'flex'
          }`}
        >
          {/* Filter Bar */}
          <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/50">
            {/* Search and Speaker Filter */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar en transcripciones, directivas, tags..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {speakers.length > 0 && (
                <select
                  value={selectedSpeakerId}
                  onChange={e => setSelectedSpeakerId(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                >
                  <option value="">Todos los voceros & marca</option>
                  {speakers.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Type Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {FILTER_PILLS.map(pill => {
                const isSelected = selectedType === pill.id;
                return (
                  <button
                    key={pill.id}
                    onClick={() => setSelectedType(pill.id)}
                    className={`px-2.5 py-1 text-xs rounded-full whitespace-nowrap font-medium transition-colors ${
                      isSelected
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Documents Grid / Feed */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoadingDocs ? (
              <div className="flex items-center justify-center py-20 text-slate-400 text-xs">
                Cargando base de conocimiento...
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                  <Brain className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">
                  No hay documentos que coincidan
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
                  Podés cargar transcripciones de Google Meet, notas de WhatsApp, decks o directivas de estilo.
                </p>
                <button
                  onClick={() => {
                    setDocumentToEdit(null);
                    setShowAddModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Cargar Primer Documento
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {documents.map(doc => {
                  const typeBadge = TYPE_BADGES[doc.type.toUpperCase()] || TYPE_BADGES.NOTA;
                  const dateStr = new Date(doc.date).toLocaleDateString('es-AR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });

                  return (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedDocForDrawer(doc)}
                      className="group p-4 bg-white border border-slate-200/90 rounded-xl hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer space-y-2.5"
                    >
                      {/* Top Row: Type, Date, Speaker */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${typeBadge.bg} ${typeBadge.text} ${typeBadge.border}`}
                          >
                            {doc.type}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Calendar className="w-3 h-3" />
                            {dateStr}
                          </span>
                          {doc.speakerId && (
                            <span className="flex items-center gap-1 text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                              <User className="w-3 h-3 text-slate-400" />
                              Vocero
                            </span>
                          )}
                        </div>

                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                      </div>

                      {/* Title */}
                      <h4 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {doc.title}
                      </h4>

                      {/* Summary or Snippet */}
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {doc.summary || doc.content}
                      </p>

                      {/* Tags */}
                      {doc.tags && doc.tags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap pt-1">
                          {doc.tags.map(t => (
                            <span
                              key={t}
                              className="text-[10px] bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Knowledge Assistant Q&A Chat */}
        <div
          className={`w-full sm:w-[420px] lg:w-[480px] shrink-0 h-full ${
            mobileTab === 'docs' ? 'hidden sm:block' : 'block'
          }`}
        >
          {activeClient && (
            <KnowledgeChatPanel
              clientId={activeClient.id}
              clientName={activeClient.name}
              speakerId={selectedSpeakerId}
              documents={documents}
              onOpenDocumentDetail={handleOpenDocById}
            />
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {activeClientId && (
        <AddDocumentModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          clientId={activeClientId}
          speakers={speakers}
          documentToEdit={documentToEdit}
        />
      )}

      {/* View Detail Drawer */}
      <DocumentDetailDrawer
        document={selectedDocForDrawer}
        isOpen={!!selectedDocForDrawer}
        onClose={() => setSelectedDocForDrawer(null)}
        onDelete={id => deleteMutation.mutate(id)}
        onEdit={doc => {
          setSelectedDocForDrawer(null);
          setDocumentToEdit(doc);
          setShowAddModal(true);
        }}
      />
    </div>
  );
}
