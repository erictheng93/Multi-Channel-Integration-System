/**
 * Vitest Setup for Real Integration Tests
 *
 * Global setup and teardown for tests using real Cloudflare resources
 */

import { beforeAll, afterAll } from 'vitest';
import {
  startRealWorker,
  stopRealWorker,
  verifyDatabaseConnection
} from './helpers/real-integration-test-setup';

// Start Worker before all tests
beforeAll(async () => {
  console.log('\n🚀 ========================================');
  console.log('   STARTING REAL INTEGRATION TESTS');
  console.log('   Using REMOTE Production Resources');
  console.log('========================================\n');

  try {
    const worker = await startRealWorker();

    // Verify database connection
    const isConnected = await verifyDatabaseConnection(worker);
    if (!isConnected) {
      throw new Error('Database connection failed');
    }

    console.log('✅ All systems ready for integration testing\n');
  } catch (error) {
    console.error('❌ Failed to start integration test environment:', error);
    throw error;
  }
}, 60000); // 60 second timeout for worker startup

// Stop Worker after all tests
afterAll(async () => {
  console.log('\n🛑 ========================================');
  console.log('   STOPPING INTEGRATION TESTS');
  console.log('========================================\n');

  try {
    await stopRealWorker();
    console.log('✅ Cleanup complete\n');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}, 30000); // 30 second timeout for cleanup
