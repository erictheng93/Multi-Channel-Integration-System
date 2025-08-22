/**
 * 實時監控 LINE ID 收集
 * 監控新的 LINE ID 收集情況
 */

const WORKER_URL: string = 'https://multi-channel.imfinethankyouandyou.com'; // 實際 Worker URL
const CHECK_INTERVAL: number = 10000; // 10秒檢查一次

interface Customer {
  id: string;
  platform: string;
  platform_user_id: string;
  display_name?: string;
  avatar_url?: string;
  metadata?: string;
  created_at: string;
}

interface CustomersResponse {
  success: boolean;
  data: {
    customers: Customer[];
  };
}

interface MonitorStats {
  totalChecks: number;
  newIdsFound: number;
  startTime: Date;
}

class LineIdMonitor {
  private workerUrl: string;
  private interval: number;
  private knownLineIds: Set<string>;
  private isRunning: boolean;
  private stats: MonitorStats;
  private intervalId?: NodeJS.Timeout;

  constructor(workerUrl: string, interval: number = CHECK_INTERVAL) {
    this.workerUrl = workerUrl;
    this.interval = interval;
    this.knownLineIds = new Set();
    this.isRunning = false;
    this.stats = {
      totalChecks: 0,
      newIdsFound: 0,
      startTime: new Date()
    };
  }

  /**
   * 獲取所有 LINE 客戶
   */
  async fetchLineCustomers(): Promise<Customer[]> {
    try {
      const response = await fetch(`${this.workerUrl}/api/customers`);
      const data: CustomersResponse = await response.json();
      
      if (data.success) {
        return data.data.customers.filter(c => c.platform === 'line');
      }
      return [];
    } catch (error: any) {
      console.error('❌ 獲取客戶資料失敗:', error.message);
      return [];
    }
  }

  /**
   * 初始化已知 LINE ID
   */
  async initialize(): Promise<void> {
    console.log('🔄 初始化 LINE ID 監控...');
    
    const customers = await this.fetchLineCustomers();
    customers.forEach(customer => {
      this.knownLineIds.add(customer.platform_user_id);
    });
    
    console.log(`✅ 已載入 ${customers.length} 個現有 LINE ID`);
    console.log(`⏰ 監控間隔: ${this.interval / 1000} 秒`);
    console.log('🎯 開始監控新 LINE ID 收集...\n');
    
    this.showCurrentStats(customers);
  }

  /**
   * 顯示當前統計
   */
  showCurrentStats(customers: Customer[]): void {
    console.log('📊 當前統計:');
    
    let validIds = 0;
    let hasName = 0;
    let hasAvatar = 0;
    
    customers.forEach(customer => {
      if (/^U[a-f0-9]{32}$/i.test(customer.platform_user_id)) {
        validIds++;
      }
      if (customer.display_name) hasName++;
      if (customer.avatar_url) hasAvatar++;
    });
    
    console.log(`   總 LINE ID: ${customers.length}`);
    console.log(`   有效格式: ${validIds} (${customers.length > 0 ? ((validIds/customers.length)*100).toFixed(1) : 0}%)`);
    console.log(`   有顯示名稱: ${hasName} (${customers.length > 0 ? ((hasName/customers.length)*100).toFixed(1) : 0}%)`);
    console.log(`   有頭像: ${hasAvatar} (${customers.length > 0 ? ((hasAvatar/customers.length)*100).toFixed(1) : 0}%)`);
    console.log('');
  }

  /**
   * 檢查新的 LINE ID
   */
  async checkNewLineIds(): Promise<number> {
    this.stats.totalChecks++;
    
    const customers = await this.fetchLineCustomers();
    const newCustomers = customers.filter(customer => 
      !this.knownLineIds.has(customer.platform_user_id)
    );
    
    if (newCustomers.length > 0) {
      console.log(`🆕 發現 ${newCustomers.length} 個新 LINE ID:`);
      
      newCustomers.forEach(customer => {
        const lineId = customer.platform_user_id;
        const isValidFormat = /^U[a-f0-9]{32}$/i.test(lineId);
        let metadata: any = {};
        try {
          metadata = customer.metadata ? JSON.parse(customer.metadata) : {};
        } catch (e) {
          // 忽略 JSON 解析錯誤
        }
        
        console.log(`   📱 ${lineId} ${isValidFormat ? '✅' : '❌'}`);
        console.log(`      姓名: ${customer.display_name || '未知'}`);
        console.log(`      建立時間: ${customer.created_at}`);
        
        if (metadata.statusMessage) {
          console.log(`      狀態: ${metadata.statusMessage}`);
        }
        
        if (!isValidFormat) {
          console.log(`      ⚠️  格式可能不正確`);
        }
        
        console.log('');
        
        // 加入已知列表
        this.knownLineIds.add(lineId);
        this.stats.newIdsFound++;
      });
      
      console.log('-'.repeat(50));
    }
    
    return newCustomers.length;
  }

  /**
   * 顯示監控統計
   */
  showMonitorStats(): void {
    const runTime = Math.floor((new Date().getTime() - this.stats.startTime.getTime()) / 1000);
    const minutes = Math.floor(runTime / 60);
    const seconds = runTime % 60;
    
    console.log(`📈 監控統計 (運行時間: ${minutes}分${seconds}秒):`);
    console.log(`   檢查次數: ${this.stats.totalChecks}`);
    console.log(`   發現新 ID: ${this.stats.newIdsFound}`);
    console.log(`   已知 ID 總數: ${this.knownLineIds.size}`);
    console.log('');
  }

  /**
   * 執行一次檢查
   */
  async performCheck(): Promise<void> {
    const checkTime = new Date().toLocaleString();
    console.log(`🔍 檢查時間: ${checkTime}`);
    
    try {
      const newCount = await this.checkNewLineIds();
      
      if (newCount === 0) {
        console.log('   沒有新的 LINE ID');
      }
      
      // 每10次檢查顯示一次統計
      if (this.stats.totalChecks % 10 === 0) {
        this.showMonitorStats();
      }
      
    } catch (error: any) {
      console.error('❌ 檢查過程中發生錯誤:', error.message);
    }
  }

  /**
   * 開始監控
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  監控已在運行中');
      return;
    }
    
    await this.initialize();
    this.isRunning = true;
    
    // 立即執行一次檢查
    await this.performCheck();
    
    // 設定定期檢查
    this.intervalId = setInterval(async () => {
      if (this.isRunning) {
        await this.performCheck();
      }
    }, this.interval);
    
    console.log('✅ LINE ID 監控已啟動');
    console.log('💡 按 Ctrl+C 停止監控\n');
  }

  /**
   * 停止監控
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    console.log('\n🛑 LINE ID 監控已停止');
    this.showMonitorStats();
  }
}

// 使用範例
async function main(): Promise<void> {
  if (WORKER_URL === 'https://your-worker-domain.workers.dev') {
    console.log('⚠️  請先更新 WORKER_URL 變數為你的實際 Worker 網址');
    return;
  }

  const monitor = new LineIdMonitor(WORKER_URL);
  
  // 處理程式結束信號
  process.on('SIGINT', () => {
    console.log('\n🔄 正在停止監控...');
    monitor.stop();
    process.exit(0);
  });
  
  // 開始監控
  await monitor.start();
}

// 如果直接執行這個腳本
if (typeof window === 'undefined') {
  main().catch(console.error);
}

// 匯出類別供其他地方使用
export { LineIdMonitor };