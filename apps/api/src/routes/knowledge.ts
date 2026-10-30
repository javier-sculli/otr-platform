import { FastifyInstance } from 'fastify';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { config } from '../config.js';

export async function knowledgeRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  // 1. List knowledge documents
  fastify.get<{
    Querystring: {
      clientId?: string;
      speakerId?: string;
      type?: string;
      search?: string;
    };
  }>('/', async (request, reply) => {
    const { clientId, speakerId, type, search } = request.query;

    const where: any = {};

    if (clientId) {
      where.clientId = clientId;
    }

    if (speakerId) {
      where.speakerId = speakerId;
    }

    if (type && type !== 'TODOS') {
      where.type = { equals: type, mode: 'insensitive' };
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
        { tags: { has: q } },
      ];
    }

    const documents = await prisma.knowledgeDocument.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        speaker: { select: { id: true, nombre: true, cargo: true } },
      },
    });

    return { data: documents };
  });

  // 2. Get single document by ID
  fastify.get<{
    Params: { id: string };
  }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const doc = await prisma.knowledgeDocument.findUnique({
      where: { id },
      include: {
        speaker: { select: { id: true, nombre: true, cargo: true } },
        client: { select: { id: true, name: true } },
      },
    });

    if (!doc) {
      return reply.status(404).send({ error: 'Documento no encontrado' });
    }

    return { data: doc };
  });

  // 3. Create document
  fastify.post<{
    Body: {
      clientId: string;
      speakerId?: string | null;
      title: string;
      type?: string;
      tags?: string[];
      content: string;
      summary?: string | null;
      date?: string;
      sourceUrl?: string | null;
    };
  }>('/', async (request, reply) => {
    const { clientId, speakerId, title, type, tags, content, summary, date, sourceUrl } = request.body;

    if (!clientId || typeof clientId !== 'string') {
      return reply.status(400).send({ error: 'El ID de cliente es obligatorio' });
    }

    if (!title || typeof title !== 'string' || !title.trim()) {
      return reply.status(400).send({ error: 'El título es obligatorio' });
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return reply.status(400).send({ error: 'El contenido no puede estar vacío' });
    }

    const doc = await prisma.knowledgeDocument.create({
      data: {
        clientId,
        speakerId: speakerId || null,
        title: title.trim(),
        type: (type && type.trim().toUpperCase()) || 'NOTA',
        tags: Array.isArray(tags) ? tags.map(t => t.trim().toLowerCase()).filter(Boolean) : [],
        content: content.trim(),
        summary: summary?.trim() || null,
        date: date ? new Date(date) : new Date(),
        sourceUrl: sourceUrl?.trim() || null,
      },
      include: {
        speaker: { select: { id: true, nombre: true, cargo: true } },
      },
    });

    return reply.status(201).send({ data: doc });
  });

  // 4. Update document
  fastify.patch<{
    Params: { id: string };
    Body: {
      title?: string;
      type?: string;
      tags?: string[];
      content?: string;
      summary?: string | null;
      date?: string;
      sourceUrl?: string | null;
      speakerId?: string | null;
    };
  }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const { title, type, tags, content, summary, date, sourceUrl, speakerId } = request.body;

    const existing = await prisma.knowledgeDocument.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: 'Documento no encontrado' });
    }

    const data: any = {};
    if (title !== undefined) data.title = title.trim();
    if (type !== undefined) data.type = type.trim().toUpperCase();
    if (tags !== undefined) data.tags = Array.isArray(tags) ? tags.map(t => t.trim().toLowerCase()).filter(Boolean) : [];
    if (content !== undefined) data.content = content.trim();
    if (summary !== undefined) data.summary = summary ? summary.trim() : null;
    if (date !== undefined) data.date = new Date(date);
    if (sourceUrl !== undefined) data.sourceUrl = sourceUrl ? sourceUrl.trim() : null;
    if (speakerId !== undefined) data.speakerId = speakerId || null;

    const updated = await prisma.knowledgeDocument.update({
      where: { id },
      data,
      include: {
        speaker: { select: { id: true, nombre: true, cargo: true } },
      },
    });

    return { data: updated };
  });

  // 5. Delete document
  fastify.delete<{
    Params: { id: string };
  }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const existing = await prisma.knowledgeDocument.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: 'Documento no encontrado' });
    }

    await prisma.knowledgeDocument.delete({ where: { id } });
    return { success: true };
  });

  // 6. AI Auto-Analyze Content (Extract Title, Type, Summary, Tags)
  fastify.post<{
    Body: {
      content: string;
      clientId?: string;
    };
  }>('/analyze', async (request, reply) => {
    const { content, clientId } = request.body;

    if (!content || typeof content !== 'string' || content.trim().length < 10) {
      return reply.status(400).send({ error: 'El contenido debe tener al menos 10 caracteres para analizarse' });
    }

    const sample = content.slice(0, 15000); // Truncate safely for prompt context

    let clientContext = '';
    if (clientId) {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { name: true },
      });
      if (client) {
        clientContext = `El cliente es: ${client.name}.\n`;
      }
    }

    const prompt = `Analizá el siguiente texto extraído de una fuente de información de una agencia de comunicación (puede ser una minuta de reunión con cliente, transcripción de Google Meet, feedback sobre un post, documento de producto o notas de trabajo).
${clientContext}
Tu tarea es devolver un objeto JSON estricto con los siguientes campos:
1. "title": Un título descriptivo, conciso y profesional (máximo 6 a 8 palabras).
2. "type": Exactamente uno de los siguientes tipos: "REUNION", "FEEDBACK", "DOCUMENTO", "CLAUDE_CHAT", "NOTA".
   - Si parece una llamada o transcripción de conversación, usá "REUNION".
   - Si es una crítica, corrección o preferencia de estilo/tono, usá "FEEDBACK".
   - Si es un deck, propuesta, one-pager o documentación de producto, usá "DOCUMENTO".
   - Si es una interacción con un LLM o copia de chat, usá "CLAUDE_CHAT".
   - En cualquier otro caso, usá "NOTA".
3. "summary": Un resumen ejecutivo en español de 2 a 3 viñetas concisas con las decisiones clave, temas tratados o aprendizajes principales.
4. "tags": Un array de hasta 4 tags relevantes en minúsculas (ej: ["precios", "linkedin", "estrategia"]).

Respondé SOLAMENTE con el JSON válido, sin bloques de código markdown ni texto adicional.

Texto a analizar:
"""
${sample}
"""`;

    try {
      let rawJson = '';

      if (config.anthropicApiKey) {
        const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
        const res = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        });
        const textBlock = res.content.find(b => b.type === 'text');
        rawJson = textBlock?.type === 'text' ? textBlock.text : '';
      } else if (config.openaiApiKey) {
        const openai = new OpenAI({ apiKey: config.openaiApiKey });
        const res = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        });
        rawJson = res.choices[0]?.message?.content ?? '';
      } else {
        // Fallback if no AI key configured
        return {
          data: {
            title: content.slice(0, 40).replace(/\n/g, ' ') + '...',
            type: 'NOTA',
            summary: content.slice(0, 200) + '...',
            tags: [],
          },
        };
      }

      // Clean up JSON
      const cleanJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      return {
        data: {
          title: parsed.title || 'Documento sin título',
          type: parsed.type || 'NOTA',
          summary: parsed.summary || null,
          tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        },
      };
    } catch (err) {
      console.error('[knowledge/analyze] Error analyzing content:', err);
      // Graceful fallback: return heuristic title and type
      const firstLine = content.split('\n')[0].slice(0, 50).trim();
      return {
        data: {
          title: firstLine || 'Nota de contexto',
          type: 'NOTA',
          summary: content.slice(0, 200).trim(),
          tags: [],
        },
      };
    }
  });

  // 7. Q&A Chat with the Client Knowledge Base
  fastify.post<{
    Body: {
      clientId: string;
      speakerId?: string | null;
      question: string;
      history?: { role: 'user' | 'assistant'; content: string }[];
    };
  }>('/chat', async (request, reply) => {
    const { clientId, speakerId, question, history } = request.body;

    if (!clientId) {
      return reply.status(400).send({ error: 'El ID de cliente es obligatorio' });
    }

    if (!question || !question.trim()) {
      return reply.status(400).send({ error: 'La pregunta no puede estar vacía' });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        brandVoice: true,
        speakers: speakerId ? { where: { id: speakerId } } : true,
      },
    });

    if (!client) {
      return reply.status(404).send({ error: 'Cliente no encontrado' });
    }

    // Retrieve documents
    const docWhere: any = { clientId };
    if (speakerId) {
      docWhere.OR = [
        { speakerId },
        { speakerId: null },
      ];
    }

    const docs = await prisma.knowledgeDocument.findMany({
      where: docWhere,
      orderBy: { date: 'desc' },
      take: 25,
      select: {
        id: true,
        title: true,
        type: true,
        date: true,
        summary: true,
        content: true,
      },
    });

    if (docs.length === 0) {
      return {
        data: {
          response: `Actualmente no hay reuniones, feedbacks ni documentos cargados para **${client.name}**. Podés cargar notas o minutas para que pueda responder preguntas con contexto real del cliente.`,
          citedSources: [],
        },
      };
    }

    const formattedDocs = docs.map((d, i) => {
      const fechaStr = new Date(d.date).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      return `[DOCUMENTO #${i + 1}]
ID: ${d.id}
Título: ${d.title}
Tipo: ${d.type}
Fecha: ${fechaStr}
${d.summary ? `Resumen: ${d.summary}\n` : ''}
Contenido:
${d.content.slice(0, 4000)}
---`;
    }).join('\n\n');

    const systemPrompt = `Sos el asistente inteligente de la base de conocimiento de la agencia On The Rocks (OTR) para el cliente "${client.name}".
Tu función es responder preguntas, sintetizar contexto, detectar inconsistencias y brindar soporte editorial a los redactores basándote EXCLUSIVAMENTE en los documentos de la Base de Conocimiento provistos a continuación.

Reglas obligatorias:
1. Basá tus respuestas en los hechos, citas y decisiones documentadas en los documentos adjuntos.
2. Si la información solicitada NO está presente en los documentos cargados, admitilo abiertamente: "No encontré registro de eso en los documentos ni reuniones cargadas de ${client.name}". Nunca inventes hechos, métricas ni opiniones del cliente.
3. Si encontrás inconsistencias o contradicciones entre dos documentos (por ejemplo, una reunión reciente que dice algo opuesto a un feedback anterior), menciónalo explícitamente destacando las fechas.
4. Respondé con un tono profesional, claro y directo en español.
5. Al final de tu respuesta, si te basaste en documentos específicos, agregá una lista de fuentes citadas con el formato exacto:
FUENTES_CITADAS: [ID_DEL_DOC_1, ID_DEL_DOC_2]

Base de Conocimiento de ${client.name}:
${formattedDocs}`;

    const cleanHistory = (history ?? []).filter(m => m && m.content && (m.role === 'user' || m.role === 'assistant'));

    try {
      let rawResponse = '';

      if (config.anthropicApiKey) {
        const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
        const messages: Anthropic.MessageParam[] = [
          ...cleanHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          { role: 'user', content: question.trim() },
        ];

        const res = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1500,
          system: systemPrompt,
          messages,
        });

        const textBlock = res.content.find(b => b.type === 'text');
        rawResponse = textBlock?.type === 'text' ? textBlock.text : '';
      } else if (config.openaiApiKey) {
        const openai = new OpenAI({ apiKey: config.openaiApiKey });
        const res = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            ...cleanHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
            { role: 'user', content: question.trim() },
          ],
        });
        rawResponse = res.choices[0]?.message?.content ?? '';
      } else {
        return reply.status(503).send({ error: 'No hay API key de IA configurada para el chat' });
      }

      // Extract cited sources
      const citedMatch = rawResponse.match(/FUENTES_CITADAS:\s*\[(.*?)\]/i);
      let citedIds: string[] = [];
      let cleanText = rawResponse;

      if (citedMatch) {
        cleanText = rawResponse.replace(/FUENTES_CITADAS:\s*\[(.*?)\]/i, '').trim();
        citedIds = citedMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
      }

      const citedDocs = docs.filter(d => citedIds.includes(d.id)).map(d => ({
        id: d.id,
        title: d.title,
        type: d.type,
        date: new Date(d.date).toISOString(),
      }));

      return {
        data: {
          response: cleanText,
          citedSources: citedDocs,
        },
      };
    } catch (err) {
      console.error('[knowledge/chat] Error in Q&A chat:', err);
      return reply.status(500).send({ error: 'Error al procesar la consulta con la base de conocimiento' });
    }
  });
}
