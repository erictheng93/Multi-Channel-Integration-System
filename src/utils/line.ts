import type { LineReplyRequest, LineReplyMessage, LineFlexBubble, LineFlexComponent } from '../types';
import { createContextLogger } from './logger';
import { LINE_API, buildLineApiUrl } from '../config/external-apis';

// Context logger for LINE utils
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

/**
 * 驗證 LINE Webhook 簽名
 */
export async function verifyLineSignature(
  body: string,
  signature: string | undefined,
  channelSecret: string
): Promise<boolean> {
  if (!signature) {
    return false;
  }

  try {
    // 移除 'sha256=' 前綴
    const receivedSignature = signature.replace('sha256=', '');
    
    // 使用 Web Crypto API 計算 HMAC-SHA256
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(channelSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(body)
    );

    // 轉換為 base64
    const computedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
    
    return computedSignature === receivedSignature;
  } catch (error) {
    log.error('Signature verification error', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

/**
 * 建立文字回覆訊息
 */
export function createTextMessage(text: string): LineReplyMessage {
  return {
    type: 'text',
    text
  };
}

/**
 * 建立貼圖回覆訊息
 */
export function createStickerMessage(packageId: string, stickerId: string): LineReplyMessage {
  return {
    type: 'sticker',
    packageId,
    stickerId
  };
}

/**
 * 建立圖片訊息
 */
export function createImageMessage(originalContentUrl: string, previewImageUrl?: string): LineReplyMessage {
  return {
    type: 'image',
    originalContentUrl,
    previewImageUrl: previewImageUrl || originalContentUrl
  };
}

/**
 * 建立影片訊息
 */
export function createVideoMessage(originalContentUrl: string, previewImageUrl: string): LineReplyMessage {
  return {
    type: 'video',
    originalContentUrl,
    previewImageUrl
  };
}

/**
 * 建立音訊訊息
 */
export function createAudioMessage(originalContentUrl: string, duration: number): LineReplyMessage {
  return {
    type: 'audio',
    originalContentUrl,
    duration
  };
}

/**
 * 建立檔案訊息
 */
export function createFileMessage(originalContentUrl: string, fileName: string): LineReplyMessage {
  return {
    type: 'file',
    originalContentUrl,
    fileName
  };
}

/**
 * 建立位置訊息
 */
export function createLocationMessage(title: string, address: string, latitude: number, longitude: number): LineReplyMessage {
  return {
    type: 'location',
    title,
    address,
    latitude,
    longitude
  };
}

/**
 * 建立 Flex Message
 */
export function createFlexMessage(altText: string, contents: LineFlexBubble): LineReplyMessage {
  return {
    type: 'flex',
    altText,
    contents
  };
}

/**
 * 根據 MIME 類型和檔案名獲取檔案類型資訊
 */
function getFileTypeInfo(mimeType: string, filename: string): {
  icon: string;
  label: string;
  typeName: string;
  headerColor: string;
  buttonColor: string;
} {
  const mime = mimeType.toLowerCase();
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  // PDF
  if (mime.includes('pdf') || ext === 'pdf') {
    return {
      icon: 'PDF',
      label: 'PDF 文件',
      typeName: 'PDF 文檔',
      headerColor: '#E53935',
      buttonColor: '#E53935'
    };
  }

  // Word
  if (mime.includes('word') || mime.includes('document') || ['doc', 'docx'].includes(ext)) {
    return {
      icon: 'DOC',
      label: 'Word 文件',
      typeName: 'Word 文檔',
      headerColor: '#2196F3',
      buttonColor: '#2196F3'
    };
  }

  // Excel
  if (mime.includes('excel') || mime.includes('spreadsheet') || ['xls', 'xlsx', 'csv'].includes(ext)) {
    return {
      icon: 'XLS',
      label: 'Excel 文件',
      typeName: 'Excel 表格',
      headerColor: '#4CAF50',
      buttonColor: '#4CAF50'
    };
  }

  // PowerPoint
  if (mime.includes('powerpoint') || mime.includes('presentation') || ['ppt', 'pptx'].includes(ext)) {
    return {
      icon: 'PPT',
      label: 'PPT 文件',
      typeName: 'PowerPoint 簡報',
      headerColor: '#FF9800',
      buttonColor: '#FF9800'
    };
  }

  // Images
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return {
      icon: 'IMG',
      label: '圖片',
      typeName: '圖片檔案',
      headerColor: '#00BCD4',
      buttonColor: '#00BCD4'
    };
  }

  // Video
  if (mime.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
    return {
      icon: 'VID',
      label: '影片',
      typeName: '影片檔案',
      headerColor: '#9C27B0',
      buttonColor: '#9C27B0'
    };
  }

  // Audio
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) {
    return {
      icon: 'AUD',
      label: '音訊',
      typeName: '音訊檔案',
      headerColor: '#E91E63',
      buttonColor: '#E91E63'
    };
  }

  // Archive
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z') ||
      ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return {
      icon: 'ZIP',
      label: '壓縮檔',
      typeName: '壓縮檔案',
      headerColor: '#795548',
      buttonColor: '#795548'
    };
  }

  // Text files
  if (mime.includes('text') || ['txt', 'md', 'json', 'xml', 'log'].includes(ext)) {
    return {
      icon: 'TXT',
      label: '文字檔',
      typeName: '文字文件',
      headerColor: '#607D8B',
      buttonColor: '#607D8B'
    };
  }

  // Code files
  if (['js', 'ts', 'py', 'java', 'cpp', 'c', 'html', 'css', 'vue', 'jsx', 'tsx'].includes(ext)) {
    return {
      icon: 'CODE',
      label: '程式碼',
      typeName: '程式檔案',
      headerColor: '#3F51B5',
      buttonColor: '#3F51B5'
    };
  }

  // Default
  return {
    icon: 'FILE',
    label: '檔案',
    typeName: '檔案',
    headerColor: '#9C27B0',
    buttonColor: '#9C27B0'
  };
}

/**
 * 格式化檔案大小
 */
function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '';

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

/**
 * 建立檔案附件 Flex Message (LINE 風格卡片)
 *
 * @param fileUrl - 檔案下載 URL
 * @param filename - 檔案名稱
 * @param mimeType - MIME 類型
 * @param fileSize - 檔案大小 (bytes)
 * @returns Flex Message 對象
 */
export function createFileFlexMessage(
  fileUrl: string,
  filename: string,
  mimeType: string = '',
  fileSize: number = 0
): LineReplyMessage {
  const fileInfo = getFileTypeInfo(mimeType, filename);
  const formattedSize = formatFileSize(fileSize);

  // Truncate long filenames
  const maxLength = 30;
  let displayFilename = filename;
  if (filename.length > maxLength) {
    const extension = filename.split('.').pop() || '';
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
    const availableLength = maxLength - extension.length - 4;
    displayFilename = `${nameWithoutExt.substring(0, availableLength)}...${extension ? `.${extension}` : ''}`;
  }

  const flexBubble: LineFlexBubble = {
    type: 'bubble',
    styles: {
      header: {
        backgroundColor: fileInfo.headerColor
      },
      footer: {
        backgroundColor: '#f8f9fa'
      }
    },
    header: {
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: fileInfo.icon,
          size: 'xl',
          color: '#ffffff'
        },
        {
          type: 'text',
          text: fileInfo.label,
          size: 'lg',
          weight: 'bold',
          color: '#ffffff',
          margin: 'sm'
        }
      ],
      paddingAll: '14px',
      justifyContent: 'center',
      alignItems: 'center'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: displayFilename,
          weight: 'bold',
          size: 'md',
          wrap: true,
          color: '#333333'
        },
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'text',
              text: fileInfo.typeName,
              size: 'sm',
              color: '#888888',
              flex: 1
            } satisfies LineFlexComponent,
            ...(formattedSize ? [{
              type: 'text' as const,
              text: formattedSize,
              size: 'sm',
              color: '#888888',
              align: 'end'
            }] : [])
          ],
          margin: 'md'
        },
        {
          type: 'separator',
          margin: 'lg',
          color: '#eeeeee'
        },
        {
          type: 'text',
          text: '點擊下方按鈕下載或開啟檔案',
          size: 'xs',
          color: '#aaaaaa',
          align: 'center',
          margin: 'md'
        }
      ],
      paddingAll: '14px'
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          action: {
            type: 'uri',
            label: '打開此文件',
            uri: fileUrl
          },
          style: 'primary',
          color: fileInfo.buttonColor,
          height: 'sm'
        }
      ],
      paddingAll: '10px'
    }
  };

  return {
    type: 'flex',
    altText: `[${fileInfo.label}] ${filename}`,
    contents: flexBubble
  };
}

/**
 * 建立圖片附件 Flex Message (LINE 風格卡片 - 含圖片預覽)
 *
 * @param imageUrl - 圖片 URL
 * @param filename - 檔案名稱
 * @param fileSize - 檔案大小 (bytes)
 * @returns Flex Message 對象
 */
export function createImageFlexMessage(
  imageUrl: string,
  filename: string,
  fileSize: number = 0
): LineReplyMessage {
  const formattedSize = formatFileSize(fileSize);

  // Truncate long filenames
  const maxLength = 25;
  let displayFilename = filename;
  if (filename.length > maxLength) {
    const extension = filename.split('.').pop() || '';
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
    const availableLength = maxLength - extension.length - 4;
    displayFilename = `${nameWithoutExt.substring(0, availableLength)}...${extension ? `.${extension}` : ''}`;
  }

  const flexBubble: LineFlexBubble = {
    type: 'bubble',
    styles: {
      header: {
        backgroundColor: '#00BCD4'
      },
      footer: {
        backgroundColor: '#f8f9fa'
      }
    },
    header: {
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: '',
          size: 'xl',
          color: '#ffffff'
        },
        {
          type: 'text',
          text: '圖片',
          size: 'lg',
          weight: 'bold',
          color: '#ffffff',
          margin: 'sm'
        }
      ],
      paddingAll: '14px',
      justifyContent: 'center',
      alignItems: 'center'
    },
    hero: {
      type: 'image',
      url: imageUrl,
      size: 'full',
      aspectRatio: '4:3',
      aspectMode: 'cover',
      action: {
        type: 'uri',
        uri: imageUrl
      }
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: displayFilename,
          weight: 'bold',
          size: 'md',
          wrap: true,
          color: '#333333'
        },
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'text',
              text: '圖片檔案',
              size: 'sm',
              color: '#888888',
              flex: 1
            } satisfies LineFlexComponent,
            ...(formattedSize ? [{
              type: 'text' as const,
              text: formattedSize,
              size: 'sm',
              color: '#888888',
              align: 'end'
            }] : [])
          ],
          margin: 'md'
        },
        {
          type: 'separator',
          margin: 'lg',
          color: '#eeeeee'
        },
        {
          type: 'text',
          text: '點擊下方按鈕下載或開啟圖片',
          size: 'xs',
          color: '#aaaaaa',
          align: 'center',
          margin: 'md'
        }
      ],
      paddingAll: '14px'
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          action: {
            type: 'uri',
            label: '打開此圖片',
            uri: imageUrl
          },
          style: 'primary',
          color: '#00BCD4',
          height: 'sm'
        }
      ],
      paddingAll: '10px'
    }
  };

  return {
    type: 'flex',
    altText: `[圖片] ${filename}`,
    contents: flexBubble
  };
}

/**
 * 獲取 LINE 用戶資訊
 */
export async function getLineUserProfile(
  accessToken: string,
  userId: string
): Promise<{
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
} | null> {
  try {
    const response = await fetch(buildLineApiUrl(LINE_API.endpoints.profile, { userId }), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('LINE Profile API error', { status: response.status, errorText });
      return null;
    }

    const profile = await response.json();
    log.info('LINE user profile retrieved successfully', { displayName: (profile as { displayName: string }).displayName, userId });
    return profile as { userId: string; displayName: string; pictureUrl?: string; statusMessage?: string; };
  } catch (error) {
    log.error('Failed to get LINE user profile', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * 獲取群組或聊天室成員資訊
 */
export async function getLineGroupMemberProfile(
  accessToken: string,
  groupId: string,
  userId: string
): Promise<{
  userId: string;
  displayName: string;
  pictureUrl?: string;
} | null> {
  try {
    const response = await fetch(buildLineApiUrl(LINE_API.endpoints.groupMember, { groupId, userId }), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('LINE Group Member API error', { status: response.status, errorText });
      return null;
    }

    const profile = await response.json();
    log.info('LINE group member profile retrieved successfully', { displayName: (profile as { displayName: string }).displayName, userId });
    return profile as { userId: string; displayName: string; pictureUrl?: string; statusMessage?: string; };
  } catch (error) {
    log.error('Failed to get LINE group member profile', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}