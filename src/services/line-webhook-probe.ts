// On-demand LINE webhook test (deep health check only).
// LINE's own endpoint sends a test event to our registered webhook URL and reports the result.
// It is rate limited by LINE, so it is never run on a schedule or by default.

import type { Bindings } from '@/types';
import type { DeepHealth } from '@/types/health-check';
import { getCredentialsFromKV } from '@modules/system/handlers/system-crypto-utils';
import { nowISO, nowMs } from '@/utils/timestamp';

const LINE_WEBHOOK_TEST_URL = 'https://api.line.me/v2/bot/channel/webhook/test';
const TIMEOUT_MS = 10_000;

interface LineWebhookTestResponse {
  success?: boolean;
  timestamp?: string;
  statusCode?: number;
  reason?: string;
  detail?: string;
}

export async function runLineWebhookProbe(env: Bindings): Promise<DeepHealth['lineWebhook']> {
  const testedAt = nowISO();
  const credentials = await getCredentialsFromKV(env, 'line');
  const accessToken = credentials?.accessToken || env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!accessToken) {
    return { status: 'skipped', testedAt, message: 'LINE access token is not configured' };
  }

  const startedAt = nowMs();
  try {
    const response = await fetch(LINE_WEBHOOK_TEST_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    const latencyMs = nowMs() - startedAt;

    if (!response.ok) {
      return {
        status: 'failure',
        statusCode: response.status,
        latencyMs,
        testedAt,
        message: `LINE webhook test request failed: HTTP ${response.status}`
      };
    }

    const body = await response.json().catch((): LineWebhookTestResponse => ({})) as LineWebhookTestResponse;
    const ok = body.success === true;
    return {
      status: ok ? 'success' : 'failure',
      ...(body.statusCode !== undefined ? { statusCode: body.statusCode } : {}),
      ...(body.reason ? { reason: body.reason } : {}),
      ...(body.detail ? { detail: body.detail } : {}),
      latencyMs,
      testedAt,
      message: ok ? 'LINE delivered a test event to the webhook' : `LINE webhook test failed: ${body.reason ?? 'unknown reason'}`
    };
  } catch (error) {
    return {
      status: 'failure',
      latencyMs: nowMs() - startedAt,
      testedAt,
      message: `LINE webhook test error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
