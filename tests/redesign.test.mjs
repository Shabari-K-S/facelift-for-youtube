import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { unzipSync } from 'fflate';
import { JSDOM } from 'jsdom';

const manifest = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
const archive = unzipSync(readFileSync(`artifacts/facelift-for-youtube-${manifest.version}.xpi`));
const text = name => new TextDecoder().decode(archive[name]);

function storage() {
  const values = {};
  const listeners = new Set();
  const local = {
    get: async () => ({ ...values }),
    async set(patch) {
      const changes = {};
      for (const [key, value] of Object.entries(patch)) {
        changes[key] = { oldValue: values[key], newValue: value };
        values[key] = value;
      }
      for (const listener of listeners) listener(changes, 'local');
    },
  };
  return {
    listeners, local,
    onChanged: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) },
  };
}

function open(t, html, store, popup = false, host = 'www.youtube.com') {
  const { window } = new JSDOM(html, {
    url: popup ? 'https://popup.invalid/' : `https://${host}/`,
    runScripts: 'outside-only', pretendToBeVisual: true,
  });
  t.after(() => window.close());
  window.browser = { storage: store };
  if (!popup) {
    const style = window.document.createElement('style');
    style.textContent = text('content/styles.css');
    window.document.head.append(style);
  }
  window.eval(text(popup ? 'popup/popup.js' : 'content/index.js'));
  return window;
}
const settle = w => new Promise(resolve => w.requestAnimationFrame(() => w.requestAnimationFrame(resolve)));
const display = (w, selector) => w.getComputedStyle(w.document.querySelector(selector)).display;
function visible(w, selector) {
  const item = w.document.querySelector(selector);
  assert.ok(item, selector);
  for (let node = item; node; node = node.parentElement) {
    if (w.getComputedStyle(node).display === 'none') return false;
  }
  return true;
}

test('Home drops the full membership promotion, not individual videos or other feeds', async t => {
  const store = storage();
  const page = open(t, `<ytd-rich-section-renderer id="normal"><ytd-rich-item-renderer>
    <h2 id="title">Get more from memberships</h2></ytd-rich-item-renderer></ytd-rich-section-renderer>`, store);
  await settle(page);
  page.document.body.insertAdjacentHTML('beforeend', `<ytd-rich-section-renderer id="promo"><ytd-rich-shelf-renderer>
    <div id="rich-shelf-header"><yt-formatted-string id="title">Get more from memberships</yt-formatted-string>
    <button>Explore now</button></div><ytd-rich-item-renderer></ytd-rich-item-renderer><button>Show more</button>
    </ytd-rich-shelf-renderer></ytd-rich-section-renderer>`);
  await settle(page);
  assert.equal(visible(page, '#normal'), true);
  assert.equal(display(page, '#promo'), 'none');
  await store.local.set({ 'hide-memberships': false });
  assert.equal(visible(page, '#promo button'), true);
  await store.local.set({ 'hide-memberships': true });
  page.history.pushState({}, '', '/feed/subscriptions');
  page.document.dispatchEvent(new page.Event('yt-navigate-finish'));
  await settle(page);
  assert.equal(visible(page, '#promo button'), true);
  page.history.pushState({}, '', '/');
  page.document.dispatchEvent(new page.Event('yt-navigate-finish'));
  await settle(page);
  assert.equal(visible(page, '#promo button'), false);
  page.document.querySelector('#promo #title').firstChild.data = 'Recommended';
  await settle(page);
  assert.equal(visible(page, '#promo button'), true);
});

test('the guide keeps the native Subscriptions link and removes only its channel list and Shorts entry', async t => {
  const store = storage();
  const page = open(t, `<ytd-guide-section-renderer><ytd-guide-entry-renderer><a id="home" href="/">Home</a></ytd-guide-entry-renderer>
    <ytd-guide-entry-renderer id="short"><a title="Shorts">Shorts</a></ytd-guide-entry-renderer></ytd-guide-section-renderer>
    <ytd-mini-guide-entry-renderer id="mini"><a href="#" aria-label="Shorts"></a></ytd-mini-guide-entry-renderer>
    <ytd-guide-section-renderer><ytd-guide-collapsible-section-entry-renderer>
      <ytd-guide-entry-renderer id="header-entry"><a id="subs" href="/feed/subscriptions">Subscriptions</a></ytd-guide-entry-renderer>
      <div id="items"><ytd-guide-entry-renderer><a id="channel" href="/@example">A channel</a></ytd-guide-entry-renderer></div>
      <ytd-guide-collapsible-entry-renderer><button id="more">Show more</button></ytd-guide-collapsible-entry-renderer>
    </ytd-guide-collapsible-section-entry-renderer></ytd-guide-section-renderer>
    <ytd-guide-section-renderer><h3>You</h3><ytd-guide-entry-renderer><a id="own" href="/@creator" title="Shorts">Shorts</a></ytd-guide-entry-renderer>
    <button id="youMore">Show more</button></ytd-guide-section-renderer>`, store);
  await settle(page);
  for (const id of ['channel', 'more', 'short', 'mini']) assert.equal(visible(page, `#${id}`), false, id);
  for (const id of ['home', 'subs', 'own', 'youMore']) assert.equal(visible(page, `#${id}`), true, id);
  assert.equal(page.document.querySelector('#subs').pathname, '/feed/subscriptions');
  await store.local.set({ 'compact-subscriptions': false });
  assert.equal(visible(page, '#more'), true);
  assert.equal(visible(page, '#channel'), true);
  assert.equal(visible(page, '#short'), false);
  await store.local.set({ 'hide-shorts': false });
  assert.equal(visible(page, '#short'), true);
  assert.equal(visible(page, '#mini'), true);
});

test('packaged page filters reflow the feed; popup changes are independent and reversible', async t => {
  const store = storage();
  const page = open(t, `<ytd-browse><ytd-rich-grid-renderer><div id="contents">
    <ytd-rich-section-renderer id="short"><ytd-rich-shelf-renderer is-shorts></ytd-rich-shelf-renderer></ytd-rich-section-renderer>
    <ytd-rich-section-renderer id="games"><a href="/playables/123">Puzzle</a></ytd-rich-section-renderer>
    <ytd-rich-item-renderer id="video"><a id="thumbnail" href="/watch?v=123">Playables review</a></ytd-rich-item-renderer>
    <ytd-continuation-item-renderer></ytd-continuation-item-renderer>
    </div></ytd-rich-grid-renderer></ytd-browse>
    <ytd-guide-entry-renderer id="gaming"><a href="/gaming">Gaming</a></ytd-guide-entry-renderer>`, store);
  const popup = open(t, text('popup/index.html'), store, true);
  await settle(page);
  assert.equal(display(page, '#contents'), 'grid');
  assert.equal(display(page, '#short'), 'none');
  assert.equal(display(page, '#games'), 'none');
  for (const retained of ['#video', '#gaming', 'ytd-continuation-item-renderer']) assert.notEqual(display(page, retained), 'none');
  popup.document.querySelector('#layout').click();
  popup.document.querySelector('#hide-playables').click();
  await settle(page);
  assert.notEqual(display(page, '#contents'), 'grid');
  assert.notEqual(display(page, '#games'), 'none');
  assert.equal(display(page, '#short'), 'none');
});

test('new action bars and recycled menu items follow SPA navigation; unrelated controls survive', async t => {
  const store = storage();
  const page = open(t, '<button id="outside">Join</button><div id="voice-search-button"></div>', store);
  await settle(page);
  page.history.pushState({}, '', '/watch?v=123');
  page.document.dispatchEvent(new page.Event('yt-navigate-finish'));
  page.document.body.insertAdjacentHTML('beforeend', `<div id="top-level-buttons-computed">
    <yt-button-view-model id="thanks"><button aria-label="Show support with Super Thanks"></button></yt-button-view-model>
    <button id="join">Join</button><button id="share">Share</button><button id="save">Save</button>
    <button id="follow">Subscribe</button><button id="more">More</button></div>
    <ytd-menu-popup-renderer><ytd-menu-service-item-renderer id="download">Download</ytd-menu-service-item-renderer></ytd-menu-popup-renderer>`);
  await settle(page);
  assert.equal(page.document.documentElement.dataset.faceliftPage, 'watch');
  for (const id of ['voice-search-button', 'thanks', 'join', 'download']) assert.equal(display(page, `#${id}`), 'none', id);
  for (const id of ['share', 'save', 'more', 'follow', 'outside']) assert.notEqual(display(page, `#${id}`), 'none', id);
  page.document.querySelector('#download').firstChild.data = 'Share';
  await store.local.set({ 'hide-join': false });
  await settle(page);
  assert.notEqual(display(page, '#download'), 'none');
  assert.notEqual(display(page, '#join'), 'none');
  assert.equal(display(page, '#thanks'), 'none');
  page.dispatchEvent(new page.Event('pagehide'));
  assert.equal(store.listeners.size, 0);
  assert.notEqual(display(page, '#thanks'), 'none');
  page.dispatchEvent(new page.PageTransitionEvent('pageshow', { persisted: true }));
  await settle(page);
  assert.equal(store.listeners.size, 1);
  assert.equal(display(page, '#thanks'), 'none');
  assert.notEqual(display(page, '#join'), 'none');
});

test('mobile dynamic shelves disappear without hiding a normal gaming result or the search box', async t => {
  const page = open(t, '<ytm-app><input id="search"><div class="mobile-topbar-header-voice-search-button"></div></ytm-app>', storage(), false, 'm.youtube.com');
  await settle(page);
  page.document.querySelector('ytm-app').insertAdjacentHTML('beforeend', `
    <ytm-rich-section-renderer id="short"><ytm-shorts-lockup-view-model></ytm-shorts-lockup-view-model></ytm-rich-section-renderer>
    <ytm-pivot-bar-item-renderer id="games"><a href="/playables">Playables</a></ytm-pivot-bar-item-renderer>
    <ytm-video-with-context-renderer><a class="media-item-thumbnail-container" href="/watch?v=game">Gaming</a></ytm-video-with-context-renderer>`);
  assert.equal(display(page, '#short'), 'none');
  assert.equal(display(page, '#games'), 'none');
  assert.equal(display(page, '.mobile-topbar-header-voice-search-button'), 'none');
  assert.notEqual(display(page, '#search'), 'none');
  assert.notEqual(display(page, 'ytm-video-with-context-renderer'), 'none');
});

test('popup reports storage failures instead of showing an unsaved preference', async t => {
  const store = storage();
  const popup = open(t, text('popup/index.html'), store, true);
  await settle(popup);
  store.local.set = async () => { throw new Error('write failed'); };
  const box = popup.document.querySelector('#hide-shorts');
  box.click();
  await settle(popup);
  assert.equal(box.checked, true);
  assert.match(popup.document.querySelector('#status').textContent, /not saved/i);
  store.local.get = async () => { throw new Error('read failed'); };
  const unavailable = open(t, text('popup/index.html'), store, true);
  await settle(unavailable);
  assert.equal(unavailable.document.querySelector('#controls').disabled, true);
  assert.equal(unavailable.document.querySelector('#retry').hidden, false);
});

test('XPI installs from its root manifest and references only packaged resources on the requested hosts', () => {
  const packaged = JSON.parse(text('manifest.json'));
  assert.deepEqual(packaged.permissions, ['storage']);
  assert.equal(packaged.host_permissions, undefined);
  const [script] = packaged.content_scripts;
  assert.deepEqual(script.matches, ['*://www.youtube.com/*', '*://m.youtube.com/*']);
  for (const file of [...script.js, ...script.css, packaged.action.default_popup, ...Object.values(packaged.icons)]) {
    assert.ok(archive[file]?.length, file);
  }
  assert.match(packaged.content_security_policy.extension_pages, /connect-src 'none'/);
  for (const name of Object.keys(archive).filter(n => n.endsWith('.js') || n.endsWith('.css'))) {
    assert.doesNotMatch(text(name), /\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(|https?:\/\//, name);
  }
});
