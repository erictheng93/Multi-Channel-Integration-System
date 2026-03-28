// Shared crypto utilities for system module
// Encryption/decryption helpers and KV credential retrieval

import type { Bindings } from '@/types'
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('CryptoUtils');

// Simplified encryption utility (same as credentials.ts)
export const decrypt = async (encryptedText: string, key: string): Promise<string> => {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const combined = new Uint8Array(
    atob(encryptedText).split('').map(char => char.charCodeAt(0))
  )

  const iv = combined.slice(0, 12)
  const encrypted = combined.slice(12)

  const keyData = encoder.encode(key.padEnd(32, '0').slice(0, 32))
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encrypted
  )

  return decoder.decode(decrypted)
}

// Get encryption key from environment
export const getEncryptionKey = (env: Bindings): string => {
  const key = env.JWT_SECRET || env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY or JWT_SECRET environment variable is not configured');
  }
  return key;
}

// Helper to retrieve credentials from KV
export const getCredentialsFromKV = async (env: Bindings, platform: 'line' | 'facebook') => {
  try {
    log.info(`Getting ${platform} credentials from KV...`)
    const encryptionKey = getEncryptionKey(env)
    log.debug('Encryption key available', { available: !!encryptionKey })

    const credentialTypes = platform === 'line'
      ? ['channelId', 'channelSecret', 'accessToken']
      : ['appId', 'appSecret', 'pageId', 'pageToken']

    const credentials: any = {}

    for (const type of credentialTypes) {
      const key = `credentials:${platform}:${type}`
      log.info(`Retrieving KV key: ${key}`)

      const encryptedValue = await env.CACHE?.get(key)
      if (encryptedValue) {
        log.info(`Found encrypted value for ${key}, length:`, { detail: encryptedValue.length })
        try {
          credentials[type] = await decrypt(encryptedValue, encryptionKey)
          log.info(`Successfully decrypted ${key}`)
        } catch (decryptError) {
          log.error(`Failed to decrypt ${key}:`, { detail: decryptError })
          // Continue with other credentials even if one fails
        }
      } else {
        log.info(`No value found for KV key: ${key}`)
      }
    }

    log.debug('Final credentials object keys', { keys: Object.keys(credentials) })
    return Object.keys(credentials).length > 0 ? credentials : null
  } catch (error) {
    log.error(`Failed to get ${platform} credentials from KV:`, {}, error instanceof Error ? error : new Error(String(error)))
    return null
  }
}
