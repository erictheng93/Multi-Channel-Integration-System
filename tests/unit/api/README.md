# Frontend API Layer Tests / API

This directory contains comprehensive tests for the frontend API layer, covering:

## Test Coverage /

### Base API Client (`base.test.ts`)
- HTTP request methods (GET, POST, PUT, DELETE)
- Authentication header management
- Error handling and response parsing
- Network error scenarios
- 401 unauthorized handling

### Authentication API (`auth.test.ts`)
- Login functionality
- Token management
- User profile retrieval
- Logout functionality
- Authentication error handling

### Conversations API (`conversations.test.ts`)
- Conversation list retrieval with filters
- Paginated conversation listing
- Single conversation retrieval
- Message retrieval
- Message sending
- Conversation assignment
- Conversation closing
- Mark as read functionality

### Messages API (`message.test.ts`)
- Message list retrieval
- Message sending with platform support
- Message read status management
- Message format validation

## Key Testing Areas /

1. **API Request Format / API **
 - Correct HTTP methods
 - Proper headers
 - Request body formatting
 - Query parameter handling

2. **Error Handling / **
 - Network errors
 - HTTP status errors
 - Authentication failures
 - Validation errors

3. **Response Data Transformation / **
 - Type safety
 - Data structure validation
 - Error response parsing
 - Success response handling

## Running Tests /

```bash
# Run all API tests
npm run test:api

# Run specific test file
npm run test tests/unit/api/base.test.ts
```