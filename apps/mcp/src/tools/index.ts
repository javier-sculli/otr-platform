import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTicketTools } from './tickets.js';
import { registerCatalogTools } from './catalogs.js';
import { registerKnowledgeTools } from './knowledge.js';

export function registerTools(server: McpServer) {
  registerTicketTools(server);
  registerCatalogTools(server);
  registerKnowledgeTools(server);
}
