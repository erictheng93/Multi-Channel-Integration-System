#!/bin/bash
# Daily Health Check Script
# Phase 2.3 - Monitoring & Alerting
# Runs automated health checks and generates daily reports

set -e

# Configuration
API_BASE="${API_BASE:-https://your-api-domain.example.com}"
TOKEN="${ADMIN_TOKEN:-}"
DATE=$(date +%Y-%m-%d)
REPORT_DIR="logs/daily-reports"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Create report directory
mkdir -p "$REPORT_DIR"

echo ""
echo "?”â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â???
echo "??        Daily Health Check - $DATE            ??
echo "?šâ??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â???
echo ""

# Check 1: System Health
echo -e "${BLUE}[Check 1/7]${NC} System Health Status"
HEALTH=$(curl -s "$API_BASE/api/websocket/health")
HEALTH_STATUS=$(echo "$HEALTH" | python -c "import sys, json; print(json.load(sys.stdin).get('status', 'unknown'))" 2>/dev/null || echo "unknown")

if [ "$HEALTH_STATUS" = "healthy" ]; then
  echo -e "${GREEN}??System is healthy${NC}"
else
  echo -e "${RED}??System status: $HEALTH_STATUS${NC}"
fi
echo ""

# Check 2: Migration Config
echo -e "${BLUE}[Check 2/7]${NC} Migration Configuration"
CONFIG=$(curl -s "$API_BASE/api/websocket/migration-status")
ROLLOUT=$(echo "$CONFIG" | python -c "import sys, json; print(json.load(sys.stdin).get('rolloutPercentage', 0))" 2>/dev/null || echo "0")
echo "Current rollout: $ROLLOUT%"
echo ""

# Check 3: WebSocket Metrics (requires auth)
echo -e "${BLUE}[Check 3/7]${NC} WebSocket Metrics"
if [ -n "$TOKEN" ]; then
  METRICS=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_BASE/api/websocket/metrics")
  TOTAL_CONNS=$(echo "$METRICS" | python -c "import sys, json; data=json.load(sys.stdin); print(data.get('connections',{}).get('totalConnections',0))" 2>/dev/null || echo "0")
  echo "Total connections: $TOTAL_CONNS"
else
  echo -e "${YELLOW}? ï?  Skipped (no admin token)${NC}"
fi
echo ""

# Check 4: Database Status
echo -e "${BLUE}[Check 4/7]${NC} Database Connectivity"
DB_STATUS=$(echo "$HEALTH" | python -c "import sys, json; data=json.load(sys.stdin); comps=data.get('components',{}); print(comps.get('database',{}).get('status','unknown'))" 2>/dev/null || echo "unknown")
if [ "$DB_STATUS" = "healthy" ]; then
  echo -e "${GREEN}??Database is operational${NC}"
else
  echo -e "${RED}??Database status: $DB_STATUS${NC}"
fi
echo ""

# Check 5: KV Storage
echo -e "${BLUE}[Check 5/7]${NC} KV Storage Status"
KV_STATUS=$(echo "$HEALTH" | python -c "import sys, json; data=json.load(sys.stdin); comps=data.get('components',{}); print(comps.get('kv',{}).get('status','unknown'))" 2>/dev/null || echo "unknown")
if [ "$KV_STATUS" = "healthy" ]; then
  echo -e "${GREEN}??KV storage is operational${NC}"
else
  echo -e "${RED}??KV storage status: $KV_STATUS${NC}"
fi
echo ""

# Check 6: Durable Objects
echo -e "${BLUE}[Check 6/7]${NC} Durable Objects Availability"
DO_STATUS=$(echo "$HEALTH" | python -c "import sys, json; data=json.load(sys.stdin); comps=data.get('components',{}); print(comps.get('durableObjects',{}).get('status','unknown'))" 2>/dev/null || echo "unknown")
if [ "$DO_STATUS" = "healthy" ]; then
  echo -e "${GREEN}??Durable Objects are available${NC}"
else
  echo -e "${RED}??Durable Objects status: $DO_STATUS${NC}"
fi
echo ""

# Check 7: SSE Fallback
echo -e "${BLUE}[Check 7/7]${NC} SSE Fallback Availability"
SSE_STATUS=$(echo "$HEALTH" | python -c "import sys, json; data=json.load(sys.stdin); comps=data.get('components',{}); print(comps.get('sse',{}).get('status','unknown'))" 2>/dev/null || echo "unknown")
if [ "$SSE_STATUS" = "healthy" ]; then
  echo -e "${GREEN}??SSE fallback is available${NC}"
else
  echo -e "${YELLOW}? ï?  SSE fallback status: $SSE_STATUS${NC}"
fi
echo ""

# Generate summary report
REPORT_FILE="$REPORT_DIR/health-check-$DATE.txt"
cat > "$REPORT_FILE" <<EOF
Daily Health Check Report
Date: $DATE
Generated: $(date)

=== Summary ===
System Health: $HEALTH_STATUS
Current Rollout: $ROLLOUT%
Total Connections: $TOTAL_CONNS

=== Components Status ===
Database: $DB_STATUS
KV Storage: $KV_STATUS
Durable Objects: $DO_STATUS
SSE Fallback: $SSE_STATUS

=== Raw Data ===
Health Response:
$HEALTH

Migration Config:
$CONFIG
EOF

echo "?â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â?"
echo -e "${GREEN}??Daily health check completed${NC}"
echo "?â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â??â?"
echo ""
echo "Report saved to: $REPORT_FILE"
echo ""
