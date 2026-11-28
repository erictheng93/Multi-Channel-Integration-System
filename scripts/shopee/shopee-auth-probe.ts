#!/usr/bin/env bun
/**
 * One-off Shopee Open Platform probe: exchange an authorization code for tokens,
 * then call one shop-level API. Its only job is to leave the "active API call
 * record" the Chat API application requires (docs/specs/shopee-chat-phase-1.md §3).
 * It is not the Phase 1 integration — nothing here runs in the Worker.
 *
 * Env:
 *   SHOPEE_ENV          sandbox | live   (default sandbox)
 *   SHOPEE_PARTNER_ID   Test or Live Partner ID, matching SHOPEE_ENV
 *   SHOPEE_PARTNER_KEY  Test or Live Partner Key, matching SHOPEE_ENV
 *
 * Usage:
 *   bun scripts/shopee/shopee-auth-probe.ts token <code> <shop_id>
 *   bun scripts/shopee/shopee-auth-probe.ts shop-info
 *
 * Tokens are written to ~/.mcis/shopee-tokens.<env>.json (mode 600, outside the
 * repo) and never printed in full.
 */
import { createHmac } from 'node:crypto'
import { chmod, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'

const HOSTS = {
  sandbox: 'https://openplatform.sandbox.test-stable.shopee.sg',
  live: 'https://partner.shopeemobile.com',
} as const

type ShopeeEnv = keyof typeof HOSTS

interface TokenFile {
  shop_id: number
  access_token: string
  refresh_token: string
  expire_at: number
}

/** Shopee v2 sign: lowercase hex HMAC-SHA256(partner_key, partner_id + path + timestamp [+ access_token + shop_id]). */
export function shopeeSign(partnerKey: string, parts: ReadonlyArray<string | number>): string {
  return createHmac('sha256', partnerKey).update(parts.join('')).digest('hex')
}

function fail(message: string): never {
  console.error(`[shopee-probe] ✗ ${message}`)
  process.exit(1)
}

function mask(value: string): string {
  return value.length <= 8 ? '****' : `${value.slice(0, 4)}…${value.slice(-4)}`
}

function config(): { env: ShopeeEnv; host: string; partnerId: number; partnerKey: string; tokenPath: string } {
  const env = (process.env.SHOPEE_ENV ?? 'sandbox') as ShopeeEnv
  if (!(env in HOSTS)) {fail(`SHOPEE_ENV must be sandbox or live, got "${env}"`)}
  const partnerId = Number(process.env.SHOPEE_PARTNER_ID)
  const partnerKey = process.env.SHOPEE_PARTNER_KEY ?? ''
  if (!Number.isInteger(partnerId) || partnerId <= 0) {fail('SHOPEE_PARTNER_ID is missing or not a number')}
  if (!partnerKey) {fail('SHOPEE_PARTNER_KEY is missing')}
  return { env, host: HOSTS[env], partnerId, partnerKey, tokenPath: `${homedir()}/.mcis/shopee-tokens.${env}.json` }
}

async function call(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(url, init)
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  console.log(`[shopee-probe] HTTP ${res.status} request_id=${String(body.request_id ?? '-')} error=${String(body.error || '-')}`)
  if (!res.ok || body.error) {fail(`${String(body.error ?? res.status)}: ${String(body.message ?? '')}`)}
  return body
}

async function token(code: string | undefined, shopIdArg: string | undefined): Promise<void> {
  const { env, host, partnerId, partnerKey, tokenPath } = config()
  const shopId = Number(shopIdArg)
  if (!code || !Number.isInteger(shopId) || shopId <= 0) {fail('usage: token <code> <shop_id>')}
  const path = '/api/v2/auth/token/get'
  const ts = Math.floor(Date.now() / 1000)
  const sign = shopeeSign(partnerKey, [partnerId, path, ts])
  const body = await call(`${host}${path}?partner_id=${partnerId}&timestamp=${ts}&sign=${sign}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, shop_id: shopId, partner_id: partnerId }),
  })
  const tokens: TokenFile = {
    shop_id: shopId,
    access_token: String(body.access_token),
    refresh_token: String(body.refresh_token),
    expire_at: ts + Number(body.expire_in),
  }
  await mkdir(`${homedir()}/.mcis`, { recursive: true, mode: 0o700 })
  await Bun.write(tokenPath, JSON.stringify(tokens, null, 2))
  await chmod(tokenPath, 0o600)
  console.log(`[shopee-probe] ✓ ${env} tokens saved to ${tokenPath} (access ${mask(tokens.access_token)}, expires in ${String(body.expire_in)}s)`)
}

async function shopInfo(): Promise<void> {
  const { env, host, partnerId, partnerKey, tokenPath } = config()
  const file = Bun.file(tokenPath)
  if (!(await file.exists())) {fail(`no tokens at ${tokenPath}; run "token <code> <shop_id>" first`)}
  const tokens = (await file.json()) as TokenFile
  // shortcut: no refresh here; an expired token (4h) means re-running "token" with a fresh authorization.
  if (Date.now() / 1000 > tokens.expire_at) {fail('access_token expired; authorize again and re-run "token"')}
  const path = '/api/v2/shop/get_shop_info'
  const ts = Math.floor(Date.now() / 1000)
  const sign = shopeeSign(partnerKey, [partnerId, path, ts, tokens.access_token, tokens.shop_id])
  const body = await call(
    `${host}${path}?partner_id=${partnerId}&timestamp=${ts}&sign=${sign}&access_token=${encodeURIComponent(tokens.access_token)}&shop_id=${tokens.shop_id}`,
  )
  const { shop_name, region, status, is_cb, is_sip } = body
  console.log(`[shopee-probe] ✓ ${env} shop ${tokens.shop_id}:`, { shop_name, region, status, is_cb, is_sip })
}

if (import.meta.main) {
  const [command, ...args] = process.argv.slice(2)
  if (command === 'token') {await token(args[0], args[1])}
  else if (command === 'shop-info') {await shopInfo()}
  else {fail('usage: token <code> <shop_id> | shop-info')}
}
