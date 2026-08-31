// Empties dist/ without removing the directory itself.
//
// Chrome derives an unpacked extension's ID — and therefore which stored
// settings belong to it — from the folder it was loaded from. Deleting and
// recreating that folder risks Chrome noticing it missing mid-build and
// disabling the extension, so we clear the contents in place instead.
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');

mkdirSync(DIST, { recursive: true });
for (const entry of readdirSync(DIST)) {
  rmSync(resolve(DIST, entry), { recursive: true, force: true });
}
