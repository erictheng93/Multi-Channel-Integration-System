#!/usr/bin/env bash
# Validate codebase-memory-mcp availability and the CLI fallback path used when
# Codex does not expose a required MCP tool in the current session.

set -u

PROJECT_NAME="${CODEBASE_MEMORY_PROJECT:-Users-eric-Documents-Code-Multi-Channel-Integration-System}"
CBM_BIN="${CODEBASE_MEMORY_BIN:-/Users/eric/.local/bin/codebase-memory-mcp}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

CHECKS_PASSED=0
CHECKS_FAILED=0

print_header() {
  echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

pass() {
  echo -e "  ${GREEN}✓${NC} $1"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
}

fail() {
  echo -e "  ${RED}✗${NC} $1"
  CHECKS_FAILED=$((CHECKS_FAILED + 1))
}

warn() {
  echo -e "  ${YELLOW}!${NC} $1"
}

run_json_tool() {
  local tool="$1"
  local args="$2"
  printf '%s' "$args" | "$CBM_BIN" cli "$tool"
}

print_header "codebase-memory-mcp"
echo "  Binary:  $CBM_BIN"
echo "  Project: $PROJECT_NAME"

if [ -x "$CBM_BIN" ]; then
  pass "binary exists and is executable"
else
  fail "binary is missing or not executable"
fi

VERSION_OUT=$("$CBM_BIN" --version 2>&1)
if [ $? -eq 0 ]; then
  pass "$VERSION_OUT"
else
  fail "version check failed"
  echo "$VERSION_OUT" | sed 's/^/    /'
fi

HELP_OUT=$("$CBM_BIN" --help 2>&1)
if echo "$HELP_OUT" | grep -q "detect_changes"; then
  pass "binary advertises detect_changes"
else
  fail "binary help does not list detect_changes"
fi

PROJECT_ARGS="{\"project\":\"$PROJECT_NAME\"}"

echo -e "\n  Checking index status..."
INDEX_OUT=$(run_json_tool index_status "$PROJECT_ARGS" 2>&1)
if [ $? -eq 0 ] && echo "$INDEX_OUT" | grep -q '"status":"ready"'; then
  pass "index_status reports ready"
else
  fail "index_status did not report ready"
  echo "$INDEX_OUT" | sed -n '1,20p' | sed 's/^/    /'
fi

echo -e "\n  Checking detect_changes CLI fallback..."
DETECT_OUT=$(run_json_tool detect_changes "$PROJECT_ARGS" 2>&1)
if [ $? -eq 0 ] && echo "$DETECT_OUT" | grep -q '"changed_files"'; then
  pass "detect_changes CLI fallback works"
else
  fail "detect_changes CLI fallback failed"
  echo "$DETECT_OUT" | sed -n '1,40p' | sed 's/^/    /'
fi

if [ -n "${CODEBASE_MEMORY_REQUIRE_MCP_TOOL:-}" ]; then
  warn "This script validates the binary and CLI fallback, not Codex's in-session MCP tool registry."
fi

print_header "Summary"
echo -e "  Passed: ${GREEN}$CHECKS_PASSED${NC}"
echo -e "  Failed: ${RED}$CHECKS_FAILED${NC}"

if [ "$CHECKS_FAILED" -eq 0 ]; then
  echo -e "\n${GREEN}  codebase-memory-mcp is usable; MCP detect_changes can safely fall back to CLI.${NC}"
  exit 0
fi

echo -e "\n${RED}  codebase-memory-mcp validation failed.${NC}"
exit 1
