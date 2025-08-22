// 繁體中文語言包
export default {
  // 通用
  common: {
    save: '儲存',
    cancel: '取消',
    confirm: '確認',
    delete: '刪除',
    edit: '編輯',
    add: '新增',
    search: '搜尋',
    loading: '載入中...',
    success: '成功',
    error: '錯誤',
    warning: '警告',
    info: '資訊',
    yes: '是',
    no: '否',
    back: '返回',
    next: '下一步',
    previous: '上一步',
    close: '關閉',
    refresh: '重新整理'
  },

  // 登入頁面
  login: {
    title: '登入',
    subtitle: '歡迎回來',
    email: '電子郵件',
    password: '密碼',
    loginButton: '登入',
    forgotPassword: '忘記密碼？',
    noAccount: '還沒有帳號？',
    register: '註冊',
    emailPlaceholder: '請輸入您的電子郵件',
    passwordPlaceholder: '請輸入您的密碼',
    loginSuccess: '登入成功',
    loginFailed: '登入失敗',
    invalidCredentials: '電子郵件或密碼錯誤',
    networkError: '網路連接錯誤，請稍後再試'
  },

  // 儀表板
  dashboard: {
    title: '儀表板',
    welcome: '歡迎回來',
    overview: '總覽',
    statistics: '統計資料',
    recentActivity: '最近活動',
    quickActions: '快速操作',
    
    // 統計卡片
    stats: {
      totalConversations: '總對話數',
      activeConversations: '進行中對話',
      totalMessages: '總訊息數',
      responseTime: '平均回應時間',
      onlineAgents: '線上客服',
      systemStatus: '系統狀態'
    },

    // 狀態
    status: {
      online: '線上',
      offline: '離線',
      running: '運行中',
      stopped: '已停止',
      healthy: '正常',
      unhealthy: '異常'
    },

    // 時間格式
    time: {
      minutesAgo: '{count} 分鐘前',
      hoursAgo: '{count} 小時前',
      daysAgo: '{count} 天前',
      justNow: '剛剛'
    }
  },

  // 系統設定
  systemSettings: {
    title: '系統設定',
    subtitle: '管理系統配置和平台整合設定',
    
    // 導航標籤
    tabs: {
      general: '一般設定',
      integrations: '平台整合',
      advanced: '進階設定',
      system: '系統管理'
    },

    // 一般設定
    general: {
      title: '一般設定',
      systemName: '系統名稱',
      contactEmail: '聯絡信箱',
      timezone: '時區',
      language: '語言',
      systemNamePlaceholder: 'Multi-Channel Support',
      contactEmailPlaceholder: 'admin@example.com'
    },

    // 平台整合
    integrations: {
      title: '平台整合',
      line: {
        title: 'LINE Official Account',
        channelId: 'Channel ID',
        channelSecret: 'Channel Secret',
        accessToken: 'Access Token',
        channelIdPlaceholder: '輸入 LINE Channel ID',
        channelSecretPlaceholder: '輸入 LINE Channel Secret',
        accessTokenPlaceholder: '輸入 LINE Access Token'
      },
      facebook: {
        title: 'Facebook Messenger',
        appId: 'App ID',
        appSecret: 'App Secret',
        pageId: 'Page ID',
        pageToken: 'Page Token',
        appIdPlaceholder: '輸入 Facebook App ID',
        appSecretPlaceholder: '輸入 Facebook App Secret',
        pageIdPlaceholder: '輸入 Facebook Page ID',
        pageTokenPlaceholder: '輸入 Facebook Page Token'
      },
      status: {
        connected: '已連線',
        disconnected: '未連線',
        error: '錯誤'
      },
      testConnection: '測試連線',
      testing: '測試中...'
    },

    // 進階設定
    advanced: {
      title: '進階設定',
      messageQueueSize: '訊息佇列大小',
      messageTimeout: '訊息逾時 (秒)',
      cacheExpiry: '快取過期時間 (分鐘)',
      sessionExpiry: '會話過期時間 (小時)',
      enableRateLimit: '啟用速率限制',
      enableLogging: '啟用系統日誌',
      enableMetrics: '啟用效能監控'
    },

    // 系統管理
    systemManagement: {
      title: '系統管理',
      database: {
        title: '資料庫管理',
        backup: '備份資料庫',
        backuping: '備份中...',
        viewBackups: '查看備份',
        restore: '恢復'
      },
      cache: {
        title: '快取管理',
        clearAll: '清除所有快取',
        clearConversations: '清除對話快取',
        clearMessages: '清除訊息快取'
      },
      system: {
        title: '系統控制',
        healthCheck: '健康檢查',
        restart: '重啟系統'
      }
    },

    // 訊息
    messages: {
      saveSuccess: '設定已儲存',
      saveFailed: '儲存設定失敗',
      saving: '儲存中...',
      testSuccess: '連線測試成功',
      testFailed: '連線測試失敗',
      backupSuccess: '資料庫備份成功',
      backupFailed: '資料庫備份失敗',
      cacheCleared: '快取清除成功',
      healthCheckSuccess: '系統健康檢查正常',
      healthCheckFailed: '系統健康檢查異常'
    }
  },

  // 語言選項
  languages: {
    'zh-TW': '繁體中文',
    'zh-CN': '简体中文',
    'en': 'English'
  }
}