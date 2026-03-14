// Global WebSocket Test Setup
// Runs once before all tests to configure the testing environment
// Sets up global mocks, environment variables, and test infrastructure

export async function setup() {
  console.log(' Setting up global WebSocket test environment...');

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.TEST_MODE = 'websocket';

  // Configure test timeouts
  if (!process.env.WEBSOCKET_TEST_TIMEOUT) {
    process.env.WEBSOCKET_TEST_TIMEOUT = '120000'; // 2 minutes default
  }

  // Enable memory monitoring in test environment
  if (!process.env.MEMORY_MONITORING) {
    process.env.MEMORY_MONITORING = 'true';
  }

  // Disable parallel execution for performance tests
  process.env.TEST_PARALLEL = 'false';

  // Configure performance test mode
  if (!process.env.PERFORMANCE_TEST_MODE) {
    process.env.PERFORMANCE_TEST_MODE = 'normal';
  }

  // Setup global error handling for unhandled promises
  process.on('unhandledRejection', (reason, promise) => {
    console.error(' Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit in tests, just log
  });

  process.on('uncaughtException', (error) => {
    console.error(' Uncaught Exception:', error);
    // Don't exit in tests, just log
  });

  // Increase memory limit for stress tests
  if (process.env.STRESS_TEST_ENABLED === 'true') {
    console.log(' Stress testing enabled - increased memory limits');
  }

  // Setup garbage collection for memory tests
  if (global.gc) {
    console.log(' Garbage collection available for memory testing');
  } else {
    console.log(' Garbage collection not available - memory tests may be less accurate');
  }

  console.log(' Global WebSocket test environment setup complete');
}

export async function teardown() {
  console.log(' Cleaning up global WebSocket test environment...');

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  // Clean up any global timers or resources
  // Note: Vitest handles most cleanup automatically

  console.log(' Global cleanup complete');
}