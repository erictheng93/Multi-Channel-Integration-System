// Messaging Attachment Routes
// 附件管理端點

import { Hono } from 'hono';
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('MsgAttachments')

import { eq } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import type { Bindings, JWTPayload } from '@/types';
import { messages, fileAttachments } from '@/db/schema';
import { jwtAuth } from '@/middleware/auth';
import {
  successResponse,
  errorResponse,
  badRequestResponse,
  notFoundResponse,
  forbiddenResponse
} from '@/utils/api-response';
import { nowISO, nowMs } from '@/utils/timestamp';
import { getPublicFileUrl } from '@/utils/file-url';

const attachmentRoutes = new Hono<{ Bindings: Bindings }>();

// 允許的 MIME 類型
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm',
  'audio/mp3', 'audio/wav', 'audio/ogg',
  'application/pdf', 'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

// 最大檔案大小 (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * 獲取訊息的附件列表
 * GET /api/messages/:id/attachments
 */
attachmentRoutes.get('/:id/attachments', jwtAuth, async (c) => {
  try {
    const messageId = c.req.param('id');

    if (!messageId) {
      return badRequestResponse(c, 'Message ID is required');
    }

    const db = createDbClient(c.env.DB);

    // 檢查訊息是否存在
    const message = await db
      .select({ id: messages.id, conversationId: messages.conversationId })
      .from(messages)
      .where(eq(messages.id, messageId))
      .get();

    if (!message) {
      return notFoundResponse(c, 'Message not found');
    }

    // 獲取附件列表
    const attachmentList = await db
      .select({
        id: fileAttachments.id,
        messageId: fileAttachments.messageId,
        filename: fileAttachments.filename,
        mimeType: fileAttachments.mimeType,
        fileSize: fileAttachments.fileSize,
        fileUrl: fileAttachments.fileUrl,
        r2Key: fileAttachments.r2Key,
        createdAt: fileAttachments.createdAt
      })
      .from(fileAttachments)
      .where(eq(fileAttachments.messageId, messageId));

    return successResponse(c, {
      messageId,
      conversationId: message.conversationId,
      attachments: attachmentList,
      count: attachmentList.length
    });

  } catch (error) {
    log.error('Get message attachments error', {}, error as Error);
    return errorResponse(c, error instanceof Error ? error.message : 'Failed to get message attachments', 500);
  }
});

/**
 * 上傳訊息附件
 * POST /api/messages/:id/attachments
 */
attachmentRoutes.post('/:id/attachments', jwtAuth, async (c) => {
  try {
    const messageId = c.req.param('id');
    const userPayload = c.get('jwtPayload') as JWTPayload;

    if (!messageId) {
      return badRequestResponse(c, 'Message ID is required');
    }

    const db = createDbClient(c.env.DB);

    // 檢查訊息是否存在
    const message = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        agentSenderId: messages.agentSenderId,
        senderType: messages.senderType
      })
      .from(messages)
      .where(eq(messages.id, messageId))
      .get();

    if (!message) {
      return notFoundResponse(c, 'Message not found');
    }

    // 檢查權限：只有發送者或管理員可以添加附件
    if (message.senderType === 'agent' &&
        message.agentSenderId !== userPayload.userId.toString() &&
        userPayload.role !== 'admin') {
      return forbiddenResponse(c, 'Only the sender or admin can add attachments');
    }

    // 獲取上傳的檔案
    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return badRequestResponse(c, 'File is required');
    }

    // 檢查檔案大小
    if (file.size > MAX_FILE_SIZE) {
      return badRequestResponse(c, `File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // 檢查 MIME 類型
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return badRequestResponse(c, 'File type not allowed');
    }

    // 生成 R2 key
    const timestamp = nowMs();
    const randomStr = Math.random().toString(36).substr(2, 9);
    const fileExtension = file.name.split('.').pop() || 'bin';
    const r2Key = `attachments/${message.conversationId}/${messageId}/${timestamp}_${randomStr}.${fileExtension}`;

    // 上傳到 R2
    try {
      const arrayBuffer = await file.arrayBuffer();
      await c.env.R2_BUCKET.put(r2Key, arrayBuffer, {
        httpMetadata: {
          contentType: file.type,
          cacheControl: 'public, max-age=604800'
        }
      });
    } catch (error) {
      log.error('R2 upload error', {}, error as Error);
      return errorResponse(c, 'Failed to upload file to storage', 500);
    }

    // Generate public URL via unified utility
    const fileUrl = getPublicFileUrl(c.env, r2Key);

    // 保存附件記錄到資料庫
    const attachmentId = `att_${timestamp}_${randomStr}`;

    await db.insert(fileAttachments).values({
      id: attachmentId,
      messageId,
      filename: file.name,
      mimeType: file.type,
      fileSize: file.size,
      fileUrl,
      r2Key,
      createdAt: nowISO()
    });

    return successResponse(c, {
      attachmentId,
      messageId,
      filename: file.name,
      mimeType: file.type,
      fileSize: file.size,
      url: fileUrl,
      createdAt: nowISO()
    }, 'Attachment uploaded successfully', 201);

  } catch (error) {
    log.error('Upload attachment error', {}, error as Error);
    return errorResponse(c, error instanceof Error ? error.message : 'Failed to upload attachment', 500);
  }
});

export default attachmentRoutes;
