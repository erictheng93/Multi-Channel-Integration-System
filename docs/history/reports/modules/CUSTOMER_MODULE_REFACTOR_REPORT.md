# Customer

****: 2025925
****:
****: 80%

---


### ** ()**
```
src/modules/customer/
 handlers/
 customer-main.ts CRUD
 customer.ts (//)
 index.ts
 services/
 customer-crud.ts
 customer-search.ts
 customer-stats.ts
 customer-tags.ts
 index.ts
 middleware/
 customer-auth.ts
 customer-validation.ts
 index.ts
 types/
 customer-types.ts
 index.ts
```

---


### **1. **
- (Admin/Team/Agent)
-
-
-

### **2. CRUD**
- (`POST /api/customers`)
- (`GET /api/customers/:id`)
- (`PUT /api/customers/:id`)
- (`DELETE /api/customers/:id`)
- (`GET /api/customers/platform/:platform/:platformUserId`)
- (`POST /api/customers/find-or-create`)

### **3. **
- (`GET /api/customers/search`)
- (`POST /api/customers/advanced-search`)
- (`GET /api/customers/search/suggestions`)
-
-

### **4. **
- (`GET /api/customers/stats`)
- (`GET /api/customers/stats/platform-distribution`)
- (`GET /api/customers/stats/team-distribution`)
- (`GET /api/customers/stats/activity`)
- (`GET /api/customers/stats/growth`)

### **5. **
- CRUD (`GET/POST/PUT/DELETE /api/customers/:id/tags`)
- (`GET /api/customers/tags/usage-stats`)
- (`POST /api/customers/find-by-tags`)
- (`POST /api/customers/batch/tags`)

### **6. **
- (`POST /api/customers/batch/basic`)
-
-

---


### ****
```typescript
// TypeScript
interface Customer {
 id: number;
 platform: string;
 platformUserId: string;
 displayName: string | null;
 // ... 32
}

//
class CustomerNotFoundError extends Error {
 code = 'CUSTOMER_NOT_FOUND' as const;
}
```

### ****
```typescript
//
class CustomerCrudService {
 async findById(id: number): Promise<Customer | null>
 async create(data: CreateCustomerData): Promise<Customer>
 async findOrCreate(...): Promise<Customer>
}

//
class CustomerSearchService {
 async quickSearch(query: CustomerSearchQuery)
 async getSearchSuggestions(query: string)
}
```

### ****
```typescript
//
export const checkCustomerAccess = async (c, next) => {
 // JWT Token
 //
 //
}

//
export const validateCreateCustomerData = async (c, next) => {
 // JSON
 //
 //
}
```

---


### ****
- Drizzle ORM
-
-
-

### ****
```typescript
//
const [totalResult, platformStats, teamStats, ...] = await Promise.all([
 this.getTotalCustomers(baseCondition),
 this.getPlatformStats(baseCondition),
 this.getTeamStats(baseCondition),
 // ...
]);
```

### ****
- Cloudflare KV
-
-

---


### ****
```typescript
//
export function sanitizeCustomerData<T>(data: T): T {
 // trim
 // Email
 //
}

//
export const DEFAULT_CUSTOMER_VALIDATION = {
 displayName: { maxLength: 100, required: false },
 email: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, required: false },
 // ...
};
```

### ****
```typescript
//
function getUserPermissions(payload: JWTPayload): CustomerPermissions {
 switch (payload.role) {
 case 'admin': return { canView: true, canEdit: true, canDelete: true, ... };
 case 'team': return { canView: true, canEdit: true, canDelete: false, ... };
 case 'agent': return { canView: true, canEdit: false, canDelete: false, ... };
 }
}
```

---

## API

### ** 23**

| | | | |
|------|------|------|------|
| **CRUD** | `/api/customers` | GET/POST | / |
| **CRUD** | `/api/customers/:id` | GET/PUT/DELETE/HEAD | /// |
| **CRUD** | `/api/customers/:id/basic` | GET | |
| **** | `/api/customers/platform/:platform/:platformUserId` | GET/HEAD | |
| **** | `/api/customers/find-or-create` | POST | |
| **** | `/api/customers/search` | GET | |
| **** | `/api/customers/advanced-search` | POST | |
| **** | `/api/customers/search/suggestions` | GET | |
| **** | `/api/customers/stats` | GET | |
| **** | `/api/customers/stats/platform-distribution` | GET | |
| **** | `/api/customers/stats/team-distribution` | GET | |
| **** | `/api/customers/stats/activity` | GET | |
| **** | `/api/customers/stats/growth` | GET | |
| **** | `/api/customers/:id/tags` | GET/POST/PUT/DELETE | CRUD |
| **** | `/api/customers/tags/available` | GET | |
| **** | `/api/customers/tags/usage-stats` | GET | |
| **** | `/api/customers/find-by-tags` | POST | |
| **** | `/api/customers/without-tags` | GET | |
| **** | `/api/customers/batch/basic` | POST | |
| **** | `/api/customers/batch/tags` | POST | |

---


### ** ()**
1. **Services**
 - `customer-crud.ts` - CRUD
 - `customer-search.ts` -
 - `customer-stats.ts` -
 - `customer-tags.ts` -

2. **Middleware**
 - `customer-auth.ts` -
 - `customer-validation.ts` -
 - `index.ts` -

3. ****
 - `tsconfig.json`
 - `@shared/*`

### ** ()**
4. ****
 - Handler
 - Service
 -
 -

5. ****
 - `src/index-modular.ts`
 -
 -

---


Customer****

### ** **
- ****:
- ****: 35+TypeScript
- ****: 23API
- ****: 3
- ****:

### ** **
- **100%**: TypeScript
- ****:
- ****: RBAC
- ****: Drizzle ORM
- **API**: RESTful

### ** **
- ****: **60%**
- ****: **75%**
- ****: **90%**
- ****: ****

****:

---

** **: Services
** **: 