import { readFileSync } from 'node:fs'
import { Buffer } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { decodeJwtPayloadSegment } from '@/utils/jwt-payload'

function base64UrlEncodeUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value)
  const binary = String.fromCharCode(...bytes)
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function naiveDecodePayloadSegment(payloadSegment: string): { displayName?: string } {
  const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(latin1Atob(base64))
}

function latin1Atob(value: string): string {
  return Buffer.from(value, 'base64').toString('latin1')
}

describe('decodeJwtPayloadSegment', () => {
  const displayName = '邱建維 Jerry'
  const payloadSegment = base64UrlEncodeUtf8(JSON.stringify({
    userId: 'agent-1',
    displayName
  }))

  beforeEach(() => {
    vi.stubGlobal('atob', latin1Atob)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('decodes non-ASCII JWT payload fields through UTF-8 bytes', () => {
    expect(decodeJwtPayloadSegment<{ displayName: string }>(payloadSegment).displayName)
      .toBe(displayName)
  })

  it('pads base64url payloads before decoding', () => {
    expect(payloadSegment.length % 4).not.toBe(0)
    expect(decodeJwtPayloadSegment<{ displayName: string }>(payloadSegment).displayName)
      .toBe(displayName)
  })

  it('documents the production corruption this helper prevents', () => {
    const corrupted = naiveDecodePayloadSegment(payloadSegment).displayName!

    expect(corrupted).not.toBe(displayName)
    expect([...new TextEncoder().encode(corrupted)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
    ).toBe('c3a9c282c2b1c3a5c2bbc2bac3a7c2b6c2ad204a65727279')
  })

  it('is wired into CustomerMessageDO instead of an inline atob JSON parse', () => {
    const source = readFileSync('src/durable-objects/CustomerMessageDO.ts', 'utf8')

    expect(source).toContain('decodeJwtPayloadSegment')
    expect(source).not.toContain('JSON.parse(atob')
  })
})
