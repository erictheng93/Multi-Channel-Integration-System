


- ****: `admin@dacit.net` / `<ADMIN_PASSWORD>`
- ****: `dacagent@dacit.net` / `<AGENT_PASSWORD>`


- : `http://localhost:8787`
- : `http://localhost:5173`


```bash
bunx tsx tests/integration/activity-log.test.ts
```


-
- API
-
-


```bash
bunx tsx tests/test-activity-logging.ts
bunx tsx tests/test-permissions.ts
```


### 1.

#### 1.1
- [ ] Admin
- [ ]
- [ ]

#### 1.2
- [ ]
- [ ]
- [ ]
- [ ]

### 2.

#### 2.1 Admin
- [ ]
- [ ]
- [ ]
- [ ]

#### 2.2 Agent
- [ ]
- [ ]
- [ ]
- [ ]

### 3.

#### 3.1 /
- [ ] `user_login`
- [ ] `user_logout`
- [ ] IP

#### 3.2
- [ ] Agent `conversation_assign`
- [ ] Agent `conversation_transfer`
- [ ] `conversation_close`

#### 3.3
- [ ]
- [ ] `settings_update`
- [ ]

#### 3.4
- [ ] `team_invite`
- [ ] `team_member_update`
- [ ] `team_member_update`

### 4.

#### 4.1
- [ ]
- [ ] Admin

#### 4.2
- [ ]
- [ ]
- [ ]

#### 4.3
- [ ]
- [ ]
- [ ]

### 5. API

#### 5.1
 > Network

#### 5.2 API
- [ ] `GET /api/activities`
- [ ]
- [ ]
- [ ] 200
- [ ]


### API
```typescript
// tests/integration/activity-log.test.ts
import { runActivityLogTests } from './activity-log.test';

runActivityLogTests().then(success => {
 console.log(success ? ' ' : ' ');
});
```


```bash

curl http://localhost:8787/

# API Token
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8787/api/activities
```


### 1:
****: API
****:
1. > Console
2. JavaScript
3. Network API

### 2:
****:
****:
1.
2.
3. API

### 3:
****: API
****:
1. Network
2. API
3.


- [ ]
- [ ]
- [ ]
- [ ]


- [ ] Admin
- [ ] Agent
- [ ]


- [ ] /
- [ ]
- [ ]
- [ ]

### API
- [ ] API
- [ ]
- [ ]


-
- API
-


-
-
-


-
- Token
- API


-
-
- 