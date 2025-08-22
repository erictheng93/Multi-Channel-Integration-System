# Terraform 變數定義
# 用戶需要提供的配置參數

# Cloudflare 配置
variable "cloudflare_account_id" {
  description = "Cloudflare 帳戶 ID"
  type        = string
  default     = ""
}

variable "zone_id" {
  description = "Cloudflare Zone ID (如果使用自定義域名)"
  type        = string
  default     = ""
}

# 專案配置
variable "project_name" {
  description = "專案名稱 (將用作資源前綴)"
  type        = string
  default     = "multi-channel-platform"
  
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "專案名稱只能包含小寫字母、數字和連字符。"
  }
}

variable "environment" {
  description = "部署環境"
  type        = string
  default     = "production"
  
  validation {
    condition     = contains(["development", "production"], var.environment)
    error_message = "環境必須是 development 或 production 之一。"
  }
}

# LINE Bot 配置
variable "line_channel_access_token" {
  description = "LINE Channel Access Token"
  type        = string
  sensitive   = true
  
  validation {
    condition     = length(var.line_channel_access_token) > 0
    error_message = "LINE Channel Access Token 不能為空。"
  }
}

variable "line_channel_secret" {
  description = "LINE Channel Secret"
  type        = string
  sensitive   = true
  
  validation {
    condition     = length(var.line_channel_secret) > 0
    error_message = "LINE Channel Secret 不能為空。"
  }
}

# Facebook Messenger 配置 (可選)
variable "facebook_page_access_token" {
  description = "Facebook Page Access Token (可選)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "facebook_app_secret" {
  description = "Facebook App Secret (可選)"
  type        = string
  default     = ""
  sensitive   = true
}

# 管理員帳戶配置
variable "admin_email" {
  description = "管理員電子郵件"
  type        = string
  
  validation {
    condition     = can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.admin_email))
    error_message = "請提供有效的電子郵件地址。"
  }
}

variable "admin_password" {
  description = "管理員密碼 (至少 8 個字符)"
  type        = string
  sensitive   = true
  
  validation {
    condition     = length(var.admin_password) >= 8
    error_message = "管理員密碼至少需要 8 個字符。"
  }
}

# 域名配置 (可選)
variable "custom_domain" {
  description = "自定義域名 (可選，例如: api.yourdomain.com)"
  type        = string
  default     = ""
}

variable "frontend_custom_domain" {
  description = "前端自定義域名 (可選，例如: app.yourdomain.com)"
  type        = string
  default     = ""
}

# R2 存儲配置
variable "r2_location" {
  description = "R2 存儲桶位置"
  type        = string
  default     = "APAC"
  
  validation {
    condition     = contains(["WNAM", "ENAM", "WEUR", "EEUR", "APAC"], var.r2_location)
    error_message = "R2 位置必須是 WNAM、ENAM、WEUR、EEUR 或 APAC 之一。"
  }
}

# 功能開關
variable "enable_facebook_integration" {
  description = "是否啟用 Facebook Messenger 整合"
  type        = bool
  default     = false
}

variable "enable_advanced_features" {
  description = "是否啟用進階功能 (WebSocket、Durable Objects)"
  type        = bool
  default     = true
}

# 資源配置
variable "worker_cpu_limit" {
  description = "Worker CPU 限制 (毫秒)"
  type        = number
  default     = 50
}

variable "worker_memory_limit" {
  description = "Worker 記憶體限制 (MB)"
  type        = number
  default     = 128
}