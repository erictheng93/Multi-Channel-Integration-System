/**
 * Comprehensive Drizzle Import Migration Script
 * 全面的 Drizzle 導入遷移腳本
 *
 * Migrates all files from:
 *   import { drizzle } from 'drizzle-orm/d1';
 *   const db = drizzle(c.env.DB);
 * To:
 *   import { createDbClient } from '../db/drizzle-factory';
 *   const db = createDbClient(c.env.DB);
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const SRC_DIR = path.join(__dirname, '..', 'src');
const EXCLUDE_PATTERNS = [
  '/db/index.ts',
  '/db/drizzle-factory.ts',
  '/shared/database/index.ts',
];

// Statistics
let stats = {
  totalFiles: 0,
  migrated: 0,
  skipped: 0,
  failed: 0,
  errors: [],
};

/**
 * Calculate relative path from file to drizzle-factory
 */
function getRelativePath(filePath) {
  const fileDir = path.dirname(filePath);
  const targetPath = path.join(SRC_DIR, 'db', 'drizzle-factory');
  const relative = path.relative(fileDir, targetPath);

  // Normalize path separators for import statements
  return relative.replace(/\\/g, '/');
}

/**
 * Check if file should be excluded
 */
function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some((pattern) => filePath.includes(pattern));
}

/**
 * Migrate a single file
 */
function migrateFile(filePath) {
  try {
    // Read file content
    let content = fs.readFileSync(filePath, 'utf8');

    // Check if file uses drizzle
    if (!content.includes("import { drizzle } from 'drizzle-orm/d1'")) {
      stats.skipped++;
      return { success: true, message: 'No drizzle import found' };
    }

    // Check if already migrated
    if (content.includes('createDbClient')) {
      stats.skipped++;
      return { success: true, message: 'Already migrated' };
    }

    // Calculate relative path
    const relativePath = getRelativePath(filePath);

    // Perform replacements
    const newContent = content
      // Replace import statement
      .replace(
        /import\s+{\s*drizzle\s*}\s+from\s+['"]drizzle-orm\/d1['"]/g,
        `import { createDbClient } from '${relativePath}'`
      )
      // Replace drizzle() calls with various patterns
      .replace(/drizzle\(c\.env\.DB\)/g, 'createDbClient(c.env.DB)')
      .replace(/drizzle\(c\.env\.DB_PROD\)/g, 'createDbClient(c.env.DB_PROD)')
      .replace(/drizzle\(env\.DB\)/g, 'createDbClient(env.DB)')
      .replace(/drizzle\(env\.DB_PROD\)/g, 'createDbClient(env.DB_PROD)')
      // Replace variable declarations
      .replace(/const\s+db\s*=\s*drizzle\(/g, 'const db = createDbClient(')
      .replace(/const\s+drizzleDb\s*=\s*drizzle\(/g, 'const drizzleDb = createDbClient(')
      .replace(/let\s+db\s*=\s*drizzle\(/g, 'let db = createDbClient(')
      .replace(/let\s+drizzleDb\s*=\s*drizzle\(/g, 'let drizzleDb = createDbClient(');

    // Verify migration was successful
    if (newContent === content) {
      stats.failed++;
      return { success: false, message: 'Migration had no effect' };
    }

    // Write updated content
    fs.writeFileSync(filePath, newContent, 'utf8');

    stats.migrated++;
    return { success: true, message: 'Migrated successfully' };
  } catch (error) {
    stats.failed++;
    stats.errors.push({ file: filePath, error: error.message });
    return { success: false, message: error.message };
  }
}

/**
 * Find all TypeScript files in directory
 */
function findTypeScriptFiles(dir) {
  let results = [];

  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules and hidden directories
      if (file === 'node_modules' || file.startsWith('.')) continue;
      results = results.concat(findTypeScriptFiles(filePath));
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      results.push(filePath);
    }
  }

  return results;
}

/**
 * Main migration function
 */
function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Comprehensive Drizzle Migration Script                     ║');
  console.log('║  全面的 Drizzle 遷移腳本                                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Find all TypeScript files
  console.log('Finding TypeScript files...');
  const allFiles = findTypeScriptFiles(SRC_DIR);
  stats.totalFiles = allFiles.length;
  console.log(`Found ${stats.totalFiles} TypeScript files`);
  console.log('');

  // Migrate each file
  console.log('Starting migration...');
  console.log('');

  for (const filePath of allFiles) {
    // Check if should exclude
    if (shouldExclude(filePath)) {
      stats.skipped++;
      continue;
    }

    const relativePath = path.relative(SRC_DIR, filePath);
    const result = migrateFile(filePath);

    if (result.success && result.message !== 'No drizzle import found' && result.message !== 'Already migrated') {
      console.log(`✓ ${relativePath}`);
    }
  }

  // Print summary
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Migration Summary                                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`Total files scanned:    ${stats.totalFiles}`);
  console.log(`Successfully migrated:  ${stats.migrated}`);
  console.log(`Skipped:                ${stats.skipped}`);
  console.log(`Failed:                 ${stats.failed}`);
  console.log('');

  if (stats.errors.length > 0) {
    console.log('Errors:');
    stats.errors.forEach(({ file, error }) => {
      console.log(`  ${path.relative(SRC_DIR, file)}: ${error}`);
    });
    console.log('');
  }

  if (stats.failed === 0) {
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } else {
    console.log('⚠️  Migration completed with some failures.');
    process.exit(1);
  }
}

// Run migration
main();
