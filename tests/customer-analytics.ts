/**
 * å®¢æˆ¶è³‡æ??†æ?å·¥å…·
 * ?ä?å®¢æˆ¶è¡Œç‚º?†æ??Œçµ±è¨ˆå ±?? */

const WORKER_URL: string = 'https://your-api-domain.example.com'; // å¯¦é? Worker URL

interface Customer {
  platform: string;
  platform_user_id: string;
  display_name?: string;
  avatar_url?: string;
  phone?: string;
  email?: string;
  metadata?: string;
  created_at: string;
  updated_at: string;
}

interface CustomersResponse {
  success: boolean;
  data: {
    customers: Customer[];
  };
}

interface StatsData {
  totalCustomers: number;
  totalConversations: number;
  totalMessages: number;
}

interface StatsResponse {
  success: boolean;
  data: StatsData;
}

interface PlatformStats {
  [platform: string]: number;
}

interface DateStats {
  [date: string]: number;
}

interface ActivityStats {
  activeToday: number;
  activeThisWeek: number;
  activeThisMonth: number;
  hasAvatar: number;
  hasStatusMessage: number;
  total: number;
}

interface CompletenessStats {
  hasDisplayName: number;
  hasAvatar: number;
  hasPhone: number;
  hasEmail: number;
  hasMetadata: number;
  total: number;
}

interface AnalyticsExport {
  timestamp: string;
  summary: StatsData | null;
  platformDistribution: PlatformStats;
  activity: ActivityStats;
  dataCompleteness: CompletenessStats;
  totalCustomers: number;
}

class CustomerAnalytics {
  private workerUrl: string;

  constructor(workerUrl: string) {
    this.workerUrl = workerUrl;
  }

  /**
   * ?²å?å®¢æˆ¶è³‡æ?
   */
  async fetchCustomers(): Promise<Customer[]> {
    try {
      const response = await fetch(`${this.workerUrl}/api/customers`);
      const data: CustomersResponse = await response.json();
      return data.success ? data.data.customers : [];
    } catch (error: any) {
      console.error('?²å?å®¢æˆ¶è³‡æ?å¤±æ?:', error.message);
      return [];
    }
  }

  /**
   * ?²å?ç³»çµ±çµ±è?
   */
  async fetchStats(): Promise<StatsData | null> {
    try {
      const response = await fetch(`${this.workerUrl}/api/stats`);
      const data: StatsResponse = await response.json();
      return data.success ? data.data : null;
    } catch (error: any) {
      console.error('?²å?çµ±è?è³‡æ?å¤±æ?:', error.message);
      return null;
    }
  }

  /**
   * ?†æ?å®¢æˆ¶å¹³å°?†å?
   */
  async analyzePlatformDistribution(): Promise<PlatformStats> {
    const customers = await this.fetchCustomers();
    const platformStats: PlatformStats = {};

    customers.forEach(customer => {
      const platform = customer.platform;
      platformStats[platform] = (platformStats[platform] || 0) + 1;
    });

    console.log('?? å®¢æˆ¶å¹³å°?†å?:');
    Object.entries(platformStats).forEach(([platform, count]) => {
      const percentage = ((count / customers.length) * 100).toFixed(1);
      console.log(`  ${platform}: ${count} ä½å®¢??(${percentage}%)`);
    });

    return platformStats;
  }

  /**
   * ?†æ?å®¢æˆ¶è¨»å??‚é?è¶¨å‹¢
   */
  async analyzeRegistrationTrend(): Promise<DateStats> {
    const customers = await this.fetchCustomers();
    const dateStats: DateStats = {};

    customers.forEach(customer => {
      const date = customer.created_at.split('T')[0]; // ?–æ—¥?Ÿéƒ¨??      dateStats[date] = (dateStats[date] || 0) + 1;
    });

    // ?‰æ—¥?Ÿæ?åº?    const sortedDates = Object.keys(dateStats).sort();

    console.log('?? å®¢æˆ¶è¨»å?è¶¨å‹¢ (?€è¿?å¤?:');
    sortedDates.slice(-7).forEach(date => {
      const count = dateStats[date];
      const bar = '??.repeat(Math.min(count, 20)); // ?€å¤šé¡¯ç¤?0?‹æ–¹å¡?      console.log(`  ${date}: ${count} ä½?${bar}`);
    });

    return dateStats;
  }

  /**
   * ?†æ?å®¢æˆ¶æ´»è?åº?   */
  async analyzeCustomerActivity(): Promise<ActivityStats> {
    const customers = await this.fetchCustomers();
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let activeToday = 0;
    let activeThisWeek = 0;
    let activeThisMonth = 0;
    let hasAvatar = 0;
    let hasStatusMessage = 0;

    customers.forEach(customer => {
      const updatedAt = new Date(customer.updated_at);
      
      if (updatedAt > oneDayAgo) activeToday++;
      if (updatedAt > oneWeekAgo) activeThisWeek++;
      if (updatedAt > oneMonthAgo) activeThisMonth++;
      
      if (customer.avatar_url) hasAvatar++;
      
      if (customer.metadata) {
        try {
          const metadata = JSON.parse(customer.metadata);
          if (metadata.statusMessage) hasStatusMessage++;
        } catch (e) {
          // å¿½ç•¥ JSON è§???¯èª¤
        }
      }
    });

    console.log('?¯ å®¢æˆ¶æ´»è?åº¦å???');
    console.log(`  ä»Šå¤©æ´»è?: ${activeToday} ä½`);
    console.log(`  ?¬é€±æ´»èº? ${activeThisWeek} ä½`);
    console.log(`  ?¬æ?æ´»è?: ${activeThisMonth} ä½`);
    console.log(`  ?‰é ­?? ${hasAvatar} ä½?(${((hasAvatar/customers.length)*100).toFixed(1)}%)`);
    console.log(`  ?‰ç??‹è??? ${hasStatusMessage} ä½?(${((hasStatusMessage/customers.length)*100).toFixed(1)}%)`);

    return {
      activeToday,
      activeThisWeek,
      activeThisMonth,
      hasAvatar,
      hasStatusMessage,
      total: customers.length
    };
  }

  /**
   * ?†æ?å®¢æˆ¶è³‡æ?å®Œæ•´åº?   */
  async analyzeDataCompleteness(): Promise<CompletenessStats> {
    const customers = await this.fetchCustomers();
    
    let hasDisplayName = 0;
    let hasAvatar = 0;
    let hasPhone = 0;
    let hasEmail = 0;
    let hasMetadata = 0;

    customers.forEach(customer => {
      if (customer.display_name) hasDisplayName++;
      if (customer.avatar_url) hasAvatar++;
      if (customer.phone) hasPhone++;
      if (customer.email) hasEmail++;
      if (customer.metadata) hasMetadata++;
    });

    const total = customers.length;
    
    console.log('?? å®¢æˆ¶è³‡æ?å®Œæ•´åº?');
    console.log(`  é¡¯ç¤º?ç¨±: ${hasDisplayName}/${total} (${((hasDisplayName/total)*100).toFixed(1)}%)`);
    console.log(`  ?­å?: ${hasAvatar}/${total} (${((hasAvatar/total)*100).toFixed(1)}%)`);
    console.log(`  ?»è©±: ${hasPhone}/${total} (${((hasPhone/total)*100).toFixed(1)}%)`);
    console.log(`  ?»å??µä»¶: ${hasEmail}/${total} (${((hasEmail/total)*100).toFixed(1)}%)`);
    console.log(`  é¡å?è³‡è?: ${hasMetadata}/${total} (${((hasMetadata/total)*100).toFixed(1)}%)`);

    return {
      hasDisplayName,
      hasAvatar,
      hasPhone,
      hasEmail,
      hasMetadata,
      total
    };
  }

  /**
   * ?Ÿæ?å®Œæ•´?„å??å ±??   */
  async generateReport(): Promise<void> {
    console.log('?? å®¢æˆ¶è³‡æ??†æ??±å?');
    console.log('='.repeat(50));
    console.log(`?Ÿæ??‚é?: ${new Date().toLocaleString()}\n`);

    // ?ºæœ¬çµ±è?
    const stats = await this.fetchStats();
    if (stats) {
      console.log('?? ?ºæœ¬çµ±è?:');
      console.log(`  ç¸½å®¢?¶æ•¸: ${stats.totalCustomers}`);
      console.log(`  ç¸½å?è©±æ•¸: ${stats.totalConversations}`);
      console.log(`  ç¸½è??¯æ•¸: ${stats.totalMessages}`);
      console.log(`  å¹³å?æ¯å®¢?¶å?è©±æ•¸: ${(stats.totalConversations / stats.totalCustomers).toFixed(2)}`);
      console.log(`  å¹³å?æ¯å?è©±è??¯æ•¸: ${(stats.totalMessages / stats.totalConversations).toFixed(2)}`);
      console.log('');
    }

    // å¹³å°?†å?
    await this.analyzePlatformDistribution();
    console.log('');

    // è¨»å?è¶¨å‹¢
    await this.analyzeRegistrationTrend();
    console.log('');

    // æ´»è?åº¦å???    await this.analyzeCustomerActivity();
    console.log('');

    // è³‡æ?å®Œæ•´åº?    await this.analyzeDataCompleteness();
    console.log('');

    console.log('='.repeat(50));
    console.log('???†æ??±å??Ÿæ?å®Œæ?');
  }

  /**
   * ?¾å‡º?€æ´»è??„å®¢??   */
  async findTopCustomers(limit: number = 10): Promise<Customer[]> {
    const customers = await this.fetchCustomers();
    
    // ?¹æ??´æ–°?‚é??’å?ï¼ˆæ?è¿‘æ›´?°ç?è¦–ç‚º?€æ´»è?ï¼?    const sortedCustomers = customers
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, limit);

    console.log(`?? ?€æ´»è???${limit} ä½å®¢??`);
    sortedCustomers.forEach((customer, index) => {
      let metadata: any = {};
      try {
        metadata = customer.metadata ? JSON.parse(customer.metadata) : {};
      } catch (e) {
        // å¿½ç•¥ JSON è§???¯èª¤
      }
      
      console.log(`  ${index + 1}. ${customer.display_name || '?ªçŸ¥'} (${customer.platform})`);
      console.log(`     ?€å¾Œæ´»?? ${customer.updated_at}`);
      if (metadata.messageCount) {
        console.log(`     è¨Šæ¯?? ${metadata.messageCount}`);
      }
      console.log('');
    });

    return sortedCustomers;
  }

  /**
   * ?¯å‡º?†æ?çµæ???JSON
   */
  async exportAnalytics(): Promise<AnalyticsExport> {
    const customers = await this.fetchCustomers();
    const stats = await this.fetchStats();
    const platformDist = await this.analyzePlatformDistribution();
    const activity = await this.analyzeCustomerActivity();
    const completeness = await this.analyzeDataCompleteness();

    const analytics: AnalyticsExport = {
      timestamp: new Date().toISOString(),
      summary: stats,
      platformDistribution: platformDist,
      activity: activity,
      dataCompleteness: completeness,
      totalCustomers: customers.length
    };

    console.log('?? ?†æ?çµæ? JSON:');
    console.log(JSON.stringify(analytics, null, 2));

    return analytics;
  }
}

// ä½¿ç”¨ç¯„ä?
async function main(): Promise<void> {
  if (WORKER_URL === 'https://your-worker-domain.workers.dev') {
    console.log('? ï?  è«‹å??´æ–° WORKER_URL è®Šæ•¸?ºä??„å¯¦??Worker ç¶²å?');
    return;
  }

  const analytics = new CustomerAnalytics(WORKER_URL);
  
  // ?Ÿæ?å®Œæ•´?±å?
  await analytics.generateReport();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // ?¾å‡º?€æ´»è?å®¢æˆ¶
  await analytics.findTopCustomers(5);
}

// å¦‚æ??´æ¥?·è??™å€‹è…³??if (typeof window === 'undefined') {
  main().catch(console.error);
}

// ?¯å‡ºé¡åˆ¥ä¾›å…¶ä»–åœ°?¹ä½¿??export { CustomerAnalytics };