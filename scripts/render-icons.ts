/**
 * Renders the PNG icons of the web app manifest from their SVG sources (R32):
 * public/icon.svg (rounded, purpose "any") → icons/icon-192.png, icons/icon-512.png;
 * public/icons/maskable.svg (full square) → icons/maskable-512.png, icons/apple-touch-icon.png.
 * Run after changing an SVG: npm run icons. Uses headless Microsoft Edge (or Chrome via the
 * BROWSER variable) to rasterize, so no image library is needed. Node 24+ (runs .ts directly).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const BROWSER = process.env.BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const pub = (p: string) => fileURLToPath(new URL(`../public/${p}`, import.meta.url));

const TARGETS = [
  { svg: 'icon.svg', size: 192, out: 'icons/icon-192.png' },
  { svg: 'icon.svg', size: 512, out: 'icons/icon-512.png' },
  { svg: 'icons/maskable.svg', size: 512, out: 'icons/maskable-512.png' },
  { svg: 'icons/maskable.svg', size: 180, out: 'icons/apple-touch-icon.png' },
];

/** Width and height from the PNG header (IHDR). */
export function pngSize(png: Uint8Array): { width: number; height: number } {
  const v = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { width: v.getUint32(16), height: v.getUint32(20) };
}

const work = mkdtempSync(join(tmpdir(), 'mana-icons-'));
try {
  for (const t of TARGETS) {
    const html = join(work, 'icon.html');
    const svg = pathToFileURL(pub(t.svg)).href;
    writeFileSync(
      html,
      `<!doctype html><html><body style="margin:0;background:transparent"><img src="${svg}" width="${t.size}" height="${t.size}" style="display:block"></body></html>`,
    );
    const out = pub(t.out);
    execFileSync(BROWSER, [
      '--headless=new',
      '--disable-extensions',
      '--no-first-run',
      `--user-data-dir=${join(work, 'profile')}`,
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--default-background-color=00000000',
      `--window-size=${t.size},${t.size}`,
      `--screenshot=${out}`,
      pathToFileURL(html).href,
    ], { stdio: 'ignore' });
    const { width, height } = pngSize(readFileSync(out));
    if (width !== t.size || height !== t.size) throw new Error(`${t.out}: ${width}×${height}, expected ${t.size}×${t.size}`);
    console.log(`${t.out}: ${width}×${height}`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
