// Admin Dashboard JavaScript Functions
// Extracted from backend to maintain separation of concerns

const API_BASE = window.location.origin;

// Load statistics
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/api/stats`);
        const data = await response.json();

        if (data.success) {
            document.getElementById('conversation-count').textContent = data.data.totalConversations || 0;
            document.getElementById('customer-count').textContent = data.data.totalCustomers || 0;
        }
    } catch (error) {
        console.error('載入統計資料失敗:', error);
        document.getElementById('conversation-count').textContent = '錯誤';
        document.getElementById('customer-count').textContent = '錯誤';
    }
}

// Check system health
async function checkSystemHealth() {
    try {
        const response = await fetch(`${API_BASE}/api/health`);
        const data = await response.json();

        if (data.status === 'healthy') {
            alert('✅ 系統健康狀態良好！');
        } else {
            alert('⚠️ 系統狀態異常，請檢查日誌');
        }
    } catch (error) {
        alert('❌ 無法檢查系統狀態：' + error.message);
    }
}

// Placeholder functions - to be implemented
function loadConversations() {
    window.location.href = '/#/conversations';
}

function loadCustomers() {
    window.location.href = '/#/customers';
}

function testLineConnection() {
    fetch(`${API_BASE}/api/system/integrations/line/test`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('✅ LINE 連接測試成功！');
            } else {
                alert('❌ LINE 連接測試失敗: ' + (data.error || '未知錯誤'));
            }
        })
        .catch(error => {
            alert('❌ 無法測試 LINE 連接：' + error.message);
        });
}

function viewLogs() {
    window.location.href = '/#/logs';
}

function exportData() {
    const confirmed = confirm('確定要匯出系統資料嗎？這可能需要一些時間。');
    if (confirmed) {
        window.location.href = `${API_BASE}/api/system/export-data`;
    }
}

function systemSettings() {
    window.location.href = '/#/settings';
}

function refreshActivity() {
    document.getElementById('recent-activity').innerHTML = '<p>重新整理中...</p>';
    setTimeout(() => {
        document.getElementById('recent-activity').innerHTML = '<p>暫無最近活動</p>';
    }, 1000);
}

// Load queue statistics (LINE Message Queue + Delayed Message Buffer)
async function loadQueueStats() {
    try {
        // Load LINE Message Queue stats
        const queueResponse = await fetch(`${API_BASE}/api/queues/stats`);
        const queueData = await queueResponse.json();

        if (queueData.success) {
            const lineQueue = queueData.data.queues.lineMessageQueue;
            const statusEl = document.getElementById('line-queue-status');
            const metricsEl = document.getElementById('line-queue-metrics');
            if (statusEl) statusEl.textContent = lineQueue.status === 'healthy' ? 'Healthy' : 'Error';
            if (metricsEl) metricsEl.textContent = 'Avg processing: ' + lineQueue.metrics.avgProcessingTime + 'ms';
        }

        // Load Delayed Message Buffer health (Durable Objects)
        const bufferResponse = await fetch(`${API_BASE}/api/delayed-messages-v2/health`);
        const bufferData = await bufferResponse.json();

        if (bufferData.success && bufferData.status === 'healthy') {
            const bufferStatusEl = document.getElementById('delayed-message-buffer-status');
            const bufferMetricsEl = document.getElementById('delayed-message-buffer-metrics');
            if (bufferStatusEl) bufferStatusEl.textContent = 'Healthy';
            if (bufferMetricsEl) bufferMetricsEl.textContent = 'Instant recall - Precise delay - Durable Objects';
        } else {
            const bufferStatusEl = document.getElementById('delayed-message-buffer-status');
            if (bufferStatusEl) bufferStatusEl.textContent = 'Error';
        }
    } catch (error) {
        console.error('Failed to load queue stats:', error);
        const bufferStatusEl = document.getElementById('delayed-message-buffer-status');
        const queueStatusEl = document.getElementById('line-queue-status');
        if (bufferStatusEl) bufferStatusEl.textContent = 'Error';
        if (queueStatusEl) queueStatusEl.textContent = 'Error';
    }
}

// Refresh queue stats
function refreshQueueStats() {
    const statusEl = document.getElementById('line-queue-status');
    if (statusEl) statusEl.textContent = 'Loading...';
    loadQueueStats();
}

// Refresh Delayed Message Buffer stats
function refreshDelayedMessageStats() {
    document.getElementById('delayed-message-buffer-status').innerHTML = '<span class="status-indicator status-online"></span>載入中...';
    loadQueueStats();
}

// View queue details (LINE Message Queue)
function viewQueueDetails() {
    fetch(`${API_BASE}/api/queues/performance`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const metrics = data.data;
                alert(`LINE Message Queue Performance:
  Avg Processing Time: ${metrics.lineMessageQueue.throughput.avgProcessingTime}ms
  Success Rate: ${metrics.lineMessageQueue.reliability.successRate}%`);
            }
        })
        .catch(error => {
            alert('Failed to load queue details: ' + error.message);
        });
}

// View Delayed Message Buffer metrics (Durable Objects)
function viewDelayedMessageMetrics() {
    // Note: This requires admin authentication
    // For now, show a simplified alert. In production, implement proper auth flow.
    fetch(`${API_BASE}/api/delayed-messages-v2/health`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert(`🚀 延遲訊息系統 (Durable Objects)

✅ 狀態: ${data.status}
✅ 服務: ${data.service}

核心特性:
  • 即時撤回: ${data.features.instantCancel ? '✓ 啟用 (<100ms)' : '✗ 停用'}
  • 精確排程: ${data.features.preciseScheduling ? '✓ 啟用 (±10ms)' : '✗ 停用'}
  • Durable Objects: ${data.features.durableObjects ? '✓ 啟用' : '✗ 停用'}

提示: 完整監控指標需要管理員權限
端點: GET /api/delayed-messages-v2/metrics`);
            }
        })
        .catch(error => {
            alert('❌ 無法載入延遲訊息系統狀態：' + error.message);
        });
}

// Test realtime event
function testRealtimeEvent() {
    const conversationId = prompt('請輸入對話ID進行測試（或留空使用預設值）:') || '1';
    const message = prompt('請輸入測試消息內容:') || '🧪 系統測試消息';

    fetch(`${API_BASE}/api/realtime/test-event`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token' // This needs actual JWT token
        },
        body: JSON.stringify({
            conversationId: conversationId,
            message: message
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert(`✅ 測試事件已發送！
事件ID: ${data.eventId}
當前連接數: ${data.currentConnections}`);
        } else {
            alert('❌ 測試事件發送失敗: ' + (data.error || '未知錯誤'));
        }
    })
    .catch(error => {
        alert('❌ 測試事件失敗：' + error.message);
    });
}

// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', function() {
    loadStats();
    loadQueueStats();

    // Refresh statistics every 30 seconds
    setInterval(loadStats, 30000);
    // Refresh queue statistics every 15 seconds
    setInterval(loadQueueStats, 15000);
});