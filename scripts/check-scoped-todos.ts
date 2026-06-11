#!/usr/bin/env bun

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

interface TodoMarker {
  file: string
  line: number
  text: string
}

const roots = [
  'src/modules/messaging',
  'src/modules/session',
  'src/modules/system',
]
const ignoredDirectories = new Set(['node_modules', 'dist', 'coverage', '__tests__'])
const includedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.vue'])
const markerPattern = /\b(TODO|FIXME|HACK|XXX)\b/

function hasIncludedExtension(file: string): boolean {
  return Array.from(includedExtensions).some((extension) => file.endsWith(extension))
}

function collectFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return []
  }

  const files: string[] = []

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stats = statSync(fullPath)

    if (stats.isDirectory()) {
      if (!ignoredDirectories.has(entry)) {
        files.push(...collectFiles(fullPath))
      }
      continue
    }

    if (stats.isFile() && hasIncludedExtension(fullPath)) {
      files.push(fullPath)
    }
  }

  return files
}

function findMarkers(file: string): TodoMarker[] {
  const source = readFileSync(file, 'utf8')
  return source
    .split(/\r?\n/)
    .map((text, index) => ({ file, line: index + 1, text: text.trim() }))
    .filter((marker) => markerPattern.test(marker.text))
}

const markers = roots
  .flatMap(collectFiles)
  .flatMap(findMarkers)
  .map((marker) => ({
    ...marker,
    file: relative(process.cwd(), marker.file).replace(/\\/g, '/'),
  }))

if (markers.length > 0) {
  console.error('\nScoped TODO debt detected in messaging/session/system modules:\n')
  for (const marker of markers) {
    console.error(`  ${marker.file}:${marker.line}: ${marker.text}`)
  }
  console.error('\nResolve the marker or move it into a tracked issue before merging.')
  process.exit(1)
}

console.log(
  `check-scoped-todos: 0 TODO/FIXME/HACK/XXX marker(s) in ${roots.join(', ')}.`
)
