import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const wranglerConfig = readFileSync('wrangler.toml', 'utf-8');

function envBlock(env: string): string {
  const start = wranglerConfig.search(new RegExp(`^\\[env\\.${env}\\]`, 'm'));
  if (start === -1) {
    return '';
  }

  const remainder = wranglerConfig.slice(start);
  const policyStart = remainder.search(/\n# =================== DEPLOYMENT ENVIRONMENT POLICY/m);
  return policyStart === -1 ? remainder : remainder.slice(0, policyStart);
}

describe('wrangler staging configuration', () => {
  it('declares staging resource bindings separate from production', () => {
    const staging = envBlock('staging');

    expect(staging).toContain('ENVIRONMENT = "staging"');
    expect(staging).toContain('database_name = "mcis-db-staging"');
    expect(staging).toContain('database_id = "6674d5ea-7ad2-44fe-9035-4184c02c87c2"');
    expect(staging).toContain('bucket_name = "mcis-files-staging"');
    expect(staging).toContain('queue = "line-message-queue-staging"');
    expect(staging).toContain('queue = "line-message-dlq-staging"');

    for (const productionResource of [
      'database_id = "1ea20f0e-a053-41a2-b53b-bafa014203b7"',
      'id = "d9398c4c82184d20833b48cd26db1b38"',
      'id = "a8e949aee74a423bbbf4db713be54b67"',
      'bucket_name = "mcis-files"',
      'queue = "line-message-queue"',
      'queue = "line-message-dlq"',
    ]) {
      expect(staging).not.toContain(productionResource);
    }
  });
});
