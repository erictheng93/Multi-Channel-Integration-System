import { afterEach, expect, test } from 'vitest'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const fixtures: string[] = []

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true })
  }
})

function checkRoot(classes: string, css: string, quote = '"') {
  const fixture = mkdtempSync(join(tmpdir(), 'page-roots-'))
  fixtures.push(fixture)
  mkdirSync(join(fixture, 'scripts'))
  mkdirSync(join(fixture, 'src/router'), { recursive: true })
  copyFileSync(resolve('scripts/check-page-roots.ts'), join(fixture, 'scripts/check-page-roots.ts'))
  writeFileSync(
    join(fixture, 'src/router/index.ts'),
    "const page = () => import('@/Report.vue')",
    'utf8'
  )
  writeFileSync(
    join(fixture, 'src/Report.vue'),
    `<template><AppLayout><div class=${quote}${classes}${quote}>Report</div></AppLayout></template>\n<style>${css}</style>`,
    'utf8'
  )
  return spawnSync('bun', [join(fixture, 'scripts/check-page-roots.ts')], { encoding: 'utf8' })
}

test.each(['theme report-page', 'report-page theme', 'theme other report-page'])(
  'detects root sizing violations regardless of class order: %s',
  classes => {
    const result = checkRoot(classes, '.report-page { max-width: 1200px; margin: 0 auto; }')
    expect(result.status, result.stderr).toBe(1)
    expect(result.stderr).toContain('.report-page sets max-width with auto margins but no width')
  }
)

test('checks single-quoted static classes and grouped selectors', () => {
  const result = checkRoot(
    'theme report-page',
    '.other, .report-page { max-width: 1200px; margin-inline: auto; }',
    "'"
  )
  expect(result.status, result.stderr).toBe(1)
  expect(result.stderr).toContain('.report-page sets max-width with auto margins but no width')
})

test('accepts a root sizing rule with an explicit width', () => {
  const result = checkRoot(
    'theme report-page',
    '.report-page { max-width: 1200px; margin: 0 auto; width: 100%; }'
  )
  expect(result.status, result.stderr).toBe(0)
})

test('ignores sizing rules that do not target a root class', () => {
  const result = checkRoot('theme report-page', '.child { max-width: 1200px; margin: 0 auto; }')
  expect(result.status, result.stderr).toBe(0)
})

test('reports each offending rule once when it targets multiple root classes', () => {
  const result = checkRoot(
    'theme report-page',
    '.theme, .report-page { max-width: 1200px; margin: 0 auto; }'
  )
  expect(result.status, result.stderr).toBe(1)
  expect(result.stderr).toContain('1 page root(s) would shrink-wrap')
  expect(result.stderr).toContain('.theme, .report-page sets max-width')
})
