/**
 * Only test accounts until the notice on the site names everything the server keeps (rules of
 * 6a; R40): since stage 6a.4 that includes the earlier installation numbers (user_aliases), which
 * notice version 2 does not name. Notice version 3 (stage 6a.5) lifts the rule — and only it.
 * Pure: the admin scripts and a test use it.
 */
import { NOTICE_VERSION } from '../../src/core/notice.ts';

/** Test accounts: labels start with this. */
export const TEST_PREFIX = 'test-';

/** The first notice version that names the earlier installation numbers (R40). */
export const NOTICE_NAMING_ALIASES = 3;

/** Accounts without the test- label may be invited or recovered. */
export function realAccountsAllowed(noticeVersion: number = NOTICE_VERSION): boolean {
  return noticeVersion >= NOTICE_NAMING_ALIASES;
}

/** An invitation or a recovery link for an account with this label may be made. */
export function labelAllowed(label: string, noticeVersion: number = NOTICE_VERSION): boolean {
  return label.startsWith(TEST_PREFIX) || realAccountsAllowed(noticeVersion);
}

export const TEST_ONLY_MESSAGE = `Only test accounts (label "${TEST_PREFIX}…") until the notice on the site names the earlier installation numbers (notice version ${NOTICE_NAMING_ALIASES}, stage 6a.5).`;
