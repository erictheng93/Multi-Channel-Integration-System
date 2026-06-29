// System settings and management handlers
// getSystemInfo, getSettings, updateSettings, getMetrics

import { Context } from 'hono'
import type { Bindings } from '@/types'
import {
  successResponse,
  forbiddenResponse,
  handleApiError
} from '@/utils/api-response'
import { ActivityService, ACTIVITY_ACTIONS, RESOURCE_TYPES } from '@modules/activities'
import { createDbClient } from '@/db/drizzle-factory'
import { gte, count } from 'drizzle-orm'
import { systemSettings, agents, conversations, messages } from '@/db/schema'
import { nowISO } from '@/utils/timestamp'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Interface for partial settings update - all properties optional
interface SystemSettingsUpdate extends Record<string, unknown> {
  general?: Partial<{
    systemName: string;
    contactEmail: string;
    timezone: string;
    language: string;
  }>;
  integrations?: {
    line?: Partial<{
      channelId: string;
      channelSecret: string;
      accessToken: string;
      status: 'connected' | 'disconnected' | 'error';
    }>;
    facebook?: Partial<{
      appId: string;
      appSecret: string;
      pageId: string;
      pageToken: string;
      status: 'connected' | 'disconnected' | 'error';
    }>;
  };
  advanced?: Partial<{
    messageQueueSize: number;
    messageTimeout: number;
    cacheExpiry: number;
    sessionExpiry: number;
    enableRateLimit: boolean;
    enableLogging: boolean;
    enableMetrics: boolean;
  }>;
}

// Interface for getSettings response - excludes sensitive credentials
interface SystemSettingsResponse extends Record<string, unknown> {
  general?: {
    systemName: string;
    contactEmail: string;
    timezone: string;
    language: string;
  };
  integrations?: {
    line?: {
      status: 'connected' | 'disconnected' | 'error';
    };
    facebook?: {
      status: 'connected' | 'disconnected' | 'error';
    };
  };
  advanced?: {
    messageQueueSize: number;
    messageTimeout: number;
    cacheExpiry: number;
    sessionExpiry: number;
    enableRateLimit: boolean;
    enableLogging: boolean;
    enableMetrics: boolean;
  };
}

// Get system information
export const getSystemInfo = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const systemInfo = {
      version: '1.0.0',
      environment: c.env.ENVIRONMENT || 'development',
      lastUpdate: nowISO(),
      dbStatus: 'online' as const,
      cacheStatus: 'online' as const,
      uptime: Date.now() - (Date.now() - 86400000)
    }

    return successResponse(c, systemInfo, 'System information retrieved successfully')
  } catch (error) {
    return handleApiError(error, c)
  }
}

// Get system settings
export const getSettings = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const drizzleDb = createDbClient(c.env.DB)

    const settingsResult = await drizzleDb
      .select({
        key: systemSettings.key,
        value: systemSettings.value
      })
      .from(systemSettings)

    const settings: SystemSettingsResponse = {
      general: {
        systemName: 'Multi-Channel Support',
        contactEmail: 'admin@example.com',
        timezone: 'Asia/Taipei',
        language: 'zh-TW'
      },
      integrations: {
        line: {
          status: 'disconnected'
        },
        facebook: {
          status: 'disconnected'
        }
      },
      advanced: {
        messageQueueSize: 1000,
        messageTimeout: 30,
        cacheExpiry: 60,
        sessionExpiry: 24,
        enableRateLimit: true,
        enableLogging: true,
        enableMetrics: true
      }
    }

    // Override with database settings
    settingsResult.forEach(row => {
      const keys = row.key.split('.')
      let current: Record<string, unknown> = settings

      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (key && !isRecord(current[key])) current[key] = {}
        if (key && isRecord(current[key])) current = current[key]
      }

      const lastKey = keys[keys.length - 1]
      if (lastKey) {
        try {
          current[lastKey] = JSON.parse(row.value)
        } catch {
          current[lastKey] = row.value
        }
      }
    })

    return successResponse(c, settings, 'Settings retrieved successfully')
  } catch (error) {
    return handleApiError(error, c)
  }
}

// Update system settings
export const updateSettings = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const payload = c.get('jwtPayload')
    if (!payload || payload.role !== 'admin') {
      return forbiddenResponse(c, 'Admin role required')
    }

    const drizzleDb = createDbClient(c.env.DB)
    const settings = await c.req.json<SystemSettingsUpdate>()

    // Flatten settings for database storage
    const flattenSettings = (obj: Record<string, unknown>, prefix = ''): Array<{ key: string; value: string }> => {
      const result: Array<{ key: string; value: string }> = []

      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          result.push(...flattenSettings(value as Record<string, unknown>, fullKey))
        } else {
          result.push({
            key: fullKey,
            value: typeof value === 'string' ? value : JSON.stringify(value)
          })
        }
      }

      return result
    }

    const flatSettings = flattenSettings(settings)

    if (flatSettings.length === 0) {
      return successResponse(c, null, 'No settings to update')
    }

    // Update settings using upsert
    for (const { key, value } of flatSettings) {
      await drizzleDb
        .insert(systemSettings)
        .values({
          key,
          value,
          updatedAt: nowISO()
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: {
            value,
            updatedAt: nowISO()
          }
        })
    }

    // Log settings update activity
    if (payload) {
      const activityService = new ActivityService(c.env.DB);
      await activityService.logActivity({
        userId: payload.userId.toString(),
        userName: payload.username || 'Admin',
        userRole: payload.role,
        action: ACTIVITY_ACTIONS.SETTINGS_UPDATE,
        resourceType: RESOURCE_TYPES.SYSTEM,
        details: {
          updatedSettings: flatSettings.reduce((acc, { key, value }) => {
            acc[key] = value;
            return acc;
          }, {} as Record<string, string>),
          settingsCount: flatSettings.length
        },
        ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
        userAgent: c.req.header('User-Agent')
      });
    }

    return successResponse(c, null, 'Settings updated successfully')
  } catch (error) {
    return handleApiError(error, c)
  }
}

// Get system metrics
export const getMetrics = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const drizzleDb = createDbClient(c.env.DB)

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const [activeUsers, totalConversations, messagesToday] = await Promise.all([
      drizzleDb.select({ count: count() }).from(agents).where(gte(agents.lastLoginAt, oneHourAgo)),
      drizzleDb.select({ count: count() }).from(conversations),
      drizzleDb.select({ count: count() }).from(messages)
    ])

    const metrics = {
      activeUsers: activeUsers[0]?.count || 0,
      totalConversations: totalConversations[0]?.count || 0,
      messagesToday: messagesToday[0]?.count || 0,
      averageResponseTime: 120,
      systemLoad: 0.45,
      errorRate: 0.02
    }

    return successResponse(c, metrics, 'System metrics retrieved successfully')
  } catch (error) {
    return handleApiError(error, c)
  }
}
