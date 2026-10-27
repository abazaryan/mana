/**
 * CPU of the Worker's routes in workerd (step "CPU of sign-in routes"): the Worker's own bundle
 * (the file wrangler would upload) served locally by the workerd binary that wrangler ships
 * (workerd serve replay.capnp — nothing goes to Cloudflare), with the D1 answers recorded in Node
 * (node-cpu.ts --record) given back by replay-worker.js: the D1 binding's JSON work is included,
 * SQLite and a local D1 service are not.
 *
 * Why not wrangler dev (measured while building this bench): its local D1 runs on the Worker's
 * thread and takes many times the Worker's own CPU (invite ≈ 4 ms, me ≈ 9–23 ms, push of 100
 * records ≈ 90–130 ms per request), and even an empty request costs ≈ 7–8 ms on that thread plus
 * ≈ 6 ms in a second workerd process (its proxy and entry layers). Served directly, an empty
 * request costs ≈ 2 ms.
 *
 * The CPU of a request: CPU cycles of the thread that runs the Worker over the request (Windows
 * QueryThreadCycleTime, cycles.ps1; the thread is found at start by a heavy request of the Worker;
 * the CPU times of Windows advance in steps of about 15.6 ms, and the V8 profiler of workerd on
 * Windows marks no idle time and samples irregularly — neither gives one request's CPU), minus the
 * median of empty requests (/__null) of the same instance — workerd's own work per request.
 *
 * "First" — the first request of the route after workerd starts (the Worker's code not yet run;
 * empty requests and the loading of answers ran before it), 10 starts; "warm" — 40 requests
 * after 20. Chains F, M, S, A — 10 fresh starts each: every request and their maximum (the
 * server's Metrics show the CPU of an invocation, not a sum).
 *
 *   node tools/bench/node-cpu.ts --record      (first: calls and D1 answers)
 *   node tools/bench/workerd-cpu.ts [--only a,b,big,chains]
 *   node tools/bench/workerd-cpu.ts --probe   (single operations of the push, probe-worker.js)
 * Before: port 8787 free. After: workerd stopped, the port free.
 * Results: tools/bench/.out/workerd-results.json.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { createInterface } from 'node:readline';
import type { Call } from './fixtures.ts';
import { OUT, REPLAY, ROOT } from './paths.ts';
import { CHAINS, SCENARIOS } from './scenarios.ts';

const WORKERD = `${ROOT}node_modules/@cloudflare/workerd-windows-64/bin/workerd.exe`;
const CONFIG = `${ROOT}tools/bench/replay.capnp`;
const PROBE_CONFIG = `${ROOT}tools/bench/probe.capnp`;
const PORT = 8787;
const BASE = `http://127.0.0.1:${PORT}`;
const RESULTS = `${OUT}workerd-results.json`;

interface Step {
  name: string;
  status: number;
  call: Call | 'scheduled';
  answers: string[][];
}

const recorded = (what: string): Step[] => (JSON.parse(readFileSync(`${REPLAY}${what}.json`, 'utf8')) as { steps: Step[] }).steps;

async function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The cycles helper (PowerShell, one process for the whole run). */
class Cycles {
  proc: ChildProcess;
  lines: string[] = [];
  wake: (() => void) | null = null;
  perMicro = 0;

  constructor() {
    this.proc = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', `${ROOT}tools/bench/cycles.ps1`], { stdio: ['pipe', 'pipe', 'inherit'] });
    createInterface({ input: this.proc.stdout! }).on('line', (l) => {
      this.lines.push(l);
      this.wake?.();
    });
  }

  async ask(command: string): Promise<unknown> {
    this.proc.stdin!.write(`${command}\n`);
    while (this.lines.length === 0) await new Promise<void>((r) => (this.wake = r));
    return JSON.parse(this.lines.shift()!);
  }

  async calibrate(): Promise<void> {
    this.perMicro = ((await this.ask('calibrate')) as { cyclesPerMicro: number }).cyclesPerMicro;
  }

  /** Microseconds of CPU of these threads so far. */
  async micros(tids: string[]): Promise<number> {
    const out = (await this.ask(`tids ${tids.join(' ')}`)) as Record<string, number>;
    return Object.values(out).reduce((s, c) => s + c, 0) / this.perMicro;
  }

  /** Cycles of every thread of these processes, keyed "<tid>". */
  async threads(pids: number[]): Promise<Record<string, number>> {
    const all: Record<string, number> = {};
    for (const pid of pids) Object.assign(all, (await this.ask(`threads ${pid}`)) as Record<string, number>);
    return all;
  }

  close(): void {
    this.proc.stdin!.write('quit\n');
  }
}

interface Dev {
  proc: ChildProcess;
  pids: number[];
  /** The thread that runs the Worker (found by a heavy request of its own code). */
  tids: string[];
  /** CPU of an empty request in this instance, microseconds (median). */
  baseline: number;
}

const EMPTY: Call = { method: 'GET', path: '/__null', headers: {} };

async function send(c: Call | 'scheduled'): Promise<{ status: number; text: string }> {
  const res = c === 'scheduled' ? await fetch(`${BASE}/__cron`) : await fetch(BASE + c.path, { method: c.method, headers: c.headers, body: c.body ?? null });
  return { status: c === 'scheduled' && res.status === 200 ? 0 : res.status, text: await res.text() };
}

const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;

/** A heavy request of the Worker's own code, to find its thread. */
const heavyReplay = () => load(Array.from({ length: 64 }, () => ['x'.repeat(32 * 1024)]));

async function start(cycles: Cycles, config = CONFIG, heavy = heavyReplay): Promise<Dev> {
  if (!(await portFree(PORT))) throw new Error(`port ${PORT} is busy`);
  const proc = spawn(WORKERD, ['serve', config], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  proc.stdout!.on('data', (d) => (log += d));
  proc.stderr!.on('data', (d) => (log += d));
  try {
    for (let i = 0; ; i++) {
      if (i > 240) throw new Error(`workerd did not start:\n${log.slice(-2000)}`);
      try {
        if ((await fetch(`${BASE}/__null`)).status === 200) break;
      } catch {
        // not yet
      }
      await sleep(250);
    }
    const pids = [proc.pid!];
    // The Worker's thread: the one that works hardest while the Worker parses a large body.
    const t0 = await cycles.threads(pids);
    await heavy();
    const t1 = await cycles.threads(pids);
    const busiest = Object.keys(t1).sort((a, b) => t1[b]! - (t0[b] ?? 0) - (t1[a]! - (t0[a] ?? 0)))[0]!;
    const dev: Dev = { proc, pids, tids: [busiest], baseline: 0 };
    for (let i = 0; i < 10; i++) await send(EMPTY);
    const empty: number[] = [];
    for (let i = 0; i < 9; i++) empty.push(await cpuOf(dev, cycles, EMPTY, false));
    dev.baseline = median(empty);
    return dev;
  } catch (e) {
    if (proc.pid) spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { encoding: 'utf8' });
    throw e;
  }
}

/** workerd stopped, then the port checked. */
async function stop(dev: Dev): Promise<void> {
  if (dev.proc.pid) spawnSync('taskkill', ['/PID', String(dev.proc.pid), '/T', '/F'], { encoding: 'utf8' });
  for (let i = 0; i < 40 && !(await portFree(PORT)); i++) await sleep(250);
}

/** CPU of one request in microseconds (minus the instance's empty request, unless `subtract` is false). */
async function cpuOf(dev: Dev, cycles: Cycles, c: Call | 'scheduled', subtract = true, expect?: number): Promise<number> {
  const before = await cycles.micros(dev.tids);
  const { status, text } = await send(c);
  // Work after the answer (wrangler dev's own) settles; the empty request had the same pause.
  await sleep(20);
  const after = await cycles.micros(dev.tids);
  if (expect !== undefined && status !== expect) throw new Error(`status ${status}, expected ${expect}: ${text.slice(0, 200)}`);
  return after - before - (subtract ? dev.baseline : 0);
}

async function load(answers: string[][]): Promise<void> {
  const res = await fetch(`${BASE}/__load`, { method: 'POST', body: JSON.stringify(answers) });
  if (res.status !== 200) throw new Error(`load: ${res.status}`);
  await res.text();
}

const ms = (micros: number) => Math.round(micros / 10) / 100;
function stats(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const at = (q: number) => s[Math.min(s.length - 1, Math.round(q * (s.length - 1)))]!;
  return { median: ms(at(0.5)), min: ms(s[0]!), max: ms(s[s.length - 1]!) };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1]!.split(',') : null;
  const resultsFile = argv.includes('--probe') ? `${OUT}workerd-probe.json` : RESULTS;
  const results: Record<string, unknown> = {};
  const save = () => writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  const cycles = new Cycles();
  await cycles.calibrate();
  results.cyclesPerMicro = cycles.perMicro;
  console.log(`cycles per microsecond: ${cycles.perMicro.toFixed(0)}`);
  try {
    if (argv.includes('--probe')) {
      // Single operations of the push (probe-worker.js): warm, median of 15 after 5.
      const dev = await start(cycles, PROBE_CONFIG, async () => {
        await (await fetch(`${BASE}/parse?n=50`)).text();
      });
      try {
        for (const path of ['/digest-seq?n=100', '/digest-par?n=100', '/digest-seq?n=8', '/await-only?n=100', '/hex-only?n=100', '/parse?n=1']) {
          const call: Call = { method: 'GET', path, headers: {} };
          for (let i = 0; i < 5; i++) await send(call);
          const v: number[] = [];
          for (let i = 0; i < 15; i++) v.push(await cpuOf(dev, cycles, call, true, 200));
          results[`probe ${path}`] = stats(v);
          console.log(`probe ${path.padEnd(20)} ${JSON.stringify(stats(v))} ms`);
        }
        save();
      } finally {
        await stop(dev);
      }
      return;
    }
    for (const s of SCENARIOS) {
      const big = Boolean(s.deletes || s.crons);
      if (only && !only.includes(s.name) && !(big && only.includes('big'))) continue;
      const step = recorded(s.name)[0]!;
      const firsts: number[] = [];
      const baselines: number[] = [];
      let warm: number[] = [];
      for (let instance = 0; instance < (big ? 3 : 10); instance++) {
        const dev = await start(cycles);
        try {
          baselines.push(dev.baseline);
          const copies = instance === 0 ? (big ? 3 : 61) : 1;
          await load(Array.from({ length: copies }, () => step.answers).flat());
          firsts.push(await cpuOf(dev, cycles, step.call, true, step.status));
          if (instance === 0) {
            if (big) {
              for (let i = 0; i < 2; i++) warm.push(await cpuOf(dev, cycles, step.call, true, step.status));
            } else {
              for (let i = 0; i < 20; i++) await send(step.call);
              for (let i = 0; i < 40; i++) warm.push(await cpuOf(dev, cycles, step.call, true, step.status));
            }
          }
        } finally {
          await stop(dev);
        }
      }
      warm = warm.length ? warm : firsts;
      results[s.name] = { first: stats(firsts), warm: stats(warm), baseline: stats(baselines), firstRuns: firsts.map(ms), warmRuns: warm.map(ms) };
      const f = stats(firsts);
      const w = stats(warm);
      console.log(`${s.name.padEnd(16)} first ${f.median} (${f.min}-${f.max}) | warm ${w.median} (${w.min}-${w.max}) ms | empty request ${stats(baselines).median} ms`);
      save();
    }
    for (const c of CHAINS) {
      if (only && !only.includes('chains') && !only.includes(c.name)) continue;
      const steps = recorded(c.name);
      const runs: number[][] = [];
      for (let r = 0; r < 10; r++) {
        const dev = await start(cycles);
        try {
          await load(steps.flatMap((s) => s.answers));
          const out: number[] = [];
          for (const s of steps) out.push(await cpuOf(dev, cycles, s.call, true, s.status));
          runs.push(out);
        } finally {
          await stop(dev);
        }
      }
      const peaks = runs.map((r) => Math.max(...r));
      results[`chain-${c.name}`] = { observed: c.observed, steps: steps.map((s) => s.name), runs: runs.map((r) => r.map(ms)), peak: stats(peaks), sum: stats(runs.map((r) => r.reduce((a, b) => a + b, 0))) };
      console.log(`chain ${c.name}: peak ${stats(peaks).min}-${stats(peaks).max} ms, observed ${c.observed} | ${steps.map((s, i) => `${s.name} ${stats(runs.map((r) => r[i]!)).median}`).join(', ')}`);
      save();
    }
  } finally {
    cycles.close();
  }
}

try {
  await main();
} finally {
  const free = await portFree(PORT);
  let answer = 'no answer';
  try {
    answer = String((await fetch(`${BASE}/__null`)).status);
  } catch {
    // expected: nothing listens
  }
  console.log(`after: port ${PORT} free: ${free}; ${BASE} answers: ${answer}`);
}
