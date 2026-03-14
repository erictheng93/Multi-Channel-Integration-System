# Activities ()


Activities


```
src/modules/activities/
 services/ #
 ActivityService.ts #
 TeamActivityService.ts #
 ActivityStatsService.ts #
 handlers/ # HTTP
 ActivityHandler.ts # API
 types/ #
 interfaces.ts #
 constants/ #
 actions.ts #
 resources.ts #
 utils/ #
 validators.ts #
 formatters.ts #
 index.ts #
```


### 1. (Activity Logging)
- ****:
- ****: JSON
- ****:
- **IP User Agent **:

### 2. (Analytics)
- ****:
- ****:
- ****:
- ****:

### 3. (Team Activity Tracking)
- ****:
- ****:
- ****:
- **QR **: QR


```typescript
import {
 ActivityService,
 TeamActivityService,
 ActivityStatsService,
 ACTIVITY_ACTIONS,
 RESOURCE_TYPES
} from '../modules/activities'
```


```typescript
const activityService = new ActivityService(database)

//
await activityService.logActivity({
 userId: 'user123',
 userName: 'John Doe',
 userRole: 'admin',
 action: ACTIVITY_ACTIONS.USER_LOGIN,
 resourceType: RESOURCE_TYPES.USER,
 resourceId: 'user123',
 details: { loginMethod: 'oauth' }
})

//
const activities = await activityService.getActivities({
 page: 1,
 pageSize: 50,
 userId: 'user123'
})
```


```typescript
const teamActivityService = new TeamActivityService(database)

//
await teamActivityService.logTeamCreate({
 userId: 'admin123',
 userName: 'Admin User',
 userRole: 'admin',
 teamId: 1,
 teamName: '',
 description: ''
})

//
await teamActivityService.logMemberAdd({
 userId: 'admin123',
 userName: 'Admin User',
 userRole: 'admin',
 teamId: 1,
 teamName: '',
 addedAgentId: 'agent456',
 addedAgentName: 'Agent Smith'
})
```


```typescript
const statsService = new ActivityStatsService(database)

//
const overview = await statsService.getOverview(7) // 7

//
const trends = await statsService.getActivityTrends(30) // 30

//
const heatmap = await statsService.getActivityHeatmap(30)
```

## API

### API
- `GET /api/activities` -
- `GET /api/activities/:id` -
- `GET /api/activities/user/:userId/stats` -
- `DELETE /api/activities/cleanup` - ( admin)

### API
- `GET /api/activities/overview` -
- `GET /api/activities/stats/resources` -
- `GET /api/activities/stats/roles` -
- `GET /api/activities/trends` -
- `GET /api/activities/heatmap` -
- `GET /api/activities/metrics` -


- `conversation_assign` -
- `conversation_transfer` -
- `conversation_close` -
- `conversation_reopen` -


- `message_send` -
- `message_recall` -


- `user_login` -
- `user_logout` -
- `user_create` -
- `user_update` -
- `user_delete` -


- `team_create` -
- `team_update` -
- `team_delete` -
- `member_add` -
- `member_remove` -


- `settings_update` -
- `qr_code_generate` - QR


- **Admin**:
- **Team/Agent**:


- **Admin**:
- **Team/Agent**:


- **Admin**:
- ****:


### Legacy
```typescript
//
import { ActivityService } from '../services/activity-service'
import { TeamActivityService } from '../modules/teams/services/activity-service'
```

### API
- API
-
-


- ****:
- ****:
- ****:


- ****:
- ****:
- ****:


- ****:
- ****:
- ****:


-
- Mock
-


- API
-
-


```typescript
// constants/actions.ts
export const ACTIVITY_ACTIONS = {
 // ...
 NEW_ACTION: 'new_action'
}
```


```typescript
// ActivityStatsService
class CustomStatsService extends ActivityStatsService {
 async getCustomReport() {
 //
 }
}
```


```typescript
// utils/validators.ts
export class CustomValidator extends ActivityValidator {
 static validateCustom(data: any): ValidationError[] {
 //
 }
}
```


```typescript
//
console.log('[Activity Service] Activity logged with ID:', activityId)
console.error('[Activity Service] Failed to log activity:', error)
```


- ****:
- ****:
- ****:


- ****:
- ****:
- ****:


1. ****: userId, userName, userRole
2. ****: details
3. ****: resourceId


1. ****:
2. ****:
3. ****:


1. ****:
2. ****:
3. ****:

---


### v1.0.0 (2024-09-26)
-
-
-
-
-
- 