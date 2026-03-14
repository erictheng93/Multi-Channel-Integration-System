/**
 * ?��?測試 JWT Token ?��??�腳??
 * 使用?�發?��???debug 端�??��?測試 token
 */

const LOCAL_URL = 'http://localhost:8787';
const REMOTE_URL = 'https://your-api-domain.example.com';

async function getTestToken(environment: 'local' | 'remote' = 'local') {
  const baseUrl = environment === 'local' ? LOCAL_URL : REMOTE_URL;

  console.log(`\n?? ?�試?��? ${environment.toUpperCase()} ?��??�測�?token...\n`);

  // ?��? 1: ?�試使用 debug 端�?（�?要�??��???admin token�?
  console.log('?��? 1: 檢查?�否??debug token 端�?...');

  // ?��? 2: ?�試使用默�?管�??�帳?�登??
  console.log('?��? 2: ?�試使用管�??�帳?�登??..');

  const possibleCredentials = [
    { email: 'admin@example.com', password: 'admin123' },
    { email: 'admin@test.com', password: 'admin123' },
    { email: 'testadmin@example.com', password: 'password123' },
  ];

  for (const cred of possibleCredentials) {
    try {
      console.log(`  ?�試: ${cred.email}...`);

      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cred)
      });

      const data = await response.json();

      if (response.ok && data.token) {
        console.log(`\n???��??��? token！\n`);
        console.log('?��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��?');
        console.log('?�� JWT Token:');
        console.log('?��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��?');
        console.log(data.token);
        console.log('?��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��?\n');

        console.log('?? 使用?��?:');
        console.log('  1. 設置?��?變數:');
        console.log(` export TEST_JWT_TOKEN="${data.token}"\n`);
        console.log('  2. ??PowerShell �?');
        console.log(` $env:TEST_JWT_TOKEN="${data.token}"\n`);
        console.log('  3. ?�測試中使用:');
        console.log(` curl -H "Authorization: Bearer ${data.token.substring(0, 50)}..." <URL>\n`);

        if (data.user) {
          console.log('?�� ?�戶資�?:');
          console.log(` ?�戶ID: ${data.user.id}`);
          console.log(` Email: ${data.user.email}`);
          console.log(` 角色: ${data.user.role}`);
          console.log(` ?��?ID: ${data.user.teamId}\n`);
        }

        return data.token;
      } else {
        console.log(`  ??失�?: ${data.error || data.message || '?�知?�誤'}`);
      }
    } catch (error) {
      console.log(`  ?��?  ?�誤: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log('\n???��??��? token，�?使用以�??�代?��?:\n');
  console.log('?��? A: ?�建測試?�戶');
  console.log('  npx tsx create-test-user.ts\n');

  console.log('?��? B: ?�詢?��??�戶');
  console.log('  npx wrangler d1 execute mcis-db --local --command "SELECT id, email, role FROM agents LIMIT 5"\n');

  console.log('?��? C: ?�接從數?�庫?��??�戶信息後�??�登??);

  return null;
}

// ?��?
(async () => {
  try {
    // ?��?試本?�環�?
    let token = await getTestToken('local');

    if (!token) {
      console.log('\n?��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��??��?\n');
      console.log('?�試?��??��?...\n');
      token = await getTestToken('remote');
    }

    if (token) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error('?��??�誤:', error);
    process.exit(1);
  }
})();