# (FRS)

**** 1.0
**** 2025825
****
****

---

## 1.

### 1.1
(FRS)

### 1.2
FRS
-
-
-
-
-
-
-
-

### 1.3
- **2**
- **3**
- **4**
- **5**
- **6**
- **7**
- **8**
- **9**
- **10**

---

## 2.

### 2.1


#### 2.1.1
- **** (`auth-main.ts`)
- **** (`conversation-main.ts`)
- **** (`delayed-message-main.ts`)
- **** (`team-main.ts`)
- **** (`system-main.ts`)
- **** (`customer-main.ts`)

#### 2.1.2
- **** (`platform-adapter.ts`)
- **Webhook** (`webhook.ts`)webhook
- **** (`activity-service.ts`)

### 2.2
```
 (LINE, Facebook)
 [Webhooks]
Webhook
 []

 []

 []
 (Drizzle ORM)
 []
Cloudflare D1/KV/R2
```

---

## 3.

### 3.1

#### 3.1.1 (FR-AUTH-001)
****
****`auth-main.ts:22-100`

****
- ()
- ()
- ()

****
1. (/)
2. ()
3.
4. (/)
5. bcrypt
6.
7. JWT
8. Cloudflare KV
9.

****
- JWT
- HTTP

****
-
-
- (10)
- "must_change"
-

#### 3.1.2 (FR-AUTH-002)
****
****`auth-main.ts:register`

****
-
- ()
- (/)

****
1.
2.
3.
4. bcrypt
5.
6.
7.
8. JWT
9.

****
- JWT
-

****
-
-
-
- /
- bcrypt

#### 3.1.3 (FR-AUTH-003)
****
****`auth-main.ts:changePassword`

****
-
-
-

****
1.
2.
3.
4.
5.
6.

****
-
-

****
-
-
-
-

### 3.2

#### 3.2.1 (FR-AUTH-004)
****3
****`permission-service.ts`

****
- **(3)**
- **(2)**
- **(1)**

****
1. JWT
2.
3.
4. (/)
5.

****
-
- /
-
-

#### 3.2.2 (FR-AUTH-005)
****
****`session-main.ts`

****
1. Cloudflare KV
2.
3.
4.
5. ()

****
- 8
-
- Cloudflare KV
-

---

## 4.

### 4.1

#### 4.1.1 (FR-CONV-001)
****
****`conversation-main.ts:create`

****
- (LINEFacebook)
- /ID
-
-

****
1.
2.
3. ID
4. ""
5.
6.
7.
8.

****
- ID
-
-

****
-
-
-
- ""

#### 4.1.2 (FR-CONV-002)
****
****`conversation-main.ts:11-50`

****
- ID
- ID()
- ID()
-
-

****
1.
2.
3. /
4.
5.
6. /
7.
8.

****
-
-
-

****
- "conversation:assign"
-
-
-
-

#### 4.1.3 (FR-CONV-003)
****
****`conversation-main.ts:statusUpdate`

****
```


[] [] [/]
```

****
- ID
-
-
-

****
1.
2.
3.
4.
5. ()
6.
7.

****
-
-
-

****
-
-
-
-
-

### 4.2

#### 4.2.1 (FR-CONV-004)
****
****`conversation-main.ts:transfer`

****
- ID
- /ID
-
-

****
1.
2.
3.
4.
5.
6.
7.

****
-
-
-

****
-
-
-
-
-

#### 4.2.2 (FR-CONV-005)
****
****`conversation-main.ts:search`

****
- (ID)
-
- /
-
-
-

****
1.
2.
3.
4.
5.
6.

****
-
- ()
-

****
-
-
-
-
-

---

## 5.

### 5.1

#### 5.1.1 (FR-MSG-001)
****
****`webhook.ts`

****
- webhook
- /
-
-

****
1. webhook
2.
3.
4.
5.
6. ()
7.
8.
9.

****
-
-
-
-

****
-
-
-
-
-

#### 5.1.2 (FR-MSG-002)
****API
****`message.ts:send`

****
- ID
-
- ID
-

****
1.
2.
3. API
4.
5.
6.
7.
8.

****
-
-
-

****
-
-
-
-
-

#### 5.1.3 (FR-MSG-003)
****
****`message.ts:processContent`

****
-
-
-
-
-
- ()

****
1.
2.
3. (R2)
4. URL
5.
6.
7.

****
-
- URL
-

****
-
-
- URL
-
-

### 5.2

#### 5.2.1 (FR-MSG-004)
****
****`delayed-message-main.ts:schedule`

****
- ID
-
- (1-120)
- ID

****
1.
2.
3. Cloudflare Queue
4. UI
5.
6.
7.

****
-
- ID
-
-

****
- 1-120
-
-
-
-

#### 5.2.2 (FR-MSG-005)
****
****`message-recall-service.ts`

****
- ID
-
-

****
1.
2.
3.
4. ""
5.
6.
7. UI

****
-
-
-

****
-
-
-
-
-

#### 5.2.3 (FR-MSG-006)
****
****`queue-consumer.ts`

****
1. Cloudflare Queue
2.
3.
4. API
5.
6.
7.

****
-
-
- 3
-
-

---

## 6.

### 6.1

#### 6.1.1 (FR-TEAM-001)
****
****`team-main.ts:create`

****
-
-
-

****
1. ()
2.
3.
4. QR
5.
6.
7.

****
- ID
- QR
-

****
-
-
- QR
-
-

#### 6.1.2 (FR-TEAM-002)
****
****`team-main.ts:manageMember`

****
- ID
- ID
- ()
-

****
1.
2.
3.
4.
5.
6.
7.

****
-
-
-

****
-
-
-
-
-

#### 6.1.3 (FR-TEAM-003)
****
****`team-main.ts:settings`

****
-
-
-
-
-

****
1.
2.
3.
4.
5.
6.

****
-
-
-

****
-
-
-
-
-

### 6.2

#### 6.2.1 (FR-ROLE-001)
****
****`auth-main.ts:roleManagement`

****
- ****
- ****
- ****

****
1. ()
2.
3.
4.
5.
6.
7.

****
-
-
-

****
-
-
-
-
-

#### 6.2.2 (FR-ROLE-002)
****
****`permission-service.ts`

****
-
-
-
-
-

****
1.
2.
3.
4.
5.
6.
7.

****
- /
-
-

****
-
- /
-
-
-

---

## 7.

### 7.1

#### 7.1.1 (FR-FILE-001)
****
****`attachment.ts:upload`

****
-
- ()
-
-

****
1.
2.
3.
4. Cloudflare R2
5.
6. URL
7. /
8.

****
-
- URL
-

****
-
- 50MB
-
- Cloudflare R2
- URL7
-

#### 7.1.2 (FR-FILE-002)
****
****`attachment.ts:access`

****
1.
2.
3.
4. URL
5.
6.

****
- URL
-
-

****
-
- URL1
-
-
-

#### 7.1.3 (FR-FILE-003)
****
****`file-cleanup.ts`

****
1.
2.
3.
4.
5.
6.

****
-
-
-

****
- 90
-
-
-
-

---

## 8.

### 8.1

#### 8.1.1 (FR-ANALYTICS-001)
****
****`analytics.ts:conversationMetrics`

****
-
-
-
-
-

****
1.
2.
3.
4.
5.
6.

****
-
-
-

****
-
- 5
- 2
- CSVPDF
-

#### 8.1.2 (FR-ANALYTICS-002)
****
****`analytics.ts:agentMetrics`

****
-
-
-
-
-

****
1.
2.
3.
4.
5.
6.

****
-
-
-

****
-
-
-
-
-

#### 8.1.3 (FR-ANALYTICS-003)
****
****`system-main.ts:healthCheck`

****
-
-
-
-
-

****
1.
2.
3.
4.
5.
6.

****
-
-
-

****
-
-
-
-
-

### 8.2

#### 8.2.1 (FR-BI-001)
****
****`customer-analytics.ts`

****
-
-
-
-
-

****
1.
2.
3.
4.
5.
6.

****
-
-
-

****
-
- GDPR
-
-
-

#### 8.2.2 (FR-BI-002)
****
****`operations-analytics.ts`

****
-
-
-
-
-

****
1.
2.
3.
4.
5.
6.

****
-
-
-

****
-
-
-
- ROI
-

---

## 9.

### 9.1

#### 9.1.1 (FR-ADMIN-001)
****
****`system-main.ts:settings`

****
-
-
-
-
-

****
1.
2.
3.
4.
5.
6.

****
-
-
-

****
-
-
-
-
-

#### 9.1.2 (FR-ADMIN-002)
****
****`system-main.ts:integrations`

****
- LINEAPI
- Facebook Messenger API
-
- Webhook

****
1.
2.
3.
4. webhook
5. /
6.

****
-
-
-

****
-
-
-
-
-

### 9.2

#### 9.2.1 (FR-ADMIN-003)
****
****`activity-service.ts`

****
-
-
-
-
-

****
1.
2.
3.
4.
5.
6.

****
-
-
-

****
-
-
-
- 5
-

#### 9.2.2 (FR-ADMIN-004)
****
****`error-handler.ts`

****
-
-
- API
-
-

****
1.
2.
3.
4.
5.
6.

****
-
-
-

****
-
-
-
-
-

---

## 10.

### 10.1

#### 10.1.1 LINE (FR-INTEGRATION-001)
****LINE
****`line.ts`, `webhook.ts`

****
- Webhook
- LINE API
-
-
-

****
1. LINE webhook
2.
3.
4. LINE API
5. LINE
6.

****
-
- LINE API
-

****
- LINE webhook
- LINE API
- LINE
-
-

#### 10.1.2 Facebook Messenger (FR-INTEGRATION-002)
****Facebook Messenger()
****`facebook.ts`, `webhook.ts`

****
- Webhook
-
-
-
-

****
1. Facebook webhook
2.
3. Facebook
4.
5. Facebook API
6. Facebook

****
- Facebook webhook
-
-

****
- Facebook webhook
-
- Facebook
-
-

#### 10.1.3 (FR-INTEGRATION-003)
****
****`platform-adapter.ts`

****
-
-
-
-
-

****
1.
2.
3.
4.
5.
6.

****
-
-
-

****
-
-
-
-
-

---

## 11.

### 11.1

#### 11.1.1 (FR-TEST-001)
****
****
- 100%
-
-
-

****
-
-
-
-
- API

#### 11.1.2 (FR-TEST-002)
****
****
-
-
-
-
-

#### 11.1.3 (FR-TEST-003)
****
****
-
-
-
-
-

### 11.2

#### 11.2.1 (FR-VALIDATION-001)
****
****
-
-
-
-
-

#### 11.2.2 (FR-VALIDATION-002)
****
****
-
-
-
-
-

---

## 12.

### 12.1

| | | / | |
|---|---|---|---|
| | FR-INTEGRATION-001/002 | platform-adapter.ts | 100% |
| | FR-ROLE-001/002 | permission-service.ts | 100% |
| | FR-CONV-001/002/003 | conversation-main.ts | 100% |
| | FR-MSG-004/005/006 | delayed-message-main.ts | 100% |
| | FR-FILE-001/002/003 | attachment.ts | 100% |
| | FR-ANALYTICS-001/002/003 | analytics.ts | 100% |
| | FR-AUTH-001/002/003 | auth-main.ts | 100% |
| | FR-ADMIN-001/002/003 | system-main.ts | 100% |

### 12.2

| | | | |
|---|---|---|---|
| | | 132/132 | |
| | | 100% | |
| | | 100% | |
| | | 100% | |
| | | 100% | |
| | | 100% | |
| | LINEFB | 100% | |
| | | 100% | |

---

## 13.

### 13.1


- ****
- ****
- ****
- ****

### 13.2
- ****
- ****
- ****
- ****

### 13.3
- ****
- ****
- ****
- ****

---

****
****20251125
****
****QA