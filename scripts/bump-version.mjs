// Bumps the version in package.json and public/manifest.json, so the number on
// the extension card changes whenever the code does — making it obvious at a
// glance whether a reload actually picked up the new build.
//
//   node scripts/bump-version.mjs              always bumps
//   node scripts/bump-version.mjs --if-changed bumps only if sources changed
//
// `--if-changed` is what both `pnpm build` and the Stop hook use, so a turn
// that edits and then builds still produces exactly one bump.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE = resolve(ROOT, 'package.json');
const MANIFEST = resolve(ROOT, 'public/manifest.json');
const FINGERPRINT = resolve(ROOT, '.claude/.version-fingerprint');

/** Patch numbers run 0-19; the twentieth bump rolls into the next minor. */
const PATCHES_PER_MINOR = 20;
/** Chrome allows four integers, each at most this. */
const COMPONENT_MAX = 65535;

const WATCHED = ['src', 'public', 'scripts'];
const WATCHED_FILES = [
  'package.json',
  'index.html',
  'options.html',
  'blocked.html',
  'vite.config.ts',
  'vite.content.config.ts',
];

// Matches the top-level "version" only — "manifest_version" is a different key
// and holds a number, so it cannot match either way.
const VERSION_FIELD = /("version"\s*:\s*")([^"]+)(")/;

function readVersion(file) {
  const match = VERSION_FIELD.exec(readFileSync(file, 'utf8'));
  if (!match) throw new Error(`no "version" field in ${file}`);
  return match[2];
}

/** Rewrites just the version field, leaving the file's formatting untouched. */
function writeVersion(file, version) {
  const source = readFileSync(file, 'utf8');
  writeFileSync(file, source.replace(VERSION_FIELD, `$1${version}$3`));
}

function bump(version) {
  const parts = version.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length < 2 || parts.some(Number.isNaN)) {
    throw new Error(`cannot parse version "${version}"`);
  }
  while (parts.length < 3) parts.push(0);

  let [major, minor, patch] = parts;
  patch += 1;
  if (patch >= PATCHES_PER_MINOR) {
    patch = 0;
    minor += 1;
  }
  if (minor > COMPONENT_MAX) {
    minor = 0;
    major += 1;
  }
  return [major, minor, patch].join('.');
}

/** Hashes file contents, not timestamps — regenerated icons are byte-identical. */
function fingerprint() {
  const hash = createHash('sha256');

  const add = (path) => {
    hash.update(path.slice(ROOT.length));
    hash.update(readFileSync(path));
  };

  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir).sort()) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else add(path);
    }
  };

  for (const dir of WATCHED) walk(resolve(ROOT, dir));
  for (const file of WATCHED_FILES) {
    const path = resolve(ROOT, file);
    if (existsSync(path)) add(path);
  }
  return hash.digest('hex');
}

const onlyIfChanged = process.argv.includes('--if-changed');
// Hook mode speaks the Claude Code hook protocol: a message when something
// happened, silence when nothing did.
const asHook = process.argv.includes('--hook');
const previous = existsSync(FINGERPRINT) ? readFileSync(FINGERPRINT, 'utf8').trim() : '';

if (onlyIfChanged && fingerprint() === previous) {
  if (!asHook) console.log(`version ${readVersion(PACKAGE)} (unchanged)`);
  process.exit(0);
}

const next = bump(readVersion(PACKAGE));
writeVersion(PACKAGE, next);
writeVersion(MANIFEST, next);

// Recorded after the write, so the files this script just touched are part of
// the baseline and cannot themselves look like a change next time.
if (existsSync(dirname(FINGERPRINT))) writeFileSync(FINGERPRINT, `${fingerprint()}\n`);

if (asHook) {
  process.stdout.write(
    `${JSON.stringify({ systemMessage: `Extension version bumped to ${next} — rebuild and reload to see it.` })}\n`,
  );
} else {
  console.log(`version ${next}`);
}
