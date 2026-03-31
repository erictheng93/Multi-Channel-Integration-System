#!/usr/bin/env bun

import { existsSync } from 'fs'
import { resolve } from 'path'

console.log(' Starting build analysis...\n')

// Run build with analysis
const buildResult = Bun.spawnSync(['npm', 'run', 'build:analyze'], { stdout: 'inherit', stderr: 'inherit' })

if (buildResult.exitCode !== 0) {
  console.error(' Build analysis failed')
  process.exit(1)
}

// Check if stats file exists
const statsPath: string = resolve('dist/bundle-analysis.html')
if (existsSync(statsPath)) {
  console.log(' Bundle analysis complete!')
  console.log(` Analysis report: ${statsPath}`)
}

// Display build size information
const distPath: string = resolve('dist')
if (existsSync(distPath)) {
  console.log('\n Build size summary:')
  const duResult = Bun.spawnSync(['du', '-sh', 'dist/*'], { stdout: 'pipe', stderr: 'pipe' })
  if (duResult.exitCode === 0) {
    console.log(duResult.stdout.toString())
  } else {
    // Fallback for Windows
    const dirResult = Bun.spawnSync(['cmd', '/c', 'dir', 'dist', '/s'], { stdout: 'pipe', stderr: 'pipe' })
    if (dirResult.exitCode === 0) {
      console.log(dirResult.stdout.toString())
    }
    console.log('Build completed successfully')
  }
}

console.log('\n Analysis complete! Check the generated HTML report for detailed insights.')