/**
 * Checks that tools/.env gives access to Cloudflare Workers AI and that the models of the
 * experiment exist. Prints statuses only, never the values from .env.
 *   node tools/lab/check-cloudflare.ts
 */
process.loadEnvFile(new URL('../.env', import.meta.url));

const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!account || !token) {
  console.error('В tools/.env не заданы CLOUDFLARE_ACCOUNT_ID и/или CLOUDFLARE_API_TOKEN.');
  process.exit(1);
}

const api = `https://api.cloudflare.com/client/v4/accounts/${account}`;
const headers = { Authorization: `Bearer ${token}` };

interface Envelope<T> {
  success: boolean;
  errors?: { code: number; message: string }[];
  result?: T;
}

async function call<T>(path: string): Promise<{ status: number; body: Envelope<T> | null }> {
  try {
    const res = await fetch(`${api}${path}`, { headers });
    return { status: res.status, body: (await res.json().catch(() => null)) as Envelope<T> | null };
  } catch (e) {
    console.error(`Сеть: ${e instanceof Error ? e.name : 'ошибка'}`);
    process.exit(1);
  }
}

// Account-owned tokens verify under /accounts, personal ones under /user.
let verify = await call<{ status: string; expires_on?: string }>('/tokens/verify');
if (verify.status !== 200) {
  try {
    const res = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', { headers });
    verify = { status: res.status, body: (await res.json().catch(() => null)) as typeof verify.body };
  } catch {
    /* keep the first answer */
  }
}
console.log(`Токен: HTTP ${verify.status}, статус «${verify.body?.result?.status ?? 'не удалось проверить'}»`);
console.log(`Срок действия: ${verify.body?.result ? (verify.body.result.expires_on ?? 'НЕ ЗАДАН (бессрочный)') : 'неизвестен'}`);
if (verify.body && !verify.body.success) console.log('Ошибки:', verify.body.errors?.map((e) => e.message).join('; '));

for (const search of ['whisper-large-v3-turbo', 'nova-3']) {
  const r = await call<{ name: string; task?: { name?: string } }[]>(`/ai/models/search?search=${search}`);
  const names = r.body?.result?.map((m) => `${m.name}${m.task?.name ? ` (${m.task.name})` : ''}`) ?? [];
  console.log(`Модели «${search}»: HTTP ${r.status}; ${names.length ? names.join(', ') : 'не найдено'}`);
  if (r.body && !r.body.success) console.log('Ошибки:', r.body.errors?.map((e) => e.message).join('; '));
}

// Smoke run: one second of silence through Whisper (the right to run models, not only to list them).
const wav = new Uint8Array(44 + 32000);
const dv = new DataView(wav.buffer);
[...'RIFF'].forEach((c, i) => dv.setUint8(i, c.charCodeAt(0)));
dv.setUint32(4, 36 + 32000, true);
[...'WAVEfmt '].forEach((c, i) => dv.setUint8(8 + i, c.charCodeAt(0)));
dv.setUint32(16, 16, true);
dv.setUint16(20, 1, true);
dv.setUint16(22, 1, true);
dv.setUint32(24, 16000, true);
dv.setUint32(28, 32000, true);
dv.setUint16(32, 2, true);
dv.setUint16(34, 16, true);
[...'data'].forEach((c, i) => dv.setUint8(36 + i, c.charCodeAt(0)));
dv.setUint32(40, 32000, true);
const t0 = performance.now();
try {
  const res = await fetch(`${api}/ai/run/@cf/openai/whisper-large-v3-turbo`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio: Buffer.from(wav).toString('base64'), language: 'fr' }),
  });
  const body = (await res.json().catch(() => null)) as Envelope<{ text?: string }> | null;
  console.log(`Запуск Whisper на секунде тишины: HTTP ${res.status}, ${Math.round(performance.now() - t0)} мс, ответ: «${body?.result?.text?.trim() ?? ''}»`);
  if (body && !body.success) console.log('Ошибки:', body.errors?.map((e) => e.message).join('; '));
} catch (e) {
  console.error(`Сеть: ${e instanceof Error ? e.name : 'ошибка'}`);
}
