import type { IntegrationPlatform } from '@modules/integrations/types/integration-types';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('WebhookSecurity');

export class WebhookSignatureVerifier {
  constructor(private getIntegrationCredentials: (integrationId: string) => Promise<{ channelSecret?: string; appSecret?: string } | null>) {}

  async verifySignature(platform: IntegrationPlatform, integrationId: string, headers: Record<string, string>, body: string | unknown): Promise<{ valid: boolean; error?: string }> {
    try {
      const credentials = await this.getIntegrationCredentials(integrationId);
      if (!credentials) return { valid: false, error: 'Integration credentials not found' };
      const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
      switch (platform) {
        case 'line': if (!credentials.channelSecret) return { valid: false, error: 'LINE channel secret not configured' }; return await this.verifyLineSignature(headers, bodyString, credentials.channelSecret);
        case 'facebook': case 'instagram': if (!credentials.appSecret) return { valid: false, error: 'Facebook app secret not configured' }; return await this.verifyFacebookSignature(headers, bodyString, credentials.appSecret);
        default: return { valid: true };
      }
    } catch (error) { return { valid: false, error: `Signature verification error: ${error instanceof Error ? error.message : 'Unknown'}` }; }
  }

  private async verifyLineSignature(headers: Record<string, string>, body: string, channelSecret: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const signature = headers['x-line-signature'] || headers['X-Line-Signature'];
      if (!signature) return { valid: false, error: 'Missing X-Line-Signature header' };
      if (!channelSecret) return { valid: false, error: 'LINE channel secret not configured' };
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', encoder.encode(channelSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
      const calculatedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
      const isValid = this.timingSafeEqual(calculatedSignature, signature);
      if (!isValid) log.warn('LINE Webhook signature mismatch', { expected: calculatedSignature.substring(0, 20) + '...', received: signature.substring(0, 20) + '...' });
      return { valid: isValid };
    } catch (error) { return { valid: false, error: `LINE signature verification failed: ${error instanceof Error ? error.message : 'Unknown'}` }; }
  }

  private async verifyFacebookSignature(headers: Record<string, string>, body: string, appSecret: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const signature = headers['x-hub-signature-256'] || headers['X-Hub-Signature-256'];
      if (!signature) return { valid: false, error: 'Missing X-Hub-Signature-256 header' };
      if (!appSecret) return { valid: false, error: 'Facebook app secret not configured' };
      if (!signature.startsWith('sha256=')) return { valid: false, error: 'Invalid signature format (expected sha256=<hex>)' };
      const signatureHash = signature.substring(7);
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', encoder.encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
      const calculatedSignature = Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      const isValid = this.timingSafeEqual(calculatedSignature, signatureHash);
      if (!isValid) log.warn('Facebook Webhook signature mismatch', { expected: calculatedSignature.substring(0, 20) + '...', received: signatureHash.substring(0, 20) + '...' });
      return { valid: isValid };
    } catch (error) { return { valid: false, error: `Facebook signature verification failed: ${error instanceof Error ? error.message : 'Unknown'}` }; }
  }

  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return result === 0;
  }
}
