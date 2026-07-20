import dotenv from 'dotenv';
dotenv.config({ override: true });

export const config = {
  port: parseInt(process.env.PORT || '3002', 10),
  // Mismo secreto que apps/api: el access token de MCP es el JWT de la API tal cual.
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
  publicUrl: process.env.MCP_PUBLIC_URL || 'http://localhost:3002',
  google: {
    // Solo el client ID (público): el exchange del code con Google lo hace
    // apps/api, que ya tiene el client secret.
    clientId: process.env.GOOGLE_CLIENT_ID || '',
  },
} as const;
