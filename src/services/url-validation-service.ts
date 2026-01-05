/**
 * URL Validation Service
 *
 * Provides comprehensive URL validation and reachability checking
 * for webhook URLs and external service endpoints.
 *
 * @module services/url-validation-service
 */

/**
 * URL validation result
 */
export interface UrlValidationResult {
  /** Whether the URL is valid */
  valid: boolean;

  /** Error message if validation failed */
  error?: string;

  /** Normalized URL (if valid) */
  normalizedUrl?: string;

  /** Additional validation details */
  details?: {
    protocol?: string;
    hostname?: string;
    port?: string;
    pathname?: string;
  };
}

/**
 * URL reachability check result
 */
export interface UrlReachabilityResult {
  /** Whether the URL is reachable */
  reachable: boolean;

  /** HTTP status code (if successful) */
  statusCode?: number;

  /** Response time in milliseconds */
  responseTime?: number;

  /** Error message if check failed */
  error?: string;
}

/**
 * Validate URL format
 *
 * @param url - URL to validate
 * @param options - Validation options
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = validateUrl('https://example.com/webhooks/line');
 * if (result.valid) {
 *   console.log('URL is valid:', result.normalizedUrl);
 * } else {
 *   console.error('Invalid URL:', result.error);
 * }
 * ```
 */
export function validateUrl(
  url: string,
  options?: {
    /** Allow HTTP protocol (default: true) */
    allowHttp?: boolean;

    /** Require HTTPS protocol (default: false) */
    requireHttps?: boolean;

    /** Allowed hostnames (default: any) */
    allowedHostnames?: string[];

    /** Require pathname (default: true) */
    requirePathname?: boolean;
  }
): UrlValidationResult {
  const opts = {
    allowHttp: true,
    requireHttps: false,
    requirePathname: true,
    ...options
  };

  try {
    const parsed = new URL(url);

    // Protocol validation
    if (opts.requireHttps && parsed.protocol !== 'https:') {
      return {
        valid: false,
        error: 'HTTPS protocol is required'
      };
    }

    if (!opts.allowHttp && parsed.protocol === 'http:') {
      return {
        valid: false,
        error: 'HTTP protocol is not allowed'
      };
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return {
        valid: false,
        error: `Invalid protocol: ${parsed.protocol}. Only HTTP and HTTPS are supported`
      };
    }

    // Hostname validation
    if (!parsed.hostname) {
      return {
        valid: false,
        error: 'URL must have a hostname'
      };
    }

    if (opts.allowedHostnames && !opts.allowedHostnames.includes(parsed.hostname)) {
      return {
        valid: false,
        error: `Hostname ${parsed.hostname} is not in the allowed list`
      };
    }

    // Pathname validation
    if (opts.requirePathname && (!parsed.pathname || parsed.pathname === '/')) {
      return {
        valid: false,
        error: 'URL must have a pathname'
      };
    }

    // Normalize URL (remove trailing slash from pathname)
    const normalizedPathname = parsed.pathname.replace(/\/$/, '') || '/';
    const normalizedUrl = `${parsed.protocol}//${parsed.hostname}${parsed.port ? ':' + parsed.port : ''}${normalizedPathname}${parsed.search}${parsed.hash}`;

    return {
      valid: true,
      normalizedUrl,
      details: {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port,
        pathname: parsed.pathname
      }
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid URL format'
    };
  }
}

/**
 * Check if URL is reachable
 *
 * @param url - URL to check
 * @param options - Check options
 * @returns Reachability result
 *
 * @example
 * ```typescript
 * const result = await checkUrlReachability('https://example.com/api/health');
 * if (result.reachable) {
 *   console.log(`URL is reachable (${result.statusCode}) in ${result.responseTime}ms`);
 * } else {
 *   console.error('URL is not reachable:', result.error);
 * }
 * ```
 */
export async function checkUrlReachability(
  url: string,
  options?: {
    /** Request method (default: 'GET') */
    method?: 'GET' | 'HEAD' | 'POST';

    /** Request timeout in milliseconds (default: 5000) */
    timeout?: number;

    /** Custom headers */
    headers?: Record<string, string>;

    /** Expected status codes (default: [200, 201, 204]) */
    expectedStatuses?: number[];
  }
): Promise<UrlReachabilityResult> {
  const opts = {
    method: 'GET' as const,
    timeout: 5000,
    expectedStatuses: [200, 201, 204],
    ...options
  };

  // First validate URL format
  const validation = validateUrl(url);
  if (!validation.valid) {
    return {
      reachable: false,
      error: validation.error
    };
  }

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), opts.timeout);

    const response = await fetch(url, {
      method: opts.method,
      headers: opts.headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const responseTime = Date.now() - startTime;
    const reachable = opts.expectedStatuses.includes(response.status);

    return {
      reachable,
      statusCode: response.status,
      responseTime,
      error: reachable ? undefined : `Unexpected status code: ${response.status}`
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    if (error instanceof Error && error.name === 'AbortError') {
      return {
        reachable: false,
        responseTime,
        error: `Request timeout after ${opts.timeout}ms`
      };
    }

    return {
      reachable: false,
      responseTime,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

/**
 * Validate webhook URL specifically
 *
 * @param url - Webhook URL to validate
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = validateWebhookUrl('https://example.com/webhooks/line');
 * if (result.valid) {
 *   console.log('Webhook URL is valid');
 * }
 * ```
 */
export function validateWebhookUrl(url: string): UrlValidationResult {
  return validateUrl(url, {
    requireHttps: false,  // Allow HTTP in development
    allowHttp: true,
    requirePathname: true
  });
}

/**
 * Validate multiple URLs in batch
 *
 * @param urls - URLs to validate
 * @param options - Validation options
 * @returns Map of URL to validation result
 *
 * @example
 * ```typescript
 * const results = validateUrlsBatch([
 *   'https://example.com/webhooks/line',
 *   'https://example.com/webhooks/facebook'
 * ]);
 *
 * results.forEach((result, url) => {
 *   console.log(`${url}: ${result.valid ? 'Valid' : result.error}`);
 * });
 * ```
 */
export function validateUrlsBatch(
  urls: string[],
  options?: Parameters<typeof validateUrl>[1]
): Map<string, UrlValidationResult> {
  const results = new Map<string, UrlValidationResult>();

  for (const url of urls) {
    results.set(url, validateUrl(url, options));
  }

  return results;
}

/**
 * Check reachability of multiple URLs in batch
 *
 * @param urls - URLs to check
 * @param options - Check options
 * @returns Map of URL to reachability result
 *
 * @example
 * ```typescript
 * const results = await checkUrlsReachabilityBatch([
 *   'https://example.com/api/health',
 *   'https://example.com/api/status'
 * ]);
 *
 * results.forEach((result, url) => {
 *   console.log(`${url}: ${result.reachable ? 'Reachable' : result.error}`);
 * });
 * ```
 */
export async function checkUrlsReachabilityBatch(
  urls: string[],
  options?: Parameters<typeof checkUrlReachability>[1]
): Promise<Map<string, UrlReachabilityResult>> {
  const results = new Map<string, UrlReachabilityResult>();

  // Check all URLs in parallel
  const checks = urls.map(async (url) => {
    const result = await checkUrlReachability(url, options);
    return { url, result };
  });

  const checkResults = await Promise.all(checks);

  for (const { url, result } of checkResults) {
    results.set(url, result);
  }

  return results;
}

/**
 * Sanitize URL (remove sensitive information like tokens from query parameters)
 *
 * @param url - URL to sanitize
 * @param sensitiveParams - Sensitive parameter names to remove (default: common sensitive params)
 * @returns Sanitized URL
 *
 * @example
 * ```typescript
 * sanitizeUrl('https://example.com/api?token=secret123&id=456');
 * // => 'https://example.com/api?id=456'
 *
 * sanitizeUrl('https://example.com/api?apiKey=abc&data=xyz', ['apiKey']);
 * // => 'https://example.com/api?data=xyz'
 * ```
 */
export function sanitizeUrl(
  url: string,
  sensitiveParams: string[] = ['token', 'apiKey', 'api_key', 'secret', 'password', 'accessToken', 'access_token']
): string {
  try {
    const parsed = new URL(url);

    // Remove sensitive query parameters
    for (const param of sensitiveParams) {
      parsed.searchParams.delete(param);
    }

    return parsed.toString();
  } catch {
    // If URL is invalid, return as-is
    return url;
  }
}

/**
 * Extract domain from URL
 *
 * @param url - URL to extract domain from
 * @returns Domain (hostname without subdomain) or null if invalid
 *
 * @example
 * ```typescript
 * extractDomain('https://api.example.com/webhooks/line');  // 'example.com'
 * extractDomain('https://localhost:8787/api');              // 'localhost'
 * ```
 */
export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;

    // Handle localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return hostname;
    }

    // Extract domain (last two parts for most cases)
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      return parts.slice(-2).join('.');
    }

    return hostname;
  } catch {
    return null;
  }
}
