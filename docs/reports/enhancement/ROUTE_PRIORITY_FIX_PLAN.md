


- `/health` - 200 OK
- `/info` - 200 OK
- `/` POST (create) - 404
- `/search` GET - 404
- `/stats` GET - 404
- `/tags` GET - 404
- `/export` GET - 404
- `/:id` GET - 404 ()
- -


****: `/:id` (189)

****:
```
1. app.get('/health')
2. app.get('/info')
3. app.post('/') POST
4. app.get('/:id') (GET)
5. app.put('/:id')
6. app.delete('/:id')
7. app.get('/conversation/:conversationId')
8. app.get('/search') /:id
9. app.get('/stats') /:id
10. app.post('/bulk-create') POST
11. app.post('/bulk-delete') POST
12. app.get('/:id/attachments')
13. app.post('/:id/attachments')
14. app.post('/:id/forward')
15. app.put('/:id/tags')
16. app.get('/tags') /:id
17. app.get('/export') /:id
```


****:

****:
```typescript
// 1. ()
app.get('/health', ...)
app.get('/info', ...)

// 2. CRUD
app.post('/', jwtAuth, ...) //

// 3. ( /:id )
app.get('/search', jwtAuth, ...) //
app.get('/stats', jwtAuth, ...) //
app.get('/tags', jwtAuth, ...) //
app.get('/export', jwtAuth, ...) //

// 4.
app.post('/bulk-create', jwtAuth, ...)
app.post('/bulk-delete', jwtAuth, ...)

// 5.
app.get('/conversation/:conversationId', jwtAuth, ...)

// 6. ID ()
app.get('/:id', jwtAuth, ...) //
app.put('/:id', jwtAuth, ...) //
app.delete('/:id', jwtAuth, ...) //

// 7. (ID)
app.get('/:id/attachments', jwtAuth, ...)
app.post('/:id/attachments', jwtAuth, ...)
app.post('/:id/forward', jwtAuth, ...)
app.put('/:id/tags', jwtAuth, ...)
```


1. ****
 ```bash
 cp src/handlers/messaging-main.ts src/handlers/messaging-main.ts.backup
 ```

2. ****
 - 735-748 (`/search`) 77
 - 801-846 (`/stats`) `/search`
 - 1696-1748 (`/tags`) `/stats`
 - 1756-1887 (`/export`) `/tags`

3. ****
 ```bash
 npm run lint:check
 npm run build
 ```

4. ****
 ```bash
 #
 npm run dev
 curl http://localhost:8787/api/messages/search?q=test

 #
 npm run deploy
 npx tsx test-messaging-dual.ts <JWT_TOKEN>
 ```


- POST `/` 201 Created (400 Bad Request)
- GET `/search` 200 OK
- GET `/stats` 200 OK
- GET `/tags` 200 OK
- GET `/export` 200 OK
- GET `/:id` 200 OK 404 Not Found (ID)

 71% 100%


Hono () ****
1.
2.
3. `/:id` `/search``/stats`


1. ****:
2. ****:
3. ****:


```typescript
// -
app.get('/:id', handler)
app.get('/special', handler) //

// -
app.get('/special', handler)
app.get('/:id', handler)
```


- `src/handlers/messaging-main.ts` - ()
- `src/index.ts:186` - ()
- `test-messaging-dual.ts` - ()


- [ ]
- [ ]
- [ ]
- [ ]
- [ ]
- [ ]
- [ ]


****:
-
-
-

****: GET
- `/search``/stats``/tags``/export`
-

****:
```bash
cp src/handlers/messaging-main.ts.backup src/handlers/messaging-main.ts
npm run deploy
```