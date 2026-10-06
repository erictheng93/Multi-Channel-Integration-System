import { describe, expect, it, vi } from 'vitest'
import { encodeUnderLimit, scaleToFit, PREVIEW_MAX_BYTES } from './broadcast-image-preview'

const blobOf = (bytes: number) => new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' })

describe('scaleToFit', () => {
  it('keeps small images unchanged', () => {
    expect(scaleToFit(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it('scales the long edge down to 1024 preserving ratio', () => {
    expect(scaleToFit(4000, 2000)).toEqual({ width: 1024, height: 512 })
    expect(scaleToFit(1500, 3000)).toEqual({ width: 512, height: 1024 })
  })
})

describe('encodeUnderLimit', () => {
  it('returns the first encoding that fits', async () => {
    const encode = vi.fn(async () => blobOf(200_000))
    const blob = await encodeUnderLimit(encode)
    expect(blob.size).toBe(200_000)
    expect(encode).toHaveBeenCalledWith(0.85)
    expect(encode).toHaveBeenCalledTimes(1)
  })

  it('lowers quality until the preview fits under 1MB', async () => {
    const encode = vi.fn(async (q: number) => blobOf(q > 0.6 ? PREVIEW_MAX_BYTES + 1 : 900_000))
    const blob = await encodeUnderLimit(encode)
    expect(blob.size).toBe(900_000)
    expect(encode.mock.calls.map(([q]) => Number(q.toFixed(2)))).toEqual([0.85, 0.7, 0.55])
  })

  it('throws when even the lowest quality is too large', async () => {
    const encode = vi.fn(async () => blobOf(PREVIEW_MAX_BYTES + 1))
    await expect(encodeUnderLimit(encode)).rejects.toThrow('預覽圖無法壓縮到 1MB 以下')
  })
})
