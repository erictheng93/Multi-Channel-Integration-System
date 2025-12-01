// Webhook Signature Verification Service
// 統一的 webhook 簽名驗證服務 - 從多個 handler 提取重複代碼

export type WebhookPlatform = 'line' | 'facebook' | 'instagram';

export interface SignatureVerificationResult {
  valid: boolean;
  error?: string;
  platform: WebhookPlatform;
}

/**
 * Unified webhook signature verification
 * Consolidates duplicate signature verification from:
 * - src/handlers/webhook.ts (lines 203-222)
 * - src/modules/integrations/services/webhook-security-service.ts (lines 312-433)
 */
export async function verifyWebhookSignature(
  platform: WebhookPlatform,
  body: string,
  headers: Record<string, string>,
  secret: string
): Promise<SignatureVerificationResult> {
  switch (platform) {
    case 'line':
      return verifyLineSignature(body, headers, secret);
    case 'facebook':
    case 'instagram':
      return verifyFacebookSignature(body, headers, secret);
    default:
      return { valid: false, error: `Unsupported platform: ${platform}`, platform };
  }
}

/**
 * LINE webhook signature verification
 * Uses HMAC-SHA256 with Base64 encoding
 */
async function verifyLineSignature(
  body: string,
  headers: Record<string, string>,
  channelSecret: string
): Promise<SignatureVerificationResult> {
  const signature = headers['x-line-signature'] || headers['X-Line-Signature'];

  if (!signature) {
    return {
      valid: false,
      error: 'Missing X-Line-Signature header',
      platform: 'line'
    };
  }

  if (!channelSecret) {
    return {
      valid: false,
      error: 'Missing LINE channel secret',
      platform: 'line'
    };
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(channelSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(body)
    );

    const calculatedSignature = btoa(
      String.fromCharCode(...new Uint8Array(signatureBuffer))
    );

    const isValid = timingSafeEqual(calculatedSignature, signature);

    return {
      valid: isValid,
      error: isValid ? undefined : 'Invalid signature',
      platform: 'line'
    };
  } catch (error) {
    console.error('LINE signature verification error:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Signature verification failed',
      platform: 'line'
    };
  }
}

/**
 * Facebook/Instagram webhook signature verification
 * Uses HMAC-SHA256 with hex encoding and "sha256=" prefix
 */
async function verifyFacebookSignature(
  body: string,
  headers: Record<string, string>,
  appSecret: string
): Promise<SignatureVerificationResult> {
  const signature = headers['x-hub-signature-256'] || headers['X-Hub-Signature-256'];

  if (!signature) {
    return {
      valid: false,
      error: 'Missing X-Hub-Signature-256 header',
      platform: 'facebook'
    };
  }

  if (!appSecret) {
    return {
      valid: false,
      error: 'Missing Facebook app secret',
      platform: 'facebook'
    };
  }

  // Extract signature value (remove "sha256=" prefix)
  const signatureValue = signature.startsWith('sha256=')
    ? signature.slice(7)
    : signature;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(appSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(body)
    );

    // Convert to hex string
    const calculatedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const isValid = timingSafeEqual(calculatedSignature, signatureValue);

    return {
      valid: isValid,
      error: isValid ? undefined : 'Invalid signature',
      platform: 'facebook'
    };
  } catch (error) {
    console.error('Facebook signature verification error:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Signature verification failed',
      platform: 'facebook'
    };
  }
}

/**
 * Timing-safe string comparison to prevent timing attacks
 * Extracted from webhook-security-service.ts (lines 1007-1018)
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Extract signature from headers based on platform
 */
export function getSignatureFromHeaders(
  platform: WebhookPlatform,
  headers: Record<string, string>
): string | null {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  );

  switch (platform) {
    case 'line':
      return normalizedHeaders['x-line-signature'] || null;
    case 'facebook':
    case 'instagram':
      return normalizedHeaders['x-hub-signature-256'] || null;
    default:
      return null;
  }
}
