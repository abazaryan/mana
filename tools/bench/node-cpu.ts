/**
 * CPU of the Worker's routes in Node (step "CPU of sign-in routes"): the bundle wrangler would
 * upload, over node:sqlite (d1-node.ts). For taking the CPU apart by operations; the forecast for
 * the server comes from workerd (workerd-cpu.ts).
 *
 * The main number per call: its wall time minus SQLite (`wall`). The handler runs alone and
 * awaits one thing at a time, so this is the CPU of every thread on its path — the main thread and
 * the thread pool where Node computes crypto.subtle (workerd computes it on the isolate's thread)
 * — plus the hand-offs between them. CPU counters (process.cpuUsage, threadCpuUsage) advance in
 * steps of about 15.6 ms on Windows: they are kept per call (`all`, `thread`, coarse) and, for the
 * warm calls, as the total of the whole loop divided by N — the check of `wall`.
 * "Cold" — a new process, the first call of the route
 * (Node's own lazy parts — fetch classes, Web Crypto — warmed first, the Worker's code not);
 * "warm" — after W calls, N calls. `emulate` — with the D1 binding's JSON work (d1-node.ts).
 *
 *   node tools/bench/node-cpu.ts [--only a,b] [--cold 10] [--no-build]
 * Results: tools/bench/.out/node-results.json. No timing assertions anywhere — numbers only.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Session } from 'node:inspector/promises';
import { pathToFileURL } from 'node:url';
import { ORIGIN } from '../../worker/config.ts';
import { NodeD1 } from './d1-node.ts';
import { buildWorld, cookieFrom, type Call } from './fixtures.ts';
import { BUNDLE, BUNDLE_DIR, OUT, REPLAY, ROOT } from './paths.ts';
import { summarize, type CpuProfile, type ProfileSummary } from './profile.ts';
import { CHAINS, SCENARIOS, type Scenario } from './scenarios.ts';

const PEPPER = 'bench-pepper';
const WRANGLER = `${ROOT}node_modules/wrangler/bin/wrangler.js`;

export interface Measure {
  /** Wall time of the call minus SQLite, microseconds — the main number. */
  wall: number;
  /** CPU of all threads minus SQLite, microseconds (coarse on Windows). */
  all: number;
  /** CPU of the main thread minus SQLite, microseconds. */
  thread: number;
  sql: number;
  queries: number;
  status: number;
  name?: string;
}

/** The Worker's bundle exactly as `wrangler deploy` would upload it — built, never uploaded. */
export function buildBundle(): void {
  const r = spawnSync(process.execPath, [WRANGLER, 'deploy', '--dry-run', '--outdir', BUNDLE_DIR], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`wrangler deploy --dry-run failed:\n${r.stdout}\n${r.stderr}`);
}

const toRequest = (c: Call) => new Request(ORIGIN + c.path, { method: c.method, headers: c.headers, body: c.body ?? null });

/** Node's lazy parts that workerd has built in: fetch classes, streams, Web Crypto, coders. */
async function warmPlatform(): Promise<void> {
  const enc = new TextEncoder();
  for (let i = 0; i < 3; i++) {
    const r = new Request(`${ORIGIN}/w?a=1`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'a=b' }, body: '{"a":1}' });
    const reader = r.body!.getReader();
    while (!(await reader.read()).done);
    new URL(r.url).searchParams.get('a');
    const h = new Headers({ a: 'b' });
    h.set('c', 'd');
    h.get('cookie');
    await new Response('{"x":1}', { status: 200, headers: h }).arrayBuffer();
    await crypto.subtle.digest('SHA-256', enc.encode('x'));
    const key = await crypto.subtle.importKey('raw', enc.encode('k'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    await crypto.subtle.sign('HMAC', key, enc.encode('m'));
    crypto.getRandomValues(new Uint8Array(32));
    crypto.randomUUID();
    btoa('x');
    new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(new Uint8Array([123, 125]));
  }
}

const usage = () => {
  const u = process.cpuUsage();
  return u.user + u.system;
};
const threadUsage = () => {
  const u = process.threadCpuUsage();
  return u.user + u.system;
};

interface Worker {
  fetch(request: Request, env: unknown, ctx: unknown): Promise<Response>;
  scheduled(controller: unknown, env: unknown, ctx: unknown): Promise<void>;
}

const CTX = { waitUntil() {}, passThroughOnException() {} };

async function measureOne(worker: Worker, env: unknown, db: NodeD1, step: Call | 'scheduled' | Request): Promise<{ m: Measure; setCookie: string | null; text: string }> {
  const request = step === 'scheduled' ? null : step instanceof Request ? step : toRequest(step);
  db.accounting = { sqlMicros: 0, queries: 0 };
  const a0 = usage();
  const t0 = threadUsage();
  const w0 = performance.now();
  let status = 0;
  let setCookie: string | null = null;
  let text = '';
  if (request) {
    const res = await worker.fetch(request, env, CTX);
    const buf = await res.arrayBuffer();
    status = res.status;
    setCookie = res.headers.get('Set-Cookie');
    text = status >= 400 ? new TextDecoder().decode(buf) : '';
  } else {
    await worker.scheduled({ scheduledTime: Date.now(), cron: '17 * * * *', noRetry() {} }, env, CTX);
  }
  const wall = (performance.now() - w0) * 1000;
  const all = usage() - a0;
  const thread = threadUsage() - t0;
  const sql = db.accounting.sqlMicros;
  return { m: { wall: wall - sql, all: all - sql, thread: thread - sql, sql, queries: db.accounting.queries, status }, setCookie, text };
}

async function profiled<T>(f: () => Promise<T>): Promise<{ value: T; summary: ProfileSummary }> {
  const session = new Session();
  session.connect();
  await session.post('Profiler.enable');
  await session.post('Profiler.setSamplingInterval', { interval: 50 });
  await session.post('Profiler.start');
  const value = await f();
  const { profile } = (await session.post('Profiler.stop')) as { profile: CpuProfile };
  session.disconnect();
  return { value, summary: summarize(profile, 'index.js') };
}

interface ChildArgs {
  what: string;
  mode: 'cold' | 'warm' | 'profile' | 'chain' | 'record';
  emulate: boolean;
  warmups: number;
  n: number;
  index: number;
}

/** One child process: a fresh Node, the bundle, the world, then the measured calls. */
async function child(a: ChildArgs): Promise<unknown> {
  const worker = ((await import(pathToFileURL(BUNDLE).href)) as { default: Worker }).default;
  const scenario = SCENARIOS.find((s) => s.name === a.what);
  const chain = CHAINS.find((c) => c.name === a.what);
  const big = a.mode === 'warm' ? a.warmups + a.n : 1;
  const world = buildWorld({ pepper: PEPPER, n: Math.max(a.warmups + a.n, a.index + 1, 1), deletes: scenario?.deletes ? big : 0, crons: scenario?.crons ? big : 0 });
  const db = new NodeD1(a.emulate);
  db.seed(world.sql);
  const env = { DB: db, AUTH_PEPPER: PEPPER, ASSETS: { fetch: async () => new Response(null, { status: 404 }) } };
  await warmPlatform();

  // record: the calls as sent and the answers of every D1 round trip, for replay-worker.js.
  const recorded: { name: string; status: number; call: Call | 'scheduled'; answers: string[][] }[] = [];
  const measureStep = async (name: string, call: Call | 'scheduled') => {
    if (a.mode !== 'record') return measureOne(worker, env, db, call);
    db.recording = [];
    const out = await measureOne(worker, env, db, call);
    recorded.push({ name, status: out.m.status, call, answers: db.recording });
    db.recording = null;
    return out;
  };

  if (chain) {
    const out: Measure[] = [];
    let cookie: string | null = null;
    for (const step of chain.steps(world.fx, a.index)) {
      const { m, setCookie, text } = await measureStep(step.name, step.make(cookie));
      cookie = cookieFrom(setCookie) ?? cookie;
      if (m.status !== step.status) throw new Error(`${chain.name}/${step.name}: status ${m.status} ${text}`);
      out.push({ ...m, name: step.name });
    }
    return a.mode === 'record' ? { steps: recorded } : { calls: out };
  }
  if (!scenario) throw new Error(`no scenario ${a.what}`);
  const prepare = (i: number) => {
    const step = scenario.make(world.fx, i);
    return step === 'scheduled' ? step : toRequest(step);
  };
  /** Wall time of the bench's own SQL between calls (taken out of the loop's CPU total). */
  let seedMicros = 0;
  const run = async (i: number, step: Request | 'scheduled') => {
    const s0 = performance.now();
    if (scenario.before) db.seed(scenario.before);
    // Cron: one marked account at a time — the i-th; the others wait unmarked.
    if (scenario.crons) db.seed([`UPDATE users SET deleting_at = CASE WHEN id = '${world.fx.crons[i]}' THEN 1 ELSE NULL END WHERE id IN (${world.fx.crons.map((c) => `'${c}'`).join(',')})`]);
    seedMicros += (performance.now() - s0) * 1000;
    const { m, text } = await measureOne(worker, env, db, step);
    if (m.status !== scenario.status) throw new Error(`${scenario.name}: status ${m.status} ${text}`);
    return m;
  };
  if (a.mode === 'record') {
    if (scenario.crons) db.seed([`UPDATE users SET deleting_at = 1 WHERE id = '${world.fx.crons[0]}'`]);
    const call = scenario.make(world.fx, 0);
    const { m, text } = await measureStep(scenario.name, call);
    if (m.status !== scenario.status) throw new Error(`${scenario.name}: status ${m.status} ${text}`);
    return { steps: recorded };
  }
  if (a.mode === 'profile') {
    const step = prepare(0);
    const { value, summary } = await profiled(() => run(0, step));
    return { calls: [value], profile: { ...summary, top: summary.top.slice(0, 12) } };
  }
  if (a.mode === 'cold') return { calls: [await run(0, prepare(0))] };
  for (let i = 0; i < a.warmups; i++) await run(i, prepare(i));
  const steps = Array.from({ length: a.n }, (_, k) => prepare(a.warmups + k));
  const calls: Measure[] = [];
  seedMicros = 0;
  const a0 = usage();
  for (let k = 0; k < a.n; k++) calls.push(await run(a.warmups + k, steps[k]!));
  const total = usage() - a0 - seedMicros - calls.reduce((s, c) => s + c.sql, 0);
  return { calls, amortized: total / a.n };
}

function runChild(a: ChildArgs): { calls: Measure[]; profile?: ProfileSummary; amortized?: number } {
  const args = ['--disable-warning=ExperimentalWarning', import.meta.filename, '--child', a.what, '--mode', a.mode, '--warmups', String(a.warmups), '--n', String(a.n), '--index', String(a.index)];
  if (a.emulate) args.push('--emulate');
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`child ${a.what} ${a.mode}: ${r.stderr}`);
  return JSON.parse(r.stdout.trim().split('\n').at(-1)!) as { calls: Measure[]; profile?: ProfileSummary; amortized?: number };
}

const ms = (micros: number) => Math.round(micros / 10) / 100;
export function stats(values: number[]): { median: number; max: number; min: number; p90: number } {
  const s = [...values].sort((x, y) => x - y);
  const at = (q: number) => s[Math.min(s.length - 1, Math.round(q * (s.length - 1)))]!;
  return { median: ms(at(0.5)), max: ms(s[s.length - 1]!), min: ms(s[0]!), p90: ms(at(0.9)) };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const opt = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  if (argv.includes('--child')) {
    const result = await child({
      what: opt('child')!,
      mode: opt('mode') as ChildArgs['mode'],
      emulate: argv.includes('--emulate'),
      warmups: Number(opt('warmups') ?? 0),
      n: Number(opt('n') ?? 1),
      index: Number(opt('index') ?? 0),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (!argv.includes('--no-build')) buildBundle();
  const only = opt('only')?.split(',');
  if (argv.includes('--record')) {
    // Calls and D1 answers of every scenario and chain, for workerd-cpu.ts (replay).
    mkdirSync(REPLAY, { recursive: true });
    for (const what of [...SCENARIOS.map((x) => x.name), ...CHAINS.map((c) => c.name)]) {
      if (only && !only.includes(what)) continue;
      const r = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', import.meta.filename, '--child', what, '--mode', 'record'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
      if (r.status !== 0) throw new Error(`record ${what}: ${r.stderr}`);
      writeFileSync(`${REPLAY}${what}.json`, r.stdout.trim().split('\n').at(-1)!);
      console.log(`recorded ${what}`);
    }
    return;
  }
  const colds = Number(opt('cold') ?? 10);
  mkdirSync(OUT, { recursive: true });
  // With --only, the results of other scenarios already in the file stay.
  const results: Record<string, unknown> = only && existsSync(`${OUT}node-results.json`) ? (JSON.parse(readFileSync(`${OUT}node-results.json`, 'utf8')) as Record<string, unknown>) : {};
  const save = () => writeFileSync(`${OUT}node-results.json`, JSON.stringify(results, null, 2));

  for (const s of SCENARIOS as Scenario[]) {
    if (only && !only.includes(s.name)) continue;
    const big = Boolean(s.deletes || s.crons);
    const row: Record<string, unknown> = {};
    for (const emulate of [false, true]) {
      const cold = Array.from({ length: big ? 3 : colds }, () => runChild({ what: s.name, mode: 'cold', emulate, warmups: 0, n: 1, index: 0 }).calls[0]!);
      // Large pushes: SQLite in memory slows as the journal grows (minutes per run at 200).
      const heavy = s.name === 'push-50' || s.name === 'push-100';
      const warmRun = runChild({ what: s.name, mode: 'warm', emulate, warmups: big ? 2 : heavy ? 10 : 20, n: big ? 5 : heavy ? 30 : 200, index: 0 });
      const warm = warmRun.calls;
      row[emulate ? 'emulate' : 'plain'] = {
        cold: { wall: stats(cold.map((c) => c.wall)), allCoarse: stats(cold.map((c) => c.all)), sql: stats(cold.map((c) => c.sql)), queries: cold[0]!.queries },
        warm: { wall: stats(warm.map((c) => c.wall)), cpuAmortized: ms(warmRun.amortized ?? 0), sql: stats(warm.map((c) => c.sql)), queries: warm[0]!.queries },
      };
    }
    const profiles = Array.from({ length: 3 }, () => runChild({ what: s.name, mode: 'profile', emulate: false, warmups: 0, n: 1, index: 0 }).profile!);
    row.profile = profiles;
    results[s.name] = row;
    const p = row.plain as { cold: { wall: { median: number; max: number } }; warm: { wall: { median: number; max: number }; cpuAmortized: number } };
    const e = row.emulate as typeof p;
    console.log(
      `${s.name.padEnd(16)} cold ${p.cold.wall.median} (max ${p.cold.wall.max}) | warm ${p.warm.wall.median} (max ${p.warm.wall.max}, cpu/N ${p.warm.cpuAmortized}) | +D1 json: cold ${e.cold.wall.median}, warm ${e.warm.wall.median} ms`,
    );
    save();
  }
  for (const c of CHAINS) {
    if (only && !only.includes(c.name)) continue;
    const runs = [false, true].map((emulate) => Array.from({ length: 5 }, (_, i) => runChild({ what: c.name, mode: 'chain', emulate, warmups: 0, n: 1, index: i }).calls));
    results[`chain-${c.name}`] = { plain: runs[0], emulate: runs[1] };
    const peak = (calls: Measure[]) => Math.max(...calls.map((x) => x.wall));
    console.log(`chain ${c.name}: peak per request ${runs.map((r) => `${stats(r.map(peak)).min}-${stats(r.map(peak)).max}`).join(' | +D1 json ')} ms (observed ${c.observed})`);
    save();
  }
}

await main();
