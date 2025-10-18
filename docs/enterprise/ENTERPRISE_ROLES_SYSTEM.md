# Enterprise 3-Role System Documentation

## Overview

The Multi-Channel Integration System now supports a comprehensive 3-role enterprise system designed for scalable customer support operations.

## Role Hierarchy

```
Admin (Level 3) > Manager (Level 2) > Agent (Level 1)
```

### Role Definitions

#### 1. Admin (System Administrator)
- **Level**: 3 (Highest)
- **Scope**: System-wide access
- **Team Association**: None (can access all teams)

**Permissions:**
- Full system access (`*:*`)
- Manage all teams and users
- System configuration and settings
- Database and infrastructure management
- Create/modify/delete any resource
- Access all conversations across teams
- Manage integrations (LINE, Facebook)
- View system analytics and reports

#### 2. Manager (Team Manager)
- **Level**: 2 (Middle)
- **Scope**: Team-specific access
- **Team Association**: Must be assigned to a specific team

**Permissions:**
- **Conversation Management:**
 - View all team conversations
 - Assign conversations to team agents
 - Transfer conversations within/outside team
 - Close/reopen conversations

- **Team Management:**
 - View own team details
 - Manage team settings (own team only)
 - Invite agents to team

- **Agent Management:**
 - View all agents in team
 - Invite new agents to team

- **Customer Management:**
 - View all team customers
 - Edit customer information (team scope)
 - Manage customer tags (team scope)

- **Message Management:**
 - View all team messages
 - Send messages on behalf of team
 - Recall messages (team scope)

- **Analytics & Reporting:**
 - Generate team reports
 - View team analytics
 - Team performance metrics

- **Resource Management:**
 - Generate QR codes for team
 - Manage team tags

- **Limitations:**
 - Cannot access other teams' data
 - Cannot delete teams or agents
 - Cannot modify system settings
 - Cannot access system-level analytics

#### 3. Agent (Customer Service Representative)
- **Level**: 1 (Basic)
- **Scope**: Assigned conversation access
- **Team Association**: Must be assigned to a specific team

**Permissions:**
- **Conversation Management:**
 - View assigned conversations only
 - Reply to assigned conversations

- **Message Management:**
 - Send messages in assigned conversations
 - Recall own messages only

- **Customer Management:**
 - View customer details in assigned conversations
 - Add tags to customers (team scope)

- **Limitations:**
 - Cannot view unassigned conversations
 - Cannot access other agents' conversations
 - Cannot manage team settings
 - Cannot invite other users
 - Cannot access analytics/reports

## Database Schema Changes

### 1. Teams Table
```sql
CREATE TABLE teams (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 description TEXT,
 qr_code TEXT,
 is_active INTEGER DEFAULT 1,
 created_at TEXT DEFAULT (datetime('now')),
 updated_at TEXT DEFAULT (datetime('now'))
);
```

### 2. Updated Agents Table
```sql
-- Added team_id column
ALTER TABLE agents ADD COLUMN team_id INTEGER REFERENCES teams(id);

-- Updated role column comment
-- role: 'admin', 'manager', 'agent'
```

### 3. Updated Invitations Table
```sql
-- Added team_id column for team-specific invitations
ALTER TABLE invitations ADD COLUMN team_id INTEGER REFERENCES teams(id);
```

## Permission Implementation

### Backend Permission Service

The `PermissionService` class implements the role hierarchy:

```typescript
class PermissionService {
 // Role hierarchy levels
 private static roleHierarchy = {
 admin: 3,
 manager: 2,
 agent: 1
 };

 // Check role authority
 static hasRoleAuthority(userRole: string, requiredRole: string): boolean {
 const userLevel = this.roleHierarchy[userRole] || 0;
 const requiredLevel = this.roleHierarchy[requiredRole] || 0;
 return userLevel >= requiredLevel;
 }
}
```

### Middleware Functions

New middleware functions for role-based access control:

- `requireAdmin()` - Admin-only access
- `requireManagerOrAdmin()` - Manager or Admin access
- `requireRoleLevel(role)` - Minimum role level required

### Frontend Authentication

Updated auth store with role-specific computed properties:

```typescript
const isAdmin = computed(() => currentAgent.value?.role === 'admin');
const isManager = computed(() => currentAgent.value?.role === 'manager');
const isAgent = computed(() => currentAgent.value?.role === 'agent');
const isManagerOrAdmin = computed(() =>
 currentAgent.value?.role === 'admin' || currentAgent.value?.role === 'manager'
);
```

## API Endpoints Access Control

### Team Management
- `GET /api/teams` - All roles (filtered by permission)
- `POST /api/teams` - Manager+
- `PUT /api/teams/:id` - Manager+ (own team only for managers)
- `DELETE /api/teams/:id` - Admin only

### User Management
- `POST /api/auth/register` - Manager+ (with role validation)
- `PUT /api/users/:id/role` - Admin only
- `GET /api/users` - Manager+ (filtered by team for managers)

### Conversation Management
- Conversations filtered by role and team permissions
- Managers see all team conversations
- Agents see only assigned conversations

## Migration Guide

### Existing Users
1. All existing agents remain as 'agent' role
2. Admins retain 'admin' role
3. New 'manager' role available for team leaders
4. Default team created for existing agents

### Team Assignment
1. Existing agents assigned to "Default Team"
2. Admins have no team assignment (system-wide access)
3. New managers must be assigned to specific teams

## Best Practices

### Role Assignment
- **Admins**: System administrators, technical leads
- **Managers**: Team leads, supervisors, customer service managers
- **Agents**: Front-line customer service representatives

### Team Structure
- Organize teams by:
 - Product lines
 - Geographic regions
 - Language/locale
 - Skill specializations

### Security Considerations
- Managers can only access their assigned team's data
- Cross-team data access requires admin privileges
- All role changes require admin approval
- Team transfers require admin privileges

## UI/UX Changes

### Role-Based Navigation
- Admin: Full system menu
- Manager: Team-focused menu with analytics
- Agent: Conversation-focused simplified menu

### Feature Visibility
- Role-specific feature flags
- Conditional menu items
- Permission-based button states

## Deployment Notes

### Database Migration
Run the migration script: `drizzle/0004_add_enterprise_roles_team_support.sql`

### Environment Variables
No new environment variables required.

### Testing
1. Test role hierarchy enforcement
2. Verify team-scoped data access
3. Validate permission-based UI rendering
4. Test user invitation flows with team assignment

## Future Enhancements

### Planned Features
- Custom role permissions (beyond predefined roles)
- Multi-team assignments for managers
- Department/division hierarchy
- Advanced analytics with role-based dashboards

### API Extensions
- Role-based rate limiting
- Team-specific webhook configurations
- Advanced audit logging by role

---

## Support

For implementation questions or issues with the enterprise role system, refer to:
- [Permission System Guide](../features/PERMISSION_SYSTEM_GUIDE.md)
- [Team Management Implementation](../implementation/TEAM_MANAGEMENT_IMPLEMENTATION_COMPLETE.md)
- [API Endpoints Documentation](../api/api-endpoints.md)