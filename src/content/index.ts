import { keys, listen, type Settings } from '../types/settings.ts';
import { labelZones, observeLabels } from './labels.ts';

function surface(path: string) {
  if (path === '/watch' || path.startsWith('/live/')) return 'watch';
  if (path === '/results') return 'search';
  if (path === '/playlist') return 'playlist';
  if (/^\/(?:@|channel\/|c\/|user\/)/.test(path)) return 'channel';
  if (path === '/') return 'home';
  if (path.startsWith('/feed/')) return 'feed';
  return 'other';
}

function mount() {
  const life = new AbortController();
  const events = { capture: true, signal: life.signal };
  let settings: Readonly<Settings> | undefined;
  let labels: ReturnType<typeof observeLabels> | undefined;
  let selector = '';
  function paint() {
    const html = document.documentElement;
    if (!html || !settings) return;
    for (const key of keys) html.toggleAttribute(`data-facelift-${key}`, settings[key]);
    html.setAttribute('data-facelift-page', surface(location.pathname));
  }
  const stopStorage = listen(value => {
    settings = value;
    paint();
    const next = labelZones(value);
    if (selector !== next) {
      labels?.stop();
      selector = next;
      labels = next ? observeLabels(next) : undefined;
    }
  }, () => console.warn('Facelift: could not read local settings; leaving YouTube unchanged.'));
  function navigate() { paint(); labels?.refresh(); }
  document.addEventListener('DOMContentLoaded', navigate, { ...events, once: true });
  window.addEventListener('yt-navigate-finish', navigate, events);
  window.addEventListener('popstate', navigate, events);
  window.addEventListener('pagehide', () => {
    life.abort();
    stopStorage();
    labels?.stop();
    for (const key of keys) document.documentElement?.removeAttribute(`data-facelift-${key}`);
    document.documentElement?.removeAttribute('data-facelift-page');
  }, { once: true });
}

mount();
window.addEventListener('pageshow', event => { if (event.persisted) mount(); });
