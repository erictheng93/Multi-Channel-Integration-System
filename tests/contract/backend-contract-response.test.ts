import { describe, expect, it, vi } from 'vitest'
import { authContracts } from '../../shared/api-contracts'
import { contractJson } from '@/utils/api-contract-response'

describe('backend contract response helper', () => {
  it('forwards a contract-typed JSON body and status to Hono context', () => {
    const context = {
      json: vi.fn((body: unknown, status?: number) => ({ body, status }))
    }

    const body = {
      success: true,
      data: {
        agent: {
          id: 'agent-1',
          email: 'agent@example.com',
          name: 'Agent',
          displayName: 'Agent',
          role: 'agent' as const,
          isActive: true,
          createdAt: Date.parse('2026-06-10T00:00:00.000Z')
        },
        sessionId: 'session-1',
        expiresIn: 7200
      }
    }

    const response = contractJson(context, authContracts.login, body, 200)

    expect(context.json).toHaveBeenCalledWith(body, 200)
    expect(response).toEqual({ body, status: 200 })
  })
})
