import { z } from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiFetch } from '../lib/api-client.js';
import { jsonResult, tokenFrom } from './helpers.js';

export function registerTicketTools(server: McpServer) {
  server.registerTool(
    'list_tickets',
    {
      title: 'Listar tickets',
      description: 'Lista tickets (contenido o tareas) con filtros opcionales por cliente, responsable, estado o área.',
      inputSchema: {
        clientId: z.string().optional().describe('ID del cliente'),
        ownerId: z.string().optional().describe('ID del responsable'),
        status: z.string().optional().describe('Estado del ticket'),
        area: z.enum(['CONTENIDO', 'PRENSA']).optional().describe('Área del ticket'),
      },
    },
    async ({ clientId, ownerId, status, area }, extra) => {
      const token = tokenFrom(extra);
      const params = new URLSearchParams();
      if (clientId) params.set('clientId', clientId);
      if (ownerId) params.set('ownerId', ownerId);
      if (status) params.set('status', status);
      if (area) params.set('area', area);

      const data = await apiFetch(token, `/tickets?${params.toString()}`);
      return jsonResult(data);
    }
  );

  server.registerTool(
    'get_ticket',
    {
      title: 'Obtener ticket',
      description: 'Trae el detalle completo de un ticket por ID.',
      inputSchema: {
        id: z.string().describe('ID del ticket'),
      },
    },
    async ({ id }, extra) => {
      const token = tokenFrom(extra);
      const data = await apiFetch(token, `/tickets/${id}`);
      return jsonResult(data);
    }
  );

  server.registerTool(
    'create_ticket',
    {
      title: 'Crear ticket',
      description: 'Crea un ticket nuevo (contenido o tarea) en el backlog.',
      inputSchema: {
        title: z.string().describe('Título del ticket'),
        clientId: z.string().describe('ID del cliente'),
        ownerId: z.string().describe('ID del responsable'),
        description: z.string().optional().describe('Descripción o brief'),
        ticketTypeId: z.string().optional().describe('ID del tipo de ticket'),
        area: z.enum(['CONTENIDO', 'PRENSA']).optional().describe('Área del ticket'),
        dueDate: z.string().optional().describe('Fecha de entrega (ISO 8601)'),
      },
    },
    async (input, extra) => {
      const token = tokenFrom(extra);
      const data = await apiFetch(token, '/tickets', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return jsonResult(data);
    }
  );

  server.registerTool(
    'update_ticket',
    {
      title: 'Actualizar ticket',
      description: 'Actualiza campos de un ticket existente (estado, responsable, fecha de entrega, etc).',
      inputSchema: {
        id: z.string().describe('ID del ticket'),
        status: z.string().optional().describe('Nuevo estado'),
        ownerId: z.string().optional().describe('Nuevo responsable'),
        dueDate: z.string().optional().describe('Nueva fecha de entrega (ISO 8601)'),
        description: z.string().optional().describe('Nueva descripción'),
      },
    },
    async ({ id, ...patch }, extra) => {
      const token = tokenFrom(extra);
      const data = await apiFetch(token, `/tickets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      return jsonResult(data);
    }
  );
}
