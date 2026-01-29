# Naming Conventions - 命名規範指南

## 📋 Overview / 概述

本項目採用**分層命名規範**（Layered Naming Convention），在不同層級使用符合該層慣例的命名風格，通過 Drizzle ORM 實現自動轉換。

## ✅ 統一規範 (Unified Standards)

### **Application Layer (TypeScript/JavaScript) - 應用層**
- **規則**: 一律使用 **camelCase**
- **適用範圍**:
  - 所有 TypeScript/JavaScript 變量、函數、屬性
  - Drizzle ORM 的 schema 定義（JavaScript 屬性名）
  - API 響應的 JSON 對象
  - 測試文件中的斷言

### **Database Layer (SQL) - 數據庫層**
- **規則**: 一律使用 **snake_case**
- **適用範圍**:
  - SQL 列名（僅在 schema 定義的字符串參數中）
  - 原始 SQL 查詢
  - 數據庫遷移文件

### **Constants and Environment Variables - 常量與環境變量**
- **規則**: 一律使用 **SCREAMING_SNAKE_CASE**
- **適用範圍**:
  - 環境變量：`JWT_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`
  - 全局常量：`MAX_RETRY_COUNT`, `DEFAULT_TIMEOUT`

---

## 🎯 Drizzle ORM 使用模式

### ✅ 正確示例 (Correct Examples)

#### 1. Schema 定義

```typescript
// src/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const customers = sqliteTable('customers', {
  id: integer('id').primaryKey(),
  // ✅ JavaScript 屬性名：camelCase
  // ✅ SQL 列名（字符串參數）：snake_case
  platformUserId: text('platform_user_id').notNull(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});
```

#### 2. 插入數據

```typescript
// ✅ 使用 camelCase
await db.insert(customers).values({
  platformUserId: 'line_user_123',
  displayName: 'John Doe',
  avatarUrl: 'https://example.com/avatar.jpg',
});
```

#### 3. 查詢數據

```typescript
// ✅ SELECT 中使用 camelCase
const customer = await db
  .select({
    id: customers.id,
    platformUserId: customers.platformUserId,  // ✅ camelCase
    displayName: customers.displayName,        // ✅ camelCase
    avatarUrl: customers.avatarUrl,            // ✅ camelCase
    createdAt: customers.createdAt,            // ✅ camelCase
  })
  .from(customers)
  .where(eq(customers.id, 1))
  .get();

// ✅ 返回的對象已經是 camelCase
console.log(customer.platformUserId);  // ✅ 直接使用 camelCase
console.log(customer.displayName);     // ✅ 直接使用 camelCase
```

#### 4. 測試斷言

```typescript
// ✅ 測試中使用 camelCase
test('should return customer with correct data', () => {
  expect(customer.platformUserId).toBe('line_user_123');
  expect(customer.displayName).toBe('John Doe');
  expect(customer.avatarUrl).toBeTruthy();
});
```

---

### ❌ 錯誤示例 (Incorrect Examples - DO NOT DO THIS)

#### ❌ 錯誤 1: 在 SELECT 中手動轉換為 snake_case

```typescript
// ❌ 錯誤：在 SELECT 中使用 snake_case 鍵名
const customer = await db
  .select({
    platform_user_id: customers.platformUserId,  // ❌ 錯誤
    display_name: customers.displayName,         // ❌ 錯誤
    avatar_url: customers.avatarUrl,             // ❌ 錯誤
  })
  .from(customers)
  .get();

// ❌ 然後又要手動轉回 camelCase
const data = {
  platformUserId: customer.platform_user_id,  // ❌ 雙重轉換
  displayName: customer.display_name,         // ❌ 雙重轉換
};
```

**問題**: 這是**反模式**，導致雙重轉換，完全沒必要！

#### ❌ 錯誤 2: 在 TypeScript 代碼中使用 snake_case

```typescript
// ❌ 錯誤：TypeScript 對象使用 snake_case
const customerData = {
  platform_user_id: 'line_user_123',  // ❌ 應該用 camelCase
  display_name: 'John Doe',           // ❌ 應該用 camelCase
};
```

#### ❌ 錯誤 3: 測試中使用 snake_case

```typescript
// ❌ 錯誤：測試斷言使用 snake_case
expect(customer.platform_user_id).toBe('line_user_123');  // ❌ 錯誤
expect(customer.display_name).toBe('John Doe');           // ❌ 錯誤
```

---

## 🔍 常見場景指南

### Scenario 1: JOIN 查詢

```typescript
// ✅ 正確：所有屬性使用 camelCase
const result = await db
  .select({
    customerId: customers.id,
    customerName: customers.displayName,
    teamId: teams.id,
    teamName: teams.name,  // ✅ 直接使用 camelCase
  })
  .from(customers)
  .leftJoin(teams, eq(customers.sourceTeamId, teams.id))
  .where(eq(customers.id, 1))
  .get();

// ✅ 訪問時直接使用 camelCase
console.log(result.teamName);
```

### Scenario 2: SQL 函數和聚合

```typescript
// ✅ 正確：聚合結果鍵名使用 camelCase
const stats = await db
  .select({
    totalCount: count(customers.id),              // ✅ camelCase
    lastUpdated: sql<string>`MAX(${customers.updatedAt})`,  // ✅ camelCase
    firstCreated: sql<string>`MIN(${customers.createdAt})`,  // ✅ camelCase
  })
  .from(customers)
  .get();

// ✅ 訪問時直接使用 camelCase
console.log(stats.totalCount);
console.log(stats.lastUpdated);
```

### Scenario 3: 原始 SQL 查詢

```typescript
// 僅在必須使用原始 SQL 時，列名使用 snake_case
const results = await db.execute(sql`
  SELECT
    platform_user_id,
    display_name,
    created_at
  FROM customers
  WHERE platform = 'line'
`);

// ⚠️ 注意：原始 SQL 查詢返回的是 snake_case，需要手動轉換
// 建議：盡量避免原始 SQL，使用 Drizzle ORM 的查詢構建器
```

---

## 📊 快速決策樹

```
你在寫什麼代碼？
│
├─ TypeScript/JavaScript 代碼？
│  └─ ✅ 使用 camelCase (platformUserId, displayName)
│
├─ Drizzle Schema 定義？
│  ├─ JavaScript 屬性名 → ✅ camelCase (platformUserId)
│  └─ SQL 列名（字符串參數） → ✅ snake_case ('platform_user_id')
│
├─ SQL 遷移文件？
│  └─ ✅ 使用 snake_case (platform_user_id)
│
├─ 環境變量或全局常量？
│  └─ ✅ 使用 SCREAMING_SNAKE_CASE (JWT_SECRET)
│
└─ 測試文件？
   └─ ✅ 使用 camelCase (expect(customer.platformUserId))
```

---

## 🚨 常見錯誤檢查清單

在編寫代碼時，請檢查以下項目：

- [ ] TypeScript 代碼中沒有使用 snake_case 對象屬性名
- [ ] Drizzle SELECT 查詢中沒有手動重命名為 snake_case
- [ ] 測試斷言中使用 camelCase 屬性名
- [ ] Schema 定義中 JavaScript 屬性名使用 camelCase
- [ ] Schema 定義中 SQL 列名（字符串參數）使用 snake_case
- [ ] 沒有出現雙重轉換（camelCase → snake_case → camelCase）

---

## 🛠️ 工具支持

### ESLint 規則配置

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    // 強制 camelCase 命名
    'camelcase': ['error', {
      'properties': 'always',
      'ignoreDestructuring': false,
      'allow': [
        '^UNSAFE_',
        // 環境變量例外
        'JWT_SECRET',
        'LINE_CHANNEL_ACCESS_TOKEN',
        'LINE_CHANNEL_SECRET',
      ]
    }]
  }
};
```

### TypeScript 配置

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

---

## 📚 相關資源

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [TypeScript Coding Guidelines](https://github.com/microsoft/TypeScript/wiki/Coding-guidelines)
- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)

---

## ❓ FAQ

### Q1: 為什麼不統一使用 camelCase 或 snake_case？
**A**: 尊重每個層級的慣例，JavaScript/TypeScript 傳統使用 camelCase，SQL 傳統使用 snake_case。Drizzle ORM 自動處理轉換，保持兩者的優點。

### Q2: 如果我需要使用原始 SQL 怎麼辦？
**A**: 盡量避免原始 SQL，使用 Drizzle ORM 的查詢構建器。如果必須使用，請在查詢後手動轉換為 camelCase。

### Q3: 現有代碼如何遷移？
**A**: 使用 TypeScript 編譯器快速發現所有不一致的地方：
```bash
npm run lint:check
```

### Q4: 如何防止未來出現混亂？
**A**:
1. Code Review 時嚴格檢查
2. 配置 ESLint 規則
3. 使用 TypeScript strict mode
4. 定期運行 `npm run lint:check`

---

## 📝 Summary / 總結

| 層級 | 命名規範 | 示例 |
|------|---------|------|
| TypeScript/JavaScript | camelCase | `platformUserId`, `displayName` |
| SQL 列名 | snake_case | `'platform_user_id'`, `'display_name'` |
| 環境變量/常量 | SCREAMING_SNAKE_CASE | `JWT_SECRET`, `MAX_RETRY_COUNT` |

**核心原則**:
- ✅ 在 TypeScript 代碼中永遠使用 camelCase
- ✅ 在 Schema 定義中，JavaScript 屬性名用 camelCase，SQL 列名（字符串參數）用 snake_case
- ✅ 讓 Drizzle ORM 自動處理轉換，不要手動轉換
- ❌ 避免雙重轉換反模式

---

**Updated**: 2025-11-10
**Version**: 1.0.0
