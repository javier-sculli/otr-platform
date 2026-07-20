import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { comparePassword } from '../lib/auth.js';
import { authenticate } from '../middleware/auth.js';
import { buildGoogleAuthUrl, resolveGoogleUser } from '../lib/google-oauth.js';

export async function authRoutes(fastify: FastifyInstance) {
  // Login con email/password
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    const user = await prisma.user.findUnique({
      where: { email },
      include: { area: true },
    });

    // Usuario existe pero se registró con Google (no tiene contraseña)
    if (user && !user.password) {
      return reply.status(401).send({
        error: 'Este usuario está registrado con Google. Usá "Continuar con Google" para ingresar.',
      });
    }

    if (!user || !(await comparePassword(password, user.password!))) {
      return reply.status(401).send({ error: 'Credenciales inválidas' });
    }

    const token = fastify.jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    const { password: _, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token };
  });

  // Iniciar OAuth con Google — redirige al login de Google
  fastify.get('/google', async (_request, reply) => {
    const url = buildGoogleAuthUrl();
    return reply.redirect(url);
  });

  // Callback de Google — recibe el code, crea/busca el usuario, devuelve JWT
  fastify.get('/google/callback', async (request, reply) => {
    const { code, error } = request.query as { code?: string; error?: string };

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

    if (error || !code) {
      return reply.redirect(`${frontendUrl}/login?error=google_cancelled`);
    }

    try {
      const { token } = await resolveGoogleUser(fastify, code, process.env.GOOGLE_REDIRECT_URI!);

      // Redirigir al frontend con el token
      return reply.redirect(`${frontendUrl}/auth/callback?token=${token}`);
    } catch (err) {
      if (err instanceof Error && err.message === 'email_not_verified') {
        return reply.redirect(`${frontendUrl}/login?error=email_not_verified`);
      }
      fastify.log.error(err, 'Google OAuth callback error');
      return reply.redirect(`${frontendUrl}/login?error=google_failed`);
    }
  });

  // Variante JSON del callback de Google — usada por el MCP (apps/mcp), que
  // maneja su propio redirect_uri y no puede recibir un redirect a la SPA.
  fastify.post('/google/exchange', async (request, reply) => {
    const { code, redirectUri } = request.body as { code?: string; redirectUri?: string };

    if (!code || !redirectUri) {
      return reply.status(400).send({ error: 'code y redirectUri son requeridos' });
    }

    try {
      // Expiración explícita: el token de MCP debe expirar (lo exige el SDK de
      // MCP), a diferencia del login web que hoy no expira.
      const { token, user } = await resolveGoogleUser(fastify, code, redirectUri, { expiresIn: '90d' });
      return { token, user };
    } catch (err) {
      if (err instanceof Error && err.message === 'email_not_verified') {
        return reply.status(401).send({ error: 'email_not_verified' });
      }
      fastify.log.error(err, 'Google OAuth exchange error');
      return reply.status(401).send({ error: 'google_exchange_failed' });
    }
  });

  // Obtener usuario actual
  fastify.get('/me', { preHandler: authenticate }, async (request) => {
    const { id } = request.user as { id: string };

    const user = await prisma.user.findUnique({
      where: { id },
      include: { area: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword };
  });

  fastify.patch('/me', { preHandler: authenticate }, async (request) => {
    const { id } = request.user as { id: string };
    const { preferredClientIds } = request.body as { preferredClientIds?: string[] };

    const user = await prisma.user.update({
      where: { id },
      data: { ...(preferredClientIds !== undefined ? { preferredClientIds } : {}) },
      include: { area: true },
    });

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword };
  });

  // Logout (el cliente limpia el token)
  fastify.post('/logout', { preHandler: authenticate }, async () => {
    return { message: 'Logged out successfully' };
  });
}
