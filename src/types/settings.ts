export const defaults = {
  layout: true,
  'hide-shorts': true,
  'hide-playables': true,
  'hide-memberships': true,
  'compact-subscriptions': true,
  'hide-voice': true,
  'hide-thanks': true,
  'hide-download': true,
  'hide-join': true,
};
export type Settings = typeof defaults;
export type Key = keyof Settings;
export const keys = Object.keys(defaults) as Key[];

function readValue(key: Key, raw: unknown) {
  if (typeof raw === 'boolean') return raw;
  if (raw !== undefined) console.warn(`Facelift: invalid preference "${key}"; using its default.`);
  return defaults[key];
}

export function listen(update: (value: Readonly<Settings>) => void, failed: () => void) {
  let live = true;
  let current: Settings | undefined;
  const early: Partial<Settings> = {};
  function changed(changes: Record<string, browser.storage.StorageChange>, area: string) {
    if (!live || area !== 'local') return;
    const patch: Partial<Settings> = {};
    for (const key of keys) {
      if (!Object.hasOwn(changes, key)) continue;
      const value = readValue(key, changes[key]?.newValue);
      if (value !== current?.[key]) patch[key] = value;
    }
    if (!current) Object.assign(early, patch);
    else if (Object.keys(patch).length) update(current = { ...current, ...patch });
  }
  // Don't lose a popup edit made while the initial snapshot is in flight.
  browser.storage.onChanged.addListener(changed);
  void browser.storage.local.get(keys).then(stored => {
    if (!live) return;
    const initial = { ...defaults };
    for (const key of keys) initial[key] = readValue(key, stored[key]);
    update(current = { ...initial, ...early });
  }, () => { if (live) failed(); });
  return () => {
    live = false;
    browser.storage.onChanged.removeListener(changed);
  };
}
