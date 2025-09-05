/**
 * 分层Emoji处理器
 * Layer 1: 1915种静态映射 (覆盖90%+)
 * Layer 2: Unicode emoji库 (覆盖到97%+)
 * 场景优化: 对话列表用Layer 1，详情页用Layer 1+2
 */

import { extendedEmojiMap, hasEmoji, getEmoji } from './extended-emoji-map';

// Layer 2: Unicode emoji库 (暂时模拟，可替换为真实库)
class UnicodeEmojiLibrary {
  private unicodeMap: Map<string, string> = new Map();
  private loaded = false;

  constructor() {
    this.initializeUnicodeData();
  }

  /**
   * 初始化Unicode emoji数据
   */
  private initializeUnicodeData() {
    // 这里可以集成真实的Unicode emoji库
    // 例如：unicode-emoji-json, emojilib等
    const additionalUnicodeEmojis = {
      // 一些在静态表中可能缺失的emoji
      'confused_face': '😕',
      'worried_face': '😟',
      'slightly_frowning_face': '🙁',
      'frowning_face': '☹️',
      'persevering_face': '😣',
      'confounded_face': '😖',
      'tired_face': '😫',
      'weary_face': '😩',
      'pleading_face': '🥺',
      'crying_face': '😢',
      'loudly_crying_face': '😭',
      'face_with_steam_from_nose': '😤',
      'angry_face': '😠',
      'pouting_face': '😡',
      'face_with_symbols_on_mouth': '🤬',
      'smiling_face_with_horns': '😈',
      'angry_face_with_horns': '👿',
      'skull': '💀',
      'skull_and_crossbones': '☠️',
      'pile_of_poo': '💩',
      'clown_face': '🤡',
      'ogre': '👹',
      'goblin': '👺',
      'ghost': '👻',
      'alien': '👽',
      'alien_monster': '👾',
      'robot': '🤖',
      'grinning_cat': '😸',
      'grinning_cat_with_smiling_eyes': '😹',
      'cat_with_tears_of_joy': '😹',
      'smiling_cat_with_heart_eyes': '😻',
      'cat_with_wry_smile': '😼',
      'kissing_cat': '😽',
      'weary_cat': '🙀',
      'crying_cat': '😿',
      'pouting_cat': '😾',
      
      // 更多手势
      'pinching_hand': '🤏',
      'victory_hand': '✌️',
      'crossed_fingers': '🤞',
      'hand_with_fingers_splayed': '🖐️',
      'raised_hand': '✋',
      'raised_back_of_hand': '🤚',
      'waving_hand': '👋',
      'love_you_gesture': '🤟',
      'middle_finger': '🖕',
      'backhand_index_pointing_down': '👇',
      'backhand_index_pointing_up': '👆',
      'backhand_index_pointing_left': '👈',
      'backhand_index_pointing_right': '👉',
      'index_pointing_up': '☝️',
      
      // 新增的月亮变体
      'serious_moon_face': '🌚',
      'dark_moon_face': '🌚',
      'creepy_moon_face': '🌚',
      'evil_moon_face': '🌚',
      'smug_moon_face': '🌚',
      
      // 笑的变体
      'hard_laughter': '😂',
      'intense_laughter': '😂',
      'extreme_laughter': '😂',
      'uncontrollable_laughter': '😂',
      'hysterical_laughter': '😂',
      'maniacal_laughter': '😂',
      
      // 更多动物
      'service_dog': '🐕‍🦺',
      'guide_dog': '🦮',
      'dog_face': '🐶',
      'cat_face': '🐱',
      'mouse_face': '🐭',
      'hamster_face': '🐹',
      'rabbit_face': '🐰',
      'fox_face': '🦊',
      'bear_face': '🐻',
      'panda_face': '🐼',
      'koala_face': '🐨',
      'tiger_face': '🐯',
      'lion_face': '🦁',
      'cow_face': '🐮',
      'pig_face': '🐷',
      'frog_face': '🐸',
      'monkey_face': '🐵',
      
      // 食物扩展  
      'hot_dog': '🌭',
      'hamburger': '🍔',
      'french_fries': '🍟',
      'pizza_slice': '🍕',
      'sandwich': '🥪',
      'stuffed_flatbread': '🥙',
      'taco': '🌮',
      'burrito': '🌯',
      'green_salad': '🥗',
      'shallow_pan_of_food': '🥘',
      'pot_of_food': '🍲',
      'bowl_with_spoon': '🥣',
      'steaming_bowl': '🍜',
      'spaghetti': '🍝',
      'roasted_sweet_potato': '🍠',
      'oden': '🍢',
      'sushi': '🍣',
      'fried_shrimp': '🍤',
      'fish_cake': '🍥',
      'moon_cake': '🥮',
      'dango': '🍡',
      'dumpling': '🥟',
      'fortune_cookie': '🥠',
      'takeout_box': '🥡',
    };

    for (const [key, emoji] of Object.entries(additionalUnicodeEmojis)) {
      this.unicodeMap.set(key.toLowerCase().replace(/\s+/g, '_'), emoji);
    }
    
    this.loaded = true;
  }

  /**
   * 查找Unicode emoji
   */
  findEmoji(description: string): string | null {
    if (!this.loaded) {
      return null;
    }

    const cleanDescription = description.trim().toLowerCase().replace(/\s+/g, '_');
    
    // 直接查找
    if (this.unicodeMap.has(cleanDescription)) {
      return this.unicodeMap.get(cleanDescription) || null;
    }

    // 模糊匹配
    for (const [key, emoji] of this.unicodeMap.entries()) {
      if (key.includes(cleanDescription) || cleanDescription.includes(key)) {
        return emoji;
      }
    }

    return null;
  }

  /**
   * 异步加载更多Unicode数据
   */
  async loadAdditionalData(): Promise<void> {
    // 这里可以异步加载更大的Unicode数据集
    // 例如：从CDN加载完整的emoji数据
    return Promise.resolve();
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    return {
      unicodeEmojisLoaded: this.unicodeMap.size,
      isLoaded: this.loaded
    };
  }
}

// 创建Unicode库实例
const unicodeEmojiLibrary = new UnicodeEmojiLibrary();

/**
 * 分层Emoji处理器类
 */
export class LayeredEmojiProcessor {
  private static instance: LayeredEmojiProcessor;
  private stats = {
    layer1Hits: 0,
    layer2Hits: 0,
    misses: 0,
    totalProcessed: 0
  };

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): LayeredEmojiProcessor {
    if (!LayeredEmojiProcessor.instance) {
      LayeredEmojiProcessor.instance = new LayeredEmojiProcessor();
    }
    return LayeredEmojiProcessor.instance;
  }

  /**
   * 核心处理方法 - 仅使用Layer 1 (静态映射)
   * 用于对话列表等需要快速响应的场景
   */
  processWithLayer1Only(text: string): string {
    if (!text) {return text;}

    const emojiPattern = /\(([^)]+)\)/g;
    let processedText = text;
    let match;

    while ((match = emojiPattern.exec(text)) !== null) {
      const fullMatch = match[0]; // "(description)"
      const description = match[1]; // "description"
      
      if (description) {
        this.stats.totalProcessed++;
        
        // Layer 1: 静态映射表查找
        const emoji = getEmoji(description);
        if (emoji) {
          processedText = processedText.replace(fullMatch, emoji);
          this.stats.layer1Hits++;
        } else {
          // 保持原文，不做处理
          this.stats.misses++;
        }
      }
    }

    return processedText;
  }

  /**
   * 完整处理方法 - 使用Layer 1 + Layer 2
   * 用于消息详情页等可以接受稍慢响应的场景
   */
  async processWithBothLayers(text: string): Promise<string> {
    if (!text) {return text;}

    const emojiPattern = /\(([^)]+)\)/g;
    let processedText = text;
    const matches = Array.from(text.matchAll(emojiPattern));

    for (const match of matches) {
      const fullMatch = match[0]; // "(description)"
      const description = match[1]; // "description"
      
      if (description) {
        this.stats.totalProcessed++;
        
        // Layer 1: 静态映射表查找 (优先)
        let emoji = getEmoji(description);
        if (emoji) {
          processedText = processedText.replace(fullMatch, emoji);
          this.stats.layer1Hits++;
          continue;
        }

        // Layer 2: Unicode emoji库查找
        emoji = unicodeEmojiLibrary.findEmoji(description);
        if (emoji) {
          processedText = processedText.replace(fullMatch, emoji);
          this.stats.layer2Hits++;
          continue;
        }

        // 未找到匹配，保持原文
        this.stats.misses++;
      }
    }

    return processedText;
  }

  /**
   * 批量处理 - Layer 1 only
   * 用于处理对话列表等大量文本
   */
  batchProcessLayer1(texts: string[]): string[] {
    return texts.map(text => this.processWithLayer1Only(text));
  }

  /**
   * 批量处理 - Both Layers
   * 用于处理消息详情等
   */
  async batchProcessBothLayers(texts: string[]): Promise<string[]> {
    const promises = texts.map(text => this.processWithBothLayers(text));
    return Promise.all(promises);
  }

  /**
   * 检查文本是否包含emoji描述
   */
  hasEmojiDescriptions(text: string): boolean {
    if (!text) {return false;}
    return /\([^)]+\)/.test(text);
  }

  /**
   * 预测处理覆盖率 (Layer 1)
   */
  predictLayer1Coverage(texts: string[]): number {
    let totalDescriptions = 0;
    let coveredDescriptions = 0;

    texts.forEach(text => {
      const matches = text.match(/\(([^)]+)\)/g);
      if (matches) {
        matches.forEach(match => {
          const description = match.slice(1, -1); // 去掉括号
          totalDescriptions++;
          if (hasEmoji(description)) {
            coveredDescriptions++;
          }
        });
      }
    });

    return totalDescriptions > 0 ? (coveredDescriptions / totalDescriptions) * 100 : 100;
  }

  /**
   * 获取处理统计信息
   */
  getProcessingStats() {
    const total = this.stats.totalProcessed;
    return {
      ...this.stats,
      layer1CoverageRate: total > 0 ? `${(this.stats.layer1Hits / total * 100).toFixed(2)  }%` : '0%',
      layer2CoverageRate: total > 0 ? `${(this.stats.layer2Hits / total * 100).toFixed(2)  }%` : '0%',
      missRate: total > 0 ? `${(this.stats.misses / total * 100).toFixed(2)  }%` : '0%',
      totalCoverageRate: total > 0 ? `${((this.stats.layer1Hits + this.stats.layer2Hits) / total * 100).toFixed(2)  }%` : '0%'
    };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      layer1Hits: 0,
      layer2Hits: 0,
      misses: 0,
      totalProcessed: 0
    };
  }

  /**
   * 获取系统信息
   */
  getSystemInfo() {
    return {
      layer1EmojiCount: Object.keys(extendedEmojiMap).length,
      layer2Info: unicodeEmojiLibrary.getStats(),
      processingStats: this.getProcessingStats()
    };
  }
}

// 创建全局实例
export const layeredEmojiProcessor = LayeredEmojiProcessor.getInstance();

// 便捷函数导出
export const processEmojiLayer1 = (text: string): string => {
  return layeredEmojiProcessor.processWithLayer1Only(text);
};

export const processEmojiLayered = async (text: string): Promise<string> => {
  return layeredEmojiProcessor.processWithBothLayers(text);
};

export const batchProcessEmojiLayer1 = (texts: string[]): string[] => {
  return layeredEmojiProcessor.batchProcessLayer1(texts);
};

export const batchProcessEmojiLayered = async (texts: string[]): Promise<string[]> => {
  return layeredEmojiProcessor.batchProcessBothLayers(texts);
};

// 向后兼容的便捷函数
export const convertEmojiDescriptions = processEmojiLayer1;

// 场景化函数
export const convertEmojiForConversationList = processEmojiLayer1;

export const convertEmojiForMessageDetail = processEmojiLayered;

export const convertEmojiForBatch = batchProcessEmojiLayer1;