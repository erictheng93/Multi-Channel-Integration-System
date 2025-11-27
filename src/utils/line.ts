import type { LineReplyRequest, LineReplyMessage, LineFlexBubble } from '../types';

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

    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(replyRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LINE API error:', response.status, errorText);
      return false;
    }

    console.log('Message sent successfully to LINE');
    return true;
  } catch (error) {
    console.error('Failed to send LINE message:', error);
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

    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(pushRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LINE Push API error:', response.status, errorText);
      return false;
    }

    console.log('Push message sent successfully to LINE');
    return true;
  } catch (error) {
    console.error('Failed to push LINE message:', error);
    return false;
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
    console.error('Signature verification error:', error);
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
      icon: '📄',
      label: 'PDF 文件',
      typeName: 'PDF 文檔',
      headerColor: '#E53935',
      buttonColor: '#E53935'
    };
  }

  // Word
  if (mime.includes('word') || mime.includes('document') || ['doc', 'docx'].includes(ext)) {
    return {
      icon: '📝',
      label: 'Word 文件',
      typeName: 'Word 文檔',
      headerColor: '#2196F3',
      buttonColor: '#2196F3'
    };
  }

  // Excel
  if (mime.includes('excel') || mime.includes('spreadsheet') || ['xls', 'xlsx', 'csv'].includes(ext)) {
    return {
      icon: '📊',
      label: 'Excel 文件',
      typeName: 'Excel 表格',
      headerColor: '#4CAF50',
      buttonColor: '#4CAF50'
    };
  }

  // PowerPoint
  if (mime.includes('powerpoint') || mime.includes('presentation') || ['ppt', 'pptx'].includes(ext)) {
    return {
      icon: '📑',
      label: 'PPT 文件',
      typeName: 'PowerPoint 簡報',
      headerColor: '#FF9800',
      buttonColor: '#FF9800'
    };
  }

  // Images
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return {
      icon: '🖼️',
      label: '圖片',
      typeName: '圖片檔案',
      headerColor: '#00BCD4',
      buttonColor: '#00BCD4'
    };
  }

  // Video
  if (mime.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
    return {
      icon: '🎬',
      label: '影片',
      typeName: '影片檔案',
      headerColor: '#9C27B0',
      buttonColor: '#9C27B0'
    };
  }

  // Audio
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) {
    return {
      icon: '🎵',
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
      icon: '📦',
      label: '壓縮檔',
      typeName: '壓縮檔案',
      headerColor: '#795548',
      buttonColor: '#795548'
    };
  }

  // Text files
  if (mime.includes('text') || ['txt', 'md', 'json', 'xml', 'log'].includes(ext)) {
    return {
      icon: '📃',
      label: '文字檔',
      typeName: '文字文件',
      headerColor: '#607D8B',
      buttonColor: '#607D8B'
    };
  }

  // Code files
  if (['js', 'ts', 'py', 'java', 'cpp', 'c', 'html', 'css', 'vue', 'jsx', 'tsx'].includes(ext)) {
    return {
      icon: '💻',
      label: '程式碼',
      typeName: '程式檔案',
      headerColor: '#3F51B5',
      buttonColor: '#3F51B5'
    };
  }

  // Default
  return {
    icon: '📁',
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
        } as any,
        {
          type: 'text',
          text: fileInfo.label,
          size: 'lg',
          weight: 'bold',
          color: '#ffffff',
          margin: 'sm'
        } as any
      ],
      paddingAll: '14px',
      justifyContent: 'center',
      alignItems: 'center'
    } as any,
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
        } as any,
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
            } as any,
            ...(formattedSize ? [{
              type: 'text',
              text: formattedSize,
              size: 'sm',
              color: '#888888',
              align: 'end'
            } as any] : [])
          ],
          margin: 'md'
        } as any,
        {
          type: 'separator',
          margin: 'lg',
          color: '#eeeeee'
        } as any,
        {
          type: 'text',
          text: '點擊下方按鈕下載或開啟檔案',
          size: 'xs',
          color: '#aaaaaa',
          align: 'center',
          margin: 'md'
        } as any
      ],
      paddingAll: '14px'
    } as any,
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          action: {
            type: 'uri',
            label: '📥 打開此文件',
            uri: fileUrl
          },
          style: 'primary',
          color: fileInfo.buttonColor,
          height: 'sm'
        } as any
      ],
      paddingAll: '10px'
    } as any
  };

  return {
    type: 'flex',
    altText: `📎 ${filename}`,
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
    const response = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LINE Profile API error:', response.status, errorText);
      return null;
    }

    const profile = await response.json();
    console.log(`📋 獲取用戶資訊成功 - ${(profile as any).displayName} (${userId})`);
    return profile as { userId: string; displayName: string; pictureUrl?: string; statusMessage?: string; };
  } catch (error) {
    console.error('Failed to get LINE user profile:', error);
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
    const response = await fetch(`https://api.line.me/v2/bot/group/${groupId}/member/${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LINE Group Member API error:', response.status, errorText);
      return null;
    }

    const profile = await response.json();
    console.log(`📋 獲取群組成員資訊成功 - ${(profile as any).displayName} (${userId})`);
    return profile as { userId: string; displayName: string; pictureUrl?: string; statusMessage?: string; };
  } catch (error) {
    console.error('Failed to get LINE group member profile:', error);
    return null;
  }
}