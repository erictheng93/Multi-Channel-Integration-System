---
name: stress-testing
description: "Skill for the Stress-testing area of Multi-Channel-Integration-System. 25 symbols across 2 files."
---

# Stress-testing

25 symbols | 2 files | Cohesion: 86%

## When to Use

- Working with code in `scripts/`
- Understanding how ConnectionStormTester, runConnectionStorm, executeStormWaves work
- Modifying stress-testing-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `scripts/stress-testing/connection-storm-test.ts` | ConnectionStormTester, runConnectionStorm, executeStormWaves, executeWave, createWaveConnections (+8) |
| `scripts/stress-testing/message-flood-test.ts` | runMessageFlood, analyzeResults, runMessageFlood, establishConnections, createFloodConnection (+7) |

## Entry Points

Start here when exploring this area:

- **`ConnectionStormTester`** (Class) — `scripts/stress-testing/connection-storm-test.ts:115`
- **`runConnectionStorm`** (Method) — `scripts/stress-testing/connection-storm-test.ts:130`
- **`executeStormWaves`** (Method) — `scripts/stress-testing/connection-storm-test.ts:161`
- **`executeWave`** (Method) — `scripts/stress-testing/connection-storm-test.ts:184`
- **`createWaveConnections`** (Method) — `scripts/stress-testing/connection-storm-test.ts:260`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ConnectionStormTester` | Class | `scripts/stress-testing/connection-storm-test.ts` | 115 |
| `runConnectionStorm` | Method | `scripts/stress-testing/connection-storm-test.ts` | 130 |
| `executeStormWaves` | Method | `scripts/stress-testing/connection-storm-test.ts` | 161 |
| `executeWave` | Method | `scripts/stress-testing/connection-storm-test.ts` | 184 |
| `createWaveConnections` | Method | `scripts/stress-testing/connection-storm-test.ts` | 260 |
| `createStormConnection` | Method | `scripts/stress-testing/connection-storm-test.ts` | 281 |
| `disconnectWaveConnections` | Method | `scripts/stress-testing/connection-storm-test.ts` | 349 |
| `gracefulDisconnect` | Method | `scripts/stress-testing/connection-storm-test.ts` | 385 |
| `measureSystemRecovery` | Method | `scripts/stress-testing/connection-storm-test.ts` | 409 |
| `captureSystemMetrics` | Method | `scripts/stress-testing/connection-storm-test.ts` | 470 |
| `analyzeResults` | Method | `scripts/stress-testing/connection-storm-test.ts` | 504 |
| `sleep` | Method | `scripts/stress-testing/connection-storm-test.ts` | 651 |
| `runMessageFlood` | Method | `scripts/stress-testing/message-flood-test.ts` | 150 |
| `analyzeResults` | Method | `scripts/stress-testing/message-flood-test.ts` | 630 |
| `establishConnections` | Method | `scripts/stress-testing/message-flood-test.ts` | 183 |
| `createFloodConnection` | Method | `scripts/stress-testing/message-flood-test.ts` | 201 |
| `setupConnectionHandlers` | Method | `scripts/stress-testing/message-flood-test.ts` | 250 |
| `executeMessageFlood` | Method | `scripts/stress-testing/message-flood-test.ts` | 345 |
| `waitForMessageDelivery` | Method | `scripts/stress-testing/message-flood-test.ts` | 589 |
| `sleep` | Method | `scripts/stress-testing/message-flood-test.ts` | 821 |

## How to Explore

1. `gitnexus_context({name: "ConnectionStormTester"})` — see callers and callees
2. `gitnexus_query({query: "stress-testing"})` — find related execution flows
3. Read key files listed above for implementation details
