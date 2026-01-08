/**
 * LINE ID ?¶é?é©—è?å·¥å…·
 * å°ˆé??¨ä?é©—è?å®¢æˆ¶??LINE ID ?¯å¦æ­?¢ºè¢«æ”¶?†å??²å?
 */

const WORKER_URL: string = 'https://your-api-domain.example.com'; // å¯¦é? Worker URL

interface HealthResponse {
  status: string;
  database: string;
}

interface Customer {
  id: string;
  platform: string;
  platform_user_id: string;
  display_name?: string;
  avatar_url?: string;
  metadata?: string;
  created_at: string;
  updated_at: string;
}

interface CustomersResponse {
  success: boolean;
  data: {
    customers: Customer[];
  };
}

interface CustomerDetailResponse {
  success: boolean;
  data: {
    customer: Customer;
    conversationCount: number;
  };
  error?: string;
}

interface WebhookEvent {
  type: string;
  message: {
    id: string;
    type: string;
    text: string;
  };
  source: {
    userId: string;
  };
  replyToken: string;
  timestamp: number;
}

interface WebhookPayload {
  events: WebhookEvent[];
}

interface WebhookResponse {
  message: string;
  error?: string;
}

class LineIdCollectionVerifier {
  private workerUrl: string;

  constructor(workerUrl: string) {
    this.workerUrl = workerUrl;
  }

  /**
   * é©—è? LINE ID ?¶é?æµç?
   */
  async verifyLineIdCollection(): Promise<boolean> {
    console.log('?? LINE ID ?¶é?æµç?é©—è?\n');
    
    // æ­¥é? 1: æª¢æŸ¥ API ??¥
    console.log('1ï¸âƒ£ æª¢æŸ¥ API ??¥...');
    try {
      const healthResponse = await fetch(`${this.workerUrl}/health`);
      const healthData: HealthResponse = await healthResponse.json();
      
      if (healthData.status === 'healthy') {
        console.log('??API ??¥æ­?¸¸');
        console.log(`   è³‡æ?åº«ç??? ${healthData.database}`);
      } else {
        console.log('??API ??¥?°å¸¸');
        return false;
      }
    } catch (error: any) {
      console.log(`??API ??¥å¤±æ?: ${error.message}`);
      return false;
    }

    console.log('');

    // æ­¥é? 2: æª¢æŸ¥?¾æ?å®¢æˆ¶è³‡æ?
    console.log('2ï¸âƒ£ æª¢æŸ¥?¾æ?å®¢æˆ¶è³‡æ?...');
    try {
      const customersResponse = await fetch(`${this.workerUrl}/api/customers`);
      const customersData: CustomersResponse = await customersResponse.json();
      
      if (customersData.success) {
        const customers = customersData.data.customers;
        console.log(`???¾åˆ° ${customers.length} ä½å®¢?¶`);
        
        if (customers.length > 0) {
          console.log('   ?€è¿‘ç?å®¢æˆ¶:');
          customers.slice(0, 5).forEach((customer: Customer, index: number) => {
            console.log(`   ${index + 1}. LINE ID: ${customer.platform_user_id}`);
            console.log(`      å§“å?: ${customer.display_name || '?ªçŸ¥'}`);
            console.log(`      å»ºç??‚é?: ${customer.created_at}`);
            console.log('');
          });
        } else {
          console.log('   ?®å?æ²’æ?å®¢æˆ¶è³‡æ?');
        }
      } else {
        console.log('???¡æ??²å?å®¢æˆ¶è³‡æ?');
        return false;
      }
    } catch (error: any) {
      console.log(`???²å?å®¢æˆ¶è³‡æ?å¤±æ?: ${error.message}`);
      return false;
    }

    // æ­¥é? 3: é©—è? LINE ID ?¼å?
    console.log('3ï¸âƒ£ é©—è? LINE ID ?¼å?...');
    try {
      const customersResponse = await fetch(`${this.workerUrl}/api/customers`);
      const customersData: CustomersResponse = await customersResponse.json();
      
      if (customersData.success) {
        const customers = customersData.data.customers;
        const lineCustomers = customers.filter(c => c.platform === 'line');
        
        console.log(`???¾åˆ° ${lineCustomers.length} ä½?LINE å®¢æˆ¶`);
        
        let validCount = 0;
        let invalidCount = 0;
        
        lineCustomers.forEach(customer => {
          const lineId = customer.platform_user_id;
          
          // LINE User ID ?¼å?é©—è?
          // LINE User ID ?šå¸¸ä»?'U' ?‹é ­ï¼Œå??¢è???32 ?‹å?ç¬?          const isValidFormat = /^U[a-f0-9]{32}$/i.test(lineId);
          
          if (isValidFormat) {
            validCount++;
          } else {
            invalidCount++;
            console.log(`   ? ï?  ?¯èƒ½?¡æ???LINE ID: ${lineId}`);
          }
        });
        
        console.log(`   ???‰æ??¼å?: ${validCount} ?‹`);
        console.log(`   ? ï?  ?¯èƒ½?¡æ?: ${invalidCount} ?‹`);
      }
    } catch (error: any) {
      console.log(`??é©—è? LINE ID ?¼å?å¤±æ?: ${error.message}`);
    }

    console.log('');

    // æ­¥é? 4: æª¢æŸ¥è³‡æ?å®Œæ•´??    console.log('4ï¸âƒ£ æª¢æŸ¥è³‡æ?å®Œæ•´??..');
    try {
      const customersResponse = await fetch(`${this.workerUrl}/api/customers`);
      const customersData: CustomersResponse = await customersResponse.json();
      
      if (customersData.success) {
        const customers = customersData.data.customers;
        const lineCustomers = customers.filter(c => c.platform === 'line');
        
        let hasDisplayName = 0;
        let hasAvatar = 0;
        let hasMetadata = 0;
        
        lineCustomers.forEach(customer => {
          if (customer.display_name) hasDisplayName++;
          if (customer.avatar_url) hasAvatar++;
          if (customer.metadata) hasMetadata++;
        });
        
        const total = lineCustomers.length;
        
        if (total > 0) {
          console.log(`   LINE ID ?¶é??? 100% (${total}/${total})`);
          console.log(`   é¡¯ç¤º?ç¨±?¶é??? ${((hasDisplayName/total)*100).toFixed(1)}% (${hasDisplayName}/${total})`);
          console.log(`   ?­å??¶é??? ${((hasAvatar/total)*100).toFixed(1)}% (${hasAvatar}/${total})`);
          console.log(`   é¡å?è³‡è??¶é??? ${((hasMetadata/total)*100).toFixed(1)}% (${hasMetadata}/${total})`);
        } else {
          console.log('   æ²’æ? LINE å®¢æˆ¶è³‡æ??¯å???);
        }
      }
    } catch (error: any) {
      console.log(`??æª¢æŸ¥è³‡æ?å®Œæ•´?§å¤±?? ${error.message}`);
    }

    console.log('');
    return true;
  }

  /**
   * æ¸¬è©¦?¹å? LINE ID ?„æŸ¥è©?   */
  async testLineIdQuery(lineId: string): Promise<Customer | null> {
    console.log(`?? æ¸¬è©¦ LINE ID ?¥è©¢: ${lineId}\n`);
    
    try {
      const response = await fetch(`${this.workerUrl}/api/customers/platform/line/${lineId}`);
      const data: CustomerDetailResponse = await response.json();
      
      if (data.success) {
        const customer = data.data.customer;
        console.log('???¾åˆ°å®¢æˆ¶è³‡æ?:');
        console.log(`   å®¢æˆ¶ID: ${customer.id}`);
        console.log(`   LINE ID: ${customer.platform_user_id}`);
        console.log(`   é¡¯ç¤º?ç¨±: ${customer.display_name || '?ªçŸ¥'}`);
        console.log(`   ?­å?: ${customer.avatar_url || '??}`);
        console.log(`   å»ºç??‚é?: ${customer.created_at}`);
        console.log(`   ?´æ–°?‚é?: ${customer.updated_at}`);
        
        if (customer.metadata) {
          try {
            const metadata = JSON.parse(customer.metadata);
            console.log('   é¡å?è³‡è?:');
            Object.entries(metadata).forEach(([key, value]) => {
              console.log(`     ${key}: ${value}`);
            });
          } catch (e) {
            console.log('   é¡å?è³‡è?: ?¡æ?è§??');
          }
        }
        
        console.log(`   å°è©±?¸é?: ${data.data.conversationCount}`);
        
        return customer;
      } else {
        console.log('???¾ä??°è©² LINE ID ?„å®¢?¶è???);
        console.log(`   ?¯èª¤: ${data.error}`);
        return null;
      }
    } catch (error: any) {
      console.log(`???¥è©¢å¤±æ?: ${error.message}`);
      return null;
    }
  }

  /**
   * æ¨¡æ“¬ LINE Webhook äº‹ä»¶ä¾†æ¸¬è©¦æ”¶??   */
  async simulateLineWebhook(testLineId: string = 'U1234567890abcdef1234567890abcdef1'): Promise<boolean> {
    console.log('?§ª æ¨¡æ“¬ LINE Webhook äº‹ä»¶æ¸¬è©¦\n');
    
    const mockWebhookData: WebhookPayload = {
      events: [
        {
          type: 'message',
          message: {
            id: `test_${Date.now()}`,
            type: 'text',
            text: 'æ¸¬è©¦è¨Šæ¯ - é©—è? LINE ID ?¶é?'
          },
          source: {
            userId: testLineId
          },
          replyToken: `test_reply_${Date.now()}`,
          timestamp: Date.now()
        }
      ]
    };
    
    console.log('?“¤ ?¼é€æ¨¡??Webhook:');
    console.log(JSON.stringify(mockWebhookData, null, 2));
    console.log('');
    
    try {
      const response = await fetch(`${this.workerUrl}/api/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mockWebhookData)
      });
      
      const result: WebhookResponse = await response.json();
      
      if (response.ok) {
        console.log('??Webhook ?•ç??å?');
        console.log(`   ?æ?: ${result.message}`);
        
        // ç­‰å?ä¸€ä¸‹è?è³‡æ?åº«æ›´??        console.log('??ç­‰å?è³‡æ?åº«æ›´??..');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // æª¢æŸ¥?¯å¦?å??¶é???LINE ID
        console.log('?? æª¢æŸ¥?¶é?çµæ?...');
        const customer = await this.testLineIdQuery(testLineId);
        
        if (customer) {
          console.log('?? LINE ID ?¶é?æ¸¬è©¦?å?ï¼?);
          return true;
        } else {
          console.log('??LINE ID ?¶é?æ¸¬è©¦å¤±æ?');
          return false;
        }
      } else {
        console.log('??Webhook ?•ç?å¤±æ?');
        console.log(`   ?€?? ${response.status}`);
        console.log(`   ?¯èª¤: ${result.error || '?ªçŸ¥?¯èª¤'}`);
        return false;
      }
    } catch (error: any) {
      console.log(`??æ¨¡æ“¬æ¸¬è©¦å¤±æ?: ${error.message}`);
      return false;
    }
  }

  /**
   * å®Œæ•´?„é?è­‰å ±??   */
  async generateVerificationReport(): Promise<void> {
    console.log('?? LINE ID ?¶é?é©—è??±å?');
    console.log('='.repeat(50));
    console.log(`?Ÿæ??‚é?: ${new Date().toLocaleString()}\n`);
    
    // ?ºæœ¬é©—è?
    const basicVerification = await this.verifyLineIdCollection();
    
    if (!basicVerification) {
      console.log('???ºæœ¬é©—è?å¤±æ?ï¼Œè?æª¢æŸ¥?ç½®?Œé€?¥');
      return;
    }
    
    console.log('5ï¸âƒ£ ?·è?æ¨¡æ“¬æ¸¬è©¦...');
    const simulationResult = await this.simulateLineWebhook();
    
    console.log('\n' + '='.repeat(50));
    console.log('?? é©—è?ç¸½ç?:');
    console.log(`??API ??¥: æ­?¸¸`);
    console.log(`??è³‡æ?åº«é€?¥: æ­?¸¸`);
    console.log(`??å®¢æˆ¶è³‡æ??¥è©¢: æ­?¸¸`);
    console.log(`${simulationResult ? '?? : '??} LINE ID ?¶é?: ${simulationResult ? 'æ­?¸¸' : '?°å¸¸'}`);
    
    if (simulationResult) {
      console.log('\n?? ?­å?ï¼ä???LINE ID ?¶é??Ÿèƒ½?‹ä?æ­?¸¸ï¼?);
      console.log('?“± ?¶å®¢?¶ç™¼?è??¯æ?ï¼Œç³»çµ±æ??ªå?ï¼?);
      console.log('   1. ?å?å®¢æˆ¶??LINE User ID');
      console.log('   2. èª¿ç”¨ LINE Profile API ?²å?è©³ç´°è³‡è?');
      console.log('   3. ?²å???D1 è³‡æ?åº«ç? customers è¡?);
      console.log('   4. å»ºç?å°æ??„å?è©±å?è¨Šæ¯è¨˜é?');
    } else {
      console.log('\n? ï?  LINE ID ?¶é??Ÿèƒ½?¯èƒ½?‰å?é¡Œï?è«‹æª¢?¥ï?');
      console.log('   1. LINE Channel Access Token ?¯å¦æ­?¢º');
      console.log('   2. D1 è³‡æ?åº«æ˜¯?¦å·²æ­?¢º?å???);
      console.log('   3. Worker ç¨‹å?ç¢¼æ˜¯?¦å·²?¨ç½²?€?°ç???);
    }
  }
}

// ä½¿ç”¨ç¯„ä?
async function main(): Promise<void> {
  if (WORKER_URL === 'https://your-worker-domain.workers.dev') {
    console.log('? ï?  è«‹å??´æ–° WORKER_URL è®Šæ•¸?ºä??„å¯¦??Worker ç¶²å?');
    console.log('   ?¯ä»¥??config.cjs ä¸­è¨­å®šï??–ç›´?¥ä¿®?¹æ­¤æª”æ???WORKER_URL');
    return;
  }

  const verifier = new LineIdCollectionVerifier(WORKER_URL);
  
  // ?Ÿæ?å®Œæ•´é©—è??±å?
  await verifier.generateVerificationReport();
}

// å¦‚æ??´æ¥?·è??™å€‹è…³??if (typeof window === 'undefined') {
  main().catch(console.error);
}

// ?¯å‡ºé¡åˆ¥ä¾›å…¶ä»–åœ°?¹ä½¿??export { LineIdCollectionVerifier };