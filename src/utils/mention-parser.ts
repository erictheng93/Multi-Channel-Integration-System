// src/utils/mention-parser.ts
// @mention 解析工具 - 從訊息內容中解析提及的用戶

/**
 * 解析結果類型
 */
export interface MentionResult {
  userId: string;
  displayName: string;
  startIndex: number;
  endIndex: number;
  rawMatch: string;
}

/**
 * 支援的提及格式:
 * 1. @[userId:displayName] - 完整格式，如 @[admin-001:系統管理員]
 * 2. @username - 簡單格式，如 @john
 */

// 完整格式的正則: @[userId:displayName]
const FULL_MENTION_REGEX = /@\[([^:\]]+):([^\]]+)\]/g;

// 簡單格式的正則: @username (英數字、中文、底線、連字號)
const SIMPLE_MENTION_REGEX = /@([\w\u4e00-\u9fff\-]+)/g;

/**
 * 解析訊息內容中的所有 @mention
 * 優先解析完整格式，然後解析簡單格式
 */
export function parseMentions(content: string): MentionResult[] {
  const mentions: MentionResult[] = [];
  const processedRanges: Array<{ start: number; end: number }> = [];

  // 1. 先解析完整格式 @[userId:displayName]
  let match: RegExpExecArray | null;
  const fullRegex = new RegExp(FULL_MENTION_REGEX.source, 'g');

  while ((match = fullRegex.exec(content)) !== null) {
    const [rawMatch, userId, displayName] = match;
    const startIndex = match.index;
    const endIndex = startIndex + rawMatch.length;

    mentions.push({
      userId,
      displayName,
      startIndex,
      endIndex,
      rawMatch
    });

    processedRanges.push({ start: startIndex, end: endIndex });
  }

  // 2. 解析簡單格式 @username (排除已處理的範圍)
  const simpleRegex = new RegExp(SIMPLE_MENTION_REGEX.source, 'g');

  while ((match = simpleRegex.exec(content)) !== null) {
    const [rawMatch, username] = match;
    const startIndex = match.index;
    const endIndex = startIndex + rawMatch.length;

    // 檢查是否與完整格式重疊
    const isOverlapping = processedRanges.some(
      range => !(endIndex <= range.start || startIndex >= range.end)
    );

    if (!isOverlapping) {
      mentions.push({
        userId: username, // 簡單格式時，userId 就是 username
        displayName: username,
        startIndex,
        endIndex,
        rawMatch
      });
    }
  }

  // 按位置排序
  return mentions.sort((a, b) => a.startIndex - b.startIndex);
}

/**
 * 從訊息內容中提取所有被提及的用戶 ID
 * 返回去重後的用戶 ID 列表
 */
export function getMentionedUserIds(content: string): string[] {
  const mentions = parseMentions(content);
  const userIds = mentions.map(m => m.userId);
  return [...new Set(userIds)]; // 去重
}

/**
 * 檢查訊息內容是否包含任何 @mention
 */
export function hasMentions(content: string): boolean {
  return FULL_MENTION_REGEX.test(content) || SIMPLE_MENTION_REGEX.test(content);
}

/**
 * 創建提及字串 (用於在訊息中插入提及)
 */
export function createMention(userId: string, displayName: string): string {
  return `@[${userId}:${displayName}]`;
}

/**
 * 將訊息內容中的 @mention 替換為純文字
 * 用於生成通知預覽等場景
 */
export function replaceMentionsWithText(content: string): string {
  // 先替換完整格式
  let result = content.replace(FULL_MENTION_REGEX, '@$2');
  // 簡單格式保持不變 (已經是 @username 形式)
  return result;
}

/**
 * 驗證用戶 ID 格式
 */
export function isValidUserId(userId: string): boolean {
  // 允許英數字、連字號、底線
  return /^[\w\-]+$/.test(userId);
}
