// Shared crypto utilities for system module
// Encryption/decryption helpers and KV credential retrieval

import type { Bindings } from '@/types'

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
    console.log(`Getting ${platform} credentials from KV...`)
    const encryptionKey = getEncryptionKey(env)
    console.log('Encryption key available:', !!encryptionKey)

    const credentialTypes = platform === 'line'
      ? ['channelId', 'channelSecret', 'accessToken']
      : ['appId', 'appSecret', 'pageId', 'pageToken']

    const credentials: any = {}

    for (const type of credentialTypes) {
      const key = `credentials:${platform}:${type}`
      console.log(`Retrieving KV key: ${key}`)

      const encryptedValue = await env.CACHE?.get(key)
      if (encryptedValue) {
        console.log(`Found encrypted value for ${key}, length:`, encryptedValue.length)
        try {
          credentials[type] = await decrypt(encryptedValue, encryptionKey)
          console.log(`Successfully decrypted ${key}`)
        } catch (decryptError) {
          console.error(`Failed to decrypt ${key}:`, decryptError)
          // Continue with other credentials even if one fails
        }
      } else {
        console.log(`No value found for KV key: ${key}`)
      }
    }

    console.log('Final credentials object keys:', Object.keys(credentials))
    return Object.keys(credentials).length > 0 ? credentials : null
  } catch (error) {
    console.error(`Failed to get ${platform} credentials from KV:`, error)
    return null
  }
}
