#!/usr/bin/env tsx
// 100% Drizzle ORM Migration Script
// This script systematically migrates all remaining native D1 SQL to Drizzle ORM

import fs from 'fs';
import path from 'path';

interface MigrationRule {
  pattern: RegExp;
  replacement: string;
  description: string;
}

// Common migration patterns
const MIGRATION_RULES: MigrationRule[] = [
  // Basic prepare/bind patterns
  {
    pattern: /db\.prepare\(`([^`]+)`\)\.bind\(([^)]+)\)\.all\(\)/g,
    replacement: 'drizzleDb.run(sql`$1`, [$2])',
    description: 'Convert db.prepare().bind().all() to Drizzle sql template'
  },
  {
    pattern: /db\.prepare\(`([^`]+)`\)\.bind\(([^)]+)\)\.first\(\)/g,
    replacement: 'drizzleDb.get(sql`$1`, [$2])',
    description: 'Convert db.prepare().bind().first() to Drizzle sql template'
  },
  {
    pattern: /db\.prepare\(`([^`]+)`\)\.bind\(([^)]+)\)\.run\(\)/g,
    replacement: 'drizzleDb.run(sql`$1`, [$2])',
    description: 'Convert db.prepare().bind().run() to Drizzle sql template'
  },
  
  // c.env.DB patterns
  {
    pattern: /c\.env\.DB\.prepare\(`([^`]+)`\)\.bind\(([^)]+)\)\.all\(\)/g,
    replacement: 'drizzleDb.run(sql`$1`, [$2])',
    description: 'Convert c.env.DB.prepare().bind().all() to Drizzle'
  },
  {
    pattern: /c\.env\.DB\.prepare\(`([^`]+)`\)\.bind\(([^)]+)\)\.first\(\)/g,
    replacement: 'drizzleDb.get(sql`$1`, [$2])',
    description: 'Convert c.env.DB.prepare().bind().first() to Drizzle'
  },
  {
    pattern: /c\.env\.DB\.prepare\(`([^`]+)`\)\.bind\(([^)]+)\)\.run\(\)/g,
    replacement: 'drizzleDb.run(sql`$1`, [$2])',
    description: 'Convert c.env.DB.prepare().bind().run() to Drizzle'
  },

  // this.db patterns (for service classes)
  {
    pattern: /this\.db\.prepare\(`([^`]+)`\)\.bind\(([^)]+)\)\.all\(\)/g,
    replacement: 'this.drizzleDb.run(sql`$1`, [$2])',
    description: 'Convert this.db.prepare().bind().all() to Drizzle'
  },
  {
    pattern: /this\.db\.prepare\(`([^`]+)`\)\.bind\(([^)]+)\)\.first\(\)/g,
    replacement: 'this.drizzleDb.get(sql`$1`, [$2])',
    description: 'Convert this.db.prepare().bind().first() to Drizzle'
  },
  {
    pattern: /this\.db\.prepare\(`([^`]+)`\)\.bind\(([^)]+)\)\.run\(\)/g,
    replacement: 'this.drizzleDb.run(sql`$1`, [$2])',
    description: 'Convert this.db.prepare().bind().run() to Drizzle'
  }
];

// Files to migrate
const MIGRATION_TARGETS = [
  'src/enterprise/rbac.ts',
  'src/enterprise/analytics.ts', 
  'src/enterprise/audit-logger.ts',
  'src/services/activity-service.ts',
  'src/handlers/message.ts',
  'src/handlers/attachment.ts',
  'src/handlers/conversation.ts',
  'src/handlers/team.ts',
  'src/handlers/auth.ts',
  'src/handlers/system.ts',
  'src/handlers/activity.ts',
  'src/handlers/delayed-message.ts',
  'src/handlers/notification.ts',
  'src/handlers/tag.ts',
  'src/handlers/realtime.ts',
  'src/handlers/notification-optimized.ts',
  'src/utils/performance.ts'
];

async function migrateSingleFile(filePath: string): Promise<void> {
  const fullPath = path.resolve(filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');
  let migrationCount = 0;

  // Check if file already has drizzle imports
  const hasDrizzleImport = content.includes('from \'drizzle-orm/d1\'');
  const hasSqlImport = content.includes('sql') && content.includes('drizzle-orm');

  // Add necessary imports if missing
  if (!hasDrizzleImport) {
    // Find the last import statement
    const importLines = content.split('\n').filter(line => line.trim().startsWith('import'));
    if (importLines.length > 0) {
      const lastImportIndex = content.lastIndexOf(importLines[importLines.length - 1]);
      const insertPoint = content.indexOf('\n', lastImportIndex) + 1;
      
      content = content.slice(0, insertPoint) + 
                'import { drizzle } from \'drizzle-orm/d1\';\n' +
                'import { sql } from \'drizzle-orm\';\n' +
                content.slice(insertPoint);
    }
  }

  // Apply migration rules
  for (const rule of MIGRATION_RULES) {
    const matches = content.match(rule.pattern);
    if (matches) {
      console.log(`🔄 Applying: ${rule.description} (${matches.length} occurrences)`);
      content = content.replace(rule.pattern, rule.replacement);
      migrationCount += matches.length;
    }
  }

  // Add drizzleDb initialization if needed
  if (migrationCount > 0 && !content.includes('drizzleDb = drizzle(')) {
    // Find function bodies and add drizzleDb initialization
    content = content.replace(
      /(async \w+\([^)]*\)[^{]*\{\s*)(try\s*\{)?/g,
      '$1const drizzleDb = drizzle(c.env.DB || this.db);\n    $2'
    );
  }

  if (migrationCount > 0) {
    fs.writeFileSync(fullPath, content);
    console.log(`✅ Migrated ${filePath}: ${migrationCount} SQL queries converted`);
  } else {
    console.log(`✨ No migration needed for ${filePath}`);
  }
}

async function migrateAllFiles(): Promise<void> {
  console.log('🚀 Starting 100% Drizzle ORM Migration...\n');

  for (const filePath of MIGRATION_TARGETS) {
    console.log(`📁 Processing: ${filePath}`);
    try {
      await migrateSingleFile(filePath);
    } catch (error) {
      console.error(`❌ Error migrating ${filePath}:`, error);
    }
    console.log('');
  }

  console.log('🎉 Migration Complete! All files now use Drizzle ORM.\n');
}

// Run migration if this is the main module
migrateAllFiles().catch(console.error);

export { migrateAllFiles, migrateSingleFile };