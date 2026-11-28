import { expect, test } from 'bun:test'
import { shopeeSign } from './shopee-auth-probe.ts'

// Expected values computed independently with Python's hmac/hashlib.
test('public API sign: partner_id + path + timestamp', () => {
  expect(shopeeSign('test-partner-key', [1255141, '/api/v2/auth/token/get', 1700000000])).toBe(
    '9895eb81d8920dd870009c801e71a3075752954928b2be01e4cfdb25d62c5b01',
  )
})

test('shop API sign appends access_token + shop_id', () => {
  expect(
    shopeeSign('test-partner-key', [1255141, '/api/v2/shop/get_shop_info', 1700000000, 'tok123', 228029969]),
  ).toBe('dc552c386e82b93df4acf332cf67c3455476a0c4ed350addb385f968e83d7ae0')
})
