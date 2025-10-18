


```
src/
 services/
 activity-service.ts #
 handlers/
 activity.ts # API
 index.ts #
```


```
frontend/src/
 views/
 ActivityLog.vue #
 api/
 activities.ts # API
 router/
 index.ts #
 components/ui/
 AppLayout.vue #
```


```
database/
 schema.sql # activities
 migrations/
 001_add_activities_table.sql #
```


```
docs/features/
 activity-log.md #
```


```
docs/guides/
 activity-log-deployment.md #
```


```
docs/implementation/
 activity-log-implementation.md #
```


```
docs/testing/
 testing-guide.md #
 activity-log-testing.md #
```


```
tests/integration/
 activity-log.test.ts #
```


```
tests/
 test-activity-logging.ts #
 test-permissions.ts #
 run-all-tests.ts #
```


- `TESTING_GUIDE.md` `docs/testing/testing-guide.md`
- `ACTIVITY_LOG_SUCCESS_REPORT.md` `docs/implementation/activity-log-implementation.md`


- `tests/debug-token-issue.ts`
- `tests/test-activity-api.ts`
- `tests/run-tests.ts`
- `tests/verify-api-endpoints.ts`


- `docs/ACTIVITY_LOG_DEPLOYMENT.md` `docs/guides/activity-log-deployment.md`
- `docs/testing/TESTING_GUIDE.md`


 `tests/test-activity-logging.ts` -
 `tests/test-permissions.ts` -
 `tests/integration/activity-log.test.ts` -
 `tests/run-all-tests.ts` -


```bash

npx tsx tests/run-all-tests.ts


npx tsx tests/integration/activity-log.test.ts
npx tsx tests/test-activity-logging.ts
npx tsx tests/test-permissions.ts
```


### docs/INDEX.md
-
-
-
-


- `tests/README.md`
-


- ****: `src/` `frontend/src/`
- ****: `docs/features/`
- ****: `docs/guides/`
- ****: `tests/`


- ****: API
- ****:
- ****:
- ****:


- ****: kebab-case `activity-log.md`
- ****:
- ****: `test-` `.test.ts`
- ****:


1.
2.
3.
4.


1.
2.
3.
4.


1.
2.
3.
4.


 **** -
 **** -
 **** -
 **** -


-
-
-
- 