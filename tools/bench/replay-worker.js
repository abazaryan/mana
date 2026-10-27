/**
 * The bench's Worker for workerd (workerd-cpu.ts, replay.capnp): the Mana Worker's own bundle
 * (the file wrangler would upload, tools/bench/.out/worker/index.js) with a D1 that gives back
 * answers recorded in Node (node-cpu.ts --record) instead of a database. So the CPU of a request
 * in workerd is the Worker's own, plus the JavaScript work of a D1 binding: the query sent as JSON,
 * the answer parsed and turned into row objects (as workerd's binding does) — but no SQLite and no
 * local D1 service, which in wrangler dev run on the Worker's thread and would drown it.
 *   /__null — an empty answer (the baseline of workerd's own work per request)
 *   /__load — the answers for the next requests (a JSON array, one item per D1 round trip)
 *   /__cron — the Worker's scheduled handler
 */
import worker from './.out/worker/index.js';

let queue = [];

function nextAnswer() {
  const answer = queue.shift();
  if (!answer) throw new Error('replay: no recorded answer left');
  return answer;
}

function decode(text) {
  const parsed = JSON.parse(text);
  const { columns, rows } = parsed.results;
  const results = rows.map((row) => {
    const o = {};
    for (let i = 0; i < columns.length; i++) o[columns[i]] = row[i];
    return o;
  });
  return { success: true, results, meta: parsed.meta };
}

class Statement {
  constructor(sql, params = []) {
    this.sql = sql;
    this.params = params;
  }
  bind(...params) {
    return new Statement(this.sql, params);
  }
  one() {
    JSON.stringify({ sql: this.sql, params: this.params });
    return decode(nextAnswer()[0]);
  }
  async first(column) {
    const row = this.one().results[0];
    if (!row) return null;
    return column === undefined ? row : row[column];
  }
  async all() {
    return this.one();
  }
  async run() {
    return this.one();
  }
}

const DB = {
  prepare: (sql) => new Statement(sql),
  async batch(statements) {
    JSON.stringify(statements.map((s) => ({ sql: s.sql, params: s.params })));
    return nextAnswer().map(decode);
  },
};

const ASSETS = { fetch: async () => new Response(null, { status: 404 }) };

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/__null') return new Response('{}');
    if (pathname === '/__load') {
      queue = await request.json();
      return new Response(String(queue.length));
    }
    const workerEnv = { ...env, DB, ASSETS, AUTH_PEPPER: 'bench-pepper' };
    if (pathname === '/__cron') {
      await worker.scheduled({ scheduledTime: Date.now(), cron: '17 * * * *', noRetry() {} }, workerEnv, ctx);
      return new Response('cron');
    }
    return worker.fetch(request, workerEnv, ctx);
  },
};
