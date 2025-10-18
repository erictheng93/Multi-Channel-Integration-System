# Phase 1.4c: LatestMessageCacheCoordinator


****: LatestMessageCacheCoordinator Durable Object

****: 24

****:

---

## KPIs

### 1. **Cache Update Success Rate** Target: 99.5%
- ****: `successfulUpdates / totalProcessed * 100`
- ****: `/stats`
- ****: <99.5%

### 2. **Cache Update Latency** Target: p95 <10s
- ****: Alarm
- ****: `averageProcessingTime` from `/stats`
- ****: p95 >10s

### 3. **Error Rate** Target: <0.5%
- ****: `failedUpdates / totalProcessed * 100`
- ****: `/stats`
- ****: >0.5%

### 4. **System Stability** Target:
- ****: Durable Object alarm
- ****: `/status` Cloudflare Dashboard
- ****:

---


### 1: `/status` -
**URL**: `https://YOUR_WORKER_DOMAIN.workers.dev/api/cache-coordinator/status`

****:
```bash
# Get Durable Object ID
COORDINATOR_ID=$(curl -X POST "https://YOUR_WORKER_DOMAIN.workers.dev/internal/get-do-id" \
 -H "Content-Type: application/json" \
 -d '{"namespace": "LATEST_MESSAGE_COORDINATOR", "name": "global"}')

# Get status
curl "https://YOUR_WORKER_DOMAIN.workers.dev/api/durable-objects/${COORDINATOR_ID}/status" \
 -H "Authorization: Bearer $ADMIN_TOKEN"
```

****:
```json
{
 "success": true,
 "status": "healthy",
 "queueSize": 15,
 "alarmScheduled": true,
 "nextAlarmAt": "2025-10-17T08:30:45.123Z",
 "stats": {
 "totalProcessed": 1250,
 "successfulUpdates": 1248,
 "failedUpdates": 2,
 "lastProcessedAt": 1729152645123,
 "averageProcessingTime": 1234.56
 }
}
```

****:
- `status` `"healthy"`
- `queueSize`
- `alarmScheduled` true

---

### 2: `/stats` -
**URL**: `https://YOUR_WORKER_DOMAIN.workers.dev/api/cache-coordinator/stats`

****:
```bash
curl "https://YOUR_WORKER_DOMAIN.workers.dev/api/durable-objects/${COORDINATOR_ID}/stats" \
 -H "Authorization: Bearer $ADMIN_TOKEN"
```

****:
```json
{
 "success": true,
 "stats": {
 "totalProcessed": 1250,
 "successfulUpdates": 1248,
 "failedUpdates": 2,
 "lastProcessedAt": 1729152645123,
 "averageProcessingTime": 1234.56,
 "currentQueueSize": 15,
 "successRate": "99.84%"
 }
}
```

****:
- ** Success Rate**: 99.5%
- ** Average Processing Time**: <10,000ms (10s)
- ** Failed Updates**: 0

---

### 3: `/queue` -
**URL**: `https://YOUR_WORKER_DOMAIN.workers.dev/api/cache-coordinator/queue`

****:
```bash
curl "https://YOUR_WORKER_DOMAIN.workers.dev/api/durable-objects/${COORDINATOR_ID}/queue" \
 -H "Authorization: Bearer $ADMIN_TOKEN"
```

****:
```json
{
 "success": true,
 "queueSize": 15,
 "queue": [
 {
 "conversationId": "conv-123",
 "priority": "normal",
 "timestamp": "2025-10-17T08:25:30.123Z",
 "retryCount": 0
 },
 {
 "conversationId": "conv-456",
 "priority": "high",
 "timestamp": "2025-10-17T08:25:35.456Z",
 "retryCount": 1
 }
 ]
}
```

****:
- `queueSize`
- `retryCount` 3
-

---


### 5

```bash
#!/bin/bash
# monitor-cache-coordinator.sh

ADMIN_TOKEN="YOUR_ADMIN_TOKEN"
COORDINATOR_ID="YOUR_DO_ID"
BASE_URL="https://YOUR_WORKER_DOMAIN.workers.dev"
LOG_FILE="/var/log/cache-coordinator-monitor.log"
ALERT_THRESHOLD_SUCCESS_RATE=99.5
ALERT_THRESHOLD_LATENCY=10000

# Get stats
STATS=$(curl -s "${BASE_URL}/api/durable-objects/${COORDINATOR_ID}/stats" \
 -H "Authorization: Bearer $ADMIN_TOKEN")

# Parse stats
SUCCESS_RATE=$(echo $STATS | jq -r '.stats.successRate' | sed 's/%//')
AVG_LATENCY=$(echo $STATS | jq -r '.stats.averageProcessingTime')
QUEUE_SIZE=$(echo $STATS | jq -r '.stats.currentQueueSize')
FAILED_UPDATES=$(echo $STATS | jq -r '.stats.failedUpdates')

# Log current stats
echo "[$(date -Iseconds)] Success Rate: ${SUCCESS_RATE}%, Latency: ${AVG_LATENCY}ms, Queue: ${QUEUE_SIZE}, Failed: ${FAILED_UPDATES}" >> $LOG_FILE

# Check alerts
if (( $(echo "$SUCCESS_RATE < $ALERT_THRESHOLD_SUCCESS_RATE" | bc -l) )); then
 echo " ALERT: Success rate below threshold: ${SUCCESS_RATE}% < ${ALERT_THRESHOLD_SUCCESS_RATE}%"
 # Send alert (email, Slack, PagerDuty, etc.)
fi

if (( $(echo "$AVG_LATENCY > $ALERT_THRESHOLD_LATENCY" | bc -l) )); then
 echo " WARNING: Average latency above threshold: ${AVG_LATENCY}ms > ${ALERT_THRESHOLD_LATENCY}ms"
 # Send warning
fi

if [ "$QUEUE_SIZE" -gt 100 ]; then
 echo " WARNING: Queue size growing: ${QUEUE_SIZE} items"
 # Send warning
fi
```

** cron**:
```bash
# 5
*/5 * * * * /path/to/monitor-cache-coordinator.sh


0 * * * * /path/to/generate-hourly-report.sh
```

---


### Phase 1: 1
- [ ] Durable Object bindings wrangler.toml
- [ ] staging
- [ ]
- [ ]
- [ ] Slack/Email

### Phase 2: 2
- [ ] 10 cache update
- [ ] `/stats`
- [ ] `/queue`
- [ ] alarm
- [ ] WebSocket

### Phase 3: 4
- [ ] 100 concurrent conversations
- [ ] conversation 1
- [ ] success rate >99.5%
- [ ] average latency <10s
- [ ] queue size

### Phase 4: 24
- [ ] 5
- [ ]
- [ ] Cloudflare Dashboard Durable Object
- [ ]
- [ ]

### Phase 5: 2
- [ ] 24
- [ ] success rate
- [ ] p50, p95, p99 latency
- [ ] error patterns
- [ ]

---


| | | | |
|------|--------|---------|---------|
| Success Rate | 99.5% | 24 | |
| p95 Latency | <10s | 24 | 95%10 |
| Error Rate | <0.5% | 24 | 0.5% |
| System Uptime | 100% | 24 | |
| Queue Stability | No growth | 24 | |

---


### Success Rate <99.5%
1. `/queue` conversationIds
2.
3. Database KV
4. retry
5. rollback

### Latency >10s
1. batch size 5s batch window
2. conversations
3. Database
4. `BATCH_DELAY_MS`
5.

### Queue
1. alarm
2.
3. deadlock blocking
4. vs
5.

---


```markdown
# LatestMessageCacheCoordinator Phase 1.4c


- : YYYY-MM-DD HH:MM:SS
- : YYYY-MM-DD HH:MM:SS
- : 24


### 1. Success Rate
- : XX.XX%
- : 99.5%
- : PASS / FAIL

### 2. Latency (p95)
- : XXXXms
- : <10000ms
- : PASS / FAIL

### 3. Error Rate
- : XX.XX%
- : <0.5%
- : PASS / FAIL

### 4. System Stability
- : X
- : 0
- : PASS / FAIL


- : XXXXX
- : XXXXX
- : XX
- : XXXXms
- : XX


### 1: []
- : ...
- : ...
- : ...
- : /


- [ ] PASS - Phase 2.4
- [ ] FAIL -
- [ ] CONDITIONAL -


1. ...
2. ...
```

---


- [LatestMessageCacheCoordinator ](../src/durable-objects/LatestMessageCacheCoordinator.ts)
- [LatestMessageWorker ](../src/workers/latest-message-worker.ts)
- [Phase 3 Migration Plan](./PHASE3_MIGRATION_PLAN.md)

---

****: 2025-10-17
****: v1.0.0
****: Multi-Channel Integration System Team
