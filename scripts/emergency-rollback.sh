#!/bin/bash

###############################################################################
# Emergency Rollback Script - WebSocket Deployment
# 緊急回滾腳本 - WebSocket 部署
#
# Purpose: Quickly rollback WebSocket deployment in case of critical issues
# 用途: 在出現嚴重問題時快速回滾 WebSocket 部署
#
# Usage:
#   ./scripts/emergency-rollback.sh [rollback-level]
#
# Rollback Levels:
#   safe      - Rollback to previous stable percentage (default)
#   emergency - Rollback to 0% (complete fallback to SSE)
#   partial   - Rollback to 25% (minimal WebSocket)
#
# Examples:
#   ./scripts/emergency-rollback.sh safe      # Rollback to previous %
#   ./scripts/emergency-rollback.sh emergency # Complete SSE fallback
#   ./scripts/emergency-rollback.sh partial   # Rollback to 25%
#
###############################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="${API_BASE_URL:-https://multi-channel.imfinethankyouandyou.com}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@dacit.net}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-16011587DaC}"
ROLLBACK_LEVEL="${1:-safe}"

# Rollback target percentages
SAFE_ROLLBACK=50       # Previous stable percentage
PARTIAL_ROLLBACK=25    # Minimal WebSocket
EMERGENCY_ROLLBACK=0   # Complete SSE fallback

# Log file
LOG_FILE="logs/emergency-rollback-$(date +%Y%m%d-%H%M%S).log"
mkdir -p logs

###############################################################################
# Utility Functions
###############################################################################

log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    case $level in
        INFO)
            echo -e "${BLUE}[INFO]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        SUCCESS)
            echo -e "${GREEN}[SUCCESS]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        WARNING)
            echo -e "${YELLOW}[WARNING]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        ERROR)
            echo -e "${RED}[ERROR]${NC} $message" | tee -a "$LOG_FILE"
            ;;
    esac

    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

confirm_action() {
    local prompt="$1"

    echo -e "${YELLOW}⚠️  CONFIRMATION REQUIRED${NC}"
    echo -e "${YELLOW}$prompt${NC}"
    echo -e "${YELLOW}Type 'YES' to confirm, anything else to abort:${NC} "
    read -r response

    if [ "$response" != "YES" ]; then
        log ERROR "Rollback aborted by user"
        exit 1
    fi
}

get_auth_token() {
    log INFO "Authenticating with API..."

    local response=$(curl -s -X POST "$API_BASE_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

    local token=$(echo "$response" | grep -o '"token":"[^"]*' | sed 's/"token":"//')

    if [ -z "$token" ]; then
        log ERROR "Failed to authenticate: $response"
        exit 1
    fi

    log SUCCESS "Authentication successful"
    echo "$token"
}

get_current_config() {
    local token=$1

    log INFO "Fetching current WebSocket configuration..."

    local response=$(curl -s "$API_BASE_URL/api/websocket/dashboard/migration-config" \
        -H "Authorization: Bearer $token")

    echo "$response"
}

update_rollout_percentage() {
    local token=$1
    local percentage=$2
    local reason=$3

    log INFO "Updating rollout percentage to $percentage%..."

    local payload=$(cat <<EOF
{
    "rolloutPercentage": $percentage,
    "enableWebSocket": $([ $percentage -gt 0 ] && echo "true" || echo "false"),
    "enableSSE": true,
    "migrationStrategy": "gradual",
    "rollbackReason": "$reason",
    "rollbackTimestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
)

    local response=$(curl -s -X PUT "$API_BASE_URL/api/websocket/dashboard/migration-config" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "$payload")

    echo "$response"
}

verify_rollback() {
    local token=$1
    local expected_percentage=$2

    log INFO "Verifying rollback configuration..."

    local config=$(get_current_config "$token")
    local actual_percentage=$(echo "$config" | grep -o '"rolloutPercentage":[0-9]*' | sed 's/"rolloutPercentage"://')

    if [ "$actual_percentage" = "$expected_percentage" ]; then
        log SUCCESS "Rollback verified: Rollout percentage is now $actual_percentage%"
        return 0
    else
        log ERROR "Rollback verification failed: Expected $expected_percentage%, got $actual_percentage%"
        return 1
    fi
}

get_system_health() {
    local token=$1

    log INFO "Checking system health..."

    local health=$(curl -s "$API_BASE_URL/api/health/health" \
        -H "Authorization: Bearer $token")

    echo "$health"
}

send_rollback_notification() {
    local rollback_level=$1
    local old_percentage=$2
    local new_percentage=$3
    local reason=$4

    log INFO "Sending rollback notifications..."

    # This would integrate with your notification service
    # For now, just log it
    local message=$(cat <<EOF
🚨 EMERGENCY ROLLBACK EXECUTED 🚨

Rollback Level: $rollback_level
Previous Rollout: $old_percentage%
New Rollout: $new_percentage%
Reason: $reason
Timestamp: $(date '+%Y-%m-%d %H:%M:%S UTC')

Action Required:
1. Monitor system health dashboard
2. Review error logs
3. Investigate root cause
4. Plan remediation steps

Dashboard: $API_BASE_URL/websocket-monitoring
EOF
)

    log WARNING "$message"

    # Send to Slack/Teams/Email if configured
    # curl -X POST $WEBHOOK_URL -d "{\"text\":\"$message\"}"
}

###############################################################################
# Rollback Execution
###############################################################################

execute_rollback() {
    local rollback_level=$1

    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║        🚨 EMERGENCY ROLLBACK SCRIPT 🚨                    ║"
    echo "║                                                           ║"
    echo "║  WebSocket Deployment Rollback Tool                      ║"
    echo "║  Version: 1.0.0                                           ║"
    echo "║  Date: $(date '+%Y-%m-%d %H:%M:%S')                          ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""

    # Determine target percentage
    local target_percentage
    local rollback_description

    case $rollback_level in
        safe)
            target_percentage=$SAFE_ROLLBACK
            rollback_description="Safe Rollback (Previous Stable: $SAFE_ROLLBACK%)"
            ;;
        partial)
            target_percentage=$PARTIAL_ROLLBACK
            rollback_description="Partial Rollback (Minimal WebSocket: $PARTIAL_ROLLBACK%)"
            ;;
        emergency)
            target_percentage=$EMERGENCY_ROLLBACK
            rollback_description="Emergency Rollback (Complete SSE Fallback: 0%)"
            ;;
        *)
            log ERROR "Unknown rollback level: $rollback_level"
            echo "Valid levels: safe, partial, emergency"
            exit 1
            ;;
    esac

    log INFO "Rollback Level: $rollback_level"
    log INFO "Target Percentage: $target_percentage%"
    log INFO "Description: $rollback_description"
    echo ""

    # Get authentication token
    TOKEN=$(get_auth_token)
    echo ""

    # Get current configuration
    CURRENT_CONFIG=$(get_current_config "$TOKEN")
    CURRENT_PERCENTAGE=$(echo "$CURRENT_CONFIG" | grep -o '"rolloutPercentage":[0-9]*' | sed 's/"rolloutPercentage"://')

    log INFO "Current Rollout Percentage: ${CURRENT_PERCENTAGE:-Unknown}%"
    echo ""

    # Confirm action
    confirm_action "About to execute $rollback_description

This will:
  - Change WebSocket rollout from ${CURRENT_PERCENTAGE:-Unknown}% to $target_percentage%
  - $([ $target_percentage -eq 0 ] && echo "Disable WebSocket completely" || echo "Reduce WebSocket usage")
  - Enable SSE fallback for affected users
  - Log the rollback event

This action CANNOT be undone automatically."

    echo ""
    log INFO "Rollback confirmed. Executing..."
    echo ""

    # Execute rollback
    ROLLBACK_REASON="Emergency rollback from ${CURRENT_PERCENTAGE}% to $target_percentage% - Manual intervention via emergency-rollback.sh"

    RESULT=$(update_rollout_percentage "$TOKEN" "$target_percentage" "$ROLLBACK_REASON")

    if echo "$RESULT" | grep -q '"success":true'; then
        log SUCCESS "Rollback configuration updated"
    else
        log ERROR "Failed to update rollback configuration: $RESULT"
        exit 1
    fi

    echo ""

    # Verify rollback
    if verify_rollback "$TOKEN" "$target_percentage"; then
        log SUCCESS "Rollback verification passed"
    else
        log ERROR "Rollback verification failed"
        exit 1
    fi

    echo ""

    # Check system health
    HEALTH=$(get_system_health "$TOKEN")
    log INFO "System Health Status:"
    echo "$HEALTH" | tee -a "$LOG_FILE"

    echo ""

    # Send notifications
    send_rollback_notification "$rollback_level" "${CURRENT_PERCENTAGE:-Unknown}" "$target_percentage" "$ROLLBACK_REASON"

    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║        ✅ ROLLBACK COMPLETED SUCCESSFULLY ✅              ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""

    log SUCCESS "Rollback Summary:"
    log SUCCESS "  - Rollout changed from ${CURRENT_PERCENTAGE}% → $target_percentage%"
    log SUCCESS "  - WebSocket: $([ $target_percentage -gt 0 ] && echo "Enabled ($target_percentage%)" || echo "Disabled")"
    log SUCCESS "  - SSE Fallback: Enabled"
    log SUCCESS "  - Log file: $LOG_FILE"
    echo ""

    log WARNING "Next Steps:"
    log WARNING "  1. Monitor WebSocket Dashboard: $API_BASE_URL/websocket-monitoring"
    log WARNING "  2. Review error logs and metrics"
    log WARNING "  3. Investigate root cause of issues"
    log WARNING "  4. Test fixes in staging environment"
    log WARNING "  5. Plan gradual re-rollout when ready"
    echo ""

    log INFO "To restore previous configuration, run:"
    log INFO "  curl -X POST $API_BASE_URL/api/websocket/dashboard/restore-previous-config \\"
    log INFO "       -H 'Authorization: Bearer YOUR_TOKEN'"
    echo ""
}

###############################################################################
# Pre-flight Checks
###############################################################################

preflight_checks() {
    log INFO "Running pre-flight checks..."

    # Check if API is accessible
    if ! curl -s -o /dev/null -w "%{http_code}" "$API_BASE_URL/api/health/health" | grep -q "200"; then
        log ERROR "API is not accessible at $API_BASE_URL"
        exit 1
    fi

    log SUCCESS "API is accessible"

    # Check if curl is installed
    if ! command -v curl &> /dev/null; then
        log ERROR "curl is not installed"
        exit 1
    fi

    log SUCCESS "curl is available"

    # Check if jq is installed (optional but recommended)
    if ! command -v jq &> /dev/null; then
        log WARNING "jq is not installed (optional, but recommended for better JSON parsing)"
    else
        log SUCCESS "jq is available"
    fi

    log SUCCESS "Pre-flight checks passed"
    echo ""
}

###############################################################################
# Main Execution
###############################################################################

main() {
    preflight_checks
    execute_rollback "$ROLLBACK_LEVEL"
}

# Run main function
main
