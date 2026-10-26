/**
 * Traces of an erased account (R42 item 2): every text column of the schema that could hold the
 * account's id or one of its devices' ids, searched in one read-only query. A test checks the
 * list against the schema, so a new text column cannot be missed. Pure: the admin scripts and
 * the tests use it.
 */

/** [table, column] of every TEXT column (d1_migrations and Cloudflare's own tables aside). */
export const TEXT_COLUMNS: readonly (readonly [string, string])[] = [
  ['server_meta', 'key'],
  ['server_meta', 'value'],
  ['users', 'id'],
  ['users', 'label'],
  ['invites', 'token_hash'],
  ['invites', 'kind'],
  ['invites', 'user_id'],
  ['invites', 'label'],
  ['invites', 'used_device_id'],
  ['invites', 'redeem_id'],
  ['devices', 'id'],
  ['devices', 'user_id'],
  ['devices', 'name'],
  ['sessions', 'token_hash'],
  ['sessions', 'user_id'],
  ['sessions', 'device_id'],
  ['pairing_codes', 'code_hash'],
  ['pairing_codes', 'user_id'],
  ['pairing_codes', 'created_by_device'],
  ['pairing_codes', 'used_device_id'],
  ['auth_attempts', 'bucket'],
  ['consents', 'id'],
  ['consents', 'user_id'],
  ['consents', 'given_by'],
  ['consents', 'parent_name'],
  ['consents', 'device_id'],
  ['admin_actions', 'id'],
  ['admin_actions', 'action'],
  ['admin_actions', 'user_id'],
  ['admin_actions', 'detail'],
  ['journal', 'user_id'],
  ['journal', 'id'],
  ['journal', 'type'],
  ['journal', 'device_id'],
  ['journal', 'deck_id'],
  ['journal', 'entry_id'],
  ['journal', 'body'],
  ['journal', 'body_hash'],
  ['user_settings', 'user_id'],
  ['user_settings', 'key'],
  ['user_settings', 'value'],
  ['user_settings', 'device_id'],
  ['user_aliases', 'user_id'],
  ['user_aliases', 'alias_id'],
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One read-only query: the places (table.column) where any of `ids` still occurs, with counts;
 * no rows — no traces. `ids` must be UUIDs (they go into the SQL as literals); instr, not LIKE
 * (D1 caps LIKE patterns at 50 bytes).
 */
export function traceSql(ids: readonly string[]): string {
  if (ids.length === 0 || !ids.every((id) => UUID.test(id))) throw new Error('traceSql: UUIDs only');
  const parts = TEXT_COLUMNS.map(([table, column]) => {
    const any = ids.map((id) => `instr(lower(${column}), '${id.toLowerCase()}') > 0`).join(' OR ');
    return `SELECT '${table}.${column}' AS place, count(*) AS n FROM ${table} WHERE ${any}`;
  });
  return `SELECT place, n FROM (${parts.join(' UNION ALL ')}) WHERE n > 0`;
}
