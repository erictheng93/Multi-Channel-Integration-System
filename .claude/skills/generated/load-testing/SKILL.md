---
name: load-testing
description: "Skill for the Load-testing area of Multi-Channel-Integration-System. 39 symbols across 2 files."
---

# Load-testing

39 symbols | 2 files | Cohesion: 68%

## When to Use

- Working with code in `scripts/`
- Understanding how WebSocketLoadTester, runLoadTest, rampUpPhase work
- Modifying load-testing-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `scripts/load-testing/durable-objects-stress-test.ts` | runStressTest, stressTestUserConnections, stressTestDistributedLocks, testLockContention, stressTestCrossRoomEvents (+23) |
| `scripts/load-testing/websocket-load-test.ts` | WebSocketLoadTester, runLoadTest, rampUpPhase, sustainedLoadPhase, rampDownPhase (+6) |

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `WebSocketLoadTester` | Class | `scripts/load-testing/websocket-load-test.ts` | 134 |
| `runTest` | Function | `scripts/load-testing/websocket-load-test.ts` | 643 |
| `runStressTest` | Function | `scripts/load-testing/durable-objects-stress-test.ts` | 920 |
| `runLoadTest` | Method | `scripts/load-testing/websocket-load-test.ts` | 154 |
| `rampUpPhase` | Method | `scripts/load-testing/websocket-load-test.ts` | 187 |
| `sustainedLoadPhase` | Method | `scripts/load-testing/websocket-load-test.ts` | 225 |
| `rampDownPhase` | Method | `scripts/load-testing/websocket-load-test.ts` | 257 |
| `createConnection` | Method | `scripts/load-testing/websocket-load-test.ts` | 278 |
| `startMessageGeneration` | Method | `scripts/load-testing/websocket-load-test.ts` | 394 |
| `generateResults` | Method | `scripts/load-testing/websocket-load-test.ts` | 541 |
| `percentile` | Method | `scripts/load-testing/websocket-load-test.ts` | 596 |
| `sleep` | Method | `scripts/load-testing/websocket-load-test.ts` | 618 |
| `runStressTest` | Method | `scripts/load-testing/durable-objects-stress-test.ts` | 121 |
| `stressTestUserConnections` | Method | `scripts/load-testing/durable-objects-stress-test.ts` | 347 |
| `stressTestDistributedLocks` | Method | `scripts/load-testing/durable-objects-stress-test.ts` | 654 |
| `testLockContention` | Method | `scripts/load-testing/durable-objects-stress-test.ts` | 671 |
| `stressTestCrossRoomEvents` | Method | `scripts/load-testing/durable-objects-stress-test.ts` | 701 |
| `makeRequest` | Method | `scripts/load-testing/durable-objects-stress-test.ts` | 770 |
| `stressUserConnection` | Method | `scripts/load-testing/durable-objects-stress-test.ts` | 358 |
| `testUserMessaging` | Method | `scripts/load-testing/durable-objects-stress-test.ts` | 403 |

## How to Explore

1. `gitnexus_context({name: "WebSocketLoadTester"})` — see callers and callees
2. `gitnexus_query({query: "load-testing"})` — find related execution flows
3. Read key files listed above for implementation details
