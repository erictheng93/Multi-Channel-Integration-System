# Tags 模組 — 對話與客戶分類

> **位置**: `src/modules/tags/`  
> **角色**: 給對話與客戶貼標籤，方便篩選、聚類、統計。

---

## 1. 這個模組是什麼？

每個對話、每個客戶都可以貼上多個彩色標籤（如「VIP」「退貨」「待跟進」），方便後續搜尋、批次處理、報表分組。

## 2. 解決什麼問題？

| 場景 | Tags 模組做什麼 |
|---|---|
| 想標出「需要跟進」的對話 | 貼 `待跟進` 標籤 |
| 業務想知道本月有多少 VIP 來訊 | `GET /:id/customers` 列出帶 VIP 的人 |
| 標籤名打錯字 | `PUT /:id` 改名（顏色、描述也能改） |
| 想批次給 50 個對話加標籤 | `POST /bulk` |
| 查看標籤使用趨勢 | `GET /:id/stats` 看每日指派 |

## 3. 主要功能

- **建立與管理**：團隊範圍標籤、含名稱、顏色、描述
- **顏色標準化**：6 位 hex；3 位自動補成 6 位；無效預設藍 `#3B82F6`
- **多重指派**：對話與客戶都可貼多個標籤
- **使用統計**：客戶數、對話數、指派趨勢
- **批次操作**：一次指派 / 取消多筆
- **軟刪除**：`isActive=false` 而非真刪
- **排程使用統計**：每日指派趨勢、top 指派者

## 4. 操作介面入口

| 介面 | 用途 |
|---|---|
| `CustomerTags.vue` | 主入口 |
| `TagsList.vue` / `TagCard.vue` | 列表 |
| `TagFormModal.vue` | 建 / 編輯 |
| `TagsToolbar.vue` | 批次操作工具列 |
| `TagSelector.vue` | 對話 / 客戶頁面內的下拉指派 |
| `TagStatsModal.vue` / `TagStatsOverview.vue` / `TagStatsActivity.vue` | 統計 |

## 5. 主要 API 端點

| 方法 | 路徑 | 用途 |
|---|---|---|
| GET / POST | `/api/tags` | 列表 / 建立 |
| GET / PUT / DELETE | `/api/tags/:id` | CRUD |
| GET | `/api/tags/:id/stats` | 詳細使用統計 |
| GET | `/api/tags/:id/customers` | 帶此標籤的客戶分頁 |
| GET | `/api/tags/:id/conversations` | 帶此標籤的對話分頁 |
| POST | `/api/tags/bulk` | 批次指派 / 取消 |
| GET | `/api/tags/health` | 健康檢查（公開） |

## 6. 涉及的 Durable Objects

**不直接使用 DO**。

## 7. 邊界案例與小細節

- **顏色僅接受 hex 格式**：其他格式（rgb / hsl）不支援
- **軟刪除便於稽核**：被刪標籤管理員仍可查；一般 UI 過濾掉
- **團隊範圍**：`team_id` 可空 → 全域標籤；admin 可看全部
- **批次部分失敗可回滾**：回傳成功 / 失敗清單，呼叫端可選擇是否補償
- **每次操作寫 activity log**：CRUD 與批次都會留下稽核痕跡

## 8. 常見疑難

| 症狀 | 排查方向 |
|---|---|
| 顏色顯示錯誤 | 檢查是否傳了 3 位 hex（會自動補但要確認） |
| `conversationCount` = 0 | 已修復 — `getAvailableTags` 子查詢補上 conversationCount |
| 標籤刪了還在用 | 軟刪除設計，要查 `isActive=false` |

---

**相關模組**：[conversations](./conversations.md)、[customer](./customer.md)
