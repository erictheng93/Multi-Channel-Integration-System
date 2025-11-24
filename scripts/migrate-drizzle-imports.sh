#!/bin/bash
# Automated Drizzle Import Migration Script
# 自動化 Drizzle 導入遷移腳本
#
# This script migrates all files from:
#   import { drizzle } from 'drizzle-orm/d1';
#   drizzle(c.env.DB)
# To:
#   import { createDbClient } from '../db/drizzle-factory';
#   createDbClient(c.env.DB)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
TOTAL_FILES=0
MIGRATED_FILES=0
SKIPPED_FILES=0
FAILED_FILES=0

echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Drizzle Import Migration Script                            ║${NC}"
echo -e "${GREEN}║  自動化 Drizzle 導入遷移腳本                                 ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Find all TypeScript files that import drizzle
echo -e "${YELLOW}Finding files that use drizzle()...${NC}"
FILES=$(grep -rl "import.*drizzle.*from.*'drizzle-orm/d1'" src/ 2>/dev/null || true)

if [ -z "$FILES" ]; then
  echo -e "${GREEN}✅ No files found with old drizzle import. Migration may already be complete!${NC}"
  exit 0
fi

TOTAL_FILES=$(echo "$FILES" | wc -l)
echo -e "${YELLOW}Found ${TOTAL_FILES} files to migrate${NC}"
echo ""

# Migrate each file
for FILE in $FILES; do
  echo -e "Processing: ${FILE}"

  # Check if file exists
  if [ ! -f "$FILE" ]; then
    echo -e "${RED}  ✗ File not found, skipping${NC}"
    ((SKIPPED_FILES++))
    continue
  fi

  # Check if already migrated
  if grep -q "createDbClient" "$FILE"; then
    echo -e "${YELLOW}  ⊙ Already migrated, skipping${NC}"
    ((SKIPPED_FILES++))
    continue
  fi

  # Calculate relative path to db/drizzle-factory
  DIR=$(dirname "$FILE")
  DEPTH=$(echo "$DIR" | tr -cd '/' | wc -c)
  DEPTH=$((DEPTH - 1)) # Subtract 1 for 'src'

  # Build relative path
  if [ $DEPTH -eq 0 ]; then
    IMPORT_PATH="./db/drizzle-factory"
  else
    DOTS=$(printf '../%.0s' $(seq 1 $DEPTH))
    IMPORT_PATH="${DOTS}db/drizzle-factory"
  fi

  # Create backup
  cp "$FILE" "$FILE.backup"

  # Perform migration
  # 1. Replace import statement
  sed -i "s|import { drizzle } from 'drizzle-orm/d1';|import { createDbClient } from '${IMPORT_PATH}';|g" "$FILE"

  # 2. Replace drizzle(c.env.DB) calls
  sed -i 's/drizzle(c\.env\.DB)/createDbClient(c.env.DB)/g' "$FILE"
  sed -i 's/drizzle(c\.env\.DB_PROD)/createDbClient(c.env.DB_PROD)/g' "$FILE"

  # 3. Replace variable declarations
  sed -i 's/const db = drizzle(/const db = createDbClient(/g' "$FILE"
  sed -i 's/const drizzleDb = drizzle(/const drizzleDb = createDbClient(/g' "$FILE"

  # Check if migration was successful
  if grep -q "createDbClient" "$FILE"; then
    echo -e "${GREEN}  ✓ Migrated successfully${NC}"
    ((MIGRATED_FILES++))
    # Remove backup
    rm "$FILE.backup"
  else
    echo -e "${RED}  ✗ Migration failed, restoring backup${NC}"
    mv "$FILE.backup" "$FILE"
    ((FAILED_FILES++))
  fi

  echo ""
done

# Summary
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Migration Summary                                           ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo -e "Total files found:     ${TOTAL_FILES}"
echo -e "${GREEN}Successfully migrated: ${MIGRATED_FILES}${NC}"
echo -e "${YELLOW}Skipped (already done): ${SKIPPED_FILES}${NC}"
echo -e "${RED}Failed:                ${FAILED_FILES}${NC}"
echo ""

if [ $FAILED_FILES -eq 0 ]; then
  echo -e "${GREEN}✅ Migration completed successfully!${NC}"
  exit 0
else
  echo -e "${RED}⚠️  Some files failed to migrate. Please review manually.${NC}"
  exit 1
fi
