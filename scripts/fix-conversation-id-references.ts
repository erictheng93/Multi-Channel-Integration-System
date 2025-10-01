#!/usr/bin/env npx tsx
/**
 * 修復 conversation_id 引用不一致問題
 * Fix conversation_id reference inconsistencies
 *
 * This script addresses the critical production issue where:
 * - Database schema uses snake_case (conversation_id)
 * - TypeScript interfaces were using camelCase (conversationId)
 * - This mismatch causes runtime failures
 */

import { readFile, writeFile } from 'fs/promises';
import { glob } from 'glob';
import path from 'path';

interface FileMapping {
  pattern: string;
  replacements: Array<{
    search: RegExp | string;
    replace: string;
    description: string;
  }>;
}

/**
 * 文件修復映射配置
 */
const FILE_MAPPINGS: FileMapping[] = [
  {
    pattern: 'src/modules/session/**/*.ts',
    replacements: [
      {
        search: /\.conversationId/g,
        replace: '.conversation_id',
        description: 'Fix object property access'
      },
      {
        search: /conversationId:/g,
        replace: 'conversation_id:',
        description: 'Fix object property definitions'
      },
      {
        search: /\{ conversationId \}/g,
        replace: '{ conversation_id }',
        description: 'Fix destructuring assignments'
      },
      {
        search: /conversationId,/g,
        replace: 'conversation_id,',
        description: 'Fix parameter usage in function calls'
      }
    ]
  },
  {
    pattern: 'src/modules/session/**/*.test.ts',
    replacements: [
      {
        search: /conversationId:/g,
        replace: 'conversation_id:',
        description: 'Fix test data object properties'
      },
      {
        search: /\.conversationId/g,
        replace: '.conversation_id',
        description: 'Fix test assertions'
      }
    ]
  }
];

/**
 * 處理單個文件
 */
async function processFile(filePath: string, mappings: FileMapping['replacements']): Promise<boolean> {
  try {
    const content = await readFile(filePath, 'utf-8');
    let updatedContent = content;
    let hasChanges = false;

    for (const mapping of mappings) {
      const beforeLength = updatedContent.length;
      updatedContent = updatedContent.replace(mapping.search, mapping.replace);

      if (updatedContent.length !== beforeLength || updatedContent !== content) {
        hasChanges = true;
        console.log(`  ✅ ${mapping.description} in ${path.basename(filePath)}`);
      }
    }

    if (hasChanges) {
      await writeFile(filePath, updatedContent, 'utf-8');
      return true;
    }

    return false;
  } catch (error) {
    console.error(`  ❌ Error processing ${filePath}:`, error);
    return false;
  }
}

/**
 * 主執行函數
 */
async function main() {
  console.log('🚀 開始修復 conversation_id 引用不一致問題...\n');

  let totalFilesProcessed = 0;
  let totalFilesChanged = 0;

  for (const mapping of FILE_MAPPINGS) {
    console.log(`📁 處理模式: ${mapping.pattern}`);

    const files = await glob(mapping.pattern, { cwd: process.cwd() });

    for (const file of files) {
      totalFilesProcessed++;
      const changed = await processFile(file, mapping.replacements);

      if (changed) {
        totalFilesChanged++;
      }
    }

    console.log(`   已處理 ${files.length} 個文件\n`);
  }

  console.log('📊 修復完成統計:');
  console.log(`   總處理文件: ${totalFilesProcessed}`);
  console.log(`   已修改文件: ${totalFilesChanged}`);
  console.log(`   未修改文件: ${totalFilesProcessed - totalFilesChanged}`);

  if (totalFilesChanged > 0) {
    console.log('\n✅ 修復完成！建議執行以下命令驗證:');
    console.log('   npx tsc --noEmit');
    console.log('   npm run test:session');
  } else {
    console.log('\n✨ 沒有需要修復的文件');
  }
}

// 執行修復
main().catch(console.error);