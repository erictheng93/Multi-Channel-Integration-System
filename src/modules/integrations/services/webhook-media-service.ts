// src/modules/integrations/services/webhook-media-service.ts
// LINE media download, Facebook attachment handling, R2 upload (Phase 4 refactoring)

import { eq } from 'drizzle-orm';
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
 *
 * Note: Retries are handled by Cloudflare Queue (max_retries=3).
 * This function is single-attempt — returns [] on failure so queue can retry.
 */
export async function processLineMedia(
  env: Bindings,
  messageId: string,
  lineMessageId: string,
  lineMessageType: string,
  fileName?: string
) {
  log.info('Processing media', { lineMessageId, lineMessageType, fileName });

  try {
    // Idempotency guard: the queue is at-least-once, so a redelivery or a
    // retry-after-partial-success must NOT re-download and re-upload to R2
    // (the R2 key is a random UUID, so a retry creates a 2nd object) nor
    // insert a 2nd file_attachments row. One LINE media event = exactly one
    // attachment, so any existing row for this messageId means we are done.
    const drizzleDb = createDbClient(env.DB);
    const existing = await drizzleDb
      .select()
      .from(fileAttachments)
      .where(eq(fileAttachments.messageId, messageId))
      .get();
    if (existing) {
      log.info('Media already processed, skipping duplicate', { messageId, lineMessageId });
      return [existing];
    }

    const { processLineMediaMessage } = await import('@/utils/file-storage');

    const mediaFile = await processLineMediaMessage(
      env,
      lineMessageId,
      lineMessageType,
      fileName
    );

    if (!mediaFile) {
      log.error('Media download/upload failed', { lineMessageId, lineMessageType });
      return [];
    }

    const newFileAttachment = {
      id: mediaFile.id,
      messageId: messageId,
      filename: mediaFile.filename,
      mimeType: mediaFile.mimeType,
      fileSize: mediaFile.size,
      fileUrl: mediaFile.url,
      r2Key: mediaFile.r2Key,
      createdAt: nowISO()
    };

    // Store to database (drizzleDb created above for the idempotency check)
    await drizzleDb.insert(fileAttachments).values(newFileAttachment);

    log.info('Media processed and stored', { filename: mediaFile.filename, messageId });

    return [newFileAttachment];
  } catch (storageError) {
    log.error('Media processing error', {
      lineMessageId,
      lineMessageType,
      error: storageError instanceof Error ? storageError.message : String(storageError)
    });
    return [];
  }
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
      const newFileAttachment = {
        id: mediaFile.id,
        messageId: messageId,
        filename: mediaFile.filename,
        mimeType: mediaFile.mimeType,
        fileSize: mediaFile.size,
        fileUrl: mediaFile.originalUrl,
        r2Key: mediaFile.url, // Using url as r2Key for now
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
