#!/usr/bin/env tsx

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { resolve } from 'path'

console.log('🔍 Starting build analysis...\n')

// Run build with analysis
try {
  console.log('📦 Building with bundle analysis...')
  execSync('npm run build:analyze', { stdio: 'inherit' })
  
  // Check if stats file exists
  const statsPath: string = resolve('dist/bundle-analysis.html')
  if (existsSync(statsPath)) {
    console.log('✅ Bundle analysis complete!')
    console.log(`📊 Analysis report: ${statsPath}`)
  }
  
  // Display build size information
  const distPath: string = resolve('dist')
  if (existsSync(distPath)) {
    console.log('\n📈 Build size summary:')
    try {
      const result: string = execSync('du -sh dist/*', { encoding: 'utf8' })
      console.log(result)
    } catch (error) {
      // Fallback for Windows
      try {
        const _result: string = execSync('dir dist /s', { encoding: 'utf8' })
        console.log('Build completed successfully')
      } catch (winError) {
        console.log('Build completed successfully')
      }
    }
  }
  
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error'
  console.error('❌ Build analysis failed:', errorMessage)
  process.exit(1)
}

console.log('\n🎉 Analysis complete! Check the generated HTML report for detailed insights.')