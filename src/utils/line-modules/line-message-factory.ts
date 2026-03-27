import type { LineReplyMessage, LineFlexBubble } from '../../types';

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
