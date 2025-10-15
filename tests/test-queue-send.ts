// ⚠️ DEPRECATED: This file tests AGENT_QUEUE which has been replaced by DelayedMessageBuffer Durable Object
// This test worker is no longer relevant for the current architecture (migrated 2025-09-30)
// For testing delayed messages, use the new Durable Objects-based tests instead
// See: src/durable-objects/DelayedMessageBuffer.ts
// See: docs/DELAYED_MESSAGING_GUIDE.md

// 測試直接發送訊息到 Queue
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    if (request.method === 'POST' && new URL(request.url).pathname === '/test-queue') {
      try {
        // 直接發送測試訊息到 Queue
        await env.AGENT_QUEUE.send({
          messageId: 'test-' + Date.now(),
          action: 'send_delayed_message',
          timestamp: new Date().toISOString()
        }, {
          delaySeconds: 5 // 5 秒延遲
        });

        return new Response(JSON.stringify({
          success: true,
          message: 'Test message sent to queue with 5 second delay'
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Hello World!');
  },

  async queue(batch: MessageBatch<any>, env: any, ctx: ExecutionContext): Promise<void> {
    console.log(`Processing ${batch.messages.length} messages`);
    
    for (const message of batch.messages) {
      console.log('Processing message:', message.body);
      
      // 簡單的測試處理
      if (message.body.action === 'send_delayed_message') {
        console.log(`Would send message: ${message.body.messageId}`);
        // 這裡可以添加實際的訊息發送邏輯
      }
      
      message.ack();
    }
  }
};