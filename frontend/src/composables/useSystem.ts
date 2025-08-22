// 現代化系統管理 Composable
import { computed } from 'vue'
import { useSystemStore } from '@/stores/system'
import { useAsyncData } from './useAsyncData'
import { useError } from './useError'
import type { SystemSettings } from '@/types'

export function useSystem() {
  const systemStore = useSystemStore()
  const { error, handleError, clearError } = useError()

  // 異步數據 - 系統設定
  const {
    data: settings,
    pending: settingsLoading,
    execute: fetchSettings,
    refresh: refreshSettings
  } = useAsyncData(
    'system-settings',
    () => systemStore.loadSettings(),
    {
      immediate: true,
      transform: () => systemStore.settings
    }
  )

  // 異步數據 - 系統統計
  const {
    data: stats,
    pending: statsLoading,
    execute: fetchStats,
    refresh: refreshStats
  } = useAsyncData(
    'system-stats',
    () => systemStore.loadStats(),
    {
      immediate: true,
      transform: () => systemStore.stats
    }
  )

  const loading = computed(() => 
    settingsLoading.value || statsLoading.value
  )

  // 方法
  const updateSettings = async (newSettings: Partial<SystemSettings>) => {
    clearError()
    try {
      await systemStore.saveSettings(newSettings)
      await refreshSettings()
      return true
    } catch (err) {
      handleError(err)
      return false
    }
  }

  const updateTheme = async (theme: SystemSettings['theme']) => {
    clearError()
    try {
      await systemStore.updateTheme(theme)
      await refreshSettings()
      return true
    } catch (err) {
      handleError(err)
      return false
    }
  }

  const updateLanguage = async (language: SystemSettings['language']) => {
    clearError()
    try {
      await systemStore.updateLanguage(language)
      await refreshSettings()
      return true
    } catch (err) {
      handleError(err)
      return false
    }
  }

  const resetSettings = async () => {
    clearError()
    try {
      await systemStore.resetSettings()
      await refreshSettings()
      return true
    } catch (err) {
      handleError(err)
      return false
    }
  }

  return {
    // 數據
    settings,
    stats,
    loading,
    error,

    // 方法
    fetchSettings,
    refreshSettings,
    fetchStats,
    refreshStats,
    updateSettings,
    updateTheme,
    updateLanguage,
    resetSettings,
    clearError
  }
}