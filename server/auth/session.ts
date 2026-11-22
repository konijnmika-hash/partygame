import type { Request, Response } from 'express';
import { config } from '../config';

export const COOKIE_NAME = 'bb_token';

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

export function tokenFromHeaders(headers: { cookie?: string; authorization?: string }): string | null {
  const auth = headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return parseCookies(headers.cookie)[COOKIE_NAME] || null;
}

export function tokenFromRequest(req: Request): string | null {
  return tokenFromHeaders({ cookie: req.headers.cookie, authorization: req.headers.authorization });
}

export function setTokenCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: config.sessionDays * 86400_000,
    path: '/',
  });
}

export function clearTokenCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/', httpOnly: true, sameSite: 'lax', secure: config.cookieSecure });
}
