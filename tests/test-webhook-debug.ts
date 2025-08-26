import crypto from 'crypto';

const CHANNEL_SECRET = 'cf4f7c62a6b376f2ac59f8672aedcaa3';
const WEBHOOK_URL = 'https://multi-channel-dev.imfinethankyouandyou.com/api/webhook';

async function testWebhookDebug() {
  console.log('Testing LINE webhook with debug information...\n');

  // First, test without signature to see raw error
  console.log('1. Testing without signature:');
  const response1 = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      destination: 'U1234567890abcdef',
      events: []
    })
  });
  console.log('Status:', response1.status);
  console.log('Response:', await response1.text());

  // Test with different signature formats
  const body = JSON.stringify({
    destination: 'U1234567890abcdef',
    events: []
  });

  console.log('\n2. Testing with standard base64 signature:');
  const signature1 = crypto
    .createHmac('SHA256', CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  
  console.log('Signature:', signature1);
  
  const response2 = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Line-Signature': signature1
    },
    body: body
  });
  console.log('Status:', response2.status);
  console.log('Response:', await response2.text());

  // Try with lowercase header
  console.log('\n3. Testing with lowercase header:');
  const response3 = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-line-signature': signature1
    },
    body: body
  });
  console.log('Status:', response3.status);
  console.log('Response:', await response3.text());

  // Test health check
  console.log('\n4. Testing health check:');
  const healthResponse = await fetch('https://multi-channel-dev.imfinethankyouandyou.com/api/health');
  console.log('Health Status:', healthResponse.status);
  console.log('Health Response:', await healthResponse.text());
}

testWebhookDebug().catch(console.error);