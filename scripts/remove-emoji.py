#!/usr/bin/env python3
"""
Script to remove all emoji from markdown files in the project.
This script processes all .md files and removes emoji characters while preserving other content.
"""

import re
import os
import sys
from pathlib import Path

# Comprehensive emoji pattern covering all common Unicode ranges
EMOJI_PATTERN = re.compile(
    "["
    "\U0001F000-\U0001FFFF"  # All emoji and symbols (comprehensive)
    "\U00002000-\U00002BFF"  # Arrows, mathematical, technical symbols, geometric shapes
    "\U0001F300-\U0001F9FF"  # Symbols & pictographs (overlapping but comprehensive)
    "\U00002600-\U000027BF"  # Miscellaneous symbols and dingbats
    "\u2300-\u23FF"          # Miscellaneous technical symbols (includes ⏰)
    "\u25A0-\u25FF"          # Geometric shapes
    "\u2B00-\u2BFF"          # Miscellaneous symbols and arrows
    "\u200d"                 # Zero width joiner
    "\uFE0F"                 # Variation selector
    "\uFE00-\uFE0F"          # Variation selectors
    "]+",
    flags=re.UNICODE
)

def remove_emoji(text: str) -> str:
    """Remove all emoji from the given text."""
    # Remove emoji
    cleaned = EMOJI_PATTERN.sub('', text)

    # Clean up multiple spaces that might result from emoji removal
    cleaned = re.sub(r'  +', ' ', cleaned)

    # Clean up spaces at the beginning of lines (but preserve indentation)
    cleaned = re.sub(r'^([ \t]*)  +', r'\1 ', cleaned, flags=re.MULTILINE)

    # Clean up trailing spaces before newlines
    cleaned = re.sub(r' +\n', '\n', cleaned)

    # Clean up empty markdown headers (### followed by only whitespace)
    cleaned = re.sub(r'^(#{1,6})\s*$', '', cleaned, flags=re.MULTILINE)

    # Clean up multiple consecutive blank lines (more than 2)
    cleaned = re.sub(r'\n{4,}', '\n\n\n', cleaned)

    return cleaned

def process_file(file_path: Path, dry_run: bool = False) -> bool:
    """
    Process a single markdown file to remove emoji.

    Args:
        file_path: Path to the markdown file
        dry_run: If True, only report changes without modifying files

    Returns:
        True if file was modified (or would be modified in dry run)
    """
    # Try different encodings
    encodings = ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252', 'gbk', 'big5']

    original_content = None
    detected_encoding = None

    for encoding in encodings:
        try:
            with open(file_path, 'r', encoding=encoding) as f:
                original_content = f.read()
            detected_encoding = encoding
            break
        except (UnicodeDecodeError, LookupError):
            continue

    if original_content is None:
        print(f"Error: Could not decode {file_path} with any known encoding", file=sys.stderr)
        return False

    try:
        cleaned_content = remove_emoji(original_content)

        if original_content != cleaned_content:
            if not dry_run:
                # Always write as UTF-8
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(cleaned_content)
            return True

        return False
    except Exception as e:
        print(f"Error processing {file_path}: {e}", file=sys.stderr)
        return False

def find_markdown_files(root_dir: Path) -> list[Path]:
    """Find all markdown files in the project."""
    markdown_files = []

    # Directories to exclude
    exclude_dirs = {'node_modules', '.git', 'dist', 'build', '.wrangler',
                   '.nuxt', '.output', 'coverage', '__pycache__'}

    for md_file in root_dir.rglob('*.md'):
        # Check if any parent directory is in exclude list
        if not any(part in exclude_dirs for part in md_file.parts):
            markdown_files.append(md_file)

    return sorted(markdown_files)

def main():
    """Main entry point for the script."""
    import argparse

    parser = argparse.ArgumentParser(
        description='Remove emoji from markdown files in the project'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be changed without modifying files'
    )
    parser.add_argument(
        '--root',
        type=Path,
        default=Path.cwd(),
        help='Root directory of the project (default: current directory)'
    )

    args = parser.parse_args()

    root_dir = args.root
    if not root_dir.exists():
        print(f"Error: Root directory {root_dir} does not exist", file=sys.stderr)
        sys.exit(1)

    print(f"Scanning for markdown files in {root_dir}...")
    markdown_files = find_markdown_files(root_dir)
    print(f"Found {len(markdown_files)} markdown files")

    if args.dry_run:
        print("\nDRY RUN MODE - No files will be modified\n")

    modified_count = 0
    for file_path in markdown_files:
        if process_file(file_path, dry_run=args.dry_run):
            modified_count += 1
            status = "Would modify" if args.dry_run else "Modified"
            rel_path = file_path.relative_to(root_dir)
            print(f"{status}: {rel_path}")

    print(f"\n{'Would modify' if args.dry_run else 'Modified'} {modified_count}/{len(markdown_files)} files")

    if args.dry_run and modified_count > 0:
        print("\nRun without --dry-run to apply changes")

if __name__ == '__main__':
    main()
