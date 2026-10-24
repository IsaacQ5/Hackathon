import { useSyncExternalStore } from 'react';

/** Minimal client-side router: three routes don't need a library. */
const EVENT = 'tm:navigate';

export function navigate(path: string, replace = false): void {
  if (replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('popstate', cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener('popstate', cb);
    window.removeEventListener(EVENT, cb);
  };
}

export function usePathname(): string {
  return useSyncExternalStore(subscribe, () => location.pathname);
}

/** URL phones should open for a room. */
export function joinUrlFor(code: string): string {
  const base = (import.meta.env.VITE_PUBLIC_URL || location.origin).replace(/\/+$/, '');
  return `${base}/play/${code}`;
}
