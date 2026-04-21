import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { channelsApi, parseConfig, parseStats, parseWebhookConfig } from '@/api/channels'
import type { ChannelIntegration, ChannelPlatform } from '@/api/channels'
import { ROLES } from '@/constants/roles'
import { useAuthStore } from '@/stores/auth'

export function useChannelManagement() {
  const authStore = useAuthStore()
  const router = useRouter()

  const channels = ref<ChannelIntegration[]>([])
  const isLoading = ref(false)
  const selectedPlatform = ref<ChannelPlatform | null>(null)
  const showConfigDialog = ref(false)
  const showDetailsModal = ref(false)
  const selectedChannel = ref<ChannelIntegration | undefined>(undefined)
  const activeDropdown = ref<number | null>(null)

  const filteredChannels = computed(() => {
    if (selectedPlatform.value === null) {
      return channels.value
    }
    return channels.value.filter(ch => ch.platform === selectedPlatform.value)
  })

  const loadChannels = async () => {
    isLoading.value = true
    try {
      const response = await channelsApi.list()
      if (response.success) {
        channels.value = response.data
      }
    } catch (error) {
      console.error('Failed to load channels:', error)
    } finally {
      isLoading.value = false
    }
  }

  const refreshChannels = () => {
    loadChannels()
  }

  const filterByPlatform = (platform: ChannelPlatform | null) => {
    selectedPlatform.value = platform
  }

  const getChannelCount = (platform: ChannelPlatform): number => {
    return channels.value.filter(ch => ch.platform === platform).length
  }

  const getPlatformIcon = (platform: ChannelPlatform): string => {
    const icons = {
      line: '',
      facebook: '',
      whatsapp: ''
    }
    return icons[platform] || ''
  }

  const getPlatformName = (platform: ChannelPlatform): string => {
    const names = {
      line: 'LINE',
      facebook: 'Facebook',
      whatsapp: 'WhatsApp'
    }
    return names[platform] || platform
  }

  const getChannelId = (channel: ChannelIntegration): string => {
    const config = parseConfig(channel)
    if (channel.platform === 'line') { return config.channelId || 'N/A' }
    if (channel.platform === 'facebook') { return config.pageId || 'N/A' }
    if (channel.platform === 'whatsapp') { return config.phoneNumber || 'N/A' }
    return 'N/A'
  }

  const getWebhookUrl = (channel: ChannelIntegration): string => {
    const webhookCfg = parseWebhookConfig(channel)
    return webhookCfg.url || ''
  }

  const getStats = (channel: ChannelIntegration) => {
    return parseStats(channel)
  }

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-TW')
  }

  const openAddChannelDialog = () => {
    selectedChannel.value = undefined
    showConfigDialog.value = true
  }

  const closeConfigDialog = () => {
    showConfigDialog.value = false
    selectedChannel.value = undefined
  }

  const handleChannelCreated = (channel: ChannelIntegration) => {
    channels.value.unshift(channel)
    setTimeout(() => {
      closeConfigDialog()
    }, 2000)
  }

  const toggleDropdown = (channelId: number) => {
    activeDropdown.value = activeDropdown.value === channelId ? null : channelId
  }

  const viewChannelDetails = (channel: ChannelIntegration) => {
    selectedChannel.value = channel
    showDetailsModal.value = true
    activeDropdown.value = null
  }

  const toggleChannelStatus = async (channel: ChannelIntegration) => {
    try {
      await channelsApi.update(channel.id, {
        isActive: !channel.isActive
      })
      channel.isActive = !channel.isActive
    } catch (error) {
      console.error('Failed to toggle channel status:', error)
    }
  }

  const verifyChannel = async (channel: ChannelIntegration) => {
    activeDropdown.value = null
    try {
      const response = await channelsApi.verify(channel.id)
      if (response.verified) {
        window.alert('頻道驗證成功！')
        channel.isVerified = true
      } else {
        window.alert(`驗證失敗：${response.message}`)
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : '未知錯誤'
      window.alert(`驗證錯誤：${errorMsg}`)
    }
  }

  const viewStats = async (channel: ChannelIntegration) => {
    activeDropdown.value = null
    try {
      const response = await channelsApi.getStats(channel.id)
      if (response.success && response.data) {
        window.alert(`統計資料：\n發送：${response.data.totalMessagesSent}\n接收：${response.data.totalMessagesReceived}`)
      }
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const editChannel = (channel: ChannelIntegration) => {
    selectedChannel.value = channel
    showConfigDialog.value = true
    activeDropdown.value = null
  }

  const deleteChannel = async (channel: ChannelIntegration) => {
    activeDropdown.value = null
    if (!window.confirm(`確定要刪除頻道「${getPlatformName(channel.platform)}」嗎？`)) {
      return
    }

    try {
      await channelsApi.delete(channel.id)
      channels.value = channels.value.filter(ch => ch.id !== channel.id)
    } catch (error) {
      console.error('Failed to delete channel:', error)
      window.alert('刪除失敗')
    }
  }

  const copyWebhookUrl = async (channel: ChannelIntegration) => {
    const url = getWebhookUrl(channel)
    if (!url) {
      window.alert('Webhook URL 不可用')
      return
    }

    try {
      await navigator.clipboard.writeText(url)
      window.alert('Webhook URL 已複製到剪貼簿')
    } catch (error) {
      console.error('Failed to copy webhook URL:', error)
    }
  }

  const closeDropdown = () => {
    activeDropdown.value = null
  }

  onMounted(() => {
    if (authStore.currentAgent?.role !== ROLES.ADMIN) {
      router.push('/conversations')
      return
    }
    loadChannels()

    if (typeof document !== 'undefined') {
      document.addEventListener('click', closeDropdown)
    }
  })

  onBeforeUnmount(() => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', closeDropdown)
    }
  })

  return {
    activeDropdown,
    channels,
    closeConfigDialog,
    copyWebhookUrl,
    deleteChannel,
    editChannel,
    filterByPlatform,
    filteredChannels,
    formatDate,
    getChannelCount,
    getChannelId,
    getPlatformIcon,
    getPlatformName,
    getStats,
    getWebhookUrl,
    handleChannelCreated,
    isLoading,
    openAddChannelDialog,
    refreshChannels,
    selectedChannel,
    selectedPlatform,
    showConfigDialog,
    showDetailsModal,
    toggleChannelStatus,
    toggleDropdown,
    verifyChannel,
    viewChannelDetails,
    viewStats
  }
}
