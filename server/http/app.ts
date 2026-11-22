import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config';
import { apiRouter, type HttpDeps } from './routes';

/** Security headers (a small, dependency-free helmet). */
function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=(self), accelerometer=(self), gyroscope=(self)');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "media-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' ws: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '),
  );
  next();
}

/** CSRF protection: state-changing API calls must carry a custom header (forces CORS preflight). */
function csrfGuard(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  if (req.headers['x-requested-with'] !== 'bloopbash') {
    res.status(403).json({ ok: false, error: 'Missing request header' });
    return;
  }
  next();
}

export function createHttpApp(deps: HttpDeps): express.Express {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);
  app.use(securityHeaders);
  app.use('/api', express.json({ limit: '32kb' }), csrfGuard, apiRouter(deps));
  app.use('/api', (_req, res) => {
    res.status(404).json({ ok: false, error: 'Not found' });
  });

  // production: serve the built client with SPA fallback
  const dist = config.clientDist;
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(
      express.static(dist, {
        index: false,
        maxAge: '1h',
        setHeaders(res, file) {
          if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        },
      }),
    );
    app.get(/^\/(?!api|socket\.io).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  // error handler (bad JSON etc.)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = typeof err?.status === 'number' ? err.status : 500;
    if (status >= 500) console.error('[http]', err);
    res.status(status).json({ ok: false, error: status >= 500 ? 'Server error' : 'Bad request' });
  });
  return app;
}
