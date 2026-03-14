/**
 * 增强型消息渲染器
 * 支持emoji、贴图、自定义表情的HTML渲染
 */

import { comprehensiveStickerRenderer, type StickerRenderResult } from './sticker-renderer';

interface RenderOptions {
  enableEmoji: boolean;
  enableStickers: boolean;
  enableCustomEmoji: boolean;
  fallbackToText: boolean;
  maxWidth?: string;
  maxHeight?: string;
  stickerSize?: 'small' | 'medium' | 'large' | 'auto';
}

interface EmojiRenderResult {
  type: 'unicode' | 'image' | 'text';
  content: string;
  alt?: string;
}

/**
 * 增强型消息渲染器类
 */
export class EnhancedMessageRenderer {
  private options: RenderOptions;
  private emojiCache = new Map<string, EmojiRenderResult>();

  constructor(options: Partial<RenderOptions> = {}) {
    this.options = {
      enableEmoji: true,
      enableStickers: true,
      enableCustomEmoji: true,
      fallbackToText: true,
      maxWidth: '24px',
      maxHeight: '24px',
      stickerSize: 'medium',
      ...options
    };
  }

  /**
   * 渲染消息为HTML（仅处理文本内容中的emoji描述）
   */
  async renderToHTML(message: string): Promise<string> {
    if (!message) {return '';}

    // 处理emoji描述
    let html = await this.processEmojiDescriptions(message);
    
    // 处理自定义表情
    html = await this.processCustomEmojis(html);
    
    return html;
  }

  /**
   * 渲染完整的数据库消息对象为HTML（包含贴图元数据）
   */
  async renderMessageWithMetadata(
    message: string, 
    messageType: string, 
    metadata: string | null = null
  ): Promise<string> {
    console.log('[EnhancedMessageRenderer] renderMessageWithMetadata called:', { message, messageType, metadata })
    
    if (!message) {
      console.log('[EnhancedMessageRenderer] Empty message, returning empty string')
      return '';
    }

    // 首先处理文本内容中的emoji描述
    let html = await this.processEmojiDescriptions(message);
    console.log('[EnhancedMessageRenderer] After emoji processing:', html)
    
    // 处理贴图（基于数据库元数据）
    if (this.options.enableStickers && messageType === 'sticker' && metadata) {
      console.log('[EnhancedMessageRenderer] Processing sticker with options:', this.options)
      
      const stickerResult = await comprehensiveStickerRenderer.processStickerMetadata(
        metadata, 
        messageType, 
        this.options.stickerSize || 'medium'
      );
      
      console.log('[EnhancedMessageRenderer] Sticker result:', stickerResult)
      
      if (stickerResult) {
        // 如果是贴图消息，替换整个文本内容为贴图HTML
        const stickerHTML = this.createStickerHTML(stickerResult);
        console.log('[EnhancedMessageRenderer] Generated sticker HTML:', stickerHTML)
        html = stickerHTML;
      } else {
        console.log('[EnhancedMessageRenderer] No sticker result returned')
      }
    } else {
      console.log('[EnhancedMessageRenderer] Skipping sticker processing:', { 
        enableStickers: this.options.enableStickers, 
        messageType, 
        hasMetadata: !!metadata 
      })
    }
    
    // 处理自定义表情
    html = await this.processCustomEmojis(html);
    console.log('[EnhancedMessageRenderer] Final HTML:', html)
    
    return html;
  }

  /**
   * 创建贴图HTML
   */
  private createStickerHTML(stickerResult: StickerRenderResult): string {
    const styleString = stickerResult.style 
      ? Object.entries(stickerResult.style).map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`).join('; ')
      : '';
      
    const className = stickerResult.className || 'sticker-container';
    
    const html = `<div class="${className}" style="${styleString}">${stickerResult.content}</div>`;
    
    console.log('[EnhancedMessageRenderer] createStickerHTML result:', html)
    
    return html;
  }

  /**
   * 处理emoji描述
   */
  private async processEmojiDescriptions(text: string): Promise<string> {
    if (!this.options.enableEmoji) {return text;}

    const emojiPattern = /\(([^)]+)\)/g;
    const matches = Array.from(text.matchAll(emojiPattern));
    
    for (const match of matches) {
      const fullMatch = match[0];
      const description = match[1];
      
      if (description) {
        const renderResult = await this.renderEmoji(description);
        if (renderResult.content !== fullMatch) {
          text = text.replace(fullMatch, this.createEmojiHTML(renderResult));
        }
      }
    }
    
    return text;
  }

  /**
   * 渲染单个emoji
   */
  private async renderEmoji(description: string): Promise<EmojiRenderResult> {
    const cacheKey = description.toLowerCase().trim();
    
    const cachedResult = this.emojiCache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    // 方法1：尝试获取Unicode emoji
    const unicodeEmoji = await this.getUnicodeEmoji(description);
    if (unicodeEmoji) {
      const result: EmojiRenderResult = {
        type: 'unicode',
        content: unicodeEmoji,
        alt: description
      };
      this.emojiCache.set(cacheKey, result);
      return result;
    }

    // 方法2：尝试获取emoji图片
    const emojiImageUrl = await this.getEmojiImageUrl(description);
    if (emojiImageUrl) {
      const result: EmojiRenderResult = {
        type: 'image',
        content: emojiImageUrl,
        alt: description
      };
      this.emojiCache.set(cacheKey, result);
      return result;
    }

    // 方法3：回退到文本
    const result: EmojiRenderResult = {
      type: 'text',
      content: `(${description})`,
      alt: description
    };
    this.emojiCache.set(cacheKey, result);
    return result;
  }

  /**
   * 获取Unicode emoji字符
   */
  private async getUnicodeEmoji(description: string): Promise<string | null> {
    // 智能匹配算法
    const patterns = [
      // 直接映射
      { pattern: /^(flexed[\s_]?biceps?|muscle|strong)$/i, emoji: '' },
      { pattern: /^(thumbs?[\s_]?up|\+1|like|good)$/i, emoji: '' },
      { pattern: /^(thumbs?[\s_]?down|-1|dislike|bad)$/i, emoji: '' },
      { pattern: /^(index[\s_]?pointing[\s_]?right|point[\s_]?right)$/i, emoji: '' },
      { pattern: /^(ok[\s_]?hand|okay)$/i, emoji: '' },
      { pattern: /^(smile|happy|grin)$/i, emoji: '' },
      { pattern: /^(heart|love)$/i, emoji: '' },
      { pattern: /^(hungry|food)$/i, emoji: '' },
      { pattern: /^(pleading|beg|puppy[\s_]?eyes)$/i, emoji: '' },
      
      // 语义匹配
      { pattern: /biceps?|muscle|strong/i, emoji: '' },
      { pattern: /thumb.*up|like|good/i, emoji: '' },
      { pattern: /thumb.*down|dislike|bad/i, emoji: '' },
      { pattern: /point.*right|finger.*right/i, emoji: '' },
      { pattern: /ok|okay|alright/i, emoji: '' },
      { pattern: /smile|happy|joy/i, emoji: '' },
      { pattern: /heart|love/i, emoji: '' },
      { pattern: /hungry|food|eat/i, emoji: '' },
      { pattern: /plead|beg|puppy/i, emoji: '' },
    ];

    for (const { pattern, emoji } of patterns) {
      if (pattern.test(description)) {
        return emoji;
      }
    }

    return null;
  }

  /**
   * 获取emoji图片URL
   */
  private async getEmojiImageUrl(description: string): Promise<string | null> {
    try {
      // 可以集成第三方emoji服务
      // 例如：Twemoji, EmojiOne, Apple Emoji等
      
      // 示例：使用Twemoji CDN
      const emojiCodeMap: Record<string, string> = {
        'flexed_biceps': '1f4aa',
        'muscle': '1f4aa',
        'thumbs_up': '1f44d',
        'thumbs_down': '1f44e',
        'index_pointing_right': '1f449',
        'ok_hand': '1f44c',
        'grinning_face': '1f600',
        'red_heart': '2764-fe0f',
        'face_savoring_food': '1f60b',
        'pleading_face': '1f97a',
      };

      const cleanDesc = description.toLowerCase().replace(/\s+/g, '_');
      const emojiCode = emojiCodeMap[cleanDesc];
      
      if (emojiCode) {
        // Twemoji CDN URL
        return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${emojiCode}.png`;
      }

      return null;
    } catch (error) {
      console.error('获取emoji图片失败:', error);
      return null;
    }
  }

  /**
   * 创建emoji HTML
   */
  private createEmojiHTML(renderResult: EmojiRenderResult): string {
    switch (renderResult.type) {
      case 'unicode':
        return `<span class="emoji" title="${renderResult.alt}">${renderResult.content}</span>`;
      
      case 'image':
        return `<img 
          src="${renderResult.content}" 
          alt="${renderResult.alt}" 
          title="${renderResult.alt}"
          class="emoji-image" 
          style="width: ${this.options.maxWidth}; height: ${this.options.maxHeight}; display: inline-block; vertical-align: middle;"
          onerror="this.style.display='none'; this.nextSibling.style.display='inline';"
        /><span style="display:none;">${renderResult.alt}</span>`;
      
      case 'text':
      default:
        return renderResult.content;
    }
  }


  /**
   * 处理自定义表情
   */
  private async processCustomEmojis(text: string): Promise<string> {
    if (!this.options.enableCustomEmoji) {return text;}

    // 处理自定义表情格式 :custom_emoji_name:
    const customEmojiPattern = /:([a-zA-Z0-9_+-]+):/g;
    const matches = Array.from(text.matchAll(customEmojiPattern));

    for (const match of matches) {
      const [fullMatch, emojiName] = match;
      if (emojiName) {
        const customEmojiUrl = await this.getCustomEmojiUrl(emojiName);
        
        if (customEmojiUrl) {
          const customEmojiHTML = `<img 
            src="${customEmojiUrl}" 
            alt=":${emojiName}:" 
            title="${emojiName}"
            class="custom-emoji" 
            style="width: ${this.options.maxWidth}; height: ${this.options.maxHeight}; display: inline-block; vertical-align: middle;"
          />`;
          
          text = text.replace(fullMatch, customEmojiHTML);
        }
      }
    }

    return text;
  }

  /**
   * 获取自定义表情URL
   */
  private async getCustomEmojiUrl(_emojiName: string): Promise<string | null> {
    // 这里可以集成自定义表情API
    // 例如：Discord, Slack, 企业内部表情包等
    // _emojiName 参数可用于查询特定的自定义表情
    return null;
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.emojiCache.clear();
  }

  /**
   * 更新选项
   */
  updateOptions(options: Partial<RenderOptions>) {
    this.options = { ...this.options, ...options };
  }
}

// 创建默认实例
export const defaultMessageRenderer = new EnhancedMessageRenderer();

/**
 * 便捷的HTML渲染函数（仅处理文本中的emoji）
 */
export async function renderMessageToHTML(
  message: string, 
  options?: Partial<RenderOptions>
): Promise<string> {
  if (options) {
    const renderer = new EnhancedMessageRenderer(options);
    return renderer.renderToHTML(message);
  }
  return defaultMessageRenderer.renderToHTML(message);
}

/**
 * 便捷的数据库消息渲染函数（包含贴图处理）
 */
export async function renderDatabaseMessage(
  message: string,
  messageType: string,
  metadata: string | null = null,
  options?: Partial<RenderOptions>
): Promise<string> {
  if (options) {
    const renderer = new EnhancedMessageRenderer(options);
    return renderer.renderMessageWithMetadata(message, messageType, metadata);
  }
  return defaultMessageRenderer.renderMessageWithMetadata(message, messageType, metadata);
}

/**
 * Vue组件用的渲染函数（仅处理emoji）
 */
export async function renderForVue(message: string): Promise<string> {
  return renderMessageToHTML(message, {
    enableEmoji: true,
    enableStickers: false,
    enableCustomEmoji: false,
    maxWidth: '1.2em',
    maxHeight: '1.2em'
  });
}

/**
 * Vue组件用的完整消息渲染函数（包含贴图）
 */
export async function renderDatabaseMessageForVue(
  message: string,
  messageType: string,
  metadata: string | null = null
): Promise<string> {
  return renderDatabaseMessage(message, messageType, metadata, {
    enableEmoji: true,
    enableStickers: true,
    enableCustomEmoji: false,
    maxWidth: '1.2em',
    maxHeight: '1.2em',
    stickerSize: 'medium'
  });
}