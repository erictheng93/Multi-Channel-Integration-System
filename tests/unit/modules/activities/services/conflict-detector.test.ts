import { describe, expect, it } from 'vitest'
import { diffStates } from '@/modules/activities/services/conflict-detector'

describe('diffStates', () => {
  it('returns empty array when current state matches recorded new state', () => {
    const result = diffStates(
      { id: 1, name: 'Alice', color: '#FF0000' },
      { id: 1, name: 'Alice', color: '#FF0000' },
      { id: 1, name: 'VIP', color: '#0000FF' }
    )

    expect(result).toEqual([])
  })

  it('reports a field changed after original action', () => {
    const result = diffStates(
      { id: 1, name: 'Bob' },
      { id: 1, name: 'Alice' },
      { id: 1, name: 'VIP' }
    )

    expect(result).toEqual([
      {
        field: 'name',
        valueAtOriginalAction: 'Alice',
        valueNow: 'Bob',
        valueAfterRestore: 'VIP'
      }
    ])
  })

  it('only compares fields captured in recorded new state', () => {
    const result = diffStates(
      { id: 1, name: 'Alice', ignored: 'changed' },
      { id: 1, name: 'Alice' },
      { id: 1, name: 'VIP' }
    )

    expect(result).toEqual([])
  })

  it('treats deeply-equal JSON objects as unchanged', () => {
    const result = diffStates(
      { metadata: { a: 1, b: 2 } },
      { metadata: { a: 1, b: 2 } },
      { metadata: { a: 1, b: 2 } }
    )

    expect(result).toEqual([])
  })

  it('reports multiple midChanges', () => {
    const result = diffStates(
      { id: 1, name: 'Bob', color: '#FF0000', team_id: 99 },
      { id: 1, name: 'Alice', color: '#FF0000', team_id: 3 },
      { id: 1, name: 'Alice', color: '#0000FF', team_id: 3 }
    )

    expect(result).toHaveLength(2)
    expect(result.map(r => r.field).sort()).toEqual(['name', 'team_id'])
  })
})
