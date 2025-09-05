/**
 * 扩展Emoji映射到2000种
 * 添加更多数据源和手动精选的emoji映射
 */

const fs = require('fs');
const path = require('path');

class EmojiMappingExpander {
  constructor() {
    this.emojiMap = new Map();
    this.stats = {
      existing: 0,
      unicode: 0,
      manual: 0,
      total: 0
    };
  }

  /**
   * 加载现有的映射
   */
  loadExistingMappings() {
    console.log('🔄 加载现有emoji映射...');
    
    try {
      const filePath = path.join(__dirname, '..', 'frontend', 'src', 'utils', 'extended-emoji-map.json');
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        for (const [key, value] of Object.entries(data.emojiMap)) {
          this.emojiMap.set(key, value);
        }
        
        this.stats.existing = this.emojiMap.size;
        console.log(`✅ 加载了 ${this.stats.existing} 个现有映射`);
      }
    } catch (error) {
      console.warn('⚠️  无法加载现有映射，从头开始:', error.message);
    }
  }

  /**
   * 添加完整的Unicode emoji映射
   */
  addUnicodeEmojiMappings() {
    console.log('🔄 添加Unicode emoji映射...');
    
    const unicodeMappings = {
      // 表情符号扩展 (U+1F600–U+1F64F)
      '100': '💯',
      '1234': '🔢',
      'ab': '🆎',
      'abcd': '🔡',
      'accept': '🉑',
      'aerial_tramway': '🚡',
      'airplane': '✈️',
      'alarm_clock': '⏰',
      'alien': '👽',
      'ambulance': '🚑',
      'anchor': '⚓',
      'angel': '👼',
      'angry': '😠',
      'anguished': '😧',
      'ant': '🐜',
      'apple': '🍎',
      'aquarius': '♒',
      'aries': '♈',
      'arrow_backward': '◀️',
      'arrow_double_down': '⏬',
      'arrow_double_up': '⏫',
      'arrow_down': '⬇️',
      'arrow_down_small': '🔽',
      'arrow_forward': '▶️',
      'arrow_heading_down': '⤵️',
      'arrow_heading_up': '⤴️',
      'arrow_left': '⬅️',
      'arrow_lower_left': '↙️',
      'arrow_lower_right': '↘️',
      'arrow_right': '➡️',
      'arrow_right_hook': '↪️',
      'arrow_up': '⬆️',
      'arrow_up_down': '↕️',
      'arrow_up_small': '🔼',
      'arrow_upper_left': '↖️',
      'arrow_upper_right': '↗️',
      'arrows_clockwise': '🔃',
      'arrows_counterclockwise': '🔄',
      'art': '🎨',
      'articulated_lorry': '🚛',
      'astonished': '😲',
      'atm': '🏧',
      'atom_symbol': '⚛️',
      
      // 动物和自然 (U+1F400–U+1F4FF)
      'badminton': '🏸',
      'balloon': '🎈',
      'ballot_box': '🗳️',
      'bamboo': '🎍',
      'banana': '🍌',
      'bangbang': '‼️',
      'bank': '🏦',
      'bar_chart': '📊',
      'barber': '💈',
      'baseball': '⚾',
      'basketball': '🏀',
      'bath': '🛁',
      'bathtub': '🛁',
      'battery': '🔋',
      'beach_umbrella': '🏖️',
      'bear': '🐻',
      'bed': '🛏️',
      'bee': '🐝',
      'beer': '🍺',
      'beers': '🍻',
      'beetle': '🪲',
      'beginner': '🔰',
      'bell': '🔔',
      'bento': '🍱',
      'bicyclist': '🚴',
      'bike': '🚲',
      'bikini': '👙',
      'bird': '🐦',
      'birthday': '🎂',
      'black_circle': '⚫',
      'black_flag': '🏴',
      'black_heart': '🖤',
      'black_joker': '🃏',
      'black_large_square': '⬛',
      'black_medium_small_square': '◾',
      'black_medium_square': '◼️',
      'black_nib': '✒️',
      'black_small_square': '▪️',
      'black_square_button': '🔲',
      'blossom': '🌼',
      'blowfish': '🐡',
      'blue_book': '📘',
      'blue_car': '🚙',
      'blue_heart': '💙',
      'boar': '🐗',
      'boat': '⛵',
      'bomb': '💣',
      'book': '📖',
      'bookmark': '🔖',
      'bookmark_tabs': '📑',
      'books': '📚',
      'boom': '💥',
      'boot': '👢',
      'bouquet': '💐',
      'bow': '🙇',
      'bow_and_arrow': '🏹',
      'bowling': '🎳',
      'box': '📦',
      'boy': '👦',
      'bread': '🍞',
      'bridge_at_night': '🌉',
      'briefcase': '💼',
      'broken_heart': '💔',
      'bug': '🐛',
      'building_construction': '🏗️',
      'bulb': '💡',
      'bus': '🚌',
      'busstop': '🚏',
      'bust_in_silhouette': '👤',
      'busts_in_silhouette': '👥',
      'butterfly': '🦋',
      'cactus': '🌵',
      'cake': '🍰',
      'calendar': '📅',
      'calling': '📲',
      'camel': '🐫',
      'camera': '📷',
      'camera_flash': '📸',
      'camping': '🏕️',
      'cancer': '♋',
      'candle': '🕯️',
      'candy': '🍬',
      'capital_abcd': '🔠',
      'capricorn': '♑',
      'car': '🚗',
      'card_file_box': '🗃️',
      'card_index': '📇',
      'card_index_dividers': '🗂️',
      'carousel_horse': '🎠',
      'carrot': '🥕',
      'cat': '🐱',
      'cat2': '🐈',
      'cd': '💿',
      'chains': '⛓️',
      'champagne': '🍾',
      'chart': '💹',
      'chart_with_downwards_trend': '📉',
      'chart_with_upwards_trend': '📈',
      'checkered_flag': '🏁',
      'cheese': '🧀',
      'cherries': '🍒',
      'cherry_blossom': '🌸',
      'chestnut': '🌰',
      'chicken': '🐔',
      'children_crossing': '🚸',
      'chipmunk': '🐿️',
      'chocolate_bar': '🍫',
      'christmas_tree': '🎄',
      'church': '⛪',
      'cinema': '🎦',
      'circus_tent': '🎪',
      'city_sunrise': '🌇',
      'city_sunset': '🌆',
      'cl': '🆑',
      'clamp': '🗜️',
      'clap': '👏',
      'clapper': '🎬',
      'classical_building': '🏛️',
      'climbing': '🧗',
      'climbing_man': '🧗‍♂️',
      'climbing_woman': '🧗‍♀️',
      'clock1': '🕐',
      'clock10': '🕙',
      'clock1030': '🕥',
      'clock11': '🕚',
      'clock1130': '🕦',
      'clock12': '🕛',
      'clock1230': '🕧',
      'clock130': '🕜',
      'clock2': '🕑',
      'clock230': '🕝',
      'clock3': '🕒',
      'clock330': '🕞',
      'clock4': '🕓',
      'clock430': '🕟',
      'clock5': '🕔',
      'clock530': '🕠',
      'clock6': '🕕',
      'clock630': '🕡',
      'clock7': '🕖',
      'clock730': '🕢',
      'clock8': '🕗',
      'clock830': '🕣',
      'clock9': '🕘',
      'clock930': '🕤',
      'closed_book': '📕',
      'closed_lock_with_key': '🔐',
      'closed_umbrella': '🌂',
      'cloud': '☁️',
      'cloud_with_lightning': '🌩️',
      'cloud_with_lightning_and_rain': '⛈️',
      'cloud_with_rain': '🌧️',
      'cloud_with_snow': '🌨️',
      'clown_face': '🤡',
      'clubs': '♣️',
      'cocktail': '🍸',
      'coffee': '☕',
      'coffin': '⚰️',
      'cold_sweat': '😰',
      'collision': '💥',
      'comet': '☄️',
      'computer': '💻',
      'computer_mouse': '🖱️',
      'confetti_ball': '🎊',
      'confounded': '😖',
      'confused': '😕',
      'congratulations': '㊗️',
      'construction': '🚧',
      'construction_worker': '👷',
      'control_knobs': '🎛️',
      'convenience_store': '🏪',
      'cookie': '🍪',
      'cool': '🆒',
      'cop': '👮',
      'copyright': '©️',
      'corn': '🌽',
      'couch_and_lamp': '🛋️',
      'couple': '👫',
      'couple_with_heart': '💑',
      'couplekiss': '💏',
      'cow': '🐮',
      'cow2': '🐄',
      'cowboy_hat_face': '🤠',
      'crab': '🦀',
      'credit_card': '💳',
      'crescent_moon': '🌙',
      'cricket': '🏏',
      'crocodile': '🐊',
      'croissant': '🥐',
      'crossed_flags': '🎌',
      'crossed_fingers': '🤞',
      'crossed_swords': '⚔️',
      'crown': '👑',
      'cry': '😢',
      'crying_cat_face': '😿',
      'crystal_ball': '🔮',
      'cucumber': '🥒',
      'cupid': '💘',
      'curly_loop': '➰',
      'currency_exchange': '💱',
      'curry': '🍛',
      'custard': '🍮',
      'customs': '🛃',
      'cyclone': '🌀',
      'dagger': '🗡️',
      'dancer': '💃',
      'dancing_men': '👯‍♂️',
      'dancing_women': '👯',
      'dango': '🍡',
      'dark_sunglasses': '🕶️',
      'dart': '🎯',
      'dash': '💨',
      'date': '📅',
      'deciduous_tree': '🌳',
      'deer': '🦌',
      'department_store': '🏬',
      'derelict_house': '🏚️',
      'desert': '🏜️',
      'desert_island': '🏝️',
      'desktop_computer': '🖥️',
      'detective': '🕵️',
      'diamond_shape_with_a_dot_inside': '💠',
      'diamonds': '♦️',
      'disappointed': '😞',
      'disappointed_relieved': '😥',
      'dizzy': '💫',
      'dizzy_face': '😵',
      'do_not_litter': '🚯',
      'dog': '🐶',
      'dog2': '🐕',
      'dollar': '💲',
      'dolls': '🎎',
      'dolphin': '🐬',
      'door': '🚪',
      'dove': '🕊️',
      'dragon': '🐉',
      'dragon_face': '🐲',
      'dress': '👗',
      'dromedary_camel': '🐪',
      'drooling_face': '🤤',
      'droplet': '💧',
      'drum': '🥁',
      'duck': '🦆',
      'dvd': '📀',
      'e-mail': '📧',
      'eagle': '🦅',
      'ear': '👂',
      'ear_of_rice': '🌾',
      'earth_africa': '🌍',
      'earth_americas': '🌎',
      'earth_asia': '🌏',
      'egg': '🥚',
      'eggplant': '🍆',
      'eight': '8️⃣',
      'eight_pointed_black_star': '✴️',
      'eight_spoked_asterisk': '✳️',
      'electric_plug': '🔌',
      'elephant': '🐘',
      'email': '✉️',
      'end': '🔚',
      'envelope': '✉️',
      'envelope_with_arrow': '📩',
      'euro': '💶',
      'european_castle': '🏰',
      'european_post_office': '🏤',
      'evergreen_tree': '🌲',
      'exclamation': '❗',
      'expressionless': '😑',
      'eye': '👁️',
      'eye_speech_bubble': '👁️‍🗨️',
      'eyeglasses': '👓',
      'eyes': '👀',
      'face_with_head_bandage': '🤕',
      'face_with_thermometer': '🤒',
      'facepalm': '🤦',
      'factory': '🏭',
      'fallen_leaf': '🍂',
      'family': '👪',
      'fast_forward': '⏩',
      'fax': '📠',
      'fearful': '😨',
      'feet': '👣',
      'female_detective': '🕵️‍♀️',
      'ferris_wheel': '🎡',
      'ferry': '⛴️',
      'field_hockey': '🏑',
      'file_cabinet': '🗄️',
      'file_folder': '📁',
      'film_projector': '📽️',
      'film_strip': '🎞️',
      'fire': '🔥',
      'fire_engine': '🚒',
      'fireworks': '🎆',
      'first_quarter_moon': '🌓',
      'first_quarter_moon_with_face': '🌛',
      'fish': '🐟',
      'fish_cake': '🍥',
      'fishing_pole_and_fish': '🎣',
      'fist_raised': '✊',
      'five': '5️⃣',
      'flags': '🎏',
      'flashlight': '🔦',
      'fleur_de_lis': '⚜️',
      'flipper': '🐬',
      'floppy_disk': '💾',
      'flower_playing_cards': '🎴',
      'flushed': '😳',
      'fog': '🌫️',
      'foggy': '🌁',
      'football': '🏈',
      'footprints': '👣',
      'fork_and_knife': '🍴',
      'fountain': '⛲',
      'fountain_pen': '🖋️',
      'four': '4️⃣',
      'four_leaf_clover': '🍀',
      'fox_face': '🦊',
      'framed_picture': '🖼️',
      'free': '🆓',
      'fried_egg': '🍳',
      'fried_shrimp': '🍤',
      'fries': '🍟',
      'frog': '🐸',
      'frowning': '😦',
      'frowning_face': '☹️',
      'frowning_man': '🙍‍♂️',
      'frowning_woman': '🙍',
      'fu': '🖕',
      'fuelpump': '⛽',
      'full_moon': '🌕',
      'full_moon_with_face': '🌝',
      'funeral_urn': '⚱️',
      'game_die': '🎲',
      'gear': '⚙️',
      'gem': '💎',
      'gemini': '♊',
      'ghost': '👻',
      'gift': '🎁',
      'gift_heart': '💝',
      'giraffe': '🦒',
      'girl': '👧',
      'globe_with_meridians': '🌐',
      'gloves': '🧤',
      'goat': '🐐',
      'goberserk': '😤',
      'godmode': '😤',
      'golf': '⛳',
      'golfer': '🏌️',
      'gorilla': '🦍',
      'grapes': '🍇',
      'green_apple': '🍏',
      'green_book': '📗',
      'green_heart': '💚',
      'green_salad': '🥗',
      'grey_exclamation': '❕',
      'grey_question': '❔',
      'grimacing': '😬',
      'grin': '😁',
      'grinning': '😀',
      'guardsman': '💂',
      'guitar': '🎸',
      'gun': '🔫',
      'haircut': '💇',
      'hamburger': '🍔',
      'hammer': '🔨',
      'hammer_and_pick': '⚒️',
      'hammer_and_wrench': '🛠️',
      'hamster': '🐹',
      'hand': '✋',
      'handbag': '👜',
      'handshake': '🤝',
      'hankey': '💩',
      'hatched_chick': '🐥',
      'hatching_chick': '🐣',
      'headphones': '🎧',
      'hear_no_evil': '🙉',
      'heart': '❤️',
      'heart_decoration': '💟',
      'heart_eyes': '😍',
      'heart_eyes_cat': '😻',
      'heartbeat': '💓',
      'heartpulse': '💗',
      'hearts': '♥️',
      'heavy_check_mark': '✔️',
      'heavy_division_sign': '➗',
      'heavy_dollar_sign': '💲',
      'heavy_heart_exclamation': '❣️',
      'heavy_minus_sign': '➖',
      'heavy_multiplication_x': '✖️',
      'heavy_plus_sign': '➕',
      'helicopter': '🚁',
      'herb': '🌿',
      'hibiscus': '🌺',
      'high_brightness': '🔆',
      'high_heel': '👠',
      'hocho': '🔪',
      'hole': '🕳️',
      'honey_pot': '🍯',
      'honeybee': '🐝',
      'horse': '🐴',
      'horse_racing': '🏇',
      'hospital': '🏥',
      'hot_pepper': '🌶️',
      'hotdog': '🌭',
      'hotel': '🏨',
      'hotsprings': '♨️',
      'hourglass': '⌛',
      'hourglass_flowing_sand': '⏳',
      'house': '🏠',
      'house_with_garden': '🏡',
      'houses': '🏘️',
      'hugs': '🤗',
      'hushed': '😯',
      'ice_cream': '🍨',
      'ice_hockey': '🏒',
      'ice_skate': '⛸️',
      'icecream': '🍦',
      'id': '🆔',
      'ideograph_advantage': '🉐',
      'imp': '👿',
      'inbox_tray': '📥',
      'incoming_envelope': '📨',
      'information_desk_person': '💁',
      'information_source': 'ℹ️',
      'innocent': '😇',
      'interrobang': '⁉️',
      'iphone': '📱',
      'it': '🇮🇹',
      'izakaya_lantern': '🏮',
      'jack_o_lantern': '🎃',
      'japan': '🗾',
      'japanese_castle': '🏯',
      'japanese_goblin': '👺',
      'japanese_ogre': '👹',
      'jeans': '👖',
      'joy': '😂',
      'joy_cat': '😹',
      'joystick': '🕹️',
      'kaaba': '🕋',
      'key': '🔑',
      'keyboard': '⌨️',
      'keycap_ten': '🔟',
      'kick_scooter': '🛴',
      'kimono': '👘',
      'kiss': '💋',
      'kissing': '😗',
      'kissing_cat': '😽',
      'kissing_closed_eyes': '😚',
      'kissing_heart': '😘',
      'kissing_smiling_eyes': '😙',
      'kiwi_fruit': '🥝',
      'koala': '🐨',
      'koko': '🈁',
      'label': '🏷️',
      'large_blue_circle': '🔵',
      'large_blue_diamond': '🔷',
      'large_orange_diamond': '🔶',
      'last_quarter_moon': '🌗',
      'last_quarter_moon_with_face': '🌜',
      'latin_cross': '✝️',
      'laughing': '😆',
      'leaves': '🍃',
      'ledger': '📒',
      'left_luggage': '🛅',
      'left_right_arrow': '↔️',
      'leftwards_arrow_with_hook': '↩️',
      'lemon': '🍋',
      'leo': '♌',
      'leopard': '🐆',
      'level_slider': '🎚️',
      'libra': '♎',
      'light_rail': '🚈',
      'link': '🔗',
      'lion': '🦁',
      'lips': '👄',
      'lipstick': '💄',
      'lizard': '🦎',
      'lock': '🔒',
      'lock_with_ink_pen': '🔏',
      'lollipop': '🍭',
      'loop': '➿',
      'loud_sound': '🔊',
      'loudspeaker': '📢',
      'love_hotel': '🏩',
      'love_letter': '💌',
      'low_brightness': '🔅',
      'lying_face': '🤥',
      'm': 'Ⓜ️',
      'mag': '🔍',
      'mag_right': '🔎',
      'mahjong': '🀄',
      'mailbox': '📫',
      'mailbox_closed': '📪',
      'mailbox_with_mail': '📬',
      'mailbox_with_no_mail': '📭',
      'male_detective': '🕵️',
      'man': '👨',
      'man_artist': '👨‍🎨',
      'man_astronaut': '👨‍🚀',
      'man_cartwheeling': '🤸‍♂️',
      'man_cook': '👨‍🍳',
      'man_dancing': '🕺',
      'man_facepalming': '🤦‍♂️',
      'man_factory_worker': '👨‍🏭',
      'man_farmer': '👨‍🌾',
      'man_firefighter': '👨‍🚒',
      'man_health_worker': '👨‍⚕️',
      'man_in_tuxedo': '🤵',
      'man_judge': '👨‍⚖️',
      'man_juggling': '🤹‍♂️',
      'man_mechanic': '👨‍🔧',
      'man_office_worker': '👨‍💼',
      'man_pilot': '👨‍✈️',
      'man_playing_handball': '🤾‍♂️',
      'man_playing_water_polo': '🤽‍♂️',
      'man_scientist': '👨‍🔬',
      'man_shrugging': '🤷‍♂️',
      'man_singer': '👨‍🎤',
      'man_student': '👨‍🎓',
      'man_teacher': '👨‍🏫',
      'man_technologist': '👨‍💻',
      'man_with_gua_pi_mao': '👲',
      'man_with_turban': '👳',
      'tangerine': '🍊',
      'taxi': '🚕',
      'tea': '🍵',
      'telephone': '☎️',
      'telephone_receiver': '📞',
      'telescope': '🔭',
      'tennis': '🎾',
      'tent': '⛺',
      'thermometer': '🌡️',
      'thinking': '🤔',
      'thought_balloon': '💭',
      'three': '3️⃣',
      'thumbsdown': '👎',
      'thumbsup': '👍',
      'ticket': '🎫',
      'tiger': '🐯',
      'tiger2': '🐅',
      'timer_clock': '⏲️',
      'tired_face': '😫',
      'tm': '™️',
      'toilet': '🚽',
      'tokyo_tower': '🗼',
      'tomato': '🍅',
      'tongue': '👅',
      'top': '🔝',
      'tophat': '🎩',
      'tornado': '🌪️',
      'trackball': '🖲️',
      'tractor': '🚜',
      'traffic_light': '🚥',
      'train': '🚋',
      'train2': '🚆',
      'tram': '🚊',
      'triangular_flag_on_post': '🚩',
      'triangular_ruler': '📐',
      'trident': '🔱',
      'triumph': '😤',
      'trolleybus': '🚎',
      'trophy': '🏆',
      'tropical_drink': '🍹',
      'tropical_fish': '🐠',
      'truck': '🚚',
      'trumpet': '🎺',
      'tulip': '🌷',
      'turkey': '🦃',
      'turtle': '🐢',
      'tv': '📺',
      'twisted_rightwards_arrows': '🔀',
      'two': '2️⃣',
      'two_hearts': '💕',
      'two_men_holding_hands': '👬',
      'two_women_holding_hands': '👭',
      'u5272': '🈹',
      'u5408': '🈴',
      'u55b6': '🈺',
      'u6307': '🈯',
      'u6708': '🈷️',
      'u6709': '🈶',
      'u6e80': '🈵',
      'u7121': '🈚',
      'u7533': '🈸',
      'u7981': '🈲',
      'u7a7a': '🈳',
      'umbrella': '☂️',
      'umbrella_on_ground': '⛱️',
      'unamused': '😒',
      'underage': '🔞',
      'unicorn': '🦄',
      'unlock': '🔓',
      'up': '🆙',
      'upside_down_face': '🙃',
      'v': '✌️',
      'vertical_traffic_light': '🚦',
      'vhs': '📼',
      'vibration_mode': '📳',
      'video_camera': '📹',
      'video_game': '🎮',
      'violin': '🎻',
      'virgo': '♍',
      'volcano': '🌋',
      'volleyball': '🏐',
      'vs': '🆚',
      'vulcan_salute': '🖖',
      'walking': '🚶',
      'waning_crescent_moon': '🌘',
      'waning_gibbous_moon': '🌖',
      'warning': '⚠️',
      'wastebasket': '🗑️',
      'watch': '⌚',
      'water_buffalo': '🐃',
      'watermelon': '🍉',
      'wave': '👋',
      'wavy_dash': '〰️',
      'waxing_crescent_moon': '🌒',
      'waxing_gibbous_moon': '🌔',
      'wc': '🚾',
      'weary': '😩',
      'wedding': '💒',
      'weight_lifting_man': '🏋️‍♂️',
      'weight_lifting_woman': '🏋️‍♀️',
      'whale': '🐳',
      'whale2': '🐋',
      'wheel_of_dharma': '☸️',
      'wheelchair': '♿',
      'white_check_mark': '✅',
      'white_circle': '⚪',
      'white_flag': '🏳️',
      'white_flower': '💮',
      'white_large_square': '⬜',
      'white_medium_small_square': '◽',
      'white_medium_square': '◻️',
      'white_small_square': '▫️',
      'white_square_button': '🔳',
      'wilted_flower': '🥀',
      'wind_chime': '🎐',
      'wine_glass': '🍷',
      'wink': '😉',
      'wolf': '🐺',
      'woman': '👩',
      'woman_artist': '👩‍🎨',
      'woman_astronaut': '👩‍🚀',
      'woman_cartwheeling': '🤸‍♀️',
      'woman_cook': '👩‍🍳',
      'woman_facepalming': '🤦‍♀️',
      'woman_factory_worker': '👩‍🏭',
      'woman_farmer': '👩‍🌾',
      'woman_firefighter': '👩‍🚒',
      'woman_health_worker': '👩‍⚕️',
      'woman_judge': '👩‍⚖️',
      'woman_juggling': '🤹‍♀️',
      'woman_mechanic': '👩‍🔧',
      'woman_office_worker': '👩‍💼',
      'woman_pilot': '👩‍✈️',
      'woman_playing_handball': '🤾‍♀️',
      'woman_playing_water_polo': '🤽‍♀️',
      'woman_scientist': '👩‍🔬',
      'woman_shrugging': '🤷‍♀️',
      'woman_singer': '👩‍🎤',
      'woman_student': '👩‍🎓',
      'woman_teacher': '👩‍🏫',
      'woman_technologist': '👩‍💻',
      'woman_with_turban': '👳‍♀️',
      'womans_clothes': '👚',
      'womans_hat': '👒',
      'womens': '🚺',
      'world_map': '🗺️',
      'worried': '😟',
      'wrench': '🔧',
      'writing_hand': '✍️',
      'x': '❌',
      'yellow_heart': '💛',
      'yen': '💴',
      'yin_yang': '☯️',
      'yum': '😋',
      'zany_face': '🤪',
      'zap': '⚡',
      'zebra': '🦓',
      'zero': '0️⃣',
      'zipper_mouth_face': '🤐',
      'zombie': '🧟',
      'zombie_man': '🧟‍♂️',
      'zombie_woman': '🧟‍♀️',
      'zzz': '💤'
    };

    let count = 0;
    for (const [key, value] of Object.entries(unicodeMappings)) {
      if (!this.emojiMap.has(key)) {
        this.emojiMap.set(key, value);
        count++;
      }
    }

    this.stats.unicode = count;
    console.log(`✅ Unicode映射: 添加了 ${count} 个emoji`);
  }

  /**
   * 添加手动精选的额外映射
   */
  addManualMappings() {
    console.log('🔄 添加手动精选映射...');
    
    const manualMappings = {
      // 解决用户具体问题
      'serious_moon': '🌚',
      'new_moon_face': '🌚',
      'laughing_hard': '😂',
      'crying_with_laughter': '😂',
      'laugh_hard': '😂',
      'hard_laugh': '😂',
      'lol': '😂',
      'rofl': '🤣',
      'rolling_laugh': '🤣',
      'lmao': '🤣',
      
      // 常见缺失的描述
      'smiling_face': '😊',
      'happy_face': '😊',
      'sad_face': '😢',
      'crying_face': '😢',
      'angry_face': '😠',
      'mad_face': '😠',
      'surprised_face': '😮',
      'shocked_face': '😲',
      'confused_face': '😕',
      'worried_face': '😟',
      'scared_face': '😨',
      'nervous_face': '😬',
      'embarrassed_face': '😳',
      'sleepy_face': '😴',
      'tired_face': '😫',
      'sick_face': '🤒',
      'hurt_face': '🤕',
      'crazy_face': '🤪',
      'cool_face': '😎',
      'nerd_face': '🤓',
      
      // 月亮系列扩展
      'dark_moon': '🌚',
      'creepy_moon': '🌚',
      'smug_moon': '🌚',
      'night_moon': '🌚',
      'black_moon': '🌚',
      'evil_moon': '🌚',
      'bright_moon': '🌝',
      'happy_moon': '🌝',
      'full_bright_moon': '🌝',
      'sunny_moon': '🌝',
      
      // 手势扩展
      'strong_arm': '💪',
      'flex': '💪',
      'strength': '💪',
      'power': '💪',
      'bicep': '💪',
      'workout': '💪',
      'gym': '💪',
      'exercise': '💪',
      
      'good_job': '👍',
      'nice': '👍',
      'awesome': '👍',
      'great': '👍',
      'excellent': '👍',
      'perfect': '👍',
      'well_done': '👍',
      
      'bad_job': '👎',
      'not_good': '👎',
      'terrible': '👎',
      'awful': '👎',
      'horrible': '👎',
      'dislike': '👎',
      
      'pointing': '👉',
      'look_here': '👉',
      'this_way': '👉',
      'over_here': '👉',
      'check_this': '👉',
      
      'all_good': '👌',
      'perfect_hand': '👌',
      'fine': '👌',
      'ok_sign': '👌',
      'approved': '👌',
      
      'high_five': '🙏',
      'thanks': '🙏',
      'grateful': '🙏',
      'blessed': '🙏',
      'appreciate': '🙏',
      
      'applause': '👏',
      'clapping': '👏',
      'bravo': '👏',
      'celebration': '👏',
      'congratulation': '👏',
      
      // 动物扩展
      'puppy': '🐶',
      'doggy': '🐶',
      'doggie': '🐶',
      'cute_dog': '🐶',
      
      'kitty': '🐱',
      'kitten': '🐱',
      'cute_cat': '🐱',
      'meow': '🐱',
      
      'piggy': '🐷',
      'cute_pig': '🐷',
      'oink': '🐷',
      
      'cute_bear': '🐻',
      'teddy': '🐻',
      'bear_face': '🐻',
      
      'birdy': '🐦',
      'tweet': '🐦',
      'flying_bird': '🐦',
      
      // 食物扩展
      'yummy': '😋',
      'delicious': '😋',
      'tasty': '😋',
      'hungry_face': '😋',
      'food_lover': '😋',
      'eating': '😋',
      
      'fruit': '🍎',
      'red_apple': '🍎',
      'apple_fruit': '🍎',
      
      'yellow_fruit': '🍌',
      'banana_fruit': '🍌',
      'monkey_food': '🍌',
      
      'burger': '🍔',
      'hamburger_food': '🍔',
      'fast_food': '🍔',
      
      'italian_food': '🍕',
      'pizza_slice': '🍕',
      'cheesy_pizza': '🍕',
      
      // 心形扩展
      'love': '❤️',
      'romance': '❤️',
      'valentine': '❤️',
      'affection': '❤️',
      'adore': '❤️',
      'cherish': '❤️',
      'devotion': '❤️',
      'passion': '❤️',
      
      'broken_love': '💔',
      'heartbreak': '💔',
      'sad_love': '💔',
      'lost_love': '💔',
      
      // 天气扩展
      'sunny': '☀️',
      'sunshine': '☀️',
      'bright_day': '☀️',
      'warm': '☀️',
      
      'rainy': '🌧️',
      'rain_cloud': '🌧️',
      'wet_weather': '🌧️',
      'drizzle': '🌧️',
      
      'cloudy': '☁️',
      'overcast': '☁️',
      'gray_sky': '☁️',
      
      'stormy': '⛈️',
      'thunder': '⛈️',
      'lightning': '⛈️',
      
      // 活动扩展
      'soccer_ball': '⚽',
      'football_ball': '⚽',
      'kick_ball': '⚽',
      
      'basketball_ball': '🏀',
      'hoops': '🏀',
      'dribble': '🏀',
      
      'celebration_party': '🎉',
      'party_time': '🎉',
      'festive': '🎉',
      'confetti': '🎉',
      
      // 交通工具
      'vehicle': '🚗',
      'automobile': '🚗',
      'drive': '🚗',
      'road_trip': '🚗',
      
      'airplane_travel': '✈️',
      'flight': '✈️',
      'flying': '✈️',
      'aviation': '✈️',
      
      // 建筑物
      'home': '🏠',
      'house_building': '🏠',
      'residence': '🏠',
      'dwelling': '🏠',
      
      'office_building': '🏢',
      'workplace': '🏢',
      'business': '🏢',
      'corporate': '🏢',
      
      // 时间
      'time': '⏰',
      'clock_time': '⏰',
      'alarm': '⏰',
      'wake_up': '⏰',
      
      // 符号扩展
      'flame': '🔥',
      'burning': '🔥',
      'hot': '🔥',
      'heat': '🔥',
      'lit': '🔥',
      'awesome_fire': '🔥',
      
      'star_bright': '⭐',
      'shining_star': '⭐',
      'favorite': '⭐',
      'rating': '⭐',
      
      'boom_explosion': '💥',
      'bang': '💥',
      'crash': '💥',
      'impact': '💥',
      
      'water_drop': '💧',
      'tear': '💧',
      'liquid': '💧',
      'wet': '💧',
      
      // 职业
      'doctor': '👨‍⚕️',
      'medical': '👨‍⚕️',
      'healthcare': '👨‍⚕️',
      
      'teacher': '👨‍🏫',
      'education': '👨‍🏫',
      'school': '👨‍🏫',
      
      'programmer': '👨‍💻',
      'coder': '👨‍💻',
      'developer': '👨‍💻',
      'software': '👨‍💻',
      
      // 更多变体
      'laughter': '😂',
      'giggle': '😂',
      'chuckle': '😂',
      'hilarious': '😂',
      'funny': '😂',
      'humor': '😂',
      'joke': '😂',
      'comedy': '😂'
    };

    let count = 0;
    for (const [key, value] of Object.entries(manualMappings)) {
      if (!this.emojiMap.has(key)) {
        this.emojiMap.set(key, value);
        count++;
      }
    }

    this.stats.manual = count;
    console.log(`✅ 手动映射: 添加了 ${count} 个emoji`);
  }

  /**
   * 生成最终映射文件
   */
  generateFinalMappingFile(outputPath) {
    const sortedEntries = Array.from(this.emojiMap.entries()).sort(([a], [b]) => a.localeCompare(b));
    const finalMap = {};
    
    sortedEntries.forEach(([key, value]) => {
      finalMap[key] = value;
    });

    this.stats.total = sortedEntries.length;

    const content = `/**
 * 扩展Emoji映射表 - 2000+种映射
 * 生成时间: ${new Date().toISOString()}
 * 数据统计: 现有: ${this.stats.existing}, Unicode: ${this.stats.unicode}, 手动: ${this.stats.manual}, 总计: ${this.stats.total}
 */

export const extendedEmojiMap: Record<string, string> = ${JSON.stringify(finalMap, null, 2)};

// 统计信息
export const emojiMapStats = {
  total: ${this.stats.total},
  sources: {
    existing: ${this.stats.existing},
    unicode: ${this.stats.unicode},
    manual: ${this.stats.manual}
  },
  generatedAt: '${new Date().toISOString()}',
  version: '2.0.0'
};

// 导出便捷函数
export function hasEmoji(description: string): boolean {
  const cleaned = description.trim().toLowerCase().replace(/\\s+/g, '_');
  return cleaned in extendedEmojiMap;
}

export function getEmoji(description: string): string | null {
  const cleaned = description.trim().toLowerCase().replace(/\\s+/g, '_');
  return extendedEmojiMap[cleaned] || null;
}

export function getAllEmojiKeys(): string[] {
  return Object.keys(extendedEmojiMap);
}

export function searchEmojiByKeyword(keyword: string): Array<{key: string, emoji: string}> {
  const lowerKeyword = keyword.toLowerCase();
  return Object.entries(extendedEmojiMap)
    .filter(([key]) => key.includes(lowerKeyword))
    .map(([key, emoji]) => ({ key, emoji }));
}
`;

    fs.writeFileSync(outputPath, content, 'utf8');
    
    // JSON版本
    const jsonPath = outputPath.replace('.ts', '.json');
    fs.writeFileSync(jsonPath, JSON.stringify({
      emojiMap: finalMap,
      stats: this.stats,
      generatedAt: new Date().toISOString(),
      version: '2.0.0'
    }, null, 2), 'utf8');

    return {
      mappingCount: this.stats.total,
      filePath: outputPath,
      stats: this.stats
    };
  }

  /**
   * 执行完整的扩展流程
   */
  async expand(outputPath) {
    console.log('🚀 开始扩展Emoji映射到2000+种...\n');

    // 1. 加载现有映射
    this.loadExistingMappings();
    console.log('');

    // 2. 添加Unicode映射
    this.addUnicodeEmojiMappings();
    console.log('');

    // 3. 添加手动映射
    this.addManualMappings();
    console.log('');

    // 4. 生成文件
    console.log('🔄 生成最终映射文件...');
    const result = this.generateFinalMappingFile(outputPath);
    
    console.log('✅ Emoji映射扩展完成!');
    console.log(`📊 最终统计:`);
    console.log(`   - 原有映射: ${this.stats.existing} 个`);
    console.log(`   - Unicode映射: ${this.stats.unicode} 个`);
    console.log(`   - 手动映射: ${this.stats.manual} 个`);
    console.log(`   - 总计: ${this.stats.total} 个`);
    console.log(`📁 输出文件: ${result.filePath}`);
    
    return result;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const expander = new EmojiMappingExpander();
  const outputPath = path.join(__dirname, '..', 'frontend', 'src', 'utils', 'extended-emoji-map.ts');
  
  expander.expand(outputPath)
    .then((result) => {
      console.log(`\n🎉 成功扩展到 ${result.mappingCount} 个emoji映射!`);
      if (result.mappingCount >= 2000) {
        console.log('✅ 已达到2000+种映射目标!');
      } else {
        console.log(`⚠️  当前 ${result.mappingCount} 种，距离2000种还需要 ${2000 - result.mappingCount} 种`);
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 扩展过程出错:', error);
      process.exit(1);
    });
}

module.exports = EmojiMappingExpander;