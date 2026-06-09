#!/usr/bin/env bun

import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'

const rootDir = process.cwd()
const scanRoots = ['src', 'frontend/src']
const checkedExtensions = new Set(['.ts', '.tsx', '.vue', '.js', '.jsx'])
const ignoredDirectories = new Set(['node_modules', 'dist', 'build', '.wrangler', 'coverage'])
const mojibakePatterns = [
  { name: 'replacement character', pattern: /\uFFFD/ },
  { name: 'UTF-8 decoded as Windows-1252', pattern: /(?:Ã|Â|â€|â€™|â€œ|â€�|â€“|â€”)/ },
]

interface EncodingIssue {
  file: string
  line: number
  pattern: string
  preview: string
}

function hasCheckedExtension(filePath: string): boolean {
  return [...checkedExtensions].some((extension) => filePath.endsWith(extension))
}

function collectFiles(directory: string, files: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      if (!ignoredDirectories.has(entry)) {
        collectFiles(fullPath, files)
      }
      continue
    }

    if (stat.isFile() && hasCheckedExtension(fullPath)) {
      files.push(fullPath)
    }
  }

  return files
}

function findIssues(filePath: string): EncodingIssue[] {
  const text = readFileSync(filePath, 'utf8')
  const lines = text.split(/\r?\n/)
  const issues: EncodingIssue[] = []

  lines.forEach((line, index) => {
    for (const { name, pattern } of mojibakePatterns) {
      if (pattern.test(line)) {
        issues.push({
          file: relative(rootDir, filePath),
          line: index + 1,
          pattern: name,
          preview: line.trim().slice(0, 140),
        })
      }
    }
  })

  return issues
}

const allIssues = scanRoots
  .flatMap((scanRoot) => collectFiles(join(rootDir, scanRoot)))
  .flatMap(findIssues)

if (allIssues.length === 0) {
  console.log('Encoding check passed')
  process.exit(0)
}

console.error(`Encoding check failed: found ${allIssues.length} possible mojibake issue(s)`)
for (const issue of allIssues.slice(0, 50)) {
  console.error(`  ${issue.file}:${issue.line} [${issue.pattern}] ${issue.preview}`)
}

if (allIssues.length > 50) {
  console.error(`  ... ${allIssues.length - 50} more issue(s)`)
}

process.exit(1)
