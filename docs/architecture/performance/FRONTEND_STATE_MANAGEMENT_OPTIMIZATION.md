

 **" /auth/me "**


### ****
1. **** - 100%
2. ** /auth/me ** -


### 1. ****


```typescript
// API
const response = await authApi.me();
```


```typescript
// API
if (currentAgent.value && isValidAgent(currentAgent.value)) {
 setSessionStatus('authenticated');
 console.log(' Using cached agent data, skipping /auth/me request');
 return; // API
}

//
const response = await authApi.me();
```

### 2. **App.vue **


```typescript
// API
if (authStore.token && !authStore.currentAgent) {
 authStore.fetchCurrentAgent()
}
```


```typescript
//
if (authStore.token) {
 authStore.initializeSession() // API
}
```

### 3. **fetchCurrentAgent **


```typescript
//
async function fetchCurrentAgent(forceRefresh = false) {
 //
 if (!forceRefresh && currentAgent.value && isValidAgent(currentAgent.value)) {
 console.log(' Agent data already cached, skipping API request');
 return;
 }

 // API
 const response = await authApi.me();
}
```

### 4. **Agent **

 `isValidAgent`
```typescript
function isValidAgent(agent: Agent | null): boolean {
 if (!agent) return false;

 return !!(
 agent.id &&
 agent.email &&
 agent.displayName &&
 agent.role &&
 ['admin', 'team', 'agent'].includes(agent.role)
 );
}
```

### 5. **useAuth Composable **


```typescript
//
const refreshAgent = async (forceRefresh = false) => {
 await authStore.fetchCurrentAgent(forceRefresh)
}

//
const forceRefreshAgent = async () => {
 await authStore.fetchCurrentAgent(true)
}
```


### ****
 8 ****

#### ****

1. ****
 - ****:
 - ****: TokenRefreshToken
 - ****: localStorage

2. **API **
 - ****: 0 API
 - ****: /auth/me
 - ****:

3. ****
 ```bash
 #
 Using cached agent data, skipping /auth/me request
 Agent data already cached, skipping API request
 ```

### ****

| | | | |
|------|--------|--------|----------|
| | /auth/me | | ** 80-100% API ** |
| | | | **** |
| | | | **** |
| | | | **** |


### 1. ****
```typescript
//
if (currentAgent.value && isValidAgent(currentAgent.value)) {
 return; //
}

// localStorage
if (storedAgent) {
 currentAgent.value = JSON.parse(storedAgent);
}

// API
const response = await authApi.me();
```

### 2. ****
- ****: API localStorage
- ****: > localStorage > API
- ****:

### 3. ****
```typescript
//
if (import.meta.env.DEV) {
 console.log(' Using cached agent data, skipping /auth/me request');
 console.log(' No cached agent data, fetching from server...');
}
```


### ****


1. token
2. /auth/me
3. /auth/me
4.

**3-4 /auth/me **


1. token
2. API
3. localStorage
4.

**0-1 /auth/me **

### ****
- ****:
- ****:
- ****: API
- ****:


### 1. ****
```typescript
//
await authStore.fetchCurrentAgent(); //

//
await authStore.fetchCurrentAgent(true); //
```

### 2. ****
```typescript
// initializeSession
if (authStore.token) {
 authStore.initializeSession(); //
}

// fetchCurrentAgent
authStore.fetchCurrentAgent(); //
```

### 3. ****
```typescript
//
try {
 currentAgent.value = JSON.parse(storedAgent);
} catch (e) {
 console.error('Failed to parse stored agent:', e);
 currentAgent.value = null; //
}
```


1. ****:
2. ****:
3. ****: localStorage
4. ****:


********

 **** -
 ** /auth/me ** -
 ** 80-100%** -
 **** -
 **** -

