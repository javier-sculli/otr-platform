import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { comparePassword } from '../lib/auth.js';
import { authenticate } from '../middleware/auth.js';
import { buildGoogleAuthUrl, exchangeCodeForTokens, getGoogleUserInfo } from '../lib/google-oauth.js';

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
      // Intercambiar code por tokens de Google
      const tokens = await exchangeCodeForTokens(code);

      // Obtener info del usuario de Google
      const googleUser = await getGoogleUserInfo(tokens.access_token);

      if (!googleUser.email_verified) {
        return reply.redirect(`${frontendUrl}/login?error=email_not_verified`);
      }

      // Buscar usuario en DB por googleId o email
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { googleId: googleUser.sub },
            { email: googleUser.email },
          ],
        },
        include: { area: true },
      });

      if (!user) {
        // Crear usuario nuevo con rol por defecto
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
        // Usuario existente con email/password que ahora usa Google → vincular cuenta
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId: googleUser.sub },
          include: { area: true },
        });
      }

      // Generar JWT propio (mismo formato que el login normal)
      const token = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      // Redirigir al frontend con el token
      return reply.redirect(`${frontendUrl}/auth/callback?token=${token}`);
    } catch (err) {
      fastify.log.error(err, 'Google OAuth callback error');
      return reply.redirect(`${frontendUrl}/login?error=google_failed`);
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

  // Logout (el cliente limpia el token)
  fastify.post('/logout', { preHandler: authenticate }, async () => {
    return { message: 'Logged out successfully' };
  });
}
