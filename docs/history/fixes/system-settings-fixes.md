# System Settings


1. ****:
2. ****:


### 1. (SystemSettings.vue)


-
- `getTimezoneDisplay()`
- `.form-display` CSS

```vue
<!-- -->
<select v-model="settings.general.timezone" class="form-select">
 <option value="Asia/Taipei">Asia/Taipei (GMT+8)</option>
</select>

<!-- -->
<div class="form-display">
 {{ getTimezoneDisplay(settings.general.timezone) }}
</div>
```


- `saveGeneralSettings()`
-
- API

### 2.


- `src/index.ts`
- `src/handlers/system.ts`
- JWT

```typescript
//
app.get('/api/system/info', jwtAuth, getSystemInfo);
app.get('/api/system/settings', jwtAuth, getSettings);
app.put('/api/system/settings', jwtAuth, updateSettings);
// ...
```


- `database/schema.sql` `system_settings`
- `datetime('now')`
- `database/init.sql`


- `database/migrations/002_add_system_settings_table.sql`
-
- `INSERT OR IGNORE`

### 3.


- `tests/test-system-settings.ts`:
- `scripts/test-system-settings.ps1`: API


```sql
INSERT OR IGNORE INTO system_settings (key, value) VALUES
 ('general.systemName', 'Multi-Channel Support'),
 ('general.contactEmail', 'admin@example.com'),
 ('general.timezone', 'Asia/Taipei'),
 ('general.language', 'zh-TW'),
 -- ...
```


1. ****:
 ```bash
 npm run db:migrate
 ```

2. ****:
 ```bash
 npm run deploy
 ```

3. ****:
 ```bash
 #
 .\scripts\test-system-settings.ps1

 #
 .\scripts\test-system-settings.ps1 -Token "your-jwt-token"
 ```


-
-
-


-
-
-
-


- API
- JWT
-
-


1. ****: `system_settings`
2. ****: API JWT token
3. ****:
4. ****: 