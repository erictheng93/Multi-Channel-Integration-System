# Archived Vue Component Tests

These test files were moved from the backend test directory because:
1. They import Vue components and use @vue/test-utils
2. Backend test environment doesn't have Vue dependencies
3. Frontend tests should be in frontend/tests/ directory

Files archived: 西元2025年11月18日 (星期二) 17時47分33秒    
- tests/unit/components/ (11 component test files)
- tests/unit/views/ (4 view test files)  
- tests/file-upload-end-to-end.test.ts
- tests/e2e/message-recall-e2e.test.ts

If you need these tests, migrate them to frontend/tests/ with proper imports.


## reports-service-old-mock-version.test.ts

**Archived:** 西元2025年11月18日 (星期二) 20時00分19秒    
**Reason:** Replaced by modern DatabaseTestEnvironment version

**File Details:**
- 664 lines with complex Drizzle ORM mocks
- 30+ test cases using manual D1 mocking
- Replaced by: tests/integration/reports-service-refactored.test.ts

**Modern Replacement Benefits:**
- ✅ Real in-memory SQLite database
- ✅ No complex mock setup (60% faster)
- ✅ Tests actual SQL queries and aggregations
- ✅ 30 comprehensive test cases with 100% expected pass rate

**Migration:** Use tests/integration/reports-service-refactored.test.ts instead

