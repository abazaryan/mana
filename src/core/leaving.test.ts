import { describe, expect, it } from 'vitest';
import { deleteOutcome, pendingOutcome } from './accountDelete';
import { keysToWipe, signOutAllowsWipe, WIPE_DATABASES, WIPE_PENDING_KEY } from './wipe';

describe('deleting the account: what an answer means (R42 items 1, 8)', () => {
  it('200 or 401 after the mark — deleted; 426 — update; anything else — failed', () => {
    expect(deleteOutcome({ ok: true })).toBe('deleted');
    expect(deleteOutcome({ ok: false, status: 401 })).toBe('deleted');
    expect(deleteOutcome({ ok: false, status: 426 })).toBe('update');
    for (const status of [0, 400, 403, 500, 503]) expect(deleteOutcome({ ok: false, status }), String(status)).toBe('failed');
  });

  it('at start with the mark: me 401 — deleted, 200 — not done, no network or an error — unknown', () => {
    expect(pendingOutcome({ ok: false, status: 401 })).toBe('deleted');
    expect(pendingOutcome({ ok: true })).toBe('notDone');
    for (const status of [0, 500, 426]) expect(pendingOutcome({ ok: false, status }), String(status)).toBe('unknown');
  });
});

describe('clearing the device: what goes (R42 item 7)', () => {
  it("the app's keys and the prototype's go, others stay; the pending mark last", () => {
    const keys = ['sluh.log', WIPE_PENDING_KEY, 'other.key', 'mana.labDbRemoved', 'mana.updateReloadAt', 'sluh.settings', 'manatee'];
    expect(keysToWipe(keys)).toEqual(['sluh.log', 'mana.labDbRemoved', 'mana.updateReloadAt', 'sluh.settings', WIPE_PENDING_KEY]);
    expect(WIPE_DATABASES).toEqual(['mana', 'mana-lab']);
  });

  it('the sign-out before it: 200 or 401 — go on; no network or a server error — refused', () => {
    expect(signOutAllowsWipe({ ok: true })).toBe(true);
    expect(signOutAllowsWipe({ ok: false, status: 401 })).toBe(true);
    for (const status of [0, 400, 500]) expect(signOutAllowsWipe({ ok: false, status }), String(status)).toBe(false);
  });
});
