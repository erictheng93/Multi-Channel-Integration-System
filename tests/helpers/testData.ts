import type { DbUser } from '@/types'

export const mockUsers = {
  admin: {
    id: 1,
    username: 'admin',
    email: 'admin@example.com',
    displayName: 'System Admin',
    role: 'admin' as const,
    teamId: 1,
    teamName: 'Admin Team',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  } as DbUser,

  agent: {
    id: 2,
    username: 'agent1',
    email: 'agent1@example.com',
    displayName: 'Agent One',
    role: 'agent' as const,
    teamId: 2,
    teamName: 'Support Team',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  } as DbUser,

  inactiveAgent: {
    id: 3,
    username: 'inactive',
    email: 'inactive@example.com',
    displayName: 'Inactive Agent',
    role: 'agent' as const,
    teamId: 2,
    teamName: 'Support Team',
    isActive: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  } as DbUser
}

export const mockDatabaseUsers = {
  admin: {
    id: 1,
    username: 'admin',
    email: 'admin@example.com',
    display_name: 'System Admin',
    role: 'admin',
    team_id: 1,
    team_name: 'Admin Team',
    is_active: 1,
    password_hash: 'hashed-admin-password',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },

  agent: {
    id: 2,
    username: 'agent1',
    email: 'agent1@example.com',
    display_name: 'Agent One',
    role: 'agent',
    team_id: 2,
    team_name: 'Support Team',
    is_active: 1,
    password_hash: 'hashed-agent-password',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
}

export const mockJWTPayloads = {
  admin: {
    userId: 1,
    username: 'admin',
    role: 'admin',
    teamId: 1,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60 // 24 hours
  },

  agent: {
    userId: 2,
    username: 'agent1',
    role: 'agent',
    teamId: 2,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60 // 24 hours
  },

  expired: {
    userId: 2,
    username: 'agent1',
    role: 'agent',
    teamId: 2,
    iat: Math.floor(Date.now() / 1000) - 48 * 60 * 60, // 48 hours ago
    exp: Math.floor(Date.now() / 1000) - 24 * 60 * 60  // 24 hours ago (expired)
  }
}

export const mockSessionData = {
  valid: {
    userId: 2,
    role: 'agent',
    teamId: 2,
    createdAt: '2024-01-01T00:00:00Z'
  },

  admin: {
    userId: 1,
    role: 'admin',
    teamId: 1,
    createdAt: '2024-01-01T00:00:00Z'
  }
}

export const testPasswords = {
  valid: 'TestPassword123!',
  weak: '123',
  empty: '',
  long: 'a'.repeat(1000)
}

export const testSecrets = {
  jwt: 'test-jwt-secret-key-for-testing',
  short: 'short',
  empty: ''
}