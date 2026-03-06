import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Sparkles, Bold, Italic, Underline, List, ListOrdered,
  Link2, Image as ImageIcon, Type, Eye, Send, GripVertical, Check, AlertCircle,
} from 'lucide-react';
import { api } from '../lib/api';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Backlog', BRIEF: 'Brief', CONTENIDO: 'Contenido',
  DISENO: 'Diseño', REVISION: 'Revisión', APROBADO: 'Aprobado',
};

export function ContentPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [tone, setTone] = useState('');
  const [keywords, setKeywords] = useState('');
  const [outputLength, setOutputLength] = useState<'S' | 'M' | 'L'>('M');
  const [contentText, setContentText] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [aiPrompt, setAiPrompt] = useState('');
  const [chatWidth, setChatWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hola! Estoy lista para ayudarte a crear contenido. Podés pedirme que genere el contenido inicial o que haga modificaciones específicas.',
    },
  ]);

  const resizingRef = useRef(false);

  const { data: ticketData, isLoading } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => api.getTicket(ticketId!),
    enabled: !!ticketId,
  });

  useEffect(() => {
    if (ticketData?.data) {
      const t = ticketData.data;
      setTitle(t.title ?? '');
      setBrief(t.objetivo ?? '');
      setKeywords(t.keywords ?? '');
      setContentText(t.content ?? '');
      setCharCount((t.content ?? '').length);
    }
  }, [ticketData]);

  const saveMutation = useMutation({
    mutationFn: () => api.updateTicket(ticketId!, { title, objetivo: brief, keywords, content: contentText }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setHasChanges(false);
    },
  });

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContentText(e.target.value);
    setCharCount(e.target.value.length);
    setHasChanges(true);
  };

  const [isAiLoading, setIsAiLoading] = useState(false);

  const callAI = async (instruction: string) => {
    if (!ticketId || isAiLoading) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: instruction };
    const thinkingId = (Date.now() + 1).toString();
    const thinkingMsg: ChatMessage = { id: thinkingId, role: 'assistant', content: '...' };

    setChatMessages(prev => [...prev, userMsg, thinkingMsg]);
    setIsAiLoading(true);

    try {
      const result = await api.chatWithAI(ticketId, {
        instruction,
        currentContent: contentText,
        brief,
        tone,
        keywords,
        outputLength,
      });

      if (result.newContent !== null) {
        setContentText(result.newContent);
        setCharCount(result.newContent.length);
        setHasChanges(true);
      }

      setChatMessages(prev =>
        prev.map(m => m.id === thinkingId ? { ...m, content: result.summary } : m)
      );
    } catch (err: any) {
      setChatMessages(prev =>
        prev.map(m => m.id === thinkingId
          ? { ...m, content: `Error: ${err.message ?? 'No se pudo conectar con la IA'}` }
          : m
        )
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSendMessage = () => {
    if (!aiPrompt.trim()) return;
    const instruction = aiPrompt;
    setAiPrompt('');
    callAI(instruction);
  };

  const handleQuickAction = (action: string) => {
    callAI(action);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const newWidth = e.clientX;
      if (newWidth >= 250 && newWidth <= 600) setChatWidth(newWidth);
    };
    const onMouseUp = () => {
      resizingRef.current = false;
      setIsResizing(false);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const ticket = ticketData?.data;

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center bg-[#fafafa] text-[#000033]/60">
        Cargando...
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-[#fafafa]" style={{ userSelect: isResizing ? 'none' : 'auto' }}>
      {/* Header */}
      <div className="bg-white border-b-2 border-[#000033]/10 px-6 py-2.5 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/backlog')}
              className="flex items-center gap-2 text-[#000033]/60 hover:text-[#000033] font-medium text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver
            </button>
            <div className="h-5 w-px bg-[#000033]/20" />
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-[#000033]">{ticket?.title ?? '...'}</h1>
              {ticket?.client && (
                <span className="px-3 py-1 bg-[#024fff]/10 border-2 border-[#024fff]/20 text-[#024fff] text-sm font-bold rounded-lg">
                  {ticket.client.name}
                </span>
              )}
              {ticket?.status && (
                <span className="px-2.5 py-0.5 bg-[#00ff99]/20 border-2 border-[#00ff99]/40 text-[#000033] text-xs font-bold rounded-lg capitalize">
                  {STATUS_LABELS[ticket.status] ?? ticket.status}
                </span>
              )}
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
            <button className="flex items-center gap-2 px-3 py-1.5 border-2 border-[#000033]/10 rounded-lg text-[#000033] text-sm font-medium hover:bg-[#000033]/5 transition-all">
              <Eye className="w-4 h-4" />
              Vista previa
            </button>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!hasChanges || saveMutation.isPending}
              className="px-3 py-1.5 bg-[#024fff] text-white text-sm font-bold rounded-lg hover:bg-[#024fff]/90 transition-all shadow-lg shadow-[#024fff]/20 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 overflow-hidden flex min-h-0">
        {/* Left Sidebar: AI Chat - Resizable */}
        <div
          style={{ width: chatWidth }}
          className="bg-white border-r-2 border-[#000033]/10 flex flex-col min-h-0 relative flex-shrink-0"
        >
          {/* Chat Header */}
          <div className="px-3 py-2 border-b-2 border-[#000033]/10 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#024fff]" />
              <h3 className="text-xs font-bold text-[#000033]">Asistente IA</h3>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
            {chatMessages.map(message => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-2.5 py-1.5 rounded-lg text-xs leading-relaxed ${
                    message.role === 'user'
                      ? 'bg-[#024fff] text-white'
                      : message.content === '...'
                      ? 'bg-[#024fff]/10 text-[#024fff] animate-pulse'
                      : 'bg-[#000033]/5 text-[#000033]'
                  }`}
                >
                  {message.content === '...' ? 'Pensando...' : message.content}
                </div>
              </div>
            ))}
          </div>

          {/* Chat Input */}
          <div className="border-t-2 border-[#000033]/10 p-2.5 flex-shrink-0">
            <div className="flex gap-2">
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Escribe tu instrucción..."
                rows={2}
                disabled={isAiLoading}
                className="flex-1 px-2.5 py-1.5 border-2 border-[#000033]/10 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033] hover:border-[#024fff]/40 transition-all resize-none disabled:opacity-50"
              />
              <button
                onClick={handleSendMessage}
                disabled={isAiLoading || !aiPrompt.trim()}
                className="px-2.5 py-1.5 bg-[#024fff] text-white rounded-md hover:bg-[#024fff]/90 transition-all shadow-lg shadow-[#024fff]/20 h-fit self-end disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Resize Handle */}
          <div
            onMouseDown={e => {
              e.preventDefault();
              resizingRef.current = true;
              setIsResizing(true);
            }}
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-[#024fff]/20 transition-colors group"
          >
            <div className="absolute top-1/2 -translate-y-1/2 right-0 w-3 h-12 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical className="w-3 h-3 text-[#000033]/40" />
            </div>
          </div>
        </div>

        {/* Right Panel: Brief + Editor */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden min-h-0">
          {/* Brief Section */}
          <div className="bg-white border-b-2 border-[#000033]/10 px-6 py-2 flex-shrink-0">
            <div className="flex items-start gap-3">
              {/* Title */}
              <div className="flex-1">
                <label className="block text-[9px] font-bold text-[#000033]/60 mb-1">TÍTULO</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => { setTitle(e.target.value); setHasChanges(true); }}
                  className="w-full px-2.5 py-1.5 border-2 border-[#000033]/10 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033] hover:border-[#024fff]/40 transition-all"
                />
              </div>

              {/* Brief */}
              <div className="flex-[2]">
                <label className="block text-[9px] font-bold text-[#000033]/60 mb-1">BRIEF</label>
                <input
                  type="text"
                  value={brief}
                  onChange={e => { setBrief(e.target.value); setHasChanges(true); }}
                  className="w-full px-2.5 py-1.5 border-2 border-[#000033]/10 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033] hover:border-[#024fff]/40 transition-all"
                />
              </div>

              {/* Tone */}
              <div className="flex-1">
                <label className="block text-[9px] font-bold text-[#000033]/60 mb-1">TONO</label>
                <input
                  type="text"
                  value={tone}
                  onChange={e => setTone(e.target.value)}
                  placeholder="cercano, profesional..."
                  className="w-full px-2.5 py-1.5 border-2 border-[#000033]/10 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033] placeholder-[#000033]/30 hover:border-[#024fff]/40 transition-all"
                />
              </div>

              {/* Keywords */}
              <div className="flex-1">
                <label className="block text-[9px] font-bold text-[#000033]/60 mb-1">KEYWORDS</label>
                <input
                  type="text"
                  value={keywords}
                  onChange={e => { setKeywords(e.target.value); setHasChanges(true); }}
                  placeholder="palabra1, palabra2..."
                  className="w-full px-2.5 py-1.5 border-2 border-[#000033]/10 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033] placeholder-[#000033]/30 hover:border-[#024fff]/40 transition-all"
                />
              </div>

              {/* Output Length */}
              <div>
                <label className="block text-[9px] font-bold text-[#000033]/60 mb-1">LENGTH</label>
                <div className="flex gap-1">
                  {(['S', 'M', 'L'] as const).map(l => (
                    <button
                      key={l}
                      onClick={() => setOutputLength(l)}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                        outputLength === l
                          ? 'bg-[#024fff]/10 text-[#024fff] border-2 border-[#024fff]/20'
                          : 'border-2 border-[#000033]/10 text-[#000033]/60 hover:border-[#024fff]/40'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Brand Kit */}
              <div className="flex items-end">
                <button className="flex items-center gap-2 px-2.5 py-1.5 border-2 border-[#00ff99]/40 rounded-md bg-[#00ff99]/10 hover:bg-[#00ff99]/20 transition-all">
                  <div className="w-2 h-2 rounded-full bg-[#00ff99]" />
                  <span className="text-xs font-bold text-[#000033]">Kit de Marca</span>
                </button>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="border-b-2 border-[#000033]/10 px-4 py-1.5 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-0.5">
                <button className="p-1.5 hover:bg-[#000033]/5 rounded transition-all">
                  <Type className="w-3.5 h-3.5 text-[#000033]/60" />
                </button>
                <div className="w-px h-4 bg-[#000033]/10 mx-0.5" />
                <button className="p-1.5 hover:bg-[#000033]/5 rounded transition-all">
                  <Bold className="w-3.5 h-3.5 text-[#000033]/60" />
                </button>
                <button className="p-1.5 hover:bg-[#000033]/5 rounded transition-all">
                  <Italic className="w-3.5 h-3.5 text-[#000033]/60" />
                </button>
                <button className="p-1.5 hover:bg-[#000033]/5 rounded transition-all">
                  <Underline className="w-3.5 h-3.5 text-[#000033]/60" />
                </button>
                <div className="w-px h-4 bg-[#000033]/10 mx-0.5" />
                <button className="p-1.5 hover:bg-[#000033]/5 rounded transition-all">
                  <List className="w-3.5 h-3.5 text-[#000033]/60" />
                </button>
                <button className="p-1.5 hover:bg-[#000033]/5 rounded transition-all">
                  <ListOrdered className="w-3.5 h-3.5 text-[#000033]/60" />
                </button>
                <div className="w-px h-4 bg-[#000033]/10 mx-0.5" />
                <button className="p-1.5 hover:bg-[#000033]/5 rounded transition-all">
                  <Link2 className="w-3.5 h-3.5 text-[#000033]/60" />
                </button>
                <button className="p-1.5 hover:bg-[#000033]/5 rounded transition-all">
                  <ImageIcon className="w-3.5 h-3.5 text-[#000033]/60" />
                </button>
              </div>
              <span className="text-[10px] text-[#000033]/60">{charCount} caracteres</span>
            </div>
          </div>

          {/* Editor Area */}
          <div className="flex-1 overflow-y-auto px-8 py-4 min-h-0 relative">
            <textarea
              value={contentText}
              onChange={handleContentChange}
              className="w-full h-full resize-none border-none outline-none text-[#000033] text-sm leading-relaxed bg-transparent"
              placeholder="Empieza a escribir o pedile a la IA que genere contenido..."
            />

            {/* Floating Quick Actions */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/95 backdrop-blur-sm px-3 py-2 rounded-full border-2 border-[#00ff99]/30 shadow-lg">
              {[
                'Redactar nuevamente',
                'Reforzar tono',
                'Más conciso',
                'Regenerar hook',
              ].map(action => (
                <button
                  key={action}
                  onClick={() => handleQuickAction(action)}
                  disabled={isAiLoading}
                  className="px-3 py-1.5 bg-[#00ff99]/10 hover:bg-[#00ff99]/20 text-[#000033] text-xs font-bold rounded-full transition-all border border-[#00ff99]/40 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
