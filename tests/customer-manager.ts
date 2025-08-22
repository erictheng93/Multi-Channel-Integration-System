/**
 * 客戶資料管理工具
 * 提供客戶資料的查詢、統計和管理功能
 */

const WORKER_URL: string = 'https://multi-channel.imfinethankyouandyou.com'; // 實際 Worker URL

interface Customer {
  id: string;
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

interface Conversation {
  id: string;
  status: string;
  last_message_at: string;
}

interface CustomersResponse {
  success: boolean;
  data: {
    customers: Customer[];
  };
  error?: string;
}

interface CustomerDetailResponse {
  success: boolean;
  data: {
    customer: Customer;
    conversations: Conversation[];
  };
  error?: string;
}

interface StatsData {
  totalCustomers: number;
  totalConversations: number;
  totalMessages: number;
}

interface StatsResponse {
  success: boolean;
  data: StatsData;
  error?: string;
}

class CustomerManager {
  private workerUrl: string;

  constructor(workerUrl: string) {
    this.workerUrl = workerUrl;
  }

  /**
   * 獲取所有客戶
   */
  async getAllCustomers(): Promise<Customer[]> {
    try {
      const response = await fetch(`${this.workerUrl}/api/customers`);
      const data: CustomersResponse = await response.json();
      
      if (data.success) {
        return data.data.customers;
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('獲取客戶列表失敗:', error.message);
      return [];
    }
  }

  /**
   * 根據平台和用戶ID獲取客戶
   */
  async getCustomerByPlatformId(platform: string, platformUserId: string): Promise<Customer | null> {
    try {
      const response = await fetch(`${this.workerUrl}/api/customers/platform/${platform}/${platformUserId}`);
      const data: CustomerDetailResponse = await response.json();
      
      if (data.success) {
        return data.data.customer;
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('獲取客戶資料失敗:', error.message);
      return null;
    }
  }

  /**
   * 獲取系統統計
   */
  async getStats(): Promise<StatsData | null> {
    try {
      const response = await fetch(`${this.workerUrl}/api/stats`);
      const data: StatsResponse = await response.json();
      
      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('獲取統計資料失敗:', error.message);
      return null;
    }
  }

  /**
   * 顯示客戶摘要
   */
  async showCustomerSummary(): Promise<void> {
    console.log('📊 客戶資料摘要\n');
    
    const stats = await this.getStats();
    if (stats) {
      console.log(`總客戶數: ${stats.totalCustomers}`);
      console.log(`總對話數: ${stats.totalConversations}`);
      console.log(`總訊息數: ${stats.totalMessages}`);
      console.log('');
    }

    const customers = await this.getAllCustomers();
    if (customers.length > 0) {
      console.log('最近的客戶:');
      customers.slice(0, 10).forEach((customer: Customer, index: number) => {
        let metadata: any = {};
        try {
          metadata = customer.metadata ? JSON.parse(customer.metadata) : {};
        } catch (e) {
          // 忽略 JSON 解析錯誤
        }
        
        console.log(`${index + 1}. ${customer.display_name || '未知'} (${customer.platform})`);
        console.log(`   用戶ID: ${customer.platform_user_id}`);
        console.log(`   建立時間: ${customer.created_at}`);
        if (metadata.statusMessage) {
          console.log(`   狀態: ${metadata.statusMessage}`);
        }
        console.log('');
      });
    } else {
      console.log('目前沒有客戶資料');
    }
  }

  /**
   * 搜尋客戶
   */
  async searchCustomers(keyword: string): Promise<Customer[]> {
    const customers = await this.getAllCustomers();
    const results = customers.filter(customer => {
      const displayName = customer.display_name || '';
      const platformUserId = customer.platform_user_id || '';
      let metadata: any = {};
      try {
        metadata = customer.metadata ? JSON.parse(customer.metadata) : {};
      } catch (e) {
        // 忽略 JSON 解析錯誤
      }
      const statusMessage = metadata.statusMessage || '';
      
      return displayName.includes(keyword) || 
             platformUserId.includes(keyword) || 
             statusMessage.includes(keyword);
    });

    console.log(`🔍 搜尋結果 (關鍵字: "${keyword}"):`);
    if (results.length > 0) {
      results.forEach((customer: Customer, index: number) => {
        console.log(`${index + 1}. ${customer.display_name || '未知'} (${customer.platform}:${customer.platform_user_id})`);
      });
    } else {
      console.log('沒有找到符合條件的客戶');
    }
    
    return results;
  }

  /**
   * 顯示客戶詳細資訊
   */
  async showCustomerDetails(platform: string, platformUserId: string): Promise<void> {
    console.log(`👤 客戶詳細資訊 (${platform}:${platformUserId})\n`);
    
    try {
      const response = await fetch(`${this.workerUrl}/api/customers/platform/${platform}/${platformUserId}`);
      const data: CustomerDetailResponse = await response.json();
      
      if (data.success) {
        const { customer, conversations } = data.data;
        let metadata: any = {};
        try {
          metadata = customer.metadata ? JSON.parse(customer.metadata) : {};
        } catch (e) {
          // 忽略 JSON 解析錯誤
        }
        
        console.log('基本資訊:');
        console.log(`  ID: ${customer.id}`);
        console.log(`  姓名: ${customer.display_name || '未知'}`);
        console.log(`  平台: ${customer.platform}`);
        console.log(`  平台用戶ID: ${customer.platform_user_id}`);
        console.log(`  頭像: ${customer.avatar_url || '無'}`);
        console.log(`  電話: ${customer.phone || '無'}`);
        console.log(`  電子郵件: ${customer.email || '無'}`);
        console.log(`  建立時間: ${customer.created_at}`);
        console.log(`  更新時間: ${customer.updated_at}`);
        
        if (Object.keys(metadata).length > 0) {
          console.log('\n額外資訊:');
          Object.entries(metadata).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
          });
        }
        
        console.log(`\n對話統計:`);
        console.log(`  對話數量: ${conversations.length}`);
        
        if (conversations.length > 0) {
          console.log('\n最近對話:');
          conversations.slice(0, 5).forEach((conv: Conversation, index: number) => {
            console.log(`  ${index + 1}. 對話 #${conv.id} - ${conv.status} (${conv.last_message_at})`);
          });
        }
        
      } else {
        console.log('❌ 客戶不存在');
      }
    } catch (error: any) {
      console.error('❌ 獲取客戶詳細資訊失敗:', error.message);
    }
  }

  /**
   * 匯出客戶資料為 CSV
   */
  async exportToCSV(): Promise<string> {
    const customers = await this.getAllCustomers();
    
    if (customers.length === 0) {
      console.log('沒有客戶資料可匯出');
      return '';
    }

    const csvHeader = 'ID,平台,平台用戶ID,顯示名稱,頭像URL,電話,電子郵件,建立時間,更新時間,狀態訊息';
    const csvRows = customers.map(customer => {
      let metadata: any = {};
      try {
        metadata = customer.metadata ? JSON.parse(customer.metadata) : {};
      } catch (e) {
        // 忽略 JSON 解析錯誤
      }
      
      return [
        customer.id,
        customer.platform,
        customer.platform_user_id,
        customer.display_name || '',
        customer.avatar_url || '',
        customer.phone || '',
        customer.email || '',
        customer.created_at,
        customer.updated_at,
        metadata.statusMessage || ''
      ].map(field => `"${field}"`).join(',');
    });

    const csvContent = [csvHeader, ...csvRows].join('\n');
    
    console.log('📄 客戶資料 CSV 格式:');
    console.log(csvContent);
    
    return csvContent;
  }
}

// 使用範例
async function main(): Promise<void> {
  if (WORKER_URL === 'https://your-worker-domain.workers.dev') {
    console.log('⚠️  請先更新 WORKER_URL 變數為你的實際 Worker 網址');
    return;
  }

  const manager = new CustomerManager(WORKER_URL);
  
  console.log('🎯 客戶資料管理工具\n');
  
  // 顯示客戶摘要
  await manager.showCustomerSummary();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 可以取消註解來測試其他功能
  // await manager.searchCustomers('測試');
  // await manager.showCustomerDetails('line', 'U1234567890abcdef1234567890abcdef1');
  // await manager.exportToCSV();
}

// 如果直接執行這個腳本
if (typeof window === 'undefined') {
  main().catch(console.error);
}

// 匯出類別供其他地方使用
export { CustomerManager };