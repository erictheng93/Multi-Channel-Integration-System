/**
 * Encryption Service
 * Handles encryption and decryption of sensitive data like API keys and tokens
 *
 * Security Features:
 * - AES-256-GCM encryption
 * - Random IV for each encryption
 * - Authentication tags for integrity verification
 * - Base64 encoding for storage
 */

export interface EncryptedData {
  encrypted: string;  // Base64 encoded encrypted data
  iv: string;        // Base64 encoded initialization vector
  tag: string;       // Base64 encoded authentication tag
}

export class EncryptionService {
  private encryptionKey: CryptoKey | null = null;

  /**
   * Initialize the encryption service with the encryption key
   * @param keyString - Base64 encoded encryption key from environment
   */
  async initialize(keyString: string): Promise<void> {
    try {
      // Decode the base64 key
      const keyData = this.base64ToArrayBuffer(keyString);

      // Import the key for AES-GCM encryption
      this.encryptionKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      console.error('[EncryptionService] Failed to initialize encryption key:', error);
      throw new Error('Failed to initialize encryption service');
    }
  }

  /**
   * Encrypt sensitive data
   * @param plaintext - The data to encrypt
   * @returns Encrypted data with IV and authentication tag
   */
  async encrypt(plaintext: string): Promise<EncryptedData> {
    if (!this.encryptionKey) {
      throw new Error('Encryption service not initialized. Call initialize() first.');
    }

    try {
      // Generate a random IV (12 bytes for GCM)
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // Convert plaintext to ArrayBuffer
      const data = new TextEncoder().encode(plaintext);

      // Encrypt the data
      const encrypted = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: 128 // 128-bit authentication tag
        },
        this.encryptionKey,
        data
      );

      // Split the encrypted data and authentication tag
      // The last 16 bytes are the authentication tag
      const encryptedArray = new Uint8Array(encrypted);
      const ciphertext = encryptedArray.slice(0, -16);
      const tag = encryptedArray.slice(-16);

      return {
        encrypted: this.arrayBufferToBase64(ciphertext.buffer),
        iv: this.arrayBufferToBase64(iv.buffer),
        tag: this.arrayBufferToBase64(tag.buffer)
      };
    } catch (error) {
      console.error('[EncryptionService] Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt encrypted data
   * @param encryptedData - The encrypted data object
   * @returns Decrypted plaintext
   */
  async decrypt(encryptedData: EncryptedData): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption service not initialized. Call initialize() first.');
    }

    try {
      // Decode base64 strings
      const iv = this.base64ToArrayBuffer(encryptedData.iv);
      const ciphertext = this.base64ToArrayBuffer(encryptedData.encrypted);
      const tag = this.base64ToArrayBuffer(encryptedData.tag);

      // Combine ciphertext and tag for decryption
      const combined = new Uint8Array(ciphertext.byteLength + tag.byteLength);
      combined.set(new Uint8Array(ciphertext), 0);
      combined.set(new Uint8Array(tag), ciphertext.byteLength);

      // Decrypt the data
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: new Uint8Array(iv),
          tagLength: 128
        },
        this.encryptionKey,
        combined
      );

      // Convert decrypted data back to string
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('[EncryptionService] Decryption failed:', error);
      throw new Error('Failed to decrypt data - data may be corrupted or key is incorrect');
    }
  }

  /**
   * Encrypt data if encryption is available, otherwise return plaintext
   * This allows graceful degradation if encryption is not set up
   * @param plaintext - The data to encrypt
   * @returns Encrypted data or plaintext if encryption unavailable
   */
  async encryptIfAvailable(plaintext: string): Promise<string | EncryptedData> {
    if (!this.encryptionKey) {
      console.warn('[EncryptionService] Encryption not available, storing plaintext');
      return plaintext;
    }
    return this.encrypt(plaintext);
  }

  /**
   * Decrypt data if it's encrypted, otherwise return as-is
   * @param data - Either encrypted data object or plaintext string
   * @returns Decrypted plaintext
   */
  async decryptIfEncrypted(data: string | EncryptedData): Promise<string> {
    // Check if data is encrypted (has the expected structure)
    if (typeof data === 'object' && data.encrypted && data.iv && data.tag) {
      return this.decrypt(data);
    }

    // Data is plaintext (backward compatibility)
    return String(data);
  }

  /**
   * Check if the service is initialized and ready to use
   */
  isInitialized(): boolean {
    return this.encryptionKey !== null;
  }

  // Helper methods for base64 encoding/decoding
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

/**
 * Generate a new encryption key (for setup/migration)
 * Returns a base64-encoded 256-bit key
 */
export async function generateEncryptionKey(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const exported = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

/**
 * Singleton instance for the encryption service
 */
let encryptionServiceInstance: EncryptionService | null = null;

/**
 * Get or create the global encryption service instance
 * @param encryptionKey - Base64 encoded encryption key (required on first call)
 */
export async function getEncryptionService(encryptionKey?: string): Promise<EncryptionService> {
  if (!encryptionServiceInstance) {
    if (!encryptionKey) {
      throw new Error('Encryption key required for first initialization');
    }

    encryptionServiceInstance = new EncryptionService();
    await encryptionServiceInstance.initialize(encryptionKey);
  }

  return encryptionServiceInstance;
}

/**
 * Reset the encryption service instance (for testing)
 */
export function resetEncryptionService(): void {
  encryptionServiceInstance = null;
}
