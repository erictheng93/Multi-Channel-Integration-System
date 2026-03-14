#!/usr/bin/env node
/**
 * WebSocket Migration Configuration Setup Script
 *
 * This script initializes the WebSocket migration configuration in Cloudflare KV
 *
 * Usage:
 * npm run setup:websocket
 *
 * Or with custom settings:
 * tsx scripts/setup-websocket-config.ts --enable-websocket=true --rollout=100
 */

interface MigrationConfig {
  enableWebSocket: boolean;
  enableSSE: boolean;
  migrationStrategy: 'gradual' | 'immediate' | 'canary';
  rolloutPercentage: number;
  featureFlags: {
    websocketConnections: boolean;
    durableObjectMessaging: boolean;
    distributedLocking: boolean;
    batchMessageProcessing: boolean;
    realTimeTypingIndicators: boolean;
  };
}

// Default production configuration
const defaultConfig: MigrationConfig = {
  enableWebSocket: true,
  enableSSE: true,
  migrationStrategy: 'gradual',
  rolloutPercentage: 100, // 100% rollout for production-ready deployment
  featureFlags: {
    websocketConnections: true,
    durableObjectMessaging: true,
    distributedLocking: true,
    batchMessageProcessing: true,
    realTimeTypingIndicators: true
  }
};

// Conservative staging configuration
const stagingConfig: MigrationConfig = {
  ...defaultConfig,
  migrationStrategy: 'canary',
  rolloutPercentage: 10 // Start with 10% traffic
};

// Parse command line arguments
function parseArgs(): Partial<MigrationConfig> {
  const args = process.argv.slice(2);
  const config: Partial<MigrationConfig> = {};

  args.forEach(arg => {
    const [key, value] = arg.split('=');

    switch (key) {
      case '--enable-websocket':
        config.enableWebSocket = value === 'true';
        break;
      case '--enable-sse':
        config.enableSSE = value === 'true';
        break;
      case '--rollout':
        config.rolloutPercentage = parseInt(value, 10);
        break;
      case '--environment':
        // Handled separately
        break;
    }
  });

  return config;
}

// Get environment from args
function getEnvironment(): 'production' | 'staging' | 'development' {
  const envArg = process.argv.find(arg => arg.startsWith('--environment='));
  if (envArg) {
    const env = envArg.split('=')[1];
    if (env === 'production' || env === 'staging' || env === 'development') {
      return env;
    }
  }
  return 'production';
}

async function main() {
  console.log(' WebSocket Migration Configuration Setup\n');

  const environment = getEnvironment();
  const customArgs = parseArgs();

  // Select base config based on environment
  let baseConfig: MigrationConfig;
  switch (environment) {
    case 'staging':
      baseConfig = stagingConfig;
      break;
    case 'development':
      baseConfig = { ...stagingConfig, rolloutPercentage: 100 };
      break;
    default:
      baseConfig = defaultConfig;
  }

  // Merge with custom arguments
  const finalConfig: MigrationConfig = {
    ...baseConfig,
    ...customArgs
  };

  console.log(` Configuration for ${environment.toUpperCase()}:`);
  console.log(JSON.stringify(finalConfig, null, 2));
  console.log('');

  console.log(' To apply this configuration, run ONE of the following commands:\n');

  console.log('Using wrangler CLI:');
  console.log(`wrangler kv:key put --binding=SESSIONS "websocket_migration_config" '${JSON.stringify(finalConfig)}' --env=${environment === 'production' ? 'production' : environment}`);
  console.log('');

  console.log('Or using curl (requires Cloudflare API token):');
  console.log(`curl -X PUT "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/storage/kv/namespaces/YOUR_KV_ID/values/websocket_migration_config" \\`);
  console.log(`  -H "Authorization: Bearer YOUR_API_TOKEN" \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '${JSON.stringify(finalConfig)}'`);
  console.log('');

  console.log(' Quick configurations:\n');
  console.log('Staging (10% rollout):');
  console.log('  npm run setup:websocket -- --environment=staging');
  console.log('');
  console.log('Production (100% rollout):');
  console.log('  npm run setup:websocket -- --environment=production');
  console.log('');
  console.log('Disable WebSocket (SSE fallback only):');
  console.log('  npm run setup:websocket -- --enable-websocket=false');
  console.log('');

  console.log(' Configuration ready for deployment!');
  console.log('');
  console.log(' After deployment, verify with:');
  console.log('  curl https://your-domain.com/api/websocket/migration-status');
}

main().catch(console.error);
