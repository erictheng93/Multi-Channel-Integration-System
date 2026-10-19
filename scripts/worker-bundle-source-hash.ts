/**
 * Content hash of everything the installer's worker bundle is built from.
 * Shared by build-worker-bundle.ts (records it) and check-worker-bundle.ts (CI guard).
 * Needs no network and no git.
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const INPUTS = ['src', 'shared', 'bun.lock', 'scripts/build-worker-bundle.ts'];

function walk(p: string, out: string[]): void {
  if (fs.statSync(p).isDirectory()) {
    for (const name of fs.readdirSync(p).sort()) walk(path.join(p, name), out);
  } else out.push(p);
}

export function computeWorkerSourceHash(): string {
  const files: string[] = [];
  for (const input of INPUTS) {
    const p = path.join(root, input);
    if (fs.existsSync(p)) walk(p, files);
  }
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(path.relative(root, file).split(path.sep).join('/') + '\0');
    hash.update(fs.readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}
