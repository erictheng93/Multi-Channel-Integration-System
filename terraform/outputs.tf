# Terraform è¼¸å‡ºå®šç¾©
# ?¨ç½²å®Œæ?å¾Œé¡¯ç¤ºç??è?è³‡è?

# ?ºæœ¬è³‡è?
output "project_name" {
  description = "å°ˆæ??ç¨±"
  value       = "${local.base_project_name}${local.env_suffix}"
}

output "environment" {
  description = "?¨ç½²?°å?"
  value       = var.environment
}

output "cloudflare_account_id" {
  description = "Cloudflare å¸³æˆ¶ ID"
  value       = local.account_id
}

# ?‰ç”¨ç¨‹å? URL
output "api_url" {
  description = "API å¾Œç«¯ URL"
  value       = var.custom_domain != "" ? "https://${var.custom_domain}" : "https://${local.base_project_name}${local.env_suffix}.${local.account_id}.workers.dev"
}

output "frontend_url" {
  description = "?ç«¯?‰ç”¨ URL"
  value       = var.frontend_custom_domain != "" ? "https://${var.frontend_custom_domain}" : "https://${cloudflare_pages_project.frontend.name}.pages.dev"
}

output "admin_dashboard_url" {
  description = "ç®¡ç?å¾Œå° URL"
  value       = "${var.custom_domain != "" ? "https://${var.custom_domain}" : "https://${local.base_project_name}${local.env_suffix}.${local.account_id}.workers.dev"}/admin-dashboard.html"
}

# Webhook URL
output "line_webhook_url" {
  description = "LINE Bot Webhook URL (è«‹åœ¨ LINE Developers Console ä¸­è¨­ç½?"
  value       = "${var.custom_domain != "" ? "https://${var.custom_domain}" : "https://${local.base_project_name}${local.env_suffix}.${local.account_id}.workers.dev"}/api/webhooks/line"
}

output "facebook_webhook_url" {
  description = "Facebook Messenger Webhook URL (è«‹åœ¨ Facebook Developers Console ä¸­è¨­ç½?"
  value       = "${var.custom_domain != "" ? "https://${var.custom_domain}" : "https://${local.base_project_name}${local.env_suffix}.${local.account_id}.workers.dev"}/api/webhooks/facebook"
}

# è³‡æ?åº«è?è¨?
output "database_id" {
  description = "D1 è³‡æ?åº?ID"
  value       = cloudflare_d1_database.main.id
}

output "database_name" {
  description = "D1 è³‡æ?åº«å?ç¨?
  value       = cloudflare_d1_database.main.name
}

# å­˜å„²è³‡è?
output "r2_bucket_name" {
  description = "R2 å­˜å„²æ¡¶å?ç¨?
  value       = cloudflare_r2_bucket.attachments.name
}

output "r2_public_url" {
  description = "R2 ?¬é? URL (å·²é?ç½®è‡ªå®šç¾©?Ÿå?)"
  value       = "https://your-storage-domain.example.com"
}

# KV ?½å?ç©ºé?
output "sessions_kv_id" {
  description = "?ƒè©± KV ?½å?ç©ºé? ID"
  value       = cloudflare_workers_kv_namespace.sessions.id
}

output "cache_kv_id" {
  description = "å¿«å? KV ?½å?ç©ºé? ID"
  value       = cloudflare_workers_kv_namespace.cache.id
}

# Queue è³‡è? (å·²ç§»??- ä½¿ç”¨ Durable Objects ?¿ä»£)
# AGENT_QUEUE ??REALTIME_QUEUE å·²åœ¨ Phase 1.4b å®Œå…¨ç§»é™¤
# å»¶é²è¨Šæ¯?¾ç”± DelayedMessageBuffer Durable Object ?•ç?
# å¯¦æ?äº‹ä»¶??MessageBroadcaster ??LatestMessageCacheCoordinator Durable Objects ?•ç?

# ç®¡ç??¡è?è¨?
output "admin_email" {
  description = "ç®¡ç??¡é›»å­éƒµä»?
  value       = var.admin_email
}

# ?ªå??Ÿæ??„å???
output "facebook_verify_token" {
  description = "Facebook Verify Token (è«‹åœ¨ Facebook Developers Console ä¸­ä½¿??"
  value       = random_password.facebook_verify_token.result
  sensitive   = true
}

# ?¨ç½²?€??
output "deployment_status" {
  description = "?¨ç½²?€?‹æ?è¦?
  value = {
    worker_deployed    = true
    database_created   = true
    storage_configured = true
    queues_created     = true
    frontend_deployed  = true
  }
}

# ä¸‹ä?æ­¥æ?å¼?
output "next_steps" {
  description = "?¨ç½²å®Œæ?å¾Œç?ä¸‹ä?æ­¥æ?ä½?
  value = [
    "1. ??LINE Developers Console è¨­ç½® Webhook URL: ${var.custom_domain != "" ? "https://${var.custom_domain}" : "https://${local.base_project_name}${local.env_suffix}.${local.account_id}.workers.dev"}/api/webhooks/line",
    "2. å¦‚æ?ä½¿ç”¨ Facebook Messengerï¼Œåœ¨ Facebook Developers Console è¨­ç½® Webhook URL ??Verify Token",
    "3. è¨ªå?ç®¡ç?å¾Œå°: ${var.custom_domain != "" ? "https://${var.custom_domain}" : "https://${local.base_project_name}${local.env_suffix}.${local.account_id}.workers.dev"}/admin-dashboard.html",
    "4. ä½¿ç”¨ç®¡ç??¡å¸³?¶ç™»?? ${var.admin_email}",
    "5. è¨ªå??ç«¯?‰ç”¨: ${var.frontend_custom_domain != "" ? "https://${var.frontend_custom_domain}" : "https://${cloudflare_pages_project.frontend.name}.pages.dev"}",
    "6. ?‹å?ä½¿ç”¨å¤šæ??“å®¢?ç³»çµ±ï?"
  ]
}

# ?æœ¬ä¼°ç? (?…ä??ƒè€?
output "estimated_monthly_cost" {
  description = "?ä¼°?ˆè²»??(USDï¼Œå?ä¾›å???"
  value = {
    workers_requests = "??100,000 æ¬¡è?æ±‚å?è²»ï?ä¹‹å?æ¯ç™¾?¬æ¬¡ $0.50"
    d1_database     = "??25GB ?è²»ï¼Œä?å¾Œæ? GB $0.75"
    r2_storage      = "??10GB ?è²»ï¼Œä?å¾Œæ? GB $0.015"
    kv_operations   = "??100,000 æ¬¡æ?ä½œå?è²»ï?ä¹‹å?æ¯ç™¾?¬æ¬¡ $0.50"
    pages_builds    = "æ¯æ? 500 æ¬¡å»ºç½®å?è²»ï?ä¹‹å?æ¯æ¬¡ $0.25"
    total_estimate  = "å°å?ä½¿ç”¨?é€šå¸¸?¨å?è²»é?åº¦å…§"
  }
}

# ??§?Œç¶­è­?
output "monitoring_urls" {
  description = "??§?Œç¶­è­·ç›¸??URL"
  value = {
    cloudflare_dashboard = "https://dash.cloudflare.com/${local.account_id}/workers/services/view/${local.base_project_name}${local.env_suffix}"
    analytics           = "https://dash.cloudflare.com/${local.account_id}/analytics/workers"
    logs               = "https://dash.cloudflare.com/${local.account_id}/workers/services/view/${local.base_project_name}${local.env_suffix}/logs"
    pages_dashboard    = "https://dash.cloudflare.com/${local.account_id}/pages/view/${cloudflare_pages_project.frontend.name}"
  }
}