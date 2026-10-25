/**
 * The report of the hidden page #/lab/cards (stage 6a.4, R40): numbers and hashes only, never the
 * content of a record — to compare the cards of one device before and after a transfer, and the
 * phone with the laptop (acceptance criterion: the next review dates are the same, STAGE6_RESEARCH
 * 5.9 item 6). In English and the same on every interface language, so two reports compare
 * byte for byte (owner's decision 25.10.2026): a technical page, no interface strings.
 */

export interface CardDue {
  deckId: string;
  entryId: string;
  skill: string;
  due: Date;
}

export interface CardsReportInput {
  build: number;
  userId: string;
  formerUserIds: number;
  records: number;
  cards: readonly CardDue[];
  outbox: { pending: number; rejected: number; conflict: number };
  lastSynced: Date | null;
}

/** "deckId|entryId|skill|due" per card, sorted: the text the hash is taken of. */
export function cardLines(cards: readonly CardDue[]): string[] {
  return cards.map((c) => `${c.deckId}|${c.entryId}|${c.skill}|${c.due.toISOString()}`).sort();
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 (hex) of the cards' lines joined by "\n"; the same cards in any order give the same hash. */
export function cardsHash(cards: readonly CardDue[]): Promise<string> {
  return sha256Hex(cardLines(cards).join('\n'));
}

export const LAB_TITLE = 'Cards check';
export const LAB_COPY = 'Copy the report';

export async function cardsReport(input: CardsReportInput): Promise<string> {
  const decks = [...new Set(input.cards.map((c) => c.deckId))].sort();
  const lines = [
    `build: ${input.build}`,
    `user: ${input.userId.slice(0, 8)}   former: ${input.formerUserIds}`,
    `log: ${input.records}   cards: ${input.cards.length}`,
    `cards.sha256: ${await cardsHash(input.cards)}`,
  ];
  for (const deck of decks) {
    const own = input.cards.filter((c) => c.deckId === deck);
    lines.push(`deck ${deck}: cards ${own.length} sha256 ${await cardsHash(own)}`);
  }
  lines.push(`outbox: pending ${input.outbox.pending} rejected ${input.outbox.rejected} conflict ${input.outbox.conflict}`);
  lines.push(`synced: ${input.lastSynced ? input.lastSynced.toISOString() : 'never'}`);
  return lines.join('\n');
}
