#!/usr/bin/env tsx
/**
 * Phase 1.4 Queue Monitoring Script
 * Monitors REALTIME_QUEUE to verify no new messages are being sent
 *
 * Duration: 24 hours
 * Purpose: Confirm WebSocket/DO architecture has fully replaced Queue
 *
 * Usage:
 *   npm run monitor:phase1.4
 *   or
 *   npx tsx scripts/monitoring/queue-monitor-phase1-4.ts
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

interface QueueStats {
  timestamp: string;
  messageCount: number;
  processingRate: number;
  lastActivity: string | null;
  status: 'active' | 'idle' | 'empty';
}

interface MonitoringReport {
  startTime: string;
  endTime: string | null;
  duration: number; // in hours
  samples: QueueStats[];
  summary: {
    totalSamples: number;
    emptyCount: number;
    idleCount: number;
    activeCount: number;
    maxMessageCount: number;
    avgMessageCount: number;
    alertsTriggered: number;
  };
  alerts: Array<{
    timestamp: string;
    level: 'warning' | 'error';
    message: string;
    stats: QueueStats;
  }>;
  verdict: 'pass' | 'fail' | 'monitoring';
}

class QueueMonitor {
  private report: MonitoringReport;
  private checkInterval: number = 5 * 60 * 1000; // 5 minutes
  private totalDuration: number = 24 * 60 * 60 * 1000; // 24 hours
  private reportPath: string;
  private isRunning: boolean = false;

  constructor() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.reportPath = path.join(
      process.cwd(),
      `QUEUE_MONITORING_PHASE1_4_${timestamp}.md`
    );

    this.report = {
      startTime: new Date().toISOString(),
      endTime: null,
      duration: 0,
      samples: [],
      summary: {
        totalSamples: 0,
        emptyCount: 0,
        idleCount: 0,
        activeCount: 0,
        maxMessageCount: 0,
        avgMessageCount: 0,
        alertsTriggered: 0
      },
      alerts: [],
      verdict: 'monitoring'
    };
  }

  /**
   * Get REALTIME_QUEUE statistics from Wrangler
   */
  private async getQueueStats(): Promise<QueueStats> {
    try {
      const { stdout, stderr } = await execAsync(
        'wrangler queues consumer stats realtime-events'
      );

      if (stderr) {
        console.error(`⚠️ Wrangler error: ${stderr}`);
      }

      // Parse wrangler output
      // Example output:
      // Queue: realtime-events
      // Messages: 0
      // Processing Rate: 0.0 msg/s
      // Last Activity: Never

      const messageCountMatch = stdout.match(/Messages:\s*(\d+)/);
      const processingRateMatch = stdout.match(/Processing Rate:\s*([\d.]+)/);
      const lastActivityMatch = stdout.match(/Last Activity:\s*(.+)/);

      const messageCount = messageCountMatch ? parseInt(messageCountMatch[1], 10) : 0;
      const processingRate = processingRateMatch ? parseFloat(processingRateMatch[1]) : 0;
      const lastActivity = lastActivityMatch ? lastActivityMatch[1].trim() : null;

      let status: 'active' | 'idle' | 'empty' = 'empty';
      if (messageCount > 0) {
        status = 'active';
      } else if (processingRate > 0) {
        status = 'idle';
      }

      return {
        timestamp: new Date().toISOString(),
        messageCount,
        processingRate,
        lastActivity,
        status
      };
    } catch (error) {
      console.error(`❌ Failed to get queue stats:`, error);
      throw error;
    }
  }

  /**
   * Check if alert should be triggered
   */
  private checkForAlerts(stats: QueueStats): void {
    // Alert if messages are being sent to queue
    if (stats.messageCount > 0) {
      this.report.alerts.push({
        timestamp: stats.timestamp,
        level: 'error',
        message: `Queue has ${stats.messageCount} messages! Migration may not be complete.`,
        stats
      });
      this.report.summary.alertsTriggered++;
    }

    // Warning if processing rate > 0
    if (stats.processingRate > 0) {
      this.report.alerts.push({
        timestamp: stats.timestamp,
        level: 'warning',
        message: `Queue processing rate is ${stats.processingRate} msg/s. Should be 0.`,
        stats
      });
      this.report.summary.alertsTriggered++;
    }
  }

  /**
   * Update monitoring summary
   */
  private updateSummary(): void {
    const samples = this.report.samples;

    this.report.summary.totalSamples = samples.length;
    this.report.summary.emptyCount = samples.filter(s => s.status === 'empty').length;
    this.report.summary.idleCount = samples.filter(s => s.status === 'idle').length;
    this.report.summary.activeCount = samples.filter(s => s.status === 'active').length;

    const messageCounts = samples.map(s => s.messageCount);
    this.report.summary.maxMessageCount = Math.max(...messageCounts, 0);
    this.report.summary.avgMessageCount = messageCounts.length > 0
      ? messageCounts.reduce((sum, count) => sum + count, 0) / messageCounts.length
      : 0;

    // Determine verdict
    if (this.report.summary.activeCount > 0 || this.report.summary.maxMessageCount > 0) {
      this.report.verdict = 'fail';
    } else if (samples.length >= 288) { // 24 hours * 60 min / 5 min = 288 samples
      this.report.verdict = 'pass';
    }
  }

  /**
   * Generate markdown report
   */
  private generateReport(): string {
    const duration = this.report.endTime
      ? (new Date(this.report.endTime).getTime() - new Date(this.report.startTime).getTime()) / (60 * 60 * 1000)
      : (Date.now() - new Date(this.report.startTime).getTime()) / (60 * 60 * 1000);

    return `# REALTIME_QUEUE Phase 1.4 Monitoring Report

**Monitoring Period**: ${this.report.startTime} → ${this.report.endTime || 'In Progress'}
**Duration**: ${duration.toFixed(2)} hours
**Status**: ${this.report.verdict.toUpperCase()}
**Generated**: ${new Date().toISOString()}

---

## Executive Summary

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│  Phase 1.4: 24-Hour Queue Monitoring Results                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Verdict: ${this.report.verdict === 'pass' ? '✅ PASS' : this.report.verdict === 'fail' ? '❌ FAIL' : '⏳ MONITORING'}                                        │
│                                                             │
│  Total Samples: ${this.report.summary.totalSamples.toString().padEnd(44)} │
│  Empty Samples: ${this.report.summary.emptyCount.toString().padEnd(44)} │
│  Idle Samples:  ${this.report.summary.idleCount.toString().padEnd(44)} │
│  Active Samples: ${this.report.summary.activeCount.toString().padEnd(43)} │
│                                                             │
│  Max Message Count: ${this.report.summary.maxMessageCount.toString().padEnd(40)} │
│  Avg Message Count: ${this.report.summary.avgMessageCount.toFixed(2).padEnd(40)} │
│  Alerts Triggered:  ${this.report.summary.alertsTriggered.toString().padEnd(40)} │
│                                                             │
└─────────────────────────────────────────────────────────────┘
\`\`\`

### Verdict Criteria

${this.report.verdict === 'pass' ? `
✅ **PASS**: Queue has been idle for 24+ hours
- No messages sent to queue
- Processing rate consistently 0 msg/s
- Migration successfully completed
` : this.report.verdict === 'fail' ? `
❌ **FAIL**: Queue received messages during monitoring
- Messages detected: ${this.report.summary.maxMessageCount}
- Active samples: ${this.report.summary.activeCount}
- **Action Required**: Investigate why REALTIME_QUEUE still receiving messages
` : `
⏳ **MONITORING**: Observation in progress
- Duration: ${duration.toFixed(2)} / 24.00 hours
- Samples collected: ${this.report.summary.totalSamples} / 288
`}

---

## Alerts History

${this.report.alerts.length > 0 ?
  this.report.alerts.map(alert => `
### ${alert.level === 'error' ? '❌' : '⚠️'} ${alert.level.toUpperCase()}: ${alert.timestamp}

**Message**: ${alert.message}

**Queue Stats at Time of Alert**:
- Message Count: ${alert.stats.messageCount}
- Processing Rate: ${alert.stats.processingRate} msg/s
- Status: ${alert.stats.status}
- Last Activity: ${alert.stats.lastActivity || 'Never'}
`).join('\n---\n') :
  '✅ No alerts triggered during monitoring period'}

---

## Detailed Statistics

### Sample Distribution

| Status | Count | Percentage |
|--------|-------|------------|
| Empty  | ${this.report.summary.emptyCount} | ${((this.report.summary.emptyCount / Math.max(this.report.summary.totalSamples, 1)) * 100).toFixed(2)}% |
| Idle   | ${this.report.summary.idleCount} | ${((this.report.summary.idleCount / Math.max(this.report.summary.totalSamples, 1)) * 100).toFixed(2)}% |
| Active | ${this.report.summary.activeCount} | ${((this.report.summary.activeCount / Math.max(this.report.summary.totalSamples, 1)) * 100).toFixed(2)}% |

### Message Count Metrics

- **Maximum**: ${this.report.summary.maxMessageCount} messages
- **Average**: ${this.report.summary.avgMessageCount.toFixed(2)} messages
- **Expected**: 0 messages (Queue should be empty)

---

## Recent Samples (Last 10)

${this.report.samples.slice(-10).map(sample => `
**${sample.timestamp}**
- Message Count: ${sample.messageCount}
- Processing Rate: ${sample.processingRate} msg/s
- Status: ${sample.status}
- Last Activity: ${sample.lastActivity || 'Never'}
`).join('\n')}

---

## Next Steps

${this.report.verdict === 'pass' ? `
### ✅ Proceed to Phase 2

Since Queue monitoring passed, you can safely proceed to Phase 2:

1. **Phase 2.1**: Remove Queue Consumer from index.ts
2. **Phase 2.2**: Remove Queue configuration from wrangler.toml
3. **Phase 2.3**: Update type definitions

**Command to proceed:**
\`\`\`bash
# Review Phase 2 plan
cat REALTIME_QUEUE_PHASE2_PLAN.md

# Or ask Claude to execute Phase 2
# User: "開始執行 Phase 2"
\`\`\`
` : this.report.verdict === 'fail' ? `
### ❌ Investigation Required

Queue is still receiving messages. Investigate:

1. **Find remaining Queue send calls**:
   \`\`\`bash
   grep -r "REALTIME_QUEUE.send" src/
   \`\`\`

2. **Check for missed migration points**:
   - Review REALTIME_QUEUE_AUDIT_REPORT.md
   - Verify all 4 send points were migrated

3. **Check logs for Queue activity**:
   \`\`\`bash
   wrangler tail --format pretty
   \`\`\`

4. **Consider rollback** if critical issues found
` : `
### ⏳ Continue Monitoring

Monitoring is still in progress. Wait for 24 hours to complete.

**Check progress**:
\`\`\`bash
cat ${path.basename(this.reportPath)}
\`\`\`

**Monitor live**:
\`\`\`bash
tail -f ${path.basename(this.reportPath)}
\`\`\`
`}

---

**Report Generated**: ${new Date().toISOString()}
**Monitoring Script**: \`scripts/monitoring/queue-monitor-phase1-4.ts\`
`;
  }

  /**
   * Save report to file
   */
  private async saveReport(): Promise<void> {
    const reportContent = this.generateReport();
    await fs.writeFile(this.reportPath, reportContent, 'utf-8');
    console.log(`📄 Report saved to: ${this.reportPath}`);
  }

  /**
   * Display progress in console
   */
  private displayProgress(stats: QueueStats): void {
    const elapsed = (Date.now() - new Date(this.report.startTime).getTime()) / (60 * 60 * 1000);
    const progress = Math.min((elapsed / 24) * 100, 100);

    console.clear();
    console.log(`
╔════════════════════════════════════════════════════════════╗
║  REALTIME_QUEUE Phase 1.4 Monitoring                      ║
╠════════════════════════════════════════════════════════════╣
║  Start Time: ${this.report.startTime.padEnd(41)}║
║  Duration:   ${elapsed.toFixed(2)} / 24.00 hours                      ║
║  Progress:   ${progress.toFixed(1)}% ${'█'.repeat(Math.floor(progress / 2))}${' '.repeat(50 - Math.floor(progress / 2))}║
╠════════════════════════════════════════════════════════════╣
║  Current Status (${stats.timestamp})                       ║
║  - Message Count:    ${stats.messageCount.toString().padEnd(32)}║
║  - Processing Rate:  ${stats.processingRate.toString().padEnd(32)}msg/s ║
║  - Status:           ${stats.status.padEnd(32)}║
║  - Last Activity:    ${(stats.lastActivity || 'Never').padEnd(32)}║
╠════════════════════════════════════════════════════════════╣
║  Summary                                                   ║
║  - Total Samples:    ${this.report.summary.totalSamples.toString().padEnd(32)}║
║  - Empty Samples:    ${this.report.summary.emptyCount.toString().padEnd(32)}║
║  - Alerts:           ${this.report.summary.alertsTriggered.toString().padEnd(32)}║
║  - Max Messages:     ${this.report.summary.maxMessageCount.toString().padEnd(32)}║
╠════════════════════════════════════════════════════════════╣
║  ${this.report.alerts.length > 0 ? '⚠️  ALERTS TRIGGERED - Check report for details' : '✅  No alerts - Queue is idle'.padEnd(58)}║
╚════════════════════════════════════════════════════════════╝
    `);
  }

  /**
   * Start monitoring
   */
  async start(): Promise<void> {
    console.log('🚀 Starting Phase 1.4 Queue Monitoring...');
    console.log(`📊 Will monitor for 24 hours`);
    console.log(`📁 Report: ${this.reportPath}\n`);

    this.isRunning = true;
    const startTime = Date.now();

    while (this.isRunning) {
      // Check if 24 hours have passed
      const elapsed = Date.now() - startTime;
      if (elapsed >= this.totalDuration) {
        console.log('\n✅ 24-hour monitoring period completed!');
        break;
      }

      try {
        // Get queue stats
        const stats = await this.getQueueStats();

        // Add to samples
        this.report.samples.push(stats);

        // Check for alerts
        this.checkForAlerts(stats);

        // Update summary
        this.updateSummary();

        // Save report
        await this.saveReport();

        // Display progress
        this.displayProgress(stats);

        // Wait for next check
        await new Promise(resolve => setTimeout(resolve, this.checkInterval));

      } catch (error) {
        console.error(`\n❌ Error during monitoring:`, error);
        console.log(`⏸️  Will retry in 1 minute...\n`);
        await new Promise(resolve => setTimeout(resolve, 60 * 1000));
      }
    }

    // Final report
    this.report.endTime = new Date().toISOString();
    this.report.duration = (new Date(this.report.endTime).getTime() - new Date(this.report.startTime).getTime()) / (60 * 60 * 1000);

    // Update final verdict
    this.updateSummary();
    await this.saveReport();

    console.log(`\n📄 Final report generated: ${this.reportPath}`);
    console.log(`\n${this.report.verdict === 'pass' ? '✅ PASS' : '❌ FAIL'}: ${this.report.verdict === 'pass' ? 'Ready for Phase 2' : 'Investigation required'}\n`);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    console.log('\n🛑 Stopping monitoring...');
    this.isRunning = false;
  }
}

// Handle graceful shutdown
const monitor = new QueueMonitor();

process.on('SIGINT', async () => {
  monitor.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  monitor.stop();
  process.exit(0);
});

// Start monitoring
monitor.start().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
