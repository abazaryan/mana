import { useEffect, useState } from 'react';
import { captureInviteToken } from './inviteToken';
import { MainApp } from './MainApp';

export type Route =
  | { name: 'decks' }
  | { name: 'deck'; deckId: string }
  /** `addAnyway`: one portion with new entries in spite of debts (R29.5). */
  | { name: 'study'; deckId: string; addAnyway?: boolean }
  | { name: 'settings' }
  /** An opened invitation; its token is kept in memory, not in the address (inviteToken.ts). */
  | { name: 'join' }
  | { name: 'signin' }
  /** The data notice ("Data and privacy"). */
  | { name: 'privacy' }
  /** Hidden: numbers and hashes of the cards for the checks of a transfer (R40); no link leads here. */
  | { name: 'labCards' };

/**
 * Hash routes: #/, #/deck/<id>, #/study/<id> (#/study/<id>/new: "add anyway"), #/settings, #/join (#/join/<token> is
 * an invitation link: the token is taken out at once), #/signin, #/privacy, #/lab/cards (hidden).
 */
export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'settings') return { name: 'settings' };
  if (parts[0] === 'join') return { name: 'join' };
  if (parts[0] === 'signin') return { name: 'signin' };
  if (parts[0] === 'privacy') return { name: 'privacy' };
  if (parts[0] === 'lab' && parts[1] === 'cards') return { name: 'labCards' };
  if (parts[0] === 'deck' && parts[1]) return { name: 'deck', deckId: decodeURIComponent(parts[1]) };
  if (parts[0] === 'study' && parts[1]) {
    const deckId = decodeURIComponent(parts[1]);
    return parts[2] === 'new' ? { name: 'study', deckId, addAnyway: true } : { name: 'study', deckId };
  }
  return { name: 'decks' };
}

export function deckHref(deckId: string): string {
  return `#/deck/${encodeURIComponent(deckId)}`;
}

export function studyHref(deckId: string, addAnyway = false): string {
  return `#/study/${encodeURIComponent(deckId)}${addAnyway ? '/new' : ''}`;
}

function currentRoute(): Route {
  captureInviteToken();
  return parseRoute(location.hash);
}

function useRoute(): Route {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const on = () => setRoute(currentRoute());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function Root() {
  const route = useRoute();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);
  return <MainApp route={route} />;
}
