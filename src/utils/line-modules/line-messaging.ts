import type { LineReplyMessage, LineReplyRequest } from '../../types';
import { createContextLogger } from '../logger';
import { LINE_API, buildLineApiUrl } from '../../config/external-apis';

const log = createContextLogger('LineUtils');

/**
 * 發送回覆訊息到 LINE
 */
export async function sendLineReply(
  accessToken: string,
  replyToken: string,
  messages: LineReplyMessage[]
): Promise<boolean> {
  try {
    const replyRequest: LineReplyRequest = {
      replyToken,
      messages,
      notificationDisabled: false
    };

    const response = await fetch(buildLineApiUrl(LINE_API.endpoints.reply), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(replyRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('LINE API error', { status: response.status, errorText });
      return false;
    }

    log.info('Message sent successfully to LINE');
    return true;
  } catch (error) {
    log.error('Failed to send LINE message', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

/**
 * 推送訊息到 LINE（不需要 replyToken）
 */
export async function pushLineMessage(
  accessToken: string,
  userId: string,
  messages: LineReplyMessage[]
): Promise<boolean> {
  try {
    const pushRequest = {
      to: userId,
      messages,
      notificationDisabled: false
    };

    const response = await fetch(buildLineApiUrl(LINE_API.endpoints.push), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(pushRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('LINE Push API error', { status: response.status, errorText });
      return false;
    }

    log.info('Push message sent successfully to LINE');
    return true;
  } catch (error) {
    log.error('Failed to push LINE message', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

// =================== LINE Multicast API (批量發送) ===================

/**
 * Multicast API 結果介面
 */
export interface MulticastResult {
  success: boolean;
  totalUsers: number;
  successCount: number;
  failedCount: number;
  failedUserIds?: string[];
  error?: string;
  apiCalls: number;  // 實際 API 調用次數
}

/**
 * 批量發送相同訊息給多個用戶 (Multicast API)
 *
 * LINE Multicast API 限制：
 * - 最多 500 個用戶/次
 * - 訊息內容必須完全相同
 * - 每則訊息仍按正常費率計費
 *
 * @param accessToken - LINE Channel Access Token
 * @param userIds - 用戶 ID 陣列 (最多 500 個，超過會自動分批)
 * @param messages - 訊息陣列 (最多 5 則訊息)
 * @param options - 選項配置
 * @returns MulticastResult
 */
export async function multicastLineMessage(
  accessToken: string,
  userIds: string[],
  messages: LineReplyMessage[],
  options: {
    notificationDisabled?: boolean;
    retryOnFail?: boolean;
    maxRetries?: number;
  } = {}
): Promise<MulticastResult> {
  const {
    notificationDisabled = false,
    retryOnFail = true,
    maxRetries = 3
  } = options;

  // 驗證參數
  if (!userIds || userIds.length === 0) {
    return {
      success: false,
      totalUsers: 0,
      successCount: 0,
      failedCount: 0,
      error: 'No user IDs provided',
      apiCalls: 0
    };
  }

  if (!messages || messages.length === 0) {
    return {
      success: false,
      totalUsers: userIds.length,
      successCount: 0,
      failedCount: userIds.length,
      error: 'No messages provided',
      apiCalls: 0
    };
  }

  if (messages.length > 5) {
    return {
      success: false,
      totalUsers: userIds.length,
      successCount: 0,
      failedCount: userIds.length,
      error: 'Maximum 5 messages per multicast request',
      apiCalls: 0
    };
  }

  // 去除重複的 userIds
  const uniqueUserIds = [...new Set(userIds)];
  const totalUsers = uniqueUserIds.length;

  // 分批處理 (每批最多 500 個用戶)
  const BATCH_SIZE = 500;
  const batches: string[][] = [];
  for (let i = 0; i < uniqueUserIds.length; i += BATCH_SIZE) {
    batches.push(uniqueUserIds.slice(i, i + BATCH_SIZE));
  }

  console.log(`[LINE Multicast] Starting multicast to ${totalUsers} users in ${batches.length} batch(es)`);

  let successCount = 0;
  let failedCount = 0;
  const failedUserIds: string[] = [];
  let apiCalls = 0;

  // 執行每個批次
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    let retryCount = 0;
    let batchSuccess = false;

    while (!batchSuccess && retryCount <= (retryOnFail ? maxRetries : 0)) {
      try {
        const multicastRequest = {
          to: batch,
          messages,
          notificationDisabled
        };

        const response = await fetch(buildLineApiUrl(LINE_API.endpoints.multicast), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify(multicastRequest),
        });

        apiCalls++;

        if (response.ok) {
          successCount += batch.length;
          batchSuccess = true;
          log.info('LINE Multicast batch sent successfully', { batchIndex: batchIndex + 1, totalBatches: batches.length, userCount: batch.length });
        } else {
          const errorText = await response.text();
          log.error('LINE Multicast batch failed', { batchIndex: batchIndex + 1, status: response.status, errorText });

          // 如果是 400 錯誤，可能是部分用戶 ID 無效
          if (response.status === 400) {
            // 嘗試解析錯誤以找出無效的用戶 ID
            try {
              const errorJson = JSON.parse(errorText);
              if (errorJson.details) {
                log.error('LINE Multicast error details', { details: errorJson.details });
              }
            } catch {
              // 忽略 JSON 解析錯誤
            }
          }

          retryCount++;
          if (retryCount <= maxRetries && retryOnFail) {
            // 指數退避
            const delay = Math.pow(2, retryCount) * 1000;
            log.info('LINE Multicast retrying batch', { batchIndex: batchIndex + 1, delay, attempt: retryCount, maxRetries });
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      } catch (error) {
        log.error('LINE Multicast batch exception', { batchIndex: batchIndex + 1, error: error instanceof Error ? error.message : String(error) });
        retryCount++;
        if (retryCount <= maxRetries && retryOnFail) {
          const delay = Math.pow(2, retryCount) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // 如果批次最終失敗
    if (!batchSuccess) {
      failedCount += batch.length;
      failedUserIds.push(...batch);
    }
  }

  const result: MulticastResult = {
    success: failedCount === 0,
    totalUsers,
    successCount,
    failedCount,
    apiCalls,
    ...(failedUserIds.length > 0 && { failedUserIds })
  };

  log.info('LINE Multicast complete', { successCount, totalUsers, apiCalls });

  return result;
}

/**
 * 廣播訊息給所有好友 (Broadcast API)
 *
 * 注意：此 API 會發送給所有關注此 LINE OA 的用戶
 *
 * @param accessToken - LINE Channel Access Token
 * @param messages - 訊息陣列 (最多 5 則訊息)
 * @param notificationDisabled - 是否禁用通知
 * @returns Promise<boolean>
 */
export async function broadcastLineMessage(
  accessToken: string,
  messages: LineReplyMessage[],
  notificationDisabled: boolean = false
): Promise<{ success: boolean; error?: string }> {
  // 驗證參數
  if (!messages || messages.length === 0) {
    return { success: false, error: 'No messages provided' };
  }

  if (messages.length > 5) {
    return { success: false, error: 'Maximum 5 messages per broadcast request' };
  }

  try {
    const broadcastRequest = {
      messages,
      notificationDisabled
    };

    log.info('LINE Broadcast broadcasting message to all followers');

    const response = await fetch(buildLineApiUrl(LINE_API.endpoints.broadcast), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(broadcastRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('LINE Broadcast API error', { status: response.status, errorText });
      return { success: false, error: `LINE API error: ${response.status}` };
    }

    log.info('LINE Broadcast message broadcast successfully');
    return { success: true };
  } catch (error) {
    log.error('LINE Broadcast failed', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * 智能批量發送訊息
 *
 * 根據用戶數量自動選擇最佳發送方式：
 * - 1 個用戶: 使用 Push API
 * - 2-500 個用戶: 使用 Multicast API (單次調用)
 * - 500+ 個用戶: 使用 Multicast API (自動分批)
 *
 * @param accessToken - LINE Channel Access Token
 * @param userIds - 用戶 ID 陣列
 * @param messages - 訊息陣列
 * @returns MulticastResult
 */
export async function smartBatchSendLineMessages(
  accessToken: string,
  userIds: string[],
  messages: LineReplyMessage[]
): Promise<MulticastResult> {
  const uniqueUserIds = [...new Set(userIds)];

  log.info('LINE Smart Batch processing users', { userCount: uniqueUserIds.length });

  // 單一用戶：使用 Push API
  if (uniqueUserIds.length === 1) {
    log.info('LINE Smart Batch using Push API for single user');
    const success = await pushLineMessage(accessToken, uniqueUserIds[0], messages);
    return {
      success,
      totalUsers: 1,
      successCount: success ? 1 : 0,
      failedCount: success ? 0 : 1,
      apiCalls: 1,
      ...(success ? {} : { failedUserIds: uniqueUserIds })
    };
  }

  // 多用戶：使用 Multicast API
  console.log(`[LINE Smart Batch] Using Multicast API for ${uniqueUserIds.length} users`);
  return multicastLineMessage(accessToken, uniqueUserIds, messages);
}

/**
 * 獲取 LINE 訊息配額資訊
 *
 * @param accessToken - LINE Channel Access Token
 * @returns 配額資訊
 */
export async function getLineMessageQuota(accessToken: string): Promise<{
  success: boolean;
  type?: 'none' | 'limited' | 'unlimited';
  value?: number;
  error?: string;
}> {
  try {
    const response = await fetch(buildLineApiUrl(LINE_API.endpoints.quota), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('LINE Quota API error', { status: response.status, errorText });
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json() as { type: 'none' | 'limited' | 'unlimited'; value?: number };
    log.info('LINE Quota retrieved', { type: data.type, value: data.value || 'unlimited' });
    return {
      success: true,
      type: data.type,
      value: data.value
    };
  } catch (error) {
    log.error('Failed to get LINE message quota', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * 獲取 LINE 訊息使用量
 *
 * @param accessToken - LINE Channel Access Token
 * @returns 使用量資訊
 */
export async function getLineMessageUsage(accessToken: string): Promise<{
  success: boolean;
  totalUsage?: number;
  error?: string;
}> {
  try {
    // 獲取當月使用量
    const response = await fetch(buildLineApiUrl(LINE_API.endpoints.quotaConsumption), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('LINE Usage API error', { status: response.status, errorText });
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json() as { totalUsage: number };
    log.info('LINE Usage retrieved', { totalUsage: data.totalUsage });
    return {
      success: true,
      totalUsage: data.totalUsage
    };
  } catch (error) {
    log.error('Failed to get LINE message usage', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
