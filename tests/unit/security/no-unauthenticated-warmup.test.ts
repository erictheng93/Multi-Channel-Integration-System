import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

// The removed warmup middleware ran before auth on any request whose URL contained
// __warmup__ or that carried a cf-worker-started header, costing a Coordinator DO call,
// a messages-table scan and up to 100 D1 queries + KV writes. Keep it gone.
describe('worker entry has no unauthenticated warmup trigger', () => {
  const source = readFileSync(resolve(__dirname, '../../../src/index.ts'), 'utf8');

  it.each(['__warmup__', 'cf-worker-started', 'latest-message-worker'])('does not reference %s', (needle) => {
    expect(source).not.toContain(needle);
  });
});
