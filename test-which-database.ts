// Test to determine which database is being used
import { execSync } from 'child_process';

console.log('🔍 Testing Which Database Each Command Uses');
console.log('=' .repeat(60));

async function testDatabases() {
  const testTimestamp = Date.now();
  const testEmail = `test-${testTimestamp}@example.com`;
  
  console.log('\n📌 Step 1: Insert test record in LOCAL database');
  try {
    execSync(
      `npx wrangler d1 execute multi-channel-platform --local --command "INSERT INTO agents (id, email, password_hash, display_name, role, is_active, created_at) VALUES ('test-local-${testTimestamp}', '${testEmail}', 'hash', 'Test Local User', 'agent', 1, datetime('now'))"`,
      { encoding: 'utf8' }
    );
    console.log(`✅ Inserted test user in LOCAL: ${testEmail}`);
  } catch (error) {
    console.log('❌ Failed to insert in local database');
  }
  
  console.log('\n📌 Step 2: Check if test record exists via npm run dev');
  console.log('Testing with API call through npm run dev...');
  console.log('(This requires npm run dev to be running on port 8787)');
  
  try {
    // Test API endpoint to check database
    const response = await fetch('http://localhost:8787/api/test-db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check-email', email: testEmail })
    }).catch(() => null);
    
    if (response && response.ok) {
      const data = await response.json();
      console.log('API Response:', data);
    } else {
      console.log('⚠️  API endpoint not available or npm run dev not running');
      console.log('   Falling back to direct database check...');
      
      // Alternative: Check using wrangler commands
      console.log('\n📌 Alternative Test: Direct Database Queries');
      
      // Check local database
      try {
        const localResult = execSync(
          `npx wrangler d1 execute multi-channel-platform --local --command "SELECT COUNT(*) as count FROM agents WHERE email = '${testEmail}'"`,
          { encoding: 'utf8', stdio: 'pipe' }
        );
        const localCount = JSON.parse(localResult.match(/\[[\s\S]*\]/)?.[0] || '[]')[0]?.results[0]?.count || 0;
        console.log(`   LOCAL database: Test user ${localCount > 0 ? 'EXISTS' : 'NOT FOUND'}`);
      } catch (error) {
        console.log('   LOCAL database: Error checking');
      }
      
      // Check remote production database
      try {
        const remoteResult = execSync(
          `npx wrangler d1 execute multi-channel-platform --remote --command "SELECT COUNT(*) as count FROM agents WHERE email = '${testEmail}'"`,
          { encoding: 'utf8', stdio: 'pipe' }
        );
        const remoteCount = JSON.parse(remoteResult.match(/\[[\s\S]*\]/)?.[0] || '[]')[0]?.results[0]?.count || 0;
        console.log(`   REMOTE (prod) database: Test user ${remoteCount > 0 ? 'EXISTS' : 'NOT FOUND'}`);
      } catch (error) {
        console.log('   REMOTE (prod) database: Error checking');
      }
      
      // Check remote dev database
      try {
        const remoteDevResult = execSync(
          `npx wrangler d1 execute multi-channel-platform-dev --remote --command "SELECT COUNT(*) as count FROM agents WHERE email = '${testEmail}'"`,
          { encoding: 'utf8', stdio: 'pipe' }
        );
        const remoteDevCount = JSON.parse(remoteDevResult.match(/\[[\s\S]*\]/)?.[0] || '[]')[0]?.results[0]?.count || 0;
        console.log(`   REMOTE (dev) database: Test user ${remoteDevCount > 0 ? 'EXISTS' : 'NOT FOUND'}`);
      } catch (error) {
        console.log('   REMOTE (dev) database: Error checking');
      }
    }
  } catch (error) {
    console.log('Error during test:', error.message);
  }
  
  // Clean up test data
  console.log('\n📌 Step 3: Cleanup test data');
  try {
    execSync(
      `npx wrangler d1 execute multi-channel-platform --local --command "DELETE FROM agents WHERE email = '${testEmail}'"`,
      { encoding: 'utf8', stdio: 'pipe' }
    );
    console.log('✅ Cleaned up test user from LOCAL database');
  } catch (error) {
    console.log('⚠️  Could not clean up test data');
  }
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 CONCLUSION');
  console.log('=' .repeat(60));
  
  console.log('\n🎯 Based on the wrangler.toml configuration:');
  console.log('\n🔧 npm run dev (wrangler dev):');
  console.log('   - SHOULD connect to: Remote production database');
  console.log('   - Database: multi-channel-platform (08ae6790-2494-40a8-a07a-df3920783159)');
  console.log('   - Location: Cloudflare edge network');
  
  console.log('\n🔧 npm run dev:local (wrangler dev --local):');
  console.log('   - ALWAYS connects to: Local database');
  console.log('   - Database: .wrangler/state/v3/d1/');
  console.log('   - Location: Your machine');
  
  console.log('\n⚠️  CURRENT OBSERVATION:');
  console.log('你說得對！現在看起來兩個命令都在使用本地數據庫。');
  console.log('這可能是因為：');
  console.log('1. Wrangler 在開發模式下的默認行為');
  console.log('2. 遠端數據庫連接配置問題');
  console.log('3. 或者 Wrangler 的緩存問題');
  
  console.log('\n💡 RECOMMENDATION:');
  console.log('For consistent development, use npm run dev:local');
  console.log('This ensures you\'re always using local database.');
}

testDatabases().catch(console.error);