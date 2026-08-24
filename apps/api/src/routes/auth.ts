import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { comparePassword, hashPassword } from '../lib/auth.js';
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

  // Registro de nuevo usuario (Sign up)
  fastify.post('/register', async (request, reply) => {
    const { name, email, password, areaId, role } = request.body as {
      name: string;
      email: string;
      password: string;
      areaId?: string;
      role?: string;
    };

    if (!name || !email || !password) {
      return reply.status(400).send({ error: 'Nombre, email y contraseña son obligatorios' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return reply.status(400).send({ error: 'Este email ya está registrado' });
    }

    const hashedPassword = await hashPassword(password);

    let userRole: 'CONTENIDISTA' | 'COORDINADOR' | 'DIRECCION' = 'CONTENIDISTA';
    if (role && ['CONTENIDISTA', 'COORDINADOR', 'DIRECCION'].includes(role)) {
      userRole = role as any;
    }

    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashedPassword,
        role: userRole,
        areaId: areaId || null,
      },
      include: { area: true },
    });

    const token = fastify.jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    const { password: _, ...userWithoutPassword } = user;

    return reply.status(201).send({ user: userWithoutPassword, token });
  });

  // Obtener catálogo de áreas públicas para la selección de rol
  fastify.get('/areas', async () => {
    const areas = await prisma.area.findMany({
      orderBy: { name: 'asc' },
    });
    return { data: areas };
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
    const { preferredClientIds, areaId, role } = request.body as {
      preferredClientIds?: string[];
      areaId?: string;
      role?: string;
    };

    const updateData: any = {};
    if (preferredClientIds !== undefined) updateData.preferredClientIds = preferredClientIds;
    if (areaId !== undefined) updateData.areaId = areaId;
    if (role !== undefined && ['CONTENIDISTA', 'COORDINADOR', 'DIRECCION'].includes(role)) {
      updateData.role = role;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
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
