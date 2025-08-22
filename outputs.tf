# Terraform 輸出定義
# 部署完成後顯示的重要資訊

# 基本資訊
output "project_name" {
  description = "專案名稱"
  value       = local.project_name
}

output "environment" {
  description = "部署環境"
  value       = var.environment
}

output "cloudflare_account_id" {
  description = "Cloudflare 帳戶 ID"
  value       = local.account_id
}

# 應用程式 URL
output "api_url" {
  description = "API 後端 URL"
  value       = var.custom_domain != "" ? "https://${var.custom_domain}" : "https://${local.project_name}.${local.account_id}.workers.dev"
}

output "frontend_url" {
  description = "前端應用 URL"
  value       = var.frontend_custom_domain != "" ? "https://${var.frontend_custom_domain}" : "https://${cloudflare_pages_project.frontend.name}.pages.dev"
}

output "admin_dashboard_url" {
  description = "管理後台 URL"
  value       = "${var.custom_domain != "" ? "https://${var.custom_domain}" : "https://${local.project_name}.${local.account_id}.workers.dev"}/admin-dashboard.html"
}

# Webhook URL
output "line_webhook_url" {
  description = "LINE Bot Webhook URL (請在 LINE Developers Console 中設置)"
  value       = "${var.custom_domain != "" ? "https://${var.custom_domain}" : "https://${local.project_name}.${local.account_id}.workers.dev"}/api/webhooks/line"
}

output "facebook_webhook_url" {
  description = "Facebook Messenger Webhook URL (請在 Facebook Developers Console 中設置)"
  value       = "${var.custom_domain != "" ? "https://${var.custom_domain}" : "https://${local.project_name}.${local.account_id}.workers.dev"}/api/webhooks/facebook"
}

# 資料庫資訊
output "database_id" {
  description = "D1 資料庫 ID"
  value       = cloudflare_d1_database.main.id
}

output "database_name" {
  description = "D1 資料庫名稱"
  value       = cloudflare_d1_database.main.name
}

# 存儲資訊
output "r2_bucket_name" {
  description = "R2 存儲桶名稱"
  value       = cloudflare_r2_bucket.attachments.name
}

output "r2_public_url" {
  description = "R2 公開 URL (已配置自定義域名)"
  value       = var.environment == "production" ? "https://s3.imfinethankyouandyou.com" : "https://s3dev.imfinethankyouandyou.com"
}

# KV 命名空間
output "sessions_kv_id" {
  description = "會話 KV 命名空間 ID"
  value       = cloudflare_workers_kv_namespace.sessions.id
}

output "cache_kv_id" {
  description = "快取 KV 命名空間 ID"
  value       = cloudflare_workers_kv_namespace.cache.id
}

# Queue 資訊
output "message_queue_name" {
  description = "訊息佇列名稱"
  value       = cloudflare_queue.message_queue.name
}

output "delayed_message_queue_name" {
  description = "延遲訊息佇列名稱"
  value       = cloudflare_queue.delayed_message_queue.name
}

# 管理員資訊
output "admin_email" {
  description = "管理員電子郵件"
  value       = var.admin_email
}

# 自動生成的密鑰
output "facebook_verify_token" {
  description = "Facebook Verify Token (請在 Facebook Developers Console 中使用)"
  value       = random_password.facebook_verify_token.result
  sensitive   = true
}

# 部署狀態
output "deployment_status" {
  description = "部署狀態摘要"
  value = {
    worker_deployed    = true
    database_created   = true
    storage_configured = true
    queues_created     = true
    frontend_deployed  = true
  }
}

# 下一步指引
output "next_steps" {
  description = "部署完成後的下一步操作"
  value = [
    "1. 在 LINE Developers Console 設置 Webhook URL: ${var.custom_domain != "" ? "https://${var.custom_domain}" : "https://${local.project_name}.${local.account_id}.workers.dev"}/api/webhooks/line",
    "2. 如果使用 Facebook Messenger，在 Facebook Developers Console 設置 Webhook URL 和 Verify Token",
    "3. 訪問管理後台: ${var.custom_domain != "" ? "https://${var.custom_domain}" : "https://${local.project_name}.${local.account_id}.workers.dev"}/admin-dashboard.html",
    "4. 使用管理員帳戶登入: ${var.admin_email}",
    "5. 訪問前端應用: ${var.frontend_custom_domain != "" ? "https://${var.frontend_custom_domain}" : "https://${cloudflare_pages_project.frontend.name}.pages.dev"}",
    "6. 開始使用多渠道客服系統！"
  ]
}

# 成本估算 (僅供參考)
output "estimated_monthly_cost" {
  description = "預估月費用 (USD，僅供參考)"
  value = {
    workers_requests = "前 100,000 次請求免費，之後每百萬次 $0.50"
    d1_database     = "前 25GB 免費，之後每 GB $0.75"
    r2_storage      = "前 10GB 免費，之後每 GB $0.015"
    kv_operations   = "前 100,000 次操作免費，之後每百萬次 $0.50"
    pages_builds    = "每月 500 次建置免費，之後每次 $0.25"
    total_estimate  = "小型使用量通常在免費額度內"
  }
}

# 監控和維護
output "monitoring_urls" {
  description = "監控和維護相關 URL"
  value = {
    cloudflare_dashboard = "https://dash.cloudflare.com/${local.account_id}/workers/services/view/${local.project_name}"
    analytics           = "https://dash.cloudflare.com/${local.account_id}/analytics/workers"
    logs               = "https://dash.cloudflare.com/${local.account_id}/workers/services/view/${local.project_name}/logs"
    pages_dashboard    = "https://dash.cloudflare.com/${local.account_id}/pages/view/${cloudflare_pages_project.frontend.name}"
  }
}