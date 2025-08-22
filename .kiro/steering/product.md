---
inclusion: always
---

# Product Overview

This is a multi-channel customer support platform that integrates LINE OA and Facebook Messenger into a unified customer service platform. Customer service agents manage conversations from multiple messaging platforms through a single interface.

## Core Domain Concepts

### Platform Integration
- **LINE OA**: Primary messaging platform with webhook-based message receiving
- **Facebook Messenger**: Secondary platform (planned for future implementation)
- **Unified Interface**: Single dashboard for managing all platform conversations

### User Roles & Permissions
- **Admin**: Full system access, user management, conversation oversight
- **Agent**: Conversation handling, message sending/receiving, limited admin functions
- **Customer**: External users from LINE/Facebook platforms (stored as `users` table)

### Conversation States
- **pending**: New conversations awaiting agent assignment
- **in-progress**: Active conversations being handled by an agent
- **closed**: Completed conversations

## Architecture Patterns

### Entry Point Strategy
- Use `src/index.ts` as the single main entry point for all features
- `src/index-simple.ts` for basic use cases only

### Data Flow Patterns
1. **Webhook → Handler → Service → Database**: Incoming messages
2. **Frontend → API → Service → Platform**: Outgoing messages
3. **Database → Converter → Frontend**: Data presentation

### Type System Guidelines
- Use modern types from `src/types/shared.ts` for new features
- Convert legacy types using `src/types/converters.ts`
- Database types in `src/types/index.ts` for persistence layer only

## Development Conventions

### Message Handling
- All messages must have unique UUIDs
- Store both original platform data and normalized format
- Maintain message threading through `conversation_id`
- Handle both text and media message types

### Error Handling
- Use consistent error response format across all handlers
- Log webhook failures for debugging platform integration issues
- Graceful degradation when platform APIs are unavailable

### Security Requirements
- JWT tokens for all authenticated endpoints
- Bcrypt password hashing (minimum 10 rounds)
- Validate all webhook signatures from external platforms
- Sanitize user input before database storage

### Database Conventions
- Use snake_case for all table and column names
- Include `created_at` and `updated_at` timestamps
- Foreign key relationships must be properly indexed
- Use transactions for multi-table operations

### API Design Patterns
- RESTful endpoints with consistent naming
- Use HTTP status codes appropriately
- Include pagination for list endpoints
- Version API endpoints when making breaking changes

## Platform-Specific Rules

### LINE OA Integration
- Verify webhook signatures using LINE Channel Secret
- Handle different message types: text, image, video, audio, file
- Support reply tokens for immediate responses
- Store LINE user IDs as platform identifiers

### Frontend State Management
- Use Pinia stores for global state
- Keep conversation state synchronized with backend
- Implement optimistic updates for message sending
- Handle real-time updates through polling or WebSocket

## Testing Guidelines
- Mock external platform APIs in tests
- Test webhook signature verification
- Verify conversation state transitions
- Test role-based access control

## Performance Considerations
- Implement message pagination for large conversations
- Cache frequently accessed conversation data
- Optimize database queries with proper indexing
- Handle webhook rate limiting gracefully