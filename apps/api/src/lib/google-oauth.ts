import { FastifyInstance } from 'fastify';
import { prisma } from './prisma.js';

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
}

interface GoogleUserInfo {
  sub: string; // Google ID único
  email: string;
  name: string;
  picture?: string;
  email_verified: boolean;
}

/**
 * Intercambia el authorization code por tokens de Google.
 * redirectUri debe coincidir exactamente con el usado para obtener el code
 * (Google lo exige) — por default el de la SPA, pero /auth/google/exchange
 * (usado por el MCP) pasa el suyo propio.
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string = process.env.GOOGLE_REDIRECT_URI!
): Promise<GoogleTokenResponse> {
  const params = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google token exchange failed: ${error}`);
  }

  return response.json() as Promise<GoogleTokenResponse>;
}

/**
 * Obtiene la info del usuario de Google a partir del access_token
 */
export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to get Google user info');
  }

  return response.json() as Promise<GoogleUserInfo>;
}

/**
 * Construye la URL de autorización de Google
 */
export function buildGoogleAuthUrl(redirectUri: string = process.env.GOOGLE_REDIRECT_URI!): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Intercambia un code de Google por el usuario resuelto (busca/crea) y un JWT
 * propio. Compartido entre el callback de la SPA (GET /auth/google/callback)
 * y el endpoint JSON usado por el MCP (POST /auth/google/exchange).
 */
export async function resolveGoogleUser(
  fastify: FastifyInstance,
  code: string,
  redirectUri: string,
  options: { expiresIn?: string } = {}
) {
  const tokens = await exchangeCodeForTokens(code, redirectUri);
  const googleUser = await getGoogleUserInfo(tokens.access_token);

  if (!googleUser.email_verified) {
    throw new Error('email_not_verified');
  }

  let user = await prisma.user.findFirst({
    where: {
      OR: [{ googleId: googleUser.sub }, { email: googleUser.email }],
    },
    include: { area: true },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: googleUser.email,
        name: googleUser.name,
        googleId: googleUser.sub,
        role: 'CONTENIDISTA', // Rol por defecto — un admin puede cambiarlo
        password: null,
      },
      include: { area: true },
    });
  } else if (!user.googleId) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId: googleUser.sub },
      include: { area: true },
    });
  }

  const token = fastify.jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    options.expiresIn ? { expiresIn: options.expiresIn } : undefined
  );

  const { password: _password, ...userWithoutPassword } = user;

  return { token, user: userWithoutPassword };
}
