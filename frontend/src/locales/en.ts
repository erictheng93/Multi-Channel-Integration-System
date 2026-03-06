// English language pack
export default {
  // Common
  common: {
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    search: 'Search',
    loading: 'Loading...',
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Information',
    yes: 'Yes',
    no: 'No',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    close: 'Close',
    refresh: 'Refresh',
    saving: 'Saving...',
    testing: 'Testing...',
    testConnection: 'Test Connection',
    clearCredentials: 'Clear Credentials'
  },

  // Login page
  login: {
    title: 'Login',
    subtitle: 'Welcome back',
    email: 'Email',
    password: 'Password',
    loginButton: 'Login',
    forgotPassword: 'Forgot password?',
    noAccount: "Don't have an account?",
    register: 'Register',
    emailPlaceholder: 'Enter your email',
    passwordPlaceholder: 'Enter your password',
    loginSuccess: 'Login successful',
    loginFailed: 'Login failed',
    invalidCredentials: 'Invalid email or password',
    networkError: 'Network error, please try again later'
  },

  // Dashboard
  dashboard: {
    title: 'Dashboard',
    welcome: 'Welcome back',
    overview: 'Overview',
    statistics: 'Statistics',
    recentActivity: 'Recent Activity',
    quickActions: 'Quick Actions',
    
    // Statistics cards
    stats: {
      totalConversations: 'Total Conversations',
      activeConversations: 'Active Conversations',
      totalMessages: 'Total Messages',
      responseTime: 'Avg Response Time',
      onlineAgents: 'Online Agents',
      systemStatus: 'System Status'
    },

    // Status
    status: {
      online: 'Online',
      offline: 'Offline',
      running: 'Running',
      stopped: 'Stopped',
      healthy: 'Healthy',
      unhealthy: 'Unhealthy'
    },

    // Time format
    time: {
      minutesAgo: '{count} minutes ago',
      hoursAgo: '{count} hours ago',
      daysAgo: '{count} days ago',
      justNow: 'Just now'
    }
  },

  // System Settings
  systemSettings: {
    title: 'System Settings',
    subtitle: 'Manage system configuration and platform integrations',
    
    // Navigation tabs
    tabs: {
      general: 'General Settings',
      integrations: 'Platform Integrations',
      advanced: 'Advanced Settings',
      system: 'System Management'
    },

    // General settings
    general: {
      title: 'General Settings',
      systemName: 'System Name',
      contactEmail: 'Contact Email',
      timezone: 'Timezone',
      language: 'Language',
      systemNamePlaceholder: 'Multi-Channel Support',
      contactEmailPlaceholder: 'admin@example.com'
    },

    // Platform integrations
    integrations: {
      title: 'Platform Integrations',
      line: {
        title: 'LINE Official Account',
        description: 'Configure LINE Messaging API credentials to receive and reply to customer messages',
        channelId: 'Channel ID',
        channelSecret: 'Channel Secret',
        accessToken: 'Access Token',
        channelIdPlaceholder: 'Enter LINE Channel ID',
        channelSecretPlaceholder: 'Enter LINE Channel Secret',
        accessTokenPlaceholder: 'Enter LINE Access Token'
      },
      facebook: {
        title: 'Facebook Messenger',
        description: 'Configure Facebook Messenger platform credentials to receive and reply to customer messages',
        appId: 'App ID',
        appSecret: 'App Secret',
        pageId: 'Page ID',
        pageToken: 'Page Token',
        appIdPlaceholder: 'Enter Facebook App ID',
        appSecretPlaceholder: 'Enter Facebook App Secret',
        pageIdPlaceholder: 'Enter Facebook Page ID',
        pageTokenPlaceholder: 'Enter Facebook Page Token'
      },
      status: {
        connected: 'Connected',
        disconnected: 'Disconnected',
        error: 'Error'
      },
      testConnection: 'Test Connection',
      testing: 'Testing...'
    },

    // Advanced settings
    advanced: {
      title: 'Advanced Settings',
      messageQueueSize: 'Message Queue Size',
      messageTimeout: 'Message Timeout (seconds)',
      cacheExpiry: 'Cache Expiry (minutes)',
      sessionExpiry: 'Session Expiry (hours)',
      enableRateLimit: 'Enable Rate Limiting',
      enableLogging: 'Enable System Logging',
      enableMetrics: 'Enable Performance Metrics'
    },

    // System management
    systemManagement: {
      title: 'System Management',
      database: {
        title: 'Database Management',
        backup: 'Backup Database',
        backuping: 'Backing up...',
        viewBackups: 'View Backups',
        restore: 'Restore'
      },
      cache: {
        title: 'Cache Management',
        clearAll: 'Clear All Cache',
        clearConversations: 'Clear Conversations Cache',
        clearMessages: 'Clear Messages Cache'
      },
      system: {
        title: 'System Control',
        description: 'Check the status of database, cache, queue, and integration services',
        healthCheck: 'Health Check',
        restart: 'Restart System'
      }
    },

    // Messages
    messages: {
      saveSuccess: 'Settings saved successfully',
      saveFailed: 'Failed to save settings',
      saving: 'Saving...',
      testSuccess: 'Connection test successful',
      testFailed: 'Connection test failed',
      backupSuccess: 'Database backup successful',
      backupFailed: 'Database backup failed',
      cacheCleared: 'Cache cleared successfully',
      healthCheckSuccess: 'System health check passed',
      healthCheckFailed: 'System health check failed'
    }
  },

  // Language options
  languages: {
    'zh-TW': '繁體中文',
    'zh-CN': '简体中文',
    'en': 'English'
  }
}