# Analytics API Reference

**Module:** Analytics
**Base Path:** `/api/analytics`
**Version:** 2.0.0
**Authentication:** Required (JWT Bearer Token)

---

##  Overview

The Analytics API provides comprehensive data analysis capabilities for conversations, messages, users, and system performance. This module enables data-driven decision making with flexible querying, custom metrics, and multiple export formats.

### Key Features

- ** Conversation Analytics** - Track conversation volumes, response times, and trends
- ** Message Analytics** - Analyze message patterns, types, and throughput
- ** User Analytics** - Monitor user activity, engagement, and performance
- ** Performance Analytics** - System performance metrics and bottleneck identification
- ** Custom Queries** - Flexible analytics with custom SQL-like queries
- ** Data Export** - Export to JSON, CSV, PDF with chart generation
- ** Metrics Collection** - Real-time metrics collection and aggregation
- ** Advanced Filtering** - Filter by time range, platform, team, status, etc.

### Use Cases

- **Management Dashboard** - Real-time KPI monitoring
- **Performance Review** - Agent performance evaluation
- **Capacity Planning** - Resource allocation based on trends
- **Customer Insights** - Behavior pattern analysis
- **SLA Monitoring** - Response time and resolution tracking
- **Report Generation** - Automated periodic reports

---

##  Authentication & Authorization

All endpoints require authentication:

```http
Authorization: Bearer <jwt_token>
```

**Role Requirements:**
- Most analytics endpoints: `agent` or `admin`
- Custom queries: `admin` only
- Metrics collection: `admin` only

---

##  Table of Contents

1. [Conversation Analytics](#conversation-analytics)
2. [Message Analytics](#message-analytics)
3. [User Analytics](#user-analytics)
4. [Performance Analytics](#performance-analytics)
5. [Custom Analytics](#custom-analytics)
6. [Data Export](#data-export)
7. [Metrics Collection](#metrics-collection)
8. [Metrics Queries](#metrics-queries)
9. [Health Check](#health-check)
10. [Common Parameters](#common-parameters)
11. [Response Structures](#response-structures)
12. [Examples](#examples)

---

##  Conversation Analytics

### GET /api/analytics/conversations

Retrieve conversation analytics with flexible filtering and grouping.

#### Request

**Query Parameters:**

| Parameter   | Type     | Required | Default                                  | Description                          |
|-------------|----------|----------|------------------------------------------|--------------------------------------|
| `timeRange` | string   | No       | `7d`                                     | Time range: `24h`, `7d`, `30d`, `90d`, `1y` |
| `startDate` | string   | No       | -                                        | Start date (ISO 8601)                |
| `endDate`   | string   | No       | -                                        | End date (ISO 8601)                  |
| `metrics`   | string   | No       | `total_conversations,active_conversations` | Comma-separated metrics list       |
| `teamId`    | integer  | No       | -                                        | Filter by team ID                    |
| `platform`  | string   | No       | -                                        | Filter by platform: `line`, `facebook`, `web` |
| `status`    | string   | No       | -                                        | Filter by status: `open`, `closed`, `pending` |
| `groupBy`   | string   | No       | -                                        | Group by: `date`, `platform`, `team`, `status` |
| `orderBy`   | string   | No       | -                                        | Sort: `field:asc` or `field:desc`    |
| `limit`     | integer  | No       | 100                                      | Maximum results (1-1000)             |

**Available Metrics:**

- `total_conversations` - Total conversation count
- `active_conversations` - Currently active conversations
- `closed_conversations` - Closed conversations count
- `pending_conversations` - Pending conversations
- `avg_response_time` - Average first response time (seconds)
- `avg_resolution_time` - Average resolution time (seconds)
- `conversation_duration` - Average conversation duration
- `messages_per_conversation` - Average messages per conversation
- `customer_satisfaction` - Average satisfaction score
- `abandonment_rate` - Conversation abandonment rate

#### Response

```json
{
  "success": true,
  "data": {
    "metrics": {
      "total_conversations": 1500,
      "active_conversations": 45,
      "closed_conversations": 1200,
      "avg_response_time": 180,
      "avg_resolution_time": 3600
    },
    "timeSeries": [
      {
        "date": "2025-01-21",
        "total_conversations": 200,
        "active_conversations": 8
      },
      {
        "date": "2025-01-22",
        "total_conversations": 215,
        "active_conversations": 12
      }
    ],
    "breakdown": {
      "byPlatform": {
        "line": 800,
        "facebook": 400,
        "web": 300
      },
      "byStatus": {
        "open": 45,
        "closed": 1200,
        "pending": 255
      }
    }
  },
  "metadata": {
    "timeRange": "7d",
    "startDate": "2025-01-21T00:00:00Z",
    "endDate": "2025-01-28T00:00:00Z",
    "totalRecords": 1500,
    "queryTime": 45
  }
}
```

#### Example Request

```bash
curl -X GET "https://api.example.com/api/analytics/conversations?timeRange=30d&metrics=total_conversations,avg_response_time&groupBy=date,platform&platform=line" \
  -H "Authorization: Bearer $TOKEN"
```

---

##  Message Analytics

### GET /api/analytics/messages

Analyze message patterns, volumes, and types.

#### Request

**Query Parameters:**

| Parameter        | Type    | Required | Default                               | Description                       |
|------------------|---------|----------|---------------------------------------|-----------------------------------|
| `timeRange`      | string  | No       | `7d`                                  | Time range                        |
| `startDate`      | string  | No       | -                                     | Start date (ISO 8601)             |
| `endDate`        | string  | No       | -                                     | End date (ISO 8601)               |
| `metrics`        | string  | No       | `total_messages,messages_per_hour`    | Metrics to include                |
| `conversationId` | string  | No       | -                                     | Filter by conversation ID         |
| `platform`       | string  | No       | -                                     | Filter by platform                |
| `groupBy`        | string  | No       | -                                     | Group by fields                   |
| `limit`          | integer | No       | 100                                   | Maximum results                   |

**Available Metrics:**

- `total_messages` - Total message count
- `messages_per_hour` - Average messages per hour
- `messages_per_conversation` - Messages per conversation
- `customer_messages` - Messages from customers
- `agent_messages` - Messages from agents
- `system_messages` - System-generated messages
- `message_response_time` - Average response time
- `by_message_type` - Breakdown by type (text, image, file, etc.)
- `attachment_count` - Total attachments
- `avg_message_length` - Average message length (characters)

#### Response

```json
{
  "success": true,
  "data": {
    "metrics": {
      "total_messages": 15000,
      "messages_per_hour": 62.5,
      "customer_messages": 8000,
      "agent_messages": 7000
    },
    "timeSeries": [
      {
        "hour": "2025-01-28T10:00:00Z",
        "total_messages": 65,
        "customer_messages": 35,
        "agent_messages": 30
      }
    ],
    "breakdown": {
      "byType": {
        "text": 12000,
        "image": 2000,
        "file": 800,
        "sticker": 200
      },
      "bySender": {
        "customer": 8000,
        "agent": 7000
      }
    }
  },
  "metadata": {
    "timeRange": "7d",
    "queryTime": 32
  }
}
```

---

##  User Analytics

### GET /api/analytics/users

Monitor user activity, engagement, and performance metrics.

#### Request

**Query Parameters:**

| Parameter   | Type    | Required | Default                        | Description                              |
|-------------|---------|----------|--------------------------------|------------------------------------------|
| `timeRange` | string  | No       | `7d`                           | Time range                               |
| `startDate` | string  | No       | -                              | Start date                               |
| `endDate`   | string  | No       | -                              | End date                                 |
| `metrics`   | string  | No       | `active_users,user_activity`   | Metrics to include                       |
| `userType`  | string  | No       | -                              | User type: `agent`, `customer`, `admin`  |
| `teamId`    | integer | No       | -                              | Filter by team                           |
| `userId`    | string  | No       | -                              | Filter by specific user                  |
| `groupBy`   | string  | No       | -                              | Group by fields                          |
| `limit`     | integer | No       | 100                            | Maximum results                          |

**Available Metrics:**

- `active_users` - Active users count
- `user_activity` - Activity score (0-100)
- `online_time` - Total online time
- `handled_conversations` - Conversations handled
- `sent_messages` - Messages sent
- `avg_response_time` - Average response time
- `customer_satisfaction` - Satisfaction ratings
- `workload_distribution` - Workload balance score

#### Response

```json
{
  "success": true,
  "data": {
    "metrics": {
      "active_users": 25,
      "total_agents": 30,
      "avg_response_time": 120,
      "total_handled_conversations": 800
    },
    "users": [
      {
        "userId": "agent-123",
        "displayName": "John Doe",
        "userType": "agent",
        "metrics": {
          "handled_conversations": 45,
          "sent_messages": 320,
          "avg_response_time": 95,
          "satisfaction_score": 4.7,
          "online_time": 28800
        }
      }
    ],
    "breakdown": {
      "byRole": {
        "agent": 20,
        "admin": 5
      },
      "byTeam": {
        "team_1": 12,
        "team_2": 8,
        "team_3": 5
      }
    }
  },
  "metadata": {
    "timeRange": "7d"
  }
}
```

---

##  Performance Analytics

### GET /api/analytics/performance

System performance metrics and bottleneck identification.

#### Request

**Query Parameters:**

| Parameter   | Type   | Required | Default                                     | Description               |
|-------------|--------|----------|---------------------------------------------|---------------------------|
| `timeRange` | string | No       | `24h`                                       | Time range                |
| `startDate` | string | No       | -                                           | Start date                |
| `endDate`   | string | No       | -                                           | End date                  |
| `metrics`   | string | No       | `response_times,throughput,error_rates`     | Metrics to include        |
| `platform`  | string | No       | -                                           | Filter by platform        |
| `groupBy`   | string | No       | -                                           | Group by fields           |
| `limit`     | integer| No       | 100                                         | Maximum results           |

**Available Metrics:**

- `response_times` - API response times (p50, p95, p99)
- `throughput` - Requests per second
- `error_rates` - Error percentage
- `database_latency` - Database query times
- `cache_hit_rate` - Cache effectiveness
- `websocket_connections` - Active WebSocket connections
- `queue_depth` - Message queue depth
- `cpu_usage` - CPU utilization
- `memory_usage` - Memory consumption

#### Response

```json
{
  "success": true,
  "data": {
    "metrics": {
      "response_times": {
        "p50": 45,
        "p95": 120,
        "p99": 250
      },
      "throughput": 85.5,
      "error_rates": 0.02,
      "database_latency": {
        "avg": 12,
        "max": 85
      }
    },
    "timeSeries": [
      {
        "timestamp": "2025-01-28T10:00:00Z",
        "response_time_p95": 110,
        "throughput": 90,
        "error_rate": 0.01
      }
    ],
    "breakdown": {
      "byEndpoint": {
        "/api/conversations": {
          "avgResponseTime": 45,
          "requestCount": 5000
        },
        "/api/messages": {
          "avgResponseTime": 32,
          "requestCount": 8000
        }
      }
    }
  },
  "metadata": {
    "timeRange": "24h"
  }
}
```

---

##  Custom Analytics

### POST /api/analytics/custom

Execute custom analytics queries with flexible parameters.

** Admin Only Endpoint**

#### Request

**Body Parameters:**

```json
{
  "timeRange": "30d",
  "startDate": "2025-01-01T00:00:00Z",
  "endDate": "2025-01-28T23:59:59Z",
  "query": "custom_query_name",
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  },
  "aggregation": "sum|avg|count|min|max",
  "filters": {
    "teamId": 1,
    "platform": "line"
  },
  "groupBy": ["date", "team"],
  "limit": 500
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "date": "2025-01-28",
        "team": "Sales",
        "value": 150
      }
    ],
    "summary": {
      "total": 4500,
      "average": 150,
      "min": 50,
      "max": 300
    }
  },
  "metadata": {
    "queryName": "custom_query_name",
    "executionTime": 125,
    "rowCount": 30
  }
}
```

---

##  Data Export

### POST /api/analytics/export

Export analytics data in various formats with optional chart generation.

#### Request

**Body Parameters:**

```json
{
  "timeRange": "30d",
  "startDate": "2025-01-01T00:00:00Z",
  "endDate": "2025-01-28T23:59:59Z",
  "format": "json|csv|pdf",
  "includeCharts": true,
  "template": "standard|detailed|executive",
  "fileName": "analytics_report_jan2025",
  "metrics": [
    "total_conversations",
    "avg_response_time",
    "customer_satisfaction"
  ],
  "filters": {
    "teamId": 1,
    "platform": "line"
  },
  "groupBy": ["date"],
  "limit": 1000
}
```

#### Response

**JSON Export:**
```json
{
  "success": true,
  "data": {
    "format": "json",
    "fileName": "analytics_report_jan2025.json",
    "downloadUrl": "https://storage.example.com/exports/analytics_report_jan2025.json",
    "expiresAt": "2025-01-29T10:00:00Z",
    "fileSize": 245760,
    "recordCount": 1000,
    "generatedAt": "2025-01-28T10:00:00Z"
  }
}
```

**CSV Export Headers:**
```csv
Date,Total Conversations,Avg Response Time,Customer Satisfaction,Platform,Team
2025-01-28,150,120,4.7,line,Sales
```

**PDF Export:**
- Professional report layout
- Charts and visualizations
- Executive summary
- Detailed metrics tables
- Time period comparison

---

##  Metrics Collection

### POST /api/analytics/metrics

Collect and store custom metrics data for later analysis.

** Admin Only Endpoint**

#### Request

**Single Metric:**
```json
{
  "metric": {
    "name": "api_response_time",
    "value": 125,
    "timestamp": 1706432400,
    "tags": {
      "endpoint": "/api/conversations",
      "method": "GET",
      "status": "200"
    },
    "metadata": {
      "user_id": "agent-123",
      "ip": "192.168.1.1"
    }
  }
}
```

**Batch Metrics:**
```json
{
  "metrics": [
    {
      "name": "websocket_connections",
      "value": 150,
      "timestamp": 1706432400,
      "tags": {
        "region": "us-east"
      }
    },
    {
      "name": "message_throughput",
      "value": 85,
      "timestamp": 1706432400
    }
  ]
}
```

#### Response

```json
{
  "success": true,
  "message": "Metrics collected successfully",
  "data": {
    "collected": 2,
    "failed": 0
  }
}
```

---

##  Metrics Queries

### GET /api/analytics/metrics/:name

Query collected metrics with filtering and aggregation.

#### Request

**Path Parameters:**
- `name` - Metric name (e.g., `api_response_time`)

**Query Parameters:**

| Parameter     | Type    | Required | Default | Description                              |
|---------------|---------|----------|---------|------------------------------------------|
| `startTime`   | integer | No       | 0       | Start timestamp (Unix epoch)             |
| `endTime`     | integer | No       | now     | End timestamp                            |
| `aggregation` | string  | No       | -       | Aggregation: `avg`, `sum`, `min`, `max`, `count` |
| `period`      | string  | No       | -       | Period: `1m`, `5m`, `1h`, `1d`          |
| `tags`        | string  | No       | -       | JSON object of tag filters               |
| `groupBy`     | string  | No       | -       | Comma-separated group fields             |
| `orderBy`     | string  | No       | `timestamp:desc` | Sort order                      |
| `limit`       | integer | No       | 100     | Maximum results                          |

#### Response

```json
{
  "success": true,
  "data": {
    "metrics": [
      {
        "timestamp": 1706432400,
        "value": 125,
        "aggregation": "avg",
        "tags": {
          "endpoint": "/api/conversations"
        }
      }
    ]
  },
  "metadata": {
    "metricName": "api_response_time",
    "totalRecords": 5000,
    "aggregation": "avg",
    "period": "1h"
  }
}
```

#### Example Request

```bash
curl -X GET "https://api.example.com/api/analytics/metrics/api_response_time?startTime=1706428800&endTime=1706432400&aggregation=avg&period=5m&tags=%7B%22endpoint%22%3A%22%2Fapi%2Fconversations%22%7D" \
  -H "Authorization: Bearer $TOKEN"
```

---

##  Health Check

### GET /api/analytics/health

Check analytics service health and dependencies.

**No Authentication Required**

#### Response

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "services": {
      "database": "healthy",
      "kv": "healthy",
      "cache": "healthy"
    },
    "version": "2.0.0",
    "timestamp": "2025-01-28T10:00:00Z",
    "uptime": 86400
  }
}
```

**Unhealthy Response:**
```json
{
  "success": false,
  "status": "unhealthy",
  "error": "Database connection failed",
  "timestamp": "2025-01-28T10:00:00Z"
}
```

---

##  Common Parameters

### Time Ranges

Standard time range values:

| Value | Description        |
|-------|--------------------|
| `1h`  | Last hour          |
| `24h` | Last 24 hours      |
| `7d`  | Last 7 days        |
| `30d` | Last 30 days       |
| `90d` | Last 90 days       |
| `1y`  | Last year          |

### Date Formats

All dates use ISO 8601 format:
- `2025-01-28T10:00:00Z` (UTC)
- `2025-01-28T10:00:00+08:00` (with timezone)

### Group By Options

Common grouping fields:

- `date` - Group by date
- `hour` - Group by hour
- `platform` - Group by platform (LINE, Facebook, etc.)
- `team` - Group by team
- `agent` - Group by agent
- `status` - Group by status
- `messageType` - Group by message type

### Sorting

Sort format: `field:direction`

Examples:
- `date:asc` - Ascending by date
- `count:desc` - Descending by count
- `value:asc` - Ascending by value

---

##  Response Structures

### Standard Analytics Response

```typescript
{
  success: boolean;
  data: {
    metrics: Record<string, number>;
    timeSeries?: Array<{
      timestamp: string;
      [key: string]: any;
    }>;
    breakdown?: Record<string, any>;
  };
  metadata?: {
    timeRange?: string;
    startDate?: string;
    endDate?: string;
    totalRecords?: number;
    queryTime?: number;
  };
}
```

### Error Response

```typescript
{
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  requestId: string;
}
```

---

##  Examples

### Example 1: Dashboard Overview

Get key metrics for dashboard display:

```bash
curl -X GET "https://api.example.com/api/analytics/conversations?timeRange=24h&metrics=total_conversations,active_conversations,avg_response_time" \
  -H "Authorization: Bearer $TOKEN"
```

### Example 2: Agent Performance Report

Analyze agent performance over the last 30 days:

```bash
curl -X GET "https://api.example.com/api/analytics/users?timeRange=30d&userType=agent&metrics=handled_conversations,avg_response_time,customer_satisfaction&groupBy=userId&orderBy=handled_conversations:desc&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

### Example 3: Platform Comparison

Compare performance across different platforms:

```bash
curl -X GET "https://api.example.com/api/analytics/messages?timeRange=7d&metrics=total_messages,messages_per_hour,avg_message_length&groupBy=platform" \
  -H "Authorization: Bearer $TOKEN"
```

### Example 4: Export Monthly Report

Export comprehensive monthly report:

```bash
curl -X POST "https://api.example.com/api/analytics/export" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "timeRange": "30d",
    "format": "pdf",
    "includeCharts": true,
    "template": "executive",
    "fileName": "monthly_report_january_2025",
    "metrics": [
      "total_conversations",
      "avg_response_time",
      "customer_satisfaction",
      "agent_performance"
    ]
  }'
```

### Example 5: Real-time Metrics Collection

Collect real-time API performance metrics:

```javascript
// JavaScript example
async function collectMetrics() {
  await fetch('https://api.example.com/api/analytics/metrics', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      metric: {
        name: 'api_latency',
        value: responseTime,
        timestamp: Math.floor(Date.now() / 1000),
        tags: {
          endpoint: req.path,
          method: req.method,
          status: res.status
        }
      }
    })
  });
}
```

### Example 6: Custom Query for Peak Hours

Identify peak conversation hours:

```bash
curl -X POST "https://api.example.com/api/analytics/custom" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "timeRange": "30d",
    "query": "peak_hours_analysis",
    "aggregation": "count",
    "groupBy": ["hour"],
    "orderBy": "count:desc",
    "limit": 24
  }'
```

---

##  Error Codes

| Code                       | HTTP Status | Description                              |
|----------------------------|-------------|------------------------------------------|
| `VALIDATION_ERROR`         | 400         | Invalid query parameters                 |
| `AUTHENTICATION_ERROR`     | 401         | Missing or invalid token                 |
| `AUTHORIZATION_ERROR`      | 403         | Insufficient permissions                 |
| `METRICS_QUERY_ERROR`      | 500         | Failed to query metrics                  |
| `CUSTOM_ANALYTICS_ERROR`   | 500         | Custom query execution failed            |
| `EXPORT_ANALYTICS_ERROR`   | 500         | Export operation failed                  |
| `METRICS_COLLECTION_ERROR` | 500         | Metrics collection failed                |

---

##  Best Practices

1. **Use Time Ranges Appropriately**
   - Use `24h` for real-time monitoring
   - Use `7d` for weekly reports
   - Use `30d` for monthly analysis

2. **Limit Result Sets**
   - Always specify a `limit` for large datasets
   - Use pagination for iterating through results

3. **Leverage Caching**
   - Analytics results are cached for 5 minutes
   - Repeated identical queries will return cached results

4. **Optimize Queries**
   - Request only needed metrics
   - Use specific filters to reduce data volume
   - Avoid overly granular grouping for large time ranges

5. **Monitor Performance**
   - Check `metadata.queryTime` in responses
   - Queries over 1000ms should be optimized

6. **Export Best Practices**
   - Use JSON for programmatic access
   - Use CSV for spreadsheet analysis
   - Use PDF for presentation-ready reports

---

##  Related Resources

- [Main API Reference](../API_REFERENCE.md)
- [Dashboard Integration Guide](../../guides/DASHBOARD_INTEGRATION.md)
- [Metrics Collection Best Practices](../../guides/METRICS_BEST_PRACTICES.md)
- [Custom Analytics Examples](../../guides/ANALYTICS_EXAMPLES.md)

---

**Last Updated:** 2025-01-28
**Version:** 2.0.0
