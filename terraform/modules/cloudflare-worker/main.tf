# Cloudflare Worker 模組
# 可重用的 Worker 部署模組

variable "account_id" {
  description = "Cloudflare 帳戶 ID"
  type        = string
}

variable "name" {
  description = "Worker 名稱"
  type        = string
}

variable "script_content" {
  description = "Worker 腳本內容"
  type        = string
}

variable "environment_variables" {
  description = "環境變數"
  type        = map(string)
  default     = {}
}

variable "secret_variables" {
  description = "敏感環境變數"
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "d1_bindings" {
  description = "D1 資料庫綁定"
  type = list(object({
    name        = string
    database_id = string
  }))
  default = []
}

variable "r2_bindings" {
  description = "R2 存儲桶綁定"
  type = list(object({
    name        = string
    bucket_name = string
  }))
  default = []
}

variable "kv_bindings" {
  description = "KV 命名空間綁定"
  type = list(object({
    name         = string
    namespace_id = string
  }))
  default = []
}

variable "queue_bindings" {
  description = "Queue 綁定"
  type = list(object({
    binding = string
    queue   = string
  }))
  default = []
}

variable "durable_object_bindings" {
  description = "Durable Object 綁定"
  type = list(object({
    name        = string
    class_name  = string
    script_name = string
  }))
  default = []
}

# Worker Script 資源
resource "cloudflare_worker_script" "main" {
  account_id = var.account_id
  name       = var.name
  content    = var.script_content
  
  # 一般環境變數
  dynamic "plain_text_binding" {
    for_each = var.environment_variables
    content {
      name = plain_text_binding.key
      text = plain_text_binding.value
    }
  }
  
  # 敏感環境變數
  dynamic "secret_text_binding" {
    for_each = var.secret_variables
    content {
      name = secret_text_binding.key
      text = secret_text_binding.value
    }
  }
  
  # D1 資料庫綁定
  dynamic "d1_database_binding" {
    for_each = var.d1_bindings
    content {
      name        = d1_database_binding.value.name
      database_id = d1_database_binding.value.database_id
    }
  }
  
  # R2 存儲桶綁定
  dynamic "r2_bucket_binding" {
    for_each = var.r2_bindings
    content {
      name        = r2_bucket_binding.value.name
      bucket_name = r2_bucket_binding.value.bucket_name
    }
  }
  
  # KV 命名空間綁定
  dynamic "kv_namespace_binding" {
    for_each = var.kv_bindings
    content {
      name         = kv_namespace_binding.value.name
      namespace_id = kv_namespace_binding.value.namespace_id
    }
  }
  
  # Queue 綁定
  dynamic "queue_binding" {
    for_each = var.queue_bindings
    content {
      binding = queue_binding.value.binding
      queue   = queue_binding.value.queue
    }
  }
  
  # Durable Object 綁定
  dynamic "durable_object_namespace_binding" {
    for_each = var.durable_object_bindings
    content {
      name         = durable_object_namespace_binding.value.name
      class_name   = durable_object_namespace_binding.value.class_name
      script_name  = durable_object_namespace_binding.value.script_name
    }
  }
}

# 輸出
output "worker_name" {
  description = "Worker 名稱"
  value       = cloudflare_worker_script.main.name
}

output "worker_url" {
  description = "Worker URL"
  value       = "https://${var.name}.${var.account_id}.workers.dev"
}