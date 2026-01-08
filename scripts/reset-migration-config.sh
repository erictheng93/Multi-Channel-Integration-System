#!/bin/bash
# Reset WebSocket Migration Configuration to 0%
# Phase 2.1 - Safe Starting Point for Full Migration
# Project: Multi-Channel Support MVP

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_BASE="${API_BASE:-https://your-api-domain.example.com}"
TOKEN="${ADMIN_TOKEN:-}"

echo ""
echo "?î‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚???
echo "??                                                      ??
echo "??  Reset Migration Configuration to 0%                ??
echo "??  Phase 2.1 - Option B (Full Execution)              ??
echo "??                                                      ??
echo "?ö‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚???
echo ""

# Check if token is provided
if [ -z "$TOKEN" ]; then
  echo -e "${RED}??Error: ADMIN_TOKEN environment variable is not set${NC}"
  echo ""
  echo "Please provide admin token:"
  echo "  export ADMIN_TOKEN=\"your-jwt-token-here\""
  echo ""
  echo "To get token:"
  echo "  1. Login to https://your-api-domain.example.com"
  echo "  2. Open DevTools ??Application ??Local Storage"
  echo "  3. Copy 'auth_token' value"
  exit 1
fi

echo -e "${BLUE}[Step 1/4]${NC} Checking current migration status..."
CURRENT_STATUS=$(curl -s "$API_BASE/api/websocket/migration-status")
CURRENT_ROLLOUT=$(echo "$CURRENT_STATUS" | python -c "import sys, json; print(json.load(sys.stdin).get('rolloutPercentage', 'unknown'))" 2>/dev/null || echo "unknown")

echo "Current rollout: $CURRENT_ROLLOUT%"
echo ""

if [ "$CURRENT_ROLLOUT" = "0" ]; then
  echo -e "${GREEN}??Migration config is already at 0% rollout${NC}"
  echo "No changes needed."
  exit 0
fi

echo -e "${YELLOW}?†Ô?  Current rollout is $CURRENT_ROLLOUT%, will reset to 0%${NC}"
echo ""

# Confirmation prompt
read -p "Are you sure you want to reset to 0%? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Reset cancelled."
  exit 0
fi

echo ""
echo -e "${BLUE}[Step 2/4]${NC} Resetting migration configuration to 0%..."

RESET_CONFIG='{
  "enableWebSocket": true,
  "enableSSE": true,
  "migrationStrategy": "gradual",
  "rolloutPercentage": 0,
  "featureFlags": {
    "websocketConnections": false,
    "durableObjectMessaging": false,
    "distributedLocking": false,
    "batchMessageProcessing": false,
    "realTimeTypingIndicators": false
  }
}'

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "$API_BASE/api/websocket/migration-config" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$RESET_CONFIG")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo -e "${GREEN}??Migration config reset successfully${NC}"
  echo ""
else
  echo -e "${RED}??Failed to reset migration config (HTTP $HTTP_STATUS)${NC}"
  echo "Response: $BODY"
  exit 1
fi

echo -e "${BLUE}[Step 3/4]${NC} Verifying new configuration..."
sleep 2

NEW_STATUS=$(curl -s "$API_BASE/api/websocket/migration-status")
NEW_ROLLOUT=$(echo "$NEW_STATUS" | python -c "import sys, json; print(json.load(sys.stdin).get('rolloutPercentage', 'unknown'))" 2>/dev/null || echo "unknown")
WS_ENABLED=$(echo "$NEW_STATUS" | python -c "import sys, json; print(json.load(sys.stdin).get('websocketEnabled', False))" 2>/dev/null || echo "false")
SSE_ENABLED=$(echo "$NEW_STATUS" | python -c "import sys, json; print(json.load(sys.stdin).get('sseEnabled', False))" 2>/dev/null || echo "false")

echo "New configuration:"
echo "  ??Rollout Percentage: $NEW_ROLLOUT%"
echo "  ??WebSocket Enabled: $WS_ENABLED"
echo "  ??SSE Enabled: $SSE_ENABLED"
echo ""

if [ "$NEW_ROLLOUT" != "0" ]; then
  echo -e "${RED}??Verification failed: Rollout is still $NEW_ROLLOUT%${NC}"
  exit 1
fi

echo -e "${BLUE}[Step 4/4]${NC} Testing system health..."
HEALTH_RESPONSE=$(curl -s "$API_BASE/api/websocket/health")
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | python -c "import sys, json; print(json.load(sys.stdin).get('status', 'unknown'))" 2>/dev/null || echo "unknown")

echo "System health: $HEALTH_STATUS"
echo ""

echo "?ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚?"
echo -e "${GREEN}??Migration Configuration Reset Complete${NC}"
echo "?ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚??ê‚?"
echo ""
echo "Summary:"
echo "  ??Previous rollout: $CURRENT_ROLLOUT%"
echo "  ??New rollout: 0%"
echo "  ??All users now using SSE (fallback mode)"
echo "  ??WebSocket infrastructure ready for gradual rollout"
echo ""
echo "Next Steps:"
echo "  1. Run validation tests: TEST_TOKEN=\$ADMIN_TOKEN bash scripts/test-websocket-do.sh"
echo "  2. Implement frontend unified connection manager"
echo "  3. Configure monitoring dashboard"
echo "  4. Start Week 3 with 5% canary deployment"
echo ""
echo "Documentation:"
echo "  ??Full Plan: PHASE2_MIGRATION_PLAN.md"
echo "  ??Quick Start: WEBSOCKET_MIGRATION_QUICK_START.md"
echo ""
