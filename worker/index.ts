/**
 * The Worker `mana` (R33 item 2): the site's static files and the API on one address.
 * Files are served before this code runs; it runs first only for /api/* (run_worker_first in
 * wrangler.jsonc) and for paths with no file. Those go back to the static files, which answer
 * with the plain 404 (not_found_handling "none"); the X-Mana-Worker mark shows the way they
 * took (R36) — there are no logs.
 */
import { handleApi } from './api.ts';
import { cleanup } from './cleanup.ts';

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/api' || pathname.startsWith('/api/')) return handleApi(request, env);
    const asset = await env.ASSETS.fetch(request);
    const response = new Response(asset.body, asset);
    response.headers.set('X-Mana-Worker', 'assets');
    return response;
  },
  /** The hourly Cron Trigger (wrangler.jsonc): cleanup of sign-in rows (cleanup.ts). */
  async scheduled(controller, env): Promise<void> {
    await cleanup(env.DB, controller.scheduledTime);
  },
} satisfies ExportedHandler<Env>;
