// database/verify-schema.ts
// 驗證資料庫 schema 的腳本
// 專案名稱：Multi-Channel Support MVP

import { execSync } from 'child_process';

console.log('🔍 驗證資料庫 schema...');

try {
    // 檢查本地資料庫表格
    console.log('\n📋 檢查資料庫表格：');
    const tables = execSync('wrangler d1 execute omni-channel-platform --local --command="SELECT name FROM sqlite_master WHERE type=\'table\' ORDER BY name;"', { encoding: 'utf8' });
    console.log(tables);

    // 檢查 users 表格結構
    console.log('\n👤 Users 表格結構：');
    const usersSchema = execSync('wrangler d1 execute omni-channel-platform --local --command="PRAGMA table_info(users);"', { encoding: 'utf8' });
    console.log(usersSchema);

    // 檢查 conversations 表格結構
    console.log('\n💬 Conversations 表格結構：');
    const conversationsSchema = execSync('wrangler d1 execute omni-channel-platform --local --command="PRAGMA table_info(conversations);"', { encoding: 'utf8' });
    console.log(conversationsSchema);

    // 檢查 messages 表格結構
    console.log('\n📨 Messages 表格結構：');
    const messagesSchema = execSync('wrangler d1 execute omni-channel-platform --local --command="PRAGMA table_info(messages);"', { encoding: 'utf8' });
    console.log(messagesSchema);

    // 檢查 agents 表格結構
    console.log('\n🧑‍💼 Agents 表格結構：');
    const agentsSchema = execSync('wrangler d1 execute omni-channel-platform --local --command="PRAGMA table_info(agents);"', { encoding: 'utf8' });
    console.log(agentsSchema);

    // 檢查索引
    console.log('\n📊 資料庫索引：');
    const indexes = execSync('wrangler d1 execute omni-channel-platform --local --command="SELECT name FROM sqlite_master WHERE type=\'index\' AND name NOT LIKE \'sqlite_%\' ORDER BY name;"', { encoding: 'utf8' });
    console.log(indexes);

    // 檢查測試資料
    console.log('\n🧪 測試資料：');
    const testData = execSync('wrangler d1 execute omni-channel-platform --local --command="SELECT id, email, name, role FROM agents;"', { encoding: 'utf8' });
    console.log(testData);

    console.log('\n✅ 資料庫 schema 驗證完成！');

} catch (error: any) {
    console.error('❌ 驗證過程中發生錯誤：', error.message);
    process.exit(1);
}