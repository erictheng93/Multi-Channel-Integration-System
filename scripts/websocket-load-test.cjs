/**
 * WebSocket 負載測試腳本
 * 測試 100+ 並發連接性能
 *
 * 使用方法:
 * node scripts/websocket-load-test.js [concurrent_connections] [duration_seconds]
 *
 * 範例:
 * node scripts/websocket-load-test.js 100 60  # 100 並發，持續 60 秒
 */

const WebSocket = require('ws');

// =================== 配置參數 ===================
// IMPORTANT: Set these environment variables before running:
// - BACKEND_URL: Your API domain (e.g., https://your-api-domain.example.com)
// - TEST_EMAIL: Admin email for authentication
// - TEST_PASSWORD: Admin password for authentication
const CONFIG = {
  // WebSocket URL (derived from BACKEND_URL)
  WS_URL: (process.env.BACKEND_URL || 'http://localhost:8787').replace(/^http/, 'ws') + '/api/websocket/connect',

  // 測試參數
  CONCURRENT_CONNECTIONS: parseInt(process.argv[2]) || 100,
  TEST_DURATION_SECONDS: parseInt(process.argv[3]) || 60,

  // 認證資訊 (from environment variables)
  AUTH_EMAIL: process.env.TEST_EMAIL || 'admin@example.com',
  AUTH_PASSWORD: process.env.TEST_PASSWORD || 'your-password',
  API_BASE: process.env.BACKEND_URL || 'http://localhost:8787',

  // 性能參數
  CONNECTION_TIMEOUT: 10000,  // 10 秒連接超時
  PING_INTERVAL: 30000,       // 30 秒心跳間隔
  MESSAGE_INTERVAL: 5000,     // 5 秒發送一次測試消息
};

// =================== 統計數據 ===================
const stats = {
  totalAttempts: 0,
  successfulConnections: 0,
  failedConnections: 0,
  activeConnections: 0,
  closedConnections: 0,
  messagesSent: 0,
  messagesReceived: 0,
  errors: [],
  connectionTimes: [],
  latencies: [],
  startTime: null,
  endTime: null,
};

// =================== JWT 認證 ===================
async function getAuthToken() {
  const https = require('https');
  const postData = JSON.stringify({
    email: CONFIG.AUTH_EMAIL,
    password: CONFIG.AUTH_PASSWORD
  });

  return new Promise((resolve, reject) => {
    const apiUrl = new URL(CONFIG.API_BASE);
    const options = {
      hostname: apiUrl.hostname,
      port: apiUrl.port || (apiUrl.protocol === 'https:' ? 443 : 80),
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.success && response.data && response.data.token) {
            resolve(response.data.token);
          } else {
            reject(new Error('Failed to get token: ' + data));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// =================== WebSocket 連接類 ===================
class WebSocketClient {
  constructor(id, token, conversationId = 1) {
    this.id = id;
    this.token = token;
    this.conversationId = conversationId;
    this.ws = null;
    this.connected = false;
    this.connectStartTime = null;
    this.messageTimestamps = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.connectStartTime = Date.now();
      stats.totalAttempts++;

      try {
        const url = `${CONFIG.WS_URL}?conversationId=${this.conversationId}&token=${this.token}`;
        console.log(`🔍 [Client ${this.id}] Connecting to: ${CONFIG.WS_URL}?conversationId=${this.conversationId}&token=${this.token.substring(0, 50)}...`);
        this.ws = new WebSocket(url);

        // 連接超時檢測
        const timeout = setTimeout(() => {
          if (!this.connected) {
            this.ws.terminate();
            reject(new Error(`Connection timeout for client ${this.id}`));
          }
        }, CONFIG.CONNECTION_TIMEOUT);

        this.ws.on('open', () => {
          clearTimeout(timeout);
          this.connected = true;
          stats.successfulConnections++;
          stats.activeConnections++;

          const connectionTime = Date.now() - this.connectStartTime;
          stats.connectionTimes.push(connectionTime);

          console.log(`✅ Client ${this.id}: Connected in ${connectionTime}ms`);
          resolve();
        });

        this.ws.on('message', (data) => {
          stats.messagesReceived++;
          const message = JSON.parse(data.toString());

          // 計算延遲
          if (message.timestamp) {
            const latency = Date.now() - new Date(message.timestamp).getTime();
            stats.latencies.push(latency);
          }
        });

        this.ws.on('error', (error) => {
          stats.errors.push({ clientId: this.id, error: error.message });
          console.error(`❌ Client ${this.id}: Error - ${error.message}`);
        });

        this.ws.on('close', () => {
          if (this.connected) {
            stats.activeConnections--;
            stats.closedConnections++;
            this.connected = false;
          } else {
            stats.failedConnections++;
          }
          clearTimeout(timeout);
        });

      } catch (error) {
        stats.failedConnections++;
        reject(error);
      }
    });
  }

  sendTestMessage() {
    if (this.connected && this.ws.readyState === WebSocket.OPEN) {
      const messageId = `${this.id}-${Date.now()}`;
      const message = {
        type: 'test',
        clientId: this.id,
        messageId: messageId,
        timestamp: new Date().toISOString(),
        data: 'Load test message'
      };

      this.messageTimestamps.set(messageId, Date.now());
      this.ws.send(JSON.stringify(message));
      stats.messagesSent++;
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// =================== 統計計算 ===================
function calculateStats() {
  const duration = (stats.endTime - stats.startTime) / 1000;

  const avgConnectionTime = stats.connectionTimes.length > 0
    ? stats.connectionTimes.reduce((a, b) => a + b, 0) / stats.connectionTimes.length
    : 0;

  const p50ConnectionTime = percentile(stats.connectionTimes, 50);
  const p95ConnectionTime = percentile(stats.connectionTimes, 95);
  const p99ConnectionTime = percentile(stats.connectionTimes, 99);

  const avgLatency = stats.latencies.length > 0
    ? stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length
    : 0;

  const p50Latency = percentile(stats.latencies, 50);
  const p95Latency = percentile(stats.latencies, 95);
  const p99Latency = percentile(stats.latencies, 99);

  const successRate = stats.totalAttempts > 0
    ? (stats.successfulConnections / stats.totalAttempts * 100).toFixed(2)
    : 0;

  const errorRate = stats.totalAttempts > 0
    ? (stats.errors.length / stats.totalAttempts * 100).toFixed(2)
    : 0;

  return {
    duration: duration.toFixed(2),
    connections: {
      total: stats.totalAttempts,
      successful: stats.successfulConnections,
      failed: stats.failedConnections,
      closed: stats.closedConnections,
      successRate: `${successRate}%`,
    },
    connectionTime: {
      avg: avgConnectionTime.toFixed(2),
      p50: p50ConnectionTime,
      p95: p95ConnectionTime,
      p99: p99ConnectionTime,
      min: Math.min(...stats.connectionTimes),
      max: Math.max(...stats.connectionTimes),
    },
    messages: {
      sent: stats.messagesSent,
      received: stats.messagesReceived,
      throughput: (stats.messagesSent / duration).toFixed(2) + ' msg/s',
    },
    latency: {
      avg: avgLatency.toFixed(2),
      p50: p50Latency,
      p95: p95Latency,
      p99: p99Latency,
      min: stats.latencies.length > 0 ? Math.min(...stats.latencies) : 0,
      max: stats.latencies.length > 0 ? Math.max(...stats.latencies) : 0,
    },
    errors: {
      total: stats.errors.length,
      rate: `${errorRate}%`,
      samples: stats.errors.slice(0, 5),  // 只顯示前5個錯誤樣本
    }
  };
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// =================== 主測試流程 ===================
async function runLoadTest() {
  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│       WebSocket 負載測試                                │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log(`│ 並發連接數: ${CONFIG.CONCURRENT_CONNECTIONS.toString().padEnd(42)} │`);
  console.log(`│ 測試時長: ${CONFIG.TEST_DURATION_SECONDS}秒${' '.repeat(45)} │`);
  console.log(`│ WebSocket URL: ${CONFIG.WS_URL.padEnd(39)} │`);
  console.log('└─────────────────────────────────────────────────────────┘\n');

  // 1. 獲取認證 Token
  console.log('🔑 正在獲取認證 Token...');
  let token;
  try {
    token = await getAuthToken();
    console.log(`✅ Token 獲取成功: ${token.substring(0, 50)}...\n`);
  } catch (error) {
    console.error('❌ Token 獲取失敗:', error.message);
    process.exit(1);
  }

  // 2. 創建並連接客戶端
  console.log(`🚀 正在建立 ${CONFIG.CONCURRENT_CONNECTIONS} 個並發連接...\n`);
  stats.startTime = Date.now();

  const clients = [];
  for (let i = 0; i < CONFIG.CONCURRENT_CONNECTIONS; i++) {
    clients.push(new WebSocketClient(i + 1, token));
  }

  // 批次連接（每批 10 個，避免瞬間連接過多）
  const batchSize = 10;
  for (let i = 0; i < clients.length; i += batchSize) {
    const batch = clients.slice(i, i + batchSize);
    const promises = batch.map(client =>
      client.connect().catch(err => console.error(`連接失敗: ${err.message}`))
    );
    await Promise.allSettled(promises);

    // 稍微延遲，避免過載
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n✅ 連接建立完成: ${stats.successfulConnections}/${CONFIG.CONCURRENT_CONNECTIONS} 成功\n`);

  // 3. 持續發送測試消息
  console.log(`📨 開始發送測試消息（持續 ${CONFIG.TEST_DURATION_SECONDS} 秒）...\n`);

  const messageInterval = setInterval(() => {
    clients.forEach(client => client.sendTestMessage());
  }, CONFIG.MESSAGE_INTERVAL);

  // 4. 等待測試時長
  await new Promise(resolve => setTimeout(resolve, CONFIG.TEST_DURATION_SECONDS * 1000));

  // 5. 清理並收集統計
  clearInterval(messageInterval);
  console.log('\n🛑 測試結束，正在關閉連接...\n');

  clients.forEach(client => client.disconnect());

  // 等待所有連接關閉
  await new Promise(resolve => setTimeout(resolve, 2000));

  stats.endTime = Date.now();

  // 6. 顯示測試結果
  const results = calculateStats();

  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│                    測試結果報告                         │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log('│ 【連接統計】                                            │');
  console.log(`│   總嘗試次數: ${results.connections.total.toString().padEnd(40)} │`);
  console.log(`│   成功連接: ${results.connections.successful.toString().padEnd(42)} │`);
  console.log(`│   失敗連接: ${results.connections.failed.toString().padEnd(42)} │`);
  console.log(`│   關閉連接: ${results.connections.closed.toString().padEnd(42)} │`);
  console.log(`│   成功率: ${results.connections.successRate.padEnd(44)} │`);
  console.log('│                                                         │');
  console.log('│ 【連接時間 (ms)】                                       │');
  console.log(`│   平均: ${results.connectionTime.avg.padEnd(46)} │`);
  console.log(`│   P50: ${results.connectionTime.p50.toString().padEnd(47)} │`);
  console.log(`│   P95: ${results.connectionTime.p95.toString().padEnd(47)} │`);
  console.log(`│   P99: ${results.connectionTime.p99.toString().padEnd(47)} │`);
  console.log(`│   最小: ${results.connectionTime.min.toString().padEnd(46)} │`);
  console.log(`│   最大: ${results.connectionTime.max.toString().padEnd(46)} │`);
  console.log('│                                                         │');
  console.log('│ 【消息統計】                                            │');
  console.log(`│   發送: ${results.messages.sent.toString().padEnd(46)} │`);
  console.log(`│   接收: ${results.messages.received.toString().padEnd(46)} │`);
  console.log(`│   吞吐量: ${results.messages.throughput.padEnd(44)} │`);
  console.log('│                                                         │');
  console.log('│ 【延遲 (ms)】                                           │');
  console.log(`│   平均: ${results.latency.avg.padEnd(46)} │`);
  console.log(`│   P50: ${results.latency.p50.toString().padEnd(47)} │`);
  console.log(`│   P95: ${results.latency.p95.toString().padEnd(47)} │`);
  console.log(`│   P99: ${results.latency.p99.toString().padEnd(47)} │`);
  console.log('│                                                         │');
  console.log('│ 【錯誤統計】                                            │');
  console.log(`│   總錯誤數: ${results.errors.total.toString().padEnd(42)} │`);
  console.log(`│   錯誤率: ${results.errors.rate.padEnd(44)} │`);
  console.log('│                                                         │');
  console.log(`│ 測試時長: ${results.duration} 秒${' '.repeat(41 - results.duration.length)} │`);
  console.log('└─────────────────────────────────────────────────────────┘');

  // 7. 評估結果
  console.log('\n【評估建議】');
  if (parseFloat(results.connections.successRate) >= 95) {
    console.log('✅ 連接成功率優秀 (≥95%)');
  } else if (parseFloat(results.connections.successRate) >= 90) {
    console.log('⚠️  連接成功率良好但需改進 (90-95%)');
  } else {
    console.log('❌ 連接成功率不足 (<90%)，需要優化');
  }

  if (results.connectionTime.p95 < 1000) {
    console.log('✅ P95 連接時間優秀 (<1000ms)');
  } else if (results.connectionTime.p95 < 2000) {
    console.log('⚠️  P95 連接時間可接受 (1000-2000ms)');
  } else {
    console.log('❌ P95 連接時間過高 (>2000ms)，需要優化');
  }

  if (results.latency.p95 < 200) {
    console.log('✅ P95 延遲優秀 (<200ms)');
  } else if (results.latency.p95 < 500) {
    console.log('⚠️  P95 延遲可接受 (200-500ms)');
  } else {
    console.log('❌ P95 延遲過高 (>500ms)，需要優化');
  }

  if (parseFloat(results.errors.rate) < 2) {
    console.log('✅ 錯誤率優秀 (<2%)');
  } else if (parseFloat(results.errors.rate) < 5) {
    console.log('⚠️  錯誤率需要關注 (2-5%)');
  } else {
    console.log('❌ 錯誤率過高 (>5%)，需要緊急處理');
  }

  console.log('\n測試完成！\n');
}

// =================== 執行測試 ===================
runLoadTest().catch(error => {
  console.error('❌ 測試失敗:', error);
  process.exit(1);
});
