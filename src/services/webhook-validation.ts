// Webhook Validation Service
// 統一的 webhook 驗證服務 - 從多個 handler 提取重複代碼

export type WebhookPlatform = 'line' | 'facebook' | 'instagram';

export interface WebhookValidationResult {
  valid: boolean;
  platform: WebhookPlatform;
  errors: string[];
  warnings: string[];
  eventCount?: number;
}

export interface LineWebhookBody {
  destination: string;
  events: LineWebhookEvent[];
}

export interface LineWebhookEvent {
  type: string;
  timestamp: number;
  source: {
    type: string;
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  message?: any;
  replyToken?: string;
}

export interface FacebookWebhookBody {
  object: string;
  entry: FacebookEntry[];
}

export interface FacebookEntry {
  id: string;
  time: number;
  messaging?: FacebookMessaging[];
  changes?: FacebookChange[];
}

export interface FacebookMessaging {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: any;
  postback?: any;
}

export interface FacebookChange {
  field: string;
  value: any;
}

/**
 * Validate LINE webhook payload
 * Extracted from webhook.ts (lines 160-178) and webhook-router-service.ts (lines 286-317)
 */
export function validateLineWebhook(data: unknown): WebhookValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      platform: 'line',
      errors: ['Invalid payload: not an object'],
      warnings
    };
  }

  const body = data as Record<string, unknown>;

  // Check destination
  if (!body.destination || typeof body.destination !== 'string') {
    warnings.push('Missing or invalid destination field');
  }

  // Check events array
  if (!body.events) {
    errors.push('Missing events array');
    return { valid: false, platform: 'line', errors, warnings };
  }

  if (!Array.isArray(body.events)) {
    errors.push('Events field is not an array');
    return { valid: false, platform: 'line', errors, warnings };
  }

  // Validate each event
  const events = body.events as LineWebhookEvent[];
  let validEventCount = 0;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    if (!event.type) {
      warnings.push(`Event[${i}]: Missing event type`);
      continue;
    }

    if (!event.source) {
      warnings.push(`Event[${i}]: Missing source`);
      continue;
    }

    // For message events, require userId
    if (event.type === 'message') {
      if (!event.source.userId && !event.source.groupId && !event.source.roomId) {
        warnings.push(`Event[${i}]: Message event missing user/group/room ID`);
      }
    }

    validEventCount++;
  }

  return {
    valid: errors.length === 0,
    platform: 'line',
    errors,
    warnings,
    eventCount: validEventCount
  };
}

/**
 * Validate Facebook webhook payload
 * Extracted from webhook.ts (lines 180-195) and webhook-router-service.ts (lines 322-351)
 */
export function validateFacebookWebhook(data: unknown): WebhookValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      platform: 'facebook',
      errors: ['Invalid payload: not an object'],
      warnings
    };
  }

  const body = data as Record<string, unknown>;

  // Check object type
  if (!body.object || typeof body.object !== 'string') {
    errors.push('Missing or invalid object field');
    return { valid: false, platform: 'facebook', errors, warnings };
  }

  // Validate object type
  const validObjectTypes = ['page', 'instagram', 'user'];
  if (!validObjectTypes.includes(body.object as string)) {
    errors.push(`Invalid object type: ${body.object}. Expected: ${validObjectTypes.join(', ')}`);
  }

  // Check entry array
  if (!body.entry) {
    errors.push('Missing entry array');
    return { valid: false, platform: 'facebook', errors, warnings };
  }

  if (!Array.isArray(body.entry)) {
    errors.push('Entry field is not an array');
    return { valid: false, platform: 'facebook', errors, warnings };
  }

  // Validate each entry
  const entries = body.entry as FacebookEntry[];
  let validEventCount = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    if (!entry.id) {
      warnings.push(`Entry[${i}]: Missing entry ID`);
    }

    // Check for messaging or changes
    if (entry.messaging) {
      for (let j = 0; j < entry.messaging.length; j++) {
        const messaging = entry.messaging[j];

        if (!messaging.sender?.id) {
          warnings.push(`Entry[${i}].messaging[${j}]: Missing sender ID`);
          continue;
        }

        if (!messaging.recipient?.id) {
          warnings.push(`Entry[${i}].messaging[${j}]: Missing recipient ID`);
          continue;
        }

        validEventCount++;
      }
    }

    if (entry.changes) {
      validEventCount += entry.changes.length;
    }
  }

  return {
    valid: errors.length === 0,
    platform: 'facebook',
    errors,
    warnings,
    eventCount: validEventCount
  };
}

/**
 * Validate webhook payload based on platform
 */
export function validateWebhookPayload(
  platform: WebhookPlatform,
  data: unknown
): WebhookValidationResult {
  switch (platform) {
    case 'line':
      return validateLineWebhook(data);
    case 'facebook':
    case 'instagram':
      return validateFacebookWebhook(data);
    default:
      return {
        valid: false,
        platform,
        errors: [`Unsupported platform: ${platform}`],
        warnings: []
      };
  }
}

/**
 * Validate webhook payload size
 */
export function validatePayloadSize(
  body: string,
  maxSizeBytes: number = 5 * 1024 * 1024 // 5MB default
): { valid: boolean; error?: string; size: number } {
  const size = new TextEncoder().encode(body).length;

  if (size > maxSizeBytes) {
    return {
      valid: false,
      error: `Payload size ${size} bytes exceeds maximum ${maxSizeBytes} bytes`,
      size
    };
  }

  return { valid: true, size };
}

/**
 * Validate timestamp is within acceptable range (anti-replay)
 * Timestamps should be within 5 minutes of current time
 */
export function validateTimestamp(
  timestamp: number,
  toleranceMs: number = 5 * 60 * 1000 // 5 minutes default
): { valid: boolean; error?: string; drift: number } {
  const now = Date.now();
  const drift = Math.abs(now - timestamp);

  if (drift > toleranceMs) {
    return {
      valid: false,
      error: `Timestamp drift ${drift}ms exceeds tolerance ${toleranceMs}ms`,
      drift
    };
  }

  return { valid: true, drift };
}

/**
 * Type guard for LINE webhook body
 */
export function isLineWebhookBody(data: unknown): data is LineWebhookBody {
  const result = validateLineWebhook(data);
  return result.valid;
}

/**
 * Type guard for Facebook webhook body
 */
export function isFacebookWebhookBody(data: unknown): data is FacebookWebhookBody {
  const result = validateFacebookWebhook(data);
  return result.valid;
}
