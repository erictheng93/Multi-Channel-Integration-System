/**
 * å¯¦æ???§ LINE ID ?¶é?
 * ??§?°ç? LINE ID ?¶é??…æ?
 */

const WORKER_URL: string = 'https://your-api-domain.example.com'; // å¯¦é? Worker URL
const CHECK_INTERVAL: number = 10000; // 10ç§’æª¢?¥ä?æ¬?
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
   * ?²å??€??LINE å®¢æˆ¶
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
      console.error('???²å?å®¢æˆ¶è³‡æ?å¤±æ?:', error.message);
      return [];
    }
  }

  /**
   * ?å??–å·²??LINE ID
   */
  async initialize(): Promise<void> {
    console.log('?? ?å???LINE ID ??§...');
    
    const customers = await this.fetchLineCustomers();
    customers.forEach(customer => {
      this.knownLineIds.add(customer.platform_user_id);
    });
    
    console.log(`??å·²è???${customers.length} ?‹ç¾??LINE ID`);
    console.log(`????§?“é?: ${this.interval / 1000} ç§’`);
    console.log('?¯ ?‹å???§??LINE ID ?¶é?...\n');
    
    this.showCurrentStats(customers);
  }

  /**
   * é¡¯ç¤º?¶å?çµ±è?
   */
  showCurrentStats(customers: Customer[]): void {
    console.log('?? ?¶å?çµ±è?:');
    
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
    
    console.log(`   ç¸?LINE ID: ${customers.length}`);
    console.log(`   ?‰æ??¼å?: ${validIds} (${customers.length > 0 ? ((validIds/customers.length)*100).toFixed(1) : 0}%)`);
    console.log(`   ?‰é¡¯ç¤ºå?ç¨? ${hasName} (${customers.length > 0 ? ((hasName/customers.length)*100).toFixed(1) : 0}%)`);
    console.log(`   ?‰é ­?? ${hasAvatar} (${customers.length > 0 ? ((hasAvatar/customers.length)*100).toFixed(1) : 0}%)`);
    console.log('');
  }

  /**
   * æª¢æŸ¥?°ç? LINE ID
   */
  async checkNewLineIds(): Promise<number> {
    this.stats.totalChecks++;
    
    const customers = await this.fetchLineCustomers();
    const newCustomers = customers.filter(customer => 
      !this.knownLineIds.has(customer.platform_user_id)
    );
    
    if (newCustomers.length > 0) {
      console.log(`?? ?¼ç¾ ${newCustomers.length} ?‹æ–° LINE ID:`);
      
      newCustomers.forEach(customer => {
        const lineId = customer.platform_user_id;
        const isValidFormat = /^U[a-f0-9]{32}$/i.test(lineId);
        let metadata: any = {};
        try {
          metadata = customer.metadata ? JSON.parse(customer.metadata) : {};
        } catch (e) {
          // å¿½ç•¥ JSON è§???¯èª¤
        }
        
        console.log(`   ?“± ${lineId} ${isValidFormat ? '?? : '??}`);
        console.log(`      å§“å?: ${customer.display_name || '?ªçŸ¥'}`);
        console.log(`      å»ºç??‚é?: ${customer.created_at}`);
        
        if (metadata.statusMessage) {
          console.log(`      ?€?? ${metadata.statusMessage}`);
        }
        
        if (!isValidFormat) {
          console.log(`      ? ï?  ?¼å??¯èƒ½ä¸æ­£ç¢º`);
        }
        
        console.log('');
        
        // ? å…¥å·²çŸ¥?—è¡¨
        this.knownLineIds.add(lineId);
        this.stats.newIdsFound++;
      });
      
      console.log('-'.repeat(50));
    }
    
    return newCustomers.length;
  }

  /**
   * é¡¯ç¤º??§çµ±è?
   */
  showMonitorStats(): void {
    const runTime = Math.floor((new Date().getTime() - this.stats.startTime.getTime()) / 1000);
    const minutes = Math.floor(runTime / 60);
    const seconds = runTime % 60;
    
    console.log(`?? ??§çµ±è? (?‹è??‚é?: ${minutes}??{seconds}ç§?:`);
    console.log(`   æª¢æŸ¥æ¬¡æ•¸: ${this.stats.totalChecks}`);
    console.log(`   ?¼ç¾??ID: ${this.stats.newIdsFound}`);
    console.log(`   å·²çŸ¥ ID ç¸½æ•¸: ${this.knownLineIds.size}`);
    console.log('');
  }

  /**
   * ?·è?ä¸€æ¬¡æª¢??   */
  async performCheck(): Promise<void> {
    const checkTime = new Date().toLocaleString();
    console.log(`?? æª¢æŸ¥?‚é?: ${checkTime}`);
    
    try {
      const newCount = await this.checkNewLineIds();
      
      if (newCount === 0) {
        console.log('   æ²’æ??°ç? LINE ID');
      }
      
      // æ¯?0æ¬¡æª¢?¥é¡¯ç¤ºä?æ¬¡çµ±è¨?      if (this.stats.totalChecks % 10 === 0) {
        this.showMonitorStats();
      }
      
    } catch (error: any) {
      console.error('??æª¢æŸ¥?ç?ä¸­ç™¼?ŸéŒ¯èª?', error.message);
    }
  }

  /**
   * ?‹å???§
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('? ï?  ??§å·²åœ¨?‹è?ä¸?);
      return;
    }
    
    await this.initialize();
    this.isRunning = true;
    
    // ç«‹å³?·è?ä¸€æ¬¡æª¢??    await this.performCheck();
    
    // è¨­å?å®šæ?æª¢æŸ¥
    this.intervalId = setInterval(async () => {
      if (this.isRunning) {
        await this.performCheck();
      }
    }, this.interval);
    
    console.log('??LINE ID ??§å·²å???);
    console.log('?’¡ ??Ctrl+C ?œæ­¢??§\n');
  }

  /**
   * ?œæ­¢??§
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    console.log('\n?? LINE ID ??§å·²å?æ­?);
    this.showMonitorStats();
  }
}

// ä½¿ç”¨ç¯„ä?
async function main(): Promise<void> {
  if (WORKER_URL === 'https://your-worker-domain.workers.dev') {
    console.log('? ï?  è«‹å??´æ–° WORKER_URL è®Šæ•¸?ºä??„å¯¦??Worker ç¶²å?');
    return;
  }

  const monitor = new LineIdMonitor(WORKER_URL);
  
  // ?•ç?ç¨‹å?çµæ?ä¿¡è?
  process.on('SIGINT', () => {
    console.log('\n?? æ­?œ¨?œæ­¢??§...');
    monitor.stop();
    process.exit(0);
  });
  
  // ?‹å???§
  await monitor.start();
}

// å¦‚æ??´æ¥?·è??™å€‹è…³??if (typeof window === 'undefined') {
  main().catch(console.error);
}

// ?¯å‡ºé¡åˆ¥ä¾›å…¶ä»–åœ°?¹ä½¿??export { LineIdMonitor };