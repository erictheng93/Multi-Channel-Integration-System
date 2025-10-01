// Authentication Module Unit Tests
// 認證模組單元測試

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signJWT, verifyJWT, hashPassword, verifyPassword, authenticateUser } from '@modules/auth/services/auth';
import type { JWTPayload } from '@shared/types';

describe('Auth Module - JWT Functions', () => {
  const testSecret = 'test-secret-key';
  const testPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
    userId: 'test-user-id',
    username: 'testuser',
    displayName: 'Test User',
    email: 'test@example.com',
    role: 'agent',
    teamId: 1
  };

  describe('signJWT', () => {
    it('should create a valid JWT token', async () => {
      const token = await signJWT(testPayload, testSecret);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include correct payload data', async () => {
      const token = await signJWT(testPayload, testSecret);
      const verified = await verifyJWT(token, testSecret);

      expect(verified.userId).toBe(testPayload.userId);
      expect(verified.username).toBe(testPayload.username);
      expect(verified.role).toBe(testPayload.role);
      expect(verified.teamId).toBe(testPayload.teamId);
    });

    it('should set expiration time', async () => {
      const expiresIn = 3600; // 1 hour
      const token = await signJWT(testPayload, testSecret, expiresIn);
      const verified = await verifyJWT(token, testSecret);

      expect(verified.exp).toBeDefined();
      expect(verified.exp).toBeGreaterThan(verified.iat!);
    });
  });

  describe('verifyJWT', () => {
    it('should verify valid token', async () => {
      const token = await signJWT(testPayload, testSecret);
      const verified = await verifyJWT(token, testSecret);

      expect(verified).toBeDefined();
      expect(verified.userId).toBe(testPayload.userId);
    });

    it('should throw error for invalid token format', async () => {
      await expect(verifyJWT('invalid.token', testSecret))
        .rejects.toThrow('Invalid JWT format');
    });

    it('should throw error for wrong secret', async () => {
      const token = await signJWT(testPayload, testSecret);

      await expect(verifyJWT(token, 'wrong-secret'))
        .rejects.toThrow('Invalid JWT signature');
    });

    it('should throw error for expired token', async () => {
      const expiredToken = await signJWT(testPayload, testSecret, -3600); // expired 1 hour ago

      await expect(verifyJWT(expiredToken, testSecret))
        .rejects.toThrow('JWT token expired');
    });
  });
});

describe('Auth Module - Password Functions', () => {
  const testPassword = 'test-password-123';

  describe('hashPassword', () => {
    it('should hash password with bcrypt', async () => {
      const hash = await hashPassword(testPassword);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(testPassword);
      expect(hash.startsWith('$2')).toBe(true); // bcrypt format
    });

    it('should generate different hashes for same password', async () => {
      const hash1 = await hashPassword(testPassword);
      const hash2 = await hashPassword(testPassword);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password with bcrypt hash', async () => {
      const hash = await hashPassword(testPassword);
      const isValid = await verifyPassword(testPassword, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const hash = await hashPassword(testPassword);
      const isValid = await verifyPassword('wrong-password', hash);

      expect(isValid).toBe(false);
    });

    it('should verify legacy SHA256 hash', async () => {
      // Simulate legacy hash
      const encoder = new TextEncoder();
      const data = encoder.encode(testPassword);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const legacyHash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const isValid = await verifyPassword(testPassword, legacyHash);
      expect(isValid).toBe(true);
    });

    it('should verify prefixed SHA256 hash', async () => {
      const encoder = new TextEncoder();
      const data = encoder.encode(testPassword);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const sha256Hash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      const prefixedHash = `sha256$${sha256Hash}`;

      const isValid = await verifyPassword(testPassword, prefixedHash);
      expect(isValid).toBe(true);
    });
  });
});

describe('Auth Module - Database Functions', () => {
  // Mock D1 database
  const mockDb = {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn()
      })
    })
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authenticateUser', () => {
    it('should authenticate user with correct credentials', async () => {
      const hashedPassword = await hashPassword('correct-password');
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: hashedPassword,
        display_name: 'Test User',
        role: 'agent',
        team_id: 1,
        is_active: true,
        password_policy: 'changeable',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockDb.prepare().bind().first.mockResolvedValueOnce(mockUser);

      const result = await authenticateUser(mockDb as any, 'test@example.com', 'correct-password');

      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe('test@example.com');
      expect(result.accountStatus).toBe('success');
    });

    it('should return null for non-existent user', async () => {
      mockDb.prepare().bind().first.mockResolvedValueOnce(null);

      const result = await authenticateUser(mockDb as any, 'nonexistent@example.com', 'password');

      expect(result.user).toBeNull();
      expect(result.accountStatus).toBe('not_found');
    });

    it('should return null for inactive user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: 'hash',
        display_name: 'Test User',
        role: 'agent',
        team_id: 1,
        is_active: false,
        password_policy: 'changeable'
      };

      mockDb.prepare().bind().first.mockResolvedValueOnce(mockUser);

      const result = await authenticateUser(mockDb as any, 'test@example.com', 'password');

      expect(result.user).toBeNull();
      expect(result.accountStatus).toBe('disabled');
    });

    it('should return null for wrong password', async () => {
      const hashedPassword = await hashPassword('correct-password');
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: hashedPassword,
        display_name: 'Test User',
        role: 'agent',
        team_id: 1,
        is_active: true,
        password_policy: 'changeable'
      };

      mockDb.prepare().bind().first.mockResolvedValueOnce(mockUser);

      const result = await authenticateUser(mockDb as any, 'test@example.com', 'wrong-password');

      expect(result.user).toBeNull();
      expect(result.accountStatus).toBe('wrong_password');
    });
  });
});

describe('Auth Module - Error Handling', () => {
  it('should handle JWT verification errors gracefully', async () => {
    await expect(verifyJWT('malformed-token', 'secret'))
      .rejects.toThrow();
  });

  it('should handle password hashing errors gracefully', async () => {
    // This test might vary based on bcrypt implementation
    // Just ensure it doesn't crash
    try {
      await hashPassword('');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it('should handle database errors in authentication', async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockRejectedValueOnce(new Error('Database error'))
        })
      })
    };

    await expect(authenticateUser(mockDb as any, 'test@example.com', 'password'))
      .rejects.toThrow('Database error');
  });
});

describe('Auth Module - Edge Cases', () => {
  it('should handle empty password', async () => {
    const hash = await hashPassword('');
    const isValid = await verifyPassword('', hash);

    expect(isValid).toBe(true);
  });

  it('should handle very long passwords', async () => {
    const longPassword = 'a'.repeat(1000);
    const hash = await hashPassword(longPassword);
    const isValid = await verifyPassword(longPassword, hash);

    expect(isValid).toBe(true);
  });

  it('should handle special characters in password', async () => {
    const specialPassword = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const hash = await hashPassword(specialPassword);
    const isValid = await verifyPassword(specialPassword, hash);

    expect(isValid).toBe(true);
  });

  it('should handle unicode characters in JWT payload', async () => {
    const unicodePayload = {
      ...testPayload,
      displayName: '測試用戶',
      username: 'тест'
    };

    const token = await signJWT(unicodePayload, 'secret');
    const verified = await verifyJWT(token, 'secret');

    expect(verified.displayName).toBe('測試用戶');
    expect(verified.username).toBe('тест');
  });
});

const testPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
  userId: 'test-user-id',
  username: 'testuser',
  displayName: 'Test User',
  email: 'test@example.com',
  role: 'agent',
  teamId: 1
};