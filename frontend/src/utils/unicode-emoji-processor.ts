import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('unicodeemojiprocessor')
/**
 * Unicode Emoji 处理器
 * 使用Unicode标准数据和智能算法，无需预定义映射表
 */

/**
 * 方案1：使用Unicode CLDR 数据
 * Unicode Common Locale Data Repository 包含所有官方emoji的标准化名称
 */
export class UnicodeEmojiProcessor {
  private unicodeData: Map<string, string> = new Map();
  private initialized = false;

  /**
   * 动态加载Unicode CLDR数据
   */
  async initialize() {
    if (this.initialized) {return;}

    try {
      // 可以从CDN加载最新的Unicode emoji数据
      const response = await fetch('https://unicode.org/Public/emoji/15.1/emoji-test.txt');
      const data = await response.text();
      this.parseUnicodeData(data);
      this.initialized = true;
    } catch (error) {
      console.warn('无法加载Unicode数据，使用本地数据', error);
      this.initializeLocalData();
    }
  }

  /**
   * 解析Unicode emoji测试数据
   */
  private parseUnicodeData(data: string) {
    const lines = data.split('\n');
    
    for (const line of lines) {
      // 解析格式: 1F600 ; fully-qualified # 😀 E1.0 grinning face
      const match = line.match(/^([0-9A-F ]+)\s*;\s*fully-qualified\s*#\s*(\S+)\s.*?\s([^#]+)$/);
      if (match) {
        const [, , emoji, description] = match;
        if (description && emoji) {
          const cleanName = description.trim().toLowerCase().replace(/\s+/g, '_');
          this.unicodeData.set(cleanName, emoji);
          
          // 添加同义词
          this.addSynonyms(cleanName, emoji);
        }
      }
    }
  }

  /**
   * 添加常见同义词
   */
  private addSynonyms(name: string, emoji: string) {
    const synonymMap: Record<string, string[]> = {
      'grinning_face': ['grin', 'smile', 'happy'],
      'flexed_biceps': ['muscle', 'strong', 'strength'],
      'thumbs_up': ['thumbsup', '+1', 'like', 'good'],
      'pointing_right': ['index_pointing_right', 'point_right', 'right'],
      'ok_hand': ['okay', 'ok', 'alright'],
      'pleading_face': ['pleading', 'puppy_eyes', 'begging'],
    };

    const aliases = synonymMap[name];
    if (aliases) {
      aliases.forEach(alias => {
        if (alias) {
          this.unicodeData.set(alias, emoji);
        }
      });
    }
  }

  /**
   * 初始化本地数据（备用方案）
   */
  private initializeLocalData() {
    // 这里可以包含一些最基础的emoji数据作为后备
    const basicEmojis = [
      ['grinning_face', '😀'],
      ['flexed_biceps', '💪'],
      ['thumbs_up', '👍'],
      ['index_pointing_right', '👉'],
      ['ok_hand', '👌'],
      ['red_heart', '❤️'],
    ];

    basicEmojis.forEach(([name, emoji]) => {
      if (name && emoji) {
        this.unicodeData.set(name, emoji);
      }
    });

    this.initialized = true;
  }

  /**
   * 查找emoji
   */
  async findEmoji(description: string): Promise<string | null> {
    await this.initialize();
    
    const cleanDesc = description.toLowerCase().replace(/\s+/g, '_');
    return this.unicodeData.get(cleanDesc) || null;
  }
}

/**
 * 方案2：使用机器学习和相似度匹配
 */
export class SmartEmojiMatcher {
  /**
   * 计算两个字符串的相似度
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {return 1.0;}
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein距离算法
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      if (matrix[0]) {
        matrix[0][j] = j;
      }
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        const currentRow = matrix[i];
        const prevRow = matrix[i - 1];
        
        if (currentRow && prevRow) {
          if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
            currentRow[j] = prevRow[j - 1] || 0;
          } else {
            currentRow[j] = Math.min(
              (prevRow[j - 1] || 0) + 1,
              (currentRow[j - 1] || 0) + 1,
              (prevRow[j] || 0) + 1
            );
          }
        }
      }
    }
    
    const finalRow = matrix[str2.length];
    return finalRow?.[str1.length] || 0;
  }

  /**
   * 使用相似度匹配查找最佳emoji
   */
  findBestMatch(description: string, candidates: Array<[string, string]>): string | null {
    let bestMatch = null;
    let bestScore = 0;
    
    const cleanDesc = description.toLowerCase().replace(/\s+/g, '_');
    
    for (const [name, emoji] of candidates) {
      const score = this.calculateSimilarity(cleanDesc, name);
      if (score > bestScore && score > 0.7) { // 设置最低相似度阈值
        bestScore = score;
        bestMatch = emoji;
      }
    }
    
    return bestMatch;
  }
}

/**
 * 方案3：使用正则表达式和语义分析
 */
export class SemanticEmojiProcessor {
  private semanticRules: Array<[RegExp, string]> = [];

  constructor() {
    this.initializeRules();
  }

  /**
   * 初始化语义规则
   */
  private initializeRules() {
    this.semanticRules = [
      // 身体部位和动作
      [/\b(muscle|bicep|strong|strength|flex)\b/i, '💪'],
      [/\b(thumb.*up|like|good|approve)\b/i, '👍'],
      [/\b(thumb.*down|dislike|bad|disapprove)\b/i, '👎'],
      [/\b(point|finger|index).*right\b/i, '👉'],
      [/\b(point|finger|index).*left\b/i, '👈'],
      [/\b(point|finger|index).*up\b/i, '👆'],
      [/\b(point|finger|index).*down\b/i, '👇'],
      [/\b(ok|okay|alright|fine)\b.*hand/i, '👌'],
      [/\b(wave|hello|hi|goodbye)\b/i, '👋'],
      [/\b(clap|applaud|bravo)\b/i, '👏'],
      [/\b(pray|please|hope)\b/i, '🙏'],
      
      // 表情和情感
      [/\b(smile|happy|joy|glad)\b/i, '😊'],
      [/\b(grin|big.*smile)\b/i, '😁'],
      [/\b(laugh|lol|funny)\b/i, '😂'],
      [/\b(love|heart|adore)\b/i, '❤️'],
      [/\b(sad|cry|tears)\b/i, '😢'],
      [/\b(angry|mad|furious)\b/i, '😠'],
      [/\b(surprise|shock|wow)\b/i, '😲'],
      [/\b(think|consider|ponder)\b/i, '🤔'],
      [/\b(sleep|tired|zzz)\b/i, '😴'],
      [/\b(hungry|food|eat)\b/i, '😋'],
      [/\b(plead|beg|please)\b/i, '🥺'],
      
      // 自然和物品
      [/\b(fire|hot|burn)\b/i, '🔥'],
      [/\b(star|sparkle)\b/i, '⭐'],
      [/\b(sun|sunny|bright)\b/i, '☀️'],
      [/\b(moon|night)\b/i, '🌙'],
      [/\b(tree|forest|nature)\b/i, '🌳'],
      [/\b(flower|bloom)\b/i, '🌸'],
      [/\b(water|drop|rain)\b/i, '💧'],
      
      // 庆祝和活动
      [/\b(party|celebrate|festival)\b/i, '🎉'],
      [/\b(gift|present|surprise)\b/i, '🎁'],
      [/\b(birthday|cake)\b/i, '🎂'],
      [/\b(music|song|melody)\b/i, '🎵'],
    ];
  }

  /**
   * 使用语义规则处理描述
   */
  processDescription(description: string): string | null {
    for (const [pattern, emoji] of this.semanticRules) {
      if (pattern.test(description)) {
        return emoji;
      }
    }
    return null;
  }
}

/**
 * 方案4：集成多种方法的智能处理器
 */
export class AdvancedEmojiProcessor {
  private unicodeProcessor = new UnicodeEmojiProcessor();
  private semanticProcessor = new SemanticEmojiProcessor();
  private cache = new Map<string, string>();

  /**
   * 综合处理emoji描述
   */
  async processEmojiDescription(description: string): Promise<string> {
    // 检查缓存
    const cachedResult = this.cache.get(description);
    if (cachedResult) {
      return cachedResult;
    }

    let result = description;

    try {
      // 方法1：尝试Unicode标准查找
      const unicodeResult = await this.unicodeProcessor.findEmoji(description);
      if (unicodeResult) {
        result = unicodeResult;
      } else {
        // 方法2：尝试语义分析
        const semanticResult = this.semanticProcessor.processDescription(description);
        if (semanticResult) {
          result = semanticResult;
        } else {
          // 方法3：使用相似度匹配（需要候选数据）
          // 这里可以从Unicode数据中获取候选
          frontendLogger.debug(`无法处理emoji描述: ${description}`);
        }
      }

      // 缓存结果
      this.cache.set(description, result);
      
    } catch (error) {
      console.error('处理emoji描述时出错:', error);
    }

    return result;
  }

  /**
   * 处理完整消息
   */
  async processMessage(message: string): Promise<string> {
    const emojiPattern = /\(([^)]+)\)/g;
    const matches = Array.from(message.matchAll(emojiPattern));
    
    let processedMessage = message;
    
    for (const match of matches) {
      const fullMatch = match[0];
      const description = match[1];
      
      if (description) {
        const emoji = await this.processEmojiDescription(description);
        if (emoji !== description) {
          processedMessage = processedMessage.replace(fullMatch, emoji);
        }
      }
    }
    
    return processedMessage;
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache.clear();
  }
}

// 创建全局实例
export const advancedEmojiProcessor = new AdvancedEmojiProcessor();

/**
 * 便捷的消息处理函数
 */
export async function processAdvancedEmoji(message: string): Promise<string> {
  return advancedEmojiProcessor.processMessage(message);
}