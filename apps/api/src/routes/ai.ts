import { FastifyInstance } from 'fastify';
import OpenAI from 'openai';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { config } from '../config.js';

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

function buildSystemPrompt(params: {
  clientName: string;
  title: string;
  brief: string;
  tone: string;
  keywords: string;
  outputLength: string;
  currentContent: string;
  brandVoice: Record<string, string> | null;
}): string {
  const { clientName, title, brief, tone, keywords, outputLength, currentContent, brandVoice } = params;

  const lengthGuide = LENGTH_GUIDE[outputLength] ?? LENGTH_GUIDE['M'];

  // Brand voice — only inject sections with content
  let brandVoiceBlock = '';
  if (brandVoice) {
    const filledSections = Object.entries(brandVoice)
      .filter(([, value]) => typeof value === 'string' && value.trim().length > 0);

    if (filledSections.length > 0) {
      brandVoiceBlock = `\n## Kit de Marca — ${clientName}\n${
        filledSections
          .map(([key, value]) => `### ${BRAND_VOICE_LABELS[key] ?? key}\n${value}`)
          .join('\n\n')
      }`;
    }
  }

  const contentBlock = currentContent?.trim()
    ? `\n## Contenido actual en el editor\n${currentContent}`
    : '\n## Contenido actual en el editor\n(vacío — generá desde cero)';

  return `Sos un redactor profesional especializado en contenido para redes sociales y marketing de contenidos. Trabajás para el cliente ${clientName}.

## Contexto de la pieza
Título: ${title || '(sin título)'}
Brief: ${brief || '(sin brief)'}
Tono de voz: ${tone || '(no especificado)'}
Keywords: ${keywords || '(no especificadas)'}
Longitud objetivo: ${lengthGuide}${brandVoiceBlock}${contentBlock}

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
    };
  }>('/:ticketId/chat', async (request, reply) => {
    if (!config.openaiApiKey) {
      return reply.status(503).send({ error: 'OpenAI API key not configured' });
    }

    const { ticketId } = request.params;
    const { instruction, currentContent, brief, tone, keywords, outputLength } = request.body;

    // Load ticket + client + brand voice
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        client: {
          include: { brandVoice: true },
        },
      },
    });

    if (!ticket) {
      return reply.status(404).send({ error: 'Ticket not found' });
    }

    const brandVoice = ticket.client.brandVoice?.content as Record<string, string> | null;

    const systemPrompt = buildSystemPrompt({
      clientName: ticket.client.name,
      title: ticket.title,
      brief,
      tone,
      keywords,
      outputLength,
      currentContent,
      brandVoice,
    });

    const openai = new OpenAI({ apiKey: config.openaiApiKey });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: instruction },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '';
    const { newContent, summary } = parseAIResponse(raw);

    return { newContent, summary };
  });
}
