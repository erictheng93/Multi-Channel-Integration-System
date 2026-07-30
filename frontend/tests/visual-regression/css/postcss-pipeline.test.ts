/**
 * Harness-fidelity guard.
 *
 * Everything else in this directory is only meaningful if the harness still
 * mirrors the pipeline the app actually builds with. These assertions check the
 * real `postcss.config.js` against what the INSTALLED Tailwind major is expected
 * to declare, so the harness cannot quietly drift away from the app:
 *
 *   v3: `tailwindcss` + `autoprefixer`
 *   v4: `@tailwindcss/postcss` alone (it prefixes internally via lightningcss)
 *
 * Anything else fails and says so, rather than leaving someone trusting a
 * baseline that no longer describes the app.
 */
import { describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { FRONTEND_ROOT, readTextFile } from './helpers/repo-files'
import {
  APP_STYLESHEET_PATH,
  TAILWIND_MAJOR,
  TAILWIND_VERSION,
  classNamesInSelector,
  isSingleClassSelector,
} from './helpers/tailwind-pipeline'

/** PostCSS plugin names declared in the real config, in declaration order. */
function declaredPostcssPlugins(): string[] {
  const source = readTextFile(resolve(FRONTEND_ROOT, 'postcss.config.js'))
  const body = /plugins\s*:\s*\{([\s\S]*?)\n\s*\},?/.exec(source)?.[1] ?? ''
  return [...body.matchAll(/^\s*['"]?([@\w/-]+)['"]?\s*:/gm)]
    .map(match => match[1])
    .filter((name): name is string => name !== undefined)
}

describe('real PostCSS pipeline', () => {
  it('declares the plugins the installed Tailwind major requires', () => {
    const expected =
      TAILWIND_MAJOR >= 4 ? ['@tailwindcss/postcss'] : ['tailwindcss', 'autoprefixer']

    expect(
      declaredPostcssPlugins(),
      `frontend/postcss.config.js does not match what Tailwind ${TAILWIND_VERSION} expects. ` +
        'The compiled-CSS baselines under tests/visual-regression/css/baseline/ were produced ' +
        'by running Tailwind alone; revisit ' +
        'tests/visual-regression/css/helpers/tailwind-pipeline.ts before trusting them.'
    ).toEqual(expected)
  })

  it('reaches the JS config the way the installed major requires', () => {
    const styleCss = readTextFile(APP_STYLESHEET_PATH)

    if (TAILWIND_MAJOR >= 4) {
      // v4 has no automatic tailwind.config.js discovery; without @config the
      // custom theme scales and the forms plugin silently stop applying.
      expect(
        styleCss,
        'src/style.css must keep an @config directive: Tailwind 4 does not auto-discover ' +
          'tailwind.config.js, so without it the entire custom theme (colours, radii, ' +
          'shadows, spacing) and @tailwindcss/forms silently stop applying.'
      ).toMatch(/@config\s+["'][^"']*tailwind\.config\.js["']/)
      expect(styleCss).toMatch(/@import\s+["']tailwindcss["']/)
      return
    }

    // v3 auto-discovers the config and uses the three layer directives.
    expect(styleCss).toMatch(/@tailwind\s+base;/)
    expect(styleCss).toMatch(/@tailwind\s+components;/)
    expect(styleCss).toMatch(/@tailwind\s+utilities;/)
  })
})

describe('real Tailwind config', () => {
  // Read textually rather than through `loadConfig`, which does not exist on v4.
  const source = readTextFile(resolve(FRONTEND_ROOT, 'tailwind.config.js'))

  it('still overrides the theme scales the baselines depend on', () => {
    for (const key of [
      'colors',
      'borderRadius',
      'boxShadow',
      'fontSize',
      'spacing',
      'transitionDuration',
    ]) {
      expect(source, `theme.extend.${key} is gone from tailwind.config.js`).toContain(`${key}: {`)
    }
  })

  it('still registers @tailwindcss/forms with the class strategy', () => {
    expect(source).toContain('@tailwindcss/forms')
    expect(source).toMatch(/strategy:\s*['"]class['"]/)
  })

  it('still points content at index.html and the src tree', () => {
    expect(source).toContain('./index.html')
    expect(source).toContain('./src/**/*.{vue,js,ts,jsx,tsx}')
  })
})

describe('selector class-name parser', () => {
  // The silent-drop detector is only as trustworthy as this parser: if it fails
  // to recover a class name from an escaped selector, a live utility looks
  // dropped (false alarm) or a dropped one looks live (missed regression).
  it.each([
    ['.flex', ['flex']],
    ['.md\\:flex', ['md:flex']],
    ['.hover\\:bg-gray-50:hover', ['hover:bg-gray-50']],
    ['.w-1\\/2', ['w-1/2']],
    ['.hover\\:-translate-y-0\\.5:hover', ['hover:-translate-y-0.5']],
    ['.\\!p-4', ['!p-4']],
    ['.-mt-2', ['-mt-2']],
    ['.\\32 xl\\:flex', ['2xl:flex']],
    ['.bg-\\[var\\(--line-color\\)\\]', ['bg-[var(--line-color)]']],
    [
      '.shadow-\\[0_4px_16px_rgba\\(0\\2c 0\\2c 0\\2c 0\\.04\\)\\]',
      ['shadow-[0_4px_16px_rgba(0,0,0,0.04)]'],
    ],
    ['.group:hover .group-hover\\:opacity-100', ['group', 'group-hover:opacity-100']],
    ["[data-theme='dark'] .glass", ['glass']],
    ['.platform-indicator.line::before', ['platform-indicator', 'line']],
  ])('parses %s', (selector, expected) => {
    expect(classNamesInSelector(selector)).toEqual(expected)
  })

  it('recognises a bare single-class selector', () => {
    expect(isSingleClassSelector('.rounded-full', 'rounded-full')).toBe(true)
    expect(isSingleClassSelector('.md\\:flex', 'md:flex')).toBe(true)
    expect(isSingleClassSelector('.hover\\:flex:hover', 'hover:flex')).toBe(false)
    expect(isSingleClassSelector('.a .b', 'a')).toBe(false)
  })
})
