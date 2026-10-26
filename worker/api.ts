import { PUSH_BODY_LIMIT } from '../src/core/syncProtocol.ts';
import { deleteAccount, exportHead, exportJournal } from './account.ts';
import { addAlias, devices, giveConsent, inviteInfo, issueCode, logout, me, pair, redeem, renameDevice, revokeDevice } from './auth.ts';
import { DEFAULT_BODY_LIMIT, SMALL_BODY_LIMIT } from './config.ts';
import { isClientCurrent, isJson, isSafeMethod, isSameOrigin, readBody } from './guards.ts';
import { health } from './health.ts';
import { error } from './http.ts';
import { pull, push } from './sync.ts';

export interface Call {
  request: Request;
  env: Env;
  /** Parsed JSON body; undefined for routes without one. */
  body: unknown;
  /** Time of the request, ms UTC (passed in, so tests can move it). */
  now: number;
}

export interface Route {
  /** Changes data: refused with 426 for a client older than MIN_CLIENT (from 6a.3 on). */
  mutating?: boolean;
  /** Changes nothing, yet refused with 426 for an old client too (the sync pull, R39). */
  current?: boolean;
  /** Takes a JSON body: true — up to DEFAULT_BODY_LIMIT bytes, a number — up to that. */
  body?: true | number;
  handle(call: Call): Response | Promise<Response>;
}

/** Path → method → route. HEAD is served by the GET route. */
export type Routes = Readonly<Record<string, Readonly<Partial<Record<string, Route>>>>>;

/**
 * Sign-in routes (6a.2): every one that changes data refuses an old client with 426 — except
 * logout, which must always work. Sync (6a.3): push and pull both refuse it — a device with an
 * empty queue only pulls, and must learn about a newer format too (R39). The account (6a.5, R42):
 * consent and erasure change data (426); the export only reads.
 */
export const ROUTES: Routes = {
  '/api/health': { GET: { handle: ({ env }) => health(env) } },
  '/api/auth/invite': { POST: { body: SMALL_BODY_LIMIT, handle: inviteInfo } },
  '/api/auth/redeem': { POST: { mutating: true, body: true, handle: redeem } },
  '/api/auth/pair': { POST: { mutating: true, body: SMALL_BODY_LIMIT, handle: pair } },
  '/api/auth/pairing-code': { POST: { mutating: true, handle: issueCode } },
  '/api/auth/me': { GET: { handle: me } },
  '/api/auth/alias': { POST: { mutating: true, body: SMALL_BODY_LIMIT, handle: addAlias } },
  '/api/auth/devices': { GET: { handle: devices } },
  '/api/auth/device': { POST: { mutating: true, body: SMALL_BODY_LIMIT, handle: renameDevice } },
  '/api/auth/devices/revoke': { POST: { mutating: true, body: SMALL_BODY_LIMIT, handle: revokeDevice } },
  '/api/auth/logout': { POST: { handle: logout } },
  '/api/auth/consent': { POST: { mutating: true, body: SMALL_BODY_LIMIT, handle: giveConsent } },
  '/api/account/export': { GET: { handle: exportHead } },
  '/api/account/export/journal': { GET: { handle: exportJournal } },
  '/api/account/delete': { POST: { mutating: true, body: SMALL_BODY_LIMIT, handle: deleteAccount } },
  '/api/sync/push': { POST: { mutating: true, body: PUSH_BODY_LIMIT, handle: push } },
  '/api/sync/pull': { GET: { current: true, handle: pull } },
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
export async function handleApi(request: Request, env: Env, routes: Routes = ROUTES, now = Date.now()): Promise<Response> {
  try {
    if (!isSafeMethod(request.method) && !isSameOrigin(request.headers)) return error('forbidden', 403);
    const methods = routes[new URL(request.url).pathname];
    if (!methods) return error('not_found', 404);
    const route = methods[request.method === 'HEAD' ? 'GET' : request.method];
    if (!route) return error('method_not_allowed', 405, { Allow: allowHeader(methods) });
    if ((route.mutating || route.current) && !isClientCurrent(request.headers)) return error('upgrade_required', 426);
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
    const response = await route.handle({ request, env, body, now });
    return request.method === 'HEAD' ? new Response(null, response) : response;
  } catch {
    return error('internal', 500);
  }
}
