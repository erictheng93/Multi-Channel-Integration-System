/**
 * Performance Dashboard
 * 專案名稱：Multi-Channel Support MVP - Production Monitoring
 *
 * Real-time performance dashboard for monitoring WebSocket + Durable Objects system
 * Provides live metrics, alerts, and system health visualization
 */

import { Hono } from 'hono';
import type { Bindings } from '../types';
import type {
  DashboardData,
  PerformanceMetrics,
  SystemHealth,
  ComponentStatus,
  MetricTrends
} from '../types/monitoring-types';
import { PerformanceMonitor } from './performance-monitor';
import { nowMs } from '@/utils/timestamp'

// =================== Dashboard API ===================

const dashboardHandler = new Hono<{ Bindings: Bindings }>();

// CORS 處理已移至 src/index.ts 統一管理
// 不再需要模組級別的 CORS middleware

// Dashboard data endpoint
dashboardHandler.get('/api/dashboard/data', async (c) => {
  try {
    const performanceMonitor = new PerformanceMonitor(c.env);

    const [systemHealth, historicalMetrics] = await Promise.all([
      performanceMonitor.getSystemHealth(),
      performanceMonitor.getHistoricalMetrics(1) // Last hour
    ]);

    const dashboardData = await generateDashboardData(systemHealth, historicalMetrics, c.env);

    return c.json(dashboardData);
  } catch (error) {
    console.error('[Dashboard] Error fetching dashboard data:', error);
    return c.json({ error: 'Failed to fetch dashboard data' }, 500);
  }
});

// Real-time metrics endpoint
dashboardHandler.get('/api/dashboard/metrics/realtime', async (c) => {
  try {
    const performanceMonitor = new PerformanceMonitor(c.env);
    const systemHealth = await performanceMonitor.getSystemHealth();

    return c.json({
      timestamp: nowMs(),
      metrics: systemHealth.metrics,
      health: {
        status: systemHealth.status,
        score: systemHealth.score
      }
    });
  } catch (error) {
    console.error('[Dashboard] Error fetching real-time metrics:', error);
    return c.json({ error: 'Failed to fetch real-time metrics' }, 500);
  }
});

// Historical metrics endpoint
dashboardHandler.get('/api/dashboard/metrics/historical', async (c) => {
  try {
    const timeRange = parseInt(c.req.query('hours') || '1');
    const performanceMonitor = new PerformanceMonitor(c.env);
    const metrics = await performanceMonitor.getHistoricalMetrics(timeRange);

    const aggregations = calculateHistoricalAggregations(metrics);

    return c.json({
      timeRange: `${timeRange}h`,
      dataPoints: metrics,
      aggregations
    });
  } catch (error) {
    console.error('[Dashboard] Error fetching historical metrics:', error);
    return c.json({ error: 'Failed to fetch historical metrics' }, 500);
  }
});

// Active alerts endpoint
dashboardHandler.get('/api/dashboard/alerts', async (c) => {
  try {
    const performanceMonitor = new PerformanceMonitor(c.env);
    const systemHealth = await performanceMonitor.getSystemHealth();

    const alertSummary = {
      total: systemHealth.alerts?.length || 0,
      critical: systemHealth.alerts?.filter((a: any) => a.severity === 'critical').length || 0,
      warning: systemHealth.alerts?.filter((a: any) => a.severity === 'warning').length || 0,
      info: systemHealth.alerts?.filter((a: any) => a.severity === 'info').length || 0,
      recentAlerts: systemHealth.alerts?.slice(0, 5) || [],
      topAlerts: systemHealth.alerts
        ?.sort((a: any, b: any) => {
          const severityOrder: Record<string, number> = { critical: 3, warning: 2, info: 1 };
          return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
        })
        .slice(0, 10) || []
    };

    return c.json(alertSummary);
  } catch (error) {
    console.error('[Dashboard] Error fetching alerts:', error);
    return c.json({ error: 'Failed to fetch alerts' }, 500);
  }
});

// Acknowledge alert endpoint
dashboardHandler.post('/api/dashboard/alerts/:alertId/acknowledge', async (c) => {
  try {
    const alertId = c.req.param('alertId');
    const performanceMonitor = new PerformanceMonitor(c.env);

    await performanceMonitor.acknowledgeAlert(alertId);

    return c.json({ success: true, alertId });
  } catch (error) {
    console.error('[Dashboard] Error acknowledging alert:', error);
    return c.json({ error: 'Failed to acknowledge alert' }, 500);
  }
});

// Component status endpoint
dashboardHandler.get('/api/dashboard/components', async (c) => {
  try {
    const components = await getComponentStatuses(c.env);
    return c.json(components);
  } catch (error) {
    console.error('[Dashboard] Error fetching component status:', error);
    return c.json({ error: 'Failed to fetch component status' }, 500);
  }
});

// System trends endpoint
dashboardHandler.get('/api/dashboard/trends', async (c) => {
  try {
    const performanceMonitor = new PerformanceMonitor(c.env);
    const recentMetrics = await performanceMonitor.getHistoricalMetrics(2); // Last 2 hours

    const trends = calculateMetricTrends(recentMetrics);
    return c.json(trends);
  } catch (error) {
    console.error('[Dashboard] Error fetching trends:', error);
    return c.json({ error: 'Failed to fetch trends' }, 500);
  }
});

// Performance report endpoint
dashboardHandler.get('/api/dashboard/report', async (c) => {
  try {
    const hours = parseInt(c.req.query('hours') || '24');
    const performanceMonitor = new PerformanceMonitor(c.env);
    const metrics = await performanceMonitor.getHistoricalMetrics(hours);

    const report = generatePerformanceReport(metrics, hours);
    return c.json(report);
  } catch (error) {
    console.error('[Dashboard] Error generating report:', error);
    return c.json({ error: 'Failed to generate report' }, 500);
  }
});

// Server-Sent Events for real-time updates
dashboardHandler.get('/api/dashboard/stream', async (c) => {
  try {
    // Set SSE headers
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');

    const encoder = new TextEncoder();
    const performanceMonitor = new PerformanceMonitor(c.env);

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      start(controller) {
        const sendUpdate = async () => {
          try {
            const systemHealth = await performanceMonitor.getSystemHealth();
            const data = {
              timestamp: nowMs(),
              health: {
                status: systemHealth.status,
                score: systemHealth.score
              },
              metrics: {
                latency: systemHealth.metrics?.websocket?.latency || 0,
                throughput: systemHealth.metrics?.websocket?.throughput || 0,
                errorRate: systemHealth.metrics?.websocket?.errorRate || 0,
                connections: systemHealth.metrics?.websocket?.connections || 0
              },
              alerts: systemHealth.alerts?.length || 0
            };

            const eventData = `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(eventData));
          } catch (error) {
            console.error('[Dashboard] SSE update error:', error);
          }
        };

        // Send initial data
        sendUpdate();

        // Send updates every 5 seconds
        const interval = setInterval(sendUpdate, 5000);

        // Cleanup function
        return () => clearInterval(interval);
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error('[Dashboard] SSE error:', error);
    return c.json({ error: 'Failed to start event stream' }, 500);
  }
});

// Dashboard HTML (simple embedded dashboard)
dashboardHandler.get('/dashboard', async (c) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WebSocket Performance Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            color: #333;
        }
        .header {
            background: #1a1a1a;
            color: white;
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .status-indicator {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .status-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
        }
        .status-healthy { background: #4CAF50; }
        .status-degraded { background: #FF9800; }
        .status-unhealthy { background: #F44336; }
        .status-critical { background: #9C27B0; }
        .dashboard {
            padding: 2rem;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
        }
        .card {
            background: white;
            border-radius: 8px;
            padding: 1.5rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .card h3 {
            margin-bottom: 1rem;
            color: #1a1a1a;
        }
        .metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.5rem 0;
            border-bottom: 1px solid #eee;
        }
        .metric:last-child { border-bottom: none; }
        .metric-value {
            font-weight: bold;
            color: #2196F3;
        }
        .alert {
            padding: 0.75rem;
            margin-bottom: 0.5rem;
            border-radius: 4px;
            border-left: 4px solid;
        }
        .alert-critical {
            background: #ffebee;
            border-color: #f44336;
            color: #c62828;
        }
        .alert-warning {
            background: #fff3e0;
            border-color: #ff9800;
            color: #ef6c00;
        }
        .alert-info {
            background: #e3f2fd;
            border-color: #2196f3;
            color: #1565c0;
        }
        .chart-placeholder {
            height: 200px;
            background: #f9f9f9;
            border: 1px dashed #ddd;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #666;
            margin-top: 1rem;
        }
        .refresh-indicator {
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1> WebSocket Performance Dashboard</h1>
        <div class="status-indicator">
            <div class="status-dot" id="statusDot"></div>
            <span id="systemStatus">Loading...</span>
            <span id="refreshIndicator" style="margin-left: 1rem;"></span>
        </div>
    </div>

    <div class="dashboard">
        <div class="card">
            <h3> System Health</h3>
            <div class="metric">
                <span>Health Score</span>
                <span class="metric-value" id="healthScore">-</span>
            </div>
            <div class="metric">
                <span>Uptime</span>
                <span class="metric-value" id="uptime">-</span>
            </div>
            <div class="metric">
                <span>Last Updated</span>
                <span class="metric-value" id="lastUpdated">-</span>
            </div>
        </div>

        <div class="card">
            <h3> WebSocket Metrics</h3>
            <div class="metric">
                <span>Active Connections</span>
                <span class="metric-value" id="activeConnections">-</span>
            </div>
            <div class="metric">
                <span>Average Latency</span>
                <span class="metric-value" id="latency">-</span>
            </div>
            <div class="metric">
                <span>Throughput</span>
                <span class="metric-value" id="throughput">-</span>
            </div>
            <div class="metric">
                <span>Error Rate</span>
                <span class="metric-value" id="errorRate">-</span>
            </div>
        </div>

        <div class="card">
            <h3> Durable Objects</h3>
            <div class="metric">
                <span>Events/Second</span>
                <span class="metric-value" id="eventsPerSecond">-</span>
            </div>
            <div class="metric">
                <span>Queue Depth</span>
                <span class="metric-value" id="queueDepth">-</span>
            </div>
            <div class="metric">
                <span>Active Rooms</span>
                <span class="metric-value" id="activeRooms">-</span>
            </div>
            <div class="metric">
                <span>Success Rate</span>
                <span class="metric-value" id="successRate">-</span>
            </div>
        </div>

        <div class="card">
            <h3> Active Alerts</h3>
            <div id="alertsList">
                <div style="color: #666; text-align: center; padding: 2rem;">
                    No active alerts
                </div>
            </div>
        </div>

        <div class="card" style="grid-column: 1 / -1;">
            <h3> Performance Trends</h3>
            <div class="chart-placeholder">
                Real-time performance charts would be displayed here
                <br>
                (Integration with Chart.js or similar visualization library)
            </div>
        </div>
    </div>

    <script>
        let eventSource;

        function formatUptime(ms) {
            const seconds = Math.floor(ms / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            if (days > 0) return \`\${days}d \${hours % 24}h\`;
            if (hours > 0) return \`\${hours}h \${minutes % 60}m\`;
            if (minutes > 0) return \`\${minutes}m \${seconds % 60}s\`;
            return \`\${seconds}s\`;
        }

        function formatNumber(num) {
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
            return num.toString();
        }

        function updateMetrics(data) {
            // System Health
            document.getElementById('healthScore').textContent = data.health.score + '/100';
            document.getElementById('systemStatus').textContent = data.health.status.charAt(0).toUpperCase() + data.health.status.slice(1);
            document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString();

            // Status indicator
            const statusDot = document.getElementById('statusDot');
            statusDot.className = 'status-dot status-' + data.health.status;

            // WebSocket Metrics
            document.getElementById('activeConnections').textContent = formatNumber(data.metrics.connections);
            document.getElementById('latency').textContent = Math.round(data.metrics.latency) + 'ms';
            document.getElementById('throughput').textContent = Math.round(data.metrics.throughput) + ' ops/s';
            document.getElementById('errorRate').textContent = (data.metrics.errorRate * 100).toFixed(2) + '%';
        }

        function loadDashboardData() {
            fetch('/api/dashboard/data')
                .then(response => response.json())
                .then(data => {
                    updateMetrics(data.realTimeMetrics);
                    updateUptime(data.summary.uptime);
                    updateAlerts(data.alerts);
                    updateDurableObjects(data.realTimeMetrics.durableObjects);
                })
                .catch(error => {
                    console.error('Error loading dashboard data:', error);
                });
        }

        function updateUptime(uptime) {
            document.getElementById('uptime').textContent = formatUptime(uptime);
        }

        function updateAlerts(alerts) {
            const alertsList = document.getElementById('alertsList');

            if (alerts.total === 0) {
                alertsList.innerHTML = '<div style="color: #4CAF50; text-align: center; padding: 2rem;"> No active alerts</div>';
                return;
            }

            let html = '';
            alerts.recentAlerts.forEach(alert => {
                html += \`
                    <div class="alert alert-\${alert.severity}">
                        <strong>\${alert.message}</strong>
                        <br>
                        <small>Triggered: \${new Date(alert.triggeredAt).toLocaleString()}</small>
                    </div>
                \`;
            });

            alertsList.innerHTML = html;
        }

        function updateDurableObjects(doMetrics) {
            document.getElementById('eventsPerSecond').textContent = Math.round(doMetrics.messageBroadcaster.eventsPerSecond);
            document.getElementById('queueDepth').textContent = formatNumber(doMetrics.messageBroadcaster.queueDepth);
            document.getElementById('activeRooms').textContent = formatNumber(doMetrics.conversationRooms.totalRoomsActive);
            document.getElementById('successRate').textContent = (doMetrics.messageBroadcaster.deliverySuccessRate * 100).toFixed(1) + '%';
        }

        function startRealTimeUpdates() {
            eventSource = new EventSource('/api/dashboard/stream');

            eventSource.onmessage = function(event) {
                const data = JSON.parse(event.data);
                updateMetrics(data);

                // Update refresh indicator
                const indicator = document.getElementById('refreshIndicator');
                indicator.classList.add('refresh-indicator');
                setTimeout(() => indicator.classList.remove('refresh-indicator'), 500);
            };

            eventSource.onerror = function(error) {
                console.error('EventSource failed:', error);
                // Fallback to polling
                setTimeout(() => {
                    eventSource.close();
                    setInterval(loadDashboardData, 10000);
                }, 5000);
            };
        }

        // Initialize dashboard
        document.addEventListener('DOMContentLoaded', function() {
            loadDashboardData();
            startRealTimeUpdates();
        });
    </script>
</body>
</html>
  `;

  return c.html(html);
});

// =================== Helper Functions ===================

async function generateDashboardData(
  systemHealth: SystemHealth,
  historicalMetrics: PerformanceMetrics[],
  env: Bindings
): Promise<DashboardData> {
  const [components, trends] = await Promise.all([
    getComponentStatuses(env),
    calculateMetricTrends(historicalMetrics)
  ]);

  const alertSummary = {
    total: systemHealth.alerts?.length || 0,
    critical: systemHealth.alerts?.filter((a: any) => a.severity === 'critical').length || 0,
    warning: systemHealth.alerts?.filter((a: any) => a.severity === 'warning').length || 0,
    info: systemHealth.alerts?.filter((a: any) => a.severity === 'info').length || 0,
    recentAlerts: systemHealth.alerts?.slice(0, 5) || [],
    topAlerts: systemHealth.alerts
      ?.sort((a: any, b: any) => {
        const severityOrder: Record<string, number> = { critical: 3, warning: 2, info: 1 };
        return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
      })
      .slice(0, 10) || []
  };

  const dashboardData: DashboardData = {
    timestamp: nowMs(),
    summary: {
      health: systemHealth.status || 'unknown',
      score: systemHealth.score,
      activeConnections: systemHealth.metrics?.websocket?.connections || 0,
      errorRate: systemHealth.metrics?.websocket?.errorRate || 0
    },
    alerts: alertSummary.recentAlerts || [],
    components,
    trends
  };

  // Only add metrics if they exist
  if (systemHealth.metrics) {
    dashboardData.metrics = systemHealth.metrics;
  }

  // Add historical data
  dashboardData.historicalData = {
    timeRange: '1h',
    dataPoints: historicalMetrics,
    aggregations: calculateHistoricalAggregations(historicalMetrics)
  };

  return dashboardData;
}

async function getComponentStatuses(env: Bindings): Promise<ComponentStatus[]> {
  const components: ComponentStatus[] = [];
  const workerUrl = (env as any).WORKER_URL || 'http://localhost:8787';

  // Check WebSocket handler
  try {
    const wsResponse = await fetch(`${workerUrl}/api/websocket/health`);
    components.push({
      name: 'WebSocket Handler',
      status: wsResponse.ok ? 'healthy' : 'critical',
      metrics: { latency: wsResponse.ok ? 50 : 0 },
      lastCheck: nowMs()
    });
  } catch (error) {
    components.push({
      name: 'WebSocket Handler',
      status: 'unknown',
      metrics: {},
      lastCheck: nowMs()
    });
  }

  // Check Message Broadcaster
  try {
    const mbResponse = await fetch(`${workerUrl}/api/message-broadcaster/status`);
    components.push({
      name: 'Message Broadcaster',
      status: mbResponse.ok ? 'healthy' : 'critical',
      metrics: {},
      lastCheck: nowMs()
    });
  } catch (error) {
    components.push({
      name: 'Message Broadcaster',
      status: 'unknown',
      metrics: {},
      lastCheck: nowMs()
    });
  }

  // Check Delayed Message Processor
  try {
    const dmpResponse = await fetch(`${workerUrl}/api/delayed-messages/status`);
    components.push({
      name: 'Delayed Message Processor',
      status: dmpResponse.ok ? 'healthy' : 'critical',
      metrics: {},
      lastCheck: nowMs()
    });
  } catch (error) {
    components.push({
      name: 'Delayed Message Processor',
      status: 'unknown',
      metrics: {},
      lastCheck: nowMs()
    });
  }

  return components;
}

function calculateHistoricalAggregations(metrics: PerformanceMetrics[]) {
  if (metrics.length === 0) {
    return {
      averageLatency: 0,
      maxLatency: 0,
      totalThroughput: 0,
      uptimePercentage: 100
    };
  }

  const latencies = metrics.map(m => m.websocket?.latency || 0);
  const throughputs = metrics.map(m => m.websocket?.throughput || 0);

  return {
    averageLatency: latencies.reduce((sum, l) => sum + l, 0) / latencies.length,
    maxLatency: Math.max(...latencies),
    totalThroughput: throughputs.reduce((sum, t) => sum + t, 0),
    uptimePercentage: 99.9 // Would be calculated based on health status
  };
}

function calculateMetricTrends(metrics: PerformanceMetrics[]): MetricTrends {
  if (metrics.length < 2) {
    return {
      metric: 'overall',
      trend: 'stable',
      change: 0,
      period: '1h',
      confidence: 0.5
    };
  }

  const latest = metrics[metrics.length - 1];
  const previous = metrics[Math.floor(metrics.length / 2)]; // Middle point for comparison

  // Calculate average change across all metrics
  const latencyChange = ((latest?.websocket?.latency || 0) - (previous?.websocket?.latency || 0));
  const throughputChange = ((latest?.websocket?.throughput || 0) - (previous?.websocket?.throughput || 0));
  const errorRateChange = ((latest?.websocket?.errorRate || 0) - (previous?.websocket?.errorRate || 0));

  const avgChange = (latencyChange + throughputChange - errorRateChange) / 3;
  const trend = Math.abs(avgChange) < 5 ? 'stable' : avgChange > 0 ? 'improving' : 'degrading';

  return {
    metric: 'overall',
    trend: trend,
    change: avgChange,
    period: '1h',
    confidence: 0.8
  };
}

function generatePerformanceReport(metrics: PerformanceMetrics[], hours: number) {
  const period = {
    start: Date.now() - (hours * 60 * 60 * 1000),
    end: nowMs(),
    duration: hours * 60 * 60 * 1000
  };

  const latencies = metrics.map(m => m.websocket?.latency || 0).sort((a, b) => a - b);
  const throughputs = metrics.map(m => m.websocket?.throughput || 0);
  const errorRates = metrics.map(m => m.websocket?.errorRate || 0);
  const connections = metrics.map(m => (m.websocket?.connections || 0));

  return {
    period,
    summary: {
      availability: 99.9, // Would be calculated from actual downtime
      averageLatency: latencies.reduce((sum, l) => sum + l, 0) / latencies.length,
      totalRequests: throughputs.reduce((sum, t) => sum + t, 0) * hours,
      errorRate: errorRates.reduce((sum, e) => sum + e, 0) / errorRates.length,
      peakConnections: Math.max(...connections),
      totalIncidents: 0 // Would be tracked separately
    },
    metrics: {
      latency: {
        p50: latencies[Math.floor(latencies.length * 0.5)] || 0,
        p90: latencies[Math.floor(latencies.length * 0.9)] || 0,
        p95: latencies[Math.floor(latencies.length * 0.95)] || 0,
        p99: latencies[Math.floor(latencies.length * 0.99)] || 0,
        max: Math.max(...latencies)
      },
      throughput: {
        average: throughputs.reduce((sum, t) => sum + t, 0) / throughputs.length,
        peak: Math.max(...throughputs),
        total: throughputs.reduce((sum, t) => sum + t, 0) * hours
      },
      errors: {
        total: 0, // Would need to track actual error counts
        rate: errorRates.reduce((sum, e) => sum + e, 0) / errorRates.length,
        byType: {} // Would categorize by error type
      },
      connections: {
        average: connections.reduce((sum, c) => sum + c, 0) / connections.length,
        peak: Math.max(...connections),
        total: connections.reduce((sum, c) => sum + c, 0)
      }
    },
    generatedAt: nowMs()
  };
}

export default dashboardHandler;