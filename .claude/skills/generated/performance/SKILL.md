---
name: performance
description: "Skill for the Performance area of Multi-Channel-Integration-System. 55 symbols across 3 files."
---

# Performance

55 symbols | 3 files | Cohesion: 87%

## When to Use

- Working with code in `tools/`
- Understanding how runMemoryProfile, establishBaseline, startMemoryMonitoring work
- Modifying performance-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `tools/performance/benchmark-suite.ts` | runLatencyBenchmarks, operation, benchmarkHttpRequest, benchmarkWebSocketConnect, benchmarkMessageBroadcast (+24) |
| `tools/performance/memory-profiler.ts` | runMemoryProfile, establishBaseline, startMemoryMonitoring, runMemoryStressTests, test (+14) |
| `tests/performance/qr-code-parallel-performance.test.ts` | simulateDelay, simulateParallelTeamFinding, simulateSequentialTeamFinding, simulateBroadcast, simulateFollowEventProcessing (+2) |

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `PerformanceBenchmarkSuite` | Class | `tools/performance/benchmark-suite.ts` | 113 |
| `test` | Function | `tools/performance/memory-profiler.ts` | 211 |
| `runMemoryProfiler` | Function | `tools/performance/memory-profiler.ts` | 802 |
| `operation` | Function | `tools/performance/benchmark-suite.ts` | 340 |
| `simulateDelay` | Function | `tests/performance/qr-code-parallel-performance.test.ts` | 136 |
| `simulateParallelTeamFinding` | Function | `tests/performance/qr-code-parallel-performance.test.ts` | 141 |
| `simulateSequentialTeamFinding` | Function | `tests/performance/qr-code-parallel-performance.test.ts` | 172 |
| `simulateBroadcast` | Function | `tests/performance/qr-code-parallel-performance.test.ts` | 196 |
| `simulateFollowEventProcessing` | Function | `tests/performance/qr-code-parallel-performance.test.ts` | 202 |
| `runBenchmarks` | Function | `tools/performance/benchmark-suite.ts` | 896 |
| `runMemoryProfile` | Method | `tools/performance/memory-profiler.ts` | 125 |
| `establishBaseline` | Method | `tools/performance/memory-profiler.ts` | 159 |
| `startMemoryMonitoring` | Method | `tools/performance/memory-profiler.ts` | 175 |
| `runMemoryStressTests` | Method | `tools/performance/memory-profiler.ts` | 207 |
| `testWebSocketMemory` | Method | `tools/performance/memory-profiler.ts` | 237 |
| `testMessageMemory` | Method | `tools/performance/memory-profiler.ts` | 287 |
| `testDurableObjectMemory` | Method | `tools/performance/memory-profiler.ts` | 312 |
| `testDistributedLockMemory` | Method | `tools/performance/memory-profiler.ts` | 331 |
| `testMemoryCleanup` | Method | `tools/performance/memory-profiler.ts` | 342 |
| `testLockCycle` | Method | `tools/performance/memory-profiler.ts` | 447 |

## How to Explore

1. `gitnexus_context({name: "runMemoryProfile"})` — see callers and callees
2. `gitnexus_query({query: "performance"})` — find related execution flows
3. Read key files listed above for implementation details
