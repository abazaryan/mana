/**
 * A V8 CPU profile (Profiler.stop of the inspector — Node or workerd) taken apart: CPU time of
 * the samples that are not idle, self time per function, and shares by where the code lives
 * (the Worker's bundle, workerd's internal modules such as the D1 binding, built-ins, GC).
 */

interface CallFrame {
  functionName: string;
  url: string;
  lineNumber: number;
}

interface ProfileNode {
  id: number;
  callFrame: CallFrame;
}

export interface CpuProfile {
  nodes: ProfileNode[];
  startTime: number;
  endTime: number;
  samples?: number[];
  timeDeltas?: number[];
}

export interface ProfileSummary {
  /** Microseconds of samples that are not "(idle)" (by their time deltas). */
  busy: number;
  /** Samples that are not "(idle)": × the sampling interval — CPU where waits leave no samples. */
  count: number;
  /** The same, of the Worker's bundle and of internal modules (D1 binding…). */
  countByPlace: Record<string, number>;
  /** Of `busy`: garbage collector and "(program)" (the engine outside JavaScript). */
  gc: number;
  program: number;
  /** Self time by place: bundle (the Worker's code), internal (workerd modules), builtin, other. */
  byPlace: Record<string, number>;
  /** Functions by self time, most first. */
  top: { name: string; micros: number }[];
}

function place(frame: CallFrame, bundleHint: string): string {
  if (frame.functionName === '(garbage collector)') return 'gc';
  if (frame.functionName === '(program)') return 'program';
  if (frame.url.includes(bundleHint)) return 'bundle';
  if (frame.url.startsWith('cloudflare') || frame.url.startsWith('node-internal') || frame.url.startsWith('workerd') || frame.url.startsWith('node:')) return 'internal';
  if (frame.url === '') return 'builtin';
  return 'other';
}

function label(frame: CallFrame): string {
  const file = frame.url.slice(frame.url.lastIndexOf('/') + 1) || '(native)';
  return `${frame.functionName || '(anonymous)'} ${file}:${frame.lineNumber + 1}`;
}

/** `bundleHint` — a part of the URL of the Worker's own script (e.g. "index.js" or the bundle path). */
export function summarize(profile: CpuProfile, bundleHint: string): ProfileSummary {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map<string, number>();
  const byPlace: Record<string, number> = {};
  const countByPlace: Record<string, number> = {};
  let count = 0;
  let busy = 0;
  let gc = 0;
  let program = 0;
  const samples = profile.samples ?? [];
  const deltas = profile.timeDeltas ?? [];
  for (let i = 0; i < samples.length; i++) {
    // A delta is the time before its sample; the time of a sample is the next delta (the last — to endTime).
    const next = i + 1 < deltas.length ? deltas[i + 1]! : Math.max(0, profile.endTime - (profile.startTime + deltas.slice(0, i + 1).reduce((s, d) => s + d, 0)));
    const node = byId.get(samples[i]!);
    if (!node || node.callFrame.functionName === '(idle)') continue;
    busy += next;
    count++;
    const where = place(node.callFrame, bundleHint);
    countByPlace[where] = (countByPlace[where] ?? 0) + 1;
    if (where === 'gc') gc += next;
    if (where === 'program') program += next;
    byPlace[where] = (byPlace[where] ?? 0) + next;
    const key = label(node.callFrame);
    self.set(key, (self.get(key) ?? 0) + next);
  }
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).map(([name, micros]) => ({ name, micros }));
  return { busy, count, countByPlace, gc, program, byPlace, top };
}

/** Self times of several profiles added up (the top of a route over its runs). */
export function mergeTops(summaries: readonly ProfileSummary[]): { name: string; micros: number }[] {
  const sum = new Map<string, number>();
  for (const s of summaries) for (const t of s.top) sum.set(t.name, (sum.get(t.name) ?? 0) + t.micros);
  return [...sum.entries()].sort((a, b) => b[1] - a[1]).map(([name, micros]) => ({ name, micros: micros / summaries.length }));
}
