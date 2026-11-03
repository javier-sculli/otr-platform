export type KnowledgeType = 'REUNION' | 'FEEDBACK' | 'DOCUMENTO' | 'CLAUDE_CHAT' | 'NOTA' | string;

export interface KnowledgeDocument {
  id: string;
  clientId: string;
  speakerId?: string | null;
  title: string;
  type: KnowledgeType;
  tags: string[];
  content: string;
  summary?: string | null;
  date: Date | string;
  sourceUrl?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateKnowledgeDocumentDTO {
  clientId: string;
  speakerId?: string | null;
  title: string;
  type?: string;
  tags?: string[];
  content: string;
  summary?: string | null;
  date?: string;
  sourceUrl?: string | null;
}

export interface UpdateKnowledgeDocumentDTO {
  title?: string;
  type?: string;
  tags?: string[];
  content?: string;
  summary?: string | null;
  date?: string;
  sourceUrl?: string | null;
  speakerId?: string | null;
}

export interface AnalyzeKnowledgeContentDTO {
  content: string;
  clientId?: string;
}

export interface AnalyzeKnowledgeResponse {
  title: string;
  type: string;
  summary: string;
  tags: string[];
}

export interface KnowledgeChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface KnowledgeChatDTO {
  clientId: string;
  speakerId?: string | null;
  question: string;
  history?: KnowledgeChatMessage[];
}

export interface KnowledgeChatResponse {
  response: string;
  citedSources: Array<{
    id: string;
    title: string;
    type: string;
    date: string;
  }>;
  debug?: {
    totalDocsInBase: number;
    retrievedDocsCount: number;
    retrievedDocs: Array<{
      id: string;
      title: string;
      type: string;
      date: string;
    }>;
    approxTokens: number;
    durationMs: number;
  };
}

export interface BrandPulseResponse {
  adn: string;
  hitosRecientes: string[];
  salud: {
    totalDocs: number;
    ultimaActualizacion: string | null;
    brandKitStatus: 'SINCRONIZADO' | 'DESACTUALIZADO' | 'SIN_CONFIGURAR';
    sugerenciasPendientesCount: number;
  };
}

export interface BrandKitGap {
  campo: string;
  tituloCampo: string;
  estado: 'ACTUAL' | 'DESALINEADO' | 'FALTANTE';
  observacion: string;
  valorActual: string;
  valorSugerido: string;
}

export interface AuditBrandKitResponse {
  resumenDiagnostico: string;
  gaps: BrandKitGap[];
  proposedBrandVoice: Record<string, string>;
}

export interface UploadInferredResponse {
  id: string;
  title: string;
  type: string;
  relevance: 'ESTRATEGICO' | 'TACTICO' | 'OPERATIVO';
  summary: string;
  tags: string[];
  date: string;
}
