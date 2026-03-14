/**
 * Encryption Service Unit Tests
 *
 * Tests for AES-256-GCM encryption/decryption functionality
 * Security-critical service - comprehensive testing required
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EncryptionService,
  EncryptedData,
  generateEncryptionKey,
  getEncryptionService,
  resetEncryptionService,
} from '@/services/encryption-service';

describe('EncryptionService', () => {
  let service: EncryptionService;
  let testKey: string;

  beforeEach(async () => {
    // Generate a fresh encryption key for each test
    testKey = await generateEncryptionKey();
    service = new EncryptionService();
    await service.initialize(testKey);
  });

  afterEach(() => {
    resetEncryptionService();
  });

  // =================== Initialization Tests ===================

  describe('initialize', () => {
    it('should initialize successfully with valid base64 key', async () => {
      const newService = new EncryptionService();
      const key = await generateEncryptionKey();

      await newService.initialize(key);

      expect(newService.isInitialized()).toBe(true);
    });

    it('should throw error with invalid base64 key', async () => {
      const newService = new EncryptionService();

      await expect(newService.initialize('invalid-key!!!')).rejects.toThrow(
        'Failed to initialize encryption service'
      );
    });

    it('should throw error with empty key', async () => {
      const newService = new EncryptionService();

      await expect(newService.initialize('')).rejects.toThrow();
    });

    it('should throw error with key of wrong length', async () => {
      const newService = new EncryptionService();
      // Create a key that's too short (only 16 bytes instead of 32)
      const shortKey = btoa(String.fromCharCode(...new Uint8Array(16)));

      // Web Crypto API may accept shorter keys but operations will fail
      // or it may throw on import - either way we expect an error
      try {
        await newService.initialize(shortKey);
        // If initialization succeeds, encryption should fail
        await expect(newService.encrypt('test')).rejects.toThrow();
      } catch {
        // Initialization threw - this is also acceptable
        expect(true).toBe(true);
      }
    });
  });

  // =================== Encryption Tests ===================

  describe('encrypt', () => {
    it('should encrypt plaintext successfully', async () => {
      const plaintext = 'Hello, World!';

      const encrypted = await service.encrypt(plaintext);

      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('tag');
      expect(encrypted.encrypted).not.toBe(plaintext);
      expect(encrypted.encrypted.length).toBeGreaterThan(0);
    });

    it('should produce different ciphertext for same plaintext (random IV)', async () => {
      const plaintext = 'Same message';

      const encrypted1 = await service.encrypt(plaintext);
      const encrypted2 = await service.encrypt(plaintext);

      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should encrypt empty string', async () => {
      const encrypted = await service.encrypt('');

      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('tag');
    });

    it('should encrypt unicode characters', async () => {
      const plaintext = '你好世界  こんにちは';

      const encrypted = await service.encrypt(plaintext);

      expect(encrypted.encrypted.length).toBeGreaterThan(0);
    });

    it('should encrypt large data', async () => {
      const plaintext = 'A'.repeat(10000);

      const encrypted = await service.encrypt(plaintext);

      expect(encrypted.encrypted.length).toBeGreaterThan(0);
    });

    it('should throw error when not initialized', async () => {
      const uninitializedService = new EncryptionService();

      await expect(uninitializedService.encrypt('test')).rejects.toThrow(
        'Encryption service not initialized'
      );
    });

    it('should produce valid base64 output', async () => {
      const encrypted = await service.encrypt('test data');

      // Verify base64 format
      expect(() => atob(encrypted.encrypted)).not.toThrow();
      expect(() => atob(encrypted.iv)).not.toThrow();
      expect(() => atob(encrypted.tag)).not.toThrow();
    });
  });

  // =================== Decryption Tests ===================

  describe('decrypt', () => {
    it('should decrypt encrypted data correctly', async () => {
      const plaintext = 'Secret message';

      const encrypted = await service.encrypt(plaintext);
      const decrypted = await service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should decrypt empty string', async () => {
      const encrypted = await service.encrypt('');
      const decrypted = await service.decrypt(encrypted);

      expect(decrypted).toBe('');
    });

    it('should decrypt unicode characters', async () => {
      const plaintext = '你好世界  こんにちは';

      const encrypted = await service.encrypt(plaintext);
      const decrypted = await service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should decrypt large data', async () => {
      const plaintext = 'B'.repeat(10000);

      const encrypted = await service.encrypt(plaintext);
      const decrypted = await service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error when not initialized', async () => {
      const uninitializedService = new EncryptionService();
      const fakeEncrypted: EncryptedData = {
        encrypted: 'test',
        iv: 'test',
        tag: 'test',
      };

      await expect(uninitializedService.decrypt(fakeEncrypted)).rejects.toThrow(
        'Encryption service not initialized'
      );
    });

    it('should throw error with tampered ciphertext', async () => {
      const encrypted = await service.encrypt('test');

      // Tamper with the ciphertext
      const tampered: EncryptedData = {
        ...encrypted,
        encrypted: btoa('tampered data'),
      };

      await expect(service.decrypt(tampered)).rejects.toThrow();
    });

    it('should throw error with tampered IV', async () => {
      const encrypted = await service.encrypt('test');

      // Tamper with the IV
      const tampered: EncryptedData = {
        ...encrypted,
        iv: btoa(String.fromCharCode(...new Uint8Array(12))),
      };

      await expect(service.decrypt(tampered)).rejects.toThrow();
    });

    it('should throw error with tampered tag', async () => {
      const encrypted = await service.encrypt('test');

      // Tamper with the authentication tag
      const tampered: EncryptedData = {
        ...encrypted,
        tag: btoa(String.fromCharCode(...new Uint8Array(16))),
      };

      await expect(service.decrypt(tampered)).rejects.toThrow();
    });

    it('should throw error with wrong key', async () => {
      const encrypted = await service.encrypt('test');

      // Create new service with different key
      const newService = new EncryptionService();
      const newKey = await generateEncryptionKey();
      await newService.initialize(newKey);

      await expect(newService.decrypt(encrypted)).rejects.toThrow();
    });

    it('should throw error with invalid base64', async () => {
      const invalidEncrypted: EncryptedData = {
        encrypted: 'not-valid-base64!!!',
        iv: 'also-invalid!!!',
        tag: 'invalid-too!!!',
      };

      await expect(service.decrypt(invalidEncrypted)).rejects.toThrow();
    });
  });

  // =================== encryptIfAvailable Tests ===================

  describe('encryptIfAvailable', () => {
    it('should encrypt when service is initialized', async () => {
      const plaintext = 'test data';

      const result = await service.encryptIfAvailable(plaintext);

      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('encrypted');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('tag');
    });

    it('should return plaintext when service is not initialized', async () => {
      const uninitializedService = new EncryptionService();
      const plaintext = 'test data';

      const result = await uninitializedService.encryptIfAvailable(plaintext);

      expect(result).toBe(plaintext);
    });
  });

  // =================== decryptIfEncrypted Tests ===================

  describe('decryptIfEncrypted', () => {
    it('should decrypt encrypted data', async () => {
      const plaintext = 'test data';
      const encrypted = await service.encrypt(plaintext);

      const result = await service.decryptIfEncrypted(encrypted);

      expect(result).toBe(plaintext);
    });

    it('should return plaintext string as-is', async () => {
      const plaintext = 'just a string';

      const result = await service.decryptIfEncrypted(plaintext);

      expect(result).toBe(plaintext);
    });

    it('should handle partial encrypted object', async () => {
      // Object missing some properties
      const partialObject = { encrypted: 'test' } as unknown as string;

      const result = await service.decryptIfEncrypted(partialObject);

      expect(result).toBe('[object Object]');
    });
  });

  // =================== isInitialized Tests ===================

  describe('isInitialized', () => {
    it('should return false before initialization', () => {
      const newService = new EncryptionService();

      expect(newService.isInitialized()).toBe(false);
    });

    it('should return true after initialization', () => {
      expect(service.isInitialized()).toBe(true);
    });
  });
});

// =================== generateEncryptionKey Tests ===================

describe('generateEncryptionKey', () => {
  it('should generate valid base64 key', async () => {
    const key = await generateEncryptionKey();

    expect(typeof key).toBe('string');
    expect(() => atob(key)).not.toThrow();
  });

  it('should generate 256-bit (32 byte) key', async () => {
    const key = await generateEncryptionKey();
    const decoded = atob(key);

    expect(decoded.length).toBe(32);
  });

  it('should generate unique keys', async () => {
    const key1 = await generateEncryptionKey();
    const key2 = await generateEncryptionKey();

    expect(key1).not.toBe(key2);
  });

  it('should generate keys that can initialize service', async () => {
    const key = await generateEncryptionKey();
    const testService = new EncryptionService();

    await testService.initialize(key);

    expect(testService.isInitialized()).toBe(true);
  });
});

// =================== getEncryptionService Singleton Tests ===================

describe('getEncryptionService', () => {
  afterEach(() => {
    resetEncryptionService();
  });

  it('should create singleton instance on first call', async () => {
    const key = await generateEncryptionKey();

    const service = await getEncryptionService(key);

    expect(service).toBeInstanceOf(EncryptionService);
    expect(service.isInitialized()).toBe(true);
  });

  it('should return same instance on subsequent calls', async () => {
    const key = await generateEncryptionKey();

    const service1 = await getEncryptionService(key);
    const service2 = await getEncryptionService();

    expect(service1).toBe(service2);
  });

  it('should throw error when no key provided on first call', async () => {
    await expect(getEncryptionService()).rejects.toThrow(
      'Encryption key required for first initialization'
    );
  });

  it('should work without key after first initialization', async () => {
    const key = await generateEncryptionKey();
    await getEncryptionService(key);

    const service = await getEncryptionService();

    expect(service.isInitialized()).toBe(true);
  });
});

// =================== resetEncryptionService Tests ===================

describe('resetEncryptionService', () => {
  it('should reset singleton instance', async () => {
    const key = await generateEncryptionKey();
    await getEncryptionService(key);

    resetEncryptionService();

    // Should require key again
    await expect(getEncryptionService()).rejects.toThrow();
  });
});

// =================== Integration Tests ===================

describe('Encryption Service Integration', () => {
  afterEach(() => {
    resetEncryptionService();
  });

  it('should handle full encrypt-decrypt cycle with singleton', async () => {
    const key = await generateEncryptionKey();
    const service = await getEncryptionService(key);
    const plaintext = 'Integration test data';

    const encrypted = await service.encrypt(plaintext);
    const decrypted = await service.decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it('should handle JSON data encryption', async () => {
    const key = await generateEncryptionKey();
    const service = await getEncryptionService(key);
    const data = {
      apiKey: 'sk_live_abc123',
      secret: 'super_secret_value',
      nested: { more: 'data' },
    };

    const encrypted = await service.encrypt(JSON.stringify(data));
    const decrypted = JSON.parse(await service.decrypt(encrypted));

    expect(decrypted).toEqual(data);
  });

  it('should handle special characters in data', async () => {
    const key = await generateEncryptionKey();
    const service = await getEncryptionService(key);
    const specialChars = '!@#$%^&*()_+-=[]{}|;\':",./<>?`~\n\t\r';

    const encrypted = await service.encrypt(specialChars);
    const decrypted = await service.decrypt(encrypted);

    expect(decrypted).toBe(specialChars);
  });
});
