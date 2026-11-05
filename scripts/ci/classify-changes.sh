#!/usr/bin/env bash
# Decide which CI/CD jobs a change needs (used by the `changes` job in
# .github/workflows/ci-cd.yml). Writes to $GITHUB_OUTPUT:
#
#   code=true|false    run validate / tests / build
#   schema=true|false  run the schema-doc check
#
# The skip list is deliberately narrow and mirrors the docs-only fast path in
# .husky/pre-push: docs/**, *.md, *.txt and LICENSE, but anything under a tree
# that tests or type-checks read (src/, shared/, frontend/, tests/) runs the
# full pipeline even if it is a .md. docs/architecture/SCHEMA.md is the one doc
# a check reads (schema-doc), so changing it still runs that job.
#
# Anything ambiguous runs everything: unknown event, no base commit, a fetch or
# diff failure, an empty diff.
#
# Inputs (env): EVENT (github.event_name), BEFORE (github.event.before on push).
# A pull_request checkout must be the merge commit with fetch-depth >= 2.
set -euo pipefail

OUT="${GITHUB_OUTPUT:-/dev/stdout}"

emit() {
  echo "code=$1" >> "$OUT"
  echo "schema=$2" >> "$OUT"
  echo "Result: code=$1 schema=$2"
}

full() {
  echo "::notice::$1 — running the full pipeline"
  emit true true
  exit 0
}

case "${EVENT:-}" in
  pull_request)
    BASE=$(git rev-parse --verify --quiet 'HEAD^1') || full "PR base commit not available"
    ;;
  push)
    BASE="${BEFORE:-}"
    if [ -z "$BASE" ] || [ "$BASE" = "0000000000000000000000000000000000000000" ]; then
      full "push has no previous commit"
    fi
    if ! git cat-file -e "${BASE}^{commit}" 2>/dev/null; then
      git fetch --no-tags --depth=1 origin "$BASE" || full "could not fetch $BASE"
    fi
    ;;
  *)
    full "event '${EVENT:-unset}' is not classified"
    ;;
esac

CHANGED=$(git diff --name-only "$BASE" HEAD) || full "git diff failed"
[ -n "$CHANGED" ] || full "empty diff"

echo "Changed files ($(echo "$CHANGED" | wc -l)):"
echo "$CHANGED" | head -50 | sed 's/^/  /'

code=false
schema=false
while IFS= read -r f; do
  case "$f" in
    docs/architecture/SCHEMA.md) schema=true ;;
    frontend/*|src/*|shared/*|tests/*) code=true ;;
    docs/*|*.md|*.txt|LICENSE) ;;
    *) code=true ;;
  esac
done <<< "$CHANGED"

# A code change keeps running schema-doc too, as before this filter existed.
[ "$code" = true ] && schema=true

emit "$code" "$schema"
