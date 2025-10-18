
> **Multi-Channel Integration System - Database Synchronization Guide**


1. [](#)
2. [](#)
3. [](#)
4. [](#)
5. [](#)
6. [](#)
7. [](#)

---


- ****:
- ****:
- ****:
- ****:
- ****:


```


 23 23


```

---


### 1.

```bash

npm run sync:db -- --schema-only


# : 23
# : 23
# : 100%
```

### 2.

```bash
# ()
npm run sync:db:to-local


npm run sync:db:live
```

### 3.

```bash

npm run sync:scheduler:start


npm run sync:scheduler:status
```

---


****:

****:
```bash
# 1.
npm run dev:stop

# 2. ()
npm run sync:db:to-local

# 3.
npm run dev
```

****:
```
 :
 agents: 3 3 ()
 customers: 0 3 ( 3 )
 conversations: 0 3 ( 3 )
 messages: 0 5 ( 5 )

 : 2.5
 : ./backups/2025-09-25T10-30-00/
```


****:

****:
```json
{
 "schedule": {
 "enabled": true,
 "interval": 1440,
 "timeWindow": {
 "start": "02:00",
 "end": "04:00"
 }
 }
}
```

****:
```bash

npm run sync:scheduler:start

# 2-4
```


****:

****:
```bash
# 1.
npm run db:restore -- --from-backup ./backups/latest/

# 2.
npm run sync:db:full -- --no-dry-run
```

---


### sync.config.json

```json
{
 "environments": {
 "development": {
 "sync": {
 "source": "production", //
 "target": "local", //
 "mode": "incremental", //
 "excludeSensitive": true, //
 "tables": [ //
 "customers",
 "conversations",
 "messages"
 ]
 },
 "schedule": {
 "enabled": true, //
 "interval": 120, //
 "timeWindow": { //
 "start": "02:00",
 "end": "06:00"
 }
 }
 }
 }
}
```


```


 schema-only
 data-only
 incremental
 full

```


```json
{
 "security": {
 "sensitiveFields": {
 "agents": ["password_hash", "email"],
 "system_settings": ["*"]
 },
 "encryption": {
 "enabled": true,
 "algorithm": "AES-256-GCM"
 }
 }
}
```

---


```bash

npm run sync:scheduler:status
```

****:
```json
{
 "status": "healthy",
 "uptime": "2 days 14 hours",
 "lastSync": "2025-09-25T02:15:30Z",
 "nextSync": "2025-09-26T02:00:00Z",
 "databases": {
 "local": " ",
 "production": " "
 },
 "metrics": {
 "totalSyncs": 48,
 "successfulSyncs": 47,
 "failedSyncs": 1,
 "averageSyncTime": "3.2 seconds"
 }
}
```


```json
{
 "notifications": {
 "channels": {
 "slack": {
 "enabled": true,
 "webhook": "${SLACK_WEBHOOK}",
 "channel": "#database-alerts"
 }
 },
 "triggers": {
 "onError": ["slack"],
 "onWarning": ["slack"]
 }
 }
}
```

---


#### 1. :

****:
```
 : FOREIGN KEY constraint failed
```

****:
```bash
# 1.
npm run db:check-dependencies

# 2.
npm run sync:db -- --respect-dependencies
```

#### 2.

****:
```
 : 5
```

****:
```bash

npm run sync:db -- --timeout=1800 --batch-size=500
```

#### 3.

****:
```
 : agents.password_hash
```

****:
```bash

npm run sync:db -- --exclude-sensitive
```


```
1.
 npm run sync:scheduler:stop

2.
 tail -f logs/sync-scheduler.log

3.
 npm run db:restore -- --from-backup ./backups/latest/

4.
 npm run sync:scheduler:start
```

---


### 1.

```bash

npm run health:check:all


df -h


npm run db:backup
```

### 2.

```json
{
 "security": {
 "bestPractices": [
 "",
 "",
 "",
 "",
 ""
 ]
 }
}
```

### 3.

```json
{
 "performance": {
 "recommendations": [
 "",
 "",
 "",
 "",
 ""
 ]
 }
}
```

### 4.

```bash

logrotate -f /path/to/sync-logs.conf


echo "90" > /tmp/disk_threshold


crontab -e
# */5 * * * * /usr/local/bin/sync-health-check.sh
```

---


- [Database Schema ](./src/db/schema.ts)
- [Migration ](./migrations/README.md)
- [API ](./API_DOCUMENTATION.md)
- [](./TROUBLESHOOTING.md)

---


1. ****: `tail -f logs/sync-scheduler.log`
2. ****: `npm run sync:scheduler:status`
3. ****: `npm run sync:scheduler:test`
4. ****: GitHub Issues

---

****: 2025-09-25
****: 1.0.0
****: Multi-Channel Platform Team