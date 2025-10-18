# API

 API


 API

1. **** - API
2. **** -
3. **** - API


### PowerShell

```powershell

.\scripts\test-all-apis.ps1


.\scripts\test-all-apis.ps1 -TestType endpoints


.\scripts\test-all-apis.ps1 -Environment prod

# URL
.\scripts\test-all-apis.ps1 -BaseUrl "https://your-api.example.com" -Verbose
```

### Node.js

```bash

cd tests


node --loader tsx run-api-tests.ts


node --loader tsx run-api-tests.ts endpoints integration


node --loader tsx run-api-tests.ts --url http://localhost:8787 --verbose
```


```bash
cd tests


node --loader tsx api-endpoints-test.ts [baseUrl] [timeout]


node --loader tsx api-integration-test.ts [baseUrl] [timeout]


node --loader tsx api-load-test.ts [baseUrl] [concurrency] [duration]
```


### 1. (api-endpoints-test.ts)

 API

-
-
-
-
-
-
-
- QR Code
-
- Webhook

****
- token
- token
-

### 2. (api-integration-test.ts)


- ****
- ****
- ****
- ****
- **QR Code **
- **Webhook **

****
-
-
- token

### 3. (api-load-test.ts)

 API

-
-
-
-

****
- 5
- 30
- `/`, `/api/health`, `/api/conversations`, `/api/customers`


- `api-test-report.json` -
- `integration-test-report.json` -
- `load-test-report.json` -
- `api-test-summary.json` -


 Cloudflare Worker

```bash

npm run dev
```

 URL`http://localhost:8787`


 PowerShell URL

```powershell
# scripts/test-all-apis.ps1
"prod" { return "https://your-actual-production-url.com" }
```


 `api-endpoints-test.ts` `getEndpoints()`

```typescript
{
 path: '/api/your-new-endpoint',
 method: 'GET',
 description: '',
 requiresAuth: true,
 expectedStatus: 200,
 testData: { /* */ }
}
```


 `api-integration-test.ts` `getTestScenarios()`

```typescript
{
 name: 'your-new-scenario',
 description: '',
 steps: [
 //
 ]
}
```


 `api-load-test.ts`

```typescript
const config: LoadTestConfig = {
 baseUrl,
 concurrency: 10, //
 duration: 60, //
 endpoints: [ //
 '/api/your-endpoint'
 ]
};
```


1. ****
 ```

 ```
 - Cloudflare Worker
 - URL
 -

2. ****
 ```
 token
 ```
 -
 -
 -

3. ****
 ```
 xxx
 ```
 -
 -
 -

4. **Node.js **
 ```
 Error: Cannot find module 'tsx'
 ```
 - `npm install tsx --save-dev`
 -


1. ****
 ```bash
 node --loader tsx run-api-tests.ts --verbose
 ```

2. ****
 ```bash
 node --loader tsx run-api-tests.ts endpoints
 ```

3. ****
 ```bash
 cat api-test-summary.json | jq .
 ```


### CI/CD

 GitHub Actions

```yaml
- name: Run API Tests
 run: |
 cd tests
 node --loader tsx run-api-tests.ts --url ${{ secrets.API_URL }}
```


```bash
#!/bin/bash
# daily-api-test.sh

echo " API ..."
cd /path/to/your/project/tests
node --loader tsx run-api-tests.ts --url https://your-api.com

# Slack Email
if [ $? -eq 0 ]; then
 echo " API "
else
 echo " API " | mail -s "API Test Failed" admin@example.com
fi
```


```bash

node --loader tsx api-load-test.ts http://localhost:8787 10 60 > baseline.log


node --loader tsx api-load-test.ts http://localhost:8787 10 60 > current.log
diff baseline.log current.log
```


1. Fork
2.
3.
4. Pull Request

