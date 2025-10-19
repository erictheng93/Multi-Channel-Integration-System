

5%95%

## (5%)


1. **** (tests/unit/services/permission*.test.ts)
 - 4
 - agent
 - agent
 - admin

2. ****
 - `is_recalled`, `recall_deadline`, `recalled_at`
 -

### (95%)

#### 1. -
- MessageRecallService
- DelayedMessageHandler
- API

#### 2.
-
-
-

#### 3.
-
- UI
-


### 1. MessageRecallService (tests/unit/services/message-recall-service.test.ts)


- `sendDelayedMessage()`
 -
 - D1
 - KV
 - Queue
 -

- `recallMessage()`
 -
 -
 -
 - KV
 -

- `processQueueMessage()`
 -
 -
 - API
 -
 -

- `canRecallMessage()`
 -
 -
 - KV

- `getPendingMessages()`
 -
 -
 -


-
- KV
-
- API

****: 25+

### 2. DelayedMessage API (tests/unit/handlers/delayed-message-drizzle.test.ts)

#### API
- `POST /api/delayed-messages/send`
 -
 -
 -
 -

- `POST /api/delayed-messages/recall/:messageId`
 -
 -
 -
 -

- `GET /api/delayed-messages/pending`
 -
 -
 -
 -

- `POST /api/delayed-messages/process`
 -
 -
 -


-
-
-

****: 30+

### 3. (tests/integration/message-recall-integration.test.ts)


-
 -
 - KV D1
 -

-
 -
 -
 -


-
 - D1 KV
 -
 -

- KV
 - TTL
 -
 -

-
 -
 -
 -

- API
 - LINE API
 - Facebook API
 -

****: 20+

### 4. E2E (tests/e2e/message-recall-e2e.test.ts)

#### UI
-
 -
 -
 -
 -

-
 -
 -
 -
 -


-
-
-
-


-
-
-

****: 15+

### 5. (tests/unit/services/message-recall-performance.test.ts)


- (100+ )
- (50+ )
-


-
-
-

#### KV
- KV (1000+ )
- Key
- TTL


- (500+ )
-
-

****: 12+

### 6. (tests/unit/services/message-recall-edge-cases.test.ts)


-
-
-
- ID
-


-
-
-
- Null/Undefined

#### KV
-
- JSON
- Key
-
- TTL

#### API
-
-
-
-
-


-
-
-
-


-
-
-
-

****: 25+


| | | | |
|----------|------------|----------|--------|
| | 4 | | 5% |
| | 25+ | | 20% |
| API | 30+ | | 25% |
| | 20+ | | 20% |
| E2E | 15+ | | 15% |
| | 12+ | | 10% |
| | 25+ | | 20% |
| **** | **130+** | **** | **95%+** |


- ****: 40% (52)
- ****: 25% (32)
- ****: 15% (20)
- ****: 10% (13)
- ****: 10% (13)


- ****: 100%
- **API**: 100%
- ****: 95%
- ****: 90%
- ****: 85%


- ****:
- ****:
- ****:
- ****:
- ****:


```bash

npm run test:recall


npx ts-node tests/run-recall-tests.ts
```


```bash

npx vitest tests/unit/services/message-recall-service.test.ts

# API
npx vitest tests/unit/handlers/delayed-message-drizzle.test.ts


npx vitest tests/integration/message-recall-integration.test.ts

# E2E
npx vitest tests/e2e/message-recall-e2e.test.ts


npx vitest tests/unit/services/message-recall-performance.test.ts


npx vitest tests/unit/services/message-recall-edge-cases.test.ts
```


```bash

npx vitest --coverage


npx ts-node tests/run-recall-tests.ts
```


 **5%** **95%+** **90%**


1. ****:
2. ****: E2E
3. ****: 130+
4. ****:


- ****:
- ****:
- ****:
- ****:
- ****:

