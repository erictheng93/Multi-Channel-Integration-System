// src/utils/webhook-alert.ts
// Minimal webhook failure alerting — KV audit trail + optional external webhook
// Designed for low-volume systems (~20 msgs/day) where message loss must be visible

import type { Bindings } from '@/types';
import { createContextLogger } from '@/utils/logger';
import { nowISO } from '@/utils/timestamp';

const log = createContextLogger('WebhookAlert');

interface WebhookFailureDetails {
  platform: 'line' | 'facebook';
  failedEvents: number;
  totalEvents: number;
  lastError: string;
  eventTypes?: string[];
}

/**
 * Alert on webhook processing failures.
 *
 * 1. Stores failure record in KV (7-day TTL) for audit trail
 * 2. Sends to ALERT_WEBHOOK_URL / ALERT_SLACK_WEBHOOK_URL if configured
 *
 * This function is fire-and-forget — failures here must never block
 * the webhook response.
 */
export async function alertWebhookFailure(
  env: Bindings,
  details: WebhookFailureDetails
): Promise<void> {
  const timestamp = nowISO();
  const alertId = `webhook_failure:${details.platform}:${Date.now()}`;

  const alertPayload = {
    id: alertId,
    timestamp,
    ...details,
  };

  // 1. KV audit trail (7-day TTL)
  try {
    await env.CACHE.put(
      `alert:${alertId}`,
      JSON.stringify(alertPayload),
      { expirationTtl: 7 * 24 * 60 * 60 }
    );
  } catch (kvErr) {
    log.error('Failed to store alert in KV', {
      error: kvErr instanceof Error ? kvErr.message : String(kvErr)
    });
  }

  // 2. External webhook (Slack or generic)
  const webhookUrl = env.ALERT_SLACK_WEBHOOK_URL || env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const body = env.ALERT_SLACK_WEBHOOK_URL
      ? formatSlackPayload(alertPayload)
      : JSON.stringify(alertPayload);

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch (fetchErr) {
    log.error('Failed to send alert webhook', {
      error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
    });
  }
}

function formatSlackPayload(alert: WebhookFailureDetails & { id: string; timestamp: string }): string {
  return JSON.stringify({
    text: `Webhook failure: ${alert.platform.toUpperCase()}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            `*Webhook Processing Failure*`,
            `Platform: \`${alert.platform.toUpperCase()}\``,
            `Failed: ${alert.failedEvents}/${alert.totalEvents} events`,
            `Error: \`${alert.lastError}\``,
            `Time: ${alert.timestamp}`,
          ].join('\n'),
        },
      },
    ],
  });
}
