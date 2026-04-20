import { FastifyInstance } from 'fastify';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { config } from '../config.js';

async function fetchUrlContent(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OTR-bot/1.0)' },
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const html = await response.text();
    // strip <script>, <style>, <head> blocks, then all tags, collapse whitespace
    const text = html
      .replace(/<(script|style|head)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 8000);
    return text || null;
  } catch {
    return null;
  }
}

const LENGTH_GUIDE: Record<string, string> = {
  S: 'corto (~100-150 palabras)',
  M: 'medio (~250-350 palabras)',
  L: 'largo (~450-600 palabras)',
};

const BRAND_VOICE_LABELS: Record<string, string> = {
  identidad_verbal: 'Identidad verbal',
  estrategia_contenido: 'Estrategia de contenido',
  criterios_calidad: 'Criterios de calidad',
  uso_idioma: 'Uso del idioma',
  elementos_marca: 'Elementos de marca',
  identidad_comunicacion: 'Identidad de comunicación',
  estilo_editorial: 'Estilo editorial',
  mensajes_clave: 'Mensajes clave',
  lineas_editoriales: 'Líneas editoriales',
  formato_preferido: 'Formato preferido',
  audiencia_objetivo: 'Audiencia objetivo',
};

const SPEAKER_VOICE_LABELS: Record<string, string> = {
  personalidadArquetipo: 'Personalidad y arquetipo',
  tonoVozPersonal: 'Tono y voz personal',
  contextoExperiencia: 'Contexto y experiencia',
  temasHabla: 'Temas que habla',
  posicionamientoOpinion: 'Posicionamiento y opinión',
  estructuraNarrativa: 'Estructura narrativa',
  usoIdioma: 'Uso del idioma',
  criteriosCalidad: 'Criterios de calidad',
  contextoMarca: 'Contexto de la marca',
};

type SpeakerVoice = {
  nombre: string;
  cargo?: string | null;
  personalidadArquetipo?: string | null;
  tonoVozPersonal?: string | null;
  contextoExperiencia?: string | null;
  temasHabla?: string | null;
  posicionamientoOpinion?: string | null;
  estructuraNarrativa?: string | null;
  usoIdioma?: string | null;
  criteriosCalidad?: string | null;
  contextoMarca?: string | null;
};

function buildSystemPrompt(params: {
  clientName: string;
  title: string;
  brief: string;
  tone: string;
  keywords: string;
  outputLength: string;
  currentContent: string;
  brandVoice: Record<string, string> | null;
  speaker?: SpeakerVoice | null;
  textAttachments?: { name: string; content: string }[];
  contextLinks?: string[];
  fetchedLinks?: { url: string; content: string }[];
}): string {
  const { clientName, title, brief, tone, keywords, outputLength, currentContent, brandVoice, speaker, textAttachments, contextLinks, fetchedLinks } = params;

  const lengthGuide = LENGTH_GUIDE[outputLength] ?? LENGTH_GUIDE['M'];

  // Speaker voice — highest priority, placed first
  let speakerBlock = '';
  if (speaker) {
    const filledFields = Object.entries(SPEAKER_VOICE_LABELS)
      .filter(([key]) => {
        const val = speaker[key as keyof SpeakerVoice];
        return typeof val === 'string' && val.trim().length > 0;
      });

    const cargo = speaker.cargo ? ` — ${speaker.cargo}` : '';
    speakerBlock = `\n## Voz del Vocero — ${speaker.nombre}${cargo}\n⚠️ PRIORIDAD MÁXIMA: Este contenido habla en primera persona como ${speaker.nombre}. Su voz personal TIENE PRIORIDAD sobre el kit de marca. Adaptá el estilo de marca a la voz del vocero, no al revés.\n${
      filledFields
        .map(([key]) => `### ${SPEAKER_VOICE_LABELS[key]}\n${speaker[key as keyof SpeakerVoice]}`)
        .join('\n\n')
    }`;
  }

  // Brand voice — secondary context when there's a speaker
  let brandVoiceBlock = '';
  if (brandVoice) {
    const filledSections = Object.entries(brandVoice)
      .filter(([, value]) => typeof value === 'string' && value.trim().length > 0);

    if (filledSections.length > 0) {
      const brandLabel = speaker
        ? `## Kit de Marca — ${clientName} (contexto de fondo, subordinado a la voz del vocero)`
        : `## Kit de Marca — ${clientName}`;
      brandVoiceBlock = `\n${brandLabel}\n${
        filledSections
          .map(([key, value]) => `### ${BRAND_VOICE_LABELS[key] ?? key}\n${value}`)
          .join('\n\n')
      }`;
    }
  }

  const contentBlock = currentContent?.trim()
    ? `\n## Contenido actual en el editor\n${currentContent}`
    : '\n## Contenido actual en el editor\n(vacío — generá desde cero)';

  const attachmentsBlock = textAttachments && textAttachments.length > 0
    ? `\n## Archivos adjuntos como contexto\n${textAttachments.map(f => `### ${f.name}\n${f.content}`).join('\n\n')}`
    : '';

  const fetchedLinksBlock = fetchedLinks && fetchedLinks.length > 0
    ? `\n## Contenido de links de referencia\n${fetchedLinks.map(l => `### ${l.url}\n${l.content}`).join('\n\n')}`
    : contextLinks && contextLinks.length > 0
      ? `\n## Links de referencia de la pieza\n${contextLinks.map(l => `- ${l}`).join('\n')}`
      : '';

  const voiceContext = speakerBlock + brandVoiceBlock;

  return `Sos un redactor profesional especializado en contenido para redes sociales y marketing de contenidos. Trabajás para el cliente ${clientName}.

## Contexto de la pieza
Título: ${title || '(sin título)'}
Brief: ${brief || '(sin brief)'}
Tono de voz: ${tone || '(no especificado)'}
Keywords: ${keywords || '(no especificadas)'}
Longitud objetivo: ${lengthGuide}${voiceContext}${fetchedLinksBlock}${attachmentsBlock}${contentBlock}

## Instrucciones de respuesta

Antes de responder, determiná si el pedido implica **escribir o modificar el contenido del editor** (redactar, reescribir, mejorar, cambiar el tono, acortar, agregar algo, regenerar, etc.) o si es simplemente una **pregunta, consulta o comentario** que no requiere tocar el texto.

**Si hay que escribir o modificar el contenido**, respondé EXACTAMENTE así:
<content>
[contenido completo nuevo aquí]
</content>
<summary>
[1-2 oraciones en español informal explicando qué cambiaste y por qué]
</summary>

**Si es una pregunta, consulta o pedido que NO requiere modificar el contenido**, respondé EXACTAMENTE así:
<response>
[tu respuesta en español informal, sin modificar nada del editor]
</response>

Nunca uses los dos formatos a la vez. Nunca agregues texto fuera de los tags.`;
}

function parseAIResponse(raw: string): { newContent: string | null; summary: string } {
  const contentMatch = raw.match(/<content>([\s\S]*?)<\/content>/);
  const summaryMatch = raw.match(/<summary>([\s\S]*?)<\/summary>/);
  const responseMatch = raw.match(/<response>([\s\S]*?)<\/response>/);

  if (contentMatch) {
    return {
      newContent: contentMatch[1].trim(),
      summary: summaryMatch?.[1]?.trim() ?? 'Listo.',
    };
  }

  // Chat-only response — no content change
  return {
    newContent: null,
    summary: responseMatch?.[1]?.trim() ?? raw.trim(),
  };
}

export async function aiRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.post<{
    Params: { ticketId: string };
    Body: {
      instruction: string;
      currentContent: string;
      brief: string;
      tone: string;
      keywords: string;
      outputLength: string;
      model?: string;
      attachments?: { name: string; type: string; content: string; contentType: 'text' | 'image' | 'other' }[];
      history?: { role: 'user' | 'assistant'; content: string }[];
    };
  }>('/:ticketId/chat', async (request, reply) => {
    if (!config.openaiApiKey) {
      return reply.status(503).send({ error: 'OpenAI API key not configured' });
    }

    const { ticketId } = request.params;
    const { instruction, currentContent, brief, tone, keywords, outputLength, model, attachments, history } = request.body;
    const allowedModels = ['gpt-4o', 'claude-sonnet-4-6'];
    const selectedModel = model && allowedModels.includes(model) ? model : 'claude-sonnet-4-6';

    // Load ticket + client + brand voice + speaker
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        client: { include: { brandVoice: true } },
        speaker: true,
      },
    });

    if (!ticket) {
      return reply.status(404).send({ error: 'Ticket not found' });
    }

    const brandVoice = ticket.client.brandVoice?.content as Record<string, string> | null;
    const speaker = ticket.speaker as SpeakerVoice | null;

    const textAttachments = attachments
      ?.filter(a => a.contentType === 'text')
      .map(a => ({ name: a.name, content: a.content }));

    const imageAttachments = attachments?.filter(a => a.contentType === 'image') ?? [];

    const fetchedLinks = (await Promise.all(
      (ticket.links ?? []).map(async (url) => {
        const content = await fetchUrlContent(url);
        return content ? { url, content } : null;
      })
    )).filter((x): x is { url: string; content: string } => x !== null);

    console.log(`[ai/chat] fetched ${fetchedLinks.length}/${(ticket.links ?? []).length} links`);

    const systemPrompt = buildSystemPrompt({
      clientName: ticket.client.name,
      title: ticket.title,
      brief,
      tone,
      keywords,
      outputLength,
      currentContent,
      brandVoice,
      speaker,
      textAttachments,
      contextLinks: ticket.links,
      fetchedLinks,
    });

    // ── LLM context debug log ──────────────────────────────────────────────
    console.log('[ai/chat] ─────────────────────────────────────────────────');
    console.log(`[ai/chat] ticket=${ticketId} model=${selectedModel} client="${ticket.client.name}"`);
    console.log(`[ai/chat] history_turns=${(history ?? []).length} attachments=${(attachments ?? []).length}`);
    console.log('[ai/chat] SYSTEM PROMPT:\n' + systemPrompt);
    if ((history ?? []).length > 0) {
      console.log('[ai/chat] HISTORY:');
      (history ?? []).forEach((m, i) =>
        console.log(`  [${i}] ${m.role}: ${m.content.slice(0, 200)}${m.content.length > 200 ? '…' : ''}`)
      );
    }
    console.log(`[ai/chat] USER: ${instruction}`);
    console.log('[ai/chat] ─────────────────────────────────────────────────');
    // ──────────────────────────────────────────────────────────────────────

    let raw = '';

    if (selectedModel !== 'claude-sonnet-4-6') {
      const openai = new OpenAI({ apiKey: config.openaiApiKey });

      type OpenAIContentPart =
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } };

      const userContent: OpenAIContentPart[] = [{ type: 'text', text: instruction }];
      for (const img of imageAttachments) {
        userContent.push({ type: 'image_url', image_url: { url: img.content } });
      }

      const historyMessages = (history ?? []).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const completion = await openai.chat.completions.create({
        model: selectedModel,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          ...historyMessages,
          { role: 'user', content: userContent },
        ],
      });
      raw = completion.choices[0]?.message?.content ?? '';
    } else if (selectedModel === 'claude-sonnet-4-6') {
      if (!config.anthropicApiKey) {
        return reply.status(503).send({ error: 'Anthropic API key not configured' });
      }
      const anthropic = new Anthropic({ apiKey: config.anthropicApiKey, maxRetries: 5 });

      type ClaudeMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
      type ClaudeContentPart =
        | { type: 'text'; text: string }
        | { type: 'image'; source: { type: 'base64'; media_type: ClaudeMediaType; data: string } };

      const userContent: ClaudeContentPart[] = [{ type: 'text', text: instruction }];
      for (const img of imageAttachments) {
        // dataURL format: "data:image/png;base64,XXXX"
        const [header, data] = img.content.split(',');
        const rawMediaType = header.replace('data:', '').replace(';base64', '');
        const supportedTypes: ClaudeMediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const media_type = supportedTypes.includes(rawMediaType as ClaudeMediaType)
          ? (rawMediaType as ClaudeMediaType)
          : 'image/jpeg';
        userContent.push({ type: 'image', source: { type: 'base64', media_type, data } });
      }

      const claudeHistory = (history ?? []).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        temperature: 0.7,
        system: systemPrompt,
        messages: [
          ...claudeHistory,
          { role: 'user', content: userContent },
        ],
      });
      raw = message.content[0].type === 'text' ? message.content[0].text : '';
    }

    const { newContent, summary } = parseAIResponse(raw);

    return { newContent, summary };
  });
}
