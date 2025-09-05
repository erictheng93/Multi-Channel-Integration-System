/**
 * Emoji数据收集脚本
 * 从多个数据源收集emoji映射，生成2000种静态映射表
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

class EmojiDataCollector {
  constructor() {
    this.emojiMap = new Map();
    this.stats = {
      github: 0,
      unicode: 0,
      custom: 0,
      duplicates: 0,
      total: 0
    };
  }

  /**
   * 从GitHub API收集emoji数据
   */
  async collectFromGitHub() {
    console.log('🔄 正在从GitHub API收集emoji数据...');
    
    try {
      const data = await this.fetchJson('https://api.github.com/emojis');
      let count = 0;
      
      for (const [shortname, url] of Object.entries(data)) {
        // 清理shortname格式，移除前后的冒号
        const cleanName = shortname.replace(/^:+|:+$/g, '');
        
        // 从URL提取Unicode码点或直接使用shortname
        const emoji = this.extractEmojiFromGitHubUrl(url) || this.shortNameToEmoji(cleanName);
        
        if (emoji && !this.emojiMap.has(cleanName)) {
          this.emojiMap.set(cleanName, emoji);
          count++;
        } else if (this.emojiMap.has(cleanName)) {
          this.stats.duplicates++;
        }
      }
      
      this.stats.github = count;
      console.log(`✅ GitHub API: 收集到 ${count} 个emoji`);
    } catch (error) {
      console.error('❌ GitHub API收集失败:', error.message);
      console.log('⚠️  继续使用其他数据源...');
    }
  }

  /**
   * 从GitHub URL提取emoji字符
   */
  extractEmojiFromGitHubUrl(url) {
    // GitHub emoji URL格式: https://github.githubassets.com/images/icons/emoji/unicode/1f600.png
    const unicodeMatch = url.match(/unicode\/([a-f0-9]+)\.png$/i);
    if (unicodeMatch) {
      const codePoint = unicodeMatch[1];
      try {
        // 处理单个或多个码点
        const codePoints = codePoint.match(/.{4}/g) || [codePoint];
        return codePoints.map(cp => String.fromCodePoint(parseInt(cp, 16))).join('');
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  /**
   * 添加核心静态映射（解决当前具体问题）
   */
  addCoreStaticMappings() {
    console.log('🔄 添加核心静态映射...');
    
    const coreMappings = {
      // 解决当前问题的映射
      'serious_moon': '🌚',
      'new_moon_face': '🌚',
      'laughing_hard': '😂',
      'rolling_on_floor_laughing': '🤣',
      'rofl': '🤣',
      
      // 表情类扩展
      'grinning_face': '😀',
      'grinning': '😀',
      'beaming_face_with_smiling_eyes': '😁',
      'face_with_tears_of_joy': '😂',
      'joy': '😂',
      'grinning_face_with_big_eyes': '😃',
      'grin': '😃',
      'grinning_face_with_smiling_eyes': '😄',
      'smile': '😄',
      'grinning_squinting_face': '😆',
      'laughing': '😆',
      'satisfied': '😆',
      'grinning_face_with_sweat': '😅',
      'sweat_smile': '😅',
      'rolling_on_the_floor_laughing': '🤣',
      'smiling_face_with_smiling_eyes': '😊',
      'blush': '😊',
      'smiling': '😊',
      'face_savoring_food': '😋',
      'yum': '😋',
      'relieved_face': '😌',
      'relieved': '😌',
      'smiling_face_with_heart_eyes': '😍',
      'heart_eyes': '😍',
      'face_blowing_a_kiss': '😘',
      'kissing_heart': '😘',
      'kissing_face': '😗',
      'kissing': '😗',
      'smiling_face': '☺️',
      'relaxed': '☺️',
      'kissing_face_with_smiling_eyes': '😙',
      'kissing_smiling_eyes': '😙',
      'kissing_face_with_closed_eyes': '😚',
      'kissing_closed_eyes': '😚',
      'winking_face': '😉',
      'wink': '😉',
      'squinting_face_with_tongue': '😝',
      'stuck_out_tongue_closed_eyes': '😝',
      'face_with_tongue': '😛',
      'stuck_out_tongue': '😛',
      'winking_face_with_tongue': '😜',
      'stuck_out_tongue_winking_eye': '😜',
      'zany_face': '🤪',
      'star_struck': '🤩',
      'money_mouth_face': '🤑',
      'hugging_face': '🤗',
      'hugs': '🤗',
      'face_with_hand_over_mouth': '🤭',
      'hand_over_mouth': '🤭',
      'shushing_face': '🤫',
      'thinking_face': '🤔',
      'thinking': '🤔',
      'zipper_mouth_face': '🤐',
      'face_with_raised_eyebrow': '🤨',
      'raised_eyebrow': '🤨',
      'neutral_face': '😐',
      'expressionless_face': '😑',
      'expressionless': '😑',
      'face_without_mouth': '😶',
      'no_mouth': '😶',
      'smirking_face': '😏',
      'smirk': '😏',
      'unamused_face': '😒',
      'unamused': '😒',
      'face_with_rolling_eyes': '🙄',
      'roll_eyes': '🙄',
      'grimacing_face': '😬',
      'grimacing': '😬',
      'lying_face': '🤥',
      'pleading_face': '🥺',
      'pleading': '🥺',
      
      // 月亮系列
      'new_moon': '🌑',
      'waxing_crescent_moon': '🌒',
      'first_quarter_moon': '🌓',
      'moon': '🌔',
      'waxing_gibbous_moon': '🌔',
      'full_moon': '🌕',
      'waning_gibbous_moon': '🌖',
      'last_quarter_moon': '🌗',
      'waning_crescent_moon': '🌘',
      'crescent_moon': '🌙',
      'new_moon_with_face': '🌚',
      'first_quarter_moon_with_face': '🌛',
      'last_quarter_moon_with_face': '🌜',
      'full_moon_with_face': '🌝',
      'sun_with_face': '🌞',
      
      // 手势类扩展
      'thumbs_up': '👍',
      'thumbsup': '👍',
      '+1': '👍',
      'thumbs_down': '👎',
      'thumbsdown': '👎',
      '-1': '👎',
      'clapping_hands': '👏',
      'clap': '👏',
      'open_hands': '👐',
      'raised_hands': '🙌',
      'palms_up_together': '🤲',
      'handshake': '🤝',
      'folded_hands': '🙏',
      'pray': '🙏',
      'writing_hand': '✍️',
      'nail_polish': '💅',
      'nail_care': '💅',
      'selfie': '🤳',
      'flexed_biceps': '💪',
      'muscle': '💪',
      'mechanical_arm': '🦾',
      'mechanical_leg': '🦿',
      'leg': '🦵',
      'foot': '🦶',
      'ear': '👂',
      'ear_with_hearing_aid': '🦻',
      'nose': '👃',
      'brain': '🧠',
      'anatomical_heart': '🫀',
      'lungs': '🫁',
      'tooth': '🦷',
      'bone': '🦴',
      'eyes': '👀',
      'eye': '👁️',
      'tongue': '👅',
      'mouth': '👄',
      'lips': '👄',
      
      // 指向类
      'index_pointing_up': '☝️',
      'point_up': '☝️',
      'backhand_index_pointing_up': '👆',
      'point_up_2': '👆',
      'middle_finger': '🖕',
      'backhand_index_pointing_down': '👇',
      'point_down': '👇',
      'index_pointing_at_the_viewer': '👈',
      'point_left': '👈',
      'backhand_index_pointing_right': '👉',
      'point_right': '👉',
      'index_pointing_right': '👉',
      'raised_hand': '✋',
      'raised_back_of_hand': '🤚',
      'raised_hand_with_fingers_splayed': '🖐️',
      'vulcan_salute': '🖖',
      'ok_hand': '👌',
      'okay': '👌',
      'pinched_fingers': '🤌',
      'pinching_hand': '🤏',
      'victory_hand': '✌️',
      'v': '✌️',
      'crossed_fingers': '🤞',
      'love_you_gesture': '🤟',
      'sign_of_the_horns': '🤘',
      'metal': '🤘',
      'call_me_hand': '🤙',
      
      // 拳头类
      'raised_fist': '✊',
      'fist': '✊',
      'fist_raised': '✊',
      'oncoming_fist': '👊',
      'fist_oncoming': '👊',
      'facepunch': '👊',
      'punch': '👊',
      'left_facing_fist': '🤛',
      'fist_left': '🤛',
      'right_facing_fist': '🤜',
      'fist_right': '🤜',
      
      // 心形类
      'red_heart': '❤️',
      'heart': '❤️',
      'orange_heart': '🧡',
      'yellow_heart': '💛',
      'green_heart': '💚',
      'blue_heart': '💙',
      'purple_heart': '💜',
      'brown_heart': '🤎',
      'black_heart': '🖤',
      'white_heart': '🤍',
      'broken_heart': '💔',
      'heart_exclamation': '❣️',
      'two_hearts': '💕',
      'revolving_hearts': '💞',
      'beating_heart': '💓',
      'growing_heart': '💗',
      'sparkling_heart': '💖',
      'cupid': '💘',
      'gift_heart': '💝',
      'heart_decoration': '💟',
      
      // 动物类常见
      'monkey_face': '🐵',
      'monkey': '🐒',
      'gorilla': '🦍',
      'orangutan': '🦧',
      'dog_face': '🐶',
      'dog': '🐕',
      'guide_dog': '🦮',
      'service_dog': '🐕‍🦺',
      'poodle': '🐩',
      'wolf': '🐺',
      'fox_face': '🦊',
      'fox': '🦊',
      'raccoon': '🦝',
      'cat_face': '🐱',
      'cat': '🐈',
      'black_cat': '🐈‍⬛',
      'lion': '🦁',
      'tiger_face': '🐯',
      'tiger': '🐅',
      'leopard': '🐆',
      'horse_face': '🐴',
      'horse': '🐎',
      'unicorn': '🦄',
      'zebra': '🦓',
      'deer': '🦌',
      'cow_face': '🐮',
      'ox': '🐂',
      'water_buffalo': '🐃',
      'cow': '🐄',
      'pig_face': '🐷',
      'pig': '🐖',
      'boar': '🐗',
      'pig_nose': '🐽',
      'ram': '🐏',
      'ewe': '🐑',
      'sheep': '🐑',
      'goat': '🐐',
      
      // 食物类
      'green_apple': '🍏',
      'apple': '🍎',
      'pear': '🍐',
      'tangerine': '🍊',
      'orange': '🍊',
      'lemon': '🍋',
      'banana': '🍌',
      'watermelon': '🍉',
      'grapes': '🍇',
      'strawberry': '🍓',
      'melon': '🍈',
      'cherries': '🍒',
      'peach': '🍑',
      'mango': '🥭',
      'pineapple': '🍍',
      'coconut': '🥥',
      'kiwi_fruit': '🥝',
      'tomato': '🍅',
      'eggplant': '🍆',
      'avocado': '🥑',
      'broccoli': '🥦',
      'leafy_greens': '🥬',
      'bell_pepper': '🫑',
      'cucumber': '🥒',
      'hot_pepper': '🌶️',
      'corn': '🌽',
      'carrot': '🥕',
      'olive': '🫒',
      'potato': '🥔',
      'sweet_potato': '🍠',
      'croissant': '🥐',
      'bread': '🍞',
      'baguette_bread': '🥖',
      'flatbread': '🫓',
      'pretzel': '🥨',
      'bagel': '🥯',
      'pancakes': '🥞',
      'waffle': '🧇',
      'cheese': '🧀',
      'meat_on_bone': '🍖',
      'poultry_leg': '🍗',
      'cut_of_meat': '🥩',
      'bacon': '🥓',
      'hamburger': '🍔',
      'fries': '🍟',
      'pizza': '🍕',
      'hotdog': '🌭',
      'sandwich': '🥪',
      'taco': '🌮',
      'burrito': '🌯',
      'tamale': '🫔',
      
      // 常用符号
      'fire': '🔥',
      'star': '⭐',
      'glowing_star': '🌟',
      'dizzy': '💫',
      'collision': '💥',
      'boom': '💥',
      'anger': '💢',
      'sweat_drops': '💦',
      'dashing_away': '💨',
      'dash': '💨',
      'zzz': '💤',
      'waving_hand': '👋',
      'wave': '👋',
      'raised_hand_with_fingers_splayed': '🖐️',
      'spock-hand': '🖖',
      'rock': '🤘',
      'call_me': '🤙',
      'muscle_tone1': '💪🏻',
      'muscle_tone2': '💪🏼',
      'muscle_tone3': '💪🏽',
      'muscle_tone4': '💪🏾',
      'muscle_tone5': '💪🏿'
    };

    let count = 0;
    for (const [key, value] of Object.entries(coreMappings)) {
      if (!this.emojiMap.has(key)) {
        this.emojiMap.set(key, value);
        count++;
      } else {
        this.stats.duplicates++;
      }
    }

    this.stats.custom = count;
    console.log(`✅ 核心映射: 添加了 ${count} 个emoji`);
  }

  /**
   * 添加常见变体和同义词
   */
  addCommonVariants() {
    console.log('🔄 添加常见变体和同义词...');
    
    const variants = new Map();
    let count = 0;
    
    // 为现有emoji添加常见变体
    for (const [key, emoji] of this.emojiMap.entries()) {
      const variantKeys = this.generateVariants(key);
      variantKeys.forEach(variantKey => {
        if (!this.emojiMap.has(variantKey) && !variants.has(variantKey)) {
          variants.set(variantKey, emoji);
          count++;
        }
      });
    }
    
    // 合并变体到主映射
    for (const [key, value] of variants.entries()) {
      this.emojiMap.set(key, value);
    }
    
    console.log(`✅ 变体映射: 添加了 ${count} 个变体`);
    return count;
  }

  /**
   * 生成emoji描述的变体
   */
  generateVariants(key) {
    const variants = [];
    
    // 基础变体
    variants.push(key.replace(/_/g, '')); // 去掉下划线
    variants.push(key.replace(/_/g, ' '));  // 下划线改空格
    variants.push(key.replace(/face$/, '')); // 去掉face后缀
    variants.push(key.replace(/^face_/, '')); // 去掉face前缀
    variants.push(key.replace(/ing$/, '')); // 去掉ing后缀
    variants.push(key.replace(/s$/, '')); // 去掉复数s
    variants.push(`${key}_face`); // 添加face后缀
    
    // 同义词映射
    const synonyms = {
      'happy': ['smile', 'joy', 'glad'],
      'sad': ['cry', 'tear', 'unhappy'],
      'angry': ['mad', 'rage', 'furious'],
      'laugh': ['lol', 'haha', 'giggle'],
      'love': ['heart', 'like', 'adore'],
      'strong': ['muscle', 'power', 'strength'],
      'moon': ['lunar', 'night'],
      'sun': ['sunny', 'bright'],
      'fire': ['flame', 'hot', 'burn'],
      'water': ['wet', 'liquid'],
      'food': ['eat', 'hungry', 'meal'],
      'animal': ['pet', 'creature']
    };
    
    // 添加同义词变体
    for (const [base, syns] of Object.entries(synonyms)) {
      if (key.includes(base)) {
        syns.forEach(syn => {
          variants.push(key.replace(base, syn));
        });
      }
      syns.forEach(syn => {
        if (key.includes(syn)) {
          variants.push(key.replace(syn, base));
        }
      });
    }
    
    return [...new Set(variants)].filter(v => v && v !== key);
  }

  /**
   * 简单的shortname到emoji转换
   */
  shortNameToEmoji(shortname) {
    // 这里可以添加一些基于shortname的emoji推断逻辑
    // 暂时返回null，依赖其他数据源
    return null;
  }

  /**
   * 发送HTTPS请求获取JSON数据
   */
  fetchJson(url) {
    return new Promise((resolve, reject) => {
      const request = https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (error) {
            reject(new Error('JSON解析失败: ' + error.message));
          }
        });
      });
      
      request.on('error', (error) => {
        reject(error);
      });
      
      request.setTimeout(10000, () => {
        request.destroy();
        reject(new Error('请求超时'));
      });
    });
  }

  /**
   * 生成最终的emoji映射文件
   */
  generateMappingFile(outputPath) {
    // 转换Map到普通对象并排序
    const sortedEntries = Array.from(this.emojiMap.entries()).sort(([a], [b]) => a.localeCompare(b));
    const finalMap = {};
    
    sortedEntries.forEach(([key, value]) => {
      finalMap[key] = value;
    });

    this.stats.total = sortedEntries.length;

    // 生成TypeScript文件内容
    const content = `/**
 * 扩展Emoji映射表 - 自动生成
 * 生成时间: ${new Date().toISOString()}
 * 数据统计: GitHub: ${this.stats.github}, 核心: ${this.stats.custom}, 变体: ${this.stats.total - this.stats.github - this.stats.custom}, 总计: ${this.stats.total}
 */

export const extendedEmojiMap: Record<string, string> = ${JSON.stringify(finalMap, null, 2)};

// 统计信息
export const emojiMapStats = {
  total: ${this.stats.total},
  sources: {
    github: ${this.stats.github},
    core: ${this.stats.custom},
    variants: ${this.stats.total - this.stats.github - this.stats.custom}
  },
  duplicatesSkipped: ${this.stats.duplicates},
  generatedAt: '${new Date().toISOString()}'
};
`;

    fs.writeFileSync(outputPath, content, 'utf8');
    
    // 同时生成一个简化的JSON版本用于调试
    const jsonPath = outputPath.replace('.ts', '.json');
    fs.writeFileSync(jsonPath, JSON.stringify({
      emojiMap: finalMap,
      stats: this.stats,
      generatedAt: new Date().toISOString()
    }, null, 2), 'utf8');

    return {
      mappingCount: this.stats.total,
      filePath: outputPath,
      stats: this.stats
    };
  }

  /**
   * 执行完整的收集流程
   */
  async collect(outputPath) {
    console.log('🚀 开始收集Emoji数据...\n');

    // 1. 添加核心静态映射
    this.addCoreStaticMappings();
    console.log('');

    // 2. 从GitHub API收集
    await this.collectFromGitHub();
    console.log('');

    // 3. 添加变体
    this.addCommonVariants();
    console.log('');

    // 4. 生成文件
    console.log('🔄 生成映射文件...');
    const result = this.generateMappingFile(outputPath);
    
    console.log('✅ 数据收集完成!');
    console.log(`📊 统计信息:`);
    console.log(`   - GitHub API: ${this.stats.github} 个`);
    console.log(`   - 核心映射: ${this.stats.custom} 个`);
    console.log(`   - 变体映射: ${this.stats.total - this.stats.github - this.stats.custom} 个`);
    console.log(`   - 跳过重复: ${this.stats.duplicates} 个`);
    console.log(`   - 总计: ${this.stats.total} 个`);
    console.log(`📁 输出文件: ${result.filePath}`);
    
    return result;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const collector = new EmojiDataCollector();
  const outputPath = path.join(__dirname, '..', 'frontend', 'src', 'utils', 'extended-emoji-map.ts');
  
  collector.collect(outputPath)
    .then((result) => {
      console.log(`\n🎉 成功生成 ${result.mappingCount} 个emoji映射!`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 收集过程出错:', error);
      process.exit(1);
    });
}

module.exports = EmojiDataCollector;