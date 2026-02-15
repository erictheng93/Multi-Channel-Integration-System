# Collaboration Module

> **Transport**: WebSocket via Durable Objects (SSE was removed in Feb 2026)

## Overview

Provides real-time collaboration features: typing indicators, presence tracking, and conversation viewer management.

## Features

- **Typing Indicator** - Broadcast typing start/stop events
- **Presence Management** - Track online/away/busy/offline status
- **Conversation Viewers** - Track who is viewing each conversation
- **Event Broadcasting** - Push collaboration events to participants

## Structure

```
src/modules/collaboration/
  types/
    collaboration-types.ts  # Type definitions
  adapters/
    websocket-adapter.ts    # WebSocket transport adapter
  services/
    collaboration-manager.ts # Core collaboration logic
  handlers/
    collaboration-main.ts   # API endpoints
```

## API Endpoints

```
GET  /api/collaboration/conversations/:id/state     # Get conversation state
GET  /api/collaboration/conversations/:id/viewers    # List viewers
POST /api/collaboration/conversations/:id/join       # Join conversation
POST /api/collaboration/conversations/:id/leave      # Leave conversation
POST /api/collaboration/typing                       # Send typing indicator
POST /api/collaboration/presence                     # Update presence
GET  /api/collaboration/stats                        # Get statistics
GET  /api/collaboration/health                       # Health check
```

## Usage

```typescript
import { Collaboration } from '@/modules/collaboration';

// Join a conversation
await Collaboration.joinConversation({
  conversationId: 123,
  userId: 1,
  metadata: { username: 'alice', displayName: 'Alice', role: 'admin' }
});

// Send typing indicator
await Collaboration.sendTyping({
  conversationId: 123,
  userId: 1,
  status: 'start'
});

// Update presence
await Collaboration.updatePresence({
  userId: 1,
  status: 'online',
  currentConversation: 123
});
```
