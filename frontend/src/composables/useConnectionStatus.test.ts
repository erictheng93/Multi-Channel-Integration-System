import { describe, it, expect } from 'vitest'
import { useConnectionStatus } from './useConnectionStatus'

describe('useConnectionStatus', () => {
  it('maps websocket flags to the three pill states', () => {
    expect(useConnectionStatus({ isConnected: true, isConnecting: false }).value.label).toBe('即時同步')
    expect(useConnectionStatus({ isConnected: false, isConnecting: true }).value.tone).toBe('connecting')
    expect(useConnectionStatus({ isConnected: false, isConnecting: false }).value.label).toBe('已離線')
  })
})
