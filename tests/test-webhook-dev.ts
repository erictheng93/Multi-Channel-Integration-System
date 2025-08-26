import crypto from 'crypto';

const CHANNEL_SECRET = 'cf4f7c62a6b376f2ac59f8672aedcaa3';
const WEBHOOK_URL = 'https://multi-channel-dev.imfinethankyouandyou.com/api/webhook';

async function testWebhook() {
  console.log('Testing LINE webhook for development environment...\n');

  // Create test webhook body
  const body = JSON.stringify({
    destination: 'U1234567890abcdef',
    events: []
  });

  // Generate signature
  const signature = crypto
    .createHmac('SHA256', CHANNEL_SECRET)
    .update(body)
    .digest('base64');

  console.log('Request Body:', body);
  console.log('Generated Signature:', signature);
  console.log('\nSending request to:', WEBHOOK_URL);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Line-Signature': signature
      },
      body: body
    });

    console.log('\nResponse Status:', response.status);
    const responseText = await response.text();
    console.log('Response Body:', responseText);

    if (response.status === 200) {
      console.log('\n✅ Webhook verification successful!');
      console.log('Your LINE webhook is properly configured for development environment.');
    } else {
      console.log('\n❌ Webhook verification failed.');
      console.log('Please check your configuration.');
    }
  } catch (error) {
    console.error('\n❌ Request failed:', error);
  }
}

testWebhook();