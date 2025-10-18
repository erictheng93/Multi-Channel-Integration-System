#!/bin/bash
# Git pre-commit hook for documentation quality checks
# Install this hook by copying to .git/hooks/pre-commit

echo "Running documentation quality checks..."

# Get list of changed markdown files
CHANGED_MD_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '\.md$')

if [ -z "$CHANGED_MD_FILES" ]; then
    echo "No markdown files changed, skipping documentation checks."
    exit 0
fi

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "Warning: Python 3 not found, skipping documentation checks"
    exit 0
fi

# Run emoji removal check
echo "Checking for emoji characters..."
EMOJI_FOUND=false

for file in $CHANGED_MD_FILES; do
    if [ -f "$file" ]; then
        # Simple grep check for common emoji
        if grep -P '[\x{1F000}-\x{1FFFF}\x{2000}-\x{2BFF}]' "$file" &> /dev/null; then
            echo "  ERROR: Found emoji in $file"
            EMOJI_FOUND=true
        fi
    fi
done

if [ "$EMOJI_FOUND" = true ]; then
    echo ""
    echo "Please remove emoji from your markdown files before committing."
    echo "You can use: python scripts/remove-emoji.py --root ."
    exit 1
fi

# Check for Chinese filenames
echo "Checking for Chinese characters in filenames..."
CHINESE_FILENAME_FOUND=false

for file in $CHANGED_MD_FILES; do
    if echo "$file" | grep -P '[^\x00-\x7F]' &> /dev/null; then
        echo "  ERROR: Chinese characters found in filename: $file"
        CHINESE_FILENAME_FOUND=true
    fi
done

if [ "$CHINESE_FILENAME_FOUND" = true ]; then
    echo ""
    echo "Please rename files to use English characters only."
    exit 1
fi

# Run Python documentation checker if available
if [ -f "scripts/check-docs.py" ]; then
    echo "Running documentation quality checker..."
    python3 scripts/check-docs.py $CHANGED_MD_FILES

    if [ $? -ne 0 ]; then
        echo ""
        echo "Documentation quality checks failed."
        echo "Please fix the issues above before committing."
        exit 1
    fi
fi

echo "All documentation checks passed!"
exit 0
