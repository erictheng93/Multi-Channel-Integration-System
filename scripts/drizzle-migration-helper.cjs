#!/usr/bin/env node

/**
 * Drizzle ORM Migration Helper Script
 * Automatically converts common native D1 SQL patterns to Drizzle ORM
 */

const fs = require('fs');
const path = require('path');

// Simple glob implementation
function globSync(pattern, options = {}) {
  const { ignore = [] } = options;
  
  function walkDir(dir) {
    const files = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
      
      if (item.isDirectory() && !item.name.startsWith('.')) {
        files.push(...walkDir(fullPath));
      } else if (item.isFile() && fullPath.endsWith('.ts')) {
        // Check ignore patterns
        if (!ignore.some(ignorePattern => relativePath.includes(ignorePattern))) {
          files.push(relativePath);
        }
      }
    }
    
    return files;
  }
  
  return walkDir('src');
}

// Migration rules
const migrationRules = [
  // 1. Context issues - c.env.DB when c is not in scope
  {
    pattern: /drizzle\(c\.env\.DB \|\| this\.db\)/g,
    replacement: 'drizzle(this.db)',
    description: 'Fix context issues in class methods'
  },
  
  // 2. Simple drizzle().run() calls
  {
    pattern: /await\s+drizzleDb\.run\(sql`\s*SELECT \* FROM (\w+) WHERE (\w+) = \?\s*`,\s*\[([^]]*?)\]\)/g,
    replacement: 'await drizzleDb.select().from($1).where(eq($1.$2, $3))',
    description: 'Convert simple SELECT queries'
  },
  
  // 3. drizzle().get() calls  
  {
    pattern: /await\s+drizzleDb\.get\(sql`\s*SELECT \* FROM (\w+) WHERE (\w+) = \?\s*`,\s*\[([^]]*?)\]\)/g,
    replacement: 'await drizzleDb.select().from($1).where(eq($1.$2, $3)).get()',
    description: 'Convert simple SELECT with .get()'
  },
  
  // 4. Native D1 prepare patterns
  {
    pattern: /c\.env\.DB\.prepare\(/g,
    replacement: '/* MIGRATE: Convert to Drizzle query builder */ c.env.DB.prepare(',
    description: 'Mark native D1 prepare() for manual migration'
  },
  
  // 5. Simple UPDATE statements
  {
    pattern: /drizzleDb\.run\(sql`\s*UPDATE (\w+) SET ([^`]*?) WHERE (\w+) = \?\s*`,\s*\[([^]]*?)\]\)/g,
    replacement: '/* MIGRATE: Update query needs manual conversion */',
    description: 'Mark UPDATE queries for manual migration'
  },
  
  // 6. Simple INSERT statements  
  {
    pattern: /drizzleDb\.run\(sql`\s*INSERT INTO (\w+) \([^)]*\) VALUES \([^)]*\)\s*`,\s*\[[^]]*\]\)/g,
    replacement: '/* MIGRATE: Insert query needs manual conversion */',
    description: 'Mark INSERT queries for manual migration'
  }
];

// Table name mapping
const tableImports = {
  'agents': 'agents',
  'customers': 'customers', 
  'conversations': 'conversationTable',
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
 * Extract table names used in file
 */
function extractTableNames(content) {
  const tableNames = new Set();
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
 * Add required imports to file
 */
function addRequiredImports(content, tableNames) {
  const lines = content.split('\n');
  
  // Add drizzle-orm imports if not present
  const drizzleImportIndex = lines.findIndex(line => line.includes('from \'drizzle-orm\''));
  if (drizzleImportIndex !== -1) {
    const existingImport = lines[drizzleImportIndex];
    if (!existingImport.includes('eq') && !existingImport.includes('and')) {
      lines[drizzleImportIndex] = existingImport.replace(
        /import\s*{([^}]*)}/, 
        'import { $1, eq, and, or, desc, asc, like, count, sum, avg, inArray }'
      );
    }
  }
  
  // Add schema imports if needed and not present
  if (tableNames.length > 0) {
    const schemaImportIndex = lines.findIndex(line => line.includes('../db/schema'));
    if (schemaImportIndex === -1) {
      // Find where to insert import
      const lastImportIndex = lines.findIndex((line, index) => 
        line.startsWith('import') && 
        (!lines[index + 1] || !lines[index + 1].startsWith('import'))
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
 * Apply migration rules
 */
function migrateFileContent(content) {
  let migratedContent = content;
  const changes = [];
  
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
 * Process single file
 */
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const tableNames = extractTableNames(content);
    
    const { content: migratedContent, changes } = migrateFileContent(content);
    const finalContent = addRequiredImports(migratedContent, tableNames);
    
    // Only write if changes were made
    if (changes.length > 0 || finalContent !== content) {
      fs.writeFileSync(filePath, finalContent);
      return { success: true, changes };
    }
    
    return { success: true, changes: [] };
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    return { success: false, changes: [`Error: ${error.message}`] };
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('🚀 Starting Drizzle ORM Migration...\n');
  
  // Find TypeScript files
  const files = globSync('src/**/*.ts', {
    ignore: ['.test.', '.spec.', 'tests/']
  });
  
  console.log(`Found ${files.length} TypeScript files to process...\n`);
  
  let totalChanges = 0;
  const summary = {};
  
  for (const file of files) {
    console.log(`Processing: ${file}`);
    const result = processFile(file);
    
    if (result.success && result.changes.length > 0) {
      summary[file] = result.changes;
      totalChanges += result.changes.length;
      console.log(`  ✅ ${result.changes.length} changes made`);
      result.changes.forEach(change => console.log(`    - ${change}`));
    } else if (!result.success) {
      console.log(`  ❌ Failed to process`);
      if (result.changes.length > 0) {
        result.changes.forEach(change => console.log(`    - ${change}`));
      }
    } else {
      console.log(`  ⭕ No changes needed`);
    }
    console.log('');
  }
  
  // Print summary
  console.log('📊 Migration Summary:');
  console.log(`Files processed: ${files.length}`);
  console.log(`Files modified: ${Object.keys(summary).length}`);
  console.log(`Total changes: ${totalChanges}\n`);
  
  if (totalChanges > 0) {
    console.log('🎉 Migration completed!');
    console.log('\n⚠️  Manual Review Required:');
    console.log('1. Check files marked with "/* MIGRATE:" comments');
    console.log('2. Verify complex queries are correctly converted');  
    console.log('3. Test the application thoroughly');
    console.log('4. Run: npm run lint:check');
  } else {
    console.log('✨ No migrations needed - all files are already compliant!');
  }
}

// Run migration
runMigration().catch(console.error);