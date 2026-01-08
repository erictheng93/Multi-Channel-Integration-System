/**
 * ?¥è©¢å®¢æˆ¶è³‡æ??„æ¸¬è©¦è…³?? * ä½¿ç”¨?™å€‹è…³?¬ä?æ¸¬è©¦å®¢æˆ¶è³‡æ??¥è©¢?Ÿèƒ½
 */

const WORKER_URL: string = 'https://your-api-domain.example.com'; // å¯¦é? Worker URL

interface Customer {
  id: string;
  platform: string;
  platform_user_id: string;
  display_name?: string;
  avatar_url?: string;
  metadata?: string;
  created_at: string;
}

interface AllCustomersResponse {
  success: boolean;
  data: {
    count: number;
    customers: Customer[];
  };
  error?: string;
}

interface SpecificCustomerResponse {
  success: boolean;
  data: {
    customer: Customer;
    conversationCount: number;
  };
  error?: string;
}

interface StatsResponse {
  success: boolean;
  data: {
    totalCustomers: number;
    totalConversations: number;
    totalMessages: number;
    recentMessages: any[];
  };
  error?: string;
}

async function testCustomerQueries(): Promise<void> {
  console.log('?? ?‹å?æ¸¬è©¦å®¢æˆ¶è³‡æ??¥è©¢?Ÿèƒ½...\n');

  try {
    // 1. ?¥è©¢?€?‰å®¢??    console.log('?? ?¥è©¢?€?‰å®¢??..');
    const allCustomersResponse = await fetch(`${WORKER_URL}/api/customers`);
    const allCustomersData: AllCustomersResponse = await allCustomersResponse.json();
    
    if (allCustomersData.success) {
      console.log(`???¾åˆ° ${allCustomersData.data.count} ä½å®¢?¶`);
      allCustomersData.data.customers.forEach((customer: Customer, index: number) => {
        console.log(`  ${index + 1}. ${customer.display_name || '?ªçŸ¥'} (${customer.platform}:${customer.platform_user_id})`);
      });
    } else {
      console.log('???¥è©¢å¤±æ?:', allCustomersData.error);
    }

    console.log('\n');

    // 2. ?¥è©¢?¹å?å¹³å°?„å®¢?¶ï?å¦‚æ??‰ç?è©±ï?
    if (allCustomersData.success && allCustomersData.data.customers.length > 0) {
      const firstCustomer = allCustomersData.data.customers[0];
      console.log(`?¯ ?¥è©¢?¹å?å®¢æˆ¶: ${firstCustomer.platform}:${firstCustomer.platform_user_id}`);
      
      const specificCustomerResponse = await fetch(
        `${WORKER_URL}/api/customers/platform/${firstCustomer.platform}/${firstCustomer.platform_user_id}`
      );
      const specificCustomerData: SpecificCustomerResponse = await specificCustomerResponse.json();
      
      if (specificCustomerData.success) {
        console.log('??å®¢æˆ¶è©³ç´°è³‡è?:');
        console.log(`  ID: ${specificCustomerData.data.customer.id}`);
        console.log(`  å§“å?: ${specificCustomerData.data.customer.display_name || '?ªçŸ¥'}`);
        console.log(`  å¹³å°: ${specificCustomerData.data.customer.platform}`);
        console.log(`  å¹³å°?¨æˆ¶ID: ${specificCustomerData.data.customer.platform_user_id}`);
        console.log(`  ?­å?: ${specificCustomerData.data.customer.avatar_url || '??}`);
        console.log(`  å°è©±?? ${specificCustomerData.data.conversationCount}`);
        console.log(`  å»ºç??‚é?: ${specificCustomerData.data.customer.created_at}`);
        
        if (specificCustomerData.data.customer.metadata) {
          console.log('  é¡å?è³‡è?:');
          try {
            const metadata = JSON.parse(specificCustomerData.data.customer.metadata);
            Object.entries(metadata).forEach(([key, value]) => {
              console.log(`    ${key}: ${value}`);
            });
          } catch (e) {
            console.log('    ?¡æ?è§??é¡å?è³‡è?');
          }
        }
      } else {
        console.log('???¥è©¢?¹å?å®¢æˆ¶å¤±æ?:', specificCustomerData.error);
      }
    }

    console.log('\n');

    // 3. ?¥è©¢ç³»çµ±çµ±è?
    console.log('?? ?¥è©¢ç³»çµ±çµ±è?...');
    const statsResponse = await fetch(`${WORKER_URL}/api/stats`);
    const statsData: StatsResponse = await statsResponse.json();
    
    if (statsData.success) {
      console.log('??ç³»çµ±çµ±è?:');
      console.log(`  ç¸½å®¢?¶æ•¸: ${statsData.data.totalCustomers}`);
      console.log(`  ç¸½å?è©±æ•¸: ${statsData.data.totalConversations}`);
      console.log(`  ç¸½è??¯æ•¸: ${statsData.data.totalMessages}`);
      console.log(`  ?€è¿‘è??¯æ•¸: ${statsData.data.recentMessages.length}`);
    } else {
      console.log('???¥è©¢çµ±è?å¤±æ?:', statsData.error);
    }

  } catch (error: any) {
    console.error('??æ¸¬è©¦?ç?ä¸­ç™¼?ŸéŒ¯èª?', error.message);
    console.log('\n?’¡ è«‹ç¢ºèª?');
    console.log('1. Worker URL ?¯å¦æ­?¢º');
    console.log('2. Worker ?¯å¦æ­?œ¨?‹è?');
    console.log('3. è³‡æ?åº«æ˜¯?¦å·²?å???);
  }

  console.log('\n?? æ¸¬è©¦å®Œæ?ï¼?);
}

// å¦‚æ??´æ¥?·è??™å€‹è…³??if (typeof window === 'undefined') {
  // Node.js ?°å?
  console.log('? ï?  è«‹å??´æ–° WORKER_URL è®Šæ•¸?ºä??„å¯¦??Worker ç¶²å?');
  console.log('?¶å??·è?: node query-customers.ts\n');
  
  if (WORKER_URL !== 'https://your-worker-domain.workers.dev') {
    testCustomerQueries();
  }
} else {
  // ?è¦½?¨ç’°å¢?  console.log('?? ?¨ç€è¦½?¨ä¸­?·è?ï¼Œè??‹å?èª¿ç”¨ testCustomerQueries() ?½æ•¸');
}

// ?¯å‡º?½æ•¸ä¾›å…¶ä»–åœ°?¹ä½¿??export { testCustomerQueries };