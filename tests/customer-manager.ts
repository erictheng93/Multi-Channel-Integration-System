/**
 * å®¢æˆ¶è³‡æ?ç®¡ç?å·¥å…·
 * ?ä?å®¢æˆ¶è³‡æ??„æŸ¥è©¢ã€çµ±è¨ˆå?ç®¡ç??Ÿèƒ½
 */

const WORKER_URL: string = 'https://your-api-domain.example.com'; // å¯¦é? Worker URL

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
   * ?²å??€?‰å®¢??   */
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
      console.error('?²å?å®¢æˆ¶?—è¡¨å¤±æ?:', error.message);
      return [];
    }
  }

  /**
   * ?¹æ?å¹³å°?Œç”¨?¶ID?²å?å®¢æˆ¶
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
      console.error('?²å?å®¢æˆ¶è³‡æ?å¤±æ?:', error.message);
      return null;
    }
  }

  /**
   * ?²å?ç³»çµ±çµ±è?
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
      console.error('?²å?çµ±è?è³‡æ?å¤±æ?:', error.message);
      return null;
    }
  }

  /**
   * é¡¯ç¤ºå®¢æˆ¶?˜è?
   */
  async showCustomerSummary(): Promise<void> {
    console.log('?? å®¢æˆ¶è³‡æ??˜è?\n');
    
    const stats = await this.getStats();
    if (stats) {
      console.log(`ç¸½å®¢?¶æ•¸: ${stats.totalCustomers}`);
      console.log(`ç¸½å?è©±æ•¸: ${stats.totalConversations}`);
      console.log(`ç¸½è??¯æ•¸: ${stats.totalMessages}`);
      console.log('');
    }

    const customers = await this.getAllCustomers();
    if (customers.length > 0) {
      console.log('?€è¿‘ç?å®¢æˆ¶:');
      customers.slice(0, 10).forEach((customer: Customer, index: number) => {
        let metadata: any = {};
        try {
          metadata = customer.metadata ? JSON.parse(customer.metadata) : {};
        } catch (e) {
          // å¿½ç•¥ JSON è§???¯èª¤
        }
        
        console.log(`${index + 1}. ${customer.display_name || '?ªçŸ¥'} (${customer.platform})`);
        console.log(`   ?¨æˆ¶ID: ${customer.platform_user_id}`);
        console.log(`   å»ºç??‚é?: ${customer.created_at}`);
        if (metadata.statusMessage) {
          console.log(`   ?€?? ${metadata.statusMessage}`);
        }
        console.log('');
      });
    } else {
      console.log('?®å?æ²’æ?å®¢æˆ¶è³‡æ?');
    }
  }

  /**
   * ?œå?å®¢æˆ¶
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
        // å¿½ç•¥ JSON è§???¯èª¤
      }
      const statusMessage = metadata.statusMessage || '';
      
      return displayName.includes(keyword) || 
             platformUserId.includes(keyword) || 
             statusMessage.includes(keyword);
    });

    console.log(`?? ?œå?çµæ? (?œéµå­? "${keyword}"):`);
    if (results.length > 0) {
      results.forEach((customer: Customer, index: number) => {
        console.log(`${index + 1}. ${customer.display_name || '?ªçŸ¥'} (${customer.platform}:${customer.platform_user_id})`);
      });
    } else {
      console.log('æ²’æ??¾åˆ°ç¬¦å?æ¢ä»¶?„å®¢??);
    }
    
    return results;
  }

  /**
   * é¡¯ç¤ºå®¢æˆ¶è©³ç´°è³‡è?
   */
  async showCustomerDetails(platform: string, platformUserId: string): Promise<void> {
    console.log(`?‘¤ å®¢æˆ¶è©³ç´°è³‡è? (${platform}:${platformUserId})\n`);
    
    try {
      const response = await fetch(`${this.workerUrl}/api/customers/platform/${platform}/${platformUserId}`);
      const data: CustomerDetailResponse = await response.json();
      
      if (data.success) {
        const { customer, conversations } = data.data;
        let metadata: any = {};
        try {
          metadata = customer.metadata ? JSON.parse(customer.metadata) : {};
        } catch (e) {
          // å¿½ç•¥ JSON è§???¯èª¤
        }
        
        console.log('?ºæœ¬è³‡è?:');
        console.log(`  ID: ${customer.id}`);
        console.log(`  å§“å?: ${customer.display_name || '?ªçŸ¥'}`);
        console.log(`  å¹³å°: ${customer.platform}`);
        console.log(`  å¹³å°?¨æˆ¶ID: ${customer.platform_user_id}`);
        console.log(`  ?­å?: ${customer.avatar_url || '??}`);
        console.log(`  ?»è©±: ${customer.phone || '??}`);
        console.log(`  ?»å??µä»¶: ${customer.email || '??}`);
        console.log(`  å»ºç??‚é?: ${customer.created_at}`);
        console.log(`  ?´æ–°?‚é?: ${customer.updated_at}`);
        
        if (Object.keys(metadata).length > 0) {
          console.log('\né¡å?è³‡è?:');
          Object.entries(metadata).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
          });
        }
        
        console.log(`\nå°è©±çµ±è?:`);
        console.log(`  å°è©±?¸é?: ${conversations.length}`);
        
        if (conversations.length > 0) {
          console.log('\n?€è¿‘å?è©?');
          conversations.slice(0, 5).forEach((conv: Conversation, index: number) => {
            console.log(`  ${index + 1}. å°è©± #${conv.id} - ${conv.status} (${conv.last_message_at})`);
          });
        }
        
      } else {
        console.log('??å®¢æˆ¶ä¸å???);
      }
    } catch (error: any) {
      console.error('???²å?å®¢æˆ¶è©³ç´°è³‡è?å¤±æ?:', error.message);
    }
  }

  /**
   * ?¯å‡ºå®¢æˆ¶è³‡æ???CSV
   */
  async exportToCSV(): Promise<string> {
    const customers = await this.getAllCustomers();
    
    if (customers.length === 0) {
      console.log('æ²’æ?å®¢æˆ¶è³‡æ??¯åŒ¯??);
      return '';
    }

    const csvHeader = 'ID,å¹³å°,å¹³å°?¨æˆ¶ID,é¡¯ç¤º?ç¨±,?­å?URL,?»è©±,?»å??µä»¶,å»ºç??‚é?,?´æ–°?‚é?,?€?‹è???;
    const csvRows = customers.map(customer => {
      let metadata: any = {};
      try {
        metadata = customer.metadata ? JSON.parse(customer.metadata) : {};
      } catch (e) {
        // å¿½ç•¥ JSON è§???¯èª¤
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
    
    console.log('?? å®¢æˆ¶è³‡æ? CSV ?¼å?:');
    console.log(csvContent);
    
    return csvContent;
  }
}

// ä½¿ç”¨ç¯„ä?
async function main(): Promise<void> {
  if (WORKER_URL === 'https://your-worker-domain.workers.dev') {
    console.log('? ï?  è«‹å??´æ–° WORKER_URL è®Šæ•¸?ºä??„å¯¦??Worker ç¶²å?');
    return;
  }

  const manager = new CustomerManager(WORKER_URL);
  
  console.log('?¯ å®¢æˆ¶è³‡æ?ç®¡ç?å·¥å…·\n');
  
  // é¡¯ç¤ºå®¢æˆ¶?˜è?
  await manager.showCustomerSummary();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // ?¯ä»¥?–æ?è¨»è§£ä¾†æ¸¬è©¦å…¶ä»–å???  // await manager.searchCustomers('æ¸¬è©¦');
  // await manager.showCustomerDetails('line', 'U1234567890abcdef1234567890abcdef1');
  // await manager.exportToCSV();
}

// å¦‚æ??´æ¥?·è??™å€‹è…³??if (typeof window === 'undefined') {
  main().catch(console.error);
}

// ?¯å‡ºé¡åˆ¥ä¾›å…¶ä»–åœ°?¹ä½¿??export { CustomerManager };