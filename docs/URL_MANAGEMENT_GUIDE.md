# URL Management Guide

Complete guide for managing URLs in the Multi-Channel Customer Support System.

## Overview

The system provides centralized URL management through two specialized services:

1. **Webhook URL Service** (`src/services/webhook-url-service.ts`) - Manages webhook URLs for all platforms
2. **URL Validation Service** (`src/services/url-validation-service.ts`) - Validates and checks URL reachability

## Quick Start

### Getting Webhook URLs

```typescript
import { getWebhookUrl, getAllWebhookUrls } from '@/services/webhook-url-service';

// Get LINE webhook URL
const lineWebhookUrl = getWebhookUrl(env, 'line');
// Development: http://localhost:8787/webhooks/line
// Production: https://multi-channel.imfinethankyouandyou.com/webhooks/line

// Get all webhook URLs
const allWebhooks = getAllWebhookUrls(env);
console.log(allWebhooks);
// {
//   line: 'https://multi-channel.imfinethankyouandyou.com/webhooks/line',
//   facebook: 'https://multi-channel.imfinethankyouandyou.com/webhooks/facebook',
//   whatsapp: 'https://multi-channel.imfinethankyouandyou.com/webhooks/whatsapp',
//   telegram: 'https://multi-channel.imfinethankyouandyou.com/webhooks/telegram',
//   instagram: 'https://multi-channel.imfinethankyouandyou.com/webhooks/instagram'
// }
```

### Validating URLs

```typescript
import { validateUrl, checkUrlReachability } from '@/services/url-validation-service';

// Validate URL format
const validation = validateUrl('https://example.com/webhooks/line');
if (validation.valid) {
  console.log('Valid URL:', validation.normalizedUrl);
} else {
  console.error('Invalid URL:', validation.error);
}

// Check if URL is reachable
const reachability = await checkUrlReachability('https://api.line.me/v2/bot/info');
if (reachability.reachable) {
  console.log(`Reachable in ${reachability.responseTime}ms`);
} else {
  console.error('Not reachable:', reachability.error);
}
```

## Webhook URL Service

### Core Functions

#### `getWebhookUrl(env, platform)`

Get the webhook URL for a specific platform.

**Parameters:**
- `env` - Cloudflare Workers environment
- `platform` - Platform identifier ('line', 'facebook', 'whatsapp', 'telegram', 'instagram')

**Returns:** Complete webhook URL string

**Example:**
```typescript
import { getWebhookUrl } from '@/services/webhook-url-service';

const lineWebhook = getWebhookUrl(c.env, 'line');
// => 'https://multi-channel.imfinethankyouandyou.com/webhooks/line'
```

#### `getWebhookConfig(env, platform)`

Get detailed webhook configuration including base URL, path, and environment.

**Parameters:**
- `env` - Cloudflare Workers environment
- `platform` - Platform identifier

**Returns:** `WebhookUrlConfig` object

**Example:**
```typescript
import { getWebhookConfig } from '@/services/webhook-url-service';

const config = getWebhookConfig(c.env, 'line');
console.log(config);
// {
//   baseUrl: 'https://multi-channel.imfinethankyouandyou.com',
//   path: '/webhooks/line',
//   fullUrl: 'https://multi-channel.imfinethankyouandyou.com/webhooks/line',
//   environment: 'production'
// }
```

#### `getAllWebhookUrls(env)`

Get webhook URLs for all supported platforms.

**Parameters:**
- `env` - Cloudflare Workers environment

**Returns:** Record mapping platform to webhook URL

**Example:**
```typescript
import { getAllWebhookUrls } from '@/services/webhook-url-service';

const webhooks = getAllWebhookUrls(c.env);
// {
//   line: '...',
//   facebook: '...',
//   whatsapp: '...',
//   telegram: '...',
//   instagram: '...'
// }
```

### Utility Functions

#### `buildWebhookUrlWithParams(env, platform, params)`

Build webhook URL with query parameters (useful for verification tokens).

**Example:**
```typescript
import { buildWebhookUrlWithParams } from '@/services/webhook-url-service';

const url = buildWebhookUrlWithParams(c.env, 'facebook', {
  verify_token: 'my_secret_token',
  mode: 'subscribe'
});
// => 'https://multi-channel.imfinethankyouandyou.com/webhooks/facebook?verify_token=my_secret_token&mode=subscribe'
```

#### `isValidWebhookUrl(url)`

Check if a URL is a valid webhook URL format.

**Example:**
```typescript
import { isValidWebhookUrl } from '@/services/webhook-url-service';

isValidWebhookUrl('https://example.com/webhooks/line');  // true
isValidWebhookUrl('invalid-url');                         // false
```

#### `extractPlatformFromUrl(url)`

Extract platform identifier from a webhook URL.

**Example:**
```typescript
import { extractPlatformFromUrl } from '@/services/webhook-url-service';

extractPlatformFromUrl('https://example.com/webhooks/line');    // 'line'
extractPlatformFromUrl('https://example.com/api/users');         // null
```

#### `compareWebhookUrls(url1, url2)`

Compare two webhook URLs (ignoring query parameters and trailing slashes).

**Example:**
```typescript
import { compareWebhookUrls } from '@/services/webhook-url-service';

compareWebhookUrls(
  'https://example.com/webhooks/line/',
  'https://example.com/webhooks/line?token=123'
);  // true
```

## URL Validation Service

### Validation Functions

#### `validateUrl(url, options?)`

Comprehensive URL validation with customizable options.

**Parameters:**
- `url` - URL to validate
- `options` (optional):
  - `allowHttp` (default: true) - Allow HTTP protocol
  - `requireHttps` (default: false) - Require HTTPS protocol
  - `allowedHostnames` (default: any) - List of allowed hostnames
  - `requirePathname` (default: true) - Require pathname

**Returns:** `UrlValidationResult`

**Example:**
```typescript
import { validateUrl } from '@/services/url-validation-service';

// Basic validation
const result = validateUrl('https://example.com/api/endpoint');

// Strict validation (require HTTPS, specific hostname)
const strictResult = validateUrl('https://api.example.com/webhook', {
  requireHttps: true,
  allowedHostnames: ['api.example.com', 'api-staging.example.com']
});

if (strictResult.valid) {
  console.log('Valid URL:', strictResult.normalizedUrl);
} else {
  console.error('Validation failed:', strictResult.error);
}
```

#### `validateWebhookUrl(url)`

Specialized validation for webhook URLs.

**Example:**
```typescript
import { validateWebhookUrl } from '@/services/url-validation-service';

const result = validateWebhookUrl('https://example.com/webhooks/line');
```

### Reachability Functions

#### `checkUrlReachability(url, options?)`

Check if a URL is reachable via HTTP request.

**Parameters:**
- `url` - URL to check
- `options` (optional):
  - `method` (default: 'GET') - HTTP method
  - `timeout` (default: 5000) - Timeout in milliseconds
  - `headers` - Custom headers
  - `expectedStatuses` (default: [200, 201, 204]) - Expected status codes

**Returns:** Promise of `UrlReachabilityResult`

**Example:**
```typescript
import { checkUrlReachability } from '@/services/url-validation-service';

// Basic reachability check
const result = await checkUrlReachability('https://api.line.me/v2/bot/info');

if (result.reachable) {
  console.log(`Reachable (${result.statusCode}) in ${result.responseTime}ms`);
} else {
  console.error('Not reachable:', result.error);
}

// Custom check with timeout and headers
const customResult = await checkUrlReachability('https://api.example.com/health', {
  method: 'HEAD',
  timeout: 3000,
  headers: {
    'Authorization': 'Bearer token123'
  },
  expectedStatuses: [200, 204]
});
```

### Batch Operations

#### `validateUrlsBatch(urls, options?)`

Validate multiple URLs at once.

**Example:**
```typescript
import { validateUrlsBatch } from '@/services/url-validation-service';

const urls = [
  'https://example.com/webhooks/line',
  'https://example.com/webhooks/facebook',
  'invalid-url'
];

const results = validateUrlsBatch(urls, { requireHttps: true });

results.forEach((result, url) => {
  console.log(`${url}: ${result.valid ? 'Valid' : result.error}`);
});
```

#### `checkUrlsReachabilityBatch(urls, options?)`

Check reachability of multiple URLs in parallel.

**Example:**
```typescript
import { checkUrlsReachabilityBatch } from '@/services/url-validation-service';

const urls = [
  'https://api.line.me/v2/oauth/verify',
  'https://graph.facebook.com/v18.0'
];

const results = await checkUrlsReachabilityBatch(urls, {
  timeout: 3000
});

results.forEach((result, url) => {
  console.log(`${url}: ${result.reachable ? `✓ (${result.responseTime}ms)` : `✗ ${result.error}`}`);
});
```

### Utility Functions

#### `sanitizeUrl(url, sensitiveParams?)`

Remove sensitive information from URLs (useful for logging).

**Example:**
```typescript
import { sanitizeUrl } from '@/services/url-validation-service';

const sanitized = sanitizeUrl('https://api.example.com/endpoint?token=secret123&id=456');
// => 'https://api.example.com/endpoint?id=456'

// Custom sensitive parameters
const custom = sanitizeUrl('https://api.example.com/endpoint?apiKey=abc&data=xyz', ['apiKey']);
// => 'https://api.example.com/endpoint?data=xyz'
```

#### `extractDomain(url)`

Extract domain from URL.

**Example:**
```typescript
import { extractDomain } from '@/services/url-validation-service';

extractDomain('https://api.example.com/webhooks/line');  // 'example.com'
extractDomain('https://localhost:8787/api');              // 'localhost'
```

## Common Use Cases

### 1. Setting Up Webhook in Channel Service

```typescript
import { getWebhookUrl } from '@/services/webhook-url-service';
import { validateWebhookUrl } from '@/services/url-validation-service';

async function setupLineWebhook(c: Context) {
  // Get webhook URL for the current environment
  const webhookUrl = getWebhookUrl(c.env, 'line');

  // Validate the URL
  const validation = validateWebhookUrl(webhookUrl);
  if (!validation.valid) {
    return c.json({ error: `Invalid webhook URL: ${validation.error}` }, 400);
  }

  // Configure LINE Messaging API with webhook URL
  await configureLINEWebhook(c.env.LINE_CHANNEL_ACCESS_TOKEN, webhookUrl);

  return c.json({
    success: true,
    webhookUrl,
    environment: c.env.ENVIRONMENT
  });
}
```

### 2. Validating User-Provided URLs

```typescript
import { validateUrl, checkUrlReachability } from '@/services/url-validation-service';

async function validateExternalWebhook(c: Context) {
  const { url } = await c.req.json();

  // Validate format
  const validation = validateUrl(url, {
    requireHttps: true  // Enforce HTTPS for security
  });

  if (!validation.valid) {
    return c.json({ error: validation.error }, 400);
  }

  // Check if reachable
  const reachability = await checkUrlReachability(validation.normalizedUrl!, {
    method: 'HEAD',
    timeout: 3000
  });

  if (!reachability.reachable) {
    return c.json({
      error: 'URL is not reachable',
      details: reachability.error
    }, 400);
  }

  return c.json({
    success: true,
    url: validation.normalizedUrl,
    responseTime: reachability.responseTime
  });
}
```

### 3. Health Check for External APIs

```typescript
import { checkUrlsReachabilityBatch } from '@/services/url-validation-service';
import { LINE_API, FACEBOOK_API } from '@/config/external-apis';

async function checkExternalAPIsHealth(c: Context) {
  const apis = [
    `${LINE_API.baseUrl}/info`,
    `${FACEBOOK_API.baseUrl}`
  ];

  const results = await checkUrlsReachabilityBatch(apis, {
    method: 'HEAD',
    timeout: 5000
  });

  const health = {
    line: results.get(apis[0])!,
    facebook: results.get(apis[1])!
  };

  return c.json({
    timestamp: new Date().toISOString(),
    apis: {
      line: {
        reachable: health.line.reachable,
        responseTime: health.line.responseTime,
        error: health.line.error
      },
      facebook: {
        reachable: health.facebook.reachable,
        responseTime: health.facebook.responseTime,
        error: health.facebook.error
      }
    }
  });
}
```

### 4. Logging with Sanitized URLs

```typescript
import { sanitizeUrl } from '@/services/url-validation-service';

function logWebhookRequest(url: string, headers: Record<string, string>) {
  // Sanitize URL before logging (remove sensitive tokens)
  const sanitizedUrl = sanitizeUrl(url);

  console.log(`Webhook request received: ${sanitizedUrl}`, {
    userAgent: headers['user-agent'],
    contentType: headers['content-type']
  });
}
```

## Environment-Aware URL Management

The system automatically adapts URLs based on the environment:

### Development Environment
```typescript
// Backend URL
getBackendUrl(env)  // => 'http://localhost:8787'

// Webhook URLs
getWebhookUrl(env, 'line')  // => 'http://localhost:8787/webhooks/line'
```

### Production Environment
```typescript
// Backend URL
getBackendUrl(env)  // => 'https://multi-channel.imfinethankyouandyou.com'

// Webhook URLs
getWebhookUrl(env, 'line')  // => 'https://multi-channel.imfinethankyouandyou.com/webhooks/line'
```

## Best Practices

1. **Always use service functions instead of hardcoding URLs**
   ```typescript
   // ❌ Bad
   const webhookUrl = 'https://multi-channel.imfinethankyouandyou.com/webhooks/line';

   // ✅ Good
   const webhookUrl = getWebhookUrl(c.env, 'line');
   ```

2. **Validate URLs before storing in database**
   ```typescript
   const validation = validateWebhookUrl(userProvidedUrl);
   if (!validation.valid) {
     return c.json({ error: validation.error }, 400);
   }
   ```

3. **Check reachability for critical external endpoints**
   ```typescript
   const reachability = await checkUrlReachability(externalApiUrl);
   if (!reachability.reachable) {
     // Handle unreachable endpoint
   }
   ```

4. **Sanitize URLs in logs to avoid exposing sensitive data**
   ```typescript
   console.log('API call to:', sanitizeUrl(apiUrl));
   ```

5. **Use batch operations for multiple URLs**
   ```typescript
   // Efficient parallel checking
   const results = await checkUrlsReachabilityBatch(urls);
   ```

## Troubleshooting

### URL Validation Fails

**Problem:** `validateUrl()` returns `valid: false`

**Solutions:**
1. Check if URL uses HTTP or HTTPS protocol
2. Ensure URL has a valid hostname
3. Verify pathname is present (if `requirePathname: true`)
4. Check if hostname is in `allowedHostnames` list (if specified)

### URL Not Reachable

**Problem:** `checkUrlReachability()` returns `reachable: false`

**Solutions:**
1. Verify the URL is correct and accessible
2. Check network connectivity
3. Increase timeout if network is slow
4. Verify expected status codes match actual response
5. Check if CORS headers are required

### Webhook URL Not Working

**Problem:** Webhook not receiving events from platform

**Solutions:**
1. Verify webhook URL is correct: `getWebhookUrl(env, platform)`
2. Ensure platform is configured with correct webhook URL
3. Check webhook handler is registered in routing
4. Verify environment (development vs production)
5. Test webhook reachability from external network

## Migration Guide

### Migrating from Hardcoded URLs

**Before:**
```typescript
const webhookUrl = 'https://multi-channel.imfinethankyouandyou.com/webhooks/line';
```

**After:**
```typescript
import { getWebhookUrl } from '@/services/webhook-url-service';
const webhookUrl = getWebhookUrl(c.env, 'line');
```

### Migrating URL Validation

**Before:**
```typescript
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
```

**After:**
```typescript
import { validateUrl } from '@/services/url-validation-service';
const result = validateUrl(url);
if (result.valid) {
  // Use result.normalizedUrl
}
```

## API Reference

See the following files for complete API documentation:
- [`src/services/webhook-url-service.ts`](../src/services/webhook-url-service.ts) - Webhook URL management
- [`src/services/url-validation-service.ts`](../src/services/url-validation-service.ts) - URL validation and reachability
