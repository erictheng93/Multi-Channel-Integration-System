/**
 * 客戶管�?工具?�置?�件 (TypeScript ?�本)
 * ?�這裡設�?你�? Worker URL ?�其他�?�?
 */

// ?�� ?�置設�?
export const CONFIG = {
  // Worker URL - 請替?�為你�?實�? Cloudflare Worker 網�?
  WORKER_URL: 'https://your-api-domain.example.com',
  
  // ??��設�?
  MONITOR_INTERVAL: 30000, // 30�?
  
  // ?��?設�?
  TOP_CUSTOMERS_LIMIT: 10,
  RECENT_DAYS_LIMIT: 7,
  
  // API 設�?
  REQUEST_TIMEOUT: 10000, // 10�?
  
  // 顯示設�?
  MAX_DISPLAY_ITEMS: 20,
  DATE_FORMAT: 'zh-TW'
};

// ?? ?��?檢測
export function detectEnvironment(): string {
  if (typeof window !== 'undefined') {
    return 'browser';
  } else if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    return 'node';
  } else {
    return 'unknown';
  }
}

// ???�置驗�?
export function validateConfig(): string[] {
  const issues: string[] = [];
  
  if (CONFIG.WORKER_URL === 'https://your-api-domain.example.com') {
    issues.push('請更??WORKER_URL ?��??�實??Worker 網�?');
  }
  
  if (!CONFIG.WORKER_URL.startsWith('https://')) {
    issues.push('WORKER_URL 必�?使用 HTTPS');
  }
  
  if (CONFIG.MONITOR_INTERVAL < 5000) {
    issues.push('MONITOR_INTERVAL 不�?小於 5 �?);
  }
  
  return issues;
}

// ?? 顯示?�置資�?
export function showConfig(): boolean {
  console.log('?��?  ?��??�置:');
  console.log(`  Worker URL: ${CONFIG.WORKER_URL}`);
  console.log(`  ??��?��?: ${CONFIG.MONITOR_INTERVAL / 1000} 秒`);
  console.log(`  ?��?: ${detectEnvironment()}`);
  console.log('');
  
  const issues = validateConfig();
  if (issues.length > 0) {
    console.log('?��?  ?�置?��?:');
    issues.forEach(issue => console.log(`  - ${issue}`));
    console.log('');
    return false;
  }
  
  console.log('???�置檢查?��?');
  return true;
}

// ?�� ?�新?�置?��??�函??
export function updateWorkerUrl(newUrl: string): void {
  CONFIG.WORKER_URL = newUrl;
  console.log(`??Worker URL 已更?�為: ${newUrl}`);
}

// ?? API 輔助?�數
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
      throw new Error('請�?超�?');
    }
    
    throw error;
  }
}

// ?�� ?��??��??�函??
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString(CONFIG.DATE_FORMAT);
}

export function formatPercentage(value: number, total: number): string {
  return ((value / total) * 100).toFixed(1) + '%';
}

export function createProgressBar(value: number, maxValue: number, length: number = 20): string {
  const filled = Math.round((value / maxValue) * length);
  return '??.repeat(filled) + '??.repeat(length - filled);
}

// ?? 快速�??�函??
export async function quickStart(): Promise<boolean> {
  console.log('?? 客戶管�?工具快速�??�\n');
  
  if (!showConfig()) {
    console.log('??請�?修正?�置?��?');
    return false;
  }
  
  try {
    console.log('?? 測試 API ??��...');
    const healthCheck = await makeApiRequest('/health');
    
    if (healthCheck.status === 'healthy') {
      console.log('??API ??���?��');
      
      const stats = await makeApiRequest('/api/stats');
      if (stats.success) {
        console.log('?? 系統?�??');
        console.log(`  客戶?? ${stats.data.totalCustomers}`);
        console.log(`  對話?? ${stats.data.totalConversations}`);
        console.log(`  訊息?? ${stats.data.totalMessages}`);
      }
      
      return true;
    } else {
      console.log('??API ?�康檢查失�?');
      return false;
    }
  } catch (error: any) {
    console.log(`??API ??��失�?: ${error.message}`);
    console.log('?�� 請檢??');
    console.log('  1. Worker URL ?�否�?��');
    console.log('  2. Worker ?�否�?��?��?');
    console.log('  3. 網路??��?�否�?��');
    return false;
  }
}

// 如�??�接?��??�個腳??
if (typeof window === 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  console.log('?��?  客戶管�?工具?�置\n');
  showConfig();
  
  console.log('?�� 使用?��?:');
  console.log('1. 編輯 config.ts 中�? WORKER_URL');
  console.log('2. ?��? node config.ts 檢查?�置');
  console.log('3. 使用?��?工具?�本');
  console.log('');
  console.log('??�? ?�用工具:');
  console.log('- node customer-manager.ts (客戶資�?管�?)');
  console.log('- node customer-analytics.ts  (客戶資�??��?)');
  console.log('- node monitor-customers.ts (客戶活�???��)');
  console.log('- node query-customers.ts (客戶資�??�詢)');
}