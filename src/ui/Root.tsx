import { useEffect, useState } from 'react';
import { MainApp } from './MainApp';
import { PrototypeApp } from './PrototypeApp';

export type Route =
  | { name: 'decks' }
  | { name: 'deck'; deckId: string }
  | { name: 'study'; deckId: string }
  | { name: 'settings' }
  | { name: 'prototype' };

/** Hash routes: #/, #/deck/<id>, #/study/<id>, #/settings, #/prototype. Hashes work under any GitHub Pages path. */
export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'prototype') return { name: 'prototype' };
  if (parts[0] === 'settings') return { name: 'settings' };
  if (parts[0] === 'deck' && parts[1]) return { name: 'deck', deckId: decodeURIComponent(parts[1]) };
  if (parts[0] === 'study' && parts[1]) return { name: 'study', deckId: decodeURIComponent(parts[1]) };
  return { name: 'decks' };
}

export function deckHref(deckId: string): string {
  return `#/deck/${encodeURIComponent(deckId)}`;
}

export function studyHref(deckId: string): string {
  return `#/study/${encodeURIComponent(deckId)}`;
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
  return route.name === 'prototype' ? <PrototypeApp /> : <MainApp route={route} />;
}
