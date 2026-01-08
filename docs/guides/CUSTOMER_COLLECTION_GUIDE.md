

 LINE Bot Cloudflare D1


- **LINE ID** (`platform_user_id`):
- **** (`display_name`): LINE
- **URL** (`avatar_url`): LINE
- **** (`platform`): 'line'


- **** (`created_at`):
- **** (`updated_at`):

### (JSON `metadata` )
- **** (`statusMessage`): LINE
- **** (`lastProfileUpdate`)
- **** (`messageCount`):


```
1. LINE

2. LINE Webhook Worker

3. Worker LINE Profile API

4.

5.


6. D1

7.
```


### customers
```sql
CREATE TABLE customers (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 platform TEXT NOT NULL, -- (line, facebook, etc.)
 platform_user_id TEXT NOT NULL, -- ID
 display_name TEXT, --
 avatar_url TEXT, -- URL
 phone TEXT, --
 email TEXT, --
 source_team_id INTEGER, --
 metadata TEXT, -- JSON
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(platform, platform_user_id)
);
```


```sql
CREATE INDEX idx_customers_platform_user ON customers(platform, platform_user_id);
CREATE INDEX idx_customers_source_team ON customers(source_team_id);
```

## API


- `GET /api/customers` -
- `GET /api/customers/:customerId` -
- `GET /api/customers/platform/:platform/:platformUserId` - ID


- `GET /api/stats` -


### 1.
```bash
node config.cjs
```
-
- Worker URL
- API

### 2.
```bash
node customer-manager.js
```
-
-
-
- CSV

### 3.
```bash
node customer-analytics.js
```
-
-
-
-

### 4.
```bash
node monitor-customers.js
```
-
-
-

### 5.
```bash
node test-customer-collection.js #
node test-customer-flow.js #
node query-customers.js #
```


### 1.
 `config.cjs` Worker URL
```javascript
const CONFIG = {
 WORKER_URL: 'https://your-api-domain.example.com',
 // ...
};
```

### 2.
```bash
node config.cjs
```

### 3.
```bash
node test-customer-collection.js
```

### 4.
```bash
node customer-manager.js
```


### LINE
```bash
curl "https://your-api-domain.example.com/api/customers/platform/line/U1234567890abcdef"
```


```bash
curl "https://your-api-domain.example.com/api/customers"
```


```bash
curl "https://your-api-domain.example.com/api/stats"
```


- Cloudflare D1 ( GDPR)
- HTTPS
- LINE Webhook


-
- LINE
-


1. ****:
2. ****:
3. ****:
4. ****:
5. ****:


- Facebook Messenger
- Instagram Direct
- WhatsApp Business
- Telegram


1. Worker URL
2. D1
3. LINE Channel Access Token
4.


 LINE Bot

- LINE ID
-
- D1
- API
-
-
-

