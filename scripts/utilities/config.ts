/**
 * å®¢æˆ¶ç®¡ç?å·¥å…·?ç½®?‡ä»¶ (TypeScript ?ˆæœ¬)
 * ?¨é€™è£¡è¨­å?ä½ ç? Worker URL ?Œå…¶ä»–é?ç½?
 */

// ?”§ ?ç½®è¨­å?
export const CONFIG = {
  // Worker URL - è«‹æ›¿?›ç‚ºä½ ç?å¯¦é? Cloudflare Worker ç¶²å?
  WORKER_URL: 'https://your-api-domain.example.com',
  
  // ??§è¨­å?
  MONITOR_INTERVAL: 30000, // 30ç§?
  
  // ?†æ?è¨­å?
  TOP_CUSTOMERS_LIMIT: 10,
  RECENT_DAYS_LIMIT: 7,
  
  // API è¨­å?
  REQUEST_TIMEOUT: 10000, // 10ç§?
  
  // é¡¯ç¤ºè¨­å?
  MAX_DISPLAY_ITEMS: 20,
  DATE_FORMAT: 'zh-TW'
};

// ?? ?°å?æª¢æ¸¬
export function detectEnvironment(): string {
  if (typeof window !== 'undefined') {
    return 'browser';
  } else if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    return 'node';
  } else {
    return 'unknown';
  }
}

// ???ç½®é©—è?
export function validateConfig(): string[] {
  const issues: string[] = [];
  
  if (CONFIG.WORKER_URL === 'https://your-api-domain.example.com') {
    issues.push('è«‹æ›´??WORKER_URL ?ºä??„å¯¦??Worker ç¶²å?');
  }
  
  if (!CONFIG.WORKER_URL.startsWith('https://')) {
    issues.push('WORKER_URL å¿…é?ä½¿ç”¨ HTTPS');
  }
  
  if (CONFIG.MONITOR_INTERVAL < 5000) {
    issues.push('MONITOR_INTERVAL ä¸æ?å°æ–¼ 5 ç§?);
  }
  
  return issues;
}

// ?? é¡¯ç¤º?ç½®è³‡è?
export function showConfig(): boolean {
  console.log('?™ï?  ?¶å??ç½®:');
  console.log(`  Worker URL: ${CONFIG.WORKER_URL}`);
  console.log(`  ??§?“é?: ${CONFIG.MONITOR_INTERVAL / 1000} ç§’`);
  console.log(`  ?°å?: ${detectEnvironment()}`);
  console.log('');
  
  const issues = validateConfig();
  if (issues.length > 0) {
    console.log('? ï?  ?ç½®?é?:');
    issues.forEach(issue => console.log(`  - ${issue}`));
    console.log('');
    return false;
  }
  
  console.log('???ç½®æª¢æŸ¥?šé?');
  return true;
}

// ?”§ ?´æ–°?ç½®?„è??©å‡½??
export function updateWorkerUrl(newUrl: string): void {
  CONFIG.WORKER_URL = newUrl;
  console.log(`??Worker URL å·²æ›´?°ç‚º: ${newUrl}`);
}

// ?? API è¼”åŠ©?½æ•¸
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
      throw new Error('è«‹æ?è¶…æ?');
    }
    
    throw error;
  }
}

// ?¨ ?¼å??–è??©å‡½??
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

// ?? å¿«é€Ÿå??•å‡½??
export async function quickStart(): Promise<boolean> {
  console.log('?? å®¢æˆ¶ç®¡ç?å·¥å…·å¿«é€Ÿå??•\n');
  
  if (!showConfig()) {
    console.log('??è«‹å?ä¿®æ­£?ç½®?é?');
    return false;
  }
  
  try {
    console.log('?? æ¸¬è©¦ API ??¥...');
    const healthCheck = await makeApiRequest('/health');
    
    if (healthCheck.status === 'healthy') {
      console.log('??API ??¥æ­?¸¸');
      
      const stats = await makeApiRequest('/api/stats');
      if (stats.success) {
        console.log('?? ç³»çµ±?€??');
        console.log(`  å®¢æˆ¶?? ${stats.data.totalCustomers}`);
        console.log(`  å°è©±?? ${stats.data.totalConversations}`);
        console.log(`  è¨Šæ¯?? ${stats.data.totalMessages}`);
      }
      
      return true;
    } else {
      console.log('??API ?¥åº·æª¢æŸ¥å¤±æ?');
      return false;
    }
  } catch (error: any) {
    console.log(`??API ??¥å¤±æ?: ${error.message}`);
    console.log('?’¡ è«‹æª¢??');
    console.log('  1. Worker URL ?¯å¦æ­?¢º');
    console.log('  2. Worker ?¯å¦æ­?œ¨?‹è?');
    console.log('  3. ç¶²è·¯??¥?¯å¦æ­?¸¸');
    return false;
  }
}

// å¦‚æ??´æ¥?·è??™å€‹è…³??
if (typeof window === 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  console.log('?™ï?  å®¢æˆ¶ç®¡ç?å·¥å…·?ç½®\n');
  showConfig();
  
  console.log('?’¡ ä½¿ç”¨?¹æ?:');
  console.log('1. ç·¨è¼¯ config.ts ä¸­ç? WORKER_URL');
  console.log('2. ?·è? node config.ts æª¢æŸ¥?ç½®');
  console.log('3. ä½¿ç”¨?¶ä?å·¥å…·?³æœ¬');
  console.log('');
  console.log('??ï¸? ?¯ç”¨å·¥å…·:');
  console.log('- node customer-manager.ts    (å®¢æˆ¶è³‡æ?ç®¡ç?)');
  console.log('- node customer-analytics.ts  (å®¢æˆ¶è³‡æ??†æ?)');
  console.log('- node monitor-customers.ts   (å®¢æˆ¶æ´»å???§)');
  console.log('- node query-customers.ts     (å®¢æˆ¶è³‡æ??¥è©¢)');
}