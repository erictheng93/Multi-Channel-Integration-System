#!/bin/bash
# Audit D1 for conversations created within a window that have no messages.
#
# Background: 2026-05-25 incident where findOrCreateConversation pre-emptively
# updated last_message_at on existing conversations, producing "ghost" rows
# (conversation list shows the row but the detail view has no message). The
# 2026-05-26 fix moves all last_message_at writes into saveMessage(); this
# script monitors for any regression by counting orphaned conversations.
#
# Usage:
#   bash scripts/check-ghost-conversations.sh           # default 7-day window
#   bash scripts/check-ghost-conversations.sh 30        # 30-day window
#   THRESHOLD_WARN=1 THRESHOLD_CRIT=5 bash scripts/check-ghost-conversations.sh
#
# Exit codes: 0 = OK, 1 = warn (>= THRESHOLD_WARN), 2 = critical / error.

set -u

DAYS="${1:-7}"
THRESHOLD_WARN="${THRESHOLD_WARN:-1}"
THRESHOLD_CRIT="${THRESHOLD_CRIT:-5}"
DB_NAME="${DB_NAME:-mcis-db}"

read -r -d '' SQL <<EOF || true
SELECT count(*) AS ghost_count
FROM conversations c
WHERE NOT EXISTS (
  SELECT 1 FROM messages m WHERE m.conversation_id = c.id
)
AND c.deleted_at IS NULL
AND c.created_at >= datetime('now', '-${DAYS} days')
EOF

# Invoke wrangler via node directly to avoid the .cmd shim quote-loss bug on
# Windows (see CLAUDE.md memory: reference_wrangler_windows_cli).
RAW=$(node node_modules/wrangler/bin/wrangler.js d1 execute "$DB_NAME" --remote --json --command "$SQL" 2>&1) || {
  echo "ERROR: wrangler invocation failed"
  echo "$RAW"
  exit 2
}

COUNT=$(echo "$RAW" | python -c "import sys, json
data = json.load(sys.stdin)
if isinstance(data, list):
    data = data[0]
print(data['results'][0]['ghost_count'])" 2>/dev/null) || {
  echo "ERROR: could not parse wrangler output"
  echo "$RAW"
  exit 2
}

WINDOW_LABEL="last ${DAYS} day"
[ "$DAYS" != "1" ] && WINDOW_LABEL="${WINDOW_LABEL}s"

echo "Ghost conversations (no messages, ${WINDOW_LABEL}): ${COUNT}"

if [ "$COUNT" -ge "$THRESHOLD_CRIT" ]; then
  echo "CRITICAL: ghost count ${COUNT} >= ${THRESHOLD_CRIT}"
  echo "Investigate via:"
  echo "  bun run db:query --command \"SELECT id, customer_id, created_at FROM conversations c WHERE NOT EXISTS (SELECT 1 FROM messages WHERE conversation_id = c.id) AND deleted_at IS NULL AND created_at >= datetime('now', '-${DAYS} days') ORDER BY created_at DESC\""
  exit 2
elif [ "$COUNT" -ge "$THRESHOLD_WARN" ]; then
  echo "WARN: ghost count ${COUNT} >= ${THRESHOLD_WARN}"
  exit 1
fi

echo "OK"
exit 0
