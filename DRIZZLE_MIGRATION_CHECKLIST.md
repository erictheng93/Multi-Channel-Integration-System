# Drizzle ORM Migration Checklist

## 🎯 Goal: Achieve 100% Drizzle ORM compliance in production code

### ✅ Completed Migrations

- [x] `src/handlers/auth.ts` - Authentication handlers
- [x] `src/handlers/team.ts` - Team management  
- [x] `src/handlers/system.ts` - System settings and health
- [x] `src/services/activity-service.ts` - Activity logging
- [x] `src/services/database.ts` - Core database service
- [x] `src/db/schema.ts` - Added metrics table for analytics
- [x] Fixed analytics.ts metrics table issue

### 🚨 Priority Files (Production Critical)

#### Handler Files
- [ ] `src/handlers/conversation.ts` - **HIGH PRIORITY** 
- [ ] `src/handlers/message.ts` - **HIGH PRIORITY** (partially done)
- [ ] `src/handlers/notification.ts` - **HIGH PRIORITY**
- [ ] `src/handlers/customer.ts` - **MEDIUM PRIORITY**
- [ ] `src/handlers/attachment.ts` - **MEDIUM PRIORITY** (partially done)
- [ ] `src/handlers/tag.ts` - **MEDIUM PRIORITY**
- [ ] `src/handlers/activity.ts` - **MEDIUM PRIORITY**
- [ ] `src/handlers/realtime.ts` - **LOW PRIORITY**
- [ ] `src/handlers/conversation-main.ts` - **LOW PRIORITY**
- [ ] `src/handlers/notification-optimized.ts` - **LOW PRIORITY**

#### Service Files
- [ ] `src/services/message-recall-service.ts` - **HIGH PRIORITY**
- [ ] `src/services/user-sync.ts` - **MEDIUM PRIORITY**

#### Enterprise Files
- [ ] `src/enterprise/analytics.ts` - **MEDIUM PRIORITY** (partially done)
- [ ] `src/enterprise/audit-logger.ts` - **MEDIUM PRIORITY** 
- [ ] `src/enterprise/rbac.ts` - **MEDIUM PRIORITY**

#### Utility Files
- [ ] `src/utils/performance.ts` - **LOW PRIORITY**
- [ ] `src/utils/session.ts` - **LOW PRIORITY**
- [ ] `src/utils/team.ts` - **LOW PRIORITY**

#### Route Files
- [ ] `src/routes/enhanced-routes.ts` - **MEDIUM PRIORITY**

### 🔧 Migration Process for Each File

#### Phase 1: Analysis
1. [ ] Scan file for native D1 patterns:
   - `c.env.DB.prepare()`
   - `drizzle(c.env.DB).run(sql\`...)`
   - `.bind().all()`, `.bind().first()`, `.bind().run()`
   - Raw SQL template literals

2. [ ] Identify tables used:
   - Extract table names from SQL
   - Map to schema imports needed

3. [ ] Note complex patterns:
   - Dynamic queries
   - Complex JOINs
   - Search functionality
   - Pagination

#### Phase 2: Import Setup
1. [ ] Add required Drizzle imports:
   ```typescript
   import { eq, and, or, desc, asc, like, count, sum, avg, inArray } from 'drizzle-orm';
   ```

2. [ ] Add schema imports:
   ```typescript
   import { tableName1, tableName2 } from '../db/schema';
   ```

#### Phase 3: Pattern Conversion

**Basic SELECT:**
```typescript
// OLD: drizzle(c.env.DB).run(sql`SELECT * FROM users WHERE id = ?`, [id])
// NEW: db.select().from(users).where(eq(users.id, id))
```

**INSERT:**
```typescript
// OLD: drizzle(c.env.DB).run(sql`INSERT INTO users (...) VALUES (...)`, [...])
// NEW: db.insert(users).values({ ... })
```

**UPDATE:**
```typescript
// OLD: drizzle(c.env.DB).run(sql`UPDATE users SET name = ? WHERE id = ?`, [name, id])
// NEW: db.update(users).set({ name }).where(eq(users.id, id))
```

**DELETE:**
```typescript
// OLD: drizzle(c.env.DB).run(sql`DELETE FROM users WHERE id = ?`, [id])
// NEW: db.delete(users).where(eq(users.id, id))
```

**Complex WHERE:**
```typescript
// Multiple conditions: and(), or()
// LIKE queries: like(field, '%pattern%')
// IN queries: inArray(field, [values])
```

#### Phase 4: Field Mapping
Convert database field names to schema camelCase:
- `user_id` → `userId`
- `created_at` → `createdAt`  
- `is_active` → `isActive`

#### Phase 5: Result Processing
Update result handling:
```typescript
// OLD: result.results || []
// NEW: result (Drizzle returns array directly)

// OLD: result.meta.changes  
// NEW: Drizzle doesn't return change count - need alternative approach
```

### 🛠 Common Migration Patterns

#### Pattern 1: Context Issues
**Problem:** `c.env.DB` used outside request context
```typescript
// OLD: const db = drizzle(c.env.DB || this.db)
// NEW: const db = drizzle(this.db)
```

#### Pattern 2: Dynamic SQL  
**Problem:** Complex search with dynamic WHERE clauses
```typescript
// Solution: Build conditions array, use and()/or()
const conditions = [];
if (filter.name) conditions.push(like(table.name, `%${filter.name}%`));
if (filter.active) conditions.push(eq(table.isActive, true));
const query = db.select().from(table).where(and(...conditions));
```

#### Pattern 3: Pagination
```typescript
// OLD: LIMIT ? OFFSET ?
// NEW: .limit(pageSize).offset((page - 1) * pageSize)
```

#### Pattern 4: Joins
```typescript
// OLD: Complex SQL JOINs
// NEW: .leftJoin(), .innerJoin() with proper conditions
```

### 🧪 Testing Strategy

For each migrated file:
1. [ ] **Syntax Check:** `npm run build`
2. [ ] **Type Check:** `npm run lint:check` 
3. [ ] **Unit Tests:** Run relevant test files
4. [ ] **Integration Tests:** Test API endpoints
5. [ ] **Manual Testing:** Test functionality in UI

### 🚀 Automated Tools

#### Migration Helper Script
```bash
# Run automated migration helper
npx ts-node scripts/drizzle-migration-helper.ts
```

#### Validation Script
```bash
# Check for remaining native D1 patterns  
npx ts-node scripts/validate-drizzle-compliance.ts
```

### 📊 Progress Tracking

**Overall Progress:** ~25% Complete (5/20 files)

**By Category:**
- Handlers: 3/11 (27%)
- Services: 1/3 (33%)
- Enterprise: 0/3 (0%)
- Utilities: 0/3 (0%)
- Routes: 0/1 (0%)

**Estimated Time Remaining:** 8-10 hours

### ⚠️ Known Issues & Gotchas

1. **Metrics Table:** Added to schema, migration needed in production
2. **Field Name Mismatches:** Schema uses camelCase, DB uses snake_case
3. **Context Scope:** Some files reference `c.env.DB` outside request context
4. **Change Counts:** Drizzle doesn't return affected row counts like native D1
5. **Complex Search:** Dynamic query building needs complete rewrite

### 🎉 Definition of Done

A file is considered "100% Drizzle compliant" when:
- [ ] No `c.env.DB.prepare()` calls
- [ ] No `drizzle().run(sql\`...`)` with parameters  
- [ ] All queries use Drizzle query builder
- [ ] All field references use schema camelCase
- [ ] TypeScript compiles without errors
- [ ] All tests pass
- [ ] Manual testing confirms functionality

### 📝 Next Steps

1. **Run Migration Script:** Apply automated patterns
2. **Focus on HIGH PRIORITY files first**
3. **Test each file after migration**  
4. **Create database migration for metrics table**
5. **Final validation and testing**

---

*Last Updated: 2025-01-31*  
*Progress tracked in: `DRIZZLE_MIGRATION_CHECKLIST.md`*