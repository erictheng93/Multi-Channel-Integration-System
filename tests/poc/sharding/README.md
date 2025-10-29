# Sharding System POC Testing Environment

## 🎯 Objective

Validate the feasibility of implementing automatic sharding for ConversationRoom Durable Objects by testing with **10,000 concurrent WebSocket connections** on a single shard.

## 📋 Test Phases

### Phase 1: Single Shard Validation (Baseline)
**Goal**: Confirm a single shard can handle 10,000 connections
**Duration**: 2-3 days

### Phase 2: Multi-Shard Distribution (Scaling)
**Goal**: Validate load distribution across 2-3 shards (20,000-30,000 connections)
**Duration**: 2-3 days

### Phase 3: Full-Scale Test (Production Simulation)
**Goal**: Test 50,000 connections across 5 shards
**Duration**: 2-3 days

---

## 🛠️ Test Environment Setup

### Prerequisites

```bash
# 1. Install dependencies
npm install

# 2. Install testing tools
npm install --save-dev ws   # WebSocket client library
npm install --save-dev pino # Logging

# 3. Set up local D1 database
npm run db:migrate

# 4. Start local Wrangler dev server
npm run dev:local
```

### Environment Configuration

Create `tests/poc/sharding/.env.test`:

```env
# Wrangler local dev server
TEST_WORKER_URL=http://localhost:8787

# Test parameters
TEST_CONVERSATION_ID=poc-test-conversation-001
TEST_MAX_CONNECTIONS=10000
TEST_CONCURRENT_BATCHES=100
TEST_RAMP_UP_DURATION_MS=30000
TEST_HOLD_DURATION_MS=60000

# Monitoring
TEST_METRICS_INTERVAL_MS=5000
TEST_LOG_LEVEL=info
```

---

## 📊 Test Scripts

### 1. Connection Load Generator

**File**: `tests/poc/sharding/connection-load-generator.ts`

```typescript
/**
 * Gradually ramps up WebSocket connections to simulate real-world traffic
 */

import WebSocket from 'ws';
import pino from 'pino';

const logger = pino({ level: process.env.TEST_LOG_LEVEL || 'info' });

interface LoadTestConfig {
  workerUrl: string;
  conversationId: string;
  maxConnections: number;
  rampUpDuration: number;
  holdDuration: number;
  metricsInterval: number;
}

interface ConnectionMetrics {
  totalAttempted: number;
  totalSuccess: number;
  totalFailed: number;
  activeConnections: number;
  averageLatency: number;
  messagesSent: number;
  messagesReceived: number;
}

export class ShardingLoadTester {
  private connections: WebSocket[] = [];
  private metrics: ConnectionMetrics = {
    totalAttempted: 0,
    totalSuccess: 0,
    totalFailed: 0,
    activeConnections: 0,
    averageLatency: 0,
    messagesSent: 0,
    messagesReceived: 0
  };
  private config: LoadTestConfig;
  private startTime: number = 0;
  private metricsInterval?: NodeJS.Timeout;

  constructor(config: LoadTestConfig) {
    this.config = config;
  }

  /**
   * Start the load test
   */
  async run(): Promise<void> {
    logger.info('🚀 Starting Sharding Load Test');
    logger.info(`Target: ${this.config.maxConnections} connections`);
    logger.info(`Ramp-up: ${this.config.rampUpDuration / 1000}s`);
    logger.info(`Hold: ${this.config.holdDuration / 1000}s`);

    this.startTime = Date.now();

    // Start metrics reporting
    this.startMetricsReporting();

    try {
      // Phase 1: Ramp up connections
      await this.rampUpConnections();

      // Phase 2: Hold connections stable
      await this.holdConnections();

      // Phase 3: Test message broadcasting
      await this.testMessageBroadcasting();

      // Phase 4: Graceful shutdown
      await this.shutdownConnections();

      this.reportFinalResults();
    } catch (error) {
      logger.error('❌ Load test failed:', error);
      throw error;
    } finally {
      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
      }
    }
  }

  /**
   * Gradually create connections (linear ramp-up)
   */
  private async rampUpConnections(): Promise<void> {
    logger.info('📈 Phase 1: Ramping up connections...');

    const connectionsPerSecond = this.config.maxConnections / (this.config.rampUpDuration / 1000);
    const batchSize = Math.ceil(connectionsPerSecond / 10); // 10 batches per second
    const batchInterval = 100; // 100ms between batches

    const totalBatches = Math.ceil(this.config.maxConnections / batchSize);

    for (let batch = 0; batch < totalBatches; batch++) {
      const connectionsInBatch = Math.min(
        batchSize,
        this.config.maxConnections - this.connections.length
      );

      // Create batch of connections in parallel
      const batchPromises = Array(connectionsInBatch)
        .fill(null)
        .map((_, i) => this.createConnection(batch * batchSize + i));

      await Promise.allSettled(batchPromises);

      // Wait before next batch
      await this.sleep(batchInterval);

      // Log progress every 10 batches
      if (batch % 10 === 0) {
        logger.info(`Progress: ${this.connections.length}/${this.config.maxConnections} connections`);
      }
    }

    logger.info(`✅ Ramp-up complete: ${this.connections.length} connections established`);
  }

  /**
   * Create a single WebSocket connection
   */
  private async createConnection(index: number): Promise<WebSocket | null> {
    const startTime = Date.now();
    this.metrics.totalAttempted++;

    try {
      const wsUrl = `${this.config.workerUrl}/api/websocket/conversation?conversationId=${this.config.conversationId}&token=test-token-${index}`;

      const ws = new WebSocket(wsUrl);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        ws.on('open', () => {
          clearTimeout(timeout);
          const latency = Date.now() - startTime;

          this.metrics.totalSuccess++;
          this.metrics.activeConnections++;
          this.metrics.averageLatency =
            (this.metrics.averageLatency * (this.metrics.totalSuccess - 1) + latency) /
            this.metrics.totalSuccess;

          // Set up message handler
          ws.on('message', (data) => {
            this.metrics.messagesReceived++;
          });

          ws.on('close', () => {
            this.metrics.activeConnections--;
          });

          ws.on('error', (error) => {
            logger.error(`Connection ${index} error:`, error.message);
          });

          this.connections.push(ws);
          resolve(ws);
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          this.metrics.totalFailed++;
          logger.warn(`Connection ${index} failed:`, error.message);
          reject(error);
        });
      });
    } catch (error) {
      this.metrics.totalFailed++;
      return null;
    }
  }

  /**
   * Hold connections stable for observation
   */
  private async holdConnections(): Promise<void> {
    logger.info(`⏸️  Phase 2: Holding ${this.connections.length} connections stable...`);

    const holdStartTime = Date.now();

    while (Date.now() - holdStartTime < this.config.holdDuration) {
      // Send periodic ping to keep connections alive
      await this.sendPingToAllConnections();
      await this.sleep(30000); // Ping every 30 seconds
    }

    logger.info('✅ Hold phase complete');
  }

  /**
   * Test message broadcasting to all connections
   */
  private async testMessageBroadcasting(): Promise<void> {
    logger.info('📡 Phase 3: Testing message broadcasting...');

    const testMessage = {
      type: 'message',
      data: {
        content: 'Load test broadcast message',
        timestamp: Date.now(),
        testId: crypto.randomUUID()
      }
    };

    const broadcastStartTime = Date.now();

    // Send message from first connection
    if (this.connections.length > 0 && this.connections[0].readyState === WebSocket.OPEN) {
      this.connections[0].send(JSON.stringify(testMessage));
      this.metrics.messagesSent++;
    }

    // Wait for messages to propagate (max 5 seconds)
    await this.sleep(5000);

    const broadcastLatency = Date.now() - broadcastStartTime;

    logger.info(`✅ Broadcast test complete`);
    logger.info(`   Latency: ${broadcastLatency}ms`);
    logger.info(`   Messages received: ${this.metrics.messagesReceived}`);
    logger.info(`   Success rate: ${(this.metrics.messagesReceived / this.connections.length * 100).toFixed(2)}%`);
  }

  /**
   * Send ping to all connections
   */
  private async sendPingToAllConnections(): Promise<void> {
    const pingMessage = { type: 'ping', timestamp: Date.now() };
    let sentCount = 0;

    for (const ws of this.connections) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(pingMessage));
          sentCount++;
        } catch (error) {
          // Ignore
        }
      }
    }

    this.metrics.messagesSent += sentCount;
  }

  /**
   * Gracefully close all connections
   */
  private async shutdownConnections(): Promise<void> {
    logger.info('🔌 Phase 4: Shutting down connections...');

    const closePromises = this.connections.map(ws => {
      return new Promise<void>(resolve => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.on('close', () => resolve());
          ws.close();

          // Force close after timeout
          setTimeout(() => {
            if (ws.readyState !== WebSocket.CLOSED) {
              ws.terminate();
            }
            resolve();
          }, 5000);
        } else {
          resolve();
        }
      });
    });

    await Promise.allSettled(closePromises);

    logger.info('✅ All connections closed');
  }

  /**
   * Start periodic metrics reporting
   */
  private startMetricsReporting(): void {
    this.metricsInterval = setInterval(() => {
      this.reportMetrics();
    }, this.config.metricsInterval);
  }

  /**
   * Report current metrics
   */
  private reportMetrics(): void {
    const elapsed = Date.now() - this.startTime;
    const elapsedMinutes = (elapsed / 60000).toFixed(2);

    logger.info('📊 Metrics Update:');
    logger.info(`   Elapsed: ${elapsedMinutes}min`);
    logger.info(`   Active: ${this.metrics.activeConnections}`);
    logger.info(`   Success: ${this.metrics.totalSuccess}`);
    logger.info(`   Failed: ${this.metrics.totalFailed}`);
    logger.info(`   Avg Latency: ${this.metrics.averageLatency.toFixed(2)}ms`);
    logger.info(`   Messages Sent: ${this.metrics.messagesSent}`);
    logger.info(`   Messages Received: ${this.metrics.messagesReceived}`);
  }

  /**
   * Report final test results
   */
  private reportFinalResults(): void {
    const elapsed = Date.now() - this.startTime;
    const elapsedMinutes = (elapsed / 60000).toFixed(2);

    logger.info('\n' + '='.repeat(60));
    logger.info('🎉 LOAD TEST COMPLETE');
    logger.info('='.repeat(60));
    logger.info(`Total Duration: ${elapsedMinutes} minutes`);
    logger.info(`Target Connections: ${this.config.maxConnections}`);
    logger.info(`Successful Connections: ${this.metrics.totalSuccess}`);
    logger.info(`Failed Connections: ${this.metrics.totalFailed}`);
    logger.info(`Success Rate: ${(this.metrics.totalSuccess / this.metrics.totalAttempted * 100).toFixed(2)}%`);
    logger.info(`Average Connection Latency: ${this.metrics.averageLatency.toFixed(2)}ms`);
    logger.info(`Total Messages Sent: ${this.metrics.messagesSent}`);
    logger.info(`Total Messages Received: ${this.metrics.messagesReceived}`);
    logger.info('='.repeat(60) + '\n');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the test
if (require.main === module) {
  const config: LoadTestConfig = {
    workerUrl: process.env.TEST_WORKER_URL || 'http://localhost:8787',
    conversationId: process.env.TEST_CONVERSATION_ID || 'poc-test-conversation-001',
    maxConnections: parseInt(process.env.TEST_MAX_CONNECTIONS || '10000'),
    rampUpDuration: parseInt(process.env.TEST_RAMP_UP_DURATION_MS || '30000'),
    holdDuration: parseInt(process.env.TEST_HOLD_DURATION_MS || '60000'),
    metricsInterval: parseInt(process.env.TEST_METRICS_INTERVAL_MS || '5000')
  };

  const tester = new ShardingLoadTester(config);

  tester.run()
    .then(() => {
      logger.info('✅ Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Test failed:', error);
      process.exit(1);
    });
}
```

---

## 🚀 Running the POC Tests

### Quick Start

```bash
# Terminal 1: Start Worker (local dev mode)
cd D:/Code/Multi_Channel_Integration_System
npm run dev:local

# Terminal 2: Run POC Test
cd tests/poc/sharding
npx ts-node connection-load-generator.ts
```

### Test Scenarios

#### Scenario 1: Baseline (1,000 connections)
```bash
TEST_MAX_CONNECTIONS=1000 \
TEST_RAMP_UP_DURATION_MS=10000 \
npx ts-node connection-load-generator.ts
```

#### Scenario 2: Moderate Load (5,000 connections)
```bash
TEST_MAX_CONNECTIONS=5000 \
TEST_RAMP_UP_DURATION_MS=20000 \
npx ts-node connection-load-generator.ts
```

#### Scenario 3: Target Load (10,000 connections)
```bash
TEST_MAX_CONNECTIONS=10000 \
TEST_RAMP_UP_DURATION_MS=30000 \
TEST_HOLD_DURATION_MS=60000 \
npx ts-node connection-load-generator.ts
```

---

## 📈 Expected Results

### Phase 1 Success Criteria

| Metric | Target | Pass/Fail Threshold |
|--------|--------|---------------------|
| Connection Success Rate | >95% | >90% = Pass |
| Average Connection Latency | <100ms | <200ms = Pass |
| Message Broadcast Latency | <2000ms | <5000ms = Pass |
| Message Delivery Success | >95% | >90% = Pass |
| System Stability | No crashes | 0 crashes = Pass |

### Sample Expected Output

```
🚀 Starting Sharding Load Test
Target: 10000 connections
Ramp-up: 30s
Hold: 60s

📈 Phase 1: Ramping up connections...
Progress: 1000/10000 connections
Progress: 2000/10000 connections
...
Progress: 10000/10000 connections
✅ Ramp-up complete: 10000 connections established

📊 Metrics Update:
   Elapsed: 0.50min
   Active: 10000
   Success: 10000
   Failed: 0
   Avg Latency: 45.23ms
   Messages Sent: 0
   Messages Received: 0

⏸️  Phase 2: Holding 10000 connections stable...
✅ Hold phase complete

📡 Phase 3: Testing message broadcasting...
✅ Broadcast test complete
   Latency: 1523ms
   Messages received: 9987
   Success rate: 99.87%

🔌 Phase 4: Shutting down connections...
✅ All connections closed

============================================================
🎉 LOAD TEST COMPLETE
============================================================
Total Duration: 1.67 minutes
Target Connections: 10000
Successful Connections: 10000
Failed Connections: 0
Success Rate: 100.00%
Average Connection Latency: 45.23ms
Total Messages Sent: 10334
Total Messages Received: 9987
============================================================
```

---

## 🔍 Monitoring During Tests

### Watch Worker Logs

```bash
# In separate terminal
npx wrangler tail --format pretty
```

### Monitor System Resources

```bash
# macOS/Linux
watch -n 1 'ps aux | grep wrangler'

# Windows PowerShell
while ($true) { Get-Process wrangler | Select-Object CPU, WorkingSet; Start-Sleep -Seconds 1; Clear-Host }
```

### Check Durable Objects Inspector

1. Open: http://localhost:8787/__inspect__
2. Navigate to: CONVERSATION_ROOM Durable Objects
3. Observe: Connection counts, memory usage, shard metadata

---

## 📝 Recording Results

### Create Test Report

**File**: `tests/poc/sharding/results/test-run-YYYY-MM-DD.md`

```markdown
# POC Load Test Results - [DATE]

## Test Configuration
- Target Connections: X
- Ramp-up Duration: Xs
- Hold Duration: Xs
- Test Environment: Local / Staging / Production

## Results
- ✅ / ❌ Connection Success Rate: X%
- ✅ / ❌ Avg Connection Latency: Xms
- ✅ / ❌ Broadcast Latency: Xms
- ✅ / ❌ Message Delivery Rate: X%

## Observations
- [Notable findings]
- [Performance bottlenecks]
- [Unexpected behaviors]

## Issues Encountered
1. [Issue description]
   - Root cause: [analysis]
   - Resolution: [fix applied]

## Recommendations
- [Next steps]
- [Optimizations needed]
```

---

## 🐛 Troubleshooting

### Common Issues

#### Issue: "Connection timeout" errors
**Cause**: Worker overloaded or network congestion
**Solution**: Reduce ramp-up rate, check worker CPU usage

#### Issue: "Error 429: Too Many Requests"
**Cause**: Rate limiting on Worker
**Solution**: Disable rate limits in dev mode or increase limits

#### Issue: WebSocket connections drop after 30s
**Cause**: Missing heartbeat/ping
**Solution**: Enable periodic ping in load generator (already implemented)

#### Issue: Memory exhaustion in local dev
**Cause**: 10,000 connections exceed local resources
**Solution**: Test on staging environment with production Workers

---

## ✅ POC Success Checklist

### Phase 1: Single Shard (10K connections)
- [ ] Establish 10,000 concurrent connections successfully
- [ ] Maintain connections stable for 60+ seconds
- [ ] Successfully broadcast message to all connections
- [ ] Connection success rate >95%
- [ ] Average latency <100ms
- [ ] No worker crashes or memory issues

### Phase 2: Multi-Shard (20K-30K connections)
- [ ] Test shard selection algorithm
- [ ] Verify connections distributed across multiple shards
- [ ] Cross-shard message broadcasting works correctly
- [ ] Performance remains consistent with Phase 1

### Phase 3: Full Scale (50K connections)
- [ ] All 5 shards active and balanced
- [ ] System remains stable under max load
- [ ] Broadcast reaches all 50K connections
- [ ] Latency remains within acceptable limits

---

## 📅 Timeline

| Phase | Duration | Start Date | Completion |
|-------|----------|------------|------------|
| Environment Setup | 1 day | TBD | [ ] |
| Phase 1 Testing | 2 days | TBD | [ ] |
| Phase 2 Testing | 2 days | TBD | [ ] |
| Phase 3 Testing | 2 days | TBD | [ ] |
| Analysis & Report | 1 day | TBD | [ ] |

**Total POC Duration**: 7-8 days

---

## 📞 Support

**POC Lead**: Development Team
**Questions**: File issue in project repository
**Emergency**: Contact system architects
