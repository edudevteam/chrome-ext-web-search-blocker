// Zips dist/ into release/web-content-blocker-<version>.zip for the Chrome Web Store.
//
// The Store reads manifest.json from the root of the archive, so this zips the
// *contents* of dist/ rather than the folder — an archive holding `dist/manifest.json`
// is rejected on upload.
//
// `pnpm zip` builds first, so the version in the filename always matches the
// build inside it. Running this script on its own skips the build and checks
// that dist/ is current instead. The script is named `zip` rather than `pack`
// because `pnpm pack` is pnpm's own command for building an npm tarball, and it
// wins over a same-named script.
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const RELEASE = resolve(ROOT, 'release');

// Never ship these: .DS_Store rides along from Finder, and a stray sourcemap
// would publish the original TypeScript.
const EXCLUDE = ['.DS_Store', '*/.DS_Store', '*.map', '*/*.map'];

function fail(message) {
  console.error(`pack: ${message}`);
  process.exit(1);
}

function version(file) {
  const match = /("version"\s*:\s*")([^"]+)(")/.exec(readFileSync(file, 'utf8'));
  if (!match) throw new Error(`no "version" field in ${file}`);
  return match[2];
}

if (!existsSync(resolve(DIST, 'manifest.json'))) {
  fail('dist/ has no manifest.json — run `pnpm build` first.');
}

const packageVersion = version(resolve(ROOT, 'package.json'));
const builtVersion = version(resolve(DIST, 'manifest.json'));
if (packageVersion !== builtVersion) {
  fail(
    `dist/ holds ${builtVersion} but package.json says ${packageVersion} — ` +
      'run `pnpm build` so the archive matches its name.',
  );
}

const name = `web-content-blocker-${packageVersion}.zip`;
const archive = resolve(RELEASE, name);

mkdirSync(RELEASE, { recursive: true });
// zip *adds* to an existing archive rather than replacing it, so a rebuilt
// version would otherwise keep files the new build no longer produces.
rmSync(archive, { force: true });

// -X drops the macOS resource forks and extra attributes the Store has no use for.
const zip = spawnSync('zip', ['-rqX', archive, '.', '-x', ...EXCLUDE], {
  cwd: DIST,
  stdio: ['ignore', 'inherit', 'inherit'],
});

if (zip.error?.code === 'ENOENT') fail('the `zip` command was not found on PATH.');
if (zip.status !== 0) fail(`zip exited with status ${zip.status}.`);

// Confirms the layout the Store actually cares about, rather than trusting the
// cwd trick above to have worked.
const listed = spawnSync('unzip', ['-l', archive], { encoding: 'utf8' });
if (listed.status === 0 && !/\smanifest\.json$/m.test(listed.stdout)) {
  fail('manifest.json is not at the archive root.');
}

const kb = (statSync(archive).size / 1024).toFixed(0);
console.log(`release/${name} (${kb} KB)`);
