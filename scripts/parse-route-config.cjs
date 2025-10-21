#!/usr/bin/env node
/**
 * Parse route-config.ts to extract exact handler-to-path mappings
 * This eliminates sub-module false positives by understanding actual mount points
 */

const fs = require('fs');
const path = require('path');

const ROUTE_CONFIG_PATH = path.join(__dirname, '..', 'src', 'core', 'route-config.ts');

/**
 * Parse route-config.ts and extract handler-to-path mappings
 */
function parseRouteConfig() {
  const content = fs.readFileSync(ROUTE_CONFIG_PATH, 'utf8');
  const mappings = {};

  // Extract import statements to map handler names to file paths
  const importMatches = content.matchAll(/import\s+(?:{([^}]+)}|\w+)\s+from\s+['"]([^'"]+)['"]/g);
  const handlerToFilePath = {};

  for (const match of importMatches) {
    const imported = match[1] || match[0].match(/import\s+(\w+)/)?.[1];
    const filePath = match[2];

    if (imported && filePath) {
      // Handle destructured imports
      if (imported.includes(',')) {
        const handlers = imported.split(',').map(h => h.trim());
        handlers.forEach(handler => {
          handlerToFilePath[handler] = filePath;
        });
      } else {
        handlerToFilePath[imported.trim()] = filePath;
      }
    }
  }

  // Extract createRouteModule definitions
  const moduleMatches = content.matchAll(/createRouteModule\(\s*{([^}]+)}/gs);

  for (const match of moduleMatches) {
    const moduleConfig = match[1];

    // Extract handler name
    const handlerMatch = moduleConfig.match(/handler:\s*(\w+)/);
    if (!handlerMatch) continue;
    const handlerName = handlerMatch[1];

    // Extract path
    const pathMatch = moduleConfig.match(/path:\s*['"]([^'"]+)['"]/);
    if (!pathMatch) continue;
    const mountPath = pathMatch[1];

    // Get the file path for this handler
    const filePath = handlerToFilePath[handlerName];
    if (!filePath) continue;

    // Build full API path
    const fullPath = `/api${mountPath}`;

    // Only map specific handler files, not generic directories
    // Skip generic patterns like "handlers" or "modules/analytics"
    const handlerFile = filePath
      .replace(/^\.\.\//, '')
      .replace(/^@modules\//, 'modules/')
      .replace(/\.ts$/, '');

    // Only add if it's a specific file path (contains /)
    if (handlerFile.includes('/')) {
      mappings[handlerFile] = fullPath;
    }
  }

  return mappings;
}

/**
 * Generate JavaScript mapping object for the detector
 */
function generateMappingCode(mappings) {
  const entries = Object.entries(mappings)
    .map(([file, path]) => `    '${file}': '${path}'`)
    .join(',\n');

  return `const EXACT_MOUNT_POINTS = {\n${entries}\n  };`;
}

// Main execution
try {
  console.log('📖 Parsing route-config.ts...\n');

  const mappings = parseRouteConfig();
  const code = generateMappingCode(mappings);

  console.log('✅ Extracted mount point mappings:\n');
  console.log(code);
  console.log('\n');
  console.log(`📊 Total mappings: ${Object.keys(mappings).length}`);

  // Write to output file
  const outputPath = path.join(__dirname, 'route-config-mappings.json');
  fs.writeFileSync(outputPath, JSON.stringify(mappings, null, 2));
  console.log(`\n💾 Saved mappings to: ${outputPath}`);

} catch (error) {
  console.error('❌ Error parsing route-config.ts:', error);
  process.exit(1);
}
