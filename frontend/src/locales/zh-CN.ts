// 简体中文语言包
export default {
  // 通用
  common: {
    save: '保存',
    cancel: '取消',
    confirm: '确认',
    delete: '删除',
    edit: '编辑',
    add: '新增',
    search: '搜索',
    loading: '加载中...',
    success: '成功',
    error: '错误',
    warning: '警告',
    info: '信息',
    yes: '是',
    no: '否',
    back: '返回',
    next: '下一步',
    previous: '上一步',
    close: '关闭',
    refresh: '刷新'
  },

  // 登录页面
  login: {
    title: '登录',
    subtitle: '欢迎回来',
    email: '电子邮箱',
    password: '密码',
    loginButton: '登录',
    forgotPassword: '忘记密码？',
    noAccount: '还没有账号？',
    register: '注册',
    emailPlaceholder: '请输入您的电子邮箱',
    passwordPlaceholder: '请输入您的密码',
    loginSuccess: '登录成功',
    loginFailed: '登录失败',
    invalidCredentials: '电子邮箱或密码错误',
    networkError: '网络连接错误，请稍后再试'
  },

  // 仪表板
  dashboard: {
    title: '仪表板',
    welcome: '欢迎回来',
    overview: '总览',
    statistics: '统计数据',
    recentActivity: '最近活动',
    quickActions: '快速操作',
    
    // 统计卡片
    stats: {
      totalConversations: '总对话数',
      activeConversations: '进行中对话',
      totalMessages: '总消息数',
      responseTime: '平均响应时间',
      onlineAgents: '在线客服',
      systemStatus: '系统状态'
    },

    // 状态
    status: {
      online: '在线',
      offline: '离线',
      running: '运行中',
      stopped: '已停止',
      healthy: '正常',
      unhealthy: '异常'
    },

    // 时间格式
    time: {
      minutesAgo: '{count} 分钟前',
      hoursAgo: '{count} 小时前',
      daysAgo: '{count} 天前',
      justNow: '刚刚'
    }
  },

  // 系统设置
  systemSettings: {
    title: '系统设置',
    subtitle: '管理系统配置和平台集成设置',
    
    // 导航标签
    tabs: {
      general: '常规设置',
      integrations: '平台集成',
      advanced: '高级设置',
      system: '系统管理'
    },

    // 常规设置
    general: {
      title: '常规设置',
      systemName: '系统名称',
      contactEmail: '联系邮箱',
      timezone: '时区',
      language: '语言',
      systemNamePlaceholder: 'Multi-Channel Support',
      contactEmailPlaceholder: 'admin@example.com'
    },

    // 平台集成
    integrations: {
      title: '平台集成',
      line: {
        title: 'LINE Official Account',
        channelId: 'Channel ID',
        channelSecret: 'Channel Secret',
        accessToken: 'Access Token',
        channelIdPlaceholder: '输入 LINE Channel ID',
        channelSecretPlaceholder: '输入 LINE Channel Secret',
        accessTokenPlaceholder: '输入 LINE Access Token'
      },
      facebook: {
        title: 'Facebook Messenger',
        appId: 'App ID',
        appSecret: 'App Secret',
        pageId: 'Page ID',
        pageToken: 'Page Token',
        appIdPlaceholder: '输入 Facebook App ID',
        appSecretPlaceholder: '输入 Facebook App Secret',
        pageIdPlaceholder: '输入 Facebook Page ID',
        pageTokenPlaceholder: '输入 Facebook Page Token'
      },
      status: {
        connected: '已连接',
        disconnected: '未连接',
        error: '错误'
      },
      testConnection: '测试连接',
      testing: '测试中...'
    },

    // 高级设置
    advanced: {
      title: '高级设置',
      messageQueueSize: '消息队列大小',
      messageTimeout: '消息超时 (秒)',
      cacheExpiry: '缓存过期时间 (分钟)',
      sessionExpiry: '会话过期时间 (小时)',
      enableRateLimit: '启用速率限制',
      enableLogging: '启用系统日志',
      enableMetrics: '启用性能监控'
    },

    // 系统管理
    systemManagement: {
      title: '系统管理',
      database: {
        title: '数据库管理',
        backup: '备份数据库',
        backuping: '备份中...',
        viewBackups: '查看备份',
        restore: '恢复'
      },
      cache: {
        title: '缓存管理',
        clearAll: '清除所有缓存',
        clearConversations: '清除对话缓存',
        clearMessages: '清除消息缓存'
      },
      system: {
        title: '系统控制',
        healthCheck: '健康检查',
        restart: '重启系统'
      }
    },

    // 消息
    messages: {
      saveSuccess: '设置已保存',
      saveFailed: '保存设置失败',
      saving: '保存中...',
      testSuccess: '连接测试成功',
      testFailed: '连接测试失败',
      backupSuccess: '数据库备份成功',
      backupFailed: '数据库备份失败',
      cacheCleared: '缓存清除成功',
      healthCheckSuccess: '系统健康检查正常',
      healthCheckFailed: '系统健康检查异常'
    }
  },

  // 语言选项
  languages: {
    'zh-TW': '繁體中文',
    'zh-CN': '简体中文',
    'en': 'English'
  }
}