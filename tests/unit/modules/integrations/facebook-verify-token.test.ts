import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { Bindings } from '@/types';
import { webhookHandler } from '@/modules/integrations/handlers/webhook';

function verify(query: string, env: Partial<Bindings>) {
  const app = new Hono<{ Bindings: Bindings }>();
  app.all('/fb', (c) => webhookHandler.facebook(c));
  return app.request(`/fb?${query}`, undefined, { DB: {}, ...env } as unknown as Bindings);
}

describe('Facebook webhook subscription verification', () => {
  it('echoes the challenge for the configured token', async () => {
    const res = await verify('hub.mode=subscribe&hub.verify_token=s3cret&hub.challenge=12345', { FB_VERIFY_TOKEN: 's3cret' });
    expect(await res.text()).toBe('12345');
  });

  it.each([
    ['unset secret, no token', 'hub.mode=subscribe&hub.challenge=12345', undefined],
    ['unset secret, empty token', 'hub.mode=subscribe&hub.verify_token=&hub.challenge=12345', undefined],
    ['empty secret, empty token', 'hub.mode=subscribe&hub.verify_token=&hub.challenge=12345', ''],
    ['wrong token', 'hub.mode=subscribe&hub.verify_token=nope&hub.challenge=12345', 's3cret'],
  ])('does not echo the challenge: %s', async (_name, query, secret) => {
    const res = await verify(query, { FB_VERIFY_TOKEN: secret });
    expect(await res.text()).not.toBe('12345');
  });
});
