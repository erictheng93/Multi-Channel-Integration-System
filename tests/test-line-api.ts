// æ¸¬è©¦ LINE API ??¥

interface HealthResponse {
  status: string;
}

async function testLineAPI(): Promise<void> {
  console.log('?? æ¸¬è©¦ LINE API ??¥');
  console.log('====================\n');

  try {
    // å¾ç??¢ç’°å¢ƒç²??token (?é??¥åº·æª¢æŸ¥ç¢ºè??å?æ­?¸¸)
    const healthResponse = await fetch('https://your-api-domain.example.com/health');
    const healthData: HealthResponse = await healthResponse.json();
    
    if (healthData.status !== 'healthy') {
      console.log('???å?ä¸å¥åº·ï??¡æ?æ¸¬è©¦');
      return;
    }

    console.log('???å??¥åº·?€?‹æ­£å¸?);
    console.log('?? è«‹æ??•æ¸¬è©?LINE API:');
    console.log('1. ç¢ºè?ä½ å·²?´æ–°äº†æ­£ç¢ºç? Channel Access Token');
    console.log('2. ?¨æ?æ©Ÿä??¼é€ä?æ¢æ–°è¨Šæ¯çµ?LINE Bot');
    console.log('3. æª¢æŸ¥?¯å¦?¶åˆ°?è?');
    
    console.log('\n?? å¦‚æ?ä»ç„¶æ²’æ??è?ï¼Œè?æª¢æŸ¥:');
    console.log('- LINE Developers Console ä¸­ç? Channel Access Token ?¯å¦æ­?¢º');
    console.log('- Token ?¯å¦å·²é???);
    console.log('- Messaging API ?¯å¦å·²å???);
    
  } catch (error: any) {
    console.error('??æ¸¬è©¦å¤±æ?:', error.message);
  }
}

testLineAPI();