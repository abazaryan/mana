import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import html from '../pages-moved/index.html?raw';

/** The page of the old address (R32) carries one script: it deletes the IndexedDB database "mana-lab" once. */
function script(): string {
  const m = /<script>([\s\S]*?)<\/script>/.exec(html);
  expect(m, 'pages-moved/index.html has an inline script').not.toBeNull();
  return m![1]!;
}

function memoryFlag() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
}

function createDb(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => {
      req.result.close();
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

const names = async () => (await indexedDB.databases()).map((d) => d.name);
const settle = () => new Promise((r) => setTimeout(r, 50));

function run(flag: ReturnType<typeof memoryFlag>): void {
  new Function('window', 'indexedDB', 'localStorage', script())({ indexedDB }, indexedDB, flag);
}

describe('page of the old address: one-time removal of the experiment database', () => {
  it('deletes mana-lab, leaves mana alone and runs only once', async () => {
    await createDb('mana-lab');
    await createDb('mana');
    const flag = memoryFlag();

    run(flag);
    await settle();
    expect(await names()).not.toContain('mana-lab');
    expect(await names()).toContain('mana');
    expect(flag.data.size).toBe(1);

    await createDb('mana-lab');
    run(flag);
    await settle();
    expect(await names()).toContain('mana-lab');
  });

  it('names no other database', () => {
    expect(script().match(/deleteDatabase\(([^)]*)\)/g)).toEqual(["deleteDatabase('mana-lab')"]);
  });
});
