import { access, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

function value(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function requireSemverTag(tag, name) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag || '')) throw new Error(`${name} must be a semver release tag like v1.2.3`);
  return tag;
}

async function requireFile(path) {
  await access(path);
  return readFile(path, 'utf8');
}

function requireMatch(source, pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

const args = process.argv.slice(2);
const stableTag = requireSemverTag(value(args, '--stable-tag'), '--stable-tag');
const nextTag = requireSemverTag(value(args, '--next-tag'), '--next-tag');
const root = process.cwd();
const nextVersion = nextTag.slice(1);

const action = await requireFile(resolve(root, 'action.yml'));
requireMatch(action, /runs:\s*\n\s+using:\s+node24\b/, 'action.yml must use the packaged Node 24 runtime');
requireMatch(action, /branding:\s*\n\s+icon:\s+['"]?shield['"]?\s*\n\s+color:\s+['"]?blue['"]?/m, 'action.yml must declare supported Marketplace branding');

await requireFile(resolve(root, 'dist/action/index.mjs'));
await requireFile(resolve(root, 'dist/action/cli.mjs'));

try {
  execFileSync('git', ['diff', '--exit-code', '--', 'dist/action'], { cwd: root, stdio: 'pipe' });
} catch {
  throw new Error('Generated dist/action runtime differs from the checked-in tree; run pnpm build:action and commit the result');
}

const readme = await requireFile(resolve(root, 'README.md'));
const stableExample = await requireFile(resolve(root, 'docs/examples/aunoforge-review.yml'));
for (const [name, source] of [['README.md', readme], ['docs/examples/aunoforge-review.yml', stableExample]]) {
  if (!source.includes(`dhtoan/AunoForge@${stableTag}`)) throw new Error(`${name} must reference the stable Action tag ${stableTag}`);
}

const notes = await requireFile(resolve(root, `docs/releases/${nextVersion}.md`));
if (!notes.includes(`# AunoForge ${nextTag}`)) throw new Error(`Release notes must identify ${nextTag}`);
if (/\b(?:TBD|TODO|placeholder)\b/i.test(notes)) throw new Error('Release notes must not contain placeholder markers');
requireMatch(notes, /Node 24/i, 'Release notes must mention the packaged Node 24 Action runtime');
requireMatch(notes, /Step Summary/i, 'Release notes must mention GitHub Step Summary');
requireMatch(notes, /SARIF/i, 'Release notes must mention SARIF reporting');
requireMatch(notes, /incremental/i, 'Release notes must mention incremental evidence review');

const guide = await requireFile(resolve(root, 'docs/releasing.md'));
requireMatch(guide, /Marketplace Developer Agreement/i, 'Release guide must document the Marketplace Developer Agreement gate');
requireMatch(guide, /Publish this Action to the GitHub Marketplace/i, 'Release guide must document the GitHub Marketplace publication control');
requireMatch(guide, /manual/i, 'Release guide must state Marketplace publication is manual');
requireMatch(guide, /do not claim/i, 'Release guide must prohibit claiming Marketplace publication before confirmation');

process.stdout.write(`Release readiness: PASS (${stableTag} -> ${nextTag})\n`);
