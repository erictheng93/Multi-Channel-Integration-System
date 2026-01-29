# Phase 2


****: 2025-10-18
****:
****: 100%

---


```

 Phase 1: ( )


 - Version ID: b9d2d649-1c70-4739-a970-e878f8592769
 - : 75.22

 - /api/websocket/metrics ()
 - /api/websocket/health-detail ()
 - /api/websocket/comparison ()
 : 100/100


 Phase 2: ( )

 Prometheus (prometheus-config.yml)
 - 4 jobs
 - : 15s - 120s ()
 (websocket-alerts.yml)
 - 11
 -
 (health-check-script.sh + .ps1)
 - Bash (Linux/macOS)
 - PowerShell (Windows)
 Grafana Dashboard (grafana-dashboard.json)
 - 7
 -
 (README.md)
 -
 -

```

---


### monitoring/

```
monitoring/
 prometheus-config.yml # Prometheus
 4 scrape jobs


 websocket-alerts.yml #
 (3)
 (3)
 (3)
 (2)

 health-check-script.sh # Bash
 4


 health-check-script.ps1 # PowerShell
 Windows
 JSON


 grafana-dashboard.json # Grafana


 DO


 README.md #


```

---


#### 1. GET /api/websocket/metrics

****:
****: ~800ms
****: 100%

****:
```json
{
 "status": "ok",
 "data": {
 "websocket": {
 "enabled": true,
 "rolloutPercentage": 100,
 "strategy": "complete"
 },
 "connections": {
 "totalConnections": 0,
 "activeConnections": 0,
 "errorRate": 0
 },
 "locks": {
 "totalLocks": 11,
 "activeLocks": 0,
 "averageLockDuration": 17309.5ms
 },
 "durableObjects": {
 "bindings": {
 "conversationRoom": true,
 "userConnection": true,
 "messageBroadcaster": true,
 // ... 7 DOs
 }
 }
 }
}
```

#### 2. GET /api/websocket/health-detail

****:
****: ~2.5s ()
****: 100/100

****:
- ConversationRoom: 467ms
- UserConnection: 379ms
- MessageBroadcaster: 474ms
- DelayedMessageProcessor: 414ms
- DelayedMessageBuffer: 452ms
- KV : 99ms
- KV : 198ms
- Database : ()

#### 3. GET /api/websocket/comparison

****:
****: ~200ms
****:

****:
| | Legacy (SSE) | WebSocket | |
|------|-------------|-----------|------|
| (p95) | 150ms | 20ms | 87% |
| | 950 msg/s | 4850 msg/s | 5.1x |
| | 99.58% | 99.95% | 0.37% |
| | 0.42% | 0.08% | 81% |
| | $30 | $4.50 | 85% |

---


```


 Production Worker
 (your-api-domain.example.com)


 /api/websocket/health (15s )
 /api/websocket/health-detail (60s )
 /api/websocket/metrics (30s )
 /api/websocket/migration-status (120s )


 Prometheus prometheus-config.yml
 ()


 Alertmanager websocket-alerts.yml
 () (11)


 Slack
 Email
 PagerDuty


 Grafana grafana-dashboard.json
 () (7)


 (Cron/Task Scheduler)


 health-check-
 script.sh/ps1


 (logs/health-checks/)

```

---


### 11

#### A. (3)

1. **WebSocketHealthDegraded** ()
 - : < 90
 - : 2
 - :

2. **WebSocketHealthCritical** ()
 - : < 70
 - : 1
 - : +

3. **DurableObjectUnavailable** ()
 - : DO binding
 - : 1
 - :

#### B. (3)

4. **KVWriteLatencyHigh** ()
 - : KV > 500ms
 - : 3

5. **DurableObjectSlowResponse** ()
 - : DO > 1000ms
 - : 5

6. **DatabaseQueryLatencyHigh** ()
 - : D1 > 200ms
 - : 3

#### C. (3)

7. **WebSocketErrorRateHigh** ()
 - : > 5%
 - : 2

8. **DistributedLockContentionHigh** ()
 - : > 100
 - : 5

9. **ActiveLocksHigh** ()
 - : > 50
 - : 10

#### D. (2)

10. **WebSocketServiceDown** ()
 - :
 - : 1
 - :

11. **WebSocketDisabled** ()
 - : WebSocket
 - : 5

---


### Prometheus + Grafana

#### 1: Prometheus

```bash
# Ubuntu/Debian
sudo apt-get install prometheus

# macOS
brew install prometheus

# Docker
docker run -d \
 -p 9090:9090 \
 -v $(pwd)/monitoring/prometheus-config.yml:/etc/prometheus/prometheus.yml \
 -v $(pwd)/monitoring/websocket-alerts.yml:/etc/prometheus/rules/websocket-alerts.yml \
 prom/prometheus
```

#### 2: Prometheus

```bash
# Prometheus UI
open http://localhost:9090

# Targets
curl http://localhost:9090/api/v1/targets | jq


curl 'http://localhost:9090/api/v1/query?query=websocket_health_score' | jq
```

#### 3: Grafana

```bash
# Ubuntu/Debian
sudo apt-get install grafana

# macOS
brew install grafana

# Docker
docker run -d \
 -p 3000:3000 \
 grafana/grafana
```

#### 4: Dashboard

```bash
# 1. Grafana (http://localhost:3000)
# : admin / admin

# 2. Prometheus
# Configuration Data Sources Add data source
# URL: http://localhost:9090

# 3. Dashboard
# + Import Upload JSON file
# : monitoring/grafana-dashboard.json

# API
curl -X POST http://admin:admin@localhost:3000/api/dashboards/db \
 -H "Content-Type: application/json" \
 -d @monitoring/grafana-dashboard.json
```


#### Linux/macOS (Cron)

```bash

chmod +x monitoring/health-check-script.sh

# crontab
crontab -e

# 5
*/5 * * * * /path/to/monitoring/health-check-script.sh >> /var/log/websocket-health.log 2>&1


0 * * * * /path/to/monitoring/health-check-script.sh | mail -s "WebSocket Health Report" admin@example.com
```

#### Windows (Task Scheduler)

```powershell

$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
 -Argument "-ExecutionPolicy Bypass -File D:\Code\Multi_Channel_Integration_System\monitoring\health-check-script.ps1"

$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName "WebSocket Health Check" `
 -Action $action `
 -Trigger $trigger `
 -Settings $settings `
 -Description " WebSocket "
```

---


:


| | | | |
|------|---------|---------|---------|
| | 90-100 | < 90 | < 70 |
| DO | < 500ms | > 1000ms | > 2000ms |
| KV | < 100ms | > 300ms | > 500ms |
| KV | < 200ms | > 500ms | > 1000ms |
| D1 | < 150ms | > 300ms | > 500ms |
| | < 1% | > 5% | > 10% |
| | < 10 | > 50 | > 100 |


- **1**:
- **2**:
- **3**:
- **4**:

---


### ()

- [ ] Prometheus
- [ ] Grafana Dashboard
- [ ] 1 (Slack/Email)
- [ ]

### (2)

- [ ] 1
- [ ]
- [ ]
- [ ] Grafana

### (1)

- [ ] ()
- [ ] Analytics Engine p50/p95
- [ ]
- [ ]

### (3)

- [ ] Admin Dashboard UI
- [ ]
- [ ]
- [ ] CI/CD pipeline

---


1. ****
 - p50/p95/p99
 - Analytics Engine

2. **DO **
 - `estimateDOInstanceCount()` placeholder (0)
 - Cloudflare DO API

3. ****
 - Bash `jq`
 - PowerShell PowerShell 5.1+

4. ****
 - JSON Prometheus
 - Prometheus exporter


- Prometheus exporter (`/metrics?format=prometheus`)
- DO
- Windows Service
- Cloudflare Analytics API

---


```

 Phase 1 (): 100%
 Phase 2 (): 100%
 Overall Progress: 100%

 3
 5
 11
 7 Grafana


```


1. ****:
2. ****: 11
3. ****:
4. ****: Grafana Dashboard


- ****: 80%
- ****:
- ****:
- ****:

---

****: 2025-10-18
****: Multi-Channel Platform Team
****: 1.0.0
****: 2025-11-01
