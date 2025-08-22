// 測試 LINE API 連接

interface HealthResponse {
  status: string;
}

async function testLineAPI(): Promise<void> {
  console.log('🔗 測試 LINE API 連接');
  console.log('====================\n');

  try {
    // 從生產環境獲取 token (透過健康檢查確認服務正常)
    const healthResponse = await fetch('https://multi-channel.imfinethankyouandyou.com/health');
    const healthData: HealthResponse = await healthResponse.json();
    
    if (healthData.status !== 'healthy') {
      console.log('❌ 服務不健康，無法測試');
      return;
    }

    console.log('✅ 服務健康狀態正常');
    console.log('📝 請手動測試 LINE API:');
    console.log('1. 確認你已更新了正確的 Channel Access Token');
    console.log('2. 在手機上發送一條新訊息給 LINE Bot');
    console.log('3. 檢查是否收到回覆');
    
    console.log('\n🔍 如果仍然沒有回覆，請檢查:');
    console.log('- LINE Developers Console 中的 Channel Access Token 是否正確');
    console.log('- Token 是否已過期');
    console.log('- Messaging API 是否已啟用');
    
  } catch (error: any) {
    console.error('❌ 測試失敗:', error.message);
  }
}

testLineAPI();