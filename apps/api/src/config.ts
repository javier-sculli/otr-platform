import dotenv from 'dotenv';
dotenv.config({ override: true });

const rawFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
// Canonical production domain is https://rocky.ontherocks.tech even if FRONTEND_URL in Railway points to .vercel.app
const canonicalFrontendUrl =
  rawFrontendUrl.includes('.vercel.app')
    ? 'https://rocky.ontherocks.tech'
    : rawFrontendUrl.replace(/\/$/, '');

export function isAllowedFrontendOrigin(origin?: string | null): boolean {
  if (!origin) return false;
  const clean = origin.replace(/\/$/, '');
  if (clean === 'https://rocky.ontherocks.tech') return true;
  if (clean === rawFrontendUrl.replace(/\/$/, '')) return true;
  if (clean.endsWith('.ontherocks.tech')) return true;
  if (clean.endsWith('.vercel.app')) return true;
  if (clean.startsWith('http://localhost:') || clean.startsWith('http://127.0.0.1:')) return true;
  return false;
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || process.env.API_PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  frontendUrl: canonicalFrontendUrl,
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback',
  },
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFrom: process.env.RESEND_FROM || 'ROCKY Platform <notificaciones@ontherocks.tech>',
  sentryDsn: process.env.SENTRY_DSN || 'https://9e1fadf7f704326b886f161671355ba1@o4512098114011136.ingest.us.sentry.io/4512098121154560',
} as const;

