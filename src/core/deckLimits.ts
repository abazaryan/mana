/**
 * The daily limit of new entries of each deck (R47): no shared ceiling, 5 by default, chosen on
 * the deck screen. Kept in the settings by deck id, so a new revision, a deletion or a reinstall
 * of the deck keeps it.
 */
import { DEFAULT_NEW_PER_DAY, type SettingsRow } from './model';

/** The choices on the deck screen (R47 item 10); a value from the server outside them is shown too. */
export const NEW_PER_DAY_CHOICES = [5, 10, 15, 20] as const;

/** New entries a day in `deckId`. */
export function deckNewLimit(settings: Pick<SettingsRow, 'newPerDeck'>, deckId: string): number {
  return settings.newPerDeck?.[deckId] ?? DEFAULT_NEW_PER_DAY;
}

/** The settings with the limit of one deck set. */
export function withDeckLimit(settings: SettingsRow, deckId: string, n: number, now: Date): SettingsRow {
  return { ...settings, newPerDeck: { ...settings.newPerDeck, [deckId]: n }, updatedAt: now };
}

/**
 * Once on each device (R47 item 10): the shared `newPerDay` goes to every installed deck that has
 * no value of its own yet. Null when it was done before. A deck installed later gets the default.
 */
export function spreadNewPerDay(settings: SettingsRow, installed: readonly string[], now: Date): SettingsRow | null {
  if (settings.newPerDeckFrom) return null;
  const newPerDeck = { ...settings.newPerDeck };
  for (const id of installed) newPerDeck[id] ??= settings.newPerDay;
  return { ...settings, newPerDeck, newPerDeckFrom: now, updatedAt: now };
}
