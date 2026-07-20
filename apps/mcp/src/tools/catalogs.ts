import { z } from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiFetch } from '../lib/api-client.js';
import { jsonResult, tokenFrom } from './helpers.js';

export function registerCatalogTools(server: McpServer) {
  server.registerTool(
    'list_clients',
    {
      title: 'Listar clientes',
      description: 'Lista los clientes activos de la agencia.',
      inputSchema: {},
    },
    async (_input, extra) => {
      const token = tokenFrom(extra);
      const data = await apiFetch(token, '/catalogs/clients');
      return jsonResult(data);
    }
  );

  server.registerTool(
    'get_client_stats',
    {
      title: 'Estadísticas de clientes',
      description: 'Lista clientes con estadísticas de contenido: en borrador, en revisión, programadas, completitud del brand kit y voceros.',
      inputSchema: {},
    },
    async (_input, extra) => {
      const token = tokenFrom(extra);
      const data = await apiFetch(token, '/catalogs/clients/stats');
      return jsonResult(data);
    }
  );

  server.registerTool(
    'list_catalogs',
    {
      title: 'Listar catálogos',
      description: 'Lista un catálogo auxiliar: tipos de ticket disponibles o usuarios del equipo OTR.',
      inputSchema: {
        catalog: z.enum(['ticket_types', 'users']).describe('Qué catálogo listar'),
      },
    },
    async ({ catalog }, extra) => {
      const token = tokenFrom(extra);
      const path = catalog === 'ticket_types' ? '/catalogs/ticket-types' : '/catalogs/users';
      const data = await apiFetch(token, path);
      return jsonResult(data);
    }
  );
}
