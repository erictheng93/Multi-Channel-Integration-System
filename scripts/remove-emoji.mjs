#!/usr/bin/env node
/**
 * Script to remove emoji characters from all .ts and .vue files in the codebase.
 * Excludes emoji utility files that handle LINE platform emoji/sticker rendering.
 *
 * Strategy: Only remove actual emoji characters. Do NOT touch surrounding whitespace
 * or punctuation — let the developer decide on cleanup manually if needed.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

const EXCLUDED_FILES = new Set([
  'emoji-utils.ts',
  'extended-emoji-map.ts',
  'layered-emoji-processor.ts',
  'unicode-emoji-processor.ts',
  'smart-emoji-renderer.ts',
  'sticker-renderer.ts',
  'EmojiPicker.vue',
  'remove-emoji.mjs',
]);

// Combined emoji regex - matches individual emoji characters and sequences
// Ranges covered:
//   U+1F300..1F9FF  Misc Symbols, Emoticons, Supplemental Symbols
//   U+1FA00..1FAFF  Symbols and Pictographs Extended-A
//   U+1F000..1F02F  Mahjong Tiles
//   U+1F0A0..1F0FF  Playing Cards
//   U+1F170..1F251  Enclosed Alphanumeric Supplement (subset)
//   U+2600..26FF    Misc Symbols (weather, chess, etc.)
//   U+2700..27BF    Dingbats
//   U+2300..23FF    Misc Technical (hourglass, keyboard, etc. - selective)
//   U+200D          Zero-Width Joiner (only when adjacent to emoji)
//   U+FE0F          Variation Selector-16 (emoji presentation)
//   U+20E3          Combining Enclosing Keycap
const EMOJI_PATTERN = [
  '[\u{1F300}-\u{1F9FF}]',     // Emoticons, symbols, pictographs
  '[\u{1FA00}-\u{1FAFF}]',     // Symbols Extended-A
  '[\u{1F000}-\u{1F02F}]',     // Mahjong
  '[\u{1F0A0}-\u{1F0FF}]',     // Playing cards
  '[\u{1F170}-\u{1F251}]',     // Enclosed alphanumeric
  '[\u{2600}-\u{26FF}]',       // Misc symbols
  '[\u{2700}-\u{27BF}]',       // Dingbats
  '[\u{231A}-\u{231B}]',       // Watch, Hourglass
  '[\u{23E9}-\u{23F3}]',       // Media controls, hourglass variants
  '[\u{23F8}-\u{23FA}]',       // Media controls
  '\u{2328}',                   // Keyboard
  '\u{23CF}',                   // Eject
  '[\u{25AA}-\u{25AB}]',       // Small squares
  '\u{25B6}',                   // Play button
  '\u{25C0}',                   // Reverse button
  '[\u{25FB}-\u{25FE}]',       // Medium squares
  '\u{24C2}',                   // Circled M
  '[\u{2934}-\u{2935}]',       // Curved arrows
  '[\u{2B05}-\u{2B07}]',       // Arrows
  '[\u{2B1B}-\u{2B1C}]',       // Large squares
  '\u{2B50}',                   // Star
  '\u{2B55}',                   // Heavy circle
  '\u{3030}',                   // Wavy dash
  '\u{303D}',                   // Part alternation mark
  '\u{3297}',                   // Circled Ideograph Congratulation
  '\u{3299}',                   // Circled Ideograph Secret
  '\u{203C}',                   // Double exclamation
  '\u{2049}',                   // Exclamation question
  '\u{2122}',                   // TM
  '\u{2139}',                   // Information source
  '[\u{2194}-\u{21AA}]',       // Arrows
].join('|');

// Build the full regex:
// Match emoji chars optionally followed by variation selectors and ZWJ sequences
const EMOJI_REGEX = new RegExp(
  `(?:${EMOJI_PATTERN})(?:\u{FE0F}|\u{FE0E}|\u{200D}(?:${EMOJI_PATTERN}))*\u{FE0F}?|\u{200D}(?=${EMOJI_PATTERN})|\u{FE0F}(?<=${EMOJI_PATTERN}\u{FE0F})|\u{20E3}`,
  'gu'
);

function collectFiles(dir, extensions) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === '.wrangler') continue;
    const fullPath = join(dir, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      results.push(...collectFiles(fullPath, extensions));
    } else if (extensions.some(ext => entry.endsWith(ext))) {
      if (!EXCLUDED_FILES.has(basename(fullPath))) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

function removeEmoji(text) {
  // Only remove emoji characters — no other text manipulation
  return text.replace(EMOJI_REGEX, '');
}

const rootDir = process.argv[2] || '.';
const files = collectFiles(rootDir, ['.ts', '.vue', '.md']);

let totalFilesModified = 0;
let totalEmojisRemoved = 0;

for (const filePath of files) {
  const original = readFileSync(filePath, 'utf-8');
  const cleaned = removeEmoji(original);

  if (cleaned !== original) {
    const origMatches = (original.match(EMOJI_REGEX) || []).length;
    totalEmojisRemoved += origMatches;
    totalFilesModified++;
    writeFileSync(filePath, cleaned, 'utf-8');
    console.log(`Modified: ${filePath} (${origMatches} emoji removed)`);
  }
}

console.log(`\nDone! Modified ${totalFilesModified} files, removed ~${totalEmojisRemoved} emoji characters.`);
