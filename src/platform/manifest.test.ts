import { describe, expect, it } from 'vitest';
import html from '../../index.html?raw';
import manifestText from '../../public/manifest.webmanifest?raw';
import apple from '../../public/icons/apple-touch-icon.png?inline';
import icon192 from '../../public/icons/icon-192.png?inline';
import icon512 from '../../public/icons/icon-512.png?inline';
import maskable512 from '../../public/icons/maskable-512.png?inline';

const PNG: Record<string, string> = { 'icons/icon-192.png': icon192, 'icons/icon-512.png': icon512, 'icons/maskable-512.png': maskable512 };
const manifest = JSON.parse(manifestText) as {
  id: string;
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  icons: { src: string; sizes: string; type: string; purpose: string }[];
};

/** Width and height from the PNG header (IHDR) of an inlined data: URL. */
function pngSize(dataUrl: string | undefined): string {
  const bin = atob((dataUrl ?? '').split(',')[1] ?? '');
  const v = new DataView(Uint8Array.from(bin, (c) => c.charCodeAt(0)).buffer);
  return `${v.getUint32(16)}x${v.getUint32(20)}`;
}

describe('web app manifest (Р32: installing on the home screen)', () => {
  it('the id never changes: Chrome tells installed apps apart by it', () => {
    expect(manifest.id).toBe('./');
  });

  it('name, start at the root, standalone window', () => {
    expect(manifest).toMatchObject({ name: 'Mana', short_name: 'Mana', start_url: './', scope: './', display: 'standalone' });
  });

  it('PNG icons 192 and 512 and a maskable 512 exist with their sizes', () => {
    const png = manifest.icons.filter((i) => i.type === 'image/png');
    expect(png.map((i) => `${i.sizes} ${i.purpose}`).sort()).toEqual(['192x192 any', '512x512 any', '512x512 maskable']);
    for (const i of png) expect(pngSize(PNG[i.src])).toBe(i.sizes);
    expect(pngSize(apple)).toBe('180x180');
  });

  it('index.html links the manifest and the icons by root paths (Vite makes them relative)', () => {
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest">');
    expect(html).toContain('<link rel="icon" href="/icon.svg" type="image/svg+xml">');
    expect(html).toContain('<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">');
  });
});
