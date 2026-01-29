# WebSocket Rollout
## : 1.0 | : 2025-10-08


```

 Phase 2.1 (50% Rollout)

 : 4 days ago
 : Healthy ()
 : 0% ()
 : ()
 :

```


## Rollout


```
: 50%
 ( 7-14 )

 1: 75%
 ( 5-7 )

 2: 90%
 ( 3-5 )

: 100%
```


#### 50% 75%

| | | | |
|------|---------|--------|----------|
| | 7 | 14 | 4 |
| | <3% | <1% | 0% |
| WebSocket | >90% | >95% | |
| | <5 | 0 | 0 |
| Durable Objects | | | |
| | | | |

**: **
- :
- :
- :

#### 75% 90%

| | | |
|------|---------|--------|
| 75% | 5 | 7 |
| | >20% | >30% |
| | | |
| | | |

#### 90% 100%

| | |
|------|---------|
| 90% | 3 |
| | |
| | |
| | |


#### 1:
```yaml
: Dashboard
:
:
 - /api/websocket/dashboard/*
 - Cloudflare Analytics
 -
: Critical
```

#### 2:
```yaml
:
:
:
 - (100+ )
 -
 -
: High
```

#### 3: WebSocket
```yaml
: 50% rollout WebSocket
:
:
 -
 - WS vs SSE
 - A/B
: Medium
```


#### 4: Durable Objects
```yaml
: DO
:
:
 - DO CPU
 - DO
 - DO
: Medium
```

#### 5:
```yaml
:
:
:
 - Cloudflare Analytics
 -
 - rollout
: Low
```


### ()

**: 50% Rollout**

****
1. (4 vs 7)
2.
3.
4.

****
```bash
# 1. (2)
# 2. (30)
# 3. (1)
# 4. (4)
```

### (2025-10-15)

** 75%**

 ** (GO Criteria)**
- [ ] 7
- [ ] < 2%
- [ ]
- [ ] (100+ )
- [ ]

 ** (Nice to Have)**
- [ ] WebSocket vs SSE
- [ ]
- [ ]
- [ ]

### (2025-10-22)

** 75% Rollout 90%**

### (2025-10-29)

** 90% Rollout 100% **


### A: ()
```
50% (14) 75% (7) 90% (5) 100%
: ~26
:
```

### B:
```
50% (7) 75% (3) 100%
: ~10
:
```

### C: ()
```
50% (3) 100%
: ~3
:
```

### D:
```
: 50% 25% 0% ( SSE)
```


```yaml
Critical ():
 - > 5%
 - WebSocket > 10%
 - DO CPU > 50ms (P99)
 - = unhealthy

Warning (15):
 - > 2%
 - > 1000ms (P95)
 - DO > 1000
 - KV > 500ms

Info ():
 -
 - WebSocket vs SSE
 -
 -
```


```
:
1. Cloudflare Analytics ()
2. Grafana Cloud ()
3. Sentry ()
4. LogFlare ()
```


### Phase 2.1


```

 - 7x24
 - < 1%
 -


 - > 30%
 - < 200ms
 - > 20%


 - 100+
 - DO
 -
```


```

 -
 -
 - > 99%


 -
 - < 15
 -
```


```

 Rollout


 7-14


```


** ( P0):**
- [ ] WebSocket Dashboard
- [ ] Cloudflare Analytics
- [ ] 100+
- [ ]

** ( P1):**
- [ ]
- [ ]
- [ ]
- [ ] ( + )

** ( P2):**
- [ ] WebSocket vs SSE
- [ ]
- [ ] A/B
- [ ]


```
Week 1 (Now):
Week 2 (10/15): 75%
Week 3 (10/22): 90%
Week 4 (10/29): 100%
```

### vs

** 100% **
-
-
-
-
-

****
-
- ( SSE )
-

**: **

---


| | Rollout % | | | |
|------|-----------|------|------|--------|
| 2025-10-08 | 50% | | | |
| 2025-10-15 | TBD | | | |

---

**:** 1.0
**:** 2025-10-08
**:** 2025-10-15
**:**
**:**

