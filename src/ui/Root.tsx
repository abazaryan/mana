import { useEffect, useState } from 'react';
import { MainApp } from './MainApp';
import { PrototypeApp } from './PrototypeApp';
import { RecordLab } from './RecordLab';
import { KeyboardLab } from './keyboardLab/KeyboardLab';

export type Route =
  | { name: 'decks' }
  | { name: 'deck'; deckId: string }
  /** `addAnyway`: one portion with new entries in spite of debts (Р29.5). */
  | { name: 'study'; deckId: string; addAnyway?: boolean }
  | { name: 'settings' }
  | { name: 'prototype' }
  | { name: 'lab' }
  | { name: 'keyboardLab' };

/**
 * Hash routes: #/, #/deck/<id>, #/study/<id> (#/study/<id>/new: "add anyway"), #/settings, #/prototype, and the hidden
 * #/lab/record (recognizer experiment) and #/lab/keyboard (keyboard experiment, stage 5), both in no menu.
 * Hashes work under any GitHub Pages path.
 */
export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'lab' && parts[1] === 'record') return { name: 'lab' };
  if (parts[0] === 'lab' && parts[1] === 'keyboard') return { name: 'keyboardLab' };
  if (parts[0] === 'prototype') return { name: 'prototype' };
  if (parts[0] === 'settings') return { name: 'settings' };
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

function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseRoute(location.hash));
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
  if (route.name === 'lab') return <RecordLab />;
  if (route.name === 'keyboardLab') return <KeyboardLab />;
  return route.name === 'prototype' ? <PrototypeApp /> : <MainApp route={route} />;
}
