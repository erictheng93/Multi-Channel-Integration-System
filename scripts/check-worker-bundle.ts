/**
 * CI guard: fails when the committed installer worker bundle was built from
 * different sources than the ones now in the tree.
 * Fix: `bun run build:worker-bundle` and commit the result.
 */
import * as fs from 'fs';
import * as path from 'path';
import { computeWorkerSourceHash } from './worker-bundle-source-hash';

const bundleFile = path.join(path.dirname(new URL(import.meta.url).pathname), '../web-installer/backend/src/services/generated/worker-bundle.ts');
const recorded = fs.readFileSync(bundleFile, 'utf-8').match(/sourceHash: '([0-9a-f]{64})'/)?.[1];
const current = computeWorkerSourceHash();

if (recorded !== current) {
  console.error(`Installer worker bundle is stale or has no provenance.\n  recorded: ${recorded ?? '(none)'}\n  current:  ${current}\nRun: bun run build:worker-bundle`);
  process.exit(1);
}
console.log('Installer worker bundle matches src.');
