import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Sparkles, Bold, Italic, Underline, List, ListOrdered,
  Link2, Image as ImageIcon, Type, Eye, Send, GripVertical, Check, AlertCircle,
  Columns2, Paperclip, X, FileText, File,
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

const QUICK_ACTIONS = ['Redactar nuevamente', 'Reforzar tono', 'Más conciso', 'Regenerar hook'];

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
  // Dual mode — second model content
  const [contentTextB, setContentTextB] = useState('');
  const [charCountB, setCharCountB] = useState(0);
  const [dualMode, setDualMode] = useState(false);

  const [aiPrompt, setAiPrompt] = useState('');
  const [chatWidth, setChatWidth] = useState(300);
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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

    const fullInstruction = instruction;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: instruction };
    const thinkingId = (Date.now() + 1).toString();
    const thinkingMsg: ChatMessage = { id: thinkingId, role: 'assistant', content: '...' };

    setChatMessages(prev => [...prev, userMsg, thinkingMsg]);
    setIsAiLoading(true);

    try {
      if (dualMode) {
        const [resultA, resultB] = await Promise.all([
          api.chatWithAI(ticketId, { instruction: fullInstruction, currentContent: contentText, brief, tone, keywords, outputLength, model: 'gpt-4o', attachments }),
          api.chatWithAI(ticketId, { instruction: fullInstruction, currentContent: contentTextB, brief, tone, keywords, outputLength, model: 'claude-sonnet-4-6', attachments }),
        ]);

        if (resultA.newContent !== null) {
          setContentText(resultA.newContent);
          setCharCount(resultA.newContent.length);
          setHasChanges(true);
        }
        if (resultB.newContent !== null) {
          setContentTextB(resultB.newContent);
          setCharCountB(resultB.newContent.length);
        }

        setChatMessages(prev =>
          prev.map(m => m.id === thinkingId
            ? { ...m, content: `GPT-4o: ${resultA.summary}\n\nClaude Sonnet: ${resultB.summary}` }
            : m
          )
        );
      } else {
        const result = await api.chatWithAI(ticketId, {
          instruction: fullInstruction, currentContent: contentText, brief, tone, keywords, outputLength, attachments,
        });

        if (result.newContent !== null) {
          setContentText(result.newContent);
          setCharCount(result.newContent.length);
          setHasChanges(true);
        }

        setChatMessages(prev =>
          prev.map(m => m.id === thinkingId ? { ...m, content: result.summary } : m)
        );
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
              {ticket?.status && (
                <span className="px-2.5 py-0.5 bg-[#00ff99]/20 border-2 border-[#00ff99]/40 text-[#000033] text-xs font-bold rounded-lg capitalize flex-shrink-0">
                  {STATUS_LABELS[ticket.status] ?? ticket.status}
                </span>
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
              </div>
              <button
                onClick={() => setDualMode(prev => !prev)}
                title="Modo dual: comparar GPT-4o vs Claude Sonnet"
                className={`flex items-center gap-1.5 px-2 py-1 text-[9px] font-bold rounded-md transition-all ${
                  dualMode
                    ? 'bg-[#024fff] text-white shadow shadow-[#024fff]/30'
                    : 'border border-[#000033]/20 text-[#000033]/50 hover:border-[#024fff]/40 hover:text-[#024fff]'
                }`}
              >
                <Columns2 className="w-3 h-3" />
                DUAL
              </button>
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
                  className="px-2 py-1 bg-[#00ff99]/10 hover:bg-[#00ff99]/20 text-[#000033] text-[10px] font-bold rounded-full transition-all border border-[#00ff99]/40 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Input */}
          <div className="px-2.5 pb-2.5 pt-2 flex-shrink-0">
            {/* Chips de archivos adjuntos */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {attachedFiles.map(file => (
                  <div
                    key={file.id}
                    className="flex items-center gap-1 px-2 py-0.5 bg-[#024fff]/10 border border-[#024fff]/20 rounded text-[10px] font-medium text-[#024fff]"
                  >
                    {file.type.startsWith('image/') ? (
                      <ImageIcon className="w-3 h-3 flex-shrink-0" />
                    ) : file.type.includes('pdf') ? (
                      <FileText className="w-3 h-3 flex-shrink-0" />
                    ) : (
                      <File className="w-3 h-3 flex-shrink-0" />
                    )}
                    <span className="max-w-[100px] truncate">{file.name}</span>
                    <button
                      onClick={() => handleRemoveFile(file.id)}
                      className="hover:bg-[#024fff]/20 rounded-full p-0.5 transition-all"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isAiLoading}
                title="Adjuntar archivo"
                className="px-2 py-1.5 border-2 border-[#000033]/10 rounded-md hover:bg-[#000033]/5 transition-all h-fit self-end disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Paperclip className="w-3.5 h-3.5 text-[#000033]/60" />
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
              <div className="w-40 flex-shrink-0">
                <label className="block text-[9px] font-bold text-[#000033]/60 mb-1">TÍTULO</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => { setTitle(e.target.value); setHasChanges(true); }}
                  className="w-full px-2.5 py-1.5 border-2 border-[#000033]/10 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033] hover:border-[#024fff]/40 transition-all"
                />
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-[9px] font-bold text-[#000033]/60 mb-1">BRIEF</label>
                <input
                  type="text"
                  value={brief}
                  onChange={e => { setBrief(e.target.value); setHasChanges(true); }}
                  className="w-full px-2.5 py-1.5 border-2 border-[#000033]/10 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033] hover:border-[#024fff]/40 transition-all"
                />
              </div>
            </div>
            {/* Fila 2: Tono + Keywords + Length + Brand Kit */}
            <div className="flex items-start gap-3">
              <div className="w-36 flex-shrink-0">
                <label className="block text-[9px] font-bold text-[#000033]/60 mb-1">TONO</label>
                <input
                  type="text"
                  value={tone}
                  onChange={e => setTone(e.target.value)}
                  placeholder="cercano, profesional..."
                  className="w-full px-2.5 py-1.5 border-2 border-[#000033]/10 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033] placeholder-[#000033]/30 hover:border-[#024fff]/40 transition-all"
                />
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-[9px] font-bold text-[#000033]/60 mb-1">KEYWORDS</label>
                <input
                  type="text"
                  value={keywords}
                  onChange={e => { setKeywords(e.target.value); setHasChanges(true); }}
                  placeholder="palabra1, palabra2..."
                  className="w-full px-2.5 py-1.5 border-2 border-[#000033]/10 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[#024fff] text-[#000033] placeholder-[#000033]/30 hover:border-[#024fff]/40 transition-all"
                />
              </div>
              <div className="flex-shrink-0">
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
              <div className="flex items-end flex-shrink-0">
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
              {!dualMode && (
                <span className="text-[10px] text-[#000033]/60">{charCount} caracteres</span>
              )}
            </div>
          </div>

          {/* Editor Area — single o dual */}
          {dualMode ? (
            <div className="flex-1 overflow-hidden flex min-h-0">
              {/* Editor A — GPT-4o mini */}
              <div className="flex-1 flex flex-col border-r-2 border-[#000033]/10 min-h-0 min-w-0">
                <div className="px-4 py-1.5 border-b border-[#000033]/10 flex items-center justify-between flex-shrink-0 bg-[#fafafa]">
                  <span className="text-[9px] font-bold text-[#000033]/50 uppercase tracking-wide">GPT-4o</span>
                  <span className="text-[10px] text-[#000033]/40">{charCount} car</span>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
                  <textarea
                    value={contentText}
                    onChange={handleContentChange}
                    className="w-full h-full resize-none border-none outline-none text-[#000033] text-sm leading-relaxed bg-transparent"
                    placeholder="Respuesta del modelo rápido..."
                  />
                </div>
              </div>
              {/* Editor B — GPT-4o */}
              <div className="flex-1 flex flex-col min-h-0 min-w-0">
                <div className="px-4 py-1.5 border-b border-[#000033]/10 flex items-center justify-between flex-shrink-0 bg-[#fafafa]">
                  <span className="text-[9px] font-bold text-[#024fff]/70 uppercase tracking-wide">Claude Sonnet</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#000033]/40">{charCountB} car</span>
                    <button
                      onClick={() => {
                        setContentText(contentTextB);
                        setCharCount(charCountB);
                        setHasChanges(true);
                      }}
                      className="text-[9px] px-2 py-0.5 bg-[#00ff99]/20 border border-[#00ff99]/50 text-[#000033] font-bold rounded-full hover:bg-[#00ff99]/40 transition-all"
                    >
                      Usar esta
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
                  <textarea
                    value={contentTextB}
                    onChange={e => { setContentTextB(e.target.value); setCharCountB(e.target.value.length); }}
                    className="w-full h-full resize-none border-none outline-none text-[#000033] text-sm leading-relaxed bg-transparent"
                    placeholder="Respuesta del modelo potente..."
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-8 py-4 min-h-0">
              <textarea
                value={contentText}
                onChange={handleContentChange}
                className="w-full h-full resize-none border-none outline-none text-[#000033] text-sm leading-relaxed bg-transparent"
                placeholder="Empieza a escribir o pedile a la IA que genere contenido..."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
