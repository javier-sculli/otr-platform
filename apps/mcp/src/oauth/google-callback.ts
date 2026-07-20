import type { Express } from 'express';
import { config } from '../config.js';
import type { OtrMcpAuthProvider } from './provider.js';

/**
 * Google redirige acá después de que el usuario loguea. Le pasamos el code a
 * apps/api (POST /auth/google/exchange), que hace el intercambio real con
 * Google y resuelve/crea el User — el MCP nunca toca la DB. Con el JWT que
 * devuelve, emitimos nuestro propio authorization code de MCP y volvemos a
 * redirigir al redirect_uri original de Claude.
 */
export function registerGoogleCallbackRoute(app: Express, provider: OtrMcpAuthProvider) {
  app.get('/oauth/google/callback', async (req, res) => {
    const { code, state, error } = req.query as { code?: string; state?: string; error?: string };

    if (error || !code || !state) {
      res.status(400).send('Login con Google cancelado o inválido. Volvé a intentarlo desde Claude.');
      return;
    }

    try {
      const redirectUri = new URL('/oauth/google/callback', config.publicUrl).toString();

      const exchangeRes = await fetch(`${config.apiBaseUrl}/auth/google/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirectUri }),
      });

      if (!exchangeRes.ok) {
        throw new Error(`apps/api /auth/google/exchange respondió ${exchangeRes.status}: ${await exchangeRes.text()}`);
      }

      const { token } = (await exchangeRes.json()) as { token: string };
      const result = await provider.completeGoogleLogin(state, token);

      const target = new URL(result.redirectUri);
      target.searchParams.set('code', result.code);
      if (result.state !== undefined) target.searchParams.set('state', result.state);

      res.redirect(target.toString());
    } catch (err) {
      console.error('Error en callback de Google (mcp)', err);
      res.status(500).send('No se pudo completar el login con Google. Volvé a intentarlo desde Claude.');
    }
  });
}
