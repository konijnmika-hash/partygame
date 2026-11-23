export interface ApiResult<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  progress?: any;
}

import { P2P } from '../p2p/mode';

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  if (P2P) return (await import('../p2p/local')).localApi<T>(path, opts as any);
  try {
    const res = await fetch(`/api${path}`, {
      method: opts.method ?? 'GET',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-requested-with': 'bloopbash' },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const json = await res.json().catch(() => ({ ok: false, error: 'Bad response' }));
    if (!res.ok && json.ok !== false) return { ok: false, error: `Error ${res.status}` };
    return json as ApiResult<T>;
  } catch {
    return { ok: false, error: 'Network error — are you online?' };
  }
}
