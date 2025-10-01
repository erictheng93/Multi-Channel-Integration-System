/**
 * 客戶管理工具配置文件 (TypeScript 版本)
 * 在這裡設定你的 Worker URL 和其他配置
 */

// 🔧 配置設定
export const CONFIG = {
  // Worker URL - 請替換為你的實際 Cloudflare Worker 網址
  WORKER_URL: 'https://multi-channel.imfinethankyouandyou.com',
  
  // 監控設定
  MONITOR_INTERVAL: 30000, // 30秒
  
  // 分析設定
  TOP_CUSTOMERS_LIMIT: 10,
  RECENT_DAYS_LIMIT: 7,
  
  // API 設定
  REQUEST_TIMEOUT: 10000, // 10秒
  
  // 顯示設定
  MAX_DISPLAY_ITEMS: 20,
  DATE_FORMAT: 'zh-TW'
};

// 🌍 環境檢測
export function detectEnvironment(): string {
  if (typeof window !== 'undefined') {
    return 'browser';
  } else if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    return 'node';
  } else {
    return 'unknown';
  }
}

// ✅ 配置驗證
export function validateConfig(): string[] {
  const issues: string[] = [];
  
  if (CONFIG.WORKER_URL === 'https://multi-channel.imfinethankyouandyou.com') {
    issues.push('請更新 WORKER_URL 為你的實際 Worker 網址');
  }
  
  if (!CONFIG.WORKER_URL.startsWith('https://')) {
    issues.push('WORKER_URL 必須使用 HTTPS');
  }
  
  if (CONFIG.MONITOR_INTERVAL < 5000) {
    issues.push('MONITOR_INTERVAL 不應小於 5 秒');
  }
  
  return issues;
}

// 📋 顯示配置資訊
export function showConfig(): boolean {
  console.log('⚙️  當前配置:');
  console.log(`  Worker URL: ${CONFIG.WORKER_URL}`);
  console.log(`  監控間隔: ${CONFIG.MONITOR_INTERVAL / 1000} 秒`);
  console.log(`  環境: ${detectEnvironment()}`);
  console.log('');
  
  const issues = validateConfig();
  if (issues.length > 0) {
    console.log('⚠️  配置問題:');
    issues.forEach(issue => console.log(`  - ${issue}`));
    console.log('');
    return false;
  }
  
  console.log('✅ 配置檢查通過');
  return true;
}

// 🔧 更新配置的輔助函數
export function updateWorkerUrl(newUrl: string): void {
  CONFIG.WORKER_URL = newUrl;
  console.log(`✅ Worker URL 已更新為: ${newUrl}`);
}

// 📊 API 輔助函數
export async function makeApiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${CONFIG.WORKER_URL}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('請求超時');
    }
    
    throw error;
  }
}

// 🎨 格式化輔助函數
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString(CONFIG.DATE_FORMAT);
}

export function formatPercentage(value: number, total: number): string {
  return ((value / total) * 100).toFixed(1) + '%';
}

export function createProgressBar(value: number, maxValue: number, length: number = 20): string {
  const filled = Math.round((value / maxValue) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

// 🚀 快速啟動函數
export async function quickStart(): Promise<boolean> {
  console.log('🚀 客戶管理工具快速啟動\n');
  
  if (!showConfig()) {
    console.log('❌ 請先修正配置問題');
    return false;
  }
  
  try {
    console.log('🔍 測試 API 連接...');
    const healthCheck = await makeApiRequest('/health');
    
    if (healthCheck.status === 'healthy') {
      console.log('✅ API 連接正常');
      
      const stats = await makeApiRequest('/api/stats');
      if (stats.success) {
        console.log('📊 系統狀態:');
        console.log(`  客戶數: ${stats.data.totalCustomers}`);
        console.log(`  對話數: ${stats.data.totalConversations}`);
        console.log(`  訊息數: ${stats.data.totalMessages}`);
      }
      
      return true;
    } else {
      console.log('❌ API 健康檢查失敗');
      return false;
    }
  } catch (error: any) {
    console.log(`❌ API 連接失敗: ${error.message}`);
    console.log('💡 請檢查:');
    console.log('  1. Worker URL 是否正確');
    console.log('  2. Worker 是否正在運行');
    console.log('  3. 網路連接是否正常');
    return false;
  }
}

// 如果直接執行這個腳本
if (typeof window === 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  console.log('⚙️  客戶管理工具配置\n');
  showConfig();
  
  console.log('💡 使用方法:');
  console.log('1. 編輯 config.ts 中的 WORKER_URL');
  console.log('2. 執行 node config.ts 檢查配置');
  console.log('3. 使用其他工具腳本');
  console.log('');
  console.log('🛠️  可用工具:');
  console.log('- node customer-manager.ts    (客戶資料管理)');
  console.log('- node customer-analytics.ts  (客戶資料分析)');
  console.log('- node monitor-customers.ts   (客戶活動監控)');
  console.log('- node query-customers.ts     (客戶資料查詢)');
}