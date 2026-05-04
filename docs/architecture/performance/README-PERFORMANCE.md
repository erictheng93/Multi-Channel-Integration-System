# Performance Testing & Optimization Suite

> **Multi-Channel Support MVP - Enterprise WebSocket + Durable Objects Performance Suite**
>
> Comprehensive load testing, benchmarking, and optimization tools for production-ready real-time communication systems.

## Quick Start

### Prerequisites
- Node.js 18+
- NPM packages installed: `bun install`
- Running WebSocket system (localhost:8787 or production URL)

### Essential Commands

```bash
# Run all performance tests
bun run test:production-readiness

# Generate performance baseline
bun run benchmark:baseline

# Test connection handling under load
bun run test:load:websocket -- --connections 1000 --rate 50

# Stress test connection storms
bun run test:stress:connections -- --waves 10 --connections 100

# Profile memory usage
bun run profile:memory -- --duration 300 --connections 10

# View real-time dashboard
bun run dev
# Then visit: http://localhost:8787/dashboard
```

## System Architecture

### Core Components

```
 WebSocket Handler
 Connection Pool Manager
 Message Batch Optimizer Smart Resource Management

 Durable Objects:
 ConversationRoom DO (Room-specific connections)
 MessageBroadcaster DO (Global event distribution)
 UserConnection DO (User-specific management)
 DelayedMessageProcessor DO (Scheduled messaging)

 Monitoring System:
 Performance Monitor (Real-time metrics)
 Dashboard Interface (Live visualization)
 Alerting System (Automated notifications)
```

## Testing Suite Overview

### Load Testing

| Test Type | Purpose | Target Metrics |
|-----------|---------|----------------|
| **WebSocket Load** | Test concurrent connections and message handling | 1,000+ connections, 100+ msg/s |
| **Durable Objects Stress** | Validate DO performance under load | Room scaling, cross-DO communication |
| **Connection Storm** | Test rapid connect/disconnect scenarios | Recovery time, resource cleanup |
| **Message Flood** | Validate high-volume message processing | Throughput, queue management |

### Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| **Concurrent Connections** | 1,000+ | 10,000+ |
| **Message Throughput** | 100+ msg/s | 1,000+ msg/s |
| **Latency (P95)** | < 500ms | < 1,000ms |
| **Connection Success Rate** | > 95% | > 90% |
| **Memory per Connection** | < 1MB | < 2MB |
| **Error Rate** | < 1% | < 5% |

## Tool Details

### 1. WebSocket Load Tester
**Location**: `scripts/load-testing/websocket-load-test.ts`

```bash
# Basic load test
bun run test:load:websocket -- \
 --connections 1000 \
 --rate 50 \
 --messages 100 \
 --duration 300

# Advanced options
bun run test:load:websocket -- \
 --connections 5000 \
 --rate 100 \
 --rooms 50 \
 --include-delayed true \
 --token "your-auth-token"
```

**Features**:
- Concurrent connection simulation
- Message throughput testing
- Connection lifetime analysis
- Real-time progress monitoring
- Detailed performance reporting

### 2. Durable Objects Stress Tester
**Location**: `scripts/load-testing/durable-objects-stress-test.ts`

```bash
# Test all DO components
bun run test:load:durable-objects -- \
 --rooms 100 \
 --users 1000 \
 --messages 500 \
 --duration 300

# Focus on specific components
bun run test:load:durable-objects -- \
 --rooms 20 \
 --enable-locks true \
 --cross-room-events true
```

**Test Coverage**:
- ConversationRoom performance
- MessageBroadcaster efficiency
- UserConnection management
- Distributed locking mechanisms
- Cross-room event handling

### 3. Connection Storm Tester
**Location**: `scripts/stress-testing/connection-storm-test.ts`

```bash
# Simulate connection storms
bun run test:stress:connections -- \
 --waves 10 \
 --connections 100 \
 --interval 5000 \
 --rapid-ratio 0.3

# Extreme stress scenario
bun run test:stress:connections -- \
 --waves 20 \
 --connections 500 \
 --interval 1000 \
 --concurrent-waves 5
```

**Scenarios**:
- Rapid connection waves
- Mixed disconnect patterns
- Network simulation
- Recovery time measurement
- Resource cleanup validation

### 4. Message Flood Tester
**Location**: `scripts/stress-testing/message-flood-test.ts`

```bash
# High-volume message testing
bun run test:stress:messages -- \
 --messages 10000 \
 --rate 100 \
 --connections 50 \
 --size 1024

# Burst traffic simulation
bun run test:stress:messages -- \
 --messages 50000 \
 --rate 500 \
 --burst-intervals true \
 --burst-multiplier 10
```

**Features**:
- Sustained high message volume
- Burst traffic patterns
- Message delivery tracking
- Queue depth monitoring
- System backpressure detection

### 5. Performance Benchmarking
**Location**: `tools/performance/benchmark-suite.ts`

```bash
# Comprehensive benchmarks
bun run benchmark -- \
 --suites latency,throughput,memory,websocket,durableobjects \
 --iterations 1000

# Establish baseline
bun run benchmark:baseline

# Compare performance
bun run benchmark:compare
```

**Benchmark Suites**:
- Latency measurements (P50, P90, P95, P99)
- Throughput analysis
- Memory usage profiling
- WebSocket performance
- Durable Objects efficiency

### 6. Memory Profiler
**Location**: `tools/performance/memory-profiler.ts`

```bash
# Memory analysis
bun run profile:memory -- \
 --duration 300 \
 --connections 10 \
 --messages 1000 \
 --threshold 50

# Enable garbage collection analysis
bun run profile:memory:gc
```

**Analysis Features**:
- Connection memory patterns
- Message history usage
- Leak detection
- Cleanup efficiency
- Optimization recommendations

## Real-Time Monitoring

### Performance Dashboard
**Access**: `http://localhost:8787/dashboard`

**Real-time Metrics**:
- System health status
- Active connections count
- Message throughput
- Average latency
- Active alerts
- Component status

### Server-Sent Events Stream
**Endpoint**: `/api/dashboard/stream`

Real-time updates every 5 seconds for:
- Connection metrics
- System health score
- Error rates
- Performance trends

### Monitoring API Endpoints

```bash
# System health
curl http://localhost:8787/api/dashboard/data

# Real-time metrics
curl http://localhost:8787/api/dashboard/metrics/realtime

# Historical data (last hour)
curl "http://localhost:8787/api/dashboard/metrics/historical?hours=1"

# Active alerts
curl http://localhost:8787/api/dashboard/alerts

# Component status
curl http://localhost:8787/api/dashboard/components
```

## Optimization Features

### Connection Pool Manager
**Location**: `src/services/connection-pool-manager.ts`

**Features**:
- Smart connection pooling
- Automatic cleanup processes
- Health monitoring
- Load balancing
- Connection reuse optimization

**Configuration**:
```typescript
const poolConfig = {
 maxPoolSize: 10000,
 maxConnectionsPerUser: 10,
 heartbeatIntervalMs: 30000,
 cleanupIntervalMs: 60000,
 enableSmartThrottling: true
};
```

### Message Batch Optimizer
**Location**: `src/services/message-batch-optimizer.ts`

**Features**:
- Intelligent batching
- Adaptive strategies
- Message compression
- Deduplication
- Priority handling

**Configuration**:
```typescript
const batchConfig = {
 maxBatchSize: 100,
 maxBatchDelayMs: 100,
 adaptiveBatching: true,
 compressionEnabled: true,
 deduplicationEnabled: true
};
```

## Usage Examples

### Run Complete Test Suite
```bash
# All tests sequentially
bun run test:all

# Run tests in parallel (faster)
bun run test:all:parallel

# Test specific categories
bun run test:load # Load testing only
bun run test:stress # Stress testing only
bun run test:benchmark # Benchmarking only

# Production readiness check
bun run test:production-readiness
```

### Custom Test Scenarios
```bash
# High-concurrency WebSocket test
bun run test:load:websocket -- \
 --connections 5000 \
 --rate 200 \
 --messages 1000 \
 --duration 600 \
 --rooms 100

# Extreme stress testing
bun run test:stress:connections -- \
 --waves 50 \
 --connections 1000 \
 --interval 500 \
 --rapid-ratio 0.8

# Memory leak detection
bun run profile:memory -- \
 --duration 1800 \
 --connections 50 \
 --threshold 100 \
 --output ./memory-profiles
```

### Performance Analysis
```bash
# Establish performance baseline
bun run setup:test-env
bun run benchmark:baseline

# Run optimization analysis
bun run analyze:performance

# Compare before/after optimization
bun run benchmark:compare

# Generate comprehensive report
bun run test:all -- --output ./test-results
```

## Quick Commands Reference

| Command | Purpose |
|---------|---------|
| `bun run test:production-readiness` | Full production test suite |
| `bun run benchmark:baseline` | Establish performance baseline |
| `bun run test:load:websocket` | WebSocket load testing |
| `bun run test:stress:connections` | Connection storm testing |
| `bun run test:stress:messages` | Message flood testing |
| `bun run profile:memory` | Memory usage analysis |
| `bun run dashboard` | Access monitoring dashboard |
| `bun run analyze:performance` | Complete performance analysis |
| `bun run setup:test-env` | Prepare test environment |
| `bun run clean:test-results` | Clean test output files |

## Configuration

### Environment Variables
```bash
# Test target URLs
WORKER_URL=https://localhost:8787
WEBSOCKET_URL=wss://localhost:8787/api/websocket/connect

# Authentication
AUTH_TOKEN=your-test-token

# Test parameters
MAX_CONNECTIONS=10000
TEST_DURATION=300
CONCURRENT_ROOMS=100

# Output configuration
OUTPUT_DIRECTORY=./test-results
ENABLE_DETAILED_LOGGING=true
```

### Custom Test Configuration
Create `test-config.json`:
```json
{
 "targetUrl": "https://your-domain.com",
 "websocketUrl": "wss://your-domain.com/api/websocket/connect",
 "authToken": "your-production-token",
 "maxConnections": 5000,
 "testDurationMs": 600000,
 "outputDirectory": "./production-test-results"
}
```

## Performance Optimization Guide

### 1. Baseline Establishment
```bash
# Step 1: Run baseline tests
bun run benchmark:baseline
bun run test:load:websocket -- --connections 100 --output baseline-load.json

# Step 2: Identify bottlenecks
bun run analyze:performance
```

### 2. Optimization Implementation
```bash
# Step 3: Apply optimizations
# Configure connection pool
# Enable message batching
# Tune Durable Objects

# Step 4: Validate improvements
bun run benchmark:compare
bun run test:production-readiness
```

### 3. Continuous Monitoring
```bash
# Step 5: Set up monitoring
bun run monitor:start

# Step 6: Regular testing
bun run test:all -- --schedule weekly
```

## Troubleshooting

### Common Issues

**High Latency**:
```bash
# Diagnose latency issues
bun run benchmark -- --suites latency --iterations 1000
bun run test:load:websocket -- --connections 100 --detailed-logging true
```

**Connection Problems**:
```bash
# Test connection stability
bun run test:stress:connections -- --waves 5 --connections 50
curl http://localhost:8787/api/websocket/health
```

**Memory Issues**:
```bash
# Analyze memory usage
bun run profile:memory:gc -- --duration 300 --threshold 50
```

**Performance Regression**:
```bash
# Compare with baseline
bun run benchmark:compare
bun run test:production-readiness
```

## Additional Resources

- **[Load Testing Guide](docs/performance/LOAD_TESTING_GUIDE.md)** - Comprehensive testing documentation
- **[Architecture Overview](CLAUDE.md)** - System architecture details
- **[API Documentation](docs/api/)** - API reference
- **[Deployment Guide](docs/deployment/)** - Production deployment

---

** Ready for Enterprise Scale**

This performance suite validates your WebSocket + Durable Objects system for enterprise-grade deployment with confidence in reliability, scalability, and performance under real-world conditions.

** Get Started**: `bun run test:production-readiness`