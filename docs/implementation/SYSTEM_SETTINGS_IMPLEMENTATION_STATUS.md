

### 1. SystemSettings.vue
- ****: `frontend/src/views/SystemSettings.vue`
- ****:
- ****:
 - 4
 -
 - LINE Facebook
 -
 -
 -
 - /

### 2.
- ****: `frontend/src/router/index.ts`
- ****:
- ****:
 - `/settings` SystemSettings
 - `requiresAdmin: true`
 - ''

### 3.
- ****: `frontend/src/components/ui/AppLayout.vue`
- ****:
- ****:
 - SettingsIcon
 -
 -

### 4.
- ****: `frontend/src/components/icons/index.ts`
- ****:
- ****:
 - `IntegrationIcon` -
 - `AdvancedIcon` -
 - `SystemIcon` -
 - `SettingsIcon` -

### 5. API
- ****: `frontend/src/api/system.ts`
- ****:
- ****:
 - `getSettings()` -
 - `updateSettings()` -
 - `testIntegration()` -
 - `backupDatabase()` -
 - `getBackups()` -
 - `restoreDatabase()` -
 - `clearCache()` -
 - `healthCheck()` -
 - `restartSystem()` -

## UI/UX


- ****:
- ****:
- ****:
- ****:
- ****:
- ****: /


- ARIA
-
-
-


- Vue 3 Composition API
-
-
-


-
-
-
- API


-
-
-
- CSS


### (>768px)
-
-
-

### (768px)
-
-
-
-


- ****: `tests/unit/views/SystemSettings.test.ts`
- ****:
- ****:
 -
 -
 - API
 -
 -


1.
2.
 - ****:
 - ****: LINE OA Facebook Messenger
 - ****:
 - ****:


1.
2. API `systemApi`
3.
4.


-
-
-
-


- **LINE Official Account**:
 - Channel ID
 - Channel Secret
 - Access Token
 -
- **Facebook Messenger**:
 - App ID
 - App Secret
 - Page ID
 - Page Token
 -


-
-
-
-
-
-
-


- /
-
-
-


SystemSettings


1. ****:
2. ****:
3. ****:
4. ****:
5. ****:
6. ****:
7. ****:

