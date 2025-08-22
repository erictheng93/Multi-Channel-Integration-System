import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
    signJWT,
    verifyJWT,
    hashPassword,
    verifyPassword,
    generateRandomString,
    createUser,
    getUserById,
    getUserByUsername,
    authenticateUser,
    hasPermission,
    canAccessTeam,
    createSession,
    getSession,
    deleteSession
} from '@backend/utils/auth'
import type { DbUser } from '@backend/types'
import { createMockDatabase } from '../../helpers/mockDatabase'
import { createMockKV } from '../../helpers/mockKV'
import {
    mockJWTPayloads,
    testPasswords,
    testSecrets
} from '../../helpers/testData'

// Mock crypto API
Object.defineProperty(global, 'crypto', {
    value: {
        subtle: {
            importKey: vi.fn(),
            sign: vi.fn(),
            verify: vi.fn(),
            digest: vi.fn()
        }
    }
})

// Create mock instances
const mockDB = createMockDatabase()
const mockKV = createMockKV()

describe('Auth Utils - JWT Functions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockDB.reset()
        mockKV.reset()
    })

    describe('signJWT', () => {
        it('should create a valid JWT token', async () => {
            // Mock crypto operations
            vi.mocked(crypto.subtle.importKey).mockResolvedValue('mock-key' as any)
            vi.mocked(crypto.subtle.sign).mockResolvedValue(new ArrayBuffer(32))

            const token = await signJWT(mockJWTPayloads.agent, testSecrets.jwt)

            expect(token).toBeDefined()
            expect(typeof token).toBe('string')
            expect(token.split('.')).toHaveLength(3)
            expect(crypto.subtle.importKey).toHaveBeenCalledWith(
                'raw',
                expect.any(Uint8Array),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign']
            )
        })

        it('should include expiration time in payload', async () => {
            vi.mocked(crypto.subtle.importKey).mockResolvedValue('mock-key' as any)
            vi.mocked(crypto.subtle.sign).mockResolvedValue(new ArrayBuffer(32))

            const expiresIn = 3600 // 1 hour
            const token = await signJWT(mockJWTPayloads.agent, testSecrets.jwt, expiresIn)

            // Decode payload to check expiration
            const parts = token.split('.')
            const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
            const paddedPayload = payloadB64.padEnd(payloadB64.length + (4 - payloadB64.length % 4) % 4, '=')
            const decodedPayload = JSON.parse(atob(paddedPayload))

            expect(decodedPayload.exp).toBeDefined()
            expect(decodedPayload.iat).toBeDefined()
            expect(decodedPayload.userId).toBe(mockJWTPayloads.agent.userId)
            expect(decodedPayload.role).toBe(mockJWTPayloads.agent.role)
        })

        it('should handle empty secret gracefully', async () => {
            vi.mocked(crypto.subtle.importKey).mockRejectedValue(new Error('Empty secret'))

            await expect(signJWT(mockJWTPayloads.agent, testSecrets.empty))
                .rejects.toThrow()
        })
    })

    describe('verifyJWT', () => {
        it('should verify a valid JWT token', async () => {
            // Create a properly formatted JWT token
            const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
            const payload = btoa(JSON.stringify({ userId: 1, role: 'agent', iat: 1600000000, exp: 9999999999 })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
            const signature = btoa('mock-signature').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
            const validToken = `${header}.${payload}.${signature}`

            vi.mocked(crypto.subtle.importKey).mockResolvedValue('mock-key' as any)
            vi.mocked(crypto.subtle.verify).mockResolvedValue(true)

            const decodedPayload = await verifyJWT(validToken, testSecrets.jwt)

            expect(decodedPayload).toBeDefined()
            expect(decodedPayload.userId).toBe(1)
            expect(decodedPayload.role).toBe('agent')
        })

        it('should throw error for invalid JWT format', async () => {
            const invalidToken = 'invalid.token'

            await expect(verifyJWT(invalidToken, testSecrets.jwt)).rejects.toThrow('Invalid JWT format')
        })

        it('should throw error for malformed token parts', async () => {
            const malformedToken = 'part1.part2'

            await expect(verifyJWT(malformedToken, testSecrets.jwt)).rejects.toThrow('Invalid JWT format')
        })

        it('should throw error for invalid signature', async () => {
            const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
            const payload = btoa(JSON.stringify({ userId: 1, role: 'agent' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
            const signature = btoa('invalid-signature').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
            const tokenWithInvalidSignature = `${header}.${payload}.${signature}`

            vi.mocked(crypto.subtle.importKey).mockResolvedValue('mock-key' as any)
            vi.mocked(crypto.subtle.verify).mockResolvedValue(false)

            await expect(verifyJWT(tokenWithInvalidSignature, testSecrets.jwt)).rejects.toThrow('Invalid JWT signature')
        })

        it('should throw error for expired token', async () => {
            const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
            const payload = btoa(JSON.stringify({ userId: 1, role: 'agent', iat: 1600000000, exp: 1600000000 })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
            const signature = btoa('mock-signature').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
            const expiredToken = `${header}.${payload}.${signature}`

            vi.mocked(crypto.subtle.importKey).mockResolvedValue('mock-key' as any)
            vi.mocked(crypto.subtle.verify).mockResolvedValue(true)

            await expect(verifyJWT(expiredToken, testSecrets.jwt)).rejects.toThrow('JWT token expired')
        })

        it('should handle crypto errors gracefully', async () => {
            const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGUiOiJhZ2VudCJ9.signature'

            vi.mocked(crypto.subtle.importKey).mockRejectedValue(new Error('Crypto error'))

            await expect(verifyJWT(validToken, testSecrets.jwt)).rejects.toThrow('JWT verification failed')
        })
    })
})

describe('Auth Utils - Password Functions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('hashPassword', () => {
        it('should hash password correctly', async () => {
            const mockHash = new ArrayBuffer(32)
            const mockArray = new Uint8Array(32).fill(65) // Fill with 'A' (65)

            vi.mocked(crypto.subtle.digest).mockResolvedValue(mockHash)
            Object.defineProperty(mockHash, Symbol.iterator, {
                value: function* () {
                    yield* mockArray
                }
            })

            const hashedPassword = await hashPassword(testPasswords.valid)

            expect(hashedPassword).toBeDefined()
            expect(typeof hashedPassword).toBe('string')
            expect(hashedPassword.length).toBe(64) // 32 bytes * 2 hex chars
            expect(crypto.subtle.digest).toHaveBeenCalledWith('SHA-256', expect.any(Uint8Array))
        })

        it('should produce consistent hash for same password', async () => {
            const mockHash = new ArrayBuffer(32)
            const mockArray = new Uint8Array(32).fill(65)

            vi.mocked(crypto.subtle.digest).mockResolvedValue(mockHash)
            Object.defineProperty(mockHash, Symbol.iterator, {
                value: function* () { yield* mockArray }
            })

            const hash1 = await hashPassword(testPasswords.valid)
            const hash2 = await hashPassword(testPasswords.valid)

            expect(hash1).toBe(hash2)
        })

        it('should handle empty password', async () => {
            const mockHash = new ArrayBuffer(32)
            vi.mocked(crypto.subtle.digest).mockResolvedValue(mockHash)

            const hashedPassword = await hashPassword(testPasswords.empty)

            expect(hashedPassword).toBeDefined()
            expect(typeof hashedPassword).toBe('string')
        })

        it('should handle very long password', async () => {
            const mockHash = new ArrayBuffer(32)
            vi.mocked(crypto.subtle.digest).mockResolvedValue(mockHash)

            const hashedPassword = await hashPassword(testPasswords.long)

            expect(hashedPassword).toBeDefined()
            expect(typeof hashedPassword).toBe('string')
        })
    })

    describe('verifyPassword', () => {
        it('should verify correct password', async () => {
            const password = testPasswords.valid
            const mockHash = new ArrayBuffer(32)
            const mockArray = new Uint8Array(32).fill(65)

            vi.mocked(crypto.subtle.digest).mockResolvedValue(mockHash)
            Object.defineProperty(mockHash, Symbol.iterator, {
                value: function* () { yield* mockArray }
            })

            // First call for the hash we're comparing against
            const correctHash = await hashPassword(password)

            // Second call for verification
            const isValid = await verifyPassword(password, correctHash)

            expect(isValid).toBe(true)
        })

        it('should reject incorrect password', async () => {
            const correctPassword = testPasswords.valid
            const wrongPassword = 'wrongpassword'

            // Mock different hashes for different passwords
            vi.mocked(crypto.subtle.digest)
                .mockResolvedValueOnce(new ArrayBuffer(32)) // for correct password hash
                .mockResolvedValueOnce(new ArrayBuffer(16)) // for wrong password hash

            const correctHash = await hashPassword(correctPassword)
            const isValid = await verifyPassword(wrongPassword, correctHash)

            expect(isValid).toBe(false)
        })
    })
})

describe('Auth Utils - Utility Functions', () => {
    describe('generateRandomString', () => {
        it('should generate string of specified length', () => {
            const length = 16
            const randomString = generateRandomString(length)

            expect(randomString).toBeDefined()
            expect(randomString.length).toBe(length)
            expect(typeof randomString).toBe('string')
        })

        it('should generate different strings on multiple calls', () => {
            const string1 = generateRandomString(32)
            const string2 = generateRandomString(32)

            expect(string1).not.toBe(string2)
        })

        it('should use default length of 32 when no length specified', () => {
            const randomString = generateRandomString()

            expect(randomString.length).toBe(32)
        })
    })
})

describe('Auth Utils - Database User Operations', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('createUser', () => {
        it('should call database with correct parameters', async () => {
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'password123',
                displayName: 'Test User',
                role: 'agent' as const,
                teamId: 1
            }

            const mockResult = {
                success: true,
                meta: { last_row_id: 123 }
            }

            const mockUser = {
                id: 123,
                username: 'testuser',
                email: 'test@example.com',
                display_name: 'Test User',
                role: 'agent',
                team_id: 1,
                team_name: 'Test Team',
                is_active: 1,
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z'
            }

            // Mock password hashing
            vi.mocked(crypto.subtle.digest).mockResolvedValue(new ArrayBuffer(32))

            // Mock database operations
            const mockRun = vi.fn().mockResolvedValue(mockResult)
            const mockFirst = vi.fn().mockResolvedValue(mockUser)
            const mockStatement = {
                bind: vi.fn(() => mockStatement),
                run: mockRun,
                first: mockFirst,
                all: vi.fn()
            }
            mockDB.prepare.mockReturnValue(mockStatement)

            const result = await createUser(mockDB as any, userData)

            expect(result).toBeDefined()
            expect(mockDB.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO users'))
            expect(mockStatement.bind).toHaveBeenCalledWith(
                userData.username,
                userData.email,
                expect.any(String), // hashed password
                userData.displayName,
                userData.role,
                userData.teamId,
                expect.any(String), // timestamp
                expect.any(String)  // timestamp
            )
        })

        it('should throw error when database insert fails', async () => {
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'password123',
                displayName: 'Test User',
                role: 'agent' as const
            }

            const mockResult = { success: false }
            const mockRun = vi.fn().mockResolvedValue(mockResult)
            const mockStatement = {
                bind: vi.fn(() => mockStatement),
                run: mockRun,
                first: vi.fn(),
                all: vi.fn()
            }
            mockDB.prepare.mockReturnValue(mockStatement)

            vi.mocked(crypto.subtle.digest).mockResolvedValue(new ArrayBuffer(32))

            await expect(createUser(mockDB as any, userData)).rejects.toThrow('Failed to create user')
        })
    })

    describe('getUserById', () => {
        it('should return user when found', async () => {
            const userId = 123
            const mockUser = {
                id: 123,
                username: 'testuser',
                email: 'test@example.com',
                display_name: 'Test User',
                role: 'agent',
                team_id: 1,
                team_name: 'Test Team',
                is_active: 1,
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z'
            }

            const mockFirst = vi.fn().mockResolvedValue(mockUser)
            const mockStatement = {
                bind: vi.fn(() => mockStatement),
                run: vi.fn(),
                first: mockFirst,
                all: vi.fn()
            }
            mockDB.prepare.mockReturnValue(mockStatement)

            const result = await getUserById(mockDB as any, userId)

            expect(result).toEqual({
                id: 123,
                username: 'testuser',
                email: 'test@example.com',
                displayName: 'Test User',
                role: 'agent',
                teamId: 1,
                teamName: 'Test Team',
                isActive: true,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z'
            })
        })

        it('should throw error when user not found', async () => {
            const userId = 999
            const mockFirst = vi.fn().mockResolvedValue(null)
            const mockStatement = {
                bind: vi.fn(() => mockStatement),
                run: vi.fn(),
                first: mockFirst,
                all: vi.fn()
            }
            mockDB.prepare.mockReturnValue(mockStatement)

            await expect(getUserById(mockDB as any, userId)).rejects.toThrow('User not found')
        })
    })

    describe('getUserByUsername', () => {
        it('should return user when found and active', async () => {
            const username = 'testuser'
            const mockUser = {
                id: 123,
                username: 'testuser',
                email: 'test@example.com',
                display_name: 'Test User',
                role: 'agent',
                team_id: 1,
                team_name: 'Test Team',
                is_active: 1,
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z'
            }

            const mockFirst = vi.fn().mockResolvedValue(mockUser)
            const mockStatement = {
                bind: vi.fn(() => mockStatement),
                run: vi.fn(),
                first: mockFirst,
                all: vi.fn()
            }
            mockDB.prepare.mockReturnValue(mockStatement)

            const result = await getUserByUsername(mockDB as any, username)

            expect(result).toBeDefined()
            expect(result?.username).toBe(username)
            expect(mockStatement.bind).toHaveBeenCalledWith(username)
        })

        it('should return null when user not found', async () => {
            const username = 'nonexistent'
            const mockFirst = vi.fn().mockResolvedValue(null)
            const mockStatement = {
                bind: vi.fn(() => mockStatement),
                run: vi.fn(),
                first: mockFirst,
                all: vi.fn()
            }
            mockDB.prepare.mockReturnValue(mockStatement)

            const result = await getUserByUsername(mockDB as any, username)

            expect(result).toBeNull()
        })
    })

    describe('authenticateUser', () => {
        it('should call database with correct username', async () => {
            const username = 'testuser'
            const password = 'password123'
            const mockUser = {
                id: 123,
                username: 'testuser',
                email: 'test@example.com',
                display_name: 'Test User',
                role: 'agent',
                team_id: 1,
                team_name: 'Test Team',
                is_active: 1,
                password_hash: 'hashed-password',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z'
            }

            const mockFirst = vi.fn().mockResolvedValue(mockUser)
            const mockStatement = {
                bind: vi.fn(() => mockStatement),
                run: vi.fn(),
                first: mockFirst,
                all: vi.fn()
            }
            mockDB.prepare.mockReturnValue(mockStatement)

            // Mock password verification to return the same hash (password matches)
            const mockHash = new ArrayBuffer(32)
            vi.mocked(crypto.subtle.digest).mockResolvedValue(mockHash)

            const result = await authenticateUser(mockDB as any, username, password)

            expect(result).toBeDefined()
            expect(mockDB.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT'))
            expect(mockStatement.bind).toHaveBeenCalledWith(username)
        })

        it('should return null when user not found', async () => {
            const username = 'nonexistent'
            const password = 'password123'

            const mockFirst = vi.fn().mockResolvedValue(null)
            const mockStatement = {
                bind: vi.fn(() => mockStatement),
                run: vi.fn(),
                first: mockFirst,
                all: vi.fn()
            }
            mockDB.prepare.mockReturnValue(mockStatement)

            const result = await authenticateUser(mockDB as any, username, password)

            expect(result).toBeNull()
        })

        it('should return null when password is invalid', async () => {
            const username = 'testuser'
            const password = 'wrongpassword'
            const mockUser = {
                id: 123,
                username: 'testuser',
                password_hash: 'different-hash',
                is_active: 1
            }

            const mockFirst = vi.fn().mockResolvedValue(mockUser)
            const mockStatement = {
                bind: vi.fn(() => mockStatement),
                run: vi.fn(),
                first: mockFirst,
                all: vi.fn()
            }
            mockDB.prepare.mockReturnValue(mockStatement)

            // Mock password verification to return different hashes
            vi.mocked(crypto.subtle.digest)
                .mockResolvedValueOnce(new ArrayBuffer(32)) // for stored hash
                .mockResolvedValueOnce(new ArrayBuffer(16)) // for input password (different)

            const result = await authenticateUser(mockDB as any, username, password)

            expect(result).toBeNull()
        })
    })
})

describe('Auth Utils - Permission Functions', () => {
    const mockAdminUser: DbUser = {
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        displayName: 'Admin User',
        role: 'admin',
        teamId: 1,
        teamName: 'Admin Team',
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
    }

    const mockAgentUser: DbUser = {
        id: 2,
        username: 'agent',
        email: 'agent@example.com',
        displayName: 'Agent User',
        role: 'agent',
        teamId: 2,
        teamName: 'Support Team',
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
    }

    describe('hasPermission', () => {
        it('should allow admin to access any role', () => {
            expect(hasPermission(mockAdminUser, 'admin')).toBe(true)
            expect(hasPermission(mockAdminUser, 'agent')).toBe(true)
        })

        it('should allow agent to access agent role only', () => {
            expect(hasPermission(mockAgentUser, 'agent')).toBe(true)
            expect(hasPermission(mockAgentUser, 'admin')).toBe(false)
        })
    })

    describe('canAccessTeam', () => {
        it('should allow admin to access any team', () => {
            expect(canAccessTeam(mockAdminUser, 1)).toBe(true)
            expect(canAccessTeam(mockAdminUser, 2)).toBe(true)
            expect(canAccessTeam(mockAdminUser, 999)).toBe(true)
        })

        it('should allow agent to access only their team', () => {
            expect(canAccessTeam(mockAgentUser, 2)).toBe(true)
            expect(canAccessTeam(mockAgentUser, 1)).toBe(false)
            expect(canAccessTeam(mockAgentUser, 999)).toBe(false)
        })
    })
})

describe('Auth Utils - Session Management', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('createSession', () => {
        it('should create session with generated ID', async () => {
            const userId = 123
            const sessionData = { role: 'agent', teamId: 1 }

            const sessionId = await createSession(mockKV as any, userId, sessionData)

            expect(sessionId).toBeDefined()
            expect(typeof sessionId).toBe('string')
            expect(sessionId.length).toBe(32)
            expect(mockKV.put).toHaveBeenCalledWith(
                `session:${sessionId}`,
                expect.stringContaining('"userId":123'),
                { expirationTtl: 24 * 60 * 60 }
            )
        })

        it('should use custom expiration TTL', async () => {
            const userId = 123
            const sessionData = { role: 'agent' }
            const customTtl = 3600

            await createSession(mockKV as any, userId, sessionData, customTtl)

            expect(mockKV.put).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                { expirationTtl: customTtl }
            )
        })
    })

    describe('getSession', () => {
        it('should return session data when session exists', async () => {
            const sessionId = 'test-session-id'
            const sessionData = {
                userId: 123,
                role: 'agent',
                createdAt: '2024-01-01T00:00:00Z'
            }

            mockKV.get.mockResolvedValue(JSON.stringify(sessionData))

            const result = await getSession(mockKV as any, sessionId)

            expect(result).toEqual(sessionData)
            expect(mockKV.get).toHaveBeenCalledWith(`session:${sessionId}`)
        })

        it('should return null when session does not exist', async () => {
            const sessionId = 'nonexistent-session'

            mockKV.get.mockResolvedValue(null)

            const result = await getSession(mockKV as any, sessionId)

            expect(result).toBeNull()
        })
    })

    describe('deleteSession', () => {
        it('should delete session from KV store', async () => {
            const sessionId = 'test-session-id'

            await deleteSession(mockKV as any, sessionId)

            expect(mockKV.delete).toHaveBeenCalledWith(`session:${sessionId}`)
        })
    })
})