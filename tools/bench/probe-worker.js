/**
 * Single operations of the push in workerd, apart (workerd-cpu.ts --probe, probe.capnp): what a
 * SHA-256 per record costs when awaited one by one (as worker/sync.ts readRecords does), all at
 * once, or as hex text only; JSON.parse of a push body. ?n — how many; 1 KB strings like records.
 */
const enc = new TextEncoder();
const strings = Array.from({ length: 200 }, (_, i) => `${i}:`.padEnd(1024, 'abcdefghij'));
const body = JSON.stringify({ records: strings.slice(0, 100).map((s, i) => ({ id: String(i), text: s })) });

const hex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const n = Number(url.searchParams.get('n') ?? 100);
    let x = 0;
    switch (url.pathname) {
      case '/__null':
        break;
      case '/digest-seq':
        for (let i = 0; i < n; i++) x += hex(await crypto.subtle.digest('SHA-256', enc.encode(strings[i]))).length;
        break;
      case '/digest-par':
        x = (await Promise.all(strings.slice(0, n).map(async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)))))).length;
        break;
      case '/await-only':
        for (let i = 0; i < n; i++) x += await Promise.resolve(i);
        break;
      case '/hex-only': {
        const buf = new Uint8Array(32).buffer;
        for (let i = 0; i < n; i++) x += hex(buf).length;
        break;
      }
      case '/parse':
        for (let i = 0; i < n; i++) x += JSON.parse(body).records.length;
        break;
      default:
        return new Response('not found', { status: 404 });
    }
    return new Response(String(x));
  },
};
