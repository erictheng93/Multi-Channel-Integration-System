#!/usr/bin/env ts-node

/**
 * Drizzle ORM Migration Helper Script
 * Automatically converts common native D1 SQL patterns to Drizzle ORM
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import path from 'path';

interface MigrationRule {
  pattern: RegExp;
  replacement: string;
  description: string;
}

// Common migration patterns
const migrationRules: MigrationRule[] = [
  // 1. Basic SQL template literals with parameters
  {
    pattern: /drizzle\(.*\.env\.DB\)\.run\(sql`SELECT \* FROM (\w+) WHERE (\w+) = \?\`, \[(.*?)\]/g,
    replacement: 'drizzleDb.select().from($1).where(eq($1.$2, $3))',
    description: 'Convert basic SELECT with WHERE to Drizzle query'
  },
  
  // 2. Simple INSERT statements
  {
    pattern: /drizzle\(.*\.env\.DB\)\.run\(sql`INSERT INTO (\w+) \((.*?)\) VALUES \((.*?)\)`, \[(.*?)\]/g,
    replacement: 'drizzleDb.insert($1).values({ /* map fields to values */ })',
    description: 'Convert INSERT to Drizzle insert'
  },
  
  // 3. UPDATE statements
  {
    pattern: /drizzle\(.*\.env\.DB\)\.run\(sql`UPDATE (\w+) SET (.*?) WHERE (\w+) = \?\`, \[(.*?)\]/g,
    replacement: 'drizzleDb.update($1).set({ /* set values */ }).where(eq($1.$3, $4))',
    description: 'Convert UPDATE to Drizzle update'
  },
  
  // 4. DELETE statements  
  {
    pattern: /drizzle\(.*\.env\.DB\)\.run\(sql`DELETE FROM (\w+) WHERE (.*?) = \?\`, \[(.*?)\]/g,
    replacement: 'drizzleDb.delete($1).where(eq($1.$2, $3))',
    description: 'Convert DELETE to Drizzle delete'
  },
  
  // 5. Native D1 prepare patterns
  {
    pattern: /c\.env\.DB\.prepare\(`([^`]*)`\)\.bind\((.*?)\)\.all\(\)/g,
    replacement: '/* MIGRATE: Convert to Drizzle query builder */\n// Original SQL: $1\n// Parameters: $2',
    description: 'Mark native D1 prepare().all() for manual migration'
  },
  
  {
    pattern: /c\.env\.DB\.prepare\(`([^`]*)`\)\.bind\((.*?)\)\.first\(\)/g,
    replacement: '/* MIGRATE: Convert to Drizzle query builder */\n// Original SQL: $1\n// Parameters: $2',
    description: 'Mark native D1 prepare().first() for manual migration'
  },
  
  // 6. Fix context issues - c.env.DB when c is not in scope
  {
    pattern: /drizzle\(c\.env\.DB \|\| this\.db\)/g,
    replacement: 'drizzle(this.db)',
    description: 'Fix context issues in class methods'
  },
  
  // 7. Simple COUNT queries
  {
    pattern: /sql`SELECT COUNT\(\*\) as count FROM (\w+)`/g,
    replacement: 'drizzleDb.select({ count: count() }).from($1)',
    description: 'Convert COUNT queries to Drizzle'
  }
];

// Import patterns that need to be added
const requiredImports = {
  'drizzle-orm': ['eq', 'and', 'or', 'desc', 'asc', 'like', 'count', 'sum', 'avg', 'inArray'],
  '../db/schema': [] // Will be populated based on table usage
};

// Table name mapping (snake_case to camelCase for imports)
const tableImports: { [key: string]: string } = {
  'agents': 'agents',
  'customers': 'customers', 
  'conversations': 'conversations',
  'messages': 'messages',
  'activities': 'activities',
  'system_settings': 'systemSettings',
  'file_attachments': 'fileAttachments',
  'delayed_messages': 'delayedMessages',
  'notifications': 'notifications',
  'tags': 'tags',
  'customer_tags': 'customerTags',
  'teams': 'teams',
  'metrics': 'metrics'
};

/**
 * Analyze file and extract table names used
 */
function extractTableNames(content: string): string[] {
  const tableNames = new Set<string>();
  const tablePattern = /FROM\s+(\w+)|INTO\s+(\w+)|UPDATE\s+(\w+)/gi;
  
  let match;
  while ((match = tablePattern.exec(content)) !== null) {
    const tableName = match[1] || match[2] || match[3];
    if (tableImports[tableName]) {
      tableNames.add(tableImports[tableName]);
    }
  }
  
  return Array.from(tableNames);
}

/**
 * Add required imports to file content
 */
function addRequiredImports(content: string, tableNames: string[]): string {
  const lines = content.split('\n');
  let importInserted = false;
  
  // Find existing drizzle-orm import or add it
  const drizzleImportIndex = lines.findIndex(line => line.includes('from \'drizzle-orm\''));
  if (drizzleImportIndex !== -1) {
    // Enhance existing import
    const existingImport = lines[drizzleImportIndex];
    const newImports = requiredImports['drizzle-orm'].join(', ');
    if (!existingImport.includes('eq') && !existingImport.includes('and')) {
      lines[drizzleImportIndex] = existingImport.replace(
        /import\s*{([^}]*)}/, 
        `import { $1, ${newImports} }`
      );
    }
  } else {
    // Add new drizzle-orm import after existing imports
    const lastImportIndex = lines.findIndex((line, index) => 
      line.startsWith('import') && 
      !lines[index + 1]?.startsWith('import')
    );
    if (lastImportIndex !== -1) {
      lines.splice(lastImportIndex + 1, 0, 
        `import { ${requiredImports['drizzle-orm'].join(', ')} } from 'drizzle-orm';`
      );
    }
  }
  
  // Add schema imports if tables are used
  if (tableNames.length > 0) {
    const schemaImportIndex = lines.findIndex(line => line.includes('../db/schema'));
    if (schemaImportIndex !== -1) {
      const existingImport = lines[schemaImportIndex];
      tableNames.forEach(tableName => {
        if (!existingImport.includes(tableName)) {
          lines[schemaImportIndex] = existingImport.replace(
            /import\s*{([^}]*)}/, 
            `import { $1, ${tableName} }`
          );
        }
      });
    } else {
      const lastImportIndex = lines.findIndex((line, index) => 
        line.startsWith('import') && 
        !lines[index + 1]?.startsWith('import')
      );
      if (lastImportIndex !== -1) {
        lines.splice(lastImportIndex + 1, 0, 
          `import { ${tableNames.join(', ')} } from '../db/schema';`
        );
      }
    }
  }
  
  return lines.join('\n');
}

/**
 * Apply migration rules to file content
 */
function migrateFileContent(content: string): { content: string; changes: string[] } {
  let migratedContent = content;
  const changes: string[] = [];
  
  migrationRules.forEach(rule => {
    const matches = migratedContent.match(rule.pattern);
    if (matches) {
      migratedContent = migratedContent.replace(rule.pattern, rule.replacement);
      changes.push(`${rule.description}: ${matches.length} occurrences`);
    }
  });
  
  return { content: migratedContent, changes };
}

/**
 * Process a single file
 */
function processFile(filePath: string): { success: boolean; changes: string[] } {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const tableNames = extractTableNames(content);
    
    const { content: migratedContent, changes } = migrateFileContent(content);
    const finalContent = addRequiredImports(migratedContent, tableNames);
    
    // Only write if changes were made
    if (changes.length > 0 || finalContent !== content) {
      writeFileSync(filePath, finalContent);
      return { success: true, changes };
    }
    
    return { success: true, changes: [] };
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    return { success: false, changes: [`Error: ${error}`] };
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log(' Starting Drizzle ORM Migration...\n');
  
  // Find all TypeScript files in src/ (excluding tests)
  const files = glob.sync('src/**/*.ts', {
    ignore: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'tests/**/*.ts']
  });
  
  let totalChanges = 0;
  const summary: { [file: string]: string[] } = {};
  
  for (const file of files) {
    console.log(`Processing: ${file}`);
    const result = processFile(file);
    
    if (result.success && result.changes.length > 0) {
      summary[file] = result.changes;
      totalChanges += result.changes.length;
      console.log(` ${result.changes.length} changes made`);
    } else if (!result.success) {
      console.log(` Failed to process`);
    } else {
      console.log(` No changes needed`);
    }
  }
  
  // Print summary
  console.log('\n Migration Summary:');
  console.log(`Files processed: ${files.length}`);
  console.log(`Files modified: ${Object.keys(summary).length}`);
  console.log(`Total changes: ${totalChanges}\n`);
  
  if (Object.keys(summary).length > 0) {
    console.log(' Detailed Changes:');
    Object.entries(summary).forEach(([file, changes]) => {
      console.log(`\n${file}:`);
      changes.forEach(change => console.log(`  - ${change}`));
    });
  }
  
  console.log('\n Migration completed!');
  console.log('\n  Manual Review Required:');
  console.log('1. Check files marked with "/* MIGRATE:" comments');
  console.log('2. Verify complex queries are correctly converted');
  console.log('3. Test the application thoroughly');
  console.log('4. Run: npm run lint:check');
}

// Run if called directly
if (require.main === module) {
  runMigration().catch(console.error);
}

export { runMigration, processFile, migrationRules };