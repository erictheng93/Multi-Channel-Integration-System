// Simplified API Response Utilities - Eliminates response handling complexity
import type { Context } from 'hono';

export class ApiResponse {
  static success<T>(c: Context, data: T, message?: string) {
    return c.json({
      success: true,
      data,
      message,
      timestamp: new Date().toISOString()
    });
  }

  static error(c: Context, error: unknown, statusCode = 500) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    console.error('API Error:', errorMessage, error);

    return c.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, statusCode as 400 | 401 | 403 | 404 | 409 | 500);
  }

  static validation(c: Context, errors: Array<{ field: string; message: string }>) {
    return c.json({
      success: false,
      error: 'Validation failed',
      details: errors,
      timestamp: new Date().toISOString()
    }, 400);
  }

  static notFound(c: Context, resource = 'Resource') {
    return c.json({
      success: false,
      error: `${resource} not found`,
      timestamp: new Date().toISOString()
    }, 404);
  }

  static unauthorized(c: Context, message = 'Authentication required') {
    return c.json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    }, 401);
  }

  static forbidden(c: Context, message = 'Permission denied') {
    return c.json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    }, 403);
  }
}

export class MessageRequestService {
  static async validateAndParse(c: Context) {
    const conversationId = c.req.param('id');
    const user = c.get('user');
    const body = await c.req.json();

    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    if (!user) {
      throw new Error('User authentication required');
    }

    const { content, mediaUrl, mediaType, attachmentIds } = body;

    if (!content && !mediaUrl && (!attachmentIds || attachmentIds.length === 0)) {
      throw new Error('Content, media, or attachments are required');
    }

    return {
      conversationId,
      content: content || '',
      senderId: String(user.id),
      senderType: 'agent' as const,
      messageType: mediaType || 'text',
      attachmentIds: attachmentIds || []
    };
  }
}