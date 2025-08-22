# Cloudflare Pages 模組
# 可重用的 Pages 部署模組

variable "account_id" {
  description = "Cloudflare 帳戶 ID"
  type        = string
}

variable "name" {
  description = "Pages 專案名稱"
  type        = string
}

variable "production_branch" {
  description = "生產分支"
  type        = string
  default     = "main"
}

variable "build_command" {
  description = "建置命令"
  type        = string
  default     = "npm run build"
}

variable "destination_dir" {
  description = "建置輸出目錄"
  type        = string
  default     = "dist"
}

variable "root_dir" {
  description = "專案根目錄"
  type        = string
  default     = ""
}

variable "production_environment_variables" {
  description = "生產環境變數"
  type        = map(string)
  default     = {}
}

variable "preview_environment_variables" {
  description = "預覽環境變數"
  type        = map(string)
  default     = {}
}

variable "custom_domain" {
  description = "自定義域名"
  type        = string
  default     = ""
}

# Pages 專案
resource "cloudflare_pages_project" "main" {
  account_id        = var.account_id
  name              = var.name
  production_branch = var.production_branch
  
  build_config {
    build_command   = var.build_command
    destination_dir = var.destination_dir
    root_dir        = var.root_dir
  }
  
  deployment_configs {
    production {
      environment_variables = var.production_environment_variables
    }
    
    preview {
      environment_variables = var.preview_environment_variables
    }
  }
}

# 自定義域名 (可選)
resource "cloudflare_pages_domain" "main" {
  count        = var.custom_domain != "" ? 1 : 0
  account_id   = var.account_id
  project_name = cloudflare_pages_project.main.name
  domain       = var.custom_domain
}

# 輸出
output "project_name" {
  description = "Pages 專案名稱"
  value       = cloudflare_pages_project.main.name
}

output "project_url" {
  description = "Pages 專案 URL"
  value       = "https://${cloudflare_pages_project.main.name}.pages.dev"
}

output "custom_domain_url" {
  description = "自定義域名 URL"
  value       = var.custom_domain != "" ? "https://${var.custom_domain}" : null
}