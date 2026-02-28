/**
 * TypeScript declarations for cloudflare:test module
 * Used by @cloudflare/vitest-pool-workers
 */

declare module 'cloudflare:test' {
  /**
   * Environment bindings from wrangler.test.toml
   * These are the actual bindings available during tests
   */
  export const env: {
    // Durable Objects
    DEPLOYMENT_ORCHESTRATOR: DurableObjectNamespace;

    // Environment variables from wrangler.test.toml
    FRONTEND_URL: string;
    ENVIRONMENT: string;
    FROM_NAME: string;
    RESEND_API_KEY: string;
    FROM_EMAIL: string;
    CF_CLIENT_ID: string;
    CF_CLIENT_SECRET: string;
    ENCRYPTION_KEY: string;
  };

  /**
   * SELF represents the current Worker
   * Use this for integration tests that go through the Worker's fetch handler
   */
  export const SELF: {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  };

  /**
   * Run a Durable Object's alarm handler
   * Returns true if an alarm was scheduled and ran
   */
  export function runDurableObjectAlarm(
    stub: DurableObjectStub
  ): Promise<boolean>;

  /**
   * List all Durable Object IDs in a namespace
   * Respects isolatedStorage if enabled
   */
  export function listDurableObjectIds(
    namespace: DurableObjectNamespace
  ): Promise<DurableObjectId[]>;

  /**
   * Create a test execution context
   */
  export function createExecutionContext(): ExecutionContext;

  /**
   * Wait for all scheduled tasks to complete
   */
  export function waitOnExecutionContext(
    ctx: ExecutionContext
  ): Promise<void>;

  /**
   * Fetch mock utilities for mocking external HTTP requests
   */
  export const fetchMock: {
    activate(): void;
    deactivate(): void;
    disableNetConnect(): void;
    enableNetConnect(pattern?: string | RegExp): void;
    get(origin: string): {
      intercept(options: { path: string | RegExp; method?: string }): {
        reply(
          statusCode: number,
          body?: unknown,
          headers?: Record<string, string>
        ): void;
      };
    };
  };
}

/**
 * Extend Vitest's expect with Cloudflare-specific matchers
 */
declare global {
  namespace Vi {
    interface Assertion {
      toBeValidDurableObjectId(): void;
    }
  }
}
