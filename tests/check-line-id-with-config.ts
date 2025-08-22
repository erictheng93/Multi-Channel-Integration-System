/**
 * 使用配置文件的 LINE ID 檢查工具 (TypeScript 版本)
 */

import { CONFIG } from '../config';

interface Customer {
  platform: string;
  platform_user_id: string;
  display_name?: string;
  avatar_url?: string;
  metadata?: string;
  created_at: string;
}

interface CustomersResponse {
  success: boolean;
  data?: {
    customers: Customer[];
  };
  error?: string;
}

interface HealthResponse {
  status: string;
  database?: string;
}

async function quickCheckLineId(): Promise<void> {
  console.log('🔍 快速檢查 LINE ID 收集狀態\n');

  // 檢查配置
  if (CONFIG.WORKER_URL === 'https://your-worker-domain.workers.dev') {
    console.log('⚠️  請先在 config.ts 中設定 WORKER_URL');
    console.log('💡 編輯 config.ts 文件，更新 WORKER_URL 為你的實際 Worker 網址');
    return;
  }

  console.log(`🌐 使用 Worker URL: ${CONFIG.WORKER_URL}`);
  console.log('');

  try {
    // 1. 檢查 API 連接
    console.log('📡 檢查 API 連接...');
    const healthResponse = await fetch(`${CONFIG.WORKER_URL}/health`);

    if (!healthResponse.ok) {
      console.log(`❌ API 連接失敗 (HTTP ${healthResponse.status})`);
      return;
    }

    const healthData: HealthResponse = await healthResponse.json();
    console.log(`✅ API 連接正常 (資料庫: ${healthData.database})`);

    // 2. 獲取客戶資料
    console.log('👥 獲取客戶資料...');
    const customersResponse = await fetch(`${CONFIG.WORKER_URL}/api/customers`);
    const customersData: CustomersResponse = await customersResponse.json();

    if (!customersData.success) {
      console.log('❌ 無法獲取客戶資料');
      console.log(`   錯誤: ${customersData.error}`);
      return;
    }

    const customers = customersData.data!.customers;
    const lineCustomers = customers.filter(c => c.platform === 'line');

    console.log(`✅ 總客戶數: ${customers.length}`);
    console.log(`✅ LINE 客戶數: ${lineCustomers.length}`);

    if (lineCustomers.length === 0) {
      console.log('\n⚠️  目前沒有 LINE 客戶資料');
      console.log('💡 這可能表示：');
      console.log('   1. 還沒有客戶發送過訊息');
      console.log('   2. Webhook 設定有問題');
      console.log('   3. LINE ID 收集功能未正常運作');
      console.log('\n🔧 建議檢查：');
      console.log('   1. LINE Webhook URL 是否指向你的 Worker');
      console.log('   2. LINE Channel Access Token 是否正確');
      console.log('   3. 使用 test-webhook.ps1 發送測試訊息');
      return;
    }

    // 3. 分析 LINE ID 格式
    console.log('\n📋 LINE ID 分析:');
    let validIds = 0;
    let invalidIds = 0;

    lineCustomers.forEach((customer, index) => {
      const lineId = customer.platform_user_id;
      const isValid = /^U[a-f0-9]{32}$/i.test(lineId);

      if (index < 5) { // 只顯示前5個
        console.log(`   ${index + 1}. ${lineId} ${isValid ? '✅' : '❌'}`);
        if (customer.display_name) {
          console.log(`      姓名: ${customer.display_name}`);
        }
        console.log(`      時間: ${customer.created_at}`);
        console.log('');
      }

      if (isValid) {
        validIds++;
      } else {
        invalidIds++;
      }
    });

    if (lineCustomers.length > 5) {
      console.log(`   ... 還有 ${lineCustomers.length - 5} 位客戶`);
    }

    console.log(`\n📊 統計結果:`);
    console.log(`   有效 LINE ID: ${validIds} 個`);
    console.log(`   無效 LINE ID: ${invalidIds} 個`);
    console.log(`   收集成功率: ${((validIds / lineCustomers.length) * 100).toFixed(1)}%`);

    // 4. 檢查資料完整性
    let hasName = lineCustomers.filter(c => c.display_name).length;
    let hasAvatar = lineCustomers.filter(c => c.avatar_url).length;
    let hasMetadata = lineCustomers.filter(c => c.metadata).length;

    console.log(`\n📈 資料完整性:`);
    console.log(`   顯示名稱: ${hasName}/${lineCustomers.length} (${((hasName / lineCustomers.length) * 100).toFixed(1)}%)`);
    console.log(`   頭像URL: ${hasAvatar}/${lineCustomers.length} (${((hasAvatar / lineCustomers.length) * 100).toFixed(1)}%)`);
    console.log(`   額外資訊: ${hasMetadata}/${lineCustomers.length} (${((hasMetadata / lineCustomers.length) * 100).toFixed(1)}%)`);

    // 5. 顯示最近的客戶
    if (lineCustomers.length > 0) {
      console.log(`\n👥 最近的 LINE 客戶:`);
      const recentCustomers = lineCustomers
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3);

      recentCustomers.forEach((customer, index) => {
        const metadata = customer.metadata ? JSON.parse(customer.metadata) : {};
        console.log(`   ${index + 1}. ${customer.display_name || '未知'}`);
        console.log(`      LINE ID: ${customer.platform_user_id}`);
        console.log(`      建立時間: ${customer.created_at}`);
        if (metadata.statusMessage) {
          console.log(`      狀態: ${metadata.statusMessage}`);
        }
        console.log('');
      });
    }

    // 6. 結論
    console.log(`🎯 結論:`);
    if (validIds === lineCustomers.length && validIds > 0) {
      console.log('✅ LINE ID 收集功能運作正常！');
      console.log('📱 客戶的 LINE ID 已正確被收集和儲存');
      console.log('\n🚀 你可以：');
      console.log('   1. 使用 API 查詢客戶資料');
      console.log('   2. 執行 node customer-analytics.ts 分析客戶');
      console.log('   3. 執行 node monitor-line-id.ts 實時監控');
    } else if (validIds > 0) {
      console.log('⚠️  LINE ID 收集部分正常');
      console.log(`   ${validIds} 個有效，${invalidIds} 個可能有問題`);
      console.log('\n🔧 建議：');
      console.log('   1. 檢查無效 ID 的來源');
      console.log('   2. 確認 Webhook 資料格式');
    } else {
      console.log('❌ LINE ID 收集可能有問題');
      console.log('\n🔧 建議檢查：');
      console.log('   1. Webhook 設定和程式碼邏輯');
      console.log('   2. LINE Channel 設定');
      console.log('   3. 執行 node verify-line-id-collection.ts 詳細診斷');
    }

  } catch (error: any) {
    console.log(`❌ 檢查過程中發生錯誤: ${error.message}`);
    console.log('\n💡 請確認：');
    console.log('   1. WORKER_URL 是否正確');
    console.log('   2. Worker 是否正在運行');
    console.log('   3. 網路連接是否正常');
    console.log('   4. 執行 node config.ts 檢查配置');
  }
}

quickCheckLineId();