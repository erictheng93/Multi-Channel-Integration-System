/**
 * Regression guard for report list query serialisation.
 *
 * `buildReportQuery` used to be `new URLSearchParams(query as Record<string, string>)`.
 * The cast defeated the type system, and URLSearchParams stringifies whatever it
 * is given, so an absent filter went out as the literal six-character string
 * "undefined":
 *
 *   GET /api/reports?...&type=undefined&status=undefined&format=undefined
 *   400 Bad Request
 *
 * That was live in production and was found by watching the reports page in
 * DevTools. The two sibling call sites that build query strings this way
 * (frontend/src/api/modern-client.ts, src/services/webhook-url-service.ts) type
 * their input as Record<string, string> with no cast, so the compiler stops the
 * same mistake there.
 */
import { describe, expect, it } from 'vitest'
import { buildReportQuery } from '../../shared/api-contracts/reports'

describe('buildReportQuery', () => {
  it('omits undefined values instead of sending the string "undefined"', () => {
    const query = buildReportQuery({
      page: 1,
      pageSize: 20,
      type: undefined,
      status: undefined,
      format: undefined,
      startDate: undefined,
      endDate: undefined
    })

    expect(query).not.toContain('undefined')
    expect(query).toBe('page=1&pageSize=20')
  })

  it('omits null and empty-string values', () => {
    // Cast through `unknown`: these shapes are not type-legal, which is the
    // point - they arrive from untyped sources (route query, stored filters) and
    // the serialiser must not forward them as text.
    const query = buildReportQuery({
      page: 1,
      status: null,
      type: ''
    } as unknown as Parameters<typeof buildReportQuery>[0])

    expect(query).toBe('page=1')
  })

  it('keeps values that are legitimately falsy but meaningful', () => {
    // 0 is a real value, not an absent one.
    const query = buildReportQuery({ page: 0, pageSize: 0 } as unknown as Parameters<
      typeof buildReportQuery
    >[0])

    expect(query).toBe('page=0&pageSize=0')
  })

  it('serialises a fully populated query', () => {
    const query = buildReportQuery({
      page: 2,
      pageSize: 50,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      type: 'conversation_summary',
      status: 'completed'
    } as unknown as Parameters<typeof buildReportQuery>[0])

    expect(query).toContain('page=2')
    expect(query).toContain('sortBy=createdAt')
    expect(query).toContain('type=conversation_summary')
    expect(query).not.toContain('undefined')
  })

  it('returns an empty string when every field is absent', () => {
    expect(buildReportQuery({})).toBe('')
    expect(buildReportQuery()).toBe('')
  })
})
