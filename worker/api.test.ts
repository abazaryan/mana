import { describe, expect, it } from 'vitest';
import { handleApi, type Routes } from './api.ts';
import { DEFAULT_BODY_LIMIT, MIN_CLIENT, ORIGIN } from './config.ts';
import { API_HEADERS } from './http.ts';
import worker from './index.ts';
import { fakeD1 } from './test/sqlite-d1.ts';

const assets = { fetch: async () => new Response(null, { status: 404 }) };
const env = (db: unknown = fakeD1()) => ({ DB: db, ASSETS: assets }) as unknown as Env;

const url = (path: string) => `${ORIGIN}${path}`;
const own = { 'Sec-Fetch-Site': 'same-origin' };
const current = { 'X-Mana-Version': String(MIN_CLIENT) };
const jsonType = { 'Content-Type': 'application/json' };

/** A table with test routes, so the body checks are tested without such routes on the site. */
const TEST_ROUTES: Routes = {
  '/api/echo': {
    POST: { body: true, handle: ({ body }) => Response.json({ got: body }) },
    PUT: { body: 10, handle: () => new Response('ok') },
  },
  '/api/change': { POST: { mutating: true, handle: () => new Response('ok') } },
  '/api/boom': {
    GET: {
      handle: () => {
        throw new Error('secret detail');
      },
    },
  },
};

const call = (path: string, init?: RequestInit, routes?: Routes) => handleApi(new Request(url(path), init), env(), routes);

function expectApiHeaders(response: Response) {
  for (const [name, value] of Object.entries(API_HEADERS)) expect(response.headers.get(name), name).toBe(value);
  expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
}

describe('GET /api/health', () => {
  it('200 with the database: ok and db, nothing about the system', async () => {
    const response = await call('/api/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, db: true });
    expectApiHeaders(response);
  });

  it('HEAD — same status and headers, no body', async () => {
    const response = await call('/api/health', { method: 'HEAD' });
    expect(response.status).toBe(200);
    expectApiHeaders(response);
    expect(await response.text()).toBe('');
  });

  it('503 without a database binding', async () => {
    const response = await handleApi(new Request(url('/api/health')), { ASSETS: assets } as unknown as Env);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, db: false });
    expectApiHeaders(response);
  });

  it('503 when the migration is not applied (no table)', async () => {
    const response = await handleApi(new Request(url('/api/health')), env(fakeD1({ migrate: false })));
    expect(response.status).toBe(503);
  });

  it('503 when the database throws', async () => {
    const broken = {
      prepare: () => {
        throw new Error('D1 down');
      },
    };
    const response = await handleApi(new Request(url('/api/health')), env(broken));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('D1 down');
  });
});

describe('unknown paths and methods', () => {
  it('404 JSON under /api', async () => {
    for (const path of ['/api/nope', '/api', '/api/', '/api/health/']) {
      const response = await call(path);
      expect(response.status, path).toBe(404);
      expect(await response.json()).toEqual({ error: 'not_found' });
      expectApiHeaders(response);
    }
  });

  it('405 with Allow for a method the path does not have', async () => {
    const response = await call('/api/health', { method: 'POST', headers: own });
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET, HEAD');
    expect(await response.json()).toEqual({ error: 'method_not_allowed' });
  });

  it('500 with a short code: no message, no stack', async () => {
    const response = await call('/api/boom', undefined, TEST_ROUTES);
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ error: 'internal' });
    expect(text).not.toContain('secret');
    expectApiHeaders(response);
  });
});

describe('CSRF: every method but GET and HEAD', () => {
  const post = (headers: Record<string, string>) => call('/api/health', { method: 'POST', headers });

  it('own request passes (Sec-Fetch-Site: same-origin) — to 405 here', async () => {
    expect((await post(own)).status).toBe(405);
  });

  it('without Sec-Fetch-Site the own Origin passes', async () => {
    expect((await post({ Origin: ORIGIN })).status).toBe(405);
  });

  it('403 for a foreign Origin, no headers, Origin: null', async () => {
    for (const headers of [{ Origin: 'https://evil.example' }, {}, { Origin: 'null' }, { Origin: 'http://mana.amisipehr.workers.dev' }]) {
      const response = await post(headers);
      expect(response.status, JSON.stringify(headers)).toBe(403);
      expect(await response.json()).toEqual({ error: 'forbidden' });
      expectApiHeaders(response);
    }
  });

  it('403 when Sec-Fetch-Site is not same-origin, even with the own Origin', async () => {
    for (const site of ['cross-site', 'same-site', 'none']) {
      expect((await post({ 'Sec-Fetch-Site': site, Origin: ORIGIN })).status, site).toBe(403);
    }
  });

  it('403 comes before 404: a foreign POST learns nothing about paths', async () => {
    expect((await call('/api/nope', { method: 'POST', headers: { Origin: 'https://evil.example' } })).status).toBe(403);
  });

  it('GET needs no Sec-Fetch-Site or Origin', async () => {
    expect((await call('/api/health', { headers: { Origin: 'https://evil.example' } })).status).toBe(200);
  });
});

describe('JSON body: 415, 413, 400', () => {
  const echo = (body: BodyInit | null, headers: Record<string, string> = jsonType, method = 'POST') =>
    call('/api/echo', { method, body, headers: { ...own, ...headers } }, TEST_ROUTES);

  it('application/json is read and parsed', async () => {
    const response = await echo('{"a":1}');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ got: { a: 1 } });
    expect((await echo('[]', { 'Content-Type': 'application/json; charset=UTF-8' })).status).toBe(200);
  });

  it('415 for anything but application/json', async () => {
    for (const type of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', 'application/json; charset=latin1', 'application/jsonx']) {
      const response = await echo('{}', { 'Content-Type': type });
      expect(response.status, type).toBe(415);
      expect(await response.json()).toEqual({ error: 'unsupported_media_type' });
    }
    expect((await echo('{}', {})).status).toBe(415);
  });

  it('413 over the limit, counted in bytes while reading (no Content-Length)', async () => {
    const stream = (size: number) =>
      new ReadableStream({
        start(controller) {
          const chunk = new Uint8Array(1000).fill(0x20);
          for (let left = size; left > 0; left -= chunk.length) controller.enqueue(chunk.subarray(0, Math.min(left, chunk.length)));
          controller.close();
        },
      });
    const send = (size: number) =>
      handleApi(
        new Request(url('/api/echo'), { method: 'POST', body: stream(size), headers: { ...own, ...jsonType }, duplex: 'half' } as RequestInit),
        env(),
        TEST_ROUTES,
      );
    const over = await send(DEFAULT_BODY_LIMIT + 1);
    expect(over.status).toBe(413);
    expect(await over.json()).toEqual({ error: 'payload_too_large' });
    // exactly the limit passes the size check (spaces only — then not JSON: 400)
    expect((await send(DEFAULT_BODY_LIMIT)).status).toBe(400);
  });

  it('413 at once for a declared Content-Length over the limit', async () => {
    const request = new Request(url('/api/echo'), { method: 'POST', body: '{}', headers: { ...own, ...jsonType } });
    const headers = new Headers(request.headers);
    headers.set('Content-Length', String(DEFAULT_BODY_LIMIT + 1));
    const response = await handleApi(new Request(request, { headers }), env(), TEST_ROUTES);
    expect(response.status).toBe(413);
  });

  it('a route sets its own limit (in bytes, not characters)', async () => {
    expect((await echo('"ééééé"', jsonType, 'PUT')).status).toBe(413); // 12 bytes, 7 characters
    expect((await echo('"éééé"', jsonType, 'PUT')).status).toBe(200); // 10 bytes
  });

  it('400 for bad JSON, empty body or broken UTF-8', async () => {
    for (const body of ['{', '', new Uint8Array([0x22, 0xff, 0x22])]) {
      const response = await echo(body);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'bad_json' });
    }
  });
});

describe('X-Mana-Version: 426 for changes from an old client', () => {
  const change = (headers: Record<string, string>) => call('/api/change', { method: 'POST', headers: { ...own, ...headers } }, TEST_ROUTES);

  it('MIN_CLIENT and newer pass', async () => {
    expect((await change(current)).status).toBe(200);
    expect((await change({ 'X-Mana-Version': String(MIN_CLIENT + 1) })).status).toBe(200);
  });

  it('426 for an older build, no header or a malformed one', async () => {
    for (const headers of [{ 'X-Mana-Version': String(MIN_CLIENT - 1) }, {}, { 'X-Mana-Version': 'abc' }, { 'X-Mana-Version': '2026102300' }]) {
      const response = await change(headers);
      expect(response.status, JSON.stringify(headers)).toBe(426);
      expect(await response.json()).toEqual({ error: 'upgrade_required' });
      expectApiHeaders(response);
    }
  });

  it('CSRF is checked first: a foreign old client gets 403', async () => {
    const response = await call('/api/change', { method: 'POST', headers: { Origin: 'https://evil.example' } }, TEST_ROUTES);
    expect(response.status).toBe(403);
  });
});

describe('the Worker entry', () => {
  it('/api/* goes to the API', async () => {
    const response = await worker.fetch(new Request(url('/api/health')), env(), {} as ExecutionContext);
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Mana-Worker')).toBeNull();
  });

  it('other paths go back to the static files, marked', async () => {
    const seen: string[] = [];
    const assets = {
      fetch: async (request: Request) => {
        seen.push(new URL(request.url).pathname);
        return new Response(null, { status: 404, headers: { 'Content-Security-Policy': "default-src 'self'" } });
      },
    };
    const response = await worker.fetch(new Request(url('/nope')), { DB: fakeD1(), ASSETS: assets } as unknown as Env, {} as ExecutionContext);
    expect(seen).toEqual(['/nope']);
    expect(response.status).toBe(404);
    expect(response.headers.get('X-Mana-Worker')).toBe('assets');
    expect(response.headers.get('Content-Security-Policy')).toBe("default-src 'self'");
    expect(response.headers.get('Cross-Origin-Resource-Policy')).toBeNull();
  });

  it('/apix is not the API', async () => {
    const response = await worker.fetch(new Request(url('/apix')), env(), {} as ExecutionContext);
    expect(response.headers.get('X-Mana-Worker')).toBe('assets');
  });
});
