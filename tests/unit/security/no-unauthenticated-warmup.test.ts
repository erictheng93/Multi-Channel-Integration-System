import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

// The removed warmup middleware ran before auth on any request whose URL contained
// __warmup__ or that carried a cf-worker-started header, costing a Coordinator DO call,
// a messages-table scan and up to 100 D1 queries + KV writes. Keep it gone, both in the
// worker entry and in the bundle the web installer deploys to customer accounts.
const root = resolve(__dirname, '../../..');
const targets = {
  'src/index.ts': 'src/index.ts',
  'installer worker bundle': 'web-installer/backend/src/services/generated/worker-bundle.ts',
};
const needles = ['__warmup__', 'cf-worker-started'];

describe.each(Object.entries(targets))('%s has no unauthenticated warmup trigger', (_name, rel) => {
  const source = readFileSync(resolve(root, rel), 'utf8');

  it.each(needles)('does not reference %s', (needle) => {
    expect(source).not.toContain(needle);
  });
});

// latest-message-worker is only checked in the entry: the bundle legitimately contains
// the module for the queue consumer, so the import-by-name guard applies to src/index.ts.
it('worker entry does not import latest-message-worker', () => {
  expect(readFileSync(resolve(root, 'src/index.ts'), 'utf8')).not.toContain('latest-message-worker');
});
