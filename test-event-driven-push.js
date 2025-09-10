// 事件驅動推送測試腳本
// 用於驗證新的事件驅動架構是否正常工作

const TEST_CONFIG = {
  apiUrl: 'https://multi-channel.imfinethankyouandyou.com/api',
  testConversationId: '1', // 請根據實際情況調整
  testMessage: '🚀 事件驅動推送測試消息 - ' + new Date().toISOString()
};

async function testEventDrivenPush() {
  console.log('🧪 開始測試事件驅動推送功能...\n');

  try {
    // 1. 測試 SSE 連接
    console.log('1️⃣ 測試 SSE 連接...');
    await testSSEConnection();

    // 2. 測試消息創建和推送
    console.log('\n2️⃣ 測試消息創建和事件推送...');
    await testMessageCreation();

    // 3. 測試打字狀態
    console.log('\n3️⃣ 測試打字狀態事件...');
    await testTypingStatus();

    console.log('\n✅ 所有測試完成！');

  } catch (error) {
    console.error('\n❌ 測試失敗:', error);
  }
}

async function testSSEConnection() {
  return new Promise((resolve, reject) => {
    const sseUrl = `${TEST_CONFIG.apiUrl}/realtime/sse?conversationId=${TEST_CONFIG.testConversationId}&token=YOUR_JWT_TOKEN`;
    
    console.log(`   📡 連接到: ${sseUrl}`);
    
    // 注意：在 Node.js 環境中需要使用 eventsource 套件
    // 這裡提供瀏覽器測試代碼
    if (typeof EventSource !== 'undefined') {
      const eventSource = new EventSource(sseUrl);
      let receivedEvents = 0;
      
      eventSource.onopen = () => {
        console.log('   ✅ SSE 連接已建立');
      };
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log(`   📥 收到事件: ${data.type}`, data);
        receivedEvents++;
        
        if (receivedEvents >= 3) { // 收到幾個基本事件後關閉
          eventSource.close();
          resolve();
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('   ❌ SSE 錯誤:', error);
        eventSource.close();
        reject(error);
      };
      
      // 10 秒後自動關閉
      setTimeout(() => {
        if (eventSource.readyState !== EventSource.CLOSED) {
          eventSource.close();
          if (receivedEvents > 0) {
            resolve();
          } else {
            reject(new Error('未收到任何 SSE 事件'));
          }
        }
      }, 10000);
      
    } else {
      console.log('   ⚠️ EventSource 不可用，跳過 SSE 測試');
      resolve();
    }
  });
}

async function testMessageCreation() {
  try {
    const response = await fetch(`${TEST_CONFIG.apiUrl}/conversations/${TEST_CONFIG.testConversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_JWT_TOKEN'
      },
      body: JSON.stringify({
        content: TEST_CONFIG.testMessage,
        messageType: 'text'
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('   ✅ 消息創建成功:', result.data?.id);
      console.log('   🚀 事件應該已推送到隊列');
    } else {
      throw new Error(`消息創建失敗: ${response.status}`);
    }
  } catch (error) {
    console.error('   ❌ 消息創建測試失敗:', error);
  }
}

async function testTypingStatus() {
  try {
    // 開始打字
    const startResponse = await fetch(`${TEST_CONFIG.apiUrl}/realtime/typing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_JWT_TOKEN'
      },
      body: JSON.stringify({
        conversationId: TEST_CONFIG.testConversationId,
        isTyping: true
      })
    });

    if (startResponse.ok) {
      console.log('   ✅ 開始打字事件發送成功');
    }

    // 等待 2 秒
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 停止打字
    const stopResponse = await fetch(`${TEST_CONFIG.apiUrl}/realtime/typing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_JWT_TOKEN'
      },
      body: JSON.stringify({
        conversationId: TEST_CONFIG.testConversationId,
        isTyping: false
      })
    });

    if (stopResponse.ok) {
      console.log('   ✅ 停止打字事件發送成功');
    }

  } catch (error) {
    console.error('   ❌ 打字狀態測試失敗:', error);
  }
}

// 瀏覽器環境運行
if (typeof window !== 'undefined') {
  // 添加測試按鈕到頁面
  const testButton = document.createElement('button');
  testButton.textContent = '🧪 測試事件驅動推送';
  testButton.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    padding: 10px 20px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
  `;
  testButton.onclick = testEventDrivenPush;
  document.body.appendChild(testButton);
  
  console.log('🧪 事件驅動推送測試已準備就緒，點擊右上角按鈕開始測試');
}

// Node.js 環境運行
if (typeof module !== 'undefined') {
  module.exports = { testEventDrivenPush };
}

console.log(`
🎯 事件驅動推送測試指南：

1. 替換 YOUR_JWT_TOKEN 為有效的 JWT token
2. 確認 testConversationId 存在於系統中
3. 在瀏覽器控制台中運行此腳本，或點擊測試按鈕

預期結果：
✅ SSE 連接成功建立
✅ 收到連接確認事件
✅ 收到心跳事件
✅ 消息創建成功並觸發事件推送
✅ 打字狀態事件正常發送

如果所有測試通過，說明事件驅動推送系統工作正常！
`);