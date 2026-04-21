import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('smartemojirenderer')
/**
 * 智能emoji和贴图渲染系统
 * 支持动态解析各种emoji描述，无需预定义映射表
 */

// emoji-js 库的简化实现，用于动态emoji转换
const EMOJI_REGEX = /\(([^)]+)\)/g;

// 动态emoji数据获取接口（暂时保留供未来使用）
// interface EmojiData {
//   shortname: string;
//   unicode: string;
//   category: string;
// }

// 贴图数据接口
interface StickerData {
  id: string;
  imageUrl: string;
  name: string;
  packageId?: string;
}

/**
 * 智能emoji渲染器类
 */
export class SmartEmojiRenderer {
  private emojiCache = new Map<string, string>();
  private stickerCache = new Map<string, StickerData>();
  
  constructor() {
    // 初始化基础emoji数据
    this.initializeBaseEmojis();
  }

  /**
   * 初始化基础emoji映射
   */
  private initializeBaseEmojis() {
    // 只保留最常用的emoji映射，其他通过API动态获取
    const baseEmojis = {
      'flexed_biceps': '💪',
      'muscle': '💪',
      'thumbs_up': '👍',
      'thumbs_down': '👎',
      'index_pointing_right': '👉',
      'point_right': '👉',
      'ok_hand': '👌',
      'okay': '👌',
      'smile': '😄',
      'grin': '😁',
      'heart': '❤️',
      'hungry': '😋',
      'pleading': '🥺',
    };
    
    for (const [key, value] of Object.entries(baseEmojis)) {
      this.emojiCache.set(key, value);
    }
  }

  /**
   * 主要的消息处理方法
   */
  async processMessage(message: string): Promise<string> {
    if (!message) {return message;}
    
    // 先处理emoji描述
    let processedMessage = await this.processEmojiDescriptions(message);
    
    // 再处理贴图
    processedMessage = await this.processStickers(processedMessage);
    
    return processedMessage;
  }

  /**
   * 处理emoji描述转换
   */
  private async processEmojiDescriptions(text: string): Promise<string> {
    const matches = Array.from(text.matchAll(EMOJI_REGEX));
    
    for (const match of matches) {
      const fullMatch = match[0]; // "(description)"
      const description = match[1]; // "description"
      
      if (!description) {continue;}
      
      const emoji = await this.resolveEmoji(description);
      if (emoji && emoji !== fullMatch) {
        text = text.replace(fullMatch, emoji);
      }
    }
    
    return text;
  }

  /**
   * 智能解析emoji描述
   */
  private async resolveEmoji(description: string): Promise<string> {
    // 清理描述文字
    const cleanDescription = description
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^\w_]/g, '');
    
    // 检查缓存
    const cachedEmoji = this.emojiCache.get(cleanDescription);
    if (cachedEmoji) {
      return cachedEmoji;
    }
    
    // 尝试多种变体
    const variants = this.generateEmojiVariants(cleanDescription);
    
    for (const variant of variants) {
      const variantEmoji = this.emojiCache.get(variant);
      if (variantEmoji) {
        // 缓存成功的映射
        this.emojiCache.set(cleanDescription, variantEmoji);
        return variantEmoji;
      }
    }
    
    // 尝试动态获取emoji
    const dynamicEmoji = await this.fetchEmojiFromAPI(cleanDescription);
    if (dynamicEmoji) {
      this.emojiCache.set(cleanDescription, dynamicEmoji);
      return dynamicEmoji;
    }
    
    // 如果找不到，返回原始文本
    console.warn(`未能解析emoji描述: ${description}`);
    return `(${description})`;
  }

  /**
   * 生成emoji描述的变体
   */
  private generateEmojiVariants(description: string): string[] {
    const variants: string[] = [description];
    
    // 添加常见变体
    variants.push(description.replace(/_/g, '')); // 去掉下划线
    variants.push(description.replace(/face$/, '')); // 去掉face后缀
    variants.push(description.replace(/^face_/, '')); // 去掉face前缀
    variants.push(`${description  }_face`); // 添加face后缀
    variants.push(description.replace(/ing$/, '')); // 去掉ing后缀
    variants.push(description.replace(/s$/, '')); // 去掉复数s
    
    // 添加同义词映射
    const synonyms: Record<string, string[]> = {
      'flexed_biceps': ['muscle', 'strong', 'strength'],
      'thumbs_up': ['thumbsup', '+1', 'like', 'good'],
      'thumbs_down': ['thumbsdown', '-1', 'dislike', 'bad'],
      'index_pointing_right': ['point_right', 'right_arrow', 'pointing_right'],
      'ok_hand': ['okay', 'ok', 'alright'],
      'pleading': ['pleading_face', 'puppy_eyes', 'begging'],
    };
    
    const baseWord = description.split('_')[0];
    if (synonyms[description]) {
      variants.push(...synonyms[description]);
    }
    
    // 寻找以该词开头的同义词
    for (const [key, values] of Object.entries(synonyms)) {
      if (values.includes(description) || (baseWord && values.includes(baseWord))) {
        variants.push(key, ...values);
      }
    }
    
    return [...new Set(variants)]; // 去重
  }

  /**
   * 从API动态获取emoji（模拟实现）
   */
  private async fetchEmojiFromAPI(description: string): Promise<string | null> {
    try {
      // 这里可以集成第三方emoji API，如：
      // - emoji-api.com
      // - emojipedia API
      // - Unicode emoji data
      
      // 模拟API调用
      const commonEmojiMap: Record<string, string> = {
        'biceps': '💪',
        'muscle': '💪',
        'strong': '💪',
        'pointing': '👉',
        'finger': '👆',
        'hand': '✋',
        'fist': '✊',
        'wave': '👋',
        'clap': '👏',
        'pray': '🙏',
        'heart': '❤️',
        'love': '❤️',
        'fire': '🔥',
        'star': '⭐',
        'sun': '☀️',
        'moon': '🌙',
        'water': '💧',
        'food': '🍔',
        'happy': '😄',
        'sad': '😢',
        'angry': '😠',
        'surprised': '😲',
        'thinking': '🤔',
        'sleeping': '😴',
        'party': '🎉',
        'celebration': '🎉',
        'gift': '🎁',
        'birthday': '🎂',
        'music': '🎵',
        'dance': '💃',
        'run': '🏃',
        'walk': '🚶',
        'car': '🚗',
        'house': '🏠',
        'tree': '🌳',
        'flower': '🌸',
      };
      
      // 检查关键词匹配
      for (const [keyword, emoji] of Object.entries(commonEmojiMap)) {
        if (description.includes(keyword) || keyword.includes(description)) {
          frontendLogger.debug(`通过API找到emoji映射: ${description} -> ${emoji}`);
          return emoji;
        }
      }
      
      return null;
    } catch (error) {
      console.error('获取emoji失败:', error);
      return null;
    }
  }

  /**
   * 处理贴图
   */
  private async processStickers(text: string): Promise<string> {
    // 这里处理各种贴图，如LINE贴图、Facebook贴图等
    // 目前先处理文本中的贴图标识
    return text;
  }

  /**
   * 获取LINE贴图URL
   */
  async getLineStickerUrl(packageId: string, stickerId: string): Promise<string | null> {
    const cacheKey = `line_${packageId}_${stickerId}`;
    
    const cachedSticker = this.stickerCache.get(cacheKey);
    if (cachedSticker) {
      return cachedSticker.imageUrl;
    }
    
    try {
      // LINE贴图URL格式
      const urls = [
        `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/android/sticker.png`,
        `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/iPhone/sticker.png`,
      ];
      
      // 测试URL是否可访问
      for (const url of urls) {
        try {
          const response = await fetch(url, { method: 'HEAD' });
          if (response.ok) {
            const stickerData: StickerData = {
              id: cacheKey,
              imageUrl: url,
              name: `LINE Sticker ${stickerId}`,
              packageId
            };
            this.stickerCache.set(cacheKey, stickerData);
            return url;
          }
        } catch {
          continue;
        }
      }
      
      return null;
    } catch (error) {
      console.error('获取LINE贴图失败:', error);
      return null;
    }
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.emojiCache.clear();
    this.stickerCache.clear();
    this.initializeBaseEmojis();
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return {
      emojiCacheSize: this.emojiCache.size,
      stickerCacheSize: this.stickerCache.size
    };
  }
}

// 创建全局实例
export const smartEmojiRenderer = new SmartEmojiRenderer();

/**
 * 便捷的消息处理函数
 */
export async function renderSmartMessage(message: string): Promise<string> {
  return smartEmojiRenderer.processMessage(message);
}

/**
 * 检测文本是否包含emoji描述或贴图
 */
export function hasEmojiOrStickers(text: string): boolean {
  return EMOJI_REGEX.test(text);
}