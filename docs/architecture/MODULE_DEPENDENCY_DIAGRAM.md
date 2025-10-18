
# Module Dependency Diagram

## (Architecture Overview)

Multi-Channel Integration System

### (High-Level Architecture)

```mermaid
graph TB
 %%
 LINE[LINE Platform]
 FB[Facebook Messenger]
 CLIENTS[Client Applications]

 %% API Gateway Layer
 GATEWAY[API Gateway / Router]

 %% Core Modules
 AUTH[Auth Module]
 CONV[Conversations Module]
 CUSTOMER[Customer Module]
 TEAMS[Teams Module]
 MESSAGING[Messaging Module]
 SESSION[Session Module]
 QRCODE[QRCode Module]
 INTEGRATION[Integration Module]
 REPORTS[Reports Module]
 SYSTEM[System Module]

 %% Shared Services
 ERROR[Error Handling]
 DB[Database Layer]
 CACHE[Cache Layer]
 STORAGE[Storage Layer]
 QUEUE[Queue Layer]

 %% External connections
 LINE --> INTEGRATION
 FB --> INTEGRATION
 CLIENTS --> GATEWAY

 %% Gateway to modules
 GATEWAY --> AUTH
 GATEWAY --> CONV
 GATEWAY --> CUSTOMER
 GATEWAY --> TEAMS
 GATEWAY --> MESSAGING
 GATEWAY --> SESSION
 GATEWAY --> QRCODE
 GATEWAY --> INTEGRATION
 GATEWAY --> REPORTS
 GATEWAY --> SYSTEM

 %% Module dependencies
 CONV --> AUTH
 CONV --> CUSTOMER
 CONV --> TEAMS
 CONV --> SESSION
 CONV --> MESSAGING

 MESSAGING --> AUTH
 MESSAGING --> CONV
 MESSAGING --> QUEUE

 CUSTOMER --> AUTH
 CUSTOMER --> TEAMS

 TEAMS --> AUTH

 SESSION --> CONV
 SESSION --> AUTH

 QRCODE --> AUTH
 QRCODE --> TEAMS

 INTEGRATION --> AUTH
 INTEGRATION --> CUSTOMER
 INTEGRATION --> CONV
 INTEGRATION --> MESSAGING

 REPORTS --> AUTH
 REPORTS --> CONV
 REPORTS --> CUSTOMER
 REPORTS --> TEAMS
 REPORTS --> MESSAGING

 SYSTEM --> AUTH

 %% Shared services dependencies
 AUTH --> ERROR
 CONV --> ERROR
 CUSTOMER --> ERROR
 TEAMS --> ERROR
 MESSAGING --> ERROR
 SESSION --> ERROR
 QRCODE --> ERROR
 INTEGRATION --> ERROR
 REPORTS --> ERROR
 SYSTEM --> ERROR

 AUTH --> DB
 CONV --> DB
 CUSTOMER --> DB
 TEAMS --> DB
 MESSAGING --> DB
 SESSION --> DB
 QRCODE --> DB
 INTEGRATION --> DB
 REPORTS --> DB
 SYSTEM --> DB

 AUTH --> CACHE
 CONV --> CACHE
 CUSTOMER --> CACHE
 SYSTEM --> CACHE

 QRCODE --> STORAGE
 MESSAGING --> STORAGE

 MESSAGING --> QUEUE
 INTEGRATION --> QUEUE

 %% Styling
 classDef external fill:#ff6b6b,stroke:#c92a2a,color:#fff
 classDef gateway fill:#4ecdc4,stroke:#26a69a,color:#fff
 classDef core fill:#45b7d1,stroke:#2980b9,color:#fff
 classDef shared fill:#96c93f,stroke:#689f38,color:#fff
 classDef infrastructure fill:#ffa726,stroke:#f57f17,color:#fff

 class LINE,FB,CLIENTS external
 class GATEWAY gateway
 class AUTH,CONV,CUSTOMER,TEAMS,MESSAGING,SESSION,QRCODE,INTEGRATION,REPORTS,SYSTEM core
 class ERROR shared
 class DB,CACHE,STORAGE,QUEUE infrastructure
```

## (Dependency Matrix)


| | Auth | Conv | Customer | Teams | Messaging | Session | QRCode | Integration | Reports | System | Error | DB | Cache | Storage | Queue |
|-------------|------|------|----------|-------|-----------|---------|--------|-------------|---------|---------|-------|----|----|---------|-------|
| **Auth** | | | | | | | | | | | | | | | |
| **Conversations** | | | | | | | | | | | | | | | |
| **Customer** | | | | | | | | | | | | | | | |
| **Teams** | | | | | | | | | | | | | | | |
| **Messaging** | | | | | | | | | | | | | | | |
| **Session** | | | | | | | | | | | | | | | |
| **QRCode** | | | | | | | | | | | | | | | |
| **Integration** | | | | | | | | | | | | | | | |
| **Reports** | | | | | | | | | | | | | | | |
| **System** | | | | | | | | | | | | | | | |

### (Legend)
- ****:
- ****:

## (Detailed Dependency Analysis)

### Auth Module ()
```
Auth Module
 Dependencies: None (Core module)
 Dependents:
 Conversations
 Customer
 Teams
 Messaging
 Session
 QRCode
 Integration
 Reports
 System
```

****: JWT
****:

### Conversations Module ()
```
Conversations Module
 Dependencies:
 Auth ()
 Customer ()
 Teams ()
 Session ()
 Messaging ()
 Dependents:
 Messaging
 Session
 Integration
 Reports
```

****:
****:
- Auth:
- Customer:
- Teams:
- Session:
- Messaging:

### Customer Module ()
```
Customer Module
 Dependencies:
 Auth ()
 Teams ()
 Dependents:
 Conversations
 Integration
 Reports
```

****:
****:
- Auth:
- Teams:

### Teams Module ()
```
Teams Module
 Dependencies:
 Auth ()
 Dependents:
 Conversations
 Customer
 QRCode
 Reports
```

****:
****:
- Auth:

### Messaging Module ()
```
Messaging Module
 Dependencies:
 Auth ()
 Conversations ()
 Queue ()
 Storage ()
 Dependents:
 Conversations
 Integration
 Reports
```

****:
****:
- Auth:
- Conversations:
- Queue:
- Storage:

### Session Module ()
```
Session Module
 Dependencies:
 Auth ()
 Conversations ()
 Dependents:
 Conversations
```

****:
****:
- Auth:
- Conversations:

### QRCode Module ()
```
QRCode Module
 Dependencies:
 Auth ()
 Teams ()
 Storage ()
 Dependents: None
```

****: QR
****:
- Auth: QR
- Teams: QR
- Storage: QR

### Integration Module ()
```
Integration Module
 Dependencies:
 Auth (API)
 Customer ()
 Conversations ()
 Messaging ()
 Queue (Webhook)
 Dependents:
 Reports
```

****: Webhook
****:
- Auth: API
- Customer:
- Conversations:
- Messaging:
- Queue: Webhook

### Reports Module ()
```
Reports Module
 Dependencies:
 Auth ()
 Conversations ()
 Customer ()
 Teams ()
 Messaging ()
 Dependents: None
```

****:
****:
- Auth:
- :

### System Module ()
```
System Module
 Dependencies:
 Auth ()
 Cache ()
 Dependents: None
```

****:
****:
- Auth:
- Cache:

## (Shared Services Dependencies)

### Error Handling Service
```
Error Handling
 Used by: All modules
 Provides:
 Unified error types
 Error logging
 Recovery strategies
 Error reporting
 Dependencies: None
```

### Database Layer
```
Database Layer (D1 + Drizzle)
 Used by: All modules
 Provides:
 Type-safe queries
 Schema management
 Transaction support
 Connection pooling
 Dependencies: None
```

### Cache Layer
```
Cache Layer (KV)
 Used by:
 Auth (Session cache)
 Conversations (Query cache)
 Customer (Profile cache)
 System (Config cache)
 Provides:
 Session storage
 Query caching
 Configuration cache
 Dependencies: None
```

### Storage Layer
```
Storage Layer (R2)
 Used by:
 Messaging (Attachments)
 QRCode (Images)
 Provides:
 File upload
 Image processing
 CDN integration
 Dependencies: None
```

### Queue Layer
```
Queue Layer (Cloudflare Queues)
 Used by:
 Messaging (Delayed messages)
 Integration (Webhook processing)
 Provides:
 Message queuing
 Delayed execution
 Batch processing
 Dependencies: None
```

## (Circular Dependency Check)

### (No Circular Dependencies)


1. **Auth Module**:
2. ****:
3. ****:

### (Dependency Levels)

```
Level 0 (Infrastructure):
 Error Handling
 Database
 Cache
 Storage
 Queue

Level 1 (Core):
 Auth Module

Level 2 (Basic Business):
 Teams Module
 Customer Module

Level 3 (Advanced Business):
 Session Module
 QRCode Module
 System Module

Level 4 (Composite):
 Conversations Module
 Messaging Module
 Integration Module

Level 5 (Analytics):
 Reports Module
```

## (Module Communication Patterns)

### 1. (Direct Dependency)
```typescript
// Conversations Auth
import { authenticateUser } from '@auth/services/auth';
```

### 2. (Event-Driven)
```typescript
// Queue
await context.env.QUEUE.send({
 type: 'message.sent',
 data: messageData
});
```

### 3. (Shared Database)
```typescript
//
const conversation = await db.select().from(conversations);
```

### 4. API (API Calls)
```typescript
// API
const response = await fetch('/api/customers/profile', {
 headers: { 'Authorization': `Bearer ${token}` }
});
```

## (Deployment Dependencies)

### Cloudflare Workers
```mermaid
graph LR
 %% Client Requests
 CLIENT[Client Request]

 %% Edge Computing
 EDGE[Cloudflare Edge]

 %% Main Worker
 WORKER[Main Worker<br/>index.ts]

 %% Module Routes
 AUTH_ROUTE[Auth Routes]
 CONV_ROUTE[Conversations Routes]
 CUST_ROUTE[Customer Routes]

 %% Cloudflare Services
 D1[(Cloudflare D1<br/>Database)]
 KV[(Cloudflare KV<br/>Cache)]
 R2[(Cloudflare R2<br/>Storage)]
 QUEUE[(Cloudflare Queues)]

 %% External Services
 LINE_API[LINE API]
 FB_API[Facebook API]

 %% Request Flow
 CLIENT --> EDGE
 EDGE --> WORKER

 WORKER --> AUTH_ROUTE
 WORKER --> CONV_ROUTE
 WORKER --> CUST_ROUTE

 %% Service Dependencies
 AUTH_ROUTE --> D1
 AUTH_ROUTE --> KV

 CONV_ROUTE --> D1
 CONV_ROUTE --> KV
 CONV_ROUTE --> QUEUE

 CUST_ROUTE --> D1
 CUST_ROUTE --> R2

 %% External integrations
 WORKER --> LINE_API
 WORKER --> FB_API

 %% Styling
 classDef client fill:#ff6b6b
 classDef edge fill:#4ecdc4
 classDef worker fill:#45b7d1
 classDef routes fill:#96c93f
 classDef storage fill:#ffa726
 classDef external fill:#ab47bc

 class CLIENT client
 class EDGE edge
 class WORKER worker
 class AUTH_ROUTE,CONV_ROUTE,CUST_ROUTE routes
 class D1,KV,R2,QUEUE storage
 class LINE_API,FB_API external
```

## (Performance Impact Analysis)

### (High-Frequency Dependencies)
1. **Auth Database**:
2. **Conversations Cache**:
3. **Messaging Queue**:

### (Optimization Recommendations)
1. ****: Auth token
2. ****:
3. ****: IntegrationQueueWebhook
4. ****:

## (Security Boundaries)

### (Permission Checkpoints)
```
Client Request

API Gateway (Rate Limiting)

Auth Module (JWT Validation)

Business Module (Role Check)

Database Access (Row-level Security)
```

### (Secure Inter-module Communication)
-
-
-

## (Maintenance Guidelines)

### (Adding New Module)
1.
2. (index.ts)
3.
4.
5.

### (Modifying Existing Dependencies)
1.
2.
3.
4.

### (Performance Monitoring)
-
-
-
-

---

****: 1.0.0
****: 2024-01-01
****: Multi-Channel Integration System Architecture Team