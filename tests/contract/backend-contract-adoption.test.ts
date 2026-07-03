import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

function routeBlock(source: string, receiver: string, method: string, route: string): string {
  const startNeedle = `${receiver}.${method}('${route}'`
  const start = source.indexOf(startNeedle)

  expect(start, `${startNeedle} route should exist`).toBeGreaterThanOrEqual(0)

  let depth = 0
  let inString: string | null = null
  let escaped = false

  for (let index = start; index < source.length; index += 1) {
    const char = source[index]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === inString) {
        inString = null
      }
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      inString = char
      continue
    }

    if (char === '(') {
      depth += 1
    } else if (char === ')') {
      depth -= 1
      if (depth === 0) {
        return source.slice(start, index + 1)
      }
    }
  }

  throw new Error(`Unable to extract route block: ${startNeedle}`)
}

const backendSourcePaths = [
  'src/modules/auth/handlers/auth-main.ts',
  'src/modules/reports/handlers/reports-main.ts',
  'src/modules/system/handlers/feedback-main.ts',
  'src/modules/file-management/handlers/file-main.ts',
  'src/modules/notifications/handlers/notification-main.ts',
  'src/modules/system/handlers/system-main.ts',
  'src/modules/tags/services/tag-service.ts',
  'src/modules/customer/handlers/customer-tags.ts',
  'src/modules/conversations/handlers/index.ts',
  'src/modules/conversations/handlers/conversation-queries.ts',
  'src/modules/conversations/handlers/conversation-messages.ts',
  'src/modules/activities/handlers/ActivityHandler.ts',
  'src/modules/integrations/handlers/channel-handler.ts',
  'src/modules/auto-reply/handlers/auto-reply-rules.ts',
  'src/modules/auto-reply/handlers/auto-reply-schedules.ts',
  'src/modules/auto-reply/handlers/auto-reply-logs.ts',
  'src/modules/delayed-message/handlers/delayed-message-buffer.ts',
  'src/modules/messaging/handlers/messaging/routes/export.ts',
  'src/modules/messaging/handlers/messaging/routes/bulk.ts',
  'src/modules/messaging/handlers/messaging/routes/crud.ts',
  'src/modules/teams/handlers/members.ts',
  'src/modules/teams/handlers/agent-teams.ts',
  'src/modules/teams/handlers/team-crud.ts',
  'src/modules/teams/handlers/team-members.ts',
  'src/modules/teams/handlers/team-qr.ts',
  'src/modules/teams/handlers/password.ts'
]

describe('backend shared/api-contracts adoption', () => {
  it('does not bypass contract response checking with double assertions', () => {
    const offenders = backendSourcePaths.flatMap(path => {
      const source = read(path)
      return source.includes('as unknown as ContractResponse') ? [path] : []
    })

    expect(offenders).toEqual([])
  })

  it('wires auth-main handler responses through authContracts', () => {
    const source = read('src/modules/auth/handlers/auth-main.ts')

    expect(source).toContain('authContracts')
    expect(source).toContain('contractJson')
  })

  it('wires reports-main handler responses through reportContracts', () => {
    const source = read('src/modules/reports/handlers/reports-main.ts')

    expect(source).toContain('reportContracts')
    expect(source).toContain('contractJson')
    for (const contractKey of [
      'health',
      'info',
      'generate',
      'list',
      'details',
      'delete',
      'stats',
      'batch',
      'templates',
      'preview',
      'createScheduled',
      'listScheduled',
      'updateScheduled',
      'deleteScheduled'
    ]) {
      expect(source).toContain(`reportContracts.${contractKey}`)
    }
  })

  it('wires feedback-main handler responses through feedbackContracts', () => {
    const source = read('src/modules/system/handlers/feedback-main.ts')

    expect(source).toContain('feedbackContracts')
    expect(source).toContain('contractJson')
    for (const contractKey of ['submit', 'stats', 'byConversation', 'list']) {
      expect(source).toContain(`feedbackContracts.${contractKey}`)
    }
  })

  it('wires file-main handler responses through fileContracts', () => {
    const source = read('src/modules/file-management/handlers/file-main.ts')

    expect(source).toContain('fileContracts')
    expect(source).toContain('contractJson')
    for (const contractKey of [
      'uploadFile',
      'uploadMultipleFiles',
      'stats',
      'search',
      'getDownloadUrl',
      'getDetails',
      'delete',
      'deleteMultiple'
    ]) {
      expect(source).toContain(`fileContracts.${contractKey}`)
    }
  })

  it('wires notification-main handler responses through notificationContracts', () => {
    const source = read('src/modules/notifications/handlers/notification-main.ts')
    const routerSource = read('src/modules/notifications/handlers/notification-router.ts')

    expect(source).toContain('notificationContracts')
    expect(source).toContain('contractJson')
    for (const contractKey of [
      'list',
      'getById',
      'create',
      'createBulk',
      'markAsRead',
      'markAllAsRead',
      'delete',
      'stats',
      'unreadCount',
      'recent',
      'cleanup',
      'channelStats',
      'testChannel',
      'newMessage',
      'conversationAssigned',
      'system',
      'settings',
      'updateSettings'
    ]) {
      expect(source).toContain(`notificationContracts.${contractKey}`)
    }

    expect(routerSource).toContain("app.get('/settings'")
    expect(routerSource).toContain("app.put('/settings'")
  })

  it('wires system-main dashboard stats through systemContracts', () => {
    const source = read('src/modules/system/handlers/system-main.ts')

    expect(source).toContain('systemContracts')
    expect(source).toContain('contractJson')
    expect(source).toContain('systemContracts.dashboardStats')
  })

  it('wires delegated tag handlers through tagContracts', () => {
    const tagSource = read('src/modules/tags/services/tag-service.ts')
    const customerTagSource = read('src/modules/customer/handlers/customer-tags.ts')

    expect(tagSource).toContain('tagContracts')
    expect(tagSource).toContain('contractJson')
    for (const contractKey of [
      'create',
      'getById',
      'update',
      'delete',
      'getUsageStats',
      'bulkOperate',
      'getCustomers',
      'getConversations'
    ]) {
      expect(tagSource).toContain(`tagContracts.${contractKey}`)
    }

    expect(customerTagSource).toContain('tagContracts')
    expect(customerTagSource).toContain('contractJson')
    for (const contractKey of [
      'list',
      'getCustomerTags',
      'addTagsToCustomer',
      'removeTagsFromCustomer',
      'setCustomerTags'
    ]) {
      expect(customerTagSource).toContain(`tagContracts.${contractKey}`)
    }
  })

  it('wires conversation index health/info responses through conversationContracts', () => {
    const sources = read('src/modules/conversations/handlers/index.ts')

    expect(sources).toContain('conversationContracts')
    expect(sources).toContain('contractJson')
  })

  it('wires conversation stats response through conversationContracts', () => {
    const source = read('src/modules/conversations/handlers/conversation-queries.ts')

    expect(source).toContain('conversationContracts.stats')
    expect(source).toContain('contractJson')
  })

  it('wires existing conversation message routes through conversationMessageContracts', () => {
    const source = read('src/modules/conversations/handlers/conversation-messages.ts')

    expect(source).toContain('conversationMessageContracts')
    expect(source).toContain('contractJson')
    for (const contractKey of [
      'list',
      'listPaginated',
      'send',
      'uploadAttachment',
      'markAllAsRead',
      'markMessageAsRead',
      'recall',
      'get',
      'edit',
      'search'
    ]) {
      expect(source).toContain(`conversationMessageContracts.${contractKey}`)
    }
  })

  it('keeps adopted conversation message routes on their route-level contracts', () => {
    const source = read('src/modules/conversations/handlers/conversation-messages.ts')
    const routes = [
      ['post', '/:id/attachments', ['uploadAttachment']],
      ['post', '/:id/messages', ['send']],
      ['put', '/:id/messages/read', ['markAllAsRead']],
      ['put', '/:id/messages/:messageId/read', ['markMessageAsRead']],
      ['get', '/:id/messages/search', ['search']],
      ['get', '/:id/messages/:messageId', ['get']],
      ['put', '/:id/messages/:messageId', ['edit']],
      ['delete', '/:id/messages/:messageId', ['recall']],
      ['get', '/:id/messages', ['list', 'listPaginated']]
    ] as const

    for (const [method, route, contractKeys] of routes) {
      const block = routeBlock(source, 'conversationMessagesHandler', method, route)

      for (const contractKey of contractKeys) {
        expect(block).toContain(`conversationMessageContracts.${contractKey}`)
      }

      expect(block).not.toMatch(/return\s+c\.json\s*\(\s*\{\s*success\s*:\s*true/)
    }
  })

  it('wires activity handler responses through activityContracts', () => {
    const source = read('src/modules/activities/handlers/ActivityHandler.ts')

    expect(source).toContain('activityContracts')
    expect(source).toContain('contractJson')
    for (const contractKey of ['list', 'getUserStats', 'getOverview', 'cleanup']) {
      expect(source).toContain(`activityContracts.${contractKey}`)
    }
  })

  it('wires channel handler responses through channelContracts', () => {
    const source = read('src/modules/integrations/handlers/channel-handler.ts')

    expect(source).toContain('channelContracts')
    expect(source).toContain('contractJson')
    for (const contractKey of [
      'list',
      'create',
      'get',
      'update',
      'delete',
      'verify',
      'getStats',
      'checkHealth'
    ]) {
      expect(source).toContain(`channelContracts.${contractKey}`)
    }
  })

  it('wires auto-reply handlers through autoReplyContracts', () => {
    const ruleSource = read('src/modules/auto-reply/handlers/auto-reply-rules.ts')
    const scheduleSource = read('src/modules/auto-reply/handlers/auto-reply-schedules.ts')
    const logSource = read('src/modules/auto-reply/handlers/auto-reply-logs.ts')

    for (const source of [ruleSource, scheduleSource, logSource]) {
      expect(source).toContain('autoReplyContracts')
      expect(source).toContain('contractJson')
    }

    for (const contractKey of ['getRules', 'createRule', 'updateRule', 'deleteRule']) {
      expect(ruleSource).toContain(`autoReplyContracts.${contractKey}`)
    }
    for (const contractKey of ['getSchedules', 'saveSchedules']) {
      expect(scheduleSource).toContain(`autoReplyContracts.${contractKey}`)
    }
    expect(logSource).toContain('autoReplyContracts.getLogs')
  })

  it('wires delayed-message v2 handler through delayedMessagesV2Contracts', () => {
    const source = read('src/modules/delayed-message/handlers/delayed-message-buffer.ts')

    expect(source).toContain('delayedMessagesV2Contracts')
    expect(source).toContain('contractJson')
    for (const contractKey of ['send', 'cancel', 'status', 'pending', 'health']) {
      expect(source).toContain(`delayedMessagesV2Contracts.${contractKey}`)
    }
  })

  it('wires messaging export helper routes through exportContracts', () => {
    const source = read('src/modules/messaging/handlers/messaging/routes/export.ts')

    expect(source).toContain('exportContracts')
    expect(source).toContain('contractJson')
    for (const contractKey of ['count', 'agents']) {
      expect(source).toContain(`exportContracts.${contractKey}`)
    }
  })

  it('wires legacy messaging routes through messageContracts', () => {
    const bulkSource = read('src/modules/messaging/handlers/messaging/routes/bulk.ts')
    const crudSource = read('src/modules/messaging/handlers/messaging/routes/crud.ts')

    for (const source of [bulkSource, crudSource]) {
      expect(source).toContain('messageContracts')
      expect(source).toContain('contractJson')
    }

    for (const contractKey of [
      'getMessageDetails',
      'bulkCreate',
      'bulkDelete'
    ]) {
      expect([bulkSource, crudSource].join('\n')).toContain(`messageContracts.${contractKey}`)
    }
  })

  it('wires team handlers through teamContracts and teamMembershipContracts', () => {
    const membersSource = read('src/modules/teams/handlers/members.ts')
    const agentTeamsSource = read('src/modules/teams/handlers/agent-teams.ts')
    const teamCrudSource = read('src/modules/teams/handlers/team-crud.ts')
    const teamMembersSource = read('src/modules/teams/handlers/team-members.ts')
    const teamQrSource = read('src/modules/teams/handlers/team-qr.ts')
    const passwordSource = read('src/modules/teams/handlers/password.ts')

    for (const source of [
      membersSource,
      teamCrudSource,
      teamMembersSource,
      teamQrSource,
      passwordSource
    ]) {
      expect(source).toContain('teamContracts')
      expect(source).toContain('contractJson')
    }

    for (const contractKey of [
      'getMembers',
      'checkEmail',
      'addMember',
      'removeMember',
      'bulkDeleteMembers',
      'bulkUpdateMembers',
      'batchEditMembers',
      'undoBatchEdit',
      'updateMemberRole',
      'updateMemberStatus',
      'updateMember',
      'getTeamStats',
      'getTeams',
      'createTeam',
      'updateTeam',
      'deleteTeam',
      'getTeamDetail',
      'getTeamStatsByTeam',
      'getTeamMembersByTeam',
      'generateLiffQR',
      'getLiffQRCode',
      'getLiffQRStats',
      'bulkRemoveMembersFromTeam',
      'batchAddMembersToTeam',
      'resetPasswordWithPolicy'
    ]) {
      expect([
        membersSource,
        teamCrudSource,
        teamMembersSource,
        teamQrSource,
        passwordSource
      ].join('\n')).toContain(`teamContracts.${contractKey}`)
    }

    expect(agentTeamsSource).toContain('teamMembershipContracts')
    expect(agentTeamsSource).toContain('contractJson')
    for (const contractKey of [
      'getAgentTeams',
      'joinTeam',
      'joinMultipleTeams',
      'leaveTeam',
      'updateAgentTeamRole',
      'setPrimaryTeam',
      'getTeamMembersWithTeams'
    ]) {
      expect(agentTeamsSource).toContain(`teamMembershipContracts.${contractKey}`)
    }
  })

  it('does not expose stale or unsafe team password contracts', () => {
    const contractsSource = read('shared/api-contracts/teams.ts')
    const teamApiSource = read('frontend/src/api/team.ts')
    const teamStoreSource = read('frontend/src/stores/team.ts')

    for (const source of [contractsSource, teamApiSource, teamStoreSource]) {
      expect(source).not.toContain('getMemberPassword')
      expect(source).not.toContain('migratePasswords')
      expect(source).not.toContain('resetPassword:')
    }

    expect(contractsSource).toContain('resetPasswordWithPolicy')
    expect(teamApiSource).toContain('teamContracts.resetPasswordWithPolicy')
    expect(teamStoreSource).toContain('resetPasswordWithPolicy')
  })
})
