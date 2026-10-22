import { DEFAULT_BODY_LIMIT } from './config.ts';
import { isClientCurrent, isJson, isSafeMethod, isSameOrigin, readBody } from './guards.ts';
import { health } from './health.ts';
import { error } from './http.ts';

export interface Call {
  request: Request;
  env: Env;
  /** Parsed JSON body; undefined for routes without one. */
  body: unknown;
}

export interface Route {
  /** Changes data: refused with 426 for a client older than MIN_CLIENT (from 6a.3 on). */
  mutating?: boolean;
  /** Takes a JSON body: true — up to DEFAULT_BODY_LIMIT bytes, a number — up to that. */
  body?: true | number;
  handle(call: Call): Response | Promise<Response>;
}

/** Path → method → route. HEAD is served by the GET route. */
export type Routes = Readonly<Record<string, Readonly<Partial<Record<string, Route>>>>>;

export const ROUTES: Routes = {
  '/api/health': { GET: { handle: ({ env }) => health(env) } },
};

function allowHeader(methods: Readonly<Partial<Record<string, Route>>>): string {
  const names = Object.keys(methods);
  return (names.includes('GET') ? [...names, 'HEAD'] : names).join(', ');
}

/**
 * /api/*: CSRF (403) for every method but GET and HEAD, then the route (404 / 405), then the
 * route's own checks: client version (426), JSON only (415), body size (413), valid JSON (400).
 * Any exception — 500 with a short code, nothing else.
 */
export async function handleApi(request: Request, env: Env, routes: Routes = ROUTES): Promise<Response> {
  try {
    if (!isSafeMethod(request.method) && !isSameOrigin(request.headers)) return error('forbidden', 403);
    const methods = routes[new URL(request.url).pathname];
    if (!methods) return error('not_found', 404);
    const route = methods[request.method === 'HEAD' ? 'GET' : request.method];
    if (!route) return error('method_not_allowed', 405, { Allow: allowHeader(methods) });
    if (route.mutating && !isClientCurrent(request.headers)) return error('upgrade_required', 426);
    let body: unknown;
    if (route.body !== undefined) {
      if (!isJson(request.headers)) return error('unsupported_media_type', 415);
      const bytes = await readBody(request, route.body === true ? DEFAULT_BODY_LIMIT : route.body);
      if (bytes === null) return error('payload_too_large', 413);
      try {
        body = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes));
      } catch {
        return error('bad_json', 400);
      }
    }
    const response = await route.handle({ request, env, body });
    return request.method === 'HEAD' ? new Response(null, response) : response;
  } catch {
    return error('internal', 500);
  }
}
