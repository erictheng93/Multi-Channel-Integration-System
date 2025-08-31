// 會話管理處理器 - 主要實現
import { Hono } from 'hono';
import type { Bindings } from '../types';
// Removed unused drizzle import
// Removed unused drizzle operators

const sessionHandler = new Hono<{ Bindings: Bindings }>();

// 特定會話的訊息端點
sessionHandler.get('/:sessionId/messages', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const { getSessionMessages } = await import('../utils/session');
    const messages = await getSessionMessages(c.env.DB, sessionId);
    
    return c.json({
      success: true,
      data: {
        sessionId,
        messages,
        messageCount: messages.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting session messages:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

export default sessionHandler;