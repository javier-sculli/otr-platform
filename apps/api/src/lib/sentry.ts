import * as Sentry from '@sentry/node';
import { config } from '../config.js';

export function initSentry(): void {
  if (!config.sentryDsn) {
    console.log('ℹ️  Sentry DSN not provided (SENTRY_DSN). Sentry monitoring disabled.');
    return;
  }

  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.nodeEnv,
    tracesSampleRate: 1.0, // Capture 100% of transactions for full visibility
  });

  console.log('⚡ Sentry APM & Tracing initialized successfully.');
}

export { Sentry };
