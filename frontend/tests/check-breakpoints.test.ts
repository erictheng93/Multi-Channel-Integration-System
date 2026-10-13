import { afterEach, expect, test } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const fixtures: string[] = []

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true })
  }
})

function checkBreakpoints(css: string) {
  const fixture = mkdtempSync(join(tmpdir(), 'breakpoints-'))
  fixtures.push(fixture)
  const file = join(fixture, 'Fixture.vue')
  writeFileSync(file, `<template><div /></template>\n<style>\n${css}\n</style>`, 'utf8')
  return spawnSync('bun', [resolve('scripts/check-breakpoints.ts'), file], { encoding: 'utf8' })
}

test.each([480, 640, 768, 1024, 1280])('allows scale %ipx and its min-width complement', width => {
  const result = checkBreakpoints(
    `@media (max-width: ${width}px) {}\n@media (min-width: ${width}px) {}\n@media (min-width: ${width + 1}px) {}`
  )
  expect(result.status, result.stderr).toBe(0)
})

test.each([481, 641, 769, 1025, 1281])('rejects a max-width complement of %ipx', width => {
  const result = checkBreakpoints(`@media (max-width: ${width}px) {}`)
  expect(result.status, result.stderr).toBe(1)
  expect(result.stderr).toContain(`Fixture.vue:3  max-width ${width}px`)
})

test('checks every width in a multiline media prelude and reports the condition line', () => {
  const result = checkBreakpoints(
    '@media screen and\n  (min-width: 769px) and\n  (max-width: 777px),\n  screen and (max-width: 769px) {}'
  )
  expect(result.status, result.stderr).toBe(1)
  expect(result.stderr).toContain('Fixture.vue:5  max-width 777px')
  expect(result.stderr).toContain('Fixture.vue:6  max-width 769px')
  expect(result.stderr).toContain('2 off-scale breakpoint(s)')
})

test('accepts multiline scale queries and converts rem/em units', () => {
  const result = checkBreakpoints(
    '@media screen and\n (max-width: 48rem),\n (min-width: 48.0625em) {}'
  )
  expect(result.status, result.stderr).toBe(0)
})

test('rejects complements in max-width rem queries', () => {
  const result = checkBreakpoints('@media (max-width: 48.0625rem) {}')
  expect(result.status, result.stderr).toBe(1)
  expect(result.stderr).toContain('max-width 769px')
})

test('ignores comments and width-like conditions outside media preludes', () => {
  const result = checkBreakpoints(
    '/* @media screen and\n (max-width: 777px) {} */\n' +
    '@supports (max-width: 777px) {}\n' +
    '@media /* explanation */ screen and\n (max-width: 768px) {}'
  )
  expect(result.status, result.stderr).toBe(0)
})

test.each([
  ['(width <= 700px)', 'max-width 700px'],
  ['(width < 777px)', 'max-width 777px'],
  ['(width <= 769px)', 'max-width 769px'],
  ['(700px >= width)', 'max-width 700px'],
  ['(width >= 700px)', 'min-width 700px'],
  ['(width > 800px)', 'min-width 800px'],
  ['(700px <= width)', 'min-width 700px'],
  ['(width = 700px)', 'eq-width 700px'],
])('rejects off-scale range syntax %s', (condition, message) => {
  const result = checkBreakpoints(`@media ${condition} {}`)
  expect(result.status, result.stderr).toBe(1)
  expect(result.stderr).toContain(message)
})

test('checks both bounds of a chained range and applies the min-width complement only to lower bounds', () => {
  const bad = checkBreakpoints('@media (400px <= width <= 769px) {}')
  expect(bad.status, bad.stderr).toBe(1)
  expect(bad.stderr).toContain('min-width 400px')
  expect(bad.stderr).toContain('max-width 769px')

  const good = checkBreakpoints(
    '@media (width <= 768px) {}\n@media (width >= 769px) {}\n@media (769px <= width <= 1024px) {}\n@media (width > 1280px) {}'
  )
  expect(good.status, good.stderr).toBe(0)
})

test('ignores range-syntax width conditions that are not in a media prelude', () => {
  const result = checkBreakpoints('@container (width <= 700px) {}\n@supports (width: 700px) {}')
  expect(result.status, result.stderr).toBe(0)
})
