#!/bin/bash
# ============================================================================
# Project Health Check Script
# ============================================================================
# Runs all quality checks: TypeScript type-check + ESLint for both
# backend and frontend. Use this for manual verification.
#
# Usage:
#   bash scripts/check.sh          # Run all checks
#   bash scripts/check.sh backend  # Backend only
#   bash scripts/check.sh frontend # Frontend only
# ============================================================================

export PATH="$HOME/.bun/bin:$PATH"

BUN_CMD="${BUN_CMD:-bun}"
BUNX_CMD="${BUNX_CMD:-bunx}"

if ! command -v "$BUN_CMD" >/dev/null 2>&1 && command -v bun.exe >/dev/null 2>&1; then
  BUN_CMD="bun.exe"
fi

if ! command -v "$BUNX_CMD" >/dev/null 2>&1 && command -v bunx.exe >/dev/null 2>&1; then
  BUNX_CMD="bunx.exe"
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCOPE="${1:-all}"
TOTAL_ERRORS=0
CHECKS_PASSED=0
CHECKS_FAILED=0

print_header() {
  echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_pass() {
  echo -e "  ${GREEN}✓${NC} $1"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
}

print_fail() {
  echo -e "  ${RED}✗${NC} $1"
  CHECKS_FAILED=$((CHECKS_FAILED + 1))
}

# ── Backend Checks ──────────────────────────────────────────────
run_backend_checks() {
  print_header "Backend Checks"

  # 1. TypeScript compilation
  echo -e "\n  Checking backend TypeScript..."
  TSC_OUT=$("$BUNX_CMD" tsc --noEmit 2>&1)
  if [ $? -eq 0 ]; then
    print_pass "tsc --noEmit (backend)"
  else
    print_fail "tsc --noEmit (backend)"
    echo "$TSC_OUT" | grep -i "error TS" | head -10 | sed 's/^/    /'
    TOTAL_ERRORS=$((TOTAL_ERRORS + $(echo "$TSC_OUT" | grep -c "error TS")))
  fi

  # 2. Import path check
  echo -e "\n  Checking import paths..."
  IMPORT_OUT=$("$BUNX_CMD" tsx scripts/check-import-paths.ts 2>&1)
  if [ $? -eq 0 ]; then
    print_pass "Import path check"
  else
    print_fail "Import path check"
    echo "$IMPORT_OUT" | head -5 | sed 's/^/    /'
  fi

  # 3. Route conflict check
  echo -e "\n  Checking route conflicts..."
  ROUTE_OUT=$("$BUN_CMD" run check:routes:ci 2>&1)
  if [ $? -eq 0 ]; then
    print_pass "Route conflict check"
  else
    print_fail "Route conflict check"
    echo "$ROUTE_OUT" | head -5 | sed 's/^/    /'
  fi
}

# ── Frontend Checks ─────────────────────────────────────────────
run_frontend_checks() {
  print_header "Frontend Checks"
  cd frontend 2>/dev/null || { print_fail "Cannot cd to frontend/"; return; }

  # 1. Vue TypeScript compilation
  echo -e "\n  Checking frontend TypeScript..."
  TSC_OUT=$("$BUNX_CMD" vue-tsc --noEmit 2>&1)
  if [ $? -eq 0 ]; then
    print_pass "vue-tsc --noEmit (frontend)"
  else
    print_fail "vue-tsc --noEmit (frontend)"
    echo "$TSC_OUT" | grep -i "error TS" | head -10 | sed 's/^/    /'
    TOTAL_ERRORS=$((TOTAL_ERRORS + $(echo "$TSC_OUT" | grep -c "error TS")))
  fi

  # 2. ESLint check
  echo -e "\n  Checking ESLint..."
  ESLINT_OUT=$("$BUN_CMD" run lint:check 2>&1)
  if [ $? -eq 0 ]; then
    print_pass "ESLint (frontend)"
  else
    print_fail "ESLint (frontend)"
    echo "$ESLINT_OUT" | grep -E "error|warning" | head -10 | sed 's/^/    /'
    TOTAL_ERRORS=$((TOTAL_ERRORS + $(echo "$ESLINT_OUT" | grep -c "error")))
  fi

  # 3. Scoped .btn redefinition guard
  echo -e "\n  Checking scoped .btn redefinitions..."
  BTN_OUT=$("$BUN_CMD" run lint:scoped-btn 2>&1)
  if [ $? -eq 0 ]; then
    print_pass "Scoped .btn guard"
  else
    print_fail "Scoped .btn guard"
    echo "$BTN_OUT" | head -20 | sed 's/^/    /'
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
  fi

  cd ..
}

# ── Main ────────────────────────────────────────────────────────
echo -e "${YELLOW}Project Health Check${NC}"
echo -e "Running quality checks for: ${BLUE}${SCOPE}${NC}"

START_TIME=$(date +%s)

case "$SCOPE" in
  backend)
    run_backend_checks
    ;;
  frontend)
    run_frontend_checks
    ;;
  all|*)
    run_backend_checks
    run_frontend_checks
    ;;
esac

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# ── Summary ─────────────────────────────────────────────────────
print_header "Summary"
echo -e "  Passed: ${GREEN}${CHECKS_PASSED}${NC}"
echo -e "  Failed: ${RED}${CHECKS_FAILED}${NC}"
echo -e "  Errors: ${TOTAL_ERRORS}"
echo -e "  Time:   ${DURATION}s"

if [ $CHECKS_FAILED -eq 0 ]; then
  echo -e "\n${GREEN}  All checks passed!${NC}\n"
  exit 0
else
  echo -e "\n${RED}  Some checks failed. Please fix the errors above.${NC}\n"
  exit 1
fi
