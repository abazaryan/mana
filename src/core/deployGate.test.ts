// Deliberately failing test: checks once that a failing `npm test` blocks the
// Cloudflare deploy (Р32). Reverted by the next commit.
import { expect, it } from 'vitest';

it('fails on purpose (deploy gate check)', () => {
  expect(1).toBe(2);
});
