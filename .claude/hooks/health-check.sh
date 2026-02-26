#!/bin/bash
# ============================================================================
# Claude Code PostToolUse Hook: Health Check
# ============================================================================
# Runs TypeScript type-check and ESLint after Edit/Write on .ts/.vue files.
# Outputs errors to stderr (exit 2) so Claude sees them and auto-fixes.
#
# Trigger: PostToolUse (Edit|Write)
# Timeout: 60s
# ============================================================================

export PATH="$HOME/.bun/bin:$PATH"

# --- Read hook input from stdin ---
INPUT=$(cat)

# --- Extract file_path (portable, no jq dependency) ---
FILE_PATH=$(echo "$INPUT" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)

# Normalize backslashes to forward slashes (Windows compatibility)
FILE_PATH=$(echo "$FILE_PATH" | tr '\\' '/')

# --- Skip non-TypeScript/Vue files ---
case "$FILE_PATH" in
  *.ts|*.tsx|*.vue) ;;
  *) exit 0 ;;
esac

# --- Skip generated/vendor/declaration files ---
case "$FILE_PATH" in
  *node_modules*|*.d.ts|*generated*|*/dist/*|*/.nuxt/*) exit 0 ;;
esac

# --- Skip test files (they often have intentional type quirks) ---
case "$FILE_PATH" in
  *.test.ts|*.spec.ts|*__tests__*|*__mocks__*) exit 0 ;;
esac

# --- Determine project root ---
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR" 2>/dev/null || exit 0

ERRORS=""
HAS_ERRORS=0

# --- Route checks based on file location ---
if [[ "$FILE_PATH" == *"frontend/"* ]] || [[ "$FILE_PATH" == *"frontend\\"* ]]; then
  # =============================================
  #  FRONTEND: vue-tsc + ESLint
  # =============================================
  cd frontend 2>/dev/null || exit 0

  # 1. ESLint auto-fix (silently fix formatting issues)
  bunx eslint "$FILE_PATH" --fix 2>/dev/null || true

  # 2. ESLint check (report remaining unfixable issues)
  ESLINT_OUT=$(bunx eslint "$FILE_PATH" 2>&1)
  if [ $? -ne 0 ]; then
    HAS_ERRORS=1
    ERRORS="${ERRORS}--- ESLint Errors ---\n${ESLINT_OUT}\n\n"
  fi

  # 3. Vue TypeScript type-check (whole project, unavoidable)
  TSC_OUT=$(bunx vue-tsc --noEmit 2>&1)
  if [ $? -ne 0 ]; then
    HAS_ERRORS=1
    # Filter to show only errors (skip warnings), limit output
    TSC_FILTERED=$(echo "$TSC_OUT" | grep -i "error TS" | head -20)
    if [ -n "$TSC_FILTERED" ]; then
      ERRORS="${ERRORS}--- vue-tsc Errors ---\n${TSC_FILTERED}\n\n"
    else
      ERRORS="${ERRORS}--- vue-tsc Errors ---\n$(echo "$TSC_OUT" | tail -30)\n\n"
    fi
  fi

elif [[ "$FILE_PATH" == *"web-installer/"* ]]; then
  # =============================================
  #  WEB INSTALLER: tsc only
  # =============================================
  if [[ "$FILE_PATH" == *"web-installer/backend/"* ]]; then
    cd web-installer/backend 2>/dev/null || exit 0
    TSC_OUT=$(bunx tsc --noEmit 2>&1)
    if [ $? -ne 0 ]; then
      HAS_ERRORS=1
      TSC_FILTERED=$(echo "$TSC_OUT" | grep -i "error TS" | head -20)
      ERRORS="${ERRORS}--- tsc Errors (web-installer/backend) ---\n${TSC_FILTERED:-$(echo "$TSC_OUT" | tail -20)}\n\n"
    fi
  fi

else
  # =============================================
  #  BACKEND: tsc --noEmit
  # =============================================
  TSC_OUT=$(bunx tsc --noEmit 2>&1)
  if [ $? -ne 0 ]; then
    HAS_ERRORS=1
    TSC_FILTERED=$(echo "$TSC_OUT" | grep -i "error TS" | head -20)
    if [ -n "$TSC_FILTERED" ]; then
      ERRORS="${ERRORS}--- tsc Errors ---\n${TSC_FILTERED}\n\n"
    else
      ERRORS="${ERRORS}--- tsc Errors ---\n$(echo "$TSC_OUT" | tail -20)\n\n"
    fi
  fi
fi

# --- Report results ---
if [ $HAS_ERRORS -ne 0 ]; then
  BASENAME=$(basename "$FILE_PATH")
  echo -e "Health check failed after editing ${BASENAME}:\n\n${ERRORS}Fix these errors before proceeding." >&2
  exit 2
fi

exit 0
