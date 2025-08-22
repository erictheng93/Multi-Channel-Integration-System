// 測試 Queue Handler 格式
export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    return new Response('Hello World!');
  },

  async queue(batch: MessageBatch<any>, env: any, ctx: ExecutionContext): Promise<void> {
    console.log(`Processing ${batch.messages.length} messages`);
    
    for (const message of batch.messages) {
      console.log('Message:', message.body);
      message.ack();
    }
  }
};