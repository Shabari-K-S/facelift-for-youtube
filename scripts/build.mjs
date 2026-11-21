import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative } from 'node:path';
import { zipSync } from 'fflate';

const manifest = JSON.parse(await readFile('src/manifest.json', 'utf8'));
const entries = {};
const result = await build({
  entryPoints: ['src/content/index.ts', 'src/content/styles.css', 'src/popup/popup.ts', 'src/popup/popup.css'],
  outbase: 'src', outdir: 'dist', target: 'firefox140', platform: 'browser',
  bundle: true, minify: true, format: 'iife', write: false, legalComments: 'none',
});
for (const file of result.outputFiles) {
  entries[relative('dist', file.path).replaceAll('\\', '/')] = file.contents;
}
for (const name of ['manifest.json', 'popup/index.html']) entries[name] = await readFile(`src/${name}`);
for (const name of Object.values(manifest.icons)) entries[name] = await readFile(`public/${name}`);
entries.LICENSE = await readFile('LICENSE');

for (const [name, data] of Object.entries(entries)) {
  await mkdir(dirname(`dist/${name}`), { recursive: true });
  await writeFile(`dist/${name}`, data);
}
// Archive the build allowlist, not the workspace or stale files left in dist.
const bytes = zipSync(entries, { level: 9, mtime: new Date(2000, 0, 1) });
const path = `artifacts/facelift-for-youtube-${manifest.version}.xpi`;
await mkdir('artifacts', { recursive: true });
await writeFile(path, bytes);
console.log(`Built ${path} (${bytes.length} bytes; unsigned).`);
