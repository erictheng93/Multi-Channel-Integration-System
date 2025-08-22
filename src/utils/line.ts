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