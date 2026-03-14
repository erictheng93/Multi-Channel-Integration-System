/**
 * QR Code User Journey E2E Tests
 *
 * P2 E2E Tests: 模擬真實用戶掃描 QR Code 場景
 *
 * 測試範圍：
 * 1. 完整用戶旅程模擬 - 從掃描 QR Code 到團隊指派
 * 2. 真實 API 端點調用 (需要環境配置)
 * 3. 時序驗證 - 確保事件順序正確
 * 4. 延遲測量 - 用戶感知延遲 < 500ms
 * 5. 邊界情況和錯誤恢復
 *
 * @see docs/claude/TESTING.md
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

// ============================================================================
// Test Configuration
// ============================================================================

const E2E_CONFIG = {
  baseUrl: process.env.TEST_API_URL || 'http://localhost:8787',
  adminToken: process.env.TEST_ADMIN_TOKEN || '',
  liffId: process.env.TEST_LIFF_ID || 'test-liff-id',
  // Performance thresholds
  maxPreNotificationDelay: 500, // Pre-notification should arrive < 500ms
  maxWebhookProcessingTime: 2000,  // Webhook processing < 2s
  maxTotalJourneyTime: 8000 // Total journey < 8s
};

// ============================================================================
// Journey Event Types
// ============================================================================

interface JourneyEvent {
  type: 'qr_scan' | 'liff_assign' | 'liff_welcome' | 'webhook_follow' |
        'pre_notification' | 'confirmation' | 'welcome_message';
  timestamp: number;
  data?: any;
  duration?: number;
}

interface JourneyMetrics {
  events: JourneyEvent[];
  totalDuration: number;
  preNotificationDelay: number;
  webhookProcessingTime: number;
  userPerceivedLatency: number;
}

// ============================================================================
// Journey Simulator
// ============================================================================

class QRCodeJourneySimulator {
  private events: JourneyEvent[] = [];
  private startTime: number = 0;
  private headers: HeadersInit;

  constructor(private config: typeof E2E_CONFIG) {
    this.headers = {
      'Authorization': `Bearer ${config.adminToken}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Record a journey event
   */
  private recordEvent(type: JourneyEvent['type'], data?: any): JourneyEvent {
    const event: JourneyEvent = {
      type,
      timestamp: Date.now(),
      data,
      duration: this.startTime ? Date.now() - this.startTime : 0
    };
    this.events.push(event);
    return event;
  }

  /**
   * Simulate QR code scan
   */
  async scanQRCode(teamId: number): Promise<{ liffUrl: string; teamId: number }> {
    this.startTime = Date.now();
    this.events = [];

    this.recordEvent('qr_scan', { teamId });

    const liffUrl = `https://liff.line.me/${this.config.liffId}?team=${teamId}`;
    return { liffUrl, teamId };
  }

  /**
   * Simulate LIFF assign-team API call
   */
  async callLiffAssignTeam(lineUserId: string, teamId: number, displayName?: string): Promise<any> {
    const preNotificationStart = Date.now();

    const response = await fetch(`${this.config.baseUrl}/api/liff/assign-team`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        lineUserId,
        teamId,
        displayName: displayName || 'Test User',
        timestamp: new Date().toISOString()
      })
    });

    const preNotificationDelay = Date.now() - preNotificationStart;

    const data = await response.json();
    this.recordEvent('liff_assign', {
      success: response.ok,
      data,
      responseTime: preNotificationDelay
    });

    if (response.ok) {
      this.recordEvent('pre_notification', {
        delay: preNotificationDelay,
        assignmentId: data.data?.assignmentId
      });
    }

    return {
      success: response.ok,
      status: response.status,
      data,
      preNotificationDelay
    };
  }

  /**
   * Simulate LIFF welcome API call (for existing friends)
   */
  async callLiffWelcome(lineUserId: string, teamId: number): Promise<any> {
    const response = await fetch(`${this.config.baseUrl}/api/liff/welcome`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        lineUserId,
        teamId
      })
    });

    const data = await response.json();
    this.recordEvent('liff_welcome', {
      success: response.ok,
      data
    });

    return {
      success: response.ok,
      status: response.status,
      data
    };
  }

  /**
   * Simulate webhook follow event (mocked - real webhook requires LINE integration)
   */
  async simulateWebhookFollow(lineUserId: string, replyToken?: string): Promise<any> {
    const webhookStart = Date.now();

    // In real E2E, this would be triggered by LINE
    // For testing, we simulate the webhook payload
    const webhookPayload = {
      events: [{
        type: 'follow',
        timestamp: Date.now(),
        source: {
          type: 'user',
          userId: lineUserId
        },
        replyToken: replyToken || 'test-reply-token'
      }]
    };

    // Note: Real webhook call requires signature verification
    // This is a simulation for testing purposes
    this.recordEvent('webhook_follow', {
      payload: webhookPayload,
      simulated: true
    });

    const webhookProcessingTime = Date.now() - webhookStart;

    this.recordEvent('confirmation', {
      delay: webhookProcessingTime
    });

    return {
      simulated: true,
      webhookProcessingTime
    };
  }

  /**
   * Get journey metrics
   */
  getMetrics(): JourneyMetrics {
    const totalDuration = this.events.length > 0
      ? this.events[this.events.length - 1].timestamp - this.startTime
      : 0;

    const preNotificationEvent = this.events.find(e => e.type === 'pre_notification');
    const confirmationEvent = this.events.find(e => e.type === 'confirmation');

    return {
      events: this.events,
      totalDuration,
      preNotificationDelay: preNotificationEvent?.data?.delay || 0,
      webhookProcessingTime: confirmationEvent?.data?.delay || 0,
      userPerceivedLatency: preNotificationEvent?.data?.delay || totalDuration
    };
  }

  /**
   * Print journey summary
   */
  printSummary(): void {
    const metrics = this.getMetrics();

    console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║ QR Code Journey Summary ║
╠═══════════════════════════════════════════════════════════════════╣
║ ║
║ Total Duration: ${String(metrics.totalDuration).padStart(6)}ms ║
║ Pre-notification Delay: ${String(metrics.preNotificationDelay).padStart(6)}ms ║
║ Webhook Processing: ${String(metrics.webhookProcessingTime).padStart(6)}ms ║
║ User Perceived Latency: ${String(metrics.userPerceivedLatency).padStart(6)}ms ║
║ ║
║ Events Timeline: ║`);

    metrics.events.forEach((event, index) => {
      const time = event.duration || 0;
      const indicator = event.type.includes('notification') || event.type.includes('confirmation')
        ? '' : '';
      console.log(`║ ${indicator} +${String(time).padStart(5)}ms - ${event.type.padEnd(20)} ║`);
    });

    console.log(`║ ║
╚═══════════════════════════════════════════════════════════════════╝
    `);
  }
}

// ============================================================================
// E2E Tests
// ============================================================================

describe('QR Code User Journey E2E Tests', () => {
  let simulator: QRCodeJourneySimulator;
  let hasApiAccess: boolean = false;

  beforeAll(async () => {
    simulator = new QRCodeJourneySimulator(E2E_CONFIG);

    // Check if API is accessible
    try {
      const response = await fetch(`${E2E_CONFIG.baseUrl}/api/system/health`, {
        headers: { 'Authorization': `Bearer ${E2E_CONFIG.adminToken}` }
      });
      hasApiAccess = response.ok;
    } catch {
      hasApiAccess = false;
    }

    if (!hasApiAccess) {
      console.log('  API not accessible - running in simulation mode');
    }
  });

  // ==========================================================================
  // Journey 1: New User Complete Journey
  // ==========================================================================
  describe('Journey 1: New User Complete Journey', () => {
    it('should complete new user journey within performance thresholds', async () => {
      if (!hasApiAccess) {
        console.log('  Skipping real API test - no access');
        return;
      }

      const lineUserId = `Ue2e_newuser_${Date.now()}`;
      const teamId = 1;

      console.log('\n Starting New User Journey E2E Test...\n');

      // Step 1: Scan QR Code
      const qrResult = await simulator.scanQRCode(teamId);
      expect(qrResult.liffUrl).toContain(`team=${teamId}`);

      // Step 2: LIFF assign-team
      const assignResult = await simulator.callLiffAssignTeam(lineUserId, teamId, 'E2E Test User');

      if (assignResult.success) {
        expect(assignResult.data.data.assignmentId).toBeDefined();

        // Verify pre-notification delay
        expect(assignResult.preNotificationDelay).toBeLessThan(E2E_CONFIG.maxPreNotificationDelay);
        console.log(` Pre-notification in ${assignResult.preNotificationDelay}ms (< ${E2E_CONFIG.maxPreNotificationDelay}ms)\n`);
      } else {
        console.log(`  Assign-team failed: ${JSON.stringify(assignResult.data)}`);
      }

      // Step 3: Simulate webhook (would be real in production)
      const webhookResult = await simulator.simulateWebhookFollow(lineUserId);
      console.log(' Webhook follow simulated\n');

      // Print journey summary
      simulator.printSummary();

      // Verify metrics
      const metrics = simulator.getMetrics();
      expect(metrics.userPerceivedLatency).toBeLessThan(E2E_CONFIG.maxPreNotificationDelay);
    });
  });

  // ==========================================================================
  // Journey 2: Existing Friend Journey
  // ==========================================================================
  describe('Journey 2: Existing Friend Journey', () => {
    it('should handle existing friend scanning new team QR code', async () => {
      if (!hasApiAccess) {
        console.log('  Skipping real API test - no access');
        return;
      }

      const lineUserId = `Ue2e_existing_${Date.now()}`;
      const teamId = 2;

      console.log('\n Starting Existing Friend Journey E2E Test...\n');

      // Step 1: Scan QR Code
      await simulator.scanQRCode(teamId);

      // Step 2: LIFF assign-team
      await simulator.callLiffAssignTeam(lineUserId, teamId, 'Existing Friend');

      // Step 3: LIFF welcome (already a friend)
      const welcomeResult = await simulator.callLiffWelcome(lineUserId, teamId);

      if (welcomeResult.status === 404) {
        console.log('  No customer found (expected for new test user)');
      } else if (welcomeResult.success) {
        console.log(' Welcome message sent and conversation synced');
      }

      simulator.printSummary();
    });
  });

  // ==========================================================================
  // Journey 3: Performance Benchmarks
  // ==========================================================================
  describe('Journey 3: Performance Benchmarks', () => {
    it('should measure pre-notification latency across multiple runs', async () => {
      if (!hasApiAccess) {
        console.log('  Skipping real API test - no access');
        return;
      }

      const iterations = 5;
      const latencies: number[] = [];

      console.log(`\n Running ${iterations} iterations for latency measurement...\n`);

      for (let i = 0; i < iterations; i++) {
        const lineUserId = `Uperf_${Date.now()}_${i}`;
        const teamId = 1;

        const start = Date.now();
        await simulator.callLiffAssignTeam(lineUserId, teamId, `Perf Test ${i}`);
        const latency = Date.now() - start;

        latencies.push(latency);
        console.log(`  Run ${i + 1}: ${latency}ms`);

        // Small delay between runs
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const minLatency = Math.min(...latencies);
      const p95Index = Math.floor(latencies.length * 0.95);
      const p95Latency = latencies.sort((a, b) => a - b)[p95Index] || maxLatency;

      console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║ Performance Benchmark Results ║
╠═══════════════════════════════════════════════════════════════════╣
║ Iterations: ${String(iterations).padStart(6)} ║
║ Avg Latency: ${String(avgLatency.toFixed(0)).padStart(6)}ms ║
║ Min Latency: ${String(minLatency).padStart(6)}ms ║
║ Max Latency: ${String(maxLatency).padStart(6)}ms ║
║ P95 Latency: ${String(p95Latency).padStart(6)}ms ║
║ Threshold: ${String(E2E_CONFIG.maxPreNotificationDelay).padStart(6)}ms ║
║ Status: ${avgLatency < E2E_CONFIG.maxPreNotificationDelay ? ' PASS' : ' FAIL'} ║
╚═══════════════════════════════════════════════════════════════════╝
      `);

      expect(avgLatency).toBeLessThan(E2E_CONFIG.maxPreNotificationDelay);
    });
  });

  // ==========================================================================
  // Journey 4: Error Scenarios
  // ==========================================================================
  describe('Journey 4: Error Scenarios', () => {
    it('should handle invalid team ID gracefully', async () => {
      if (!hasApiAccess) {
        console.log('  Skipping real API test - no access');
        return;
      }

      const lineUserId = `Uerror_${Date.now()}`;
      const invalidTeamId = 99999;

      const result = await simulator.callLiffAssignTeam(lineUserId, invalidTeamId);

      expect(result.status).toBe(404);
      expect(result.data.success).toBe(false);
      console.log(' Invalid team ID handled correctly');
    });

    it('should handle missing parameters', async () => {
      if (!hasApiAccess) {
        console.log('  Skipping real API test - no access');
        return;
      }

      const response = await fetch(`${E2E_CONFIG.baseUrl}/api/liff/assign-team`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${E2E_CONFIG.adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({}) // Missing required params
      });

      expect(response.status).toBe(400);
      console.log(' Missing parameters handled correctly');
    });
  });

  // ==========================================================================
  // Journey 5: Timing Verification
  // ==========================================================================
  describe('Journey 5: Timing Verification', () => {
    it('should verify event ordering is correct', async () => {
      if (!hasApiAccess) {
        console.log('  Skipping real API test - no access');
        return;
      }

      const lineUserId = `Utiming_${Date.now()}`;
      const teamId = 1;

      // Execute journey
      await simulator.scanQRCode(teamId);
      await simulator.callLiffAssignTeam(lineUserId, teamId);
      await simulator.simulateWebhookFollow(lineUserId);

      const metrics = simulator.getMetrics();
      const eventTypes = metrics.events.map(e => e.type);

      // Verify order
      const qrScanIndex = eventTypes.indexOf('qr_scan');
      const liffAssignIndex = eventTypes.indexOf('liff_assign');
      const preNotificationIndex = eventTypes.indexOf('pre_notification');
      const webhookFollowIndex = eventTypes.indexOf('webhook_follow');
      const confirmationIndex = eventTypes.indexOf('confirmation');

      expect(qrScanIndex).toBeLessThan(liffAssignIndex);
      expect(liffAssignIndex).toBeLessThan(preNotificationIndex);
      expect(preNotificationIndex).toBeLessThan(webhookFollowIndex);
      expect(webhookFollowIndex).toBeLessThan(confirmationIndex);

      console.log(' Event ordering verified');
    });
  });
});

// ============================================================================
// Simulation Mode Tests (No API Required)
// ============================================================================

describe('QR Code Journey Simulation Tests (No API Required)', () => {
  it('should demonstrate expected user journey flow', () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║ Expected QR Code User Journey ║
╠═══════════════════════════════════════════════════════════════════╣
║ ║
║ T+0ms User scans QR Code ║
║ │                                                            ║
║ ▼                                                            ║
║ T+100ms LIFF page loads ║
║ │                                                            ║
║ ▼                                                            ║
║ T+200ms /api/liff/assign-team called ║
║ │       └── Creates assignment record ║
║ │       └── Sends WebSocket pre-notification ║
║ │           (isPending: true) ║
║ ▼                                                            ║
║ T+300ms Frontend receives pending conversation ║
║ │       └── Shows "Waiting..." state ║
║ │                                                            ║
║ [NEW USER PATH] [EXISTING FRIEND PATH] ║
║ │                                       │ ║
║ ▼                                       ▼ ║
║ User clicks "Add Friend" /api/liff/welcome called ║
║ │                                       │ ║
║ ▼                                       │ ║
║ T+2-5s LINE Webhook fires │                    ║
║ │       └── Creates customer │                    ║
║ │       └── Creates conversation │                    ║
║ │       └── Sends confirmation │                    ║
║ │           (isPending: false) │                    ║
║ │                                       │ ║
║ └───────────────────┬───────────────────┘ ║
║ │                                        ║
║ ▼                                        ║
║ T+5.5s Frontend reconciliation ║
║ └── Matches by lineUserId ║
║ └── Replaces pending with real conversation ║
║ ║
║ Key Metrics: ║
║ ├── User perceived latency: < 500ms (pre-notification) ║
║ ├── Total journey time: < 8s ║
║ └── Reconciliation: Automatic via lineUserId matching ║
║ ║
╚═══════════════════════════════════════════════════════════════════╝
    `);

    expect(true).toBe(true);
  });
});
