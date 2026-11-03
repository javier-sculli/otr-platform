import { FastifyInstance } from 'fastify';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { config } from '../config.js';

function safeSlice(str: string, maxLength: number): string {
  if (!str) return '';
  return Array.from(str).slice(0, maxLength).join('');
}

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
          model: 'claude-sonnet-5',
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

    const startTime = Date.now();

    // Retrieve documents
    const docWhere: any = { clientId };
    if (speakerId) {
      docWhere.OR = [
        { speakerId },
        { speakerId: null },
      ];
    }

    const [totalDocsCount, docs] = await Promise.all([
      prisma.knowledgeDocument.count({ where: { clientId } }),
      prisma.knowledgeDocument.findMany({
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
      }),
    ]);

    if (docs.length === 0) {
      return {
        data: {
          response: `Actualmente no hay reuniones, feedbacks ni documentos cargados para **${client.name}**. Podés cargar notas o minutas para que pueda responder preguntas con contexto real del cliente.`,
          citedSources: [],
          debug: {
            totalDocsInBase: 0,
            retrievedDocsCount: 0,
            retrievedDocs: [],
            approxTokens: 0,
            durationMs: Date.now() - startTime,
          },
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

    const approxTokens = Math.round((formattedDocs.length + question.length) / 4);

    console.log('\n[knowledge/chat] ═════════════════════════════════════════════════');
    console.log(`[knowledge/chat] Cliente: "${client.name}" (${clientId})`);
    console.log(`[knowledge/chat] Base total: ${totalDocsCount} docs | Leídos para contexto: ${docs.length} más recientes`);
    console.log(`[knowledge/chat] Tamaño contexto: ${formattedDocs.length} chars (~${approxTokens} tokens)`);
    console.log(`[knowledge/chat] Pregunta usuario: "${question.trim()}"`);

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
        
        // Build alternating messages starting with 'user'
        const messages: Anthropic.MessageParam[] = [];
        for (const m of cleanHistory) {
          if (messages.length === 0) {
            if (m.role === 'user') {
              messages.push({ role: 'user', content: m.content });
            }
          } else {
            const last = messages[messages.length - 1];
            if (last.role === m.role) {
              if (typeof last.content === 'string') {
                last.content = `${last.content}\n\n${m.content}`;
              }
            } else {
              messages.push({ role: m.role, content: m.content });
            }
          }
        }

        if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
          const lastUser = messages.pop()!;
          const lastText = typeof lastUser.content === 'string' ? lastUser.content : '';
          messages.push({
            role: 'user',
            content: lastText ? `${lastText}\n\n${question.trim()}` : question.trim(),
          });
        } else {
          messages.push({ role: 'user', content: question.trim() });
        }

        const res = await anthropic.messages.create({
          model: 'claude-sonnet-5',
          max_tokens: 4096,
          system: systemPrompt,
          messages,
        });

        console.log(`[knowledge/chat] Stop reason: ${res.stop_reason} | Tokens: in=${res.usage.input_tokens}, out=${res.usage.output_tokens}`);
        if (res.stop_reason === 'max_tokens') {
          console.warn('[knowledge/chat] ⚠️ La respuesta alcanzó max_tokens y fue truncada.');
        }

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

      const durationMs = Date.now() - startTime;
      console.log(`[knowledge/chat] Fuentes citadas: ${citedIds.length > 0 ? citedIds.join(', ') : 'Ninguna'}`);
      console.log(`[knowledge/chat] Respuesta preview (${durationMs}ms): ${cleanText.slice(0, 140).replace(/\n/g, ' ')}...`);
      console.log('[knowledge/chat] ═════════════════════════════════════════════════\n');

      return {
        data: {
          response: cleanText,
          citedSources: citedDocs,
          debug: {
            totalDocsInBase: totalDocsCount,
            retrievedDocsCount: docs.length,
            retrievedDocs: docs.map(d => ({
              id: d.id,
              title: d.title,
              type: d.type,
              date: new Date(d.date).toISOString(),
            })),
            approxTokens,
            durationMs,
          },
        },
      };
    } catch (err) {
      console.error('[knowledge/chat] Error in Q&A chat:', err);
      return reply.status(500).send({ error: 'Error al procesar la consulta con la base de conocimiento' });
    }
  });

  // 8. Sync Client Historical Content (Publications & Tickets) into Knowledge Base
  fastify.post<{
    Body: {
      clientId: string;
    };
  }>('/sync-content', async (request, reply) => {
    const { clientId } = request.body;

    if (!clientId) {
      return reply.status(400).send({ error: 'El ID de cliente es obligatorio' });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true },
    });

    if (!client) {
      return reply.status(404).send({ error: 'Cliente no encontrado' });
    }

    // Existing URLs to avoid duplicates
    const existingDocs = await prisma.knowledgeDocument.findMany({
      where: { clientId, sourceUrl: { not: null } },
      select: { sourceUrl: true },
    });
    const existingUrls = new Set(existingDocs.map(d => d.sourceUrl!).filter(Boolean));

    function cleanHtml(html: string): string {
      if (!html) return '';
      return html
        .replace(/<br\s*[\/]?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    const toInsert: Array<{
      clientId: string;
      speakerId?: string | null;
      title: string;
      type: string;
      tags: string[];
      content: string;
      summary?: string | null;
      date: Date;
      sourceUrl?: string | null;
    }> = [];

    // 1. Ingest publications
    const publications = await prisma.publication.findMany({
      where: { clientId, postContent: { not: null } },
      include: { ticket: { select: { id: true, title: true, objetivo: true } } },
      orderBy: { publishedAt: 'desc' },
    });

    for (const pub of publications) {
      if (!pub.postContent || pub.postContent.trim().length < 15) continue;
      if (pub.url && existingUrls.has(pub.url)) continue;

      const lines = pub.postContent.trim().split('\n').map(l => l.trim()).filter(Boolean);
      const hookTitle = lines[0] ? safeSlice(lines[0], 75) : 'Publicación en redes';
      const title = pub.ticket?.title ? `${pub.ticket.title}` : hookTitle;

      const canalTag = (pub.canal || 'general').toLowerCase();
      const tags = Array.from(new Set([canalTag, ...(pub.tags || [])]));

      toInsert.push({
        clientId,
        speakerId: pub.speakerId || null,
        title,
        type: 'POST',
        tags,
        content: pub.postContent.trim(),
        summary: pub.insights || (lines.slice(0, 2).join(' ') || null),
        date: pub.publishedAt ? new Date(pub.publishedAt) : new Date(),
        sourceUrl: pub.url || null,
      });

      if (pub.url) existingUrls.add(pub.url);
    }

    // 2. Ingest standalone tickets with contentPerCanal
    const ingestedTicketIds = new Set(publications.map(p => p.ticketId).filter(Boolean));
    const tickets = await prisma.ticket.findMany({
      where: {
        clientId,
        id: { notIn: Array.from(ingestedTicketIds) as string[] },
        status: { in: ['PUBLICADO', 'LISTO_PARA_PUBLICAR', 'LISTO', 'CLIENTE'] },
      },
      select: {
        id: true,
        title: true,
        objetivo: true,
        contentPerCanal: true,
        linkPublicacion: true,
        dueDate: true,
        publishedAt: true,
        createdAt: true,
        speakerId: true,
        tiposContenido: true,
      },
    });

    for (const ticket of tickets) {
      if (!ticket.contentPerCanal || typeof ticket.contentPerCanal !== 'object') continue;

      for (const [canal, rawHtml] of Object.entries(ticket.contentPerCanal as Record<string, string>)) {
        if (typeof rawHtml !== 'string') continue;
        const text = cleanHtml(rawHtml);
        if (text.length < 25) continue;

        const ticketSourceKey = ticket.linkPublicacion || `ticket:${ticket.id}:${canal.toLowerCase()}`;
        if (existingUrls.has(ticketSourceKey)) continue;

        const canalTag = canal.toLowerCase();
        const tags = Array.from(new Set([canalTag, ...(ticket.tiposContenido || [])]));

        toInsert.push({
          clientId,
          speakerId: ticket.speakerId || null,
          title: ticket.title,
          type: 'POST',
          tags,
          content: text,
          summary: ticket.objetivo || null,
          date: ticket.publishedAt ? new Date(ticket.publishedAt) : (ticket.dueDate ? new Date(ticket.dueDate) : new Date(ticket.createdAt)),
          sourceUrl: ticket.linkPublicacion || null,
        });

        existingUrls.add(ticketSourceKey);
      }
    }

    let insertedCount = 0;
    if (toInsert.length > 0) {
      const result = await prisma.knowledgeDocument.createMany({
        data: toInsert,
      });
      insertedCount = result.count;
    }

    return {
      data: {
        message: `Se sincronizaron exitosamente ${insertedCount} contenidos históricos para ${client.name}`,
        count: insertedCount,
        totalEvaluated: publications.length + tickets.length,
      },
    };
  });

  // 9. Zero-Form Ingest with Autonomous AI Inference
  fastify.post<{
    Body: {
      clientId: string;
      speakerId?: string | null;
      text?: string;
      pdfBase64?: string;
      fileName?: string;
    };
  }>('/upload-inferred', async (request, reply) => {
    const { clientId, speakerId, text, pdfBase64, fileName } = request.body;

    if (!clientId) {
      return reply.status(400).send({ error: 'El ID de cliente es obligatorio' });
    }

    if (!text && !pdfBase64) {
      return reply.status(400).send({ error: 'Debes proporcionar un archivo o texto para procesar' });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true },
    });

    if (!client) {
      return reply.status(404).send({ error: 'Cliente no encontrado' });
    }

    const prompt = `Analizá el siguiente contenido o documento del cliente "${client.name}" ${fileName ? `(Nombre original del archivo: "${fileName}")` : ''}.
Tu tarea es inferir de forma completamente autónoma:
1. "title": Un título conciso, descriptivo y profesional (máximo 60 caracteres). No pongas nombres genéricos como "Documento".
2. "type": Uno de los siguientes tipos según su naturaleza:
   - "BRAND_GUIDELINES": si contiene manual de marca, guía de estilo, arquetipos, paleta o voz.
   - "DESIGN_SYSTEM": si contiene especificaciones visuales, plantillas, tipografías o formatos gráficos.
   - "DECK": si es una presentación comercial, institucional o institucional de ventas.
   - "REUNION": si es una transcripción, acta o notas de reunión.
   - "FEEDBACK": si son correcciones o directivas de clientes sobre piezas de contenido.
   - "POST": si es un borrador o publicación de redes sociales.
   - "DOCUMENTO": si es un reporte, artículo, nota o informe general.
3. "relevance": El nivel de impacto estratégico:
   - "ESTRATEGICO": Reglas fundacionales de marca, directivas de largo plazo, posicionamiento core.
   - "TACTICO": Planes de campaña, lanzamientos de producto, agendas trimestrales.
   - "OPERATIVO": Tareas puntuales, correcciones específicas, coyuntura.
4. "summary": Un resumen ejecutivo de 2 a 3 viñetas concisas con lo más importante para los redactores.
5. "tags": Un array de hasta 4 tags en minúsculas (ej: ["identidad", "tono", "b2b"]).

Respondé EXCLUSIVAMENTE con un JSON válido con esta estructura:
{
  "title": string,
  "type": string,
  "relevance": "ESTRATEGICO" | "TACTICO" | "OPERATIVO",
  "summary": string,
  "tags": string[]
}`;

    const inferred = {
      title: fileName ? fileName.replace(/\.[^/.]+$/, '') : 'Documento de Marca',
      type: 'DOCUMENTO',
      relevance: 'TACTICO',
      summary: (text || 'Documento ingresado').slice(0, 200),
      tags: ['base-de-conocimiento'],
    };

    try {
      if (config.anthropicApiKey) {
        const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
        let messages: Anthropic.MessageParam[] = [];

        if (pdfBase64) {
          const cleanB64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
          messages = [
            {
              role: 'user',
              content: [
                {
                  type: 'document',
                  source: {
                    type: 'base64',
                    media_type: 'application/pdf',
                    data: cleanB64,
                  },
                },
                {
                  type: 'text',
                  text: prompt,
                },
              ],
            },
          ];
        } else {
          const sample = (text ?? '').slice(0, 15000);
          messages = [
            {
              role: 'user',
              content: `${prompt}\n\nContenido:\n"""\n${sample}\n"""`,
            },
          ];
        }

        const res = await anthropic.messages.create({
          model: 'claude-sonnet-5',
          max_tokens: 1000,
          messages,
        });

        const textBlock = res.content.find(b => b.type === 'text');
        if (textBlock && textBlock.text) {
          const clean = textBlock.text.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(clean);
          if (parsed.title) inferred.title = parsed.title;
          if (parsed.type) inferred.type = parsed.type;
          if (parsed.relevance) inferred.relevance = parsed.relevance;
          if (parsed.summary) inferred.summary = parsed.summary;
          if (Array.isArray(parsed.tags)) inferred.tags = parsed.tags;
        }
      }
    } catch (aiErr) {
      console.warn('[knowledge/upload-inferred] LLM inference fallback:', aiErr);
    }

    const finalContent = text && text.trim().length > 10 ? text : inferred.summary;

    const doc = await prisma.knowledgeDocument.create({
      data: {
        clientId,
        speakerId: speakerId || null,
        title: safeSlice(inferred.title, 200),
        type: inferred.type,
        tags: Array.from(new Set([...inferred.tags, `relevancia:${inferred.relevance.toLowerCase()}`])),
        summary: inferred.summary,
        content: finalContent,
        date: new Date(),
      },
      include: {
        speaker: { select: { id: true, nombre: true } },
      },
    });

    console.log(`[knowledge/upload-inferred] ✅ Ingesta Zero-Form: "${doc.title}" (${doc.type})`);

    return {
      data: doc,
    };
  });

  // 10. Brand Pulse - Resumen Ejecutivo Vivo del Cerebro
  fastify.get<{
    Querystring: {
      clientId: string;
    };
  }>('/brand-pulse', async (request, reply) => {
    const { clientId } = request.query;

    if (!clientId) {
      return reply.status(400).send({ error: 'El ID de cliente es obligatorio' });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        brandVoice: true,
      },
    });

    if (!client) {
      return reply.status(404).send({ error: 'Cliente no encontrado' });
    }

    const [totalDocs, recentDocs] = await Promise.all([
      prisma.knowledgeDocument.count({ where: { clientId } }),
      prisma.knowledgeDocument.findMany({
        where: { clientId },
        orderBy: { date: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          type: true,
          date: true,
          summary: true,
          content: true,
        },
      }),
    ]);

    const hasBrandKit = client.brandVoice && Object.keys(client.brandVoice.content || {}).some(k => (client.brandVoice!.content as any)[k]);
    const ultimaActualizacion = recentDocs[0]?.date ? new Date(recentDocs[0].date).toISOString() : null;

    if (totalDocs === 0 && !hasBrandKit) {
      return {
        data: {
          adn: `Aún no se ha consolidado el ADN de ${client.name}. Subí el primer documento o manual de marca para que la IA genere el perfil vivo.`,
          hitosRecientes: ['Sin documentos recientes cargados en la base.'],
          salud: {
            totalDocs: 0,
            ultimaActualizacion: null,
            brandKitStatus: 'SIN_CONFIGURAR',
            sugerenciasPendientesCount: 0,
          },
        },
      };
    }

    const docsSummary = recentDocs.map((d, i) => `${i + 1}. [${d.type}] ${d.title}: ${d.summary || d.content.slice(0, 200)}`).join('\n');
    const brandKitSample = JSON.stringify(client.brandVoice?.content || {}, null, 2);

    let adn = `${client.name} es una marca con foco estratégico en su industria.`;
    let hitosRecientes = recentDocs.slice(0, 3).map(d => d.title);

    if (config.anthropicApiKey) {
      try {
        const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
        const res = await anthropic.messages.create({
          model: 'claude-sonnet-5',
          max_tokens: 800,
          system: `Sos el director de estrategia de marca de la agencia OTR. Tu misión es sintetizar en 1 minuto el pulso de marca del cliente "${client.name}".
Respondé con un JSON válido:
{
  "adn": "2 a 3 oraciones contundentes describiendo a quién le habla la marca, cuál es su diferencial y el tono rector.",
  "hitosRecientes": ["3 viñetas concisas con los temas, eventos o lanzamientos más calientes de las últimas semanas"]
}`,
          messages: [
            {
              role: 'user',
              content: `Contexto de Brand Kit actual:\n${brandKitSample}\n\nÚltimos 10 contenidos y documentos:\n${docsSummary}`,
            },
          ],
        });

        const textBlock = res.content.find(b => b.type === 'text');
        if (textBlock?.text) {
          const parsed = JSON.parse(textBlock.text.replace(/```json/gi, '').replace(/```/g, '').trim());
          if (parsed.adn) adn = parsed.adn;
          if (Array.isArray(parsed.hitosRecientes) && parsed.hitosRecientes.length > 0) {
            hitosRecientes = parsed.hitosRecientes;
          }
        }
      } catch (e) {
        console.warn('[knowledge/brand-pulse] Error synthesizing pulse:', e);
      }
    }

    return {
      data: {
        adn,
        hitosRecientes,
        salud: {
          totalDocs,
          ultimaActualizacion,
          brandKitStatus: hasBrandKit ? 'SINCRONIZADO' : 'SIN_CONFIGURAR',
          sugerenciasPendientesCount: 0,
        },
      },
    };
  });

  // 11. Audit Brand Kit against Knowledge Base
  fastify.post<{
    Body: {
      clientId: string;
    };
  }>('/audit-brand-kit', async (request, reply) => {
    const { clientId } = request.body;

    if (!clientId) {
      return reply.status(400).send({ error: 'El ID de cliente es obligatorio' });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { brandVoice: true },
    });

    if (!client) {
      return reply.status(404).send({ error: 'Cliente no encontrado' });
    }

    const docs = await prisma.knowledgeDocument.findMany({
      where: { clientId },
      orderBy: { date: 'desc' },
      take: 20,
      select: { title: true, type: true, date: true, summary: true, content: true },
    });

    const currentBrandVoice = (client.brandVoice?.content || {}) as Record<string, string>;
    const docsContext = docs.map((d, i) => `#${i + 1} [${d.type}] ${d.title}: ${d.summary || d.content.slice(0, 250)}`).join('\n\n');

    const systemPrompt = `Sos el consultor estratégico senior de branding de OTR.
Tu tarea es auditar el Brand Kit actual del cliente "${client.name}" contra la realidad observada en sus últimos documentos y publicaciones.

Campos oficiales del Brand Kit:
identidad_verbal, estrategia_contenido, criterios_calidad, uso_idioma, elementos_marca, identidad_comunicacion, estilo_editorial, mensajes_clave, lineas_editoriales, formato_preferido, audiencia_objetivo.

Instrucciones:
1. Identificá entre 2 y 6 brechas prioritarias (campos donde lo publicado difiere del Brand Kit o donde falte incorporar novedades).
2. Para cada brecha, devolvé:
   - "campo": id del campo oficial (ej: "lineas_editoriales", "identidad_comunicacion")
   - "tituloCampo": nombre legible
   - "estado": "DESALINEADO" o "FALTANTE"
   - "observacion": explicación concisa de la brecha (máximo 2 oraciones)
   - "valorActual": síntesis concisa del valor actual en Brand Kit (máximo 25 palabras o "(Vacío)")
   - "valorSugerido": texto enriquecido y completo propuesto para reemplazar o actualizar ese campo en el Brand Kit

Respondé EXCLUSIVAMENTE con este formato JSON:
{
  "resumenDiagnostico": "Resumen ejecutivo en 2 oraciones claras del estado general del Brand Kit vs la realidad observada.",
  "gaps": [
    {
      "campo": string,
      "tituloCampo": string,
      "estado": "DESALINEADO" | "FALTANTE",
      "observacion": string,
      "valorActual": string,
      "valorSugerido": string
    }
  ]
}`;

    let result = {
      resumenDiagnostico: `Se auditaron ${docs.length} documentos históricos de ${client.name}.`,
      gaps: [],
      proposedBrandVoice: currentBrandVoice,
    };

    if (config.anthropicApiKey) {
      try {
        const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
        const res = await anthropic.messages.create({
          model: 'claude-sonnet-5',
          max_tokens: 5000,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: `Brand Kit actual:\n${JSON.stringify(currentBrandVoice, null, 2)}\n\nÚltimos contenidos y minutas:\n${docsContext}`,
            },
          ],
        });

        console.log(`[knowledge/audit-brand-kit] Stop reason: ${res.stop_reason} | Tokens out: ${res.usage.output_tokens}`);

        const textBlock = res.content.find(b => b.type === 'text');
        if (textBlock?.text) {
          let clean = textBlock.text.replace(/```json/gi, '').replace(/```/g, '').trim();
          let parsed: any = null;
          try {
            parsed = JSON.parse(clean);
          } catch {
            try {
              // Sanitize literal control characters if present
              const sanitized = clean.replace(/[\u0000-\u0019]+/g, ' ');
              parsed = JSON.parse(sanitized);
            } catch (err) {
              console.error('[knowledge/audit-brand-kit] JSON parse failed after sanitization:', err);
            }
          }

          if (parsed) {
            const gaps = Array.isArray(parsed.gaps) ? parsed.gaps : [];
            const proposedBrandVoice: Record<string, string> = { ...currentBrandVoice };
            gaps.forEach((g: any) => {
              if (g.campo && g.valorSugerido) {
                proposedBrandVoice[g.campo] = g.valorSugerido;
              }
            });

            result = {
              resumenDiagnostico: parsed.resumenDiagnostico || result.resumenDiagnostico,
              gaps,
              proposedBrandVoice,
            };
          }
        }
      } catch (err) {
        console.error('[knowledge/audit-brand-kit] Error auditing brand kit:', err);
      }
    }

    return {
      data: result,
    };
  });

  // 12. Apply Brand Kit Sync
  fastify.post<{
    Body: {
      clientId: string;
      proposedContent: Record<string, string>;
    };
  }>('/apply-brand-kit', async (request, reply) => {
    const { clientId, proposedContent } = request.body;

    if (!clientId) {
      return reply.status(400).send({ error: 'El ID de cliente es obligatorio' });
    }

    if (!proposedContent || typeof proposedContent !== 'object') {
      return reply.status(400).send({ error: 'El contenido propuesto es inválido' });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { brandVoice: true },
    });

    if (!client) {
      return reply.status(404).send({ error: 'Cliente no encontrado' });
    }

    const existingContent = (client.brandVoice?.content || {}) as Record<string, string>;
    const mergedContent = { ...existingContent, ...proposedContent };

    const updated = await prisma.brandVoice.upsert({
      where: { clientId },
      update: { content: mergedContent },
      create: { clientId, content: mergedContent },
    });

    console.log(`[knowledge/apply-brand-kit] ✅ Brand Kit actualizado para "${client.name}" (${Object.keys(proposedContent).length} campos)`);

    return {
      data: {
        success: true,
        updatedFieldsCount: Object.keys(proposedContent).length,
        brandVoice: updated,
      },
    };
  });
}
