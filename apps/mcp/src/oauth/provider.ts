import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import type { OAuthServerProvider, AuthorizationParams } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type { OAuthClientInformationFull, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { InvalidRequestError, InvalidGrantError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { config } from '../config.js';
import { buildGoogleAuthUrl } from './google.js';

const PENDING_TTL_MS = 5 * 60 * 1000; // ventana para completar el login de Google
const CODE_TTL_MS = 2 * 60 * 1000; // ventana para que Claude canjee el authorization code

interface PendingAuthorization {
  client: OAuthClientInformationFull;
  params: AuthorizationParams;
}

interface IssuedCode {
  client: OAuthClientInformationFull;
  params: AuthorizationParams;
  apiToken: string;
}

/**
 * Registro de clientes en memoria (Dynamic Client Registration). No persiste
 * entre reinicios del servicio — si Railway reinicia el proceso mientras hay
 * un cliente registrado, Claude vuelve a registrarse automáticamente en el
 * próximo intento de conexión. Aceptable para el volumen de uso interno de v1.
 */
class InMemoryClientsStore implements OAuthRegisteredClientsStore {
  private clients = new Map<string, OAuthClientInformationFull>();

  async getClient(clientId: string) {
    return this.clients.get(clientId);
  }

  async registerClient(client: OAuthClientInformationFull) {
    this.clients.set(client.client_id, client);
    return client;
  }
}

/**
 * Adaptador OAuth 2.1 -> login de Google -> JWT de apps/api.
 *
 * El MCP no valida credenciales ni toca la base de datos: delega el login a
 * Google y, para resolver el usuario, llama a POST /auth/google/exchange en
 * apps/api (que reusa exactamente la misma lógica que ya usa la SPA). El JWT
 * que devuelve esa llamada se usa tal cual como access_token de MCP, así que
 * verificarlo acá es solo validar la firma con el mismo JWT_SECRET.
 */
export class OtrMcpAuthProvider implements OAuthServerProvider {
  readonly clientsStore = new InMemoryClientsStore();
  private pending = new Map<string, PendingAuthorization>(); // keyed por el state que le pasamos a Google
  private codes = new Map<string, IssuedCode>(); // keyed por nuestro authorization code de MCP

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    const googleState = randomUUID();
    this.pending.set(googleState, { client, params });
    setTimeout(() => this.pending.delete(googleState), PENDING_TTL_MS).unref();

    const googleRedirectUri = new URL('/oauth/google/callback', config.publicUrl).toString();
    res.redirect(buildGoogleAuthUrl(googleRedirectUri, googleState));
  }

  /**
   * Llamado por la ruta /oauth/google/callback una vez que Google ya
   * autenticó al usuario y apps/api resolvió el JWT correspondiente.
   * Devuelve a dónde y con qué authorization code redirigir de vuelta a Claude.
   */
  async completeGoogleLogin(googleState: string, apiToken: string) {
    const pendingAuth = this.pending.get(googleState);
    if (!pendingAuth) {
      throw new InvalidRequestError('Sesión de login expirada o inválida — reintentá conectar desde Claude');
    }
    this.pending.delete(googleState);

    const code = randomUUID();
    this.codes.set(code, { client: pendingAuth.client, params: pendingAuth.params, apiToken });
    setTimeout(() => this.codes.delete(code), CODE_TTL_MS).unref();

    return { redirectUri: pendingAuth.params.redirectUri, code, state: pendingAuth.params.state };
  }

  async challengeForAuthorizationCode(_client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    const issued = this.codes.get(authorizationCode);
    if (!issued) throw new InvalidGrantError('Authorization code inválido o expirado');
    return issued.params.codeChallenge;
  }

  async exchangeAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<OAuthTokens> {
    const issued = this.codes.get(authorizationCode);
    if (!issued) throw new InvalidGrantError('Authorization code inválido o expirado');
    if (issued.client.client_id !== client.client_id) {
      throw new InvalidGrantError('El authorization code no fue emitido para este cliente');
    }
    this.codes.delete(authorizationCode);

    const decoded = jwt.decode(issued.apiToken) as { exp?: number } | null;
    const expiresIn = decoded?.exp
      ? Math.max(decoded.exp - Math.floor(Date.now() / 1000), 60)
      : 60 * 60 * 24 * 30; // fallback 30 días si el JWT de la API no trae exp

    return {
      access_token: issued.apiToken,
      token_type: 'bearer',
      expires_in: expiresIn,
      scope: (issued.params.scopes || []).join(' '),
    };
  }

  async exchangeRefreshToken(): Promise<OAuthTokens> {
    // No hay refresh tokens en v1 — al expirar, Claude vuelve a pedir /authorize.
    throw new InvalidGrantError('Refresh tokens no soportados en este servidor');
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const decoded = jwt.verify(token, config.jwtSecret) as { id: string; email: string; role: string; exp?: number };
    return {
      token,
      clientId: decoded.email,
      scopes: [],
      expiresAt: decoded.exp,
    };
  }
}
