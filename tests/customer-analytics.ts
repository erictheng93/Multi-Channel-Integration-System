/**
 * 客戶資料分析工具
 * 提供客戶行為分析和統計報告
 */

const WORKER_URL: string = 'https://multi-channel.imfinethankyouandyou.com'; // 實際 Worker URL

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
   * 獲取客戶資料
   */
  async fetchCustomers(): Promise<Customer[]> {
    try {
      const response = await fetch(`${this.workerUrl}/api/customers`);
      const data: CustomersResponse = await response.json();
      return data.success ? data.data.customers : [];
    } catch (error: any) {
      console.error('獲取客戶資料失敗:', error.message);
      return [];
    }
  }

  /**
   * 獲取系統統計
   */
  async fetchStats(): Promise<StatsData | null> {
    try {
      const response = await fetch(`${this.workerUrl}/api/stats`);
      const data: StatsResponse = await response.json();
      return data.success ? data.data : null;
    } catch (error: any) {
      console.error('獲取統計資料失敗:', error.message);
      return null;
    }
  }

  /**
   * 分析客戶平台分布
   */
  async analyzePlatformDistribution(): Promise<PlatformStats> {
    const customers = await this.fetchCustomers();
    const platformStats: PlatformStats = {};

    customers.forEach(customer => {
      const platform = customer.platform;
      platformStats[platform] = (platformStats[platform] || 0) + 1;
    });

    console.log('📊 客戶平台分布:');
    Object.entries(platformStats).forEach(([platform, count]) => {
      const percentage = ((count / customers.length) * 100).toFixed(1);
      console.log(`  ${platform}: ${count} 位客戶 (${percentage}%)`);
    });

    return platformStats;
  }

  /**
   * 分析客戶註冊時間趨勢
   */
  async analyzeRegistrationTrend(): Promise<DateStats> {
    const customers = await this.fetchCustomers();
    const dateStats: DateStats = {};

    customers.forEach(customer => {
      const date = customer.created_at.split('T')[0]; // 取日期部分
      dateStats[date] = (dateStats[date] || 0) + 1;
    });

    // 按日期排序
    const sortedDates = Object.keys(dateStats).sort();

    console.log('📈 客戶註冊趨勢 (最近7天):');
    sortedDates.slice(-7).forEach(date => {
      const count = dateStats[date];
      const bar = '█'.repeat(Math.min(count, 20)); // 最多顯示20個方塊
      console.log(`  ${date}: ${count} 位 ${bar}`);
    });

    return dateStats;
  }

  /**
   * 分析客戶活躍度
   */
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
          // 忽略 JSON 解析錯誤
        }
      }
    });

    console.log('🎯 客戶活躍度分析:');
    console.log(`  今天活躍: ${activeToday} 位`);
    console.log(`  本週活躍: ${activeThisWeek} 位`);
    console.log(`  本月活躍: ${activeThisMonth} 位`);
    console.log(`  有頭像: ${hasAvatar} 位 (${((hasAvatar/customers.length)*100).toFixed(1)}%)`);
    console.log(`  有狀態訊息: ${hasStatusMessage} 位 (${((hasStatusMessage/customers.length)*100).toFixed(1)}%)`);

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
   * 分析客戶資料完整度
   */
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
    
    console.log('📋 客戶資料完整度:');
    console.log(`  顯示名稱: ${hasDisplayName}/${total} (${((hasDisplayName/total)*100).toFixed(1)}%)`);
    console.log(`  頭像: ${hasAvatar}/${total} (${((hasAvatar/total)*100).toFixed(1)}%)`);
    console.log(`  電話: ${hasPhone}/${total} (${((hasPhone/total)*100).toFixed(1)}%)`);
    console.log(`  電子郵件: ${hasEmail}/${total} (${((hasEmail/total)*100).toFixed(1)}%)`);
    console.log(`  額外資訊: ${hasMetadata}/${total} (${((hasMetadata/total)*100).toFixed(1)}%)`);

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
   * 生成完整的分析報告
   */
  async generateReport(): Promise<void> {
    console.log('📊 客戶資料分析報告');
    console.log('='.repeat(50));
    console.log(`生成時間: ${new Date().toLocaleString()}\n`);

    // 基本統計
    const stats = await this.fetchStats();
    if (stats) {
      console.log('📈 基本統計:');
      console.log(`  總客戶數: ${stats.totalCustomers}`);
      console.log(`  總對話數: ${stats.totalConversations}`);
      console.log(`  總訊息數: ${stats.totalMessages}`);
      console.log(`  平均每客戶對話數: ${(stats.totalConversations / stats.totalCustomers).toFixed(2)}`);
      console.log(`  平均每對話訊息數: ${(stats.totalMessages / stats.totalConversations).toFixed(2)}`);
      console.log('');
    }

    // 平台分布
    await this.analyzePlatformDistribution();
    console.log('');

    // 註冊趨勢
    await this.analyzeRegistrationTrend();
    console.log('');

    // 活躍度分析
    await this.analyzeCustomerActivity();
    console.log('');

    // 資料完整度
    await this.analyzeDataCompleteness();
    console.log('');

    console.log('='.repeat(50));
    console.log('✅ 分析報告生成完成');
  }

  /**
   * 找出最活躍的客戶
   */
  async findTopCustomers(limit: number = 10): Promise<Customer[]> {
    const customers = await this.fetchCustomers();
    
    // 根據更新時間排序（最近更新的視為最活躍）
    const sortedCustomers = customers
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, limit);

    console.log(`🏆 最活躍的 ${limit} 位客戶:`);
    sortedCustomers.forEach((customer, index) => {
      let metadata: any = {};
      try {
        metadata = customer.metadata ? JSON.parse(customer.metadata) : {};
      } catch (e) {
        // 忽略 JSON 解析錯誤
      }
      
      console.log(`  ${index + 1}. ${customer.display_name || '未知'} (${customer.platform})`);
      console.log(`     最後活動: ${customer.updated_at}`);
      if (metadata.messageCount) {
        console.log(`     訊息數: ${metadata.messageCount}`);
      }
      console.log('');
    });

    return sortedCustomers;
  }

  /**
   * 匯出分析結果為 JSON
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

    console.log('📄 分析結果 JSON:');
    console.log(JSON.stringify(analytics, null, 2));

    return analytics;
  }
}

// 使用範例
async function main(): Promise<void> {
  if (WORKER_URL === 'https://your-worker-domain.workers.dev') {
    console.log('⚠️  請先更新 WORKER_URL 變數為你的實際 Worker 網址');
    return;
  }

  const analytics = new CustomerAnalytics(WORKER_URL);
  
  // 生成完整報告
  await analytics.generateReport();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 找出最活躍客戶
  await analytics.findTopCustomers(5);
}

// 如果直接執行這個腳本
if (typeof window === 'undefined') {
  main().catch(console.error);
}

// 匯出類別供其他地方使用
export { CustomerAnalytics };