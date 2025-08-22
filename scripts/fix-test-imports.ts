#!/usr/bin/env node
// 修復測試文件中的導入路徑
// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/scripts/fix-test-imports.ts

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testDir = join(__dirname, '../tests');

function fixImportsInFile(filePath: string) {
  const content = readFileSync(filePath, 'utf-8');
  
  let updatedContent = content
    // 修復前端組件導入
    .replace(/from ['"]\.\.\/\.\.\/\.\.\/frontend\/src\/(.*?)['"]/g, "from '@/$1'")
    // 修復後端導入
    .replace(/from ['"]\.\.\/\.\.\/\.\.\/src\/(.*?)['"]/g, "from '@backend/$1'")
    // 修復類型導入
    .replace(/import type \{(.*?)\} from ['"]\.\.\/\.\.\/\.\.\/frontend\/src\/(.*?)['"]/g, "import type {$1} from '@/$2'")
    .replace(/import type \{(.*?)\} from ['"]\.\.\/\.\.\/\.\.\/src\/(.*?)['"]/g, "import type {$1} from '@backend/$2'");
  
  if (content !== updatedContent) {
    writeFileSync(filePath, updatedContent);
    console.log(`Fixed imports in: ${filePath}`);
  }
}

function processDirectory(dir: string) {
  const items = readdirSync(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
      fixImportsInFile(fullPath);
    }
  }
}

console.log('開始修復測試文件導入路徑...');
processDirectory(testDir);
console.log('導入路徑修復完成！');