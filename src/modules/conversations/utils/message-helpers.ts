// 對話訊息輔助工具函數
// Shared utility for conversation message display logic

/**
 * Get display content for messages, generating placeholders for non-text message types
 * with empty content (e.g., images, files, stickers).
 *
 * @param content - The raw message content (may be null/undefined/empty)
 * @param messageType - The message type (text, image, video, file, sticker, audio, location)
 * @returns Display content string or null if no content and no placeholder available
 */
export const getDisplayContent = (
  content: string | undefined | null,
  messageType: string | undefined
): string | null => {
  // If content exists and is non-empty, use it
  if (content && content.trim() !== '') {
    return content;
  }
  // Generate placeholder for non-text message types with empty content
  const placeholders: Record<string, string> = {
    'file': '[檔案]',
    'image': '[圖片]',
    'video': '[影片]',
    'sticker': '[貼圖]',
    'audio': '[語音訊息]',
    'location': '[位置]'
  };
  return placeholders[messageType || 'text'] || null;
};
