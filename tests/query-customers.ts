/**
 * 查詢客戶資料的測試腳本
 * 使用這個腳本來測試客戶資料查詢功能
 */

const WORKER_URL: string = 'https://multi-channel.imfinethankyouandyou.com'; // 實際 Worker URL

interface Customer {
  id: string;
  platform: string;
  platform_user_id: string;
  display_name?: string;
  avatar_url?: string;
  metadata?: string;
  created_at: string;
}

interface AllCustomersResponse {
  success: boolean;
  data: {
    count: number;
    customers: Customer[];
  };
  error?: string;
}

interface SpecificCustomerResponse {
  success: boolean;
  data: {
    customer: Customer;
    conversationCount: number;
  };
  error?: string;
}

interface StatsResponse {
  success: boolean;
  data: {
    totalCustomers: number;
    totalConversations: number;
    totalMessages: number;
    recentMessages: any[];
  };
  error?: string;
}

async function testCustomerQueries(): Promise<void> {
  console.log('🔍 開始測試客戶資料查詢功能...\n');

  try {
    // 1. 查詢所有客戶
    console.log('📊 查詢所有客戶...');
    const allCustomersResponse = await fetch(`${WORKER_URL}/api/customers`);
    const allCustomersData: AllCustomersResponse = await allCustomersResponse.json();
    
    if (allCustomersData.success) {
      console.log(`✅ 找到 ${allCustomersData.data.count} 位客戶`);
      allCustomersData.data.customers.forEach((customer: Customer, index: number) => {
        console.log(`  ${index + 1}. ${customer.display_name || '未知'} (${customer.platform}:${customer.platform_user_id})`);
      });
    } else {
      console.log('❌ 查詢失敗:', allCustomersData.error);
    }

    console.log('\n');

    // 2. 查詢特定平台的客戶（如果有的話）
    if (allCustomersData.success && allCustomersData.data.customers.length > 0) {
      const firstCustomer = allCustomersData.data.customers[0];
      console.log(`🎯 查詢特定客戶: ${firstCustomer.platform}:${firstCustomer.platform_user_id}`);
      
      const specificCustomerResponse = await fetch(
        `${WORKER_URL}/api/customers/platform/${firstCustomer.platform}/${firstCustomer.platform_user_id}`
      );
      const specificCustomerData: SpecificCustomerResponse = await specificCustomerResponse.json();
      
      if (specificCustomerData.success) {
        console.log('✅ 客戶詳細資訊:');
        console.log(`  ID: ${specificCustomerData.data.customer.id}`);
        console.log(`  姓名: ${specificCustomerData.data.customer.display_name || '未知'}`);
        console.log(`  平台: ${specificCustomerData.data.customer.platform}`);
        console.log(`  平台用戶ID: ${specificCustomerData.data.customer.platform_user_id}`);
        console.log(`  頭像: ${specificCustomerData.data.customer.avatar_url || '無'}`);
        console.log(`  對話數: ${specificCustomerData.data.conversationCount}`);
        console.log(`  建立時間: ${specificCustomerData.data.customer.created_at}`);
        
        if (specificCustomerData.data.customer.metadata) {
          console.log('  額外資訊:');
          try {
            const metadata = JSON.parse(specificCustomerData.data.customer.metadata);
            Object.entries(metadata).forEach(([key, value]) => {
              console.log(`    ${key}: ${value}`);
            });
          } catch (e) {
            console.log('    無法解析額外資訊');
          }
        }
      } else {
        console.log('❌ 查詢特定客戶失敗:', specificCustomerData.error);
      }
    }

    console.log('\n');

    // 3. 查詢系統統計
    console.log('📈 查詢系統統計...');
    const statsResponse = await fetch(`${WORKER_URL}/api/stats`);
    const statsData: StatsResponse = await statsResponse.json();
    
    if (statsData.success) {
      console.log('✅ 系統統計:');
      console.log(`  總客戶數: ${statsData.data.totalCustomers}`);
      console.log(`  總對話數: ${statsData.data.totalConversations}`);
      console.log(`  總訊息數: ${statsData.data.totalMessages}`);
      console.log(`  最近訊息數: ${statsData.data.recentMessages.length}`);
    } else {
      console.log('❌ 查詢統計失敗:', statsData.error);
    }

  } catch (error: any) {
    console.error('❌ 測試過程中發生錯誤:', error.message);
    console.log('\n💡 請確認:');
    console.log('1. Worker URL 是否正確');
    console.log('2. Worker 是否正在運行');
    console.log('3. 資料庫是否已初始化');
  }

  console.log('\n🏁 測試完成！');
}

// 如果直接執行這個腳本
if (typeof window === 'undefined') {
  // Node.js 環境
  console.log('⚠️  請先更新 WORKER_URL 變數為你的實際 Worker 網址');
  console.log('然後執行: node query-customers.ts\n');
  
  if (WORKER_URL !== 'https://your-worker-domain.workers.dev') {
    testCustomerQueries();
  }
} else {
  // 瀏覽器環境
  console.log('🌐 在瀏覽器中執行，請手動調用 testCustomerQueries() 函數');
}

// 匯出函數供其他地方使用
export { testCustomerQueries };