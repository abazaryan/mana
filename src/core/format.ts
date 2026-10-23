/** 1234 → 1.2 seconds, with a decimal comma and the Russian unit. */
export function fmtSec(ms: number): string {
  return (ms / 1000).toFixed(1).replace('.', ',') + ' с';
}

/** Russian plural: the form for 1, for 2–4 and for 5 or more (one, few, many). */
export function pluralRu(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
