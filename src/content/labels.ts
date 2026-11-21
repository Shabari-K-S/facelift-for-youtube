import type { Settings } from '../types/settings.ts';
import { SHELF_TITLE, GUIDE_LINK, GUIDE_GROUP, MEMBERSHIP, SHORTS, DETAIL, markShelfTitle, markShortsLink, markSubscriptions } from './browse-labels.ts';

const ACTION_ZONE = [
  '#top-level-buttons-computed', '#actions-inner', 'yt-flexible-actions-view-model',
  'ytd-video-owner-renderer', 'ytm-slim-owner-renderer', 'ytm-slim-video-action-bar-renderer',
  'yt-page-header-renderer', 'yt-page-header-view-model', 'ytd-c4-tabbed-header-renderer',
  'ytd-menu-popup-renderer', 'ytm-menu-popup-renderer', 'ytm-menu', 'yt-sheet-view-model',
].join(',');
const ITEM = 'yt-button-view-model,button-view-model,ytd-button-renderer,ytd-menu-service-item-renderer,ytm-menu-service-item-renderer,yt-list-item-view-model';
const MARK = 'data-facelift-action';
const SKIP = '.html5-video-player,ytd-comments,yt-live-chat-renderer';

function identify(control: Element) {
  const label = (control.getAttribute('aria-label') || control.getAttribute('title') || control.textContent || '')
    .trim().toLowerCase().replace(/\s+/g, ' ');
  switch (label) {
    case 'thanks': case 'super thanks': case 'show support with super thanks': return 'thanks';
    case 'download': case 'download video': case 'download this video': return 'download';
    case 'join': case 'join this channel': case 'join this channel to get access to perks': return 'join';
    default: return undefined;
  }
}

function mark(zone: Element) {
  const found = new Map<Element, string>();
  for (const control of zone.querySelectorAll(`button,[role="button"],[role="menuitem"],${ITEM}`)) {
    const action = identify(control);
    if (!action) continue;
    const item = control.closest(ITEM);
    found.set(item && zone.contains(item) ? item : control, action);
  }
  for (const old of zone.querySelectorAll(`[${MARK}]`)) if (!found.has(old)) old.removeAttribute(MARK);
  for (const [item, action] of found) {
    if (item.getAttribute(MARK) !== action) item.setAttribute(MARK, action);
  }
}

export function labelZones(settings: Readonly<Settings>) {
  const selectors = [];
  if (settings['hide-thanks'] || settings['hide-download'] || settings['hide-join']) selectors.push(ACTION_ZONE);
  if (settings['hide-memberships']) selectors.push(SHELF_TITLE);
  if (settings['hide-shorts']) selectors.push(GUIDE_LINK);
  if (settings['compact-subscriptions']) selectors.push(GUIDE_GROUP);
  return selectors.join(',');
}

export function observeLabels(selector: string) {
  const additions = new Set<Element>();
  const zones = new Set<Element>();
  const observedZones = new WeakSet<Element>();
  let full = false;
  let frame: number | undefined;
  function flush() {
    frame = undefined;
    if (full) document.querySelectorAll(selector).forEach(zone => zones.add(zone));
    else for (const node of additions) {
      if (!node.isConnected) continue;
      if (node.matches(selector)) zones.add(node);
      for (const zone of node.querySelectorAll(selector)) zones.add(zone);
    }
    for (const zone of zones) {
      if (!zone.isConnected) continue;
      if (!observedZones.has(zone)) {
        observer.observe(zone, { subtree: true, childList: true, characterData: true, attributeFilter: ['aria-label', 'title', 'href', 'target-id'] });
        observedZones.add(zone);
      }
      if (zone.matches(GUIDE_GROUP)) markSubscriptions(zone);
      else if (zone.matches(GUIDE_LINK)) markShortsLink(zone);
      else if (zone.matches(SHELF_TITLE)) markShelfTitle(zone);
      else mark(zone);
    }
    additions.clear();
    zones.clear();
    full = false;
  }
  function queue() { frame ??= requestAnimationFrame(flush); }
  function refresh() { full = true; queue(); }
  const observer = new MutationObserver(records => {
    if (full) return;
    for (const record of records) {
      const parent = record.target instanceof Element ? record.target : record.target.parentElement;
      if (parent?.closest(SKIP)) continue;
      // Nested labels can affect both the link and its enclosing guide section.
      for (let zone = parent?.closest(selector); zone; zone = zone.parentElement?.closest(selector)) zones.add(zone);
      for (const node of record.addedNodes) {
        if (node instanceof Element && (node.childElementCount || node.matches(selector))) additions.add(node);
      }
      // Background tabs may defer rAF: never retain an unbounded queue of detached nodes.
      if (additions.size + zones.size > 48) { additions.clear(); zones.clear(); refresh(); return; }
    }
    if (additions.size || zones.size) queue();
  });
  observer.observe(document, { subtree: true, childList: true });
  refresh();
  return {
    refresh,
    stop() {
      observer.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
      additions.clear();
      zones.clear();
      for (const attr of [MARK, MEMBERSHIP, SHORTS, DETAIL]) {
        document.querySelectorAll(`[${attr}]`).forEach(item => item.removeAttribute(attr));
      }
    },
  };
}
