#!/usr/bin/env python3
"""
Documentation quality checker script.
Checks markdown files for common issues and enforces documentation standards.
"""

import re
import os
import sys
from pathlib import Path
from typing import List, Tuple, Dict

class DocumentChecker:
    """Checks markdown documents for quality and standards compliance."""

    def __init__(self):
        self.issues: List[Tuple[str, str, int]] = []
        self.warnings: List[Tuple[str, str, int]] = []

        # Emoji pattern
        self.emoji_pattern = re.compile(
            "["
            "\U0001F000-\U0001FFFF"
            "\U00002000-\U00002BFF"
            "\U0001F300-\U0001F9FF"
            "\U00002600-\U000027BF"
            "\u2300-\u23FF"
            "\u25A0-\u25FF"
            "\u2B00-\u2BFF"
            "\u200d"
            "\uFE0F"
            "\uFE00-\uFE0F"
            "]+",
            flags=re.UNICODE
        )

        # Chinese characters pattern
        self.chinese_pattern = re.compile(r'[\u4e00-\u9fff]+')

    def check_file(self, file_path: Path) -> Dict[str, any]:
        """Check a single markdown file."""
        results = {
            'file': str(file_path),
            'issues': [],
            'warnings': [],
            'stats': {}
        }

        try:
            # Try multiple encodings
            content = None
            for encoding in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']:
                try:
                    with open(file_path, 'r', encoding=encoding) as f:
                        content = f.read()
                    break
                except UnicodeDecodeError:
                    continue

            if content is None:
                results['issues'].append('Cannot decode file with any known encoding')
                return results

            lines = content.split('\n')
            results['stats']['line_count'] = len(lines)
            results['stats']['char_count'] = len(content)

            # Check filename
            self._check_filename(file_path, results)

            # Check content
            self._check_content(lines, results)

            # Check structure
            self._check_structure(lines, results)

        except Exception as e:
            results['issues'].append(f'Error processing file: {str(e)}')

        return results

    def _check_filename(self, file_path: Path, results: Dict):
        """Check if filename follows naming conventions."""
        filename = file_path.name

        # Check for Chinese characters in filename
        if self.chinese_pattern.search(filename):
            results['issues'].append('Filename contains Chinese characters')

        # Check naming convention (should be uppercase with underscores)
        if filename != filename.upper() and not filename.startswith('.'):
            name_without_ext = filename.rsplit('.', 1)[0]
            if not name_without_ext.replace('_', '').replace('-', '').isalnum():
                results['warnings'].append('Filename should use UPPERCASE_WITH_UNDERSCORES convention')

    def _check_content(self, lines: List[str], results: Dict):
        """Check content quality."""
        for i, line in enumerate(lines, 1):
            # Check for emoji
            if self.emoji_pattern.search(line):
                results['issues'].append(f'Line {i}: Contains emoji characters')

            # Check for excessive blank lines
            if i > 1 and not lines[i-2].strip() and not lines[i-1].strip() and not line.strip():
                results['warnings'].append(f'Line {i}: More than 2 consecutive blank lines')

            # Check for trailing whitespace
            if line != line.rstrip():
                results['warnings'].append(f'Line {i}: Has trailing whitespace')

            # Check for tabs (should use spaces)
            if '\t' in line and not line.strip().startswith('```'):
                results['warnings'].append(f'Line {i}: Contains tab characters, use spaces instead')

    def _check_structure(self, lines: List[str], results: Dict):
        """Check document structure."""
        has_h1 = False
        has_metadata = False
        code_block = False

        for i, line in enumerate(lines, 1):
            # Track code blocks
            if line.strip().startswith('```'):
                code_block = not code_block
                continue

            if code_block:
                continue

            # Check for H1
            if line.startswith('# '):
                if has_h1:
                    results['warnings'].append(f'Line {i}: Multiple H1 headings found')
                has_h1 = True

            # Check for metadata section
            if line.strip() == '---' and i < len(lines) - 1:
                has_metadata = True

        if not has_h1:
            results['warnings'].append('Document missing H1 heading')

        # Check for metadata at end
        if '最後更新' not in ''.join(lines[-10:]) and '版本' not in ''.join(lines[-10:]):
            results['warnings'].append('Document missing metadata section (last update, version, author)')

    def print_results(self, results: Dict):
        """Print check results."""
        print(f"\nChecking: {results['file']}")
        print(f"Lines: {results['stats'].get('line_count', 0)}, Characters: {results['stats'].get('char_count', 0)}")

        if results['issues']:
            print(f"\nISSUES ({len(results['issues'])}):")
            for issue in results['issues']:
                print(f"  - {issue}")

        if results['warnings']:
            print(f"\nWARNINGS ({len(results['warnings'])}):")
            for warning in results['warnings']:
                print(f"  - {warning}")

        if not results['issues'] and not results['warnings']:
            print("  All checks passed!")

        return len(results['issues'])

def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description='Check markdown documentation for quality and standards'
    )
    parser.add_argument(
        'files',
        nargs='*',
        help='Files to check (if not specified, checks all docs)'
    )
    parser.add_argument(
        '--all',
        action='store_true',
        help='Check all documentation files'
    )

    args = parser.parse_args()

    checker = DocumentChecker()

    # Determine files to check
    if args.all or not args.files:
        # Find all markdown files in docs/
        docs_path = Path('docs')
        if not docs_path.exists():
            print("Error: docs/ directory not found")
            sys.exit(1)
        files_to_check = list(docs_path.rglob('*.md'))
    else:
        files_to_check = [Path(f) for f in args.files]

    print(f"Checking {len(files_to_check)} files...")

    total_issues = 0
    for file_path in files_to_check:
        if not file_path.exists():
            print(f"Warning: File not found: {file_path}")
            continue

        results = checker.check_file(file_path)
        issues_count = checker.print_results(results)
        total_issues += issues_count

    print(f"\n{'='*60}")
    print(f"Total files checked: {len(files_to_check)}")
    print(f"Total issues found: {total_issues}")

    if total_issues > 0:
        print("\nPlease fix the issues above before committing.")
        sys.exit(1)
    else:
        print("\nAll checks passed!")
        sys.exit(0)

if __name__ == '__main__':
    main()
