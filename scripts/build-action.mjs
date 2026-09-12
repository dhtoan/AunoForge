import { build } from 'esbuild';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outdir = resolve(root, 'dist', 'action');

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

const shared = {
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'info',
};

await build({
  ...shared,
  entryPoints: [resolve(root, 'scripts', 'action.mjs')],
  outfile: resolve(outdir, 'index.mjs'),
});

await build({
  ...shared,
  entryPoints: [resolve(root, 'packages', 'cli', 'dist', 'bin.js')],
  outfile: resolve(outdir, 'cli.mjs'),
});
