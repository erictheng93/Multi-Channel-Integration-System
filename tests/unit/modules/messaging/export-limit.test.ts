import { describe, it, expect } from 'vitest'
import { resolveExportLimit } from '@/modules/messaging/handlers/messaging/routes/export'
import { BULK_OPERATION_LIMITS } from '@/constants/limits'

describe('resolveExportLimit (S7)', () => {
  it('defaults to the 5,000 cap the UI promises when no limit is sent', () => {
    expect(BULK_OPERATION_LIMITS.EXPORT_MAX_RECORDS).toBe(5000)
    expect(resolveExportLimit(undefined)).toBe(5000)
  })

  it('an explicit limit can only lower the cap', () => {
    expect(resolveExportLimit('250')).toBe(250)
    expect(resolveExportLimit('99999')).toBe(5000)
  })

  it('invalid or non-positive values fall back to the cap, never to 100', () => {
    for (const bad of ['', 'abc', '0', '-5', 'NaN']) expect(resolveExportLimit(bad)).toBe(5000)
  })
})
