import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { config } from './config.js';
import { authRoutes } from './routes/auth.js';
import { ticketsRoutes } from './routes/tickets.js';
import { catalogsRoutes } from './routes/catalogs.js';
import { aiRoutes } from './routes/ai.js';

const fastify = Fastify({
  logger: {
    level: config.nodeEnv === 'development' ? 'info' : 'warn',
  },
});

// Plugins
await fastify.register(cors, {
  origin: config.nodeEnv === 'development' ? '*' : config.frontendUrl,
  credentials: true,
});

await fastify.register(jwt, {
  secret: config.jwtSecret,
});

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Routes
await fastify.register(authRoutes, { prefix: '/auth' });
await fastify.register(ticketsRoutes, { prefix: '/tickets' });
await fastify.register(catalogsRoutes, { prefix: '/catalogs' });
await fastify.register(aiRoutes, { prefix: '/ai' });

// Start server
try {
  await fastify.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`🚀 Server running on http://localhost:${config.port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
