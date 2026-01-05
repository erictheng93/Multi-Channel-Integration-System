/**
 * Config Generator Service
 *
 * Generates wrangler.toml and other configuration files
 * for the deployed CRM system
 */

import type { CloudflareResources, DeploymentConfig } from '../types/deployment';

export class ConfigGenerator {
  /**
   * Generate wrangler.toml for the CRM Worker
   * Phase 1 Enhancement: Adds support for user-provided URL and LINE configuration
   */
  generateWranglerConfig(
    projectName: string,
    resources: CloudflareResources,
    config: DeploymentConfig
  ): string {
    // Smart URL derivation
    const frontendUrl = config.frontendUrl ||
      (config.customDomain ? `https://${config.customDomain}` : '') ||
      resources.pagesUrl ||
      `https://${projectName}-frontend.pages.dev`;

    const backendUrl = config.backendUrl ||
      (config.customDomain ? `https://api.${config.customDomain}` : '') ||
      resources.workerUrl ||
      `https://${projectName}-worker.<account>.workers.dev`;

    const r2PublicUrl = config.r2PublicUrl ||
      `https://pub-<hash>.r2.dev`;  // Cloudflare default R2 public URL

    // Generate routes section if custom domain is provided
    const routesSection = config.customDomain ? `
# Production routes
[[routes]]
pattern = "${config.customDomain}/*"
zone_name = "${this.extractZoneName(config.customDomain)}"
` : '';

    return `
name = "${projectName}-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[durable_objects]
bindings = [
  { name = "CONVERSATION_ROOM", class_name = "ConversationRoom" },
  { name = "USER_CONNECTION", class_name = "UserConnection" },
  { name = "MESSAGE_BROADCASTER", class_name = "MessageBroadcaster" },
  { name = "DELAYED_MESSAGE_PROCESSOR", class_name = "DelayedMessageProcessor" },
  { name = "DELAYED_MESSAGE_BUFFER", class_name = "DelayedMessageBuffer" },
  { name = "CUSTOMER_CONVERSATION_DO", class_name = "CustomerConversationDO" },
  { name = "CUSTOMER_MESSAGE_DO", class_name = "CustomerMessageDO" }
]

[[migrations]]
tag = "v1"
new_classes = [
  "ConversationRoom",
  "UserConnection",
  "MessageBroadcaster",
  "DelayedMessageProcessor",
  "DelayedMessageBuffer"
]

[[migrations]]
tag = "v2"
new_classes = ["CustomerConversationDO", "CustomerMessageDO"]

[[d1_databases]]
binding = "DB"
database_name = "${projectName}-db"
database_id = "${resources.d1DatabaseId}"

[[kv_namespaces]]
binding = "SESSION_KV"
id = "${resources.kvSessionNamespaceId}"

[[kv_namespaces]]
binding = "CACHE_KV"
id = "${resources.kvCacheNamespaceId}"

[[r2_buckets]]
binding = "FILE_STORAGE"
bucket_name = "${resources.r2BucketName}"

[[queues.producers]]
binding = "MESSAGE_QUEUE"
queue = "${resources.queueName}"

[[queues.consumers]]
queue = "${resources.queueName}"
max_batch_size = 10
max_batch_timeout = 30

[vars]
ENVIRONMENT = "production"
# Phase 1 Enhancement: User-configurable URLs and LINE settings
R2_PUBLIC_URL = "${r2PublicUrl}"
LINE_BOT_ID = "${config.lineBotId || ''}"
FRONTEND_URL = "${frontendUrl}"
LINE_LIFF_ID = "${config.lineLiffId || ''}"
LOG_LEVEL = "${config.logLevel || 'info'}"
# Auto-generated secrets
JWT_SECRET = "${this.generateSecret(32)}"
ENCRYPTION_KEY = "${this.generateSecret(32)}"
${routesSection}
# Worker URL will be: ${backendUrl}
`.trim();
  }

  /**
   * Generate environment variables for frontend
   * Phase 1 Enhancement: Comprehensive environment variable generation
   */
  generateFrontendEnv(
    resources: CloudflareResources,
    config: DeploymentConfig
  ): string {
    // Smart URL derivation (same logic as wrangler config)
    const backendUrl = config.backendUrl ||
      (config.customDomain ? `https://api.${config.customDomain}` : '') ||
      resources.workerUrl ||
      '';

    const frontendUrl = config.frontendUrl ||
      (config.customDomain ? `https://${config.customDomain}` : '') ||
      resources.pagesUrl ||
      '';

    const storageUrl = config.r2PublicUrl ||
      `https://pub-<hash>.r2.dev`;

    const wsUrl = backendUrl
      .replace('https://', 'wss://')
      .replace('http://', 'ws://');

    return `
# ===== Backend Configuration =====
VITE_BACKEND_URL=${backendUrl}
VITE_FRONTEND_URL=${frontendUrl}
VITE_STORAGE_PUBLIC_URL=${storageUrl}

# ===== WebSocket Configuration =====
VITE_WEBSOCKET_URL=${wsUrl}/ws

# ===== Environment =====
VITE_ENVIRONMENT=production

# ===== Backward Compatibility (Legacy) =====
VITE_API_BASE_URL=${backendUrl}
VITE_WS_BASE_URL=${wsUrl}
VITE_APP_URL=${frontendUrl}
`.trim();
  }

  /**
   * Generate deployment summary
   */
  generateDeploymentSummary(
    projectName: string,
    resources: CloudflareResources,
    adminEmail: string
  ): string {
    return `
# CRM System Deployment Summary

## Project Information
- **Project Name:** ${projectName}
- **Deployment Date:** ${new Date().toISOString()}
- **Admin Email:** ${adminEmail}

## Deployed Resources

### Cloudflare Resources
- **D1 Database:** ${resources.d1DatabaseId}
- **KV Session Namespace:** ${resources.kvSessionNamespaceId}
- **KV Cache Namespace:** ${resources.kvCacheNamespaceId}
- **R2 Bucket:** ${resources.r2BucketName}
- **Queue:** ${resources.queueName}
- **Worker:** ${resources.workerId}
- **Pages Project:** ${resources.pagesProjectId}

### Application URLs
- **Frontend:** ${resources.pagesUrl}
- **Backend API:** ${resources.workerUrl}

## Next Steps

1. **Login to your CRM:**
   - URL: ${resources.pagesUrl}
   - Use the credentials sent to your email

2. **Change your password:**
   - Go to Settings → Account → Change Password
   - Use a strong, unique password

3. **Set up LINE OA integration:**
   - Go to Settings → Channels → LINE OA
   - Enter your LINE Channel credentials
   - Configure webhook URL

4. **Invite team members:**
   - Go to Team Management
   - Add members with their email addresses

## Support

If you encounter any issues:
- Email: support@yourcompany.com
- Documentation: https://docs.yourcompany.com
- Discord: https://discord.gg/yourcompany

---
Generated by CRM Web Installer v1.0.0
`.trim();
  }

  /**
   * Generate a random secret
   */
  private generateSecret(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let secret = '';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);

    for (let i = 0; i < length; i++) {
      secret += chars[array[i] % chars.length];
    }

    return secret;
  }

  /**
   * Generate random password for admin user
   */
  generateAdminPassword(): string {
    return this.generateSecret(16);
  }

  /**
   * Extract zone name from domain (e.g., "crm.example.com" → "example.com")
   * Phase 1 Enhancement: Helper method for route configuration
   */
  private extractZoneName(domain: string): string {
    const parts = domain.split('.');
    if (parts.length >= 2) {
      // Take the last two parts (e.g., example.com from crm.example.com)
      return parts.slice(-2).join('.');
    }
    return domain;
  }
}
