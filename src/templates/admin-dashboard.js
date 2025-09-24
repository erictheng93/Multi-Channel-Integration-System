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

// Load queue statistics
async function loadQueueStats() {
    try {
        const response = await fetch(`${API_BASE}/api/queues/stats`);
        const data = await response.json();

        if (data.success) {
            const queueData = data.data;

            // Update agent queue status
            const agentQueue = queueData.queues.agentQueue;
            document.getElementById('agent-queue-status').innerHTML =
                `<span class="status-indicator status-${agentQueue.status === 'healthy' ? 'online' : 'offline'}"></span>
                ${agentQueue.status === 'healthy' ? '正常運行' : '異常'}`;

            document.getElementById('agent-queue-metrics').textContent =
                `批次大小: ${agentQueue.configuration.maxBatchSize}, 平均處理時間: ${agentQueue.metrics.avgProcessingTime}ms`;

            // Update realtime queue status
            const realtimeQueue = queueData.queues.realtimeQueue;
            document.getElementById('realtime-queue-status').innerHTML =
                `<span class="status-indicator status-${realtimeQueue.status === 'healthy' ? 'online' : 'offline'}"></span>
                ${realtimeQueue.status === 'healthy' ? '正常運行' : '異常'}`;

            document.getElementById('realtime-queue-metrics').textContent =
                `SSE連接: ${queueData.realtimeConnections.totalConnections}, 平均處理時間: ${realtimeQueue.metrics.avgProcessingTime}ms`;
        }
    } catch (error) {
        console.error('載入隊列統計資料失敗:', error);
        document.getElementById('agent-queue-status').innerHTML = '<span class="status-indicator status-offline"></span>錯誤';
        document.getElementById('realtime-queue-status').innerHTML = '<span class="status-indicator status-offline"></span>錯誤';
    }
}

// Refresh queue stats
function refreshQueueStats() {
    document.getElementById('agent-queue-status').innerHTML = '<span class="status-indicator status-online"></span>載入中...';
    document.getElementById('realtime-queue-status').innerHTML = '<span class="status-indicator status-online"></span>載入中...';
    loadQueueStats();
}

// View queue details
function viewQueueDetails() {
    fetch(`${API_BASE}/api/queues/performance`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const metrics = data.data;
                alert(`📊 隊列性能指標：

🚀 代理隊列 (AGENT_QUEUE):
  • 吞吐量: ${metrics.agentQueue.throughput.messagesPerSecond}/秒
  • 成功率: ${metrics.agentQueue.reliability.successRate}%
  • 錯誤率: ${metrics.agentQueue.reliability.errorRate}%

⚡ 實時隊列 (REALTIME_QUEUE):
  • 事件吞吐量: ${metrics.realtimeQueue.throughput.eventsPerSecond}/秒
  • 成功率: ${metrics.realtimeQueue.reliability.successRate}%
  • SSE連接: ${metrics.realtimeQueue.sseMetrics.activeConnections}`);
            }
        })
        .catch(error => {
            alert('❌ 無法載入隊列詳細資訊：' + error.message);
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