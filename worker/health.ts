import { json } from './http.ts';

/**
 * GET /api/health: is the Worker up and does the database answer. No versions, ids or server
 * time. One primary-key read of the row migration 0001 wrote — so 200 also means the
 * migration is applied. No binding, no table, database down — 503.
 */
export async function health(env: Env): Promise<Response> {
  try {
    const row = await env.DB.prepare("SELECT 1 AS one FROM server_meta WHERE key = 'schema'").first();
    if (row) return json({ ok: true, db: true });
  } catch {
    // the answer is the same whatever failed
  }
  return json({ ok: false, db: false }, 503);
}
