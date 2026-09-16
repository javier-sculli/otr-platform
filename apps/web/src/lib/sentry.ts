import * as Sentry from '@sentry/react';

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN || 'https://9e1fadf7f704326b886f161671355ba1@o4512098114011136.ingest.us.sentry.io/4512098121154560';
  if (!dsn) {
    console.log('ℹ️  Sentry DSN not provided (VITE_SENTRY_DSN). Sentry monitoring disabled.');
    return;
  }

  Sentry.init({
    dsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // Tracing
    tracesSampleRate: 1.0,
    // Session Replay
    replaysSessionSampleRate: 1.0,
    replaysOnErrorSampleRate: 1.0,
  });

  console.log('⚡ Sentry Frontend APM & Session Replay initialized.');
}

export { Sentry };
