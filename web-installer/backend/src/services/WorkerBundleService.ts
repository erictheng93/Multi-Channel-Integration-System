/**
 * Worker Bundle Service
 *
 * Provides pre-built, bundled Worker code for deployment
 * The bundle is generated from the main CRM project during build
 */

import type { WorkerBinding } from '../types/cloudflare';
import type { CloudflareResources, DeploymentConfig } from '../types/deployment';

export interface WorkerBundleConfig {
  projectName: string;
  resources: CloudflareResources;
  config: DeploymentConfig;
  jwtSecret: string;
  encryptionKey: string;
}

export class WorkerBundleService {
  /**
   * Generate bindings for the Worker
   */
  generateBindings(resources: CloudflareResources, projectName: string): WorkerBinding[] {
    const bindings: WorkerBinding[] = [];

    // D1 Database binding
    if (resources.d1DatabaseId) {
      bindings.push({
        type: 'd1',
        name: 'DB',
        id: resources.d1DatabaseId
      });
    }

    // KV Session binding
    if (resources.kvSessionNamespaceId) {
      bindings.push({
        type: 'kv_namespace',
        name: 'SESSION_KV',
        id: resources.kvSessionNamespaceId
      });
    }

    // KV Cache binding
    if (resources.kvCacheNamespaceId) {
      bindings.push({
        type: 'kv_namespace',
        name: 'CACHE_KV',
        id: resources.kvCacheNamespaceId
      });
    }

    // R2 Bucket binding
    if (resources.r2BucketName) {
      bindings.push({
        type: 'r2_bucket',
        name: 'FILE_STORAGE',
        bucket_name: resources.r2BucketName
      });
    }

    // Queue binding
    if (resources.queueName) {
      bindings.push({
        type: 'queue',
        name: 'MESSAGE_QUEUE',
        queue_name: resources.queueName
      });
    }

    // Durable Object bindings
    const durableObjects = [
      'ConversationRoom',
      'UserConnection',
      'MessageBroadcaster',
      'DelayedMessageProcessor',
      'DelayedMessageBuffer',
      'CustomerConversationDO',
      'CustomerMessageDO'
    ];

    durableObjects.forEach(className => {
      bindings.push({
        type: 'durable_object_namespace',
        name: className.replace(/([A-Z])/g, '_$1').toUpperCase().slice(1),
        class_name: className,
        script_name: `${projectName}-worker`
      });
    });

    return bindings;
  }

  /**
   * Generate environment variables for the Worker
   */
  generateEnvVars(config: WorkerBundleConfig): Record<string, string> {
    const env: Record<string, string> = {
      ENVIRONMENT: 'production',
      JWT_SECRET: config.jwtSecret,
      ENCRYPTION_KEY: config.encryptionKey
    };

    // Add LINE integration if configured
    if (config.config.lineChannelAccessToken) {
      env.LINE_CHANNEL_ACCESS_TOKEN = config.config.lineChannelAccessToken;
    }
    if (config.config.lineChannelSecret) {
      env.LINE_CHANNEL_SECRET = config.config.lineChannelSecret;
    }

    // Add Facebook integration if configured
    if (config.config.facebookPageAccessToken) {
      env.FACEBOOK_PAGE_ACCESS_TOKEN = config.config.facebookPageAccessToken;
    }
    if (config.config.facebookAppSecret) {
      env.FACEBOOK_APP_SECRET = config.config.facebookAppSecret;
    }

    return env;
  }

  /**
   * Get the bundled Worker script
   *
   * NOTE: In production, this should return the actual minified/bundled Worker code
   * from the main CRM project. For now, it returns a minimal Worker that:
   * 1. Handles health checks
   * 2. Imports the full CRM Worker module (to be bundled)
   *
   * The actual bundle should be generated using:
   * - esbuild or webpack to bundle the main project
   * - Include all Durable Object classes
   * - Minify for production
   */
  getBundledWorkerScript(): string {
    // This is a placeholder. In production, this would be the actual bundled CRM Worker
    // The bundle should be generated from the main project and embedded here
    return BUNDLED_WORKER_SCRIPT;
  }

  /**
   * Generate secrets for the Worker
   */
  generateSecrets(): { jwtSecret: string; encryptionKey: string } {
    return {
      jwtSecret: this.generateSecureSecret(64),
      encryptionKey: this.generateSecureSecret(64)
    };
  }

  /**
   * Generate a cryptographically secure secret
   */
  private generateSecureSecret(length: number): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

/**
 * Bundled Worker Script
 *
 * This is a PLACEHOLDER that should be replaced with the actual bundled CRM Worker
 * during the build process.
 *
 * To generate the actual bundle:
 * 1. Run `npm run build:worker-bundle` in the main project
 * 2. Copy the output to this constant
 * 3. Or use a build script to embed it automatically
 */
const BUNDLED_WORKER_SCRIPT = `
// CRM Worker Bundle - Placeholder
// This should be replaced with the actual bundled Worker code

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check endpoint
    if (url.pathname === '/health' || url.pathname === '/api/system/health') {
      return new Response(JSON.stringify({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: env.ENVIRONMENT || 'production'
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // API version endpoint
    if (url.pathname === '/api/version') {
      return new Response(JSON.stringify({
        version: '1.0.0',
        name: 'CRM System',
        deployed: new Date().toISOString()
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // TODO: Import and use the actual CRM Worker handlers
    // This placeholder should be replaced with:
    // import { app } from './src/index';
    // return app.fetch(request, env, ctx);

    return new Response(JSON.stringify({
      error: 'Worker bundle not yet configured',
      message: 'Please replace the placeholder with the actual CRM Worker bundle'
    }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
};
`;
