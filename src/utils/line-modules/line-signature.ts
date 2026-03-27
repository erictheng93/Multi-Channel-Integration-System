import { createContextLogger } from '../logger';

const log = createContextLogger('LineUtils');

/**
 * 驗證 LINE Webhook 簽名
 */
export async function verifyLineSignature(
  body: string,
  signature: string | undefined,
  channelSecret: string
): Promise<boolean> {
  if (!signature) {
    return false;
  }

  try {
    // 移除 'sha256=' 前綴
    const receivedSignature = signature.replace('sha256=', '');
    
    // 使用 Web Crypto API 計算 HMAC-SHA256
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

    // 轉換為 base64
    const computedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
    
    return computedSignature === receivedSignature;
  } catch (error) {
    log.error('Signature verification error', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}
