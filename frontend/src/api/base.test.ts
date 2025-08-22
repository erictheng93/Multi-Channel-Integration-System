import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from './base'

describe('API Base Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should exist and have required methods', () => {
    expect(apiClient).toBeDefined()
    expect(typeof apiClient.get).toBe('function')
    expect(typeof apiClient.post).toBe('function')
    expect(typeof apiClient.put).toBe('function')
    expect(typeof apiClient.delete).toBe('function')
  })

  it('should have auth header methods', () => {
    expect(typeof apiClient.setAuthHeader).toBe('function')
    expect(typeof apiClient.removeAuthHeader).toBe('function')
  })
})