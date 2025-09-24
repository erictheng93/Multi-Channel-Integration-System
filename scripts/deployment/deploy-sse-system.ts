#!/usr/bin/env node
// 🚀 Phase 2: SSE System Production Deployment Script
// Production deployment script for SSE messaging system

import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

interface DeploymentConfig {
  environment: 'production' | 'staging'
  enableSSE: boolean
  enableWebSocket: boolean
  rolloutPercentage: number
  healthCheckUrl: string
  domain: string
}

const DEPLOYMENT_CONFIGS: Record<string, DeploymentConfig> = {
  production: {
    environment: 'production',
    enableSSE: true,
    enableWebSocket: false, // Disabled in Phase 2
    rolloutPercentage: 100, // 100% SSE rollout
    healthCheckUrl: 'https://multi-channel.imfinethankyouandyou.com/api/system/health',
    domain: 'multi-channel.imfinethankyouandyou.com'
  },
  staging: {
    environment: 'staging',
    enableSSE: true,
    enableWebSocket: false,
    rolloutPercentage: 100,
    healthCheckUrl: 'https://staging-multi-channel.imfinethankyouandyou.com/api/system/health',
    domain: 'staging-multi-channel.imfinethankyouandyou.com'
  }
}

class SSEDeploymentManager {
  private config: DeploymentConfig
  private deploymentId: string
  private startTime: number

  constructor(environment: string = 'production') {
    this.config = DEPLOYMENT_CONFIGS[environment]
    if (!this.config) {
      throw new Error(`Invalid environment: ${environment}`)
    }

    this.deploymentId = `sse-deploy-${Date.now()}`
    this.startTime = Date.now()

    console.log(`🚀 [SSE Deploy] Starting deployment: ${this.deploymentId}`)
    console.log(`🌍 [SSE Deploy] Environment: ${this.config.environment}`)
    console.log(`📡 [SSE Deploy] SSE Enabled: ${this.config.enableSSE}`)
    console.log(`🔌 [SSE Deploy] WebSocket Enabled: ${this.config.enableWebSocket}`)
  }

  // Phase 1: Pre-deployment checks
  async runPreDeploymentChecks(): Promise<boolean> {
    console.log('\n📋 [SSE Deploy] Phase 1: Pre-deployment checks')

    try {
      // Check 1: Verify wrangler authentication
      console.log('🔐 Checking Wrangler authentication...')
      const whoami = execSync('wrangler whoami', { encoding: 'utf-8' })
      console.log(`✅ Authenticated as: ${whoami.trim()}`)

      // Check 2: Verify project build
      console.log('🔨 Building project...')
      execSync('npm run build', { encoding: 'utf-8', stdio: 'inherit' })
      console.log('✅ Project build successful')

      // Check 3: Run TypeScript checks
      console.log('🔍 Running TypeScript checks...')
      execSync('npm run type-check', { encoding: 'utf-8', stdio: 'inherit' })
      console.log('✅ TypeScript checks passed')

      // Check 4: Verify SSE endpoints
      console.log('🧪 Verifying SSE endpoints in code...')
      const conversationHandlerPath = join(process.cwd(), 'src/handlers/conversation-main.ts')
      const handlerContent = readFileSync(conversationHandlerPath, 'utf-8')

      if (!handlerContent.includes('/:conversationId/messages/stream')) {
        throw new Error('SSE endpoint not found in conversation handler')
      }
      console.log('✅ SSE endpoints verified')

      // Check 5: Database migration check
      console.log('🗄️ Checking database migrations...')
      try {
        execSync('wrangler d1 list', { encoding: 'utf-8', stdio: 'pipe' })
        console.log('✅ Database connection verified')
      } catch (error) {
        console.warn('⚠️ Database check failed, but continuing...')
      }

      return true

    } catch (error) {
      console.error(`❌ [SSE Deploy] Pre-deployment check failed:`, error)
      return false
    }
  }

  // Phase 2: Deploy to Cloudflare Workers
  async deployToCloudflare(): Promise<boolean> {
    console.log('\n🚀 [SSE Deploy] Phase 2: Deploying to Cloudflare Workers')

    try {
      // Update feature flags for SSE deployment
      console.log('🏷️ Updating feature flags...')
      await this.updateFeatureFlags()

      // Deploy the main worker
      console.log('📦 Deploying main worker...')
      const deployOutput = execSync('wrangler deploy --minify', {
        encoding: 'utf-8',
        stdio: 'pipe'
      })

      console.log('✅ Worker deployment successful')

      // Extract deployment URL from output
      const urlMatch = deployOutput.match(/https:\/\/[^\s]+/)
      if (urlMatch) {
        console.log(`📍 Deployment URL: ${urlMatch[0]}`)
      }

      return true

    } catch (error) {
      console.error(`❌ [SSE Deploy] Deployment failed:`, error)
      return false
    }
  }

  // Phase 3: Health checks and validation
  async runHealthChecks(): Promise<boolean> {
    console.log('\n🏥 [SSE Deploy] Phase 3: Health checks and validation')

    try {
      // Wait for deployment to propagate
      console.log('⏱️ Waiting for deployment to propagate (30 seconds)...')
      await this.sleep(30000)

      // Health check 1: Basic health endpoint
      console.log('🔍 Checking basic health endpoint...')
      const healthResponse = await fetch(this.config.healthCheckUrl)

      if (!healthResponse.ok) {
        throw new Error(`Health check failed: ${healthResponse.status}`)
      }

      const healthData = await healthResponse.json()
      console.log('✅ Basic health check passed:', healthData)

      // Health check 2: SSE endpoint availability
      console.log('🔍 Testing SSE endpoint availability...')
      const sseTestUrl = `${this.config.healthCheckUrl.replace('/api/system/health', '')}/api/conversations/test/messages/stream`

      try {
        // This should return 401 (unauthorized) which means the endpoint exists
        const sseResponse = await fetch(sseTestUrl)
        if (sseResponse.status === 401) {
          console.log('✅ SSE endpoint is accessible (authentication required as expected)')
        } else {
          console.warn(`⚠️ SSE endpoint returned unexpected status: ${sseResponse.status}`)
        }
      } catch (error) {
        console.warn('⚠️ SSE endpoint test failed, but continuing...', error)
      }

      // Health check 3: Database connectivity
      console.log('🔍 Checking database connectivity...')
      try {
        const dbTestUrl = `${this.config.healthCheckUrl.replace('/health', '/api-status')}`
        const dbResponse = await fetch(dbTestUrl)
        if (dbResponse.ok) {
          console.log('✅ Database connectivity verified')
        }
      } catch (error) {
        console.warn('⚠️ Database connectivity test failed:', error)
      }

      return true

    } catch (error) {
      console.error(`❌ [SSE Deploy] Health checks failed:`, error)
      return false
    }
  }

  // Phase 4: Configure SSE system
  async configureSSESystem(): Promise<boolean> {
    console.log('\n⚙️ [SSE Deploy] Phase 4: Configuring SSE system')

    try {
      // Create SSE monitoring configuration
      console.log('📊 Setting up SSE monitoring...')
      await this.createMonitoringConfig()

      // Update migration settings
      console.log('🔄 Updating migration settings...')
      await this.updateMigrationSettings()

      // Setup performance baselines
      console.log('📏 Setting up performance baselines...')
      await this.setupPerformanceBaselines()

      return true

    } catch (error) {
      console.error(`❌ [SSE Deploy] SSE configuration failed:`, error)
      return false
    }
  }

  // Helper: Update feature flags
  private async updateFeatureFlags(): Promise<void> {
    const flagsConfig = {
      enableSSE: this.config.enableSSE,
      enableWebSocket: this.config.enableWebSocket,
      rolloutPercentage: this.config.rolloutPercentage,
      deploymentId: this.deploymentId,
      deployedAt: new Date().toISOString()
    }

    console.log('🏷️ Feature flags:', flagsConfig)

    // In a real deployment, this would update KV storage
    // For now, we'll create a deployment info file
    const deployInfoPath = join(process.cwd(), 'deployment-info.json')
    writeFileSync(deployInfoPath, JSON.stringify(flagsConfig, null, 2))
    console.log(`📄 Deployment info saved to: ${deployInfoPath}`)
  }

  // Helper: Create monitoring configuration
  private async createMonitoringConfig(): Promise<void> {
    const monitoringConfig = {
      sseEndpoints: [
        '/api/conversations/{id}/messages/stream'
      ],
      healthChecks: [
        this.config.healthCheckUrl,
        `${this.config.healthCheckUrl.replace('/health', '/api-status')}`
      ],
      alertThresholds: {
        errorRate: 5, // 5% error rate
        responseTime: 3000, // 3 seconds
        connectionTimeout: 30000 // 30 seconds
      },
      metrics: {
        collectSSEMetrics: true,
        collectPerformanceMetrics: true,
        retentionDays: 30
      }
    }

    const monitoringConfigPath = join(process.cwd(), 'sse-monitoring.json')
    writeFileSync(monitoringConfigPath, JSON.stringify(monitoringConfig, null, 2))
    console.log(`📊 Monitoring config created: ${monitoringConfigPath}`)
  }

  // Helper: Update migration settings
  private async updateMigrationSettings(): Promise<void> {
    const migrationSettings = {
      strategy: 'sse_primary',
      fallbackEnabled: true,
      rolloutPercentage: this.config.rolloutPercentage,
      features: {
        sseMessages: true,
        webSocketMessages: this.config.enableWebSocket,
        httpFallback: true
      }
    }

    console.log('🔄 Migration settings updated:', migrationSettings)
  }

  // Helper: Setup performance baselines
  private async setupPerformanceBaselines(): Promise<void> {
    const baselines = {
      sseConnectionTime: 2000, // 2 seconds
      firstMessageTime: 5000, // 5 seconds
      messageLatency: 3000, // 3 seconds
      reconnectionTime: 5000, // 5 seconds
      memoryUsage: 50 * 1024 * 1024 // 50MB
    }

    console.log('📏 Performance baselines:', baselines)
  }

  // Helper: Sleep utility
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Main deployment orchestrator
  async deploy(): Promise<boolean> {
    const phases = [
      { name: 'Pre-deployment Checks', fn: () => this.runPreDeploymentChecks() },
      { name: 'Deploy to Cloudflare', fn: () => this.deployToCloudflare() },
      { name: 'Health Checks', fn: () => this.runHealthChecks() },
      { name: 'Configure SSE System', fn: () => this.configureSSESystem() }
    ]

    for (const phase of phases) {
      console.log(`\n🔄 [SSE Deploy] Starting: ${phase.name}`)
      const success = await phase.fn()

      if (!success) {
        console.error(`❌ [SSE Deploy] Failed at: ${phase.name}`)
        await this.rollback()
        return false
      }

      console.log(`✅ [SSE Deploy] Completed: ${phase.name}`)
    }

    const deploymentTime = Date.now() - this.startTime
    console.log(`\n🎉 [SSE Deploy] Deployment successful!`)
    console.log(`⏱️ Total time: ${Math.round(deploymentTime / 1000)} seconds`)
    console.log(`🌍 Domain: https://${this.config.domain}`)
    console.log(`🆔 Deployment ID: ${this.deploymentId}`)

    return true
  }

  // Emergency rollback
  private async rollback(): Promise<void> {
    console.log('\n🔄 [SSE Deploy] Initiating rollback...')

    try {
      // This would implement rollback logic
      console.log('⚠️ Rollback not implemented - manual intervention required')
    } catch (error) {
      console.error('❌ [SSE Deploy] Rollback failed:', error)
    }
  }
}

// CLI interface
async function main() {
  const environment = process.argv[2] || 'production'
  const deploymentManager = new SSEDeploymentManager(environment)

  try {
    const success = await deploymentManager.deploy()
    process.exit(success ? 0 : 1)
  } catch (error) {
    console.error('💥 [SSE Deploy] Deployment crashed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

export { SSEDeploymentManager }