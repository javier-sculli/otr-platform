import { initSentry } from './lib/sentry.js';

// Must execute before Fastify or HTTP handlers are imported
initSentry();
