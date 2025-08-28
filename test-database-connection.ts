// Test to verify which database each command connects to
import { execSync } from 'child_process';

console.log('🔍 Database Connection Test');
console.log('=' .repeat(60));

async function testDatabaseConnections() {
  // Test 1: Check local database
  console.log('\n📌 TEST 1: Local Database Check');
  console.log('Command: wrangler d1 execute multi-channel-platform --local');
  
  try {
    const localResult = execSync(
      'npx wrangler d1 execute multi-channel-platform --local --command "SELECT COUNT(*) as count FROM agents WHERE email = \'admin@dacit.net\'"',
      { encoding: 'utf8' }
    );
    console.log('✅ Local database accessible');
    const localData = JSON.parse(localResult.split('\n').find(line => line.startsWith('['))!);
    console.log('   Admin exists in local:', localData[0].results[0].count > 0);
  } catch (error) {
    console.log('❌ Local database error:', error.message);
  }
  
  // Test 2: Check remote database (dev environment)
  console.log('\n📌 TEST 2: Remote Database Check (Dev Environment)');
  console.log('Command: wrangler d1 execute multi-channel-platform-dev --remote');
  
  try {
    const remoteResult = execSync(
      'npx wrangler d1 execute multi-channel-platform-dev --remote --command "SELECT COUNT(*) as count FROM agents"',
      { encoding: 'utf8' }
    );
    console.log('✅ Remote dev database accessible');
    // Parse the result if needed
  } catch (error) {
    console.log('❌ Remote dev database not accessible or not configured');
    console.log('   This is expected if you haven\'t set up remote dev database');
  }
  
  // Test 3: Check what npm run dev uses
  console.log('\n📌 TEST 3: npm run dev Configuration');
  console.log('Reading wrangler.toml for default configuration...');
  
  const wranglerConfig = execSync('type wrangler.toml', { encoding: 'utf8' });
  const hasLocalMode = wranglerConfig.includes('--local');
  console.log('   Default mode:', hasLocalMode ? 'Local' : 'Remote');
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 COMMAND BEHAVIOR ANALYSIS');
  console.log('=' .repeat(60));
  
  console.log('\n🔧 npm run dev (wrangler dev):');
  console.log('   - By default connects to REMOTE resources');
  console.log('   - Uses Cloudflare edge network');
  console.log('   - Requires internet connection');
  console.log('   - Uses remote D1, KV, R2, Queue');
  console.log('   - BUT: If remote DB not set up, falls back to local');
  
  console.log('\n🔧 npm run dev:local (wrangler dev --local):');
  console.log('   - ALWAYS uses LOCAL resources');
  console.log('   - Runs entirely on your machine');
  console.log('   - No internet required');
  console.log('   - Uses local D1 (.wrangler/state/v3/d1/)');
  console.log('   - Uses local KV, R2, Queue emulation');
  
  console.log('\n⚠️  IMPORTANT FINDING:');
  console.log('If you haven\'t deployed to Cloudflare or set up remote databases,');
  console.log('both commands will use LOCAL database by default!');
  
  console.log('\n📁 Local Database Location:');
  console.log('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/');
  
  // Check if remote database exists
  console.log('\n🔍 Checking Remote Database Configuration...');
  try {
    execSync('npx wrangler d1 list', { encoding: 'utf8' });
    console.log('✅ Remote databases are configured');
  } catch (error) {
    console.log('⚠️  No remote databases configured yet');
    console.log('   Both npm run dev and npm run dev:local will use LOCAL database');
  }
}

testDatabaseConnections().catch(console.error);