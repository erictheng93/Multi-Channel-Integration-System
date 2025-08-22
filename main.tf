# 多渠道客服系統 - 一鍵部署 Terraform 配置
# 這個配置會自動創建所有必要的 Cloudflare 資源

terraform {
  required_version = ">= 1.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }
}

# Cloudflare Provider 配置
provider "cloudflare" {
  # API Token 將從環境變數 CLOUDFLARE_API_TOKEN 讀取
  # 或者可以在這裡設置，但不建議硬編碼
}

# 隨機密鑰生成
resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}

resource "random_password" "facebook_verify_token" {
  length  = 32
  special = false
}

# 獲取 Cloudflare 帳戶資訊
data "cloudflare_accounts" "main" {}

locals {
  account_id = var.cloudflare_account_id != "" ? var.cloudflare_account_id : data.cloudflare_accounts.main.accounts[0].id
  
  # 環境後綴: production 為空, development 為 -dev
  env_suffix = var.environment == "production" ? "" : "-dev"
  
  # 基礎專案名稱
  base_project_name = var.project_name
}

# D1 資料庫
resource "cloudflare_d1_database" "main" {
  account_id = local.account_id
  name       = "${local.base_project_name}${local.env_suffix}"
}

# R2 存儲桶 - 檔案附件
resource "cloudflare_r2_bucket" "attachments" {
  account_id = local.account_id
  name       = "${local.base_project_name}-attachments${local.env_suffix}"
  location   = var.r2_location
}

# KV 命名空間 - 會話存儲
resource "cloudflare_workers_kv_namespace" "sessions" {
  account_id = local.account_id
  title      = "SESSIONS${local.env_suffix}"
}

# KV 命名空間 - 快取
resource "cloudflare_workers_kv_namespace" "cache" {
  account_id = local.account_id
  title      = "CACHE${local.env_suffix}"
}

# Queues - 訊息佇列
resource "cloudflare_queue" "message_queue" {
  account_id = local.account_id
  name       = "message-queue${local.env_suffix}"
}

resource "cloudflare_queue" "delayed_message_queue" {
  account_id = local.account_id
  name       = "delayed-message-queue${local.env_suffix}"
}

# Workers Script - 主應用
resource "cloudflare_worker_script" "main" {
  account_id = local.account_id
  name       = local.project_name
  content    = file("${path.module}/dist/index.js")
  
  # 環境變數
  plain_text_binding {
    name = "ENVIRONMENT"
    text = var.environment
  }
  
  plain_text_binding {
    name = "PROJECT_NAME"
    text = var.project_name
  }
  
  # 敏感環境變數
  secret_text_binding {
    name = "JWT_SECRET"
    text = random_password.jwt_secret.result
  }
  
  secret_text_binding {
    name = "LINE_CHANNEL_ACCESS_TOKEN"
    text = var.line_channel_access_token
  }
  
  secret_text_binding {
    name = "LINE_CHANNEL_SECRET"
    text = var.line_channel_secret
  }
  
  secret_text_binding {
    name = "FACEBOOK_PAGE_ACCESS_TOKEN"
    text = var.facebook_page_access_token
  }
  
  secret_text_binding {
    name = "FACEBOOK_APP_SECRET"
    text = var.facebook_app_secret
  }
  
  secret_text_binding {
    name = "FACEBOOK_VERIFY_TOKEN"
    text = random_password.facebook_verify_token.result
  }
  
  # D1 資料庫綁定
  d1_database_binding {
    name        = "DB"
    database_id = cloudflare_d1_database.main.id
  }
  
  # R2 存儲桶綁定
  r2_bucket_binding {
    name        = "R2_BUCKET"
    bucket_name = cloudflare_r2_bucket.attachments.name
  }
  
  # KV 綁定
  kv_namespace_binding {
    name         = "SESSIONS"
    namespace_id = cloudflare_workers_kv_namespace.sessions.id
  }
  
  kv_namespace_binding {
    name         = "CACHE"
    namespace_id = cloudflare_workers_kv_namespace.cache.id
  }
  
  # Queue 綁定
  queue_binding {
    binding = "MESSAGE_QUEUE"
    queue   = cloudflare_queue.message_queue.name
  }
  
  queue_binding {
    binding = "DELAYED_MESSAGE_QUEUE"
    queue   = cloudflare_queue.delayed_message_queue.name
  }
  
  # Durable Objects 綁定
  durable_object_namespace_binding {
    name         = "CONVERSATION_ROOM"
    class_name   = "ConversationRoom"
    script_name  = cloudflare_worker_script.main.name
  }
  
  depends_on = [
    cloudflare_d1_database.main,
    cloudflare_r2_bucket.attachments,
    cloudflare_workers_kv_namespace.sessions,
    cloudflare_workers_kv_namespace.cache,
    cloudflare_queue.message_queue,
    cloudflare_queue.delayed_message_queue
  ]
}

# 自定義域名 (可選)
resource "cloudflare_worker_domain" "main" {
  count      = var.custom_domain != "" ? 1 : 0
  account_id = local.account_id
  hostname   = var.custom_domain
  service    = cloudflare_worker_script.main.name
  zone_id    = var.zone_id
}

# Pages 專案 - 前端應用
resource "cloudflare_pages_project" "frontend" {
  account_id        = local.account_id
  name              = "${local.project_name}-frontend"
  production_branch = "main"
  
  build_config {
    build_command   = "npm run build"
    destination_dir = "dist"
    root_dir        = "frontend"
  }
  
  deployment_configs {
    production {
      environment_variables = {
        VITE_API_BASE_URL           = var.custom_domain != "" ? "https://${var.custom_domain}" : "https://${local.project_name}.${var.cloudflare_account_id}.workers.dev"
        VITE_DEV_MODE              = "false"
        VITE_ENABLE_DEBUG_LOGS     = "false"
        VITE_ENABLE_PERFORMANCE_MONITORING = "true"
      }
    }
    
    preview {
      environment_variables = {
        VITE_API_BASE_URL           = var.custom_domain != "" ? "https://${var.custom_domain}" : "https://${local.project_name}.${var.cloudflare_account_id}.workers.dev"
        VITE_DEV_MODE              = "true"
        VITE_ENABLE_DEBUG_LOGS     = "true"
        VITE_ENABLE_PERFORMANCE_MONITORING = "false"
      }
    }
  }
}

# 自定義域名 - 前端 (可選)
resource "cloudflare_pages_domain" "frontend" {
  count      = var.frontend_custom_domain != "" ? 1 : 0
  account_id = local.account_id
  project_name = cloudflare_pages_project.frontend.name
  domain     = var.frontend_custom_domain
}

# 資料庫初始化 (使用 null_resource 執行本地命令)
resource "null_resource" "database_init" {
  depends_on = [cloudflare_d1_database.main]
  
  provisioner "local-exec" {
    command = <<-EOT
      echo "正在初始化資料庫..."
      wrangler d1 execute ${cloudflare_d1_database.main.name} --file=./database/schema.sql
      wrangler d1 execute ${cloudflare_d1_database.main.name} --file=./database/file-attachments-schema.sql
      echo "資料庫初始化完成"
    EOT
  }
  
  triggers = {
    database_id = cloudflare_d1_database.main.id
  }
}

# 創建管理員用戶
resource "null_resource" "create_admin" {
  depends_on = [null_resource.database_init]
  
  provisioner "local-exec" {
    command = <<-EOT
      echo "正在創建管理員用戶..."
      node -e "
        const bcrypt = require('bcryptjs');
        const password = '${var.admin_password}';
        const hash = bcrypt.hashSync(password, 10);
        console.log('INSERT INTO users (email, password_hash, role, is_active, display_name, created_at, updated_at) VALUES (\"${var.admin_email}\", \"' + hash + '\", \"admin\", 1, \"系統管理員\", datetime(\"now\"), datetime(\"now\"));');
      " > create_admin.sql
      wrangler d1 execute ${cloudflare_d1_database.main.name} --file=./create_admin.sql
      rm create_admin.sql
      echo "管理員用戶創建完成"
    EOT
  }
  
  triggers = {
    admin_email    = var.admin_email
    admin_password = var.admin_password
  }
}