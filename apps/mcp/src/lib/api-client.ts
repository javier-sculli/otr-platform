import { config } from '../config.js';

/**
 * Wrapper fino sobre fetch hacia apps/api. El MCP no tiene lógica de negocio
 * propia — cada tool reenvía el bearer token (el JWT de la API) y devuelve
 * la respuesta tal cual.
 */
export async function apiFetch<T = unknown>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`apps/api ${path} respondió ${res.status}: ${body || res.statusText}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
