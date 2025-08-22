/**
 * LINE ID 收集驗證工具
 * 專門用來驗證客戶的 LINE ID 是否正確被收集和儲存
 */

const WORKER_URL: string = 'https://multi-channel.imfinethankyouandyou.com'; // 實際 Worker URL

interface HealthResponse {
  status: string;
  database: string;
}

interface Customer {
  id: string;
  platform: string;
  platform_user_id: string;
  display_name?: string;
  avatar_url?: string;
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

interface CustomerDetailResponse {
  success: boolean;
  data: {
    customer: Customer;
    conversationCount: number;
  };
  error?: string;
}

interface WebhookEvent {
  type: string;
  message: {
    id: string;
    type: string;
    text: string;
  };
  source: {
    userId: string;
  };
  replyToken: string;
  timestamp: number;
}

interface WebhookPayload {
  events: WebhookEvent[];
}

interface WebhookResponse {
  message: string;
  error?: string;
}

class LineIdCollectionVerifier {
  private workerUrl: string;

  constructor(workerUrl: string) {
    this.workerUrl = workerUrl;
  }

  /**
   * 驗證 LINE ID 收集流程
   */
  async verifyLineIdCollection(): Promise<boolean> {
    console.log('🔍 LINE ID 收集流程驗證\n');
    
    // 步驟 1: 檢查 API 連接
    console.log('1️⃣ 檢查 API 連接...');
    try {
      const healthResponse = await fetch(`${this.workerUrl}/health`);
      const healthData: HealthResponse = await healthResponse.json();
      
      if (healthData.status === 'healthy') {
        console.log('✅ API 連接正常');
        console.log(`   資料庫狀態: ${healthData.database}`);
      } else {
        console.log('❌ API 連接異常');
        return false;
      }
    } catch (error: any) {
      console.log(`❌ API 連接失敗: ${error.message}`);
      return false;
    }

    console.log('');

    // 步驟 2: 檢查現有客戶資料
    console.log('2️⃣ 檢查現有客戶資料...');
    try {
      const customersResponse = await fetch(`${this.workerUrl}/api/customers`);
      const customersData: CustomersResponse = await customersResponse.json();
      
      if (customersData.success) {
        const customers = customersData.data.customers;
        console.log(`✅ 找到 ${customers.length} 位客戶`);
        
        if (customers.length > 0) {
          console.log('   最近的客戶:');
          customers.slice(0, 5).forEach((customer: Customer, index: number) => {
            console.log(`   ${index + 1}. LINE ID: ${customer.platform_user_id}`);
            console.log(`      姓名: ${customer.display_name || '未知'}`);
            console.log(`      建立時間: ${customer.created_at}`);
            console.log('');
          });
        } else {
          console.log('   目前沒有客戶資料');
        }
      } else {
        console.log('❌ 無法獲取客戶資料');
        return false;
      }
    } catch (error: any) {
      console.log(`❌ 獲取客戶資料失敗: ${error.message}`);
      return false;
    }

    // 步驟 3: 驗證 LINE ID 格式
    console.log('3️⃣ 驗證 LINE ID 格式...');
    try {
      const customersResponse = await fetch(`${this.workerUrl}/api/customers`);
      const customersData: CustomersResponse = await customersResponse.json();
      
      if (customersData.success) {
        const customers = customersData.data.customers;
        const lineCustomers = customers.filter(c => c.platform === 'line');
        
        console.log(`✅ 找到 ${lineCustomers.length} 位 LINE 客戶`);
        
        let validCount = 0;
        let invalidCount = 0;
        
        lineCustomers.forEach(customer => {
          const lineId = customer.platform_user_id;
          
          // LINE User ID 格式驗證
          // LINE User ID 通常以 'U' 開頭，後面跟著 32 個字符
          const isValidFormat = /^U[a-f0-9]{32}$/i.test(lineId);
          
          if (isValidFormat) {
            validCount++;
          } else {
            invalidCount++;
            console.log(`   ⚠️  可能無效的 LINE ID: ${lineId}`);
          }
        });
        
        console.log(`   ✅ 有效格式: ${validCount} 個`);
        console.log(`   ⚠️  可能無效: ${invalidCount} 個`);
      }
    } catch (error: any) {
      console.log(`❌ 驗證 LINE ID 格式失敗: ${error.message}`);
    }

    console.log('');

    // 步驟 4: 檢查資料完整性
    console.log('4️⃣ 檢查資料完整性...');
    try {
      const customersResponse = await fetch(`${this.workerUrl}/api/customers`);
      const customersData: CustomersResponse = await customersResponse.json();
      
      if (customersData.success) {
        const customers = customersData.data.customers;
        const lineCustomers = customers.filter(c => c.platform === 'line');
        
        let hasDisplayName = 0;
        let hasAvatar = 0;
        let hasMetadata = 0;
        
        lineCustomers.forEach(customer => {
          if (customer.display_name) hasDisplayName++;
          if (customer.avatar_url) hasAvatar++;
          if (customer.metadata) hasMetadata++;
        });
        
        const total = lineCustomers.length;
        
        if (total > 0) {
          console.log(`   LINE ID 收集率: 100% (${total}/${total})`);
          console.log(`   顯示名稱收集率: ${((hasDisplayName/total)*100).toFixed(1)}% (${hasDisplayName}/${total})`);
          console.log(`   頭像收集率: ${((hasAvatar/total)*100).toFixed(1)}% (${hasAvatar}/${total})`);
          console.log(`   額外資訊收集率: ${((hasMetadata/total)*100).toFixed(1)}% (${hasMetadata}/${total})`);
        } else {
          console.log('   沒有 LINE 客戶資料可分析');
        }
      }
    } catch (error: any) {
      console.log(`❌ 檢查資料完整性失敗: ${error.message}`);
    }

    console.log('');
    return true;
  }

  /**
   * 測試特定 LINE ID 的查詢
   */
  async testLineIdQuery(lineId: string): Promise<Customer | null> {
    console.log(`🔍 測試 LINE ID 查詢: ${lineId}\n`);
    
    try {
      const response = await fetch(`${this.workerUrl}/api/customers/platform/line/${lineId}`);
      const data: CustomerDetailResponse = await response.json();
      
      if (data.success) {
        const customer = data.data.customer;
        console.log('✅ 找到客戶資料:');
        console.log(`   客戶ID: ${customer.id}`);
        console.log(`   LINE ID: ${customer.platform_user_id}`);
        console.log(`   顯示名稱: ${customer.display_name || '未知'}`);
        console.log(`   頭像: ${customer.avatar_url || '無'}`);
        console.log(`   建立時間: ${customer.created_at}`);
        console.log(`   更新時間: ${customer.updated_at}`);
        
        if (customer.metadata) {
          try {
            const metadata = JSON.parse(customer.metadata);
            console.log('   額外資訊:');
            Object.entries(metadata).forEach(([key, value]) => {
              console.log(`     ${key}: ${value}`);
            });
          } catch (e) {
            console.log('   額外資訊: 無法解析');
          }
        }
        
        console.log(`   對話數量: ${data.data.conversationCount}`);
        
        return customer;
      } else {
        console.log('❌ 找不到該 LINE ID 的客戶資料');
        console.log(`   錯誤: ${data.error}`);
        return null;
      }
    } catch (error: any) {
      console.log(`❌ 查詢失敗: ${error.message}`);
      return null;
    }
  }

  /**
   * 模擬 LINE Webhook 事件來測試收集
   */
  async simulateLineWebhook(testLineId: string = 'U1234567890abcdef1234567890abcdef1'): Promise<boolean> {
    console.log('🧪 模擬 LINE Webhook 事件測試\n');
    
    const mockWebhookData: WebhookPayload = {
      events: [
        {
          type: 'message',
          message: {
            id: `test_${Date.now()}`,
            type: 'text',
            text: '測試訊息 - 驗證 LINE ID 收集'
          },
          source: {
            userId: testLineId
          },
          replyToken: `test_reply_${Date.now()}`,
          timestamp: Date.now()
        }
      ]
    };
    
    console.log('📤 發送模擬 Webhook:');
    console.log(JSON.stringify(mockWebhookData, null, 2));
    console.log('');
    
    try {
      const response = await fetch(`${this.workerUrl}/api/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mockWebhookData)
      });
      
      const result: WebhookResponse = await response.json();
      
      if (response.ok) {
        console.log('✅ Webhook 處理成功');
        console.log(`   回應: ${result.message}`);
        
        // 等待一下讓資料庫更新
        console.log('⏳ 等待資料庫更新...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 檢查是否成功收集到 LINE ID
        console.log('🔍 檢查收集結果...');
        const customer = await this.testLineIdQuery(testLineId);
        
        if (customer) {
          console.log('🎉 LINE ID 收集測試成功！');
          return true;
        } else {
          console.log('❌ LINE ID 收集測試失敗');
          return false;
        }
      } else {
        console.log('❌ Webhook 處理失敗');
        console.log(`   狀態: ${response.status}`);
        console.log(`   錯誤: ${result.error || '未知錯誤'}`);
        return false;
      }
    } catch (error: any) {
      console.log(`❌ 模擬測試失敗: ${error.message}`);
      return false;
    }
  }

  /**
   * 完整的驗證報告
   */
  async generateVerificationReport(): Promise<void> {
    console.log('📊 LINE ID 收集驗證報告');
    console.log('='.repeat(50));
    console.log(`生成時間: ${new Date().toLocaleString()}\n`);
    
    // 基本驗證
    const basicVerification = await this.verifyLineIdCollection();
    
    if (!basicVerification) {
      console.log('❌ 基本驗證失敗，請檢查配置和連接');
      return;
    }
    
    console.log('5️⃣ 執行模擬測試...');
    const simulationResult = await this.simulateLineWebhook();
    
    console.log('\n' + '='.repeat(50));
    console.log('📋 驗證總結:');
    console.log(`✅ API 連接: 正常`);
    console.log(`✅ 資料庫連接: 正常`);
    console.log(`✅ 客戶資料查詢: 正常`);
    console.log(`${simulationResult ? '✅' : '❌'} LINE ID 收集: ${simulationResult ? '正常' : '異常'}`);
    
    if (simulationResult) {
      console.log('\n🎉 恭喜！你的 LINE ID 收集功能運作正常！');
      console.log('📱 當客戶發送訊息時，系統會自動：');
      console.log('   1. 提取客戶的 LINE User ID');
      console.log('   2. 調用 LINE Profile API 獲取詳細資訊');
      console.log('   3. 儲存到 D1 資料庫的 customers 表');
      console.log('   4. 建立對應的對話和訊息記錄');
    } else {
      console.log('\n⚠️  LINE ID 收集功能可能有問題，請檢查：');
      console.log('   1. LINE Channel Access Token 是否正確');
      console.log('   2. D1 資料庫是否已正確初始化');
      console.log('   3. Worker 程式碼是否已部署最新版本');
    }
  }
}

// 使用範例
async function main(): Promise<void> {
  if (WORKER_URL === 'https://your-worker-domain.workers.dev') {
    console.log('⚠️  請先更新 WORKER_URL 變數為你的實際 Worker 網址');
    console.log('   可以在 config.cjs 中設定，或直接修改此檔案的 WORKER_URL');
    return;
  }

  const verifier = new LineIdCollectionVerifier(WORKER_URL);
  
  // 生成完整驗證報告
  await verifier.generateVerificationReport();
}

// 如果直接執行這個腳本
if (typeof window === 'undefined') {
  main().catch(console.error);
}

// 匯出類別供其他地方使用
export { LineIdCollectionVerifier };