import { config } from '../config.js';

/**
 * URL de login de Google para el flujo OAuth del MCP. redirectUri debe ser
 * `${MCP_PUBLIC_URL}/oauth/google/callback` — hay que agregarlo a los
 * Authorized redirect URIs del cliente OAuth de Google Cloud existente.
 */
export function buildGoogleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
