/**
 * Emoji处理工具函数
 * 用于将emoji描述文字转换回实际的emoji字符
 */

// emoji描述到unicode字符的映射
const emojiMap: Record<string, string> = {
  // 表情类
  'grinning': '😀',
  'grin': '😃',
  'joy': '😂',
  'smile': '😄',
  'smiley': '😃',
  'laughing': '😆',
  'satisfied': '😆',
  'sweat_smile': '😅',
  'rofl': '🤣',
  'relaxed': '😊',
  'blush': '😊',
  'innocent': '😇',
  'slightly_smiling_face': '🙂',
  'upside_down_face': '🙃',
  'wink': '😉',
  'relieved': '😌',
  'heart_eyes': '😍',
  'smiling_face_with_three_hearts': '🥰',
  'kissing_heart': '😘',
  'kissing': '😗',
  'smiling': '😊',
  'kissing_smiling_eyes': '😙',
  'kissing_closed_eyes': '😚',
  'yum': '😋',
  'stuck_out_tongue': '😛',
  'stuck_out_tongue_winking_eye': '😜',
  'zany_face': '🤪',
  'stuck_out_tongue_closed_eyes': '😝',
  'money_mouth_face': '🤑',
  'hugs': '🤗',
  'hand_over_mouth': '🤭',
  'shushing_face': '🤫',
  'thinking': '🤔',
  'zipper_mouth_face': '🤐',
  'raised_eyebrow': '🤨',
  'neutral_face': '😐',
  'expressionless': '😑',
  'no_mouth': '😶',
  'smirk': '😏',
  'unamused': '😒',
  'roll_eyes': '🙄',
  'grimacing': '😬',
  'lying_face': '🤥',
  'pleading': '🥺',
  'pleading_face': '🥺',

  // 手势类
  'thumbsup': '👍',
  'thumbs_up': '👍',
  '+1': '👍',
  'thumbsdown': '👎',
  'thumbs_down': '👎',
  '-1': '👎',
  'clap': '👏',
  'raised_hands': '🙌',
  'open_hands': '👐',
  'palms_up_together': '🤲',
  'handshake': '🤝',
  'pray': '🙏',
  'writing_hand': '✍️',
  'nail_care': '💅',
  'selfie': '🤳',
  'muscle': '💪',
  'flexed_biceps': '💪',
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
  'lips': '👄',

  // 手指类
  'point_up': '☝️',
  'point_up_2': '👆',
  'point_down': '👇',
  'point_left': '👈',
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
  'v': '✌️',
  'crossed_fingers': '🤞',
  'love_you_gesture': '🤟',
  'metal': '🤘',
  'call_me_hand': '🤙',
  'backhand_index_pointing_left': '👈',
  'backhand_index_pointing_right': '👉',
  'backhand_index_pointing_up': '👆',
  'middle_finger': '🖕',
  'backhand_index_pointing_down': '👇',

  // 拳头类
  'fist': '✊',
  'fist_raised': '✊',
  'fist_oncoming': '👊',
  'facepunch': '👊',
  'punch': '👊',
  'fist_left': '🤛',
  'fist_right': '🤜',

  // 动物类
  'monkey_face': '🐵',
  'monkey': '🐒',
  'gorilla': '🦍',
  'orangutan': '🦧',
  'dog': '🐶',
  'dog2': '🐕',
  'guide_dog': '🦮',
  'service_dog': '🐕‍🦺',
  'poodle': '🐩',
  'wolf': '🐺',
  'fox_face': '🦊',
  'raccoon': '🦝',
  'cat': '🐱',
  'cat2': '🐈',
  'black_cat': '🐈‍⬛',
  'lion': '🦁',
  'tiger': '🐯',
  'tiger2': '🐅',
  'leopard': '🐆',
  'horse': '🐴',
  'racehorse': '🐎',
  'unicorn': '🦄',
  'zebra': '🦓',
  'deer': '🦌',
  'bison': '🦬',
  'cow': '🐮',
  'ox': '🐂',
  'water_buffalo': '🐃',
  'cow2': '🐄',
  'pig': '🐷',
  'pig2': '🐖',
  'boar': '🐗',
  'pig_nose': '🐽',
  'ram': '🐏',
  'sheep': '🐑',
  'goat': '🐐',
  'dromedary_camel': '🐪',
  'camel': '🐫',
  'llama': '🦙',
  'giraffe': '🦒',
  'elephant': '🐘',
  'mammoth': '🦣',
  'rhinoceros': '🦏',
  'hippopotamus': '🦛',
  'mouse': '🐭',
  'mouse2': '🐁',
  'rat': '🐀',
  'hamster': '🐹',
  'rabbit': '🐰',
  'rabbit2': '🐇',
  'chipmunk': '🐿️',
  'beaver': '🦫',
  'hedgehog': '🦔',
  'bat': '🦇',
  'bear': '🐻',
  'polar_bear': '🐻‍❄️',
  'koala': '🐨',
  'panda_face': '🐼',
  'sloth': '🦥',
  'otter': '🦦',
  'skunk': '🦨',
  'kangaroo': '🦘',
  'badger': '🦡',

  // 食物类
  'apple': '🍎',
  'green_apple': '🍏',
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

  // 活动类
  'soccer': '⚽',
  'basketball': '🏀',
  'football': '🏈',
  'baseball': '⚾',
  'softball': '🥎',
  'tennis': '🎾',
  'volleyball': '🏐',
  'rugby_football': '🏉',
  'flying_disc': '🥏',

  // 其他常见的
  'heart': '❤️',
  'broken_heart': '💔',
  'yellow_heart': '💛',
  'green_heart': '💚',
  'blue_heart': '💙',
  'purple_heart': '💜',
  'brown_heart': '🤎',
  'black_heart': '🖤',
  'white_heart': '🤍',
  'fire': '🔥',
  'star': '⭐',
  'dizzy': '💫',
  'boom': '💥',
  'collision': '💥',
  'anger': '💢',
  'sweat_drops': '💦',
  'dash': '💨',
  'zzz': '💤',
  'wave': '👋',

  // 饮食相关
  'hungry': '😋',
  'drooling_face': '🤤'
};

/**
 * 将emoji描述文字转换为实际emoji字符
 * @param text 包含emoji描述的文本
 * @returns 转换后的文本
 */
export function convertEmojiDescriptions(text: string): string {
  if (!text) {return text;}
  
  // 匹配括号内的emoji描述，如 (flexed biceps) 或 (grinning)
  const emojiDescriptionRegex = /\(([^)]+)\)/g;
  
  return text.replace(emojiDescriptionRegex, (match, description) => {
    // 清理描述文字：去掉多余空格，转小写，替换空格为下划线
    const cleanDescription = description.trim().toLowerCase().replace(/\s+/g, '_');
    
    // 在映射表中查找对应的emoji
    if (emojiMap[cleanDescription]) {
      return emojiMap[cleanDescription];
    }
    
    // 尝试一些常见的变体
    const alternatives = [
      cleanDescription.replace(/_/g, ''), // 去掉下划线
      cleanDescription.replace(/face$/, ''), // 去掉末尾的face
      cleanDescription.replace(/^face_/, ''), // 去掉开头的face_
      cleanDescription.replace(/ing$/, ''), // 去掉ing后缀
      `${cleanDescription  }_face`, // 添加_face后缀
    ];
    
    for (const alt of alternatives) {
      if (emojiMap[alt]) {
        return emojiMap[alt];
      }
    }
    
    // 如果找不到匹配的emoji，返回原文
    console.warn(`未找到emoji映射: ${description} (${cleanDescription})`);
    return match;
  });
}

/**
 * 检查文本是否包含emoji描述
 * @param text 要检查的文本
 * @returns 是否包含emoji描述
 */
export function hasEmojiDescriptions(text: string): boolean {
  if (!text) {return false;}
  return /\([^)]+\)/.test(text);
}

/**
 * 提取文本中的所有emoji描述
 * @param text 要提取的文本
 * @returns emoji描述数组
 */
export function extractEmojiDescriptions(text: string): string[] {
  if (!text) {return [];}
  
  const matches = text.match(/\(([^)]+)\)/g);
  return matches ? matches.map(match => match.slice(1, -1)) : [];
}

/**
 * 添加新的emoji映射
 * @param description emoji描述
 * @param emoji emoji字符
 */
export function addEmojiMapping(description: string, emoji: string): void {
  const cleanDescription = description.trim().toLowerCase().replace(/\s+/g, '_');
  emojiMap[cleanDescription] = emoji;
}

/**
 * 获取所有可用的emoji映射
 * @returns emoji映射对象的副本
 */
export function getAllEmojiMappings(): Record<string, string> {
  return { ...emojiMap };
}