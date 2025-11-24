#!/bin/bash
# Migrate remaining service files

FILES=(
  "src/modules/teams/services/team-service.ts"
  "src/modules/teams/services/qr-service.ts"
  "src/modules/system/services/system-service.ts"
  "src/modules/integrations/services/channel-service.ts"
  "src/modules/integrations/services/webhook-security-service.ts"
  "src/modules/conversations/services/conversation-service.ts"
  "src/modules/conversations/services/message-service.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing: $file"

    # Calculate relative path to drizzle-factory
    dir=$(dirname "$file")
    depth=$(echo "$dir" | tr -cd '/' | wc -c)
    depth=$((depth - 1))

    if [ $depth -eq 2 ]; then
      # modules/teams/services -> ../../db/drizzle-factory
      import_path="../../../db/drizzle-factory"
    elif [ $depth -eq 1 ]; then
      # services -> ../db/drizzle-factory
      import_path="../db/drizzle-factory"
    else
      import_path="@/db/drizzle-factory"
    fi

    # Replace imports
    sed -i "s|import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1';|import { createDbClient } from '${import_path}';\nimport type { DrizzleD1Database } from 'drizzle-orm/d1';|g" "$file"
    sed -i "s|import { drizzle } from 'drizzle-orm/d1';|import { createDbClient } from '${import_path}';|g" "$file"

    # Replace drizzle() calls
    sed -i 's/drizzle(db)/createDbClient(db)/g' "$file"
    sed -i 's/drizzle(this\.db)/createDbClient(this.db)/g' "$file"

    echo "  ✓ Done"
  fi
done

echo ""
echo "✅ Migration complete!"
