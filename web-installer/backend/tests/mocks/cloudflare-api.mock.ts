/**
 * Mock Cloudflare API for integration testing
 */

import type { CloudflareAPIResponse, D1Database, KVNamespace, R2Bucket, Queue } from '@/types/cloudflare';

export class MockCloudflareAPI {
  private resources = new Map<string, any>();

  // Track API calls for verification
  public apiCalls: Array<{ method: string; path: string; body?: any }> = [];

  // Configure mock behavior
  public shouldFail = false;
  public failureMessage = 'Mock API failure';

  /**
   * Simulate D1 database creation
   */
  async createD1Database(name: string): Promise<D1Database> {
    this.apiCalls.push({ method: 'POST', path: '/d1/database', body: { name } });

    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }

    const database: D1Database = {
      uuid: `db-${Date.now()}`,
      name,
      version: '1.0.0',
      created_at: new Date().toISOString(),
      num_tables: 0,
      file_size: 0
    };

    this.resources.set(`d1-${name}`, database);
    return database;
  }

  /**
   * Simulate KV namespace creation
   */
  async createKVNamespace(title: string): Promise<KVNamespace> {
    this.apiCalls.push({ method: 'POST', path: '/kv/namespaces', body: { title } });

    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }

    const namespace: KVNamespace = {
      id: `kv-${Date.now()}`,
      title,
      supports_url_encoding: true
    };

    this.resources.set(`kv-${title}`, namespace);
    return namespace;
  }

  /**
   * Simulate R2 bucket creation
   */
  async createR2Bucket(name: string): Promise<R2Bucket> {
    this.apiCalls.push({ method: 'POST', path: '/r2/buckets', body: { name } });

    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }

    const bucket: R2Bucket = {
      name,
      creation_date: new Date().toISOString(),
      location: 'wnam'
    };

    this.resources.set(`r2-${name}`, bucket);
    return bucket;
  }

  /**
   * Simulate Queue creation
   */
  async createQueue(name: string): Promise<Queue> {
    this.apiCalls.push({ method: 'POST', path: '/queues', body: { queue_name: name } });

    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }

    const queue: Queue = {
      queue_id: `queue-${Date.now()}`,
      queue_name: name,
      created_on: new Date().toISOString(),
      producers: 0,
      consumers: 0,
      modified_on: new Date().toISOString()
    };

    this.resources.set(`queue-${name}`, queue);
    return queue;
  }

  /**
   * Simulate resource deletion (for rollback testing)
   */
  async deleteResource(type: string, id: string): Promise<void> {
    this.apiCalls.push({ method: 'DELETE', path: `/${type}/${id}` });

    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }

    // Remove from resources
    for (const [key, value] of this.resources.entries()) {
      if (key.includes(id) || (value.id === id) || (value.uuid === id)) {
        this.resources.delete(key);
        break;
      }
    }
  }

  /**
   * Get all created resources
   */
  getResources(): Map<string, any> {
    return this.resources;
  }

  /**
   * Reset mock state
   */
  reset(): void {
    this.resources.clear();
    this.apiCalls = [];
    this.shouldFail = false;
  }

  /**
   * Verify API call was made
   */
  wasCallMade(method: string, pathPattern: RegExp): boolean {
    return this.apiCalls.some(call =>
      call.method === method && pathPattern.test(call.path)
    );
  }
}

/**
 * Create a mock fetch function for Cloudflare API testing
 */
export function createMockFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method || 'GET';

    // Mock successful responses
    const mockResponse: CloudflareAPIResponse<any> = {
      success: true,
      errors: [],
      messages: [],
      result: {
        id: 'mock-id',
        name: 'mock-resource',
        created_on: new Date().toISOString()
      }
    };

    return new Response(JSON.stringify(mockResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };
}
