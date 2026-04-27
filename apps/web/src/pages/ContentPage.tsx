import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Sparkles, Bold, Italic, Underline, List, ListOrdered,
  Link2, Image as ImageIcon, Type, Eye, Send, GripVertical, Check, AlertCircle,
  Paperclip, X, FileText, File, ExternalLink, Mic, Trash2,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { api } from '../lib/api';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).href;

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type AttachedFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string | null;       // texto plano o base64 dataURL para imágenes
  contentType: 'text' | 'image' | 'other';
};

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Backlog', BRIEF: 'Brief', CONTENIDO: 'Contenido',
  DISENO: 'Diseño', REVISION: 'Revisión', APROBADO: 'Aprobado',
};

const QUICK_ACTIONS = ['Redactar', 'Reforzar tono', 'Más conciso', 'Regenerar hook'];

export function ContentPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [tone] = useState('');
  const [keywords, setKeywords] = useState('');
  const [contextLinks, setContextLinks] = useState<string[]>([]);
  const [linkEntregable, setLinkEntregable] = useState<string | null>(null);
  const [editingEntregable, setEditingEntregable] = useState(false);
  const [entregableInput, setEntregableInput] = useState('');
  const [addingLink, setAddingLink] = useState(false);
  const [newLinkInput, setNewLinkInput] = useState('');
  const [outputLength] = useState<'S' | 'M' | 'L'>('M');
  const [contentText, setContentText] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [canales, setCanales] = useState<string[]>([]);
  const [activeCanal, setActiveCanal] = useState<string>('');
  const [contentPerCanal, setContentPerCanal] = useState<Record<string, string>>({});

  const [aiPrompt, setAiPrompt] = useState('');
  const [chatWidth, setChatWidth] = useState(480);
  const [isResizing, setIsResizing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hola! Estoy lista para ayudarte. Podés pedirme que genere el contenido inicial o hacer modificaciones específicas.',
    },
  ]);

  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const resizingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: ticketData, isLoading } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => api.getTicket(ticketId!),
    enabled: !!ticketId,
  });

  const [chatHistoryLoaded, setChatHistoryLoaded] = useState(false);
  const [contentLoaded, setContentLoaded] = useState(false);

  useEffect(() => {
    if (ticketData?.data) {
      const t = ticketData.data;
      setTitle(t.title ?? '');
      setBrief(t.objetivo ?? '');
      setKeywords(t.keywords ?? '');
      setContextLinks(t.links ?? []);
      setLinkEntregable(t.linkEntregable ?? null);

      if (!contentLoaded) {
        const canalList: string[] = t.canales?.length > 0 ? t.canales : ['LinkedIn'];
        const perCanal: Record<string, string> = t.contentPerCanal && typeof t.contentPerCanal === 'object' ? t.contentPerCanal as Record<string, string> : {};
        if (Object.keys(perCanal).length === 0 && t.content) {
          perCanal[canalList[0]] = t.content;
        }
        setCanales(canalList);
        setContentPerCanal(perCanal);
        const initialCanal = canalList[0];
        setActiveCanal(initialCanal);
        const initialContent = perCanal[initialCanal] ?? '';
        setContentText(initialContent);
        setCharCount(initialContent.length);
        setContentLoaded(true);
      }

      if (!chatHistoryLoaded && Array.isArray(t.chatHistory) && t.chatHistory.length > 0) {
        setChatMessages(t.chatHistory as ChatMessage[]);
      }
      setChatHistoryLoaded(true);
    }
  }, [ticketData]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const saveMutation = useMutation({
    mutationFn: () => api.updateTicket(ticketId!, {
      title,
      objetivo: brief,
      keywords,
      content: contentText,
      contentPerCanal,
      links: contextLinks,
      linkEntregable: linkEntregable || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setHasChanges(false);
    },
  });

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContentText(val);
    setCharCount(val.length);
    setContentPerCanal(prev => ({ ...prev, [activeCanal]: val }));
    setHasChanges(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const id = `${Date.now()}-${file.name}`;
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      const isText = file.type.startsWith('text/') || /\.(txt|md|csv)$/i.test(file.name);

      if (isPdf) {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const arrayBuffer = ev.target?.result as ArrayBuffer;
          try {
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const pages = await Promise.all(
              Array.from({ length: pdf.numPages }, (_, i) =>
                pdf.getPage(i + 1).then(p => p.getTextContent()).then(tc =>
                  tc.items.map((item: any) => item.str).join(' ')
                )
              )
            );
            const content = pages.join('\n\n');
            setAttachedFiles(prev => [...prev, { id, name: file.name, type: file.type, size: file.size, content, contentType: 'text' }]);
          } catch {
            setAttachedFiles(prev => [...prev, { id, name: file.name, type: file.type, size: file.size, content: null, contentType: 'other' }]);
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (isImage) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const content = ev.target?.result as string;
          setAttachedFiles(prev => [...prev, { id, name: file.name, type: file.type, size: file.size, content, contentType: 'image' }]);
        };
        reader.readAsDataURL(file);
      } else if (isText) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const content = ev.target?.result as string;
          setAttachedFiles(prev => [...prev, { id, name: file.name, type: file.type, size: file.size, content, contentType: 'text' }]);
        };
        reader.readAsText(file);
      } else {
        setAttachedFiles(prev => [...prev, { id, name: file.name, type: file.type, size: file.size, content: null, contentType: 'other' }]);
      }
    });

    e.target.value = '';
  };

  const handleRemoveFile = (id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  const callAI = async (instruction: string) => {
    if (!ticketId || isAiLoading) return;

    const attachments = attachedFiles
      .filter(f => f.content !== null)
      .map(f => ({ name: f.name, type: f.type, content: f.content!, contentType: f.contentType }));

    // Historial previo — excluye thinking y el saludo inicial
    const history = chatMessages
      .filter(m => m.content !== '...' && m.id !== '1')
      .map(m => ({ role: m.role, content: m.content }));

    const fullInstruction = instruction;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: instruction };
    const thinkingId = (Date.now() + 1).toString();
    const thinkingMsg: ChatMessage = { id: thinkingId, role: 'assistant', content: '...' };

    setChatMessages(prev => [...prev, userMsg, thinkingMsg]);
    setIsAiLoading(true);

    try {
      {
        const result = await api.chatWithAI(ticketId, {
          instruction: fullInstruction, currentContent: contentText, brief, tone, keywords, outputLength, model: 'claude-sonnet-4-6', attachments, history, canal: activeCanal,
        });

        if (result.newContent !== null) {
          const updated = { ...contentPerCanal, [activeCanal]: result.newContent };
          setContentText(result.newContent);
          setCharCount(result.newContent.length);
          setContentPerCanal(updated);
          setHasChanges(false);
          api.updateTicket(ticketId!, {
            title,
            objetivo: brief,
            keywords,
            content: result.newContent,
            contentPerCanal: updated,
            links: contextLinks,
            linkEntregable: linkEntregable || null,
          }).then(() => {
            queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
          }).catch(() => {});
        }

        setChatMessages(prev => {
          const updated = prev.map(m => m.id === thinkingId ? { ...m, content: result.summary } : m);
          api.saveChatHistory(ticketId, updated).catch(() => {});
          return updated;
        });
      }
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

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const newWidth = e.clientX;
      if (newWidth >= 220 && newWidth <= 480) setChatWidth(newWidth);
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
    <div className="h-[calc(100vh-64px)] flex flex-col bg-[#fafafa] overflow-hidden" style={{ userSelect: isResizing ? 'none' : 'auto' }}>
      {/* Header */}
      <div className="bg-white border-b-2 border-[#000033]/10 px-6 py-2.5 flex-shrink-0">
        <div className="flex items-center justify-between min-w-0">
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => navigate('/backlog')}
              className="flex items-center gap-2 text-[#000033]/60 hover:text-[#000033] font-medium text-sm transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver
            </button>
            <div className="h-5 w-px bg-[#000033]/20 flex-shrink-0" />
            <div className="flex items-center gap-3 min-w-0 overflow-hidden">
              <h1 className="text-lg font-bold text-[#000033] truncate">{ticket?.title ?? '...'}</h1>
              {ticket?.client && (
                <span className="px-3 py-1 bg-[#024fff]/10 border-2 border-[#024fff]/20 text-[#024fff] text-sm font-bold rounded-lg flex-shrink-0">
                  {ticket.client.name}
                </span>
              )}
              {(ticket as any)?.speaker && (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-[#000033]/5 border-2 border-[#000033]/10 text-[#000033] text-sm font-bold rounded-lg flex-shrink-0">
                  <Mic className="w-3.5 h-3.5 text-[#024fff]" />
                  {(ticket as any).speaker.nombre}
                </span>
              )}
              {ticket?.status && (
                <span className="px-2.5 py-0.5 bg-[#00ff99]/20 border-2 border-[#00ff99]/40 text-[#000033] text-xs font-bold rounded-lg capitalize flex-shrink-0">
                  {STATUS_LABELS[ticket.status] ?? ticket.status}
                </span>
              )}
              <div className="h-4 w-px bg-[#000033]/20 flex-shrink-0" />
              {editingEntregable ? (
                <form
                  className="flex items-center gap-1 flex-shrink-0"
                  onSubmit={e => {
                    e.preventDefault();
                    const url = entregableInput.trim() || null;
                    setLinkEntregable(url);
                    setHasChanges(true);
                    setEditingEntregable(false);
                  }}
                >
                  <input
                    autoFocus
                    type="url"
                    value={entregableInput}
                    onChange={e => setEntregableInput(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="px-2 py-0.5 border border-[#00ff99]/50 rounded text-xs text-[#000033] focus:outline-none focus:ring-1 focus:ring-[#00ff99] w-52"
                  />
                  <button type="submit" className="text-xs px-1.5 py-0.5 bg-[#00ff99]/30 border border-[#00ff99]/50 rounded font-bold hover:bg-[#00ff99]/50 transition-all">OK</button>
                  <button type="button" onClick={() => setEditingEntregable(false)} className="text-xs px-1.5 py-0.5 border border-[#000033]/10 rounded hover:bg-[#000033]/5 transition-all">✕</button>
                </form>
              ) : linkEntregable ? (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <a
                    href={linkEntregable}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2 py-1 border border-[#00ff99]/40 rounded-md bg-[#00ff99]/10 hover:bg-[#00ff99]/20 text-xs font-bold text-[#000033] transition-all"
                  >
                    <ImageIcon className="w-3 h-3" />
                    Entregable
                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                  </a>
                  <button
                    onClick={() => { setEntregableInput(linkEntregable); setEditingEntregable(true); }}
                    className="p-0.5 hover:bg-[#000033]/5 rounded transition-all text-[#000033]/40 hover:text-[#000033]"
                    title="Editar link entregable"
                  >
                    <Link2 className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setEntregableInput(''); setEditingEntregable(true); }}
                  className="flex items-center gap-1 px-2 py-1 border border-dashed border-[#000033]/20 rounded-md text-xs text-[#000033]/40 hover:border-[#00ff99]/40 hover:text-[#000033] transition-all flex-shrink-0"
                >
                  <Link2 className="w-3 h-3" />
                  + Entregable
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#024fff]" />
                <h3 className="text-xs font-bold text-[#000033]">Asistente IA</h3>
                <span className="px-1.5 py-0.5 bg-[#024fff]/10 text-[#024fff] text-xs font-bold rounded">
                    Claude
                  </span>
              </div>
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
                  className={`max-w-[88%] px-2.5 py-1.5 rounded-lg text-xs leading-relaxed whitespace-pre-wrap ${
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
            <div ref={chatEndRef} />
          </div>

          {/* Quick Actions — chips sobre el input */}
          <div className="border-t-2 border-[#000033]/10 px-2.5 pt-2 flex-shrink-0">
            <div className="flex gap-1 flex-wrap">
              {QUICK_ACTIONS.map(action => (
                <button
                  key={action}
                  onClick={() => callAI(action)}
                  disabled={isAiLoading}
                  className="px-2 py-1 bg-[#00ff99]/10 hover:bg-[#00ff99]/20 text-[#000033] text-xs font-bold rounded-full transition-all border border-[#00ff99]/40 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Input */}
          <div className="px-2.5 pb-2.5 pt-2 flex-shrink-0">
            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isAiLoading}
                title="Adjuntar archivo"
                className="px-2 py-1.5 border-2 border-[#000033]/10 rounded-md hover:bg-[#000033]/5 transition-all h-fit self-end disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Paperclip className="w-3.5 h-3.5 text-[#000033]/60" />
              </button>
              <button
                onClick={() => {
                  setChatMessages([]);
                  api.saveChatHistory(ticketId!, []).catch(() => {});
                }}
                disabled={isAiLoading || chatMessages.length === 0}
                title="Limpiar chat"
                className="px-2 py-1.5 border-2 border-[#000033]/10 rounded-md hover:bg-red-50 hover:border-red-200 transition-all h-fit self-end disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                <Trash2 className="w-3.5 h-3.5 text-[#000033]/60 group-hover:text-red-400 transition-colors" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png,.txt,.md,.csv,.doc,.docx,image/*"
                multiple
                className="hidden"
              />
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
        <div className="flex-1 flex flex-col bg-white overflow-hidden min-h-0 min-w-0">

          {/* Brief Section — 2 rows para que no se achique en zoom alto */}
          <div className="bg-white border-b-2 border-[#000033]/10 px-4 py-2 flex-shrink-0">
            {/* Fila 1: Título + Brief */}
            <div className="flex items-start gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-bold text-[#000033]/60 mb-1">BRIEF</label>
                <input
                  type="text"
                  value={brief}
                  onChange={e => { setBrief(e.target.value); setHasChanges(true); }}
                  className="w-full px-2.5 py-1.5 border-2 border-[#000033]/10 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033] hover:border-[#024fff]/40 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Barra de Contexto: links de recursos + archivos adjuntos */}
          <div className="bg-[#fafafa] border-b border-[#000033]/10 px-4 py-1.5 flex-shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-[#000033]/50 uppercase flex-shrink-0">Contexto:</span>
                {contextLinks.map((link, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1 px-2 py-0.5 bg-white border border-[#024fff]/20 rounded text-xs font-medium text-[#024fff] group"
                  >
                    <Link2 className="w-2.5 h-2.5 flex-shrink-0" />
                    <a href={link} target="_blank" rel="noopener noreferrer" className="max-w-[160px] truncate hover:underline">
                      {link.split('/').pop() || link}
                    </a>
                    <ExternalLink className="w-2 h-2 opacity-40 flex-shrink-0" />
                    <button
                      onClick={() => { setContextLinks(prev => prev.filter((_, j) => j !== i)); setHasChanges(true); }}
                      className="hover:bg-[#000033]/10 rounded-full p-0.5 transition-all ml-0.5"
                    >
                      <X className="w-2.5 h-2.5 text-[#000033]/40" />
                    </button>
                  </div>
                ))}
                {attachedFiles.map(file => (
                  <div
                    key={file.id}
                    className="flex items-center gap-1 px-2 py-0.5 bg-white border border-[#00ff99]/30 rounded text-xs font-medium text-[#000033]"
                  >
                    {file.type.startsWith('image/') ? (
                      <ImageIcon className="w-2.5 h-2.5 text-[#00ff99] flex-shrink-0" />
                    ) : file.type.includes('pdf') ? (
                      <FileText className="w-2.5 h-2.5 text-[#00ff99] flex-shrink-0" />
                    ) : (
                      <File className="w-2.5 h-2.5 text-[#00ff99] flex-shrink-0" />
                    )}
                    <span className="max-w-[140px] truncate">{file.name}</span>
                    <button
                      onClick={() => handleRemoveFile(file.id)}
                      className="hover:bg-[#000033]/10 rounded-full p-0.5 transition-all ml-0.5"
                    >
                      <X className="w-2.5 h-2.5 text-[#000033]/40" />
                    </button>
                  </div>
                ))}
                {addingLink ? (
                  <form
                    className="flex items-center gap-1"
                    onSubmit={e => {
                      e.preventDefault();
                      const url = newLinkInput.trim();
                      if (url && !contextLinks.includes(url)) {
                        setContextLinks(prev => [...prev, url]);
                        setHasChanges(true);
                      }
                      setNewLinkInput('');
                      setAddingLink(false);
                    }}
                  >
                    <input
                      autoFocus
                      type="url"
                      value={newLinkInput}
                      onChange={e => setNewLinkInput(e.target.value)}
                      onBlur={() => {
                        const url = newLinkInput.trim();
                        if (url && !contextLinks.includes(url)) {
                          setContextLinks(prev => [...prev, url]);
                          setHasChanges(true);
                        }
                        setNewLinkInput('');
                        setAddingLink(false);
                      }}
                      placeholder="https://..."
                      className="px-2 py-0.5 border border-[#024fff]/30 rounded text-xs text-[#000033] focus:outline-none focus:ring-1 focus:ring-[#024fff] w-44"
                    />
                    <button type="submit" className="text-xs px-1.5 py-0.5 bg-[#024fff]/10 border border-[#024fff]/20 rounded font-bold text-[#024fff] hover:bg-[#024fff]/20 transition-all">OK</button>
                    <button type="button" onClick={() => { setAddingLink(false); setNewLinkInput(''); }} className="text-xs px-1.5 py-0.5 border border-[#000033]/10 rounded hover:bg-[#000033]/5 transition-all">✕</button>
                  </form>
                ) : (
                  <button
                    onClick={() => setAddingLink(true)}
                    className="flex items-center gap-1 px-2 py-0.5 border border-dashed border-[#024fff]/20 rounded text-xs text-[#024fff]/50 hover:text-[#024fff] hover:border-[#024fff]/40 transition-all"
                  >
                    <Link2 className="w-2.5 h-2.5" />
                    + link
                  </button>
                )}
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
              <span className="text-xs text-[#000033]/60">{charCount} caracteres</span>
            </div>
          </div>

          {/* Tabs por canal */}
          {canales.length > 0 && (
            <div className="flex items-center gap-1 px-6 pt-3 pb-0 border-t border-[#000033]/10 flex-shrink-0">
              {canales.map(canal => (
                <button
                  key={canal}
                  onClick={() => {
                    setContentPerCanal(prev => ({ ...prev, [activeCanal]: contentText }));
                    const newContent = contentPerCanal[canal] ?? '';
                    setActiveCanal(canal);
                    setContentText(newContent);
                    setCharCount(newContent.length);
                  }}
                  className={`px-3 py-1 text-xs font-bold rounded-t-md border-b-2 transition-all ${
                    activeCanal === canal
                      ? 'text-[#024fff] border-[#024fff] bg-[#024fff]/5'
                      : 'text-[#000033]/40 border-transparent hover:text-[#000033]/70'
                  }`}
                >
                  {canal}
                </button>
              ))}
            </div>
          )}

          {/* Editor Area */}
          <div className="flex-1 overflow-y-auto px-8 py-4 min-h-0">
            <textarea
              value={contentText}
              onChange={handleContentChange}
              onBlur={() => { if (hasChanges) saveMutation.mutate(); }}
              className="w-full h-full resize-none border-none outline-none text-[#000033] text-sm leading-relaxed bg-transparent"
              placeholder="Empieza a escribir o pedile a la IA que genere contenido..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
