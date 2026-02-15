# Real-time Module

> **Architecture**: WebSocket-only (SSE was removed in Feb 2026)
> **Transport**: Durable Objects (ConversationRoom, UserConnection, MessageBroadcaster)

## Overview

This module provides internal event routing and queue processing for the real-time subsystem. The actual WebSocket connections are managed by Durable Objects in `src/durable-objects/`.

## Structure

```
src/modules/realtime/
  handlers/
    realtime-main.ts        # Health check, status, event dispatching
  services/
    realtime-manager.ts     # Lifecycle management
    event-queue-service.ts  # KV-based event queue (NOT Cloudflare Queue)
  middleware/
    realtime-auth.ts        # Real-time auth validation
    connection-validation.ts
  monitoring/
    performance-monitor.ts  # Metrics collection
    dashboard-handler.ts    # Monitoring dashboard API
  config/
    version-selector.ts     # Version selection (v2 default)
  types/
    realtime-types.ts       # Config and event type definitions
    event-types.ts          # Event source/target types
```

## Key Concepts

- **Event Queue**: Uses KV storage for event buffering (not Cloudflare Queue bindings)
- **Version Selection**: `v2` (WebSocket/Durable Objects) is the default and only active version
- **Performance Monitoring**: Tracks event latency, connection counts, and alert thresholds

## Configuration

```typescript
interface RealtimeConfig {
  version: 'v1' | 'v2' | 'auto';     // v2 = WebSocket (default)
  enableEventDriven: boolean;          // Enable event-driven processing
  enableQueueProcessing: boolean;      // Enable KV-based event queue
  heartbeatInterval: number;           // Heartbeat interval (ms)
  connectionTimeout: number;           // Connection timeout (ms)
  maxRetries: number;                  // Max retry attempts
  eventStorageTtl: number;             // Event TTL in KV (seconds)
}
```

## Related

- **WebSocket Durable Objects**: `src/durable-objects/` (ConversationRoom, UserConnection, MessageBroadcaster)
- **WebSocket Client**: `frontend/src/services/websocketClient.ts`
- **Broadcast Service**: `src/services/websocket-broadcast-service.ts`
