/**
 * Content hash of everything the installer's worker bundle is built from.
 * Shared by build-worker-bundle.ts (records it) and check-worker-bundle.ts (CI guard).
 * Needs no network and no git.
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
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
    // LF-normalized so a Windows (autocrlf) checkout hashes the same as CI.
    hash.update(fs.readFileSync(file, 'utf-8').replace(/\r\n/g, '\n'));
    hash.update('\0');
  }
  return hash.digest('hex');
}
