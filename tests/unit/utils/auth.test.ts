import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
    signJWT,
    verifyJWT,
    hashPassword,
    verifyPassword,
    generateRandomString,
    createUser,
    getUserById,
    // getUserByUsername, // REMOVED: Function no longer exists - using email-based auth
    authenticateUser,
    hasPermission,
    canAccessTeam,
    createSession,
    getSession,
    deleteSession
} from '@backend/utils/auth'
import type { DbUser } from '@backend/types'
import { createMockDatabase, createMockStatement } from '../../helpers/mockDatabase'
import { createMockKV } from '../../helpers/mockKV'
import {
    mockJWTPayloads,
    testPasswords,
    testSecrets
} from '../../helpers/testData'

// ✅ Crypto API is already mocked globally in vitest.setup.backend.ts
// No need to override it here - use the global webcrypto polyfill

// Create mock instances
const mockDB = createMockDatabase()
const mockKV = createMockKV()

describe('Auth Utils - JWT Functions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockDB.reset()
        mockKV.reset()

        // Setup crypto spies for tests that need to mock crypto operations
        // Since we're using real Node.js webcrypto, we need to spy on the functions
        vi.spyOn(crypto.subtle, 'importKey')
        vi.spyOn(crypto.subtle, 'sign')
        vi.spyOn(crypto.subtle, 'verify')
        vi.spyOn(crypto.subtle, 'digest')
    })

    describe('signJWT', () => {
        test('should create a valid JWT token', async () => {
            // Mock crypto operations
            vi.mocked(crypto.subtle.importKey).mockResolvedValue('mock-key' as any)
            vi.mocked(crypto.subtle.sign).mockResolvedValue(new ArrayBuffer(32))

            const token = await signJWT(mockJWTPayloads.agent, testSecrets.jwt)

            expect(token).toBeDefined()
            expect(typeof token).toBe('string')
            expect(token.spltest('.')).toHaveLength(3)
            expect(crypto.subtle.importKey).toHaveBeenCalledWith(
                'raw',
                expect.any(Uint8Array),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign']
            )
        })

        test('should include expiration time in payload', async () => {
            vi.mocked(crypto.subtle.importKey).mockResolvedValue('mock-key' as any)
            vi.mocked(crypto.subtle.sign).mockResolvedValue(new ArrayBuffer(32))

            const expiresIn = 3600 // 1 hour
            const token = await signJWT(mockJWTPayloads.agent, testSecrets.jwt, expiresIn)

            // Decode payload to check expiration
            const parts = token.spltest('.')
            const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
            const paddedPayload = payloadB64.padEnd(payloadB64.length + (4 - payloadB64.length % 4) % 4, '=')
            const decodedPayload = JSON.parse(atob(paddedPayload))

            expect(decodedPayload.exp).toBeDefined()
            expect(decodedPayload.iat).toBeDefined()
            expect(decodedPayload.userId).toBe(mockJWTPayloads.agent.userId)
            expect(decodedPayload.role).toBe(mockJWTPayloads.agent.role)
        })

        test('should handle empty secret gracefully', async () => {
            vi.mocked(crypto.subtle.importKey).mockRejectedValue(new Error('Empty secret'))

            await expect(signJWT(mockJWTPayloads.agent, testSecrets.empty))
                .rejects.toThrow()
        })
    })

    describe('verifyJWT', () => {
        test('should verify a valid JWT token', async () => {
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

        test('should throw error for invalid JWT format', async () => {
            const invalidToken = 'invalid.token'

            await expect(verifyJWT(invalidToken, testSecrets.jwt)).rejects.toThrow('Invalid JWT format')
        })

        test('should throw error for malformed token parts', async () => {
            const malformedToken = 'part1.part2'

            await expect(verifyJWT(malformedToken, testSecrets.jwt)).rejects.toThrow('Invalid JWT format')
        })

        test('should throw error for invalid signature', async () => {
            const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
            const payload = btoa(JSON.stringify({ userId: 1, role: 'agent' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
            const signature = btoa('invalid-signature').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
            const tokenWithInvalidSignature = `${header}.${payload}.${signature}`

            vi.mocked(crypto.subtle.importKey).mockResolvedValue('mock-key' as any)
            vi.mocked(crypto.subtle.verify).mockResolvedValue(false)

            await expect(verifyJWT(tokenWithInvalidSignature, testSecrets.jwt)).rejects.toThrow('Invalid JWT signature')
        })

        test('should throw error for expired token', async () => {
            const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
            const payload = btoa(JSON.stringify({ userId: 1, role: 'agent', iat: 1600000000, exp: 1600000000 })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
            const signature = btoa('mock-signature').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
            const expiredToken = `${header}.${payload}.${signature}`

            vi.mocked(crypto.subtle.importKey).mockResolvedValue('mock-key' as any)
            vi.mocked(crypto.subtle.verify).mockResolvedValue(true)

            await expect(verifyJWT(expiredToken, testSecrets.jwt)).rejects.toThrow('JWT token expired')
        })

        test('should handle crypto errors gracefully', async () => {
            const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGUiOiJhZ2VudCJ9.signature'

            vi.mocked(crypto.subtle.importKey).mockRejectedValue(new Error('Crypto error'))

            await expect(verifyJWT(validToken, testSecrets.jwt)).rejects.toThrow('JWT verification failed')
        })
    })
})

describe('Auth Utils - Password Functions', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        // Setup crypto spies for password hashing tests
        vi.spyOn(crypto.subtle, 'digest')
    })

    describe('hashPassword', () => {
        test('should hash password correctly', async () => {
            // hashPassword uses bcrypt, not crypto.subtle.digest
            const hashedPassword = await hashPassword(testPasswords.valid)

            expect(hashedPassword).toBeDefined()
            expect(typeof hashedPassword).toBe('string')
            expect(hashedPassword.length).toBe(60) // bcrypt produces 60-character hashes
            expect(hashedPassword).toMatch(/^\$2[aby]\$/) // bcrypt hash format
        })

        test('should produce different salts for same password', async () => {
            // bcrypt uses random salts, so same password produces different hashes
            const hash1 = await hashPassword(testPasswords.valid)
            const hash2 = await hashPassword(testPasswords.valid)

            expect(hash1).not.toBe(hash2) // Different salts = different hashes
            expect(hash1).toMatch(/^\$2[aby]\$/) // But both are valid bcrypt hashes
            expect(hash2).toMatch(/^\$2[aby]\$/)
        })

        test('should handle empty password', async () => {
            // bcrypt can hash empty strings
            const hashedPassword = await hashPassword(testPasswords.empty)

            expect(hashedPassword).toBeDefined()
            expect(typeof hashedPassword).toBe('string')
            expect(hashedPassword.length).toBe(60) // bcrypt always produces 60-character hashes
            expect(hashedPassword).toMatch(/^\$2[aby]\$/)
        })

        test('should handle very long password', async () => {
            // bcrypt can hash long passwords
            const hashedPassword = await hashPassword(testPasswords.long)

            expect(hashedPassword).toBeDefined()
            expect(typeof hashedPassword).toBe('string')
            expect(hashedPassword.length).toBe(60) // bcrypt always produces 60-character hashes
            expect(hashedPassword).toMatch(/^\$2[aby]\$/)
        })
    })

    describe('verifyPassword', () => {
        test('should verify correct password', async () => {
            const password = testPasswords.valid

            // Create actual bcrypt hash
            const correctHash = await hashPassword(password)

            // Verify password matches the hash
            const isValid = await verifyPassword(password, correctHash)

            expect(isValid).toBe(true)
        })

        test('should reject incorrect password', async () => {
            const correctPassword = testPasswords.valid
            const wrongPassword = 'wrongpassword'

            // Create actual bcrypt hash for correct password
            const correctHash = await hashPassword(correctPassword)

            // Try to verify with wrong password
            const isValid = await verifyPassword(wrongPassword, correctHash)

            expect(isValid).toBe(false)
        })
    })
})

describe('Auth Utils - Utility Functions', () => {
    describe('generateRandomString', () => {
        test('should generate string of specified length', () => {
            const length = 16
            const randomString = generateRandomString(length)

            expect(randomString).toBeDefined()
            expect(randomString.length).toBe(length)
            expect(typeof randomString).toBe('string')
        })

        test('should generate different strings on multiple calls', () => {
            const string1 = generateRandomString(32)
            const string2 = generateRandomString(32)

            expect(string1).not.toBe(string2)
        })

        test('should use default length of 32 when no length specified', () => {
            const randomString = generateRandomString()

            expect(randomString.length).toBe(32)
        })
    })
})

describe('Auth Utils - Database User Operations', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        // Setup crypto spies for authentication tests
        vi.spyOn(crypto.subtle, 'digest')
    })

    // SKIPPED: Old mock-based tests replaced by DatabaseTestEnvironment tests below
    describe.skip('createUser', () => {
        test('should call database with correct parameters', async () => {
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

            // Mock database operations (bcrypt hashing happens internally)
            const mockRun = vi.fn().mockResolvedValue(mockResult)
            const mockFirst = vi.fn().mockResolvedValue(mockUser)
            const mockStatement = createMockStatement({
                run: mockRun,
                first: mockFirst
            })
            mockDB.prepare.mockReturnValue(mockStatement as any)

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

        test('should throw error when database insert fails', async () => {
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'password123',
                displayName: 'Test User',
                role: 'agent' as const
            }

            const mockResult = { success: false }
            const mockRun = vi.fn().mockResolvedValue(mockResult)
            const mockStatement = createMockStatement({
                run: mockRun
            })
            mockDB.prepare.mockReturnValue(mockStatement as any)

            // bcrypt hashing happens internally, no need to mock crypto

            await expect(createUser(mockDB as any, userData)).rejects.toThrow('Failed to retrieve created user')
        })
    })

    // SKIPPED: Old mock-based tests replaced by DatabaseTestEnvironment tests below
    describe.skip('getUserById', () => {
        test('should return user when found', async () => {
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
            const mockStatement = createMockStatement({
                first: mockFirst
            })
            mockDB.prepare.mockReturnValue(mockStatement as any)

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

        test('should throw error when user not found', async () => {
            const userId = 999
            const mockFirst = vi.fn().mockResolvedValue(null)
            const mockStatement = createMockStatement({
                first: mockFirst
            })
            mockDB.prepare.mockReturnValue(mockStatement as any)

            await expect(getUserById(mockDB as any, userId)).rejects.toThrow('User not found')
        })
    })

    // SKIPPED: getUserByUsername function has been removed
    // The system now uses email-based authentication instead of username
    describe.skip('getUserByUsername (DEPRECATED)', () => {
        test('should return user when found and active', async () => {
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
            const mockStatement = createMockStatement({
                first: mockFirst
            })
            mockDB.prepare.mockReturnValue(mockStatement as any)

            const result = await getUserByUsername(mockDB as any, username)

            expect(result).toBeDefined()
            expect(result?.username).toBe(username)
            expect(mockStatement.bind).toHaveBeenCalledWith(username)
        })

        test('should return null when user not found', async () => {
            const username = 'nonexistent'
            const mockFirst = vi.fn().mockResolvedValue(null)
            const mockStatement = createMockStatement({
                first: mockFirst
            })
            mockDB.prepare.mockReturnValue(mockStatement as any)

            const result = await getUserByUsername(mockDB as any, username)

            // getUserByUsername correctly returns null when user not found
            expect(result).toBeNull()
        })
    })

    describe('authenticateUser', () => {
        test('should call database with correct username', async () => {
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
            const mockStatement = createMockStatement({
                first: mockFirst
            })
            mockDB.prepare.mockReturnValue(mockStatement as any)

            // Mock password verification to return the same hash (password matches)
            const mockHash = new ArrayBuffer(32)
            vi.mocked(crypto.subtle.digest).mockResolvedValue(mockHash)

            const result = await authenticateUser(mockDB as any, username, password)

            expect(result).toBeDefined()
            expect(mockDB.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT'))
            expect(mockStatement.bind).toHaveBeenCalledWith(username)
        })

        test('should return null when user not found', async () => {
            const username = 'nonexistent'
            const password = 'password123'

            const mockFirst = vi.fn().mockResolvedValue(null)
            const mockStatement = createMockStatement({
                first: mockFirst
            })
            mockDB.prepare.mockReturnValue(mockStatement as any)

            const result = await authenticateUser(mockDB as any, username, password)

            // Updated: authenticateUser now returns an object with accountStatus
            expect(result).toEqual({
                accountStatus: 'not_found',
                user: null
            })
        })

        test('should return null when password is invalid', async () => {
            const username = 'testuser'
            const password = 'wrongpassword'
            const mockUser = {
                id: 123,
                username: 'testuser',
                password_hash: 'different-hash',
                is_active: 1
            }

            const mockFirst = vi.fn().mockResolvedValue(mockUser)
            const mockStatement = createMockStatement({
                first: mockFirst
            })
            mockDB.prepare.mockReturnValue(mockStatement as any)

            // Mock password verification to return different hashes
            vi.mocked(crypto.subtle.digest)
                .mockResolvedValueOnce(new ArrayBuffer(32)) // for stored hash
                .mockResolvedValueOnce(new ArrayBuffer(16)) // for input password (different)

            const result = await authenticateUser(mockDB as any, username, password)

            // Updated: authenticateUser now returns an object with accountStatus
            expect(result).toEqual({
                accountStatus: 'wrong_password',
                passwordPolicy: 'changeable',
                user: null
            })
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
        test('should allow admin to access any role', () => {
            expect(hasPermission(mockAdminUser, 'admin')).toBe(true)
            expect(hasPermission(mockAdminUser, 'agent')).toBe(true)
        })

        test('should allow agent to access agent role only', () => {
            expect(hasPermission(mockAgentUser, 'agent')).toBe(true)
            expect(hasPermission(mockAgentUser, 'admin')).toBe(false)
        })
    })

    describe('canAccessTeam', () => {
        test('should allow admin to access any team', () => {
            expect(canAccessTeam(mockAdminUser, 1)).toBe(true)
            expect(canAccessTeam(mockAdminUser, 2)).toBe(true)
            expect(canAccessTeam(mockAdminUser, 999)).toBe(true)
        })

        test('should allow agent to access only their team', () => {
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
        test('should create session with generated ID', async () => {
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

        test('should use custom expiration TTL', async () => {
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
        test('should return session data when session exists', async () => {
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

        test('should return null when session does not exist', async () => {
            const sessionId = 'nonexistent-session'

            mockKV.get.mockResolvedValue(null)

            const result = await getSession(mockKV as any, sessionId)

            expect(result).toBeNull()
        })
    })

    describe('deleteSession', () => {
        test('should delete session from KV store', async () => {
            const sessionId = 'test-session-id'

            await deleteSession(mockKV as any, sessionId)

            expect(mockKV.delete).toHaveBeenCalledWith(`session:${sessionId}`)
        })
    })
})
// ====================================================================================
// Database Integration Tests with Real SQLite (DatabaseTestEnvironment)
// These tests use real database queries instead of mocking Drizzle ORM
// ====================================================================================

import { DatabaseTestEnvironment } from '../../helpers/DatabaseTestEnvironment'

describe('Auth Utils - Database Integration Tests (Real SQLite)', () => {
    let testEnv: DatabaseTestEnvironment
    let testDb: any

    beforeEach(() => {
        testEnv = new DatabaseTestEnvironment()
        testDb = testEnv.getMockD1Database()
    })

    afterEach(() => {
        testEnv.close()
    })

    describe('createUser with real database', () => {
        test('should create user successfully', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'password123',
                displayName: 'Test User',
                role: 'agent' as const,
                teamId: undefined
            }

            const createdUser = await createUser(testDb, userData)

            expect(createdUser).toBeDefined()
            expect(createdUser.email).toBe('test@example.com')
            expect(createdUser.displayName).toBe('Test User')
            expect(createdUser.role).toBe('agent')
            expect(createdUser.id).toBeDefined()
        })

        test('should throw error when email already exists', async () => {
            const userData = {
                email: 'duplicate@example.com',
                password: 'password123',
                displayName: 'Test User 1',
                role: 'agent' as const,
                teamId: undefined
            }

            // Create first user
            await createUser(testDb, userData)

            // Try to create duplicate
            const duplicateData = {
                ...userData,
                displayName: 'Test User 2'
            }

            await expect(createUser(testDb, duplicateData))
                .rejects.toThrow()
        })
    })

    describe('getUserById with real database', () => {
        test('should return user when found', async () => {
            // Create a test user first
            const userData = {
                email: 'findme@example.com',
                password: 'password123',
                displayName: 'Find Me',
                role: 'agent' as const,
                teamId: undefined
            }

            const createdUser = await createUser(testDb, userData)

            // Now find the user
            const foundUser = await getUserById(testDb, createdUser.id)

            expect(foundUser).toBeDefined()
            expect(foundUser.id).toBe(createdUser.id)
            expect(foundUser.email).toBe('findme@example.com')
            expect(foundUser.displayName).toBe('Find Me')
        })

        test('should throw error when user not found', async () => {
            await expect(getUserById(testDb, 'nonexistent-id'))
                .rejects.toThrow('User not found')
        })
    })
})
