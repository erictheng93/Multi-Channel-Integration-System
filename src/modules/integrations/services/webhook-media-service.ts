// src/modules/integrations/services/webhook-media-service.ts
// LINE media download, Facebook attachment handling, R2 upload (Phase 4 refactoring)

import { createDbClient } from '@/db/drizzle-factory';
import { fileAttachments } from '@/db/schema';
import type { Bindings } from '@/types';
import { createContextLogger } from '@/utils/logger';
import { nowISO } from '@/utils/timestamp'

const log = createContextLogger('WebhookMedia');

/**
 * Process a LINE media message: download content from LINE API, upload to R2,
 * and insert a file_attachments record.
 * Returns the array of file attachment data for broadcast inclusion.
 */
export async function processLineMedia(
  env: Bindings,
  messageId: string,
  lineMessageId: string,
  lineMessageType: string,
  fileName?: string
): Promise<any[]> {
  let fileAttachmentData: any[] = [];

  console.log(`[LINE Webhook] Processing media BEFORE broadcast for ${lineMessageType} message...`);
  try {
    const { processLineMediaMessage } = await import('@/utils/file-storage');

    // Retry up to 3 times with exponential backoff for transient LINE API / R2 failures
    let mediaFile: Awaited<ReturnType<typeof processLineMediaMessage>> = null;
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      mediaFile = await processLineMediaMessage(
        env,
        lineMessageId,
        lineMessageType,
        fileName
      );
      if (mediaFile) break;

      if (attempt < MAX_RETRIES) {
        const delay = attempt * 500; // 500ms, 1000ms
        log.warn(`LINE Webhook: Media download attempt ${attempt}/${MAX_RETRIES} failed, retrying in ${delay}ms`, { lineMessageId, lineMessageType });
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        log.error(`LINE Webhook: Media download failed after ${MAX_RETRIES} attempts`, { lineMessageId, lineMessageType });
      }
    }

    if (mediaFile) {
      // Extract R2 key from the proxy URL
      const r2Key = mediaFile.url.includes('/api/files/public/')
        ? mediaFile.url.split('/api/files/public/')[1]
        : `media/line/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${mediaFile.id}`;

      const newFileAttachment = {
        id: mediaFile.id,
        messageId: messageId,
        filename: mediaFile.filename,
        mimeType: mediaFile.mimeType,
        fileSize: mediaFile.size,
        fileUrl: mediaFile.url,
        r2Key: r2Key,
        createdAt: nowISO()
      };

      // Store to database
      const drizzleDb = createDbClient(env.DB);
      await drizzleDb.insert(fileAttachments).values(newFileAttachment);

      // Keep for broadcast
      fileAttachmentData = [newFileAttachment];

      console.log(`[LINE Webhook] Media processed and stored BEFORE broadcast: ${mediaFile.filename}`);
    }
  } catch (storageError) {
    log.error('LINE Webhook: Error processing media before broadcast', { error: storageError instanceof Error ? storageError.message : String(storageError) });
    // Continue with broadcast even if media processing fails
  }

  return fileAttachmentData;
}

/**
 * Process a Facebook media message: download attachment, upload to R2,
 * and insert a file_attachments record.
 */
export async function processFacebookMedia(
  env: Bindings,
  messageId: string,
  mediaUrl: string,
  messageType: string,
  platformMessageId: string,
  title?: string
): Promise<void> {
  try {
    const { processFacebookMediaMessage } = await import('@/utils/file-storage');
    const mediaFile = await processFacebookMediaMessage(
      env,
      mediaUrl,
      messageType,
      platformMessageId,
      title
    );

    if (mediaFile) {
      // 將檔案資訊存儲到資料庫 - using Drizzle ORM
      const drizzleDb = createDbClient(env.DB);
      const newFileAttachment: any = {
        id: mediaFile.id,
        messageId: messageId,
        fileName: mediaFile.filename,
        fileType: mediaFile.mimeType,
        fileSize: mediaFile.size,
        r2Key: mediaFile.url, // Using url as r2Key for now
        url: mediaFile.originalUrl,
        createdAt: nowISO()
      };

      await drizzleDb.insert(fileAttachments).values(newFileAttachment);

      log.debug('Facebook media stored', { messageType, filename: mediaFile.filename });
    } else {
      log.warn('Failed to store Facebook media', { messageType, messageId: platformMessageId });
    }
  } catch (storageError) {
    log.error('Error storing Facebook media', { error: storageError instanceof Error ? storageError.message : String(storageError) });
  }
}
