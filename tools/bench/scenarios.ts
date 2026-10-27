/**
 * What the bench measures, the same in Node and in workerd: one route per scenario (the i-th
 * call takes the i-th invitation, code or account, so every call does the full work), and the
 * four sign-ins seen on the real server (F, M, S, A — docs/STATUS.md, 6a.4 and 6a.5c) as chains
 * of requests in the order the app sends them (me and the first push go out together in the
 * app; here one after the other, so each request's CPU stays its own).
 */
import { randomInt } from 'node:crypto';
import { CODE_ALPHABET } from '../../src/core/pairingCode.ts';
import * as F from './fixtures.ts';
import type { Call, Fixtures } from './fixtures.ts';

export type Step = Call | 'scheduled';

export interface Scenario {
  name: string;
  /** The i-th call. */
  make(fx: Fixtures, i: number): Step;
  /** Status expected of every call. */
  status: number;
  /** Large accounts the world needs (route erasure, Cron). */
  deletes?: number;
  crons?: number;
  /** Before each call, outside the measurement (Node): SQL to run. */
  before?: string[];
  /** Before the i-th call, outside the measurement: requests (the first sign-in of a retry). */
  setup?(fx: Fixtures, i: number): Call[];
}

const wrongCode = () => Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(32)]).join('');

/** One device per row of a pool, the same for the first sign-in and its retry (the retry window). */
const sameDevice = new Map<string, { id: string; name: string }>();
const deviceFor = (key: string) => {
  const d = sameDevice.get(key) ?? { id: crypto.randomUUID(), name: 'Windows · Edge' };
  sameDevice.set(key, d);
  return d;
};
const redeemSame = (fx: Fixtures, i: number) => F.redeem(fx.accountInvites[i]!, { consent: F.consentBody.self, device: deviceFor(fx.accountInvites[i]!) });
const pairSame = (fx: Fixtures, i: number) => F.pair(fx.codes[i]!, { device: deviceFor(fx.codes[i]!) });

export const SCENARIOS: Scenario[] = [
  { name: 'invite', status: 200, make: (fx, i) => F.invite(fx.accountInvites[i]!) },
  { name: 'redeem-account', status: 200, make: (fx, i) => F.redeem(fx.accountInvites[i]!, { consent: F.consentBody.self }) },
  { name: 'redeem-minor', status: 200, make: (fx, i) => F.redeem(fx.minorInvites[i]!, { consent: F.consentBody.parent }) },
  { name: 'redeem-local', status: 200, make: (fx, i) => F.redeem(fx.localInvites[i]!.token, { consent: F.consentBody.self, localUserId: fx.localInvites[i]!.localUserId }) },
  // The retry window: the same device again after its answer was lost (the first sign-in is not measured).
  { name: 'redeem-retry', status: 200, setup: (fx, i) => [redeemSame(fx, i)], make: redeemSame },
  { name: 'redeem-device', status: 200, make: (fx, i) => F.redeem(fx.deviceInvites[i]!) },
  { name: 'redeem-former', status: 200, make: (fx, i) => F.redeem(fx.formerInvites[i]!.token, { formerUserId: fx.formerInvites[i]!.former }) },
  { name: 'pair', status: 200, make: (fx, i) => F.pair(fx.codes[i]!) },
  { name: 'pair-retry', status: 200, setup: (fx, i) => [pairSame(fx, i)], make: pairSame },
  { name: 'pair-former', status: 200, make: (fx, i) => F.pair(fx.formerCodes[i]!.code, { formerUserId: fx.formerCodes[i]!.former }) },
  {
    name: 'pair-wrong',
    status: 400,
    before: ['DELETE FROM auth_attempts'],
    make: (_fx, i) => {
      const c = F.pair(wrongCode());
      c.headers['CF-Connecting-IP'] = `10.0.${i >> 8}.${i & 255}`;
      return c;
    },
  },
  { name: 'me', status: 200, make: (fx) => F.me(fx.main.cookie) },
  { name: 'consent-self', status: 200, make: (fx, i) => F.consent(fx.consentSelf[i]!.cookie, false) },
  { name: 'consent-parent', status: 200, make: (fx, i) => F.consent(fx.consentParent[i]!.cookie, true) },
  { name: 'push-settings', status: 200, make: (fx) => F.push(fx.main.cookie, [], true) },
  ...[8, 25, 50, 100].map((n): Scenario => ({
    name: `push-${n}`,
    status: 200,
    make: (fx, i) => F.push(fx.main.cookie, F.freshRecords(i, n, fx.main.userId, fx.main.deviceId), false),
  })),
  { name: 'pull-0', status: 200, make: (fx) => F.pull(fx.pull.p0.cookie) },
  { name: 'pull-40', status: 200, make: (fx) => F.pull(fx.pull.p40.cookie) },
  { name: 'pull-200', status: 200, make: (fx) => F.pull(fx.pull.p200.cookie) },
  { name: 'pull-500', status: 200, make: (fx) => F.pull(fx.pull.p500.cookie) },
  { name: 'delete-30', status: 200, deletes: 1, make: (fx, i) => F.erase(fx.deletes[i]!.cookie) },
  { name: 'cron-40', status: 0, crons: 1, make: () => 'scheduled' },
];

export interface ChainStep {
  name: string;
  status: number;
  /** The request, given the session cookie the sign-in set (null before it). */
  make(cookie: string | null): Call;
}

export interface Chain {
  name: string;
  /** What was seen on the server for this sign-in: the CPU peak, ms. */
  observed: number;
  steps(fx: Fixtures, i: number): ChainStep[];
}

export const CHAINS: Chain[] = [
  {
    name: 'F',
    observed: 7.5,
    steps: (fx, i) => {
      const t = fx.accountInvites[i]!;
      return [
        { name: 'invite', status: 200, make: () => F.invite(t) },
        { name: 'redeem', status: 200, make: () => F.redeem(t, { consent: F.consentBody.self }) },
        { name: 'me', status: 200, make: (c) => F.me(c!) },
        { name: 'push-settings', status: 200, make: (c) => F.push(c!, [], true) },
        { name: 'pull', status: 200, make: (c) => F.pull(c!) },
      ];
    },
  },
  {
    name: 'M',
    observed: 10.2,
    steps: (fx, i) => {
      const t = fx.mInvites[i]!;
      return [
        { name: 'invite', status: 200, make: () => F.invite(t) },
        { name: 'redeem', status: 200, make: () => F.redeem(t) },
        { name: 'me', status: 200, make: (c) => F.me(c!) },
        { name: 'push-settings', status: 403, make: (c) => F.push(c!, [], true) },
      ];
    },
  },
  {
    name: 'S',
    observed: 13,
    steps: (fx, i) => {
      const t = fx.sInvites[i]!;
      return [
        { name: 'invite', status: 200, make: () => F.invite(t) },
        { name: 'redeem', status: 200, make: () => F.redeem(t) },
        { name: 'me', status: 200, make: (c) => F.me(c!) },
        { name: 'push-settings', status: 200, make: (c) => F.push(c!, [], true) },
        { name: 'pull-40', status: 200, make: (c) => F.pull(c!) },
      ];
    },
  },
  {
    name: 'A',
    observed: 19.5,
    steps: (fx, i) => {
      const { token: t, localUserId } = fx.localInvites[i]!;
      const records = F.freshRecords(7919 + i, 10, localUserId, crypto.randomUUID());
      return [
        { name: 'invite', status: 200, make: () => F.invite(t) },
        { name: 'redeem', status: 200, make: () => F.redeem(t, { consent: F.consentBody.self, localUserId }) },
        { name: 'me', status: 200, make: (c) => F.me(c!) },
        { name: 'pull', status: 200, make: (c) => F.pull(c!) },
        { name: 'push-10', status: 200, make: (c) => F.push(c!, records, true) },
      ];
    },
  },
];
