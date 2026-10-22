import { MIN_CLIENT, ORIGIN } from './config.ts';

/** GET and HEAD change nothing: no CSRF check for them. */
export function isSafeMethod(method: string): boolean {
  return method === 'GET' || method === 'HEAD';
}

/**
 * CSRF (STAGE6_RESEARCH 2.2): Sec-Fetch-Site must be same-origin; only without it, Origin must
 * be the site's. Neither header, or Origin: null — refused.
 */
export function isSameOrigin(headers: Headers): boolean {
  const site = headers.get('Sec-Fetch-Site');
  if (site !== null) return site === 'same-origin';
  return headers.get('Origin') === ORIGIN;
}

/** application/json, optionally with charset=utf-8; anything else is 415. */
export function isJson(headers: Headers): boolean {
  const [media = '', ...params] = (headers.get('Content-Type') ?? '').split(';');
  if (media.trim().toLowerCase() !== 'application/json') return false;
  return params.every((param) => {
    const [name = '', value = ''] = param.split('=');
    return name.trim().toLowerCase() === 'charset' && value.trim().replace(/"/g, '').toLowerCase() === 'utf-8';
  });
}

/**
 * The body as bytes, counted while reading: null as soon as it passes `limit` (413), so a
 * large body is never held in memory. A declared Content-Length over the limit stops at once.
 */
export async function readBody(request: Request, limit: number): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get('Content-Length'));
  if (declared > limit) return null;
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return bytes;
}

/** X-Mana-Version: the client's build (YYYYMMDDHHmm, src/core/build.ts); null if absent or malformed. */
export function clientBuild(headers: Headers): number | null {
  const value = headers.get('X-Mana-Version');
  return value !== null && /^\d{12}$/.test(value) ? Number(value) : null;
}

/** A client may change data only from build MIN_CLIENT on (426 otherwise; STAGE6_RESEARCH 5.5). */
export function isClientCurrent(headers: Headers, min = MIN_CLIENT): boolean {
  const build = clientBuild(headers);
  return build !== null && build >= min;
}
