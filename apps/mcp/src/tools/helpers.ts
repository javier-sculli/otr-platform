import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';

export function tokenFrom(extra: RequestHandlerExtra<ServerRequest, ServerNotification>): string {
  const token = extra.authInfo?.token;
  if (!token) throw new Error('No autenticado');
  return token;
}

export function jsonResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}
