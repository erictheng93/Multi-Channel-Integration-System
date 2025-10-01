// Activities Module - Activity Statistics Service
// 活動模組 - 活動統計分析服務

import { drizzle } from 'drizzle-orm/d1'
import { sql, gte, count, desc } from 'drizzle-orm'
import { activities } from '@/db/schema'
import { ActivityOverview } from '@modules/activities/types/interfaces'
import { ActivityFormatter } from '@modules/activities/utils/formatters'

export class ActivityStatsService {
  constructor(private db: D1Database) {}

  /**
   * 獲取活動統計概覽
   */
  async getOverview(days = 7): Promise<ActivityOverview> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString()

    const drizzleDb = drizzle(this.db)

    // 總活動數
    const totalResult = await drizzleDb
      .select({ count: count() })
      .from(activities)
      .where(gte(activities.createdAt, startDateStr))

    // 按操作類型統計
    const actionStats = await drizzleDb
      .select({
        action: activities.action,
        count: count().as('count')
      })
      .from(activities)
      .where(gte(activities.createdAt, startDateStr))
      .groupBy(activities.action)
      .orderBy(desc(sql`count`))

    // 按用戶統計
    const userStats = await drizzleDb
      .select({
        userName: activities.userName,
        userRole: activities.userRole,
        count: count().as('count')
      })
      .from(activities)
      .where(gte(activities.createdAt, startDateStr))
      .groupBy(activities.userId, activities.userName, activities.userRole)
      .orderBy(desc(sql`count`))
      .limit(10)

    // 按日期統計
    const dailyStats = await drizzleDb
      .select({
        date: sql`DATE(${activities.createdAt})`.as('date'),
        count: count().as('count')
      })
      .from(activities)
      .where(gte(activities.createdAt, startDateStr))
      .groupBy(sql`DATE(${activities.createdAt})`)
      .orderBy(sql`date DESC`)

    return {
      totalActivities: totalResult[0]?.count || 0,
      actionStats: actionStats.reduce((acc: Record<string, number>, row: any) => {
        acc[row.action] = row.count
        return acc
      }, {} as Record<string, number>),
      topUsers: userStats.map((row: any) => ({
        userName: row.userName,
        userRole: row.userRole,
        count: row.count
      })),
      dailyStats: dailyStats.map((row: any) => ({
        date: row.date,
        count: row.count
      })),
      period: {
        days,
        startDate: startDateStr,
        endDate: new Date().toISOString()
      }
    }
  }

  /**
   * 獲取資源類型統計
   */
  async getResourceTypeStats(days = 30): Promise<Array<{
    resourceType: string
    count: number
    percentage: number
    label: string
  }>> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString()

    const drizzleDb = drizzle(this.db)

    const resourceStats = await drizzleDb
      .select({
        resourceType: activities.resourceType,
        count: count().as('count')
      })
      .from(activities)
      .where(gte(activities.createdAt, startDateStr))
      .groupBy(activities.resourceType)
      .orderBy(desc(sql`count`))

    const total = resourceStats.reduce((sum, row) => sum + row.count, 0)

    return resourceStats.map((row: any) => ({
      resourceType: row.resourceType,
      count: row.count,
      percentage: total > 0 ? Math.round((row.count / total) * 100) : 0,
      label: ActivityFormatter.formatResourceType(row.resourceType)
    }))
  }

  /**
   * 獲取用戶角色活動分布
   */
  async getUserRoleStats(days = 30): Promise<Array<{
    userRole: string
    count: number
    percentage: number
    label: string
  }>> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString()

    const drizzleDb = drizzle(this.db)

    const roleStats = await drizzleDb
      .select({
        userRole: activities.userRole,
        count: count().as('count')
      })
      .from(activities)
      .where(gte(activities.createdAt, startDateStr))
      .groupBy(activities.userRole)
      .orderBy(desc(sql`count`))

    const total = roleStats.reduce((sum, row) => sum + row.count, 0)

    return roleStats.map((row: any) => ({
      userRole: row.userRole,
      count: row.count,
      percentage: total > 0 ? Math.round((row.count / total) * 100) : 0,
      label: ActivityFormatter.formatUserRole(row.userRole)
    }))
  }

  /**
   * 獲取活動趨勢數據
   */
  async getActivityTrends(days = 30): Promise<Array<{
    date: string
    count: number
    actions: Record<string, number>
  }>> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString()

    const drizzleDb = drizzle(this.db)

    // 獲取每日總數
    const dailyStats = await drizzleDb
      .select({
        date: sql`DATE(${activities.createdAt})`.as('date'),
        count: count().as('count')
      })
      .from(activities)
      .where(gte(activities.createdAt, startDateStr))
      .groupBy(sql`DATE(${activities.createdAt})`)
      .orderBy(sql`date ASC`)

    // 獲取每日按動作分組的統計
    const dailyActionStats = await drizzleDb.run(sql`
      SELECT
        DATE(created_at) as date,
        action,
        COUNT(*) as count
      FROM activities
      WHERE created_at >= ${startDateStr}
      GROUP BY DATE(created_at), action
      ORDER BY date ASC, count DESC
    `)

    // 組織數據
    const trendsMap: Record<string, {
      date: string
      count: number
      actions: Record<string, number>
    }> = {}

    // 初始化每日總數
    dailyStats.forEach((row: any) => {
      trendsMap[row.date] = {
        date: row.date,
        count: row.count,
        actions: {}
      }
    })

    // 添加每日動作統計
    ;(dailyActionStats.results || []).forEach((row: any) => {
      const dateEntry = trendsMap[row.date];
      if (dateEntry) {
        dateEntry.actions[row.action] = row.count
      }
    })

    return Object.values(trendsMap)
  }

  /**
   * 獲取活動熱力圖數據
   */
  async getActivityHeatmap(days = 30): Promise<Array<{
    date: string
    hour: number
    count: number
    intensity: 'low' | 'medium' | 'high'
  }>> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString()

    const drizzleDb = drizzle(this.db)

    const heatmapData = await drizzleDb.run(sql`
      SELECT
        DATE(created_at) as date,
        CAST(strftime('%H', created_at) AS INTEGER) as hour,
        COUNT(*) as count
      FROM activities
      WHERE created_at >= ${startDateStr}
      GROUP BY DATE(created_at), strftime('%H', created_at)
      ORDER BY date ASC, hour ASC
    `)

    const results = (heatmapData.results || []).map((row: any) => ({
      date: row.date,
      hour: row.hour,
      count: row.count,
      intensity: this.getIntensityLevel(row.count)
    }))

    return results
  }

  /**
   * 獲取性能指標
   */
  async getPerformanceMetrics(days = 7): Promise<{
    avgActivitiesPerDay: number
    peakHour: number
    mostActiveUser: string | null
    mostCommonAction: string | null
    systemLoad: 'low' | 'medium' | 'high'
  }> {
    const overview = await this.getOverview(days)
    const avgActivitiesPerDay = Math.round(overview.totalActivities / days)

    // 獲取峰值小時
    const heatmap = await this.getActivityHeatmap(days)
    const hourStats: Record<number, number> = {}
    heatmap.forEach(item => {
      hourStats[item.hour] = (hourStats[item.hour] || 0) + item.count
    })

    const peakHour = Object.entries(hourStats)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 9

    // 系統負載評估
    const systemLoad = avgActivitiesPerDay > 1000 ? 'high' :
                      avgActivitiesPerDay > 500 ? 'medium' : 'low'

    return {
      avgActivitiesPerDay,
      peakHour: parseInt(peakHour.toString()),
      mostActiveUser: overview.topUsers[0]?.userName || null,
      mostCommonAction: Object.entries(overview.actionStats)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || null,
      systemLoad
    }
  }

  /**
   * 確定活動強度級別
   */
  private getIntensityLevel(count: number): 'low' | 'medium' | 'high' {
    if (count >= 50) return 'high'
    if (count >= 20) return 'medium'
    return 'low'
  }

  /**
   * 獲取自定義時間段統計
   */
  async getCustomPeriodStats(startDate: string, endDate: string): Promise<ActivityOverview> {
    const drizzleDb = drizzle(this.db)

    const totalResult = await drizzleDb
      .select({ count: count() })
      .from(activities)
      .where(
        sql`${activities.createdAt} >= ${startDate} AND ${activities.createdAt} <= ${endDate}`
      )

    const actionStats = await drizzleDb
      .select({
        action: activities.action,
        count: count().as('count')
      })
      .from(activities)
      .where(
        sql`${activities.createdAt} >= ${startDate} AND ${activities.createdAt} <= ${endDate}`
      )
      .groupBy(activities.action)
      .orderBy(desc(sql`count`))

    const userStats = await drizzleDb
      .select({
        userName: activities.userName,
        userRole: activities.userRole,
        count: count().as('count')
      })
      .from(activities)
      .where(
        sql`${activities.createdAt} >= ${startDate} AND ${activities.createdAt} <= ${endDate}`
      )
      .groupBy(activities.userId, activities.userName, activities.userRole)
      .orderBy(desc(sql`count`))
      .limit(10)

    const dailyStats = await drizzleDb
      .select({
        date: sql`DATE(${activities.createdAt})`.as('date'),
        count: count().as('count')
      })
      .from(activities)
      .where(
        sql`${activities.createdAt} >= ${startDate} AND ${activities.createdAt} <= ${endDate}`
      )
      .groupBy(sql`DATE(${activities.createdAt})`)
      .orderBy(sql`date DESC`)

    const start = new Date(startDate)
    const end = new Date(endDate)
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

    return {
      totalActivities: totalResult[0]?.count || 0,
      actionStats: actionStats.reduce((acc: Record<string, number>, row: any) => {
        acc[row.action] = row.count
        return acc
      }, {} as Record<string, number>),
      topUsers: userStats.map((row: any) => ({
        userName: row.userName,
        userRole: row.userRole,
        count: row.count
      })),
      dailyStats: dailyStats.map((row: any) => ({
        date: row.date,
        count: row.count
      })),
      period: {
        days,
        startDate,
        endDate
      }
    }
  }
}