/**
 * Rules of 6a and R40: invite.ts and recover.ts make links only for test accounts until the
 * notice on the site names the earlier installation numbers (notice version 3, stage 6a.5).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NOTICE_VERSION } from '../src/core/notice';
import { labelAllowed, NOTICE_NAMING_ALIASES, realAccountsAllowed } from '../tools/admin/testOnly';

describe('test accounts only (tools/admin/testOnly.ts)', () => {
  it('below notice version 3 a label without test- is refused, from 3 on it is allowed', () => {
    expect(NOTICE_NAMING_ALIASES).toBe(3);
    expect(labelAllowed('test-edge-1', 2)).toBe(true);
    expect(labelAllowed('Mama', 2)).toBe(false);
    expect(labelAllowed('Mama', 3)).toBe(true);
    expect(realAccountsAllowed(2)).toBe(false);
  });

  it('the current notice still allows only test accounts (until 6a.5 lifts it with version 3)', () => {
    expect(realAccountsAllowed()).toBe(NOTICE_VERSION >= 3);
    if (NOTICE_VERSION < 3) expect(labelAllowed('Mama')).toBe(false);
  });

  it('invite.ts and recover.ts (through testAccountLabel) both apply the rule', () => {
    const invite = readFileSync(new URL('../tools/admin/invite.ts', import.meta.url), 'utf8');
    const recover = readFileSync(new URL('../tools/admin/recover.ts', import.meta.url), 'utf8');
    const d1 = readFileSync(new URL('../tools/admin/d1.ts', import.meta.url), 'utf8');
    expect(invite).toMatch(/if \(!labelAllowed\(label\)\) fail/);
    expect(recover).toMatch(/testAccountLabel\(target, userId\)/);
    expect(d1).toMatch(/if \(!labelAllowed\(user\.label\)\) fail/);
  });
});
