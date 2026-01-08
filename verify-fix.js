/**
 * API ç«¯é?é©—è??³æœ¬
 * ?¨ç€è¦½??Console ä¸­é?è¡Œæ­¤?³æœ¬ä»¥é?è­‰ä¿®å¾?
 *
 * ä½¿ç”¨?¹æ?ï¼?
 * 1. ?¨ç€è¦½?¨ä¸­?“é? http://localhost:3000/team
 * 2. ??F12 ?“é??‹ç™¼?…å·¥??
 * 3. ?‡æ???Console æ¨™ç±¤
 * 4. è¤‡è£½ä¸¦è²¼ä¸Šæ­¤?³æœ¬ï¼Œæ? Enter ?·è?
 */

(async function verifyAPIFix() {
  console.log('?? ?‹å?é©—è? API ä¿®å¾©...\n');

  const results = {
    passed: [],
    failed: [],
    warnings: []
  };

  // å¾?localStorage ?²å? token
  const token = localStorage.getItem('token');

  if (!token) {
    console.error('???¾ä??°è?è­?tokenï¼è??ˆç™»?¥ã€?);
    return;
  }

  console.log('???¾åˆ°èªè? token\n');

  // æ¸¬è©¦ 1: ?¥åº·æª¢æŸ¥ç«¯é?
  console.log('?? æ¸¬è©¦ 1: Teams æ¨¡ç??¥åº·æª¢æŸ¥');
  try {
    const healthResponse = await fetch('https://your-api-domain.example.com/api/teams/health');
    const healthData = await healthResponse.json();

    if (healthResponse.ok && healthData.status === 'healthy') {
      console.log('???¥åº·æª¢æŸ¥?šé?:', healthData);
      results.passed.push('Health check');
    } else {
      console.error('???¥åº·æª¢æŸ¥å¤±æ?:', healthData);
      results.failed.push('Health check');
    }
  } catch (error) {
    console.error('???¥åº·æª¢æŸ¥?¯èª¤:', error);
    results.failed.push('Health check');
  }

  console.log('\n?? æ¸¬è©¦ 2: Teams æ¨¡ç?è³‡è?');
  try {
    const infoResponse = await fetch('https://your-api-domain.example.com/api/teams/info');
    const infoData = await infoResponse.json();

    if (infoResponse.ok && infoData.success) {
      console.log('??æ¨¡ç?è³‡è?:', infoData.data);

      // æª¢æŸ¥?¯å¦?…å«?°ç? /members ç«¯é?
      const hasNewEndpoint = infoData.data.endpoints.some(ep => ep.includes('GET /members'));
      if (hasNewEndpoint) {
        console.log('???°ç«¯é»?GET /members å·²è¨»??);
        results.passed.push('New endpoint registered');
      } else {
        console.warn('? ï?  ?°ç«¯é»æœª?¨æ?æª”ä¸­?—å‡º');
        results.warnings.push('New endpoint not in docs');
      }
    } else {
      console.error('??æ¨¡ç?è³‡è?å¤±æ?:', infoData);
      results.failed.push('Module info');
    }
  } catch (error) {
    console.error('??æ¨¡ç?è³‡è??¯èª¤:', error);
    results.failed.push('Module info');
  }

  console.log('\n?? æ¸¬è©¦ 3: GET /api/teams/members (?œéµæ¸¬è©¦)');
  try {
    const membersResponse = await fetch('https://your-api-domain.example.com/api/teams/members', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('   HTTP ?€?‹ç¢¼:', membersResponse.status, membersResponse.statusText);

    if (membersResponse.status === 200) {
      const membersData = await membersResponse.json();
      console.log('??API è«‹æ??å?ï¼?);
      console.log('   ?æ??¸æ?:', membersData);

      if (membersData.success && Array.isArray(membersData.data)) {
        console.log(`???å??²å? ${membersData.data.length} ä½æ??¡`);
        results.passed.push('GET /api/teams/members');

        // æª¢æŸ¥?¸æ??¼å?
        if (membersData.data.length > 0) {
          const firstMember = membersData.data[0];
          const requiredFields = ['id', 'name', 'email', 'role', 'status'];
          const missingFields = requiredFields.filter(field => !(field in firstMember));

          if (missingFields.length === 0) {
            console.log('???å“¡?¸æ??¼å?æ­?¢º');
            results.passed.push('Data format validation');
          } else {
            console.warn('? ï?  ?å“¡?¸æ?ç¼ºå?å­—æ®µ:', missingFields);
            results.warnings.push(`Missing fields: ${missingFields.join(', ')}`);
          }

          console.log('   ç¬¬ä?ä½æ??¡ç?ä¾?', firstMember);
        }
      } else {
        console.warn('? ï?  ?æ??¼å??°å¸¸:', membersData);
        results.warnings.push('Unexpected response format');
      }
    } else if (membersResponse.status === 400) {
      console.error('??400 Bad Request - ç«¯é?ä»ç„¶?‰å?é¡Œï?');
      const errorData = await membersResponse.json().catch(() => ({}));
      console.error('   ?¯èª¤è©³æ?:', errorData);
      results.failed.push('GET /api/teams/members - Still 400');
    } else if (membersResponse.status === 403) {
      console.error('??403 Forbidden - æ¬Šé?ä¸è¶³');
      console.log('   ?¨ç??¶å?è§’è‰²?¯èƒ½æ²’æ?æ¬Šé??¥ç??å“¡?—è¡¨');
      results.failed.push('GET /api/teams/members - Permission denied');
    } else if (membersResponse.status === 401) {
      console.error('??401 Unauthorized - Token ?¡æ??–é???);
      results.failed.push('GET /api/teams/members - Auth failed');
    } else {
      console.error(`???ªé??Ÿç??€?‹ç¢¼: ${membersResponse.status}`);
      const errorData = await membersResponse.json().catch(() => ({}));
      console.error('   ?¯èª¤è©³æ?:', errorData);
      results.failed.push(`GET /api/teams/members - ${membersResponse.status}`);
    }
  } catch (error) {
    console.error('??API è«‹æ??¯èª¤:', error);
    results.failed.push('GET /api/teams/members - Network error');
  }

  // æ¸¬è©¦ 4: æª¢æŸ¥?ç«¯ Store ?€??
  console.log('\n?? æ¸¬è©¦ 4: ?ç«¯ Store ?€??);
  try {
    // ?—è©¦è¨ªå? Pinia store (å¦‚æ??¯ç”¨)
    if (window.__PINIA__) {
      console.log('??Pinia store ?¯ç”¨');
      const stores = window.__PINIA__.state.value;

      if (stores.team) {
        console.log('??Team store å·²è???);
        console.log('   ?å“¡?¸é?:', stores.team.members?.length || 0);
        console.log('   è¼‰å…¥?€??', stores.team.loading);
        console.log('   ?¯èª¤?€??', stores.team.error);
        results.passed.push('Frontend store check');
      } else {
        console.warn('? ï?  Team store ?ªæ‰¾??);
        results.warnings.push('Team store not found');
      }
    } else {
      console.warn('? ï?  Pinia ?ªå?å§‹å?');
      results.warnings.push('Pinia not initialized');
    }
  } catch (error) {
    console.warn('? ï?  ?¡æ?æª¢æŸ¥?ç«¯ store:', error);
    results.warnings.push('Cannot check frontend store');
  }

  // ç¸½ç??±å?
  console.log('\n' + '='.repeat(60));
  console.log('?? é©—è?ç¸½ç??±å?');
  console.log('='.repeat(60));

  console.log(`\n???šé?æ¸¬è©¦: ${results.passed.length}`);
  results.passed.forEach(test => console.log(`   ??${test}`));

  if (results.warnings.length > 0) {
    console.log(`\n? ï?  è­¦å?: ${results.warnings.length}`);
    results.warnings.forEach(warning => console.log(`   ??${warning}`));
  }

  if (results.failed.length > 0) {
    console.log(`\n??å¤±æ?æ¸¬è©¦: ${results.failed.length}`);
    results.failed.forEach(test => console.log(`   ??${test}`));
  }

  console.log('\n' + '='.repeat(60));

  if (results.failed.length === 0) {
    console.log('?? ?€?‰é??µæ¸¬è©¦é€šé?ï¼å?é¡Œå·²å®Œå…¨è§?±º??);
  } else {
    console.log('? ï?  ä»æ??é??€è¦ä¿®å¾©ã€‚è??¥ç?ä¸Šè¿°å¤±æ??„æ¸¬è©¦ã€?);
  }

  return {
    summary: {
      passed: results.passed.length,
      warnings: results.warnings.length,
      failed: results.failed.length,
      total: results.passed.length + results.warnings.length + results.failed.length
    },
    details: results
  };
})();
