// 臨時調試腳本 - 監控 LINE Webhook 問題
// 使用方法：在 LINE 發送消息後運行此腳本

const DEBUG_USER_ID = "U892236cb4e4d92ba5bb50bb422c9fba7"; // PJ的用戶ID

console.log('🔍 開始調試 LINE Webhook 問題...');
console.log(`📍 目標用戶ID: ${DEBUG_USER_ID}`);
console.log('📋 請現在從 LINE OA 發送一條測試消息，然後觀察日誌輸出');

// 這個腳本需要配合 wrangler tail 使用
console.log('');
console.log('🚀 執行步驟：');
console.log('1. 在另一個終端運行: wrangler tail');
console.log('2. 在 LINE OA 發送消息'); 
console.log('3. 觀察是否有以下關鍵日誌：');
console.log('   ✅ [LINE Webhook] Signature verified successfully');
console.log('   ✅ User found/created: [ID]');
console.log('   🔄 Starting conversation creation...');
console.log('   💾 Starting message creation...');
console.log('');
console.log('🔍 關注錯誤訊息：');
console.log('   ❌ Failed to create conversation');
console.log('   ❌ Failed to retrieve created conversation'); 
console.log('   ❌ Error processing LINE message');