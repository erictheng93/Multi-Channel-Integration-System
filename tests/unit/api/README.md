# Frontend API Layer Tests / 前端 API 層測試

This directory contains comprehensive tests for the frontend API layer, covering:

## Test Coverage / 測試覆蓋範圍

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

## Key Testing Areas / 主要測試領域

1. **API Request Format / API 請求格式**
   - Correct HTTP methods
   - Proper headers
   - Request body formatting
   - Query parameter handling

2. **Error Handling / 錯誤處理**
   - Network errors
   - HTTP status errors
   - Authentication failures
   - Validation errors

3. **Response Data Transformation / 響應數據轉換**
   - Type safety
   - Data structure validation
   - Error response parsing
   - Success response handling

## Running Tests / 執行測試

```bash
# Run all API tests
npm run test:api

# Run specific test file
npm run test tests/unit/api/base.test.ts
```