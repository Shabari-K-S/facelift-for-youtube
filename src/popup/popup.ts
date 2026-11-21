import { keys, listen, type Key, type Settings } from '../types/settings.ts';

const controls = document.querySelector<HTMLFieldSetElement>('#controls')!;
const status = document.querySelector<HTMLElement>('#status')!;
const retry = document.querySelector<HTMLButtonElement>('#retry')!;
const inputs = new Map(keys.map(key => [key, document.querySelector<HTMLInputElement>(`#${key}`)!]));
const pending = new Map<Key, boolean>();
let saved: Readonly<Settings> | undefined;
let error = '';

function render() {
  if (!saved) return;
  controls.disabled = false;
  for (const [key, input] of inputs) input.checked = pending.get(key) ?? saved[key];
  status.textContent = error || (pending.size ? 'Saving...' : 'Settings stay on this device.');
}

for (const [key, input] of inputs) {
  input.addEventListener('change', async () => {
    if (!saved || pending.has(key)) { render(); return; }
    const value = input.checked;
    const previous = saved;
    pending.set(key, value);
    error = '';
    render();
    try {
      // Write just one key, so another tab's unrelated change cannot be lost.
      await browser.storage.local.set({ [key]: value });
      if (saved === previous) saved = { ...saved, [key]: value };
    } catch {
      error = 'Change not saved. Try that checkbox again.';
    } finally {
      pending.delete(key);
      render();
    }
  });
}
const unlisten = listen(state => { saved = state; render(); }, () => {
  status.textContent = 'Cannot read local settings.';
  retry.hidden = false;
});
retry.addEventListener('click', () => location.reload());
window.addEventListener('pagehide', unlisten, { once: true });
