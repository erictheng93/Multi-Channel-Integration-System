#!/usr/bin/env tsx

/**
 * Database Utils Test Runner
 * 
 * This script runs all database utility tests in order of priority:
 * 1. Core business logic tests
 * 2. Edge cases and boundary conditions
 * 3. Error handling and recovery
 * 4. Performance and stress tests
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

const testFiles = [
  'database.test.ts',
  'database-edge-cases.test.ts', 
  'database-error-handling.test.ts',
  'database-performance.test.ts'
]

const testDir = join(__dirname)

console.log('🧪 Database Utils Test Suite')
console.log('============================')
console.log('')

async function runTests() {
  let totalPassed = 0
  let totalFailed = 0
  let totalTime = 0

  for (const testFile of testFiles) {
    const testPath = join(testDir, testFile)
    
    if (!existsSync(testPath)) {
      console.log(`❌ Test file not found: ${testFile}`)
      continue
    }

    console.log(`🔍 Running ${testFile}...`)
    const startTime = Date.now()
    
    try {
      const result = execSync(`npx vitest run ${testPath} --reporter=verbose`, {
        encoding: 'utf8',
        cwd: join(__dirname, '../../..')
      })
      
      const endTime = Date.now()
      const duration = endTime - startTime
      totalTime += duration
      
      // Parse results (simplified)
      const lines = result.split('\n')
      const passedMatch = result.match(/(\d+) passed/)
      const failedMatch = result.match(/(\d+) failed/)
      
      const passed = passedMatch ? parseInt(passedMatch[1]) : 0
      const failed = failedMatch ? parseInt(failedMatch[1]) : 0
      
      totalPassed += passed
      totalFailed += failed
      
      console.log(`✅ ${testFile}: ${passed} passed, ${failed} failed (${duration}ms)`)
      
      if (failed > 0) {
        console.log(`   ⚠️  Some tests failed in ${testFile}`)
      }
      
    } catch (error) {
      console.log(`❌ ${testFile}: Test execution failed`)
      console.log(`   Error: ${error.message}`)
      totalFailed++
    }
    
    console.log('')
  }

  console.log('📊 Test Summary')
  console.log('===============')
  console.log(`Total Tests: ${totalPassed + totalFailed}`)
  console.log(`Passed: ${totalPassed}`)
  console.log(`Failed: ${totalFailed}`)
  console.log(`Total Time: ${totalTime}ms`)
  console.log('')

  if (totalFailed === 0) {
    console.log('🎉 All database tests passed!')
    process.exit(0)
  } else {
    console.log('💥 Some database tests failed!')
    process.exit(1)
  }
}

// Test categories and their descriptions
const testCategories = {
  'database.test.ts': {
    priority: 1,
    description: 'Core business logic tests for CRUD operations',
    focus: 'Customer creation, conversation management, message handling'
  },
  'database-edge-cases.test.ts': {
    priority: 2, 
    description: 'Boundary conditions and edge cases',
    focus: 'String limits, Unicode, special characters, JSON metadata'
  },
  'database-error-handling.test.ts': {
    priority: 3,
    description: 'Error scenarios and recovery mechanisms',
    focus: 'Connection errors, constraint violations, transaction failures'
  },
  'database-performance.test.ts': {
    priority: 4,
    description: 'Performance and stress testing',
    focus: 'Bulk operations, large datasets, concurrent access'
  }
}

function showTestInfo() {
  console.log('📋 Database Test Categories')
  console.log('===========================')
  console.log('')
  
  Object.entries(testCategories).forEach(([file, info]) => {
    console.log(`${info.priority}. ${file}`)
    console.log(`   Description: ${info.description}`)
    console.log(`   Focus Areas: ${info.focus}`)
    console.log('')
  })
}

// Command line argument handling
const args = process.argv.slice(2)

if (args.includes('--help') || args.includes('-h')) {
  console.log('Database Utils Test Runner')
  console.log('')
  console.log('Usage:')
  console.log('  tsx database-test-runner.ts [options]')
  console.log('')
  console.log('Options:')
  console.log('  --help, -h     Show this help message')
  console.log('  --info, -i     Show test categories information')
  console.log('  --file <name>  Run specific test file only')
  console.log('')
  console.log('Examples:')
  console.log('  tsx database-test-runner.ts')
  console.log('  tsx database-test-runner.ts --file database.test.ts')
  console.log('  tsx database-test-runner.ts --info')
  process.exit(0)
}

if (args.includes('--info') || args.includes('-i')) {
  showTestInfo()
  process.exit(0)
}

const fileIndex = args.indexOf('--file')
if (fileIndex !== -1 && args[fileIndex + 1]) {
  const specificFile = args[fileIndex + 1]
  if (testFiles.includes(specificFile)) {
    console.log(`🎯 Running specific test file: ${specificFile}`)
    console.log('')
    
    try {
      const result = execSync(`npx vitest run ${join(testDir, specificFile)} --reporter=verbose`, {
        encoding: 'utf8',
        cwd: join(__dirname, '../../..')
      })
      console.log(result)
      console.log('✅ Test completed successfully')
    } catch (error) {
      console.log('❌ Test failed')
      console.log(error.stdout || error.message)
      process.exit(1)
    }
  } else {
    console.log(`❌ Test file not found: ${specificFile}`)
    console.log('Available test files:')
    testFiles.forEach(file => console.log(`  - ${file}`))
    process.exit(1)
  }
} else {
  // Run all tests
  runTests().catch(error => {
    console.error('❌ Test runner failed:', error)
    process.exit(1)
  })
}