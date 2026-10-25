/**
 * Every /api response carries these (STAGE6_RESEARCH 7.5): public/_headers does not apply to
 * Worker responses. No CORS headers at all.
 */
export const API_HEADERS: Readonly<Record<string, string>> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

/** Short error codes: the only thing an error response says (no stack, no details). */
export type ErrorCode =
  | 'already_signed_in'
  | 'bad_json'
  | 'bad_request'
  | 'consent_required'
  | 'device_taken'
  | 'forbidden'
  | 'internal'
  /** A wrong, expired or used invitation or code — one answer for all (STAGE6_RESEARCH 7.3). */
  | 'invalid'
  | 'method_not_allowed'
  | 'not_found'
  | 'payload_too_large'
  | 'too_many_requests'
  | 'unauthorized'
  | 'unsupported_media_type'
  | 'upgrade_required'
  /** A local userId that is another account's id or earlier id (R40). */
  | 'user_taken';

export function json(body: unknown, status = 200, extra?: Record<string, string>): Response {
  const headers = new Headers(API_HEADERS);
  for (const [name, value] of Object.entries(extra ?? {})) headers.set(name, value);
  return new Response(JSON.stringify(body), { status, headers });
}

export function error(code: ErrorCode, status: number, extra?: Record<string, string>): Response {
  return json({ error: code }, status, extra);
}
