# Reports 模組 — 報表生成與排程

> **位置**: `src/modules/reports/`  
> **角色**: 20+ 種報表的引擎，含模板、預覽、批次、排程、Email 寄送。

---

## 1. 這個模組是什麼？

Analytics 模組是「即時數字」，Reports 模組是「成品報告」 —— 含格式（CSV / Excel / PDF / HTML）、模板、預覽、排程寄送。它服務的是「每月報表」「合規稽核」「對外簡報」這類正式需求。

## 2. 解決什麼問題？

| 場景 | Reports 模組做什麼 |
|---|---|
| 每月寄業績報表給董事 | 排程每月 1 號自動產 PDF + Email |
| 想預覽報表長相 | `POST /preview` 給樣本資料 |
| 合規要求 SLA 報表 | 生成 SLA compliance 類型 |
| 老闆要看歷史報表 | `GET /reports` 列表 |

## 3. 主要功能

- **20+ 報表類型**：對話摘要 / 客服效能 / 系統健康 / SLA / 成本分析…
- **多種格式**：JSON / CSV / Excel / PDF / HTML（依類型而異）
- **模板**：預設模板可調
- **預覽**：用 SampleDataGenerators 生成樣本
- **報表庫**：瀏覽、下載、刪除
- **排程**：daily / weekly / monthly + Email
- **批次操作**：產生 / 刪除 / 匯出多份
- **統計**：依類型計數、平均產生時間、儲存用量

## 4. 操作介面入口

| 介面 | 用途 |
|---|---|
| `Reports.vue` | 主入口（router-view shell） |
| `ReportParameterForm` / `ReportTypeSelector` / `ReportViewerMetadata` / `TemplateQuickActions` | 設定 / 預覽 |
| `SidebarWidgets.vue` | 側邊報表清單與快捷 |

## 5. 主要 API 端點

| 方法 | 路徑 | 用途 |
|---|---|---|
| GET | `/api/reports/health` `/info` | 健康 / 功能列表 |
| POST | `/api/reports` | 產生報表 |
| GET | `/api/reports` | 列表 |
| GET | `/api/reports/:id` | 詳細 |
| GET | `/api/reports/:id/download` | 下載 URL |
| DELETE | `/api/reports/:id` | 刪除 |
| GET | `/api/reports/stats` | 統計 |
| POST | `/api/reports/batch` | 批次操作 |
| GET | `/api/reports/templates/:type` | 模板 |
| POST | `/api/reports/preview` | 預覽（用樣本資料） |
| GET / POST / PUT / DELETE | `/api/reports/scheduled` | 排程管理 |

## 6. 涉及的 Durable Objects

**不直接使用 DO**。報表存 DB，檔案上傳 R2。

## 7. 邊界案例與小細節

- **REPORT_TYPE_CONFIG dispatch**：所有 20 類型都映射到 metadata（名稱、支援格式、預估時間、權限）
- **`SampleDataGenerators.getSampleData(type)`**：唯一公開方法；底下 16 個 generator 是 module-level function 不是 static 方法
- **保留期 30 天（可調）**：清理任務移除過期
- **格式支援矩陣**：例如 `system_health` 只支援 JSON/HTML/PDF，不支援 CSV
- **併發產生上限 5**：超過排隊或回 429
- **存取控制**：admin 全看；agent 看自己生產的

## 8. 常見疑難

| 症狀 | 排查方向 |
|---|---|
| 排程沒送 Email | 確認排程設定有效、SMTP / Email service 健康 |
| 報表生成超慢 | 看 `estimatedGenerationTime`；是否查詢時間範圍太大 |
| 預覽資料怪 | 預覽用樣本不是真實資料 |

---

**相關模組**：[analytics](./analytics.md)、[system](./system.md)、[activities](./activities.md)
