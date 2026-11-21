const SHELF = ':is(ytd-rich-section-renderer, ytm-rich-section-renderer, ytd-rich-shelf-renderer, ytm-rich-shelf-renderer, ytd-shelf-renderer, ytm-shelf-renderer, grid-shelf-view-model)';
export const SHELF_TITLE = `${SHELF} :is(h2, [role="heading"], #title, #shelf-title, .ytShelfHeaderLayoutTitle, .yt-shelf-header-layout__title, #title-container yt-formatted-string, #rich-shelf-header .yt-core-attributed-string, yt-shelf-header-layout-view-model .ytCoreAttributedStringHost)`;
export const GUIDE_LINK = ':is(ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer) a';
export const GUIDE_GROUP = 'ytd-guide-section-renderer, ytd-guide-collapsible-section-entry-renderer';
export const MEMBERSHIP = 'data-facelift-membership-title';
export const SHORTS = 'data-facelift-guide-shorts';
export const DETAIL = 'data-facelift-subscription-detail';

const label = (el: Element) => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim().toLowerCase().replace(/\s+/g, ' ');
const subscriptionLink = (a: HTMLAnchorElement) => a.origin === location.origin && /^\/feed\/subscriptions\/?$/.test(a.pathname);
const channelLink = (a: HTMLAnchorElement) => a.origin === location.origin && /^\/(?:@|channel\/|c\/|user\/)/.test(a.pathname);

export function markShelfTitle(el: Element) {
  const inCard = el.closest('ytd-rich-item-renderer, ytm-rich-item-renderer, yt-lockup-view-model, ytd-video-renderer, ytd-grid-video-renderer, ytm-video-with-context-renderer');
  el.toggleAttribute(MEMBERSHIP, !inCard && label(el) === 'get more from memberships');
}

export function markShortsLink(el: Element) {
  // The guide sometimes uses a command instead of a /shorts URL.
  if (!(el instanceof HTMLAnchorElement)) return;
  const href = el.getAttribute('href');
  const shortsRoute = el.origin === location.origin && /^\/(?:feed\/)?shorts(?:\/|$)/.test(el.pathname);
  const command = !href || href === '#' || href === '/' || el.protocol === 'javascript:';
  el.toggleAttribute(SHORTS, shortsRoute || (command && label(el) === 'shorts'));
}

export function markSubscriptions(group: Element) {
  const own = <T extends Element>(selector: string) =>
    Array.from(group.querySelectorAll<T>(selector)).filter(el => el.closest(GUIDE_GROUP) === group);
  const links = own<HTMLAnchorElement>('a[href]');
  const feed = links.find(subscriptionLink);
  const header = own('#guide-section-title, #header, #header-entry, #header-container, h3, [role="heading"]')
    .find(el => label(el) === 'subscriptions' || (feed && el.contains(feed)));
  // A Subscriptions link often also appears next to Home/History. Never compact that group.
  const dedicated = header || group.getAttribute('target-id') === 'guide-subscriptions-section'
    || (feed && links.some(channelLink) && links.every(a => subscriptionLink(a) || channelLink(a) || a.getAttribute('href') === '#'));

  const hide = new Set<Element>();
  if (dedicated) {
    const keep = feed?.closest('ytd-guide-entry-renderer') ?? feed ?? header;
    if (keep && group.contains(keep)) {
      // Keep the original header/link, including its focus target and click handler.
      // Mark sibling branches, not child channel names or a global "Show more" label.
      for (let node: Element = keep; node !== group && node.parentElement; node = node.parentElement) {
        for (const sibling of node.parentElement.children) if (sibling !== node) hide.add(sibling);
      }
    }
  }
  for (const old of group.querySelectorAll(`[${DETAIL}]`)) {
    if (old.parentElement?.closest(GUIDE_GROUP) === group && !hide.has(old)) old.removeAttribute(DETAIL);
  }
  for (const el of hide) el.toggleAttribute(DETAIL, true);
}
