// Vectors computed independently with Python: hmac.new(key, (url + '|' + body).encode(), hashlib.sha256).hexdigest()
import { describe, it, expect } from 'vitest';
import { verifyShopeePush } from '@/modules/integrations/services/shopee/shopee-push-signature';

const KEY = 'test-push-key';
const URL = 'https://example.test/api/webhook/shopee';
const BODY = '{"shop_id":228029969,"code":10,"timestamp":1790000000,"data":{}}';
const SIG = '5c90fc68ac3ecfac14c604d547ff8160c91d26c0dd30e4b5b694b37fdb4c920e';
const SIG_OTHER_KEY = 'fd0b866573de8a6037a56170baba7d70e24b823caf436fcebf8f2c22d272c152'; // gitleaks:allow

describe('verifyShopeePush', () => {
  it('accepts the correct signature', async () => {
    expect(await verifyShopeePush(URL, BODY, SIG, KEY)).toBe(true);
  });

  it('rejects a signature made with another key', async () => {
    expect(await verifyShopeePush(URL, BODY, SIG_OTHER_KEY, KEY)).toBe(false);
  });

  it('rejects a body with one extra whitespace', async () => {
    expect(await verifyShopeePush(URL, BODY.replace(',', ', '), SIG, KEY)).toBe(false);
  });

  it('rejects a different callback URL', async () => {
    expect(await verifyShopeePush('https://other.test/api/webhook/shopee', BODY, SIG, KEY)).toBe(false);
  });

  it('rejects a missing header', async () => {
    expect(await verifyShopeePush(URL, BODY, undefined, KEY)).toBe(false);
    expect(await verifyShopeePush(URL, BODY, '', KEY)).toBe(false);
  });
});
