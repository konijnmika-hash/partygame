import path from 'node:path';

const isProd = process.env.NODE_ENV === 'production';

export const config = {
  isProd,
  port: Number(process.env.PORT || 3001),
  host: process.env.HOST || '0.0.0.0',
  dbPath: process.env.DATABASE_PATH || path.resolve(process.cwd(), 'data/bloopbash.db'),
  /** comma separated list of extra allowed origins for the realtime handshake (dev tools, tunnels) */
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === '1' : isProd,
  trustProxy: process.env.TRUST_PROXY === '1',
  clientDist: path.resolve(process.cwd(), 'dist/client'),
  sessionDays: 180,
  maxRooms: Number(process.env.MAX_ROOMS || 2000),
};
