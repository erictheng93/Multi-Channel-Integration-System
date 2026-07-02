// Message Delivery Service
// 共用出站投遞層：從 D1 讀取訊息與附件，推送至平台（LINE），更新狀態並廣播。
// 供兩條路徑共用：
//   1. 立即發送（conversation-messages.ts 的 waitUntil 背景發送）
//   2. 撤回窗口到期派送（DelayedMessageScheduler DO 的 alarm 回呼）
// 邏輯自 MessageService.processBackgroundSending 抽出；所有資料以 D1 為準
// （不依賴 request 物件），DO alarm 才能以 messageId 單獨觸發投遞。

import { createDbClient, type Database } from '@/db/drizzle-factory';
import { eq, inArray } from 'drizzle-orm';
import { messages, conversations, customers, fileAttachments } from '@/db/schema';
import type { Bindings } from '@/types';
import type { LineReplyMessage } from '@/types';
import { WebSocketBroadcastService } from '@/services/websocket-broadcast-service';
import { nowISO, nowMs } from '@/utils/timestamp';
import { createContextLogger } from '@/utils/logger';
import { getSignedFileUrl } from '@/utils/file-url';

const log = createContextLogger('MessageDeliveryService');

export class MessageDeliveryService {
  private db: Database;
  private bindings: Bindings;

  constructor(bindings: Bindings) {
    this.db = createDbClient(bindings.DB);
    this.bindings = bindings;
  }

  /**
   * Deliver a persisted outbound message to its platform.
   *
   * Idempotent by message state: skips when the message is already sent or
   * recalled, so a racing recall or a duplicate alarm can never double-send.
   */
  async deliver(messageId: string): Promise<void> {
    let conversationId: string | null = null;
    let agentSenderId: string | null = null;

    try {
      log.info('Starting delivery', { messageId });

      // Load message row (single source of truth for content/attachments)
      const msg = await this.db
        .select()
        .from(messages)
        .where(eq(messages.id, messageId))
        .get();

      if (!msg) {
        log.error('Message not found for delivery', { messageId });
        return;
      }

      conversationId = msg.conversationId;
      agentSenderId = msg.agentSenderId;

      // Idempotency guard: a recalled message must never reach the platform;
      // an already-sent message must never be sent twice.
      if (msg.isRecalled || msg.isSent) {
        log.info('Delivery skipped', {
          messageId,
          isRecalled: msg.isRecalled,
          isSent: msg.isSent
        });
        return;
      }

      const [conversationData] = await this.db
        .select({
          conversation: conversations,
          customer: customers
        })
        .from(conversations)
        .leftJoin(customers, eq(conversations.customerId, customers.id))
        .where(eq(conversations.id, msg.conversationId))
        .limit(1);

      if (!conversationData?.customer) {
        log.error('Customer not found for delivery', { messageId, conversationId: msg.conversationId });
        return;
      }
      const { customer } = conversationData;

      // Stored metadata carries the client metadata plus platform info and
      // the attachment ids requested at send time (createPendingMessage).
      let storedMetadata: Record<string, unknown> = {};
      if (msg.metadata) {
        try {
          storedMetadata = JSON.parse(msg.metadata) as Record<string, unknown>;
        } catch {
          log.warn('Failed to parse stored message metadata', { messageId });
        }
      }
      const attachmentIds: string[] = Array.isArray(storedMetadata.attachmentIds)
        ? storedMetadata.attachmentIds.filter((v): v is string => typeof v === 'string')
        : [];

      const content = msg.content;

      let isSent = false;
      let deliveryStatus: 'sent' | 'failed' | 'partial' = 'failed';
      let platformMessageId: string | null = null;
      let errorMessage: string | undefined;

      // LINE Sending Logic
      if (customer.platform === 'line' && customer.platformUserId) {
        try {
          const { pushLineMessage, createTextMessage, createImageMessage, createFileFlexMessage } = await import('@/utils/line');
          const lineMessages: LineReplyMessage[] = [];

          const hasAttachments = attachmentIds.length > 0;
          const isFileOnlyContent = content && (
            /^Sent a file:\s*.+$/i.test(content) ||
            /^Sent \d+ files$/i.test(content) ||
            /^\[(?:檔案|圖片)\]\s*.+$/.test(content) ||
            /^\s*.+$/.test(content)  // 匹配 " filename" 格式
          );

          // 詳細日誌：追蹤附件處理
          log.debug('Attachment check', {
            hasAttachments,
            attachmentIds,
            attachmentCount: attachmentIds.length,
            content: content?.substring(0, 50),
            isFileOnlyContent
          });

          if (content && content.trim() && !isFileOnlyContent) {
            lineMessages.push(createTextMessage(content));
          } else if (content && isFileOnlyContent && !hasAttachments) {
            lineMessages.push(createTextMessage(content));
          }

          if (attachmentIds.length > 0) {
            log.debug('Querying attachments', { count: attachmentIds.length, attachmentIds });

            const attachmentsData = await this.db
              .select()
              .from(fileAttachments)
              .where(inArray(fileAttachments.id, attachmentIds));

            log.debug('Query result', { found: attachmentsData.length });

            // 關鍵驗證：檢查是否找到所有附件
            if (attachmentsData.length === 0) {
              log.error('CRITICAL: No attachments found in database', {
                requestedIds: attachmentIds,
                conversationId: msg.conversationId,
                messageId
              });
              errorMessage = `附件未找到: 請求了 ${attachmentIds.length} 個附件但資料庫中未找到任何記錄`;
            } else if (attachmentsData.length < attachmentIds.length) {
              log.warn('Partial attachments found', {
                requested: attachmentIds.length,
                found: attachmentsData.length,
                foundIds: attachmentsData.map(a => a.id),
                missingIds: attachmentIds.filter(id => !attachmentsData.some(a => a.id === id))
              });
            }

            let processedCount = 0;
            let skippedCount = 0;

            for (const attachment of attachmentsData) {
              let fileUrl = attachment.fileUrl;
              if (attachment.r2Key) {
                try {
                  fileUrl = await getSignedFileUrl(this.bindings, attachment.r2Key);
                } catch (error) {
                  log.warn('Failed to sign attachment URL for send, fallback to stored value', {
                    attachmentId: attachment.id,
                    r2Key: attachment.r2Key,
                    error: error instanceof Error ? error.message : String(error)
                  });
                }
              }
              log.debug('Processing attachment', {
                id: attachment.id,
                filename: attachment.filename,
                mimeType: attachment.mimeType,
                fileUrl: fileUrl ? fileUrl.substring(0, 80) + '...' : 'NULL',
                hasFileUrl: !!fileUrl
              });

              if (fileUrl) {
                if (attachment.mimeType?.startsWith('image/')) {
                  // Use native LINE image message (直接顯示圖片，可儲存/分享)
                  lineMessages.push(createImageMessage(fileUrl));
                  log.debug('Added image message', { filename: attachment.filename });
                } else {
                  // Use Flex Message card for files (PDF, Word, Excel, etc.)
                  const flexMessage = createFileFlexMessage(
                    fileUrl,
                    attachment.filename || 'File',
                    attachment.mimeType || '',
                    attachment.fileSize || 0
                  );
                  lineMessages.push(flexMessage);
                  log.debug('Added file flex message', { filename: attachment.filename });
                }
                processedCount++;
              } else {
                log.error('Skipping attachment with NULL fileUrl', {
                  id: attachment.id,
                  filename: attachment.filename,
                  r2Key: attachment.r2Key
                });
                skippedCount++;
              }
            }

            log.debug('Attachment processing summary', {
              total: attachmentsData.length,
              processed: processedCount,
              skipped: skippedCount,
              lineMessagesCount: lineMessages.length
            });

            // 如果有附件但都沒有有效的 fileUrl，記錄錯誤
            if (attachmentsData.length > 0 && processedCount === 0) {
              errorMessage = `所有附件都缺少有效的 fileUrl (${skippedCount} 個附件被跳過)`;
              log.error('All attachments skipped due to missing fileUrl', { skippedCount });
            }
          }

          log.debug('Final lineMessages count', { count: lineMessages.length });

          if (lineMessages.length > 0) {
            // FIX: LINE API 每次最多只能發送 5 則訊息，需要分批發送
            const LINE_MESSAGE_LIMIT = 5;
            const totalMessages = lineMessages.length;
            const batches = Math.ceil(totalMessages / LINE_MESSAGE_LIMIT);

            log.info('Sending messages in batches', { totalMessages, batches });

            let allBatchesSuccessful = true;
            let successfulBatches = 0;
            let failedBatches = 0;

            for (let i = 0; i < totalMessages; i += LINE_MESSAGE_LIMIT) {
              const batch = lineMessages.slice(i, i + LINE_MESSAGE_LIMIT);
              const batchNumber = Math.floor(i / LINE_MESSAGE_LIMIT) + 1;

              log.debug('Sending batch', { batchNumber, batches, batchSize: batch.length });

              const sendSuccess = await pushLineMessage(
                this.bindings.LINE_CHANNEL_ACCESS_TOKEN,
                customer.platformUserId,
                batch
              );

              if (sendSuccess) {
                successfulBatches++;
                log.debug('Batch sent successfully', { batchNumber, batches });
              } else {
                allBatchesSuccessful = false;
                failedBatches++;
                log.error('Batch failed', { batchNumber, batches });
              }

              // 如果有多個批次，稍微延遲以避免 LINE API rate limiting
              if (i + LINE_MESSAGE_LIMIT < totalMessages) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            }

            if (allBatchesSuccessful) {
              platformMessageId = `line_${nowMs()}`;
              isSent = true;
              deliveryStatus = 'sent';
              log.info('All batches sent successfully', { batches, totalMessages });
            } else if (successfulBatches > 0) {
              // 部分成功
              platformMessageId = `line_${nowMs()}_partial`;
              isSent = true;
              deliveryStatus = 'partial';
              errorMessage = `部分發送成功: ${successfulBatches}/${batches} 批次成功`;
              log.warn('Partial success', { successfulBatches, batches });
            } else {
              errorMessage = 'LINE API returned failure for all batches';
              log.error('All batches failed', { batches, failedBatches });
            }
          } else if (hasAttachments) {
            // 有附件但最終沒有消息要發送 - 這是一個問題
            errorMessage = errorMessage || '有附件但無法生成 LINE 消息（可能是附件查詢或 fileUrl 問題）';
            log.error('Has attachments but no LINE messages generated', {
              attachmentIds,
              errorMessage
            });
          }
        } catch (lineError) {
          errorMessage = lineError instanceof Error ? lineError.message : 'LINE API error';
          log.error('LINE API error', {}, lineError instanceof Error ? lineError : String(lineError));
        }
      }

      // Update Message Status
      await this.db.update(messages).set({
        isSent,
        deliveryStatus,
        platformMessageId,
        ...(isSent && { sentAt: nowISO() }),
        metadata: JSON.stringify({
          ...storedMetadata,
          ...(errorMessage && { error: errorMessage })
        })
      }).where(eq(messages.id, messageId));

      // Broadcast Update
      const broadcastService = new WebSocketBroadcastService(this.bindings);
      await broadcastService.broadcastMessageEvent({
        type: 'message_updated',
        conversationId: msg.conversationId,
        messageId: messageId,
        agentId: msg.agentSenderId || '',
        data: {
          deliveryStatus,
          isSent,
          platformMessageId,
          timestamp: nowISO()
        },
        priority: 'normal'
      });
      log.info('Broadcasted message update', { deliveryStatus });

    } catch (error) {
      log.error('Delivery failed', { messageId }, error instanceof Error ? error : String(error));
      await this.db.update(messages).set({
        deliveryStatus: 'failed',
        metadata: JSON.stringify({ error: String(error) })
      }).where(eq(messages.id, messageId));

      // Mirror the success-path broadcast so the FE can transition the message
      // out of 'pending' on outer-catch failures. Wrapped in its own try/catch —
      // we're already on the outer-catch path, any additional throw would
      // surface in waitUntil as an unhandled error.
      if (conversationId) {
        try {
          const broadcastService = new WebSocketBroadcastService(this.bindings);
          await broadcastService.broadcastMessageEvent({
            type: 'message_updated',
            conversationId,
            messageId,
            agentId: agentSenderId || '',
            data: {
              deliveryStatus: 'failed',
              isSent: false,
              platformMessageId: null,
              error: error instanceof Error ? error.message : String(error),
              timestamp: nowISO()
            },
            priority: 'normal'
          });
        } catch (broadcastError) {
          log.warn('Failed to broadcast catch-path failure (non-fatal)', {
            messageId,
            error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError)
          });
        }
      }
    }
  }
}
