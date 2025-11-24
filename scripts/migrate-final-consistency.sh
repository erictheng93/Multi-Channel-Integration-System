#!/bin/bash
# Migrate test files and scripts to use createDbClient
# 遷移測試文件和腳本以使用 createDbClient

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Final Migration: Tests & Scripts to 100% Consistency       ║"
echo "║  最終遷移：測試文件和腳本達成 100% 一致性                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Files to migrate
TEST_FILES=(
  "tests/integration/reports-analytics-api.test.ts"
  "tests/performance/analytics-stress-test.test.ts"
  "tests/edge-cases/analytics-edge-cases.test.ts"
  "tests/e2e/analytics-real-d1-simplified.test.ts"
)

SCRIPT_FILES=(
  "scripts/admin/create-dacit-admin.ts"
)

MIGRATED=0
FAILED=0

echo "### Phase 1: Migrating Test Files"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

for file in "${TEST_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "⚠️  File not found: $file"
    continue
  fi

  echo "Processing: $file"

  # Backup
  cp "$file" "$file.backup"

  # Replace import statement
  # Handle both single and multi-line imports
  sed -i "s|import { drizzle } from 'drizzle-orm/d1';|import { createDbClient } from '@/db/drizzle-factory';\nimport type { Database } from '@/db/drizzle-factory';|g" "$file"

  # Replace type usage
  sed -i "s|ReturnType<typeof drizzle>|Database|g" "$file"

  # Replace drizzle() calls
  sed -i 's/drizzle(mockD1)/createDbClient(mockD1)/g' "$file"
  sed -i 's/drizzle(testD1)/createDbClient(testD1)/g' "$file"
  sed -i 's/database: drizzle(/database: createDbClient(/g' "$file"

  # Verify changes
  if grep -q "createDbClient" "$file"; then
    echo "  ✓ Migrated successfully"
    rm "$file.backup"
    ((MIGRATED++))
  else
    echo "  ✗ Migration failed, restoring backup"
    mv "$file.backup" "$file"
    ((FAILED++))
  fi

  echo ""
done

echo "### Phase 2: Migrating Script Files"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

for file in "${SCRIPT_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "⚠️  File not found: $file"
    continue
  fi

  echo "Processing: $file"

  # Backup
  cp "$file" "$file.backup"

  # Replace import statement
  sed -i "s|import { drizzle } from 'drizzle-orm/d1';|import { createDbClient } from '../../src/db/drizzle-factory';|g" "$file"

  # Replace drizzle() calls
  sed -i 's/drizzle(sqliteDb as any)/createDbClient(sqliteDb as any)/g' "$file"
  sed -i 's/const db = drizzle(/const db = createDbClient(/g' "$file"

  # Verify changes
  if grep -q "createDbClient" "$file"; then
    echo "  ✓ Migrated successfully"
    rm "$file.backup"
    ((MIGRATED++))
  else
    echo "  ✗ Migration failed, restoring backup"
    mv "$file.backup" "$file"
    ((FAILED++))
  fi

  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "### Migration Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Successfully migrated: $MIGRATED"
echo "Failed:                $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "✅ All files migrated successfully!"
  echo ""
  echo "Next steps:"
  echo "  1. Run tests to verify no breaking changes"
  echo "  2. Commit and push changes"
  exit 0
else
  echo "⚠️  Some files failed to migrate."
  exit 1
fi
