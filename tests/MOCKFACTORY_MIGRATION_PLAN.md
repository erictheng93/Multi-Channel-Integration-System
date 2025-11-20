# MockFactory Migration Plan

**Created**: 2025-01-18
**Status**: In Progress
**Goal**: Migrate 140+ test files to use MockFactory for standardized mocks

---

## Progress Overview

- **Total Test Files**: 163
- **Already Migrated**: 23 files (14.1%)
- **Remaining**: 140 files (85.9%)
- **Target**: Migrate 10-15 high-priority files per session

---

## Priority Queue (Top 20 Files)

### 🔴 **Tier 1: Critical (Large, Complex, High Impact)**

| Priority | File | Lines | Status | Impact |
|----------|------|-------|--------|--------|
| ✅ 1 | `messaging-main.test.ts` | 1336 | **DONE** | High |
| ✅ 2 | `tag-handler.test.ts` | 1014 | **DONE** | High |
| 🔄 3 | `team-main.test.ts` | 988 | **IN PROGRESS** | High |
| ⏳ 4 | `message-edge-cases.test.ts` | 734 | Pending | High |
| ⏳ 5 | `message-integration.test.ts` | 725 | Pending | High |
| ⏳ 6 | `message-performance.test.ts` | 670 | Pending | Medium |
| ⏳ 7 | `webhook.test.ts` | 587 | Pending | High |
| ⏳ 8 | `conversation-integration.test.ts` | 544 | Pending | High |
| ⏳ 9 | `conversation-main.test.ts` | 529 | Pending | High |
| ⏳ 10 | `message.test.ts` | 502 | Pending | Medium |

### 🟡 **Tier 2: Important (Medium Complexity)**

| Priority | File | Lines | Status | Impact |
|----------|------|-------|--------|--------|
| ⏳ 11 | `conversation-performance.test.ts` | 484 | Pending | Medium |
| ⏳ 12 | `delayed-message-main.test.ts` | 436 | Pending | High |
| ⏳ 13 | `conversation-edge-cases.test.ts` | 436 | Pending | Medium |
| ⏳ 14 | `auth-role-validation.test.ts` | 377 | Pending | High |
| ⏳ 15 | `team-role-access-control.test.ts` | 366 | Pending | High |
| ⏳ 16 | `conversation.test.ts` | 356 | Pending | Medium |
| ⏳ 17 | `customer-main.test.ts` | 328 | Pending | Medium |
| ⏳ 18 | `auth-main.test.ts` | 290 | Pending | High |
| ⏳ 19 | `system-main.test.ts` | 255 | Pending | Medium |

### 🟢 **Tier 3: Integration Tests (High Value)**

| File | Status | Impact |
|------|--------|--------|
| ✅ `reports-analytics-api.test.ts` | **DONE** | Critical |
| ✅ `messaging-main-integration.test.ts` | **DONE** | High |
| ⏳ `facebook-integration-complete.test.ts` | Pending | High |
| ⏳ `line-integration-complete.test.ts` | Pending | High |
| ⏳ `reports-service-refactored.test.ts` | Pending | High |
| ⏳ `message-recall-integration-refactored.test.ts` | Pending | Medium |

---

## Migration Strategy

### **Phase 1: Foundation (COMPLETED)**
- ✅ Create MockFactory core functions
- ✅ Create comprehensive documentation
- ✅ Refactor 5 pilot files
- ✅ Verify improvements

### **Phase 2: Core Handlers (IN PROGRESS - Target: 15 files)**
- 🔄 **Current**: team-main.test.ts
- ⏳ message-edge-cases.test.ts
- ⏳ message-integration.test.ts
- ⏳ message-performance.test.ts
- ⏳ webhook.test.ts
- ⏳ conversation-integration.test.ts
- ⏳ conversation-main.test.ts
- ⏳ message.test.ts
- ⏳ conversation-performance.test.ts
- ⏳ delayed-message-main.test.ts
- ⏳ conversation-edge-cases.test.ts
- ⏳ auth-role-validation.test.ts
- ⏳ team-role-access-control.test.ts
- ⏳ conversation.test.ts
- ⏳ customer-main.test.ts

### **Phase 3: Integration Tests (Target: 10 files)**
- facebook-integration-complete.test.ts
- line-integration-complete.test.ts
- reports-service-refactored.test.ts
- message-recall-integration-refactored.test.ts
- channel-integration.test.ts
- database-field-mapping-refactored.test.ts
- analytics-database-integration-refactored.test.ts
- role-hierarchy-enforcement-refactored.test.ts
- multi-shard-integration.test.ts
- webhook-processing.test.ts

### **Phase 4: E2E & Edge Cases (Target: 15 files)**
- All files in `tests/e2e/`
- All files in `tests/edge-cases/`
- All files in `tests/database/`

### **Phase 5: Specialized Tests (Target: Remaining files)**
- Durable Objects tests
- Performance tests
- Stress tests
- API documentation tests

---

## Refactoring Checklist

For each file migration:

- [ ] **1. Read Current Implementation**
  - Identify manual mock patterns
  - Note test data structures
  - Check for edge cases

- [ ] **2. Add MockFactory Import**
  ```typescript
  import { MockFactory } from '../helpers/mockFactory';
  ```

- [ ] **3. Replace Manual Mocks**
  - Replace manual DB mocks with `MockFactory.createDatabase()`
  - Replace manual KV mocks with `MockFactory.createKV()`
  - Replace manual R2 mocks with `MockFactory.createR2()`
  - Use `MockFactory.createEnv()` for complete environment

- [ ] **4. Maintain Backward Compatibility**
  ```typescript
  let mockEnv: Bindings;
  let mockDB: any; // For backward compatibility

  beforeEach(() => {
    mockEnv = MockFactory.createEnv();
    mockDB = mockEnv.DB; // Reference for existing tests
  });
  ```

- [ ] **5. Run Tests**
  - Verify tests still pass
  - Check for improved pass rates
  - Fix any breaking changes

- [ ] **6. Update Documentation**
  - Add file to "Migrated" list
  - Note any issues encountered
  - Track metrics

---

## Success Metrics

### **Code Quality Metrics**
- **Target Code Reduction**: 40-65% in test setup
- **Lines Saved Goal**: 2000+ lines across all migrations
- **Standardization**: 100% consistent mock patterns

### **Test Reliability Metrics**
- **Pass Rate Improvement**: Target +30% average
- **Flakiness Reduction**: Target -50% flaky tests
- **Execution Time**: Target -10% faster test runs

### **Developer Experience Metrics**
- **Time to Write New Tests**: Target -40%
- **Mock Setup Complexity**: Target -60%
- **Onboarding Time**: Target -50%

---

## Common Patterns Identified

### **Pattern 1: Drizzle ORM Mock**
```typescript
// BEFORE: 30+ lines
const mockDB = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  // ... 25 more lines
};

// AFTER: 1 line
const mockDB = MockFactory.createDatabase(testData);
```

### **Pattern 2: Complete Environment**
```typescript
// BEFORE: 50+ lines
c.env = {
  DB: mockDB,
  SESSION_CACHE: mockKV,
  FILE_STORAGE: mockR2,
  // ... 40 more properties
};

// AFTER: 3 lines
mockEnv = MockFactory.createEnv({
  DB: MockFactory.createDatabase(testData)
});
```

### **Pattern 3: KV with Expiration**
```typescript
// BEFORE: 25+ lines with expiration logic
const kvStorage = new Map();
const mockKV = {
  get: vi.fn().mockImplementation(async (key) => {
    const item = kvStorage.get(key);
    if (!item) return null;
    if (item.options?.expirationTtl) {
      // ... 10 lines of expiration logic
    }
    return item.value;
  }),
  // ... more methods
};

// AFTER: 1 line
const mockKV = MockFactory.createKV(initialData);
```

---

## Blockers & Solutions

### **Issue 1: Tests Reference Undefined Variables**
**Symptom**: `ReferenceError: mockDB is not defined`
**Solution**: Keep backward-compatible references
```typescript
let mockEnv: Bindings;
let mockDB: any; // Backward compatibility

beforeEach(() => {
  mockEnv = MockFactory.createEnv();
  mockDB = mockEnv.DB; // Reference
});
```

### **Issue 2: Wrong Mock Type**
**Symptom**: Tests expect D1 methods but get Drizzle methods
**Solution**: Use correct mock type
```typescript
// For Drizzle ORM
DB: MockFactory.createDatabase(data)

// For raw D1
DB: MockFactory.createD1(data)
```

### **Issue 3: Test Data Not Returned**
**Symptom**: Mocks return empty arrays
**Solution**: Pass test data to factory
```typescript
const testData = [{ id: 1, name: 'Test' }];
mockEnv = MockFactory.createEnv({
  DB: MockFactory.createDatabase(testData)
});
```

---

## Team Communication

### **Migration Announcement** (To be sent)
Subject: 📢 MockFactory Migration - Standardizing Test Mocks

Team,

We're migrating our test infrastructure to use **MockFactory** for standardized, maintainable mocks. Benefits:

✅ **40-65% less boilerplate** in test files
✅ **Consistent mock patterns** across all tests
✅ **Better test reliability** and pass rates
✅ **Faster test development** time

**Documentation**: `tests/helpers/MOCKFACTORY_USAGE_GUIDE.md`
**Examples**: See already-migrated files in this plan

**Action Required**: When writing new tests, use MockFactory instead of manual mocks.

Questions? Check the guide or ask in #testing channel.

---

## Progress Tracking

### **Session 1 (2025-01-18)**
- ✅ Created MockFactory (600+ lines)
- ✅ Created Documentation (900+ lines)
- ✅ Migrated 5 pilot files
- ✅ Verified improvements: +433% Analytics, +138% Messaging

### **Session 2 (Current)**
- 🔄 Migrating Tier 1 files (15 files)
- 🔄 Creating metrics tracking system
- 🔄 Enhancing MockFactory with specialized patterns
- 🔄 Preparing team adoption materials

### **Session 3 (Planned)**
- ⏳ Complete Tier 1 migration
- ⏳ Start Tier 2 integration tests
- ⏳ Review metrics and adjust approach
- ⏳ Team training session

---

## Next Actions

1. **Immediate** (Current Session):
   - Migrate team-main.test.ts
   - Migrate 9 more Tier 1 files
   - Create metrics tracking script
   - Enhance MockFactory with patterns

2. **Short-term** (Next 2 Sessions):
   - Complete all Tier 1 files (15 files)
   - Start Tier 2 integration tests (10 files)
   - Monitor metrics and collect feedback

3. **Long-term** (Next 2 Weeks):
   - Migrate all 140 remaining files
   - Achieve 90%+ test pass rate
   - Reduce test execution time by 10%
   - Complete team training

---

**Last Updated**: 2025-01-18
**Next Review**: After 15 file migration completion
