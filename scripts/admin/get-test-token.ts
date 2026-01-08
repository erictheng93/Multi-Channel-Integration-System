/**
 * ?²å?æ¸¬è©¦ JWT Token ?„è??©è…³??
 * ä½¿ç”¨?‹ç™¼?°å???debug ç«¯é??Ÿæ?æ¸¬è©¦ token
 */

const LOCAL_URL = 'http://localhost:8787';
const REMOTE_URL = 'https://your-api-domain.example.com';

async function getTestToken(environment: 'local' | 'remote' = 'local') {
  const baseUrl = environment === 'local' ? LOCAL_URL : REMOTE_URL;

  console.log(`\n?? ?—è©¦?²å? ${environment.toUpperCase()} ?°å??„æ¸¬è©?token...\n`);

  // ?¹æ? 1: ?—è©¦ä½¿ç”¨ debug ç«¯é?ï¼ˆé?è¦å??‰ä???admin tokenï¼?
  console.log('?¹æ? 1: æª¢æŸ¥?¯å¦??debug token ç«¯é?...');

  // ?¹æ? 2: ?—è©¦ä½¿ç”¨é»˜è?ç®¡ç??¡å¸³?Ÿç™»??
  console.log('?¹æ? 2: ?—è©¦ä½¿ç”¨ç®¡ç??¡å¸³?Ÿç™»??..');

  const possibleCredentials = [
    { email: 'admin@example.com', password: 'admin123' },
    { email: 'admin@test.com', password: 'admin123' },
    { email: 'testadmin@example.com', password: 'password123' },
  ];

  for (const cred of possibleCredentials) {
    try {
      console.log(`  ?—è©¦: ${cred.email}...`);

      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cred)
      });

      const data = await response.json();

      if (response.ok && data.token) {
        console.log(`\n???å??²å? tokenï¼\n`);
        console.log('?â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â?');
        console.log('?« JWT Token:');
        console.log('?â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â?');
        console.log(data.token);
        console.log('?â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â?\n');

        console.log('?? ä½¿ç”¨?¹æ?:');
        console.log('  1. è¨­ç½®?°å?è®Šæ•¸:');
        console.log(`     export TEST_JWT_TOKEN="${data.token}"\n`);
        console.log('  2. ??PowerShell ä¸?');
        console.log(`     $env:TEST_JWT_TOKEN="${data.token}"\n`);
        console.log('  3. ?¨æ¸¬è©¦ä¸­ä½¿ç”¨:');
        console.log(`     curl -H "Authorization: Bearer ${data.token.substring(0, 50)}..." <URL>\n`);

        if (data.user) {
          console.log('?‘¤ ?¨æˆ¶è³‡è?:');
          console.log(`   ?¨æˆ¶ID: ${data.user.id}`);
          console.log(`   Email: ${data.user.email}`);
          console.log(`   è§’è‰²: ${data.user.role}`);
          console.log(`   ?˜é?ID: ${data.user.teamId}\n`);
        }

        return data.token;
      } else {
        console.log(`  ??å¤±æ?: ${data.error || data.message || '?ªçŸ¥?¯èª¤'}`);
      }
    } catch (error) {
      console.log(`  ? ï?  ?¯èª¤: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log('\n???¡æ??²å? tokenï¼Œè?ä½¿ç”¨ä»¥ä??¿ä»£?¹æ?:\n');
  console.log('?¹æ? A: ?µå»ºæ¸¬è©¦?¨æˆ¶');
  console.log('  npx tsx create-test-user.ts\n');

  console.log('?¹æ? B: ?¥è©¢?¾æ??¨æˆ¶');
  console.log('  npx wrangler d1 execute multi-channel-platform --local --command "SELECT id, email, role FROM agents LIMIT 5"\n');

  console.log('?¹æ? C: ?´æ¥å¾æ•¸?šåº«?²å??¨æˆ¶ä¿¡æ¯å¾Œæ??•ç™»??);

  return null;
}

// ?·è?
(async () => {
  try {
    // ?ˆå?è©¦æœ¬?°ç’°å¢?
    let token = await getTestToken('local');

    if (!token) {
      console.log('\n?â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â?\n');
      console.log('?—è©¦? ç??°å?...\n');
      token = await getTestToken('remote');
    }

    if (token) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error('?·è??¯èª¤:', error);
    process.exit(1);
  }
})();