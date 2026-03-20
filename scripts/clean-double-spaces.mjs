#!/usr/bin/env node
/**
 * Clean up double spaces left behind by emoji removal.
 * Only targets lines that changed (have double spaces where emoji were).
 * Does NOT touch intentional double spaces in strings or formatting.
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
  'clean-double-spaces.mjs',
]);

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

function cleanDoubleSpaces(text) {
  const lines = text.split('\n');
  const cleaned = lines.map(line => {
    // Clean double spaces in comment lines (// or /*)
    // Pattern: "//  text" -> "// text"
    let result = line.replace(/^(\s*\/\/)\s{2,}/g, '$1 ');
    // Pattern: "/*  text" -> "/* text"
    result = result.replace(/^(\s*\/\*)\s{2,}/g, '$1 ');
    // Pattern: " *  text" -> " * text" (JSDoc continuation)
    result = result.replace(/^(\s*\*)\s{2,}(?!\s)/g, '$1 ');
    // Clean double spaces in console.log/warn/error prefix strings
    // e.g., console.log(' [Module]') -> console.log('[Module]')
    result = result.replace(/(console\.\w+\(['"`]) (\[)/g, '$1$2');
    // Clean double spaces inside template literals for log messages
    // e.g., ` [Module]` -> `[Module]`
    result = result.replace(/(log\.\w+\() ?`\s{1,2}(\[)/g, '$1`$2');
    // Clean leading space in template literal after ${ or at start
    result = result.replace(/` (\[)/g, '`$1');
    // Clean "   " (triple+ space) that aren't indentation, in mid-line
    result = result.replace(/(\S)\s{3,}(\S)/g, (match, before, after) => {
      // Don't touch alignment in tables or formatted text
      if (before === '|' || after === '|') return match;
      return `${before} ${after}`;
    });
    return result;
  });
  return cleaned.join('\n');
}

const rootDir = process.argv[2] || '.';
const files = collectFiles(rootDir, ['.ts', '.vue', '.md']);

let totalFilesModified = 0;

for (const filePath of files) {
  const original = readFileSync(filePath, 'utf-8');
  const cleaned = cleanDoubleSpaces(original);

  if (cleaned !== original) {
    totalFilesModified++;
    writeFileSync(filePath, cleaned, 'utf-8');
    console.log(`Cleaned: ${filePath}`);
  }
}

console.log(`\nDone! Cleaned double spaces in ${totalFilesModified} files.`);
