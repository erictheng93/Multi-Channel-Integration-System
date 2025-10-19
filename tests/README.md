

```
tests/
 unit/ #
 utils/ #
 auth.test.ts #
 handlers/ # API
 services/ #
 integration/ #
 activity-log.test.ts #
 e2e/ #
 helpers/ #
 mockDatabase.ts #
 mockKV.ts # KV
 testData.ts #
 test-activity-logging.ts #
 test-permissions.ts #
 run-all-tests.ts #
 setup.ts #
 vitest.config.ts # Vitest
 package.json #
```


```bash
cd tests
npm install
```


```bash
# npm
npm test


npx tsx run-all-tests.ts
```


```bash

npx tsx integration/activity-log.test.ts


npx tsx test-activity-logging.ts


npx tsx test-permissions.ts


npm test auth.test.ts
```


```bash
npm run test:coverage
```


```bash
npm run test:watch
```

### UI
```bash
npm run test:ui
```


1. **** (`unit/utils/auth.test.ts`)
 - JWT
 -
 -
 -
 -


2. **** (`unit/utils/database.test.ts`)
3. **LINE ** (`unit/utils/line.test.ts`)
4. **API ** (`unit/handlers/`)


5. **** (`unit/frontend/`)
6. **** (`integration/`)


### MockD1Database
 Cloudflare D1
```typescript
import { createMockDatabase } from './helpers/mockDatabase'

const mockDB = createMockDatabase()
mockDB.mockQuery('SELECT * FROM users WHERE id = ?', mockUser)
```

### MockKVNamespace
 Cloudflare KV
```typescript
import { createMockKV } from './helpers/mockKV'

const mockKV = createMockKV()
mockKV.setMockValue('session:123', JSON.stringify(sessionData))
```


```typescript
import { mockUsers, testPasswords } from './helpers/testData'

//
const adminUser = mockUsers.admin
const validPassword = testPasswords.valid
```


```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { functionToTest } from '../../../src/path/to/module'
import { createMockDatabase } from '../../helpers/mockDatabase'

describe('Module Name', () => {
 const mockDB = createMockDatabase()

 beforeEach(() => {
 mockDB.reset()
 })

 describe('functionToTest', () => {
 it('should do something when given valid input', async () => {
 // Arrange
 const input = 'test-input'
 mockDB.mockQuery('SELECT * FROM table', { id: 1 })

 // Act
 const result = await functionToTest(mockDB, input)

 // Assert
 expect(result).toBeDefined()
 expect(result.id).toBe(1)
 })
 })
})
```


1. **AAA **: ArrangeActAssert
2. ****:
3. ****:
4. ****: mock
5. ****:
6. ****: `beforeEach` mock


-
- Pull Request
-


- : 90%+
- API : 80%+
- : 85%+
- : 75%+