/**
 * Template Service
 * Handles rendering of HTML templates for admin dashboard
 */

// Note: Currently not using fs imports in Cloudflare Workers environment
// import { readFileSync } from 'fs';
// import { join } from 'path';

export class TemplateService {
  private static instance: TemplateService;
  private templateCache = new Map<string, string>();

  private constructor() {}

  static getInstance(): TemplateService {
    if (!TemplateService.instance) {
      TemplateService.instance = new TemplateService();
    }
    return TemplateService.instance;
  }

  /**
   * Render admin dashboard HTML
   */
  renderAdminDashboard(): string {
    const cacheKey = 'admin-dashboard';

    if (this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey)!;
    }

    // In production, templates would be embedded or loaded from CDN
    // For now, return a simplified inline version
    const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>多渠道客服管理系統</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #f5f5f5; color: #333;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; padding: 1rem 2rem; box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .container { max-width: 1200px; margin: 2rem auto; padding: 0 1rem; }
        .card {
            background: white; border-radius: 12px; padding: 1.5rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); border: 1px solid #e1e5e9;
            margin-bottom: 1rem;
        }
        .btn {
            background: #667eea; color: white; border: none; padding: 0.75rem 1.5rem;
            border-radius: 8px; cursor: pointer; margin: 0.5rem;
        }
        .stat-number { font-size: 2rem; font-weight: bold; color: #667eea; }
        .status-indicator { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 0.5rem; }
        .status-online { background-color: #48bb78; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 多渠道客服管理系統</h1>
    </div>
    <div class="container">
        <div class="card">
            <h3>📊 系統狀態</h3>
            <div class="stat-number">
                <span class="status-indicator status-online"></span>
                運行中
            </div>
            <p>系統正常運行</p>
            <button class="btn" onclick="window.location.href='/api/system/health'">檢查健康狀態</button>
        </div>
        <div class="card">
            <h3>💬 對話統計</h3>
            <div class="stat-number" id="conversation-count">載入中...</div>
            <p>總對話數量</p>
        </div>
        <div class="card">
            <h3>👥 客戶統計</h3>
            <div class="stat-number" id="customer-count">載入中...</div>
            <p>總客戶數量</p>
        </div>
    </div>
    <script>
        // Load basic stats
        fetch('/api/stats')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    document.getElementById('conversation-count').textContent = data.data.totalConversations || 0;
                    document.getElementById('customer-count').textContent = data.data.totalCustomers || 0;
                }
            })
            .catch(err => console.error('Failed to load stats:', err));
    </script>
</body>
</html>`;

    this.templateCache.set(cacheKey, html);
    return html;
  }

  /**
   * Render admin dashboard JavaScript
   */
  renderAdminDashboardJS(): string {
    return `
// Basic dashboard functionality
const API_BASE = window.location.origin;

async function loadStats() {
    try {
        const response = await fetch(\`\${API_BASE}/api/stats\`);
        const data = await response.json();

        if (data.success) {
            document.getElementById('conversation-count').textContent = data.data.totalConversations || 0;
            document.getElementById('customer-count').textContent = data.data.totalCustomers || 0;
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', loadStats);
    `;
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.templateCache.clear();
  }
}

export const templateService = TemplateService.getInstance();