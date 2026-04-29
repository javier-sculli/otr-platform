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
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-419,es;q=0.9,en;q=0.8',
      },
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const html = await response.text();
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

const FETCH_URL_TOOL: Anthropic.Tool = {
  name: 'fetch_url',
  description: 'Lee el contenido de una URL. Usalo cuando necesites leer el contenido de un link para usarlo como referencia o contexto.',
  input_schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'La URL a leer' },
    },
    required: ['url'],
  },
};

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
  canal?: string;
  otherCanalesContent?: Record<string, string>;
  lineamientos?: { canal: string; content: string }[];
}): string {
  const { clientName, title, brief, tone, keywords, outputLength, currentContent, brandVoice, speaker, textAttachments, contextLinks, canal, otherCanalesContent, lineamientos } = params;

  const lengthGuide = LENGTH_GUIDE[outputLength] ?? LENGTH_GUIDE['M'];

  const CANAL_CONTEXT: Record<string, string> = {
    LinkedIn:  'Contenido de texto largo o medio, orientado a audiencia profesional.',
    Twitter:   'Límite de 280 caracteres por tweet. Si es hilo, cada tweet debe tener sentido por sí solo.',
    Instagram: 'Caption que acompaña una imagen o video. La primera línea es clave porque se corta antes del "ver más".',
    Facebook:  'Publicación en feed. Permite texto extenso.',
    TikTok:    'Caption corto que acompaña un video.',
    YouTube:   'Descripción del video. El primer párrafo es el más importante para SEO.',
  };
  const canalContext = canal && CANAL_CONTEXT[canal]
    ? `\n## Red social: ${canal}\n${CANAL_CONTEXT[canal]}`
    : canal ? `\n## Red social: ${canal}` : '';

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

  const linksBlock = contextLinks && contextLinks.length > 0
    ? `\n## Links de referencia de la pieza\nPodés leer cualquiera de estos links usando la tool fetch_url:\n${contextLinks.map(l => `- ${l}`).join('\n')}`
    : '';

  const otherCanalesBlock = otherCanalesContent && Object.keys(otherCanalesContent).length > 0
    ? `\n## Contenido ya redactado en otros canales\nTenés versiones de esta pieza para otras redes. Siempre arrancá desde ahí: adaptá el mensaje al formato y tono del canal activo en lugar de escribir desde cero. El copy para ${canal ?? 'este canal'} es una adaptación, no una pieza nueva.\n${Object.entries(otherCanalesContent).map(([c, v]) => `### ${c}\n${v}`).join('\n\n')}`
    : '';

  const lineamientosBlock = lineamientos && lineamientos.length > 0
    ? `\n## Ejemplos de lineamiento — posts reales marcados como referencia\nEstos son posts reales del cliente que funcionaron bien y fueron marcados como lineamiento de estilo. Usalos para calibrar el tono, estructura y voz, no para copiar el contenido.\n${lineamientos.map((l, i) => `### Ejemplo ${i + 1}${l.canal ? ` (${l.canal})` : ''}\n${l.content}`).join('\n\n')}`
    : '';

  const voiceContext = speakerBlock + brandVoiceBlock;

  return `Sos un redactor profesional especializado en contenido para redes sociales y marketing de contenidos. Trabajás para el cliente ${clientName}.

## Contexto de la pieza
Título: ${title || '(sin título)'}
Brief: ${brief || '(sin brief)'}
Tono de voz: ${tone || '(no especificado)'}
Keywords: ${keywords || '(no especificadas)'}
Longitud objetivo: ${lengthGuide}${canalContext}${voiceContext}${lineamientosBlock}${linksBlock}${attachmentsBlock}${otherCanalesBlock}${contentBlock}

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
      canal?: string;
      otherCanalesContent?: Record<string, string>;
    };
  }>('/:ticketId/chat', async (request, reply) => {
    if (!config.openaiApiKey) {
      return reply.status(503).send({ error: 'OpenAI API key not configured' });
    }

    const { ticketId } = request.params;
    const { instruction, currentContent, brief, tone, keywords, outputLength, model, attachments, history, canal, otherCanalesContent } = request.body;
    const allowedModels = ['gpt-4o', 'claude-sonnet-4-6'];
    const selectedModel = model && allowedModels.includes(model) ? model : 'claude-sonnet-4-6';

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

    const lineamientosRaw = await prisma.publication.findMany({
      where: {
        clientId: ticket.clientId,
        isHighlight: true,
        ...(canal ? { canal: { equals: canal, mode: 'insensitive' } } : {}),
      },
      select: { postContent: true, canal: true },
      take: 3,
      orderBy: { publishedAt: 'desc' },
    });
    const lineamientos = lineamientosRaw
      .filter(p => p.postContent?.trim())
      .map(p => ({ canal: p.canal, content: p.postContent! }));

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
      canal,
      otherCanalesContent,
      lineamientos,
    });

    console.log('[ai/chat] ─────────────────────────────────────────────────');
    console.log(`[ai/chat] ticket=${ticketId} model=${selectedModel} client="${ticket.client.name}"`);
    console.log(`[ai/chat] history_turns=${(history ?? []).length} attachments=${(attachments ?? []).length} links=${(ticket.links ?? []).length}`);
    console.log('[ai/chat] SYSTEM PROMPT:\n' + systemPrompt);
    if ((history ?? []).length > 0) {
      console.log('[ai/chat] HISTORY:');
      (history ?? []).forEach((m, i) =>
        console.log(`  [${i}] ${m.role}: ${m.content.slice(0, 200)}${m.content.length > 200 ? '…' : ''}`)
      );
    }
    console.log(`[ai/chat] USER: ${instruction}`);
    console.log('[ai/chat] ─────────────────────────────────────────────────');

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

    } else {
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
        const [header, data] = img.content.split(',');
        const rawMediaType = header.replace('data:', '').replace(';base64', '');
        const supportedTypes: ClaudeMediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const media_type = supportedTypes.includes(rawMediaType as ClaudeMediaType)
          ? (rawMediaType as ClaudeMediaType)
          : 'image/jpeg';
        userContent.push({ type: 'image', source: { type: 'base64', media_type, data } });
      }

      const messages: Anthropic.MessageParam[] = [
        ...(history ?? []).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user', content: userContent },
      ];

      const MAX_ITERATIONS = 5;
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          temperature: 0.7,
          system: systemPrompt,
          tools: [FETCH_URL_TOOL],
          messages,
        });

        if (response.stop_reason === 'tool_use') {
          messages.push({ role: 'assistant', content: response.content });

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of response.content) {
            if (block.type === 'tool_use' && block.name === 'fetch_url') {
              const url = (block.input as { url: string }).url;
              console.log(`[ai/chat] tool fetch_url: ${url}`);
              const content = await fetchUrlContent(url);
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: content ?? 'No se pudo obtener el contenido de esta URL.',
              });
            }
          }
          messages.push({ role: 'user', content: toolResults });
          continue;
        }

        const textBlock = response.content.find(b => b.type === 'text');
        raw = textBlock?.type === 'text' ? textBlock.text : '';
        break;
      }
    }

    const { newContent, summary } = parseAIResponse(raw);
    return { newContent, summary };
  });
}
