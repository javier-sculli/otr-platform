import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, BookOpen, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import type { KnowledgeDocument, KnowledgeChatMessage } from '@otr/types';

interface KnowledgeChatPanelProps {
  clientId: string;
  clientName: string;
  speakerId?: string | null;
  onOpenDocumentDetail?: (docId: string) => void;
  documents?: KnowledgeDocument[];
}

interface ChatMessageItem extends KnowledgeChatMessage {
  citedSources?: Array<{
    id: string;
    title: string;
    type: string;
    date: string;
  }>;
}

const QUICK_QUESTIONS = [
  '¿De qué temas pide no hablar el cliente?',
  '¿Cuáles fueron los acuerdos de la última reunión?',
  '¿Qué feedback de tono o estilo nos dieron recientemente?',
  '¿Qué lanzamientos o novedades de producto tenemos registradas?',
];

export function KnowledgeChatPanel({
  clientId,
  clientName,
  speakerId,
  onOpenDocumentDetail,
  documents = [],
}: KnowledgeChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Reset messages when clientId changes
  useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        content: `Hola. Soy el asistente de la base de conocimiento de **${clientName}**. Podés preguntarme sobre minutas de reuniones, directivas del cliente, objeciones previas o pedirme resúmenes de temas tratados.`,
      },
    ]);
  }, [clientId, clientName]);

  const handleSend = async (questionText?: string) => {
    const textToSend = questionText || input;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: ChatMessageItem = { role: 'user', content: textToSend.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      const history = updatedMessages
        .slice(-6)
        .map(m => ({ role: m.role, content: m.content }));

      const res = await api.chatWithKnowledge({
        clientId,
        speakerId: speakerId || null,
        question: textToSend.trim(),
        history,
      });

      if (res?.data) {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: res.data.response,
            citedSources: res.data.citedSources,
          },
        ]);
      }
    } catch (err: any) {
      console.error('Error in knowledge chat:', err);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Ocurrió un error al consultar la base de conocimiento. Por favor, intentá nuevamente.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setMessages([
      {
        role: 'assistant',
        content: `Historial reiniciado. ¿Qué te gustaría consultar sobre **${clientName}**?`,
      },
    ]);
  };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
              Chat con la Base
              <span className="text-[10px] font-normal text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                {documents.length} docs activos
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 truncate max-w-[200px]">
              {clientName}
            </p>
          </div>
        </div>

        <button
          onClick={handleReset}
          title="Reiniciar conversación"
          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 border border-blue-100">
                <Bot className="w-3.5 h-3.5" />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-2xl p-3.5 leading-relaxed space-y-2 ${
                m.role === 'user'
                  ? 'bg-[#000033] text-white rounded-br-xs'
                  : 'bg-slate-50 border border-slate-200/80 text-slate-800 rounded-bl-xs'
              }`}
            >
              <div className="whitespace-pre-wrap">{m.content}</div>

              {/* Cited Sources */}
              {m.citedSources && m.citedSources.length > 0 && (
                <div className="pt-2 border-t border-slate-200/60 space-y-1">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    Fuentes consultadas:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {m.citedSources.map(source => (
                      <button
                        key={source.id}
                        type="button"
                        onClick={() => onOpenDocumentDetail?.(source.id)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-white border border-slate-200 text-slate-700 hover:border-blue-400 hover:text-blue-600 transition-colors"
                      >
                        <span className="font-medium truncate max-w-[140px]">{source.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {m.role === 'user' && (
              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5 items-center text-slate-400 text-xs">
            <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            </div>
            <span>Consultando reuniones y documentos de {clientName}...</span>
          </div>
        )}
      </div>

      {/* Suggested Quick Questions (show if only 1 message) */}
      {messages.length <= 1 && (
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Preguntas sugeridas:
          </div>
          <div className="space-y-1">
            {QUICK_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(q)}
                className="w-full text-left text-[11px] text-slate-600 hover:text-blue-600 hover:bg-blue-50/50 px-2 py-1 rounded transition-colors truncate"
              >
                • {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-3 border-t border-slate-100 bg-white">
        <div className="relative flex items-end gap-1.5 border border-slate-200 rounded-xl p-1.5 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 bg-white">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Preguntale algo a la base de ${clientName}...`}
            rows={2}
            className="w-full p-1.5 text-xs focus:outline-none resize-none"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="p-2 bg-[#024fff] text-white rounded-lg hover:bg-[#024fff]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 text-center mt-1.5">
          Enter para enviar · Shift+Enter para salto de línea
        </p>
      </div>
    </div>
  );
}
