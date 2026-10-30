import { z } from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiFetch } from '../lib/api-client.js';
import { jsonResult, tokenFrom } from './helpers.js';

export function registerKnowledgeTools(server: McpServer) {
  server.registerTool(
    'save_knowledge_doc',
    {
      title: 'Guardar documento en Knowledge Base',
      description: 'Guarda una minuta de reunión, feedback, transcripción o notas en la Base de Conocimiento de un cliente en Rocky.',
      inputSchema: {
        clientId: z.string().describe('ID del cliente'),
        title: z.string().describe('Título descriptivo del documento o reunión'),
        content: z.string().describe('Contenido completo del texto, feedback o transcripción'),
        type: z
          .enum(['REUNION', 'FEEDBACK', 'DOCUMENTO', 'CLAUDE_CHAT', 'NOTA'])
          .optional()
          .default('NOTA')
          .describe('Tipo de documento'),
        speakerId: z.string().optional().describe('ID del vocero si aplica a una persona específica'),
        summary: z.string().optional().describe('Resumen ejecutivo o decisiones clave'),
        tags: z.array(z.string()).optional().describe('Etiquetas o temas clave'),
      },
    },
    async (input, extra) => {
      const token = tokenFrom(extra);
      const data = await apiFetch(token, '/knowledge', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return jsonResult(data);
    }
  );

  server.registerTool(
    'search_knowledge',
    {
      title: 'Buscar en Knowledge Base',
      description: 'Busca documentos, minutas o directivas de estilo en la Base de Conocimiento de un cliente.',
      inputSchema: {
        clientId: z.string().describe('ID del cliente'),
        search: z.string().optional().describe('Término de búsqueda libre'),
        type: z
          .enum(['REUNION', 'FEEDBACK', 'DOCUMENTO', 'CLAUDE_CHAT', 'NOTA'])
          .optional()
          .describe('Tipo de documento para filtrar'),
      },
    },
    async ({ clientId, search, type }, extra) => {
      const token = tokenFrom(extra);
      const params = new URLSearchParams();
      params.set('clientId', clientId);
      if (search) params.set('search', search);
      if (type) params.set('type', type);

      const data = await apiFetch(token, `/knowledge?${params.toString()}`);
      return jsonResult(data);
    }
  );
}
