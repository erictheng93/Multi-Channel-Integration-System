/**
 * 前端貼圖渲染診斷腳本
 *
 * 使用方法:
 * 1. 打開對話頁面: http://localhost:3000/conversations/39754c72-ba50-4a35-ba86-56feb46bd710
 * 2. 按 F12 打開開發者工具
 * 3. 切換到 Console 標籤
 * 4. 複製並貼上此檔案的全部內容
 * 5. 按 Enter 執行
 */

console.log('🔍 開始診斷 LINE 貼圖渲染問題...\n');

// 測試數據 (從資料庫查詢結果)
const testSticker = {
  id: '34ab776a-cd08-44ee-a8e9-f125d8814970',
  content: '[貼圖]',
  messageType: 'sticker',
  metadata: '{"packageId":"35618","stickerId":"785142188"}',
  created_at: '2025-09-03T03:05:57.205Z'
};

console.log('📦 測試貼圖數據:', testSticker);
console.log('');

// 步驟 1: 測試 metadata 解析
console.log('📋 步驟 1: 測試 metadata 解析');
console.log('───────────────────────────────────────');
try {
  const metadata = JSON.parse(testSticker.metadata);
  console.log('✅ Metadata 解析成功:', metadata);
  console.log('   - packageId:', metadata.packageId);
  console.log('   - stickerId:', metadata.stickerId);

  if (metadata.packageId && metadata.stickerId) {
    console.log('✅ packageId 和 stickerId 都存在');
  } else {
    console.warn('⚠️ packageId 或 stickerId 缺失!');
  }
} catch (error) {
  console.error('❌ Metadata 解析失敗:', error);
}
console.log('');

// 步驟 2: 測試 LINE CDN URL 生成
console.log('📋 步驟 2: 測試 LINE CDN URL 生成');
console.log('───────────────────────────────────────');
const metadata = JSON.parse(testSticker.metadata);
const { packageId, stickerId } = metadata;

const stickerUrls = [
  `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/android/sticker.png`,
  `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/iPhone/sticker.png`,
  `https://stickershop.line-scdn.net/products/${packageId}/sticker.png?v=${stickerId}`,
  `https://obs.line-scdn.net/${packageId}/${stickerId}/android/sticker.png`,
  `https://obs.line-scdn.net/${packageId}/${stickerId}/ios/sticker.png`
];

console.log('✅ 生成的 LINE CDN URLs:');
stickerUrls.forEach((url, index) => {
  console.log(`   ${index + 1}. ${url}`);
});
console.log('');

// 步驟 3: 測試 HEAD 請求檢查文件大小
console.log('📋 步驟 3: 測試 HEAD 請求檢查文件大小');
console.log('───────────────────────────────────────');

async function testStickerUrls() {
  for (let i = 0; i < stickerUrls.length; i++) {
    const url = stickerUrls[i];
    console.log(`\n🔍 測試 URL ${i + 1}:`);
    console.log(`   ${url}`);

    try {
      const response = await fetch(url, { method: 'HEAD' });
      const contentLength = response.headers.get('content-length');
      const contentType = response.headers.get('content-type');

      console.log(`   HTTP Status: ${response.status} ${response.statusText}`);
      console.log(`   Content-Type: ${contentType}`);
      console.log(`   Content-Length: ${contentLength}`);

      if (response.status === 200) {
        if (contentLength === '0' || contentLength === null) {
          console.warn('   ⚠️ 文件是空的或不存在 (Content-Length: 0)');
          console.warn('   ➡️ 應該顯示 Fallback: 🎭 [貼圖] 貼圖暫時無法顯示');
        } else {
          console.log('   ✅ 文件存在且有內容!');
          console.log(`   ➡️ 可以嘗試載入此 URL`);
          break; // 找到有效的 URL 就停止
        }
      } else if (response.status === 404) {
        console.warn('   ❌ 文件不存在 (404 Not Found)');
      } else {
        console.warn(`   ⚠️ 異常狀態碼: ${response.status}`);
      }

    } catch (error) {
      console.error(`   ❌ 請求失敗:`, error.message);
    }
  }
}

// 執行測試
testStickerUrls().then(() => {
  console.log('\n');
  console.log('═══════════════════════════════════════');
  console.log('📊 診斷完成');
  console.log('═══════════════════════════════════════');
  console.log('');
  console.log('💡 預期結果:');
  console.log('   如果所有 URL 都返回 Content-Length: 0 或 404');
  console.log('   前端應該顯示 Fallback:');
  console.log('   🎭 [貼圖] 貼圖暫時無法顯示');
  console.log('');
  console.log('🔎 下一步檢查:');
  console.log('   1. 檢查頁面上是否顯示了 Fallback 圖示 🎭');
  console.log('   2. 如果沒有顯示,檢查 Console 是否有渲染錯誤');
  console.log('   3. 搜尋 Console 中的 "[StickerRenderer]" 相關日誌');
  console.log('   4. 搜尋 Console 中的 "[MessageBubble]" 相關日誌');
  console.log('');
});
