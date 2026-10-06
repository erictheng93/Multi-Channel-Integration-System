# 功能三設計:新訊息桌面提醒

- 日期:2026-09-29
- 狀態:已與需求方確認核可
- 範圍:純前端(Vue 3 Composition API),不動後端、無 migration
- 前置審視:依 main 分支程式碼核對,原始計畫兩處假設已修正(見「決策記錄」)

## 目標

客服開著系統分頁(前景或背景)時,客戶傳來新訊息即彈出瀏覽器桌面通知,點擊直達該對話。正在看該對話時不打擾,同對話短時間內合併,附提示音與頁面標題未讀數。

**主要目標平台:Windows + Chrome/Edge**(客服端一律 Windows;開發機為 macOS 但驗收以 Windows 為準)。通知經 Windows 通知中心呈現,會自動收合進通知中心屬預期行為;「專注助理」開啟時 Windows 會隱藏通知,這是系統層行為,設定 UI 的說明文字需提及。

## 決策記錄

| 決策 | 結論 | 理由 |
|------|------|------|
| 設定入口 | 擴充既有 `NotificationSettingsModal`(`/notifications` 頁) | 原計畫的 SystemSettings 整組 `requiresAdmin: true`,一般客服進不去;桌面通知是每位客服的個人偏好 |
| 觸發範圍 | 可切換:「全部」/「我所屬團隊」 | 團隊收件匣全彈可能過吵;系統已移除個人指派(僅剩 `assignedTeamId`),故「指派給我」語意修正為「指派給我所屬團隊」(`assignedTeamId ∈ authStore.allowedTeamIds`)。「我所屬團隊」模式下未指派團隊的對話不彈 |
| 偏好儲存 | 每裝置 localStorage | 瀏覽器通知權限本身即每裝置授權,偏好與權限同生命週期,避免「別台裝置開了但沒權限」的矛盾態;不動後端 |
| 掛載方式 | 獨立 composable 自行訂閱 WebSocket | 與 conversations store 解耦,單測只需 mock `wsStore` 與 `Notification`;與 `useActivityStream`、`useNotificationController` 同模式 |
| Web Push | 範圍外 | `serviceWorkerManager` 的 VAPID 訂閱碼為未完成佔位(`'YOUR_VAPID_PUBLIC_KEY'`),`VITE_ENABLE_PUSH_NOTIFICATIONS` 未設定、該路徑為死碼,本期不觸碰 |

## 1. 架構總覽

三個小而獨立的 composable + 一處 UI 擴充:

| 單元 | 檔案 | 職責 |
|------|------|------|
| 偏好儲存 | `frontend/src/composables/notification/useDesktopNotificationPrefs.ts`(新) | localStorage 偏好:`enabled`、`scope: 'all' \| 'my-teams'`、`soundEnabled`;localStorage 不可用(private mode)時退回記憶體 |
| 通知核心 | `frontend/src/composables/notification/useDesktopNotifications.ts`(新) | 訂閱 → 過濾 → 節流 → 彈通知 → 點擊導航;讀取權限狀態 |
| 標題未讀數 | `frontend/src/composables/notification/usePageTitleUnread.ts`(新) | 監看 conversations store 總未讀數,將 `(N) ` 前綴進 `document.title` |
| 設定 UI | `frontend/src/components/notification/NotificationSettingsModal.vue`(改) | 新增「桌面通知(此裝置)」區塊:權限狀態機 UI + 三個開關 |
| 掛載點 | `frontend/src/App.vue`(改) | 認證後掛載一次 `useDesktopNotifications` 與 `usePageTitleUnread` |
| 音效資產 | `frontend/public/sounds/notification.wav`(新) | 提示音播放來源(短音、≤ 50 KB) |

訂閱走 `wsStore.subscribe('conversations', handler)`(`new_message` 事件已由 `websocketEventRouter.ts` 一律路由到 `conversations` channel),登出/卸載時 unsubscribe。與 conversations store 解耦——只讀 `currentConversation` 與未讀數,不修改該 store。

## 2. 資料流:彈或不彈的判斷鏈

`new_message` 事件進入後依序過濾,任一關不過即靜默返回:

1. **訊息來源**:`senderType === 'customer'`(客服自己與同事的回覆不彈)
2. **開關與權限**:偏好 `enabled === true` 且 `Notification.permission === 'granted'`
3. **範圍**:`scope === 'my-teams'` 時要求 `assignedTeamId ∈ authStore.allowedTeamIds`;`scope === 'all'` 不過濾
4. **打擾抑制**:分頁前景(`document.visibilityState === 'visible'` **且** `document.hasFocus()`;只看 visibilityState 不夠，切到其他 App 時視窗常仍部分可見)**且**正在看該對話(`currentConversation.id === conversationId`)→ 不彈。分頁在背景時一律彈(即使停在該對話)
5. **合併節流**:`Notification` 帶 `tag: conversationId`,同對話新通知自動取代舊通知;另加每對話 3 秒最小間隔,避免連發抖動

### 通知內容

- 標題:客戶名稱。取值順序:payload `sender.name` → conversations store 查找 → 固定字串「新訊息」
- 內文:文字訊息取前 60 字;非文字依 `messageType` 顯示「傳送了圖片」「傳送了貼圖」「傳送了檔案」
- 點擊行為:`window.focus()` → router 導航至該對話 → `notification.close()`
- 音效:判斷鏈全數通過且 `soundEnabled` 時播放短提示音

## 3. 權限狀態機(設定 UI)

Modal 的「桌面通知(此裝置)」區塊依 `Notification.permission` 呈現四態:

| 狀態 | 呈現 |
|------|------|
| unsupported(無 `window.Notification` 或非 secure context) | 不支援說明,無按鈕 |
| default | 「啟用桌面通知」按鈕;由該次點擊觸發 `requestPermission()`(瀏覽器要求 user gesture)。成功 → granted;拒絕 → denied |
| granted | 三個開關:啟用 / 範圍(全部・我所屬團隊)/ 音效 |
| denied | 「已被瀏覽器封鎖」與手動解除步驟說明(程式無法再喚起)。步驟以 Windows 的 Chrome/Edge 為準:網址列左側鎖頭/設定圖示 → 網站設定 → 通知 → 允許 → 重新整理;另提醒檢查 Windows「設定 → 系統 → 通知」與「專注助理」 |

既有的 `pushEnabled` 等後端同步開關原樣保留不動;新區塊明確標示「此裝置」以區隔語意。UI 遵循 `docs/UIUX-Design-System.md`(Apple-Native Soft Minimalism)。

## 4. 與既有程式碼的關係

- **不觸碰** `serviceWorkerManager` 的 Web Push 訂閱碼(VAPID 佔位符維持死碼現狀)
- 權限請求**不走** `swManager.requestNotificationPermission()`,composable 直接呼叫原生 `Notification.requestPermission()`,避免依賴 SW 註冊
- `document.title` 目前由 router `afterEach` 依路由 `meta.title` 設定;`usePageTitleUnread` 同時 watch 路由與未讀數,換頁後重新套用 `(N) ` 前綴,不改 router 本身
- 既有 in-app 通知(`useNotificationController`、`NotificationCenter`)行為不變

## 5. 錯誤處理

- `new Notification()` 在部分平台會 throw → try/catch 包住,logger 記錄後靜默(通知失敗絕不影響訊息流)
- localStorage 讀寫失敗 → 記憶體 fallback,行為相同但不持久
- payload 欄位缺漏(無 `conversationId`、無 `sender`)→ 逐級 fallback,最終放棄該次通知而非報錯
- 音效播放失敗(autoplay 政策等)→ 靜默忽略

## 6. 測試

- **composable 單測**(Vitest;mock `wsStore.subscribe`、`Notification`、conversations store):
  - 客戶訊息彈、客服訊息不彈
  - 正在看該對話且分頁前景 → 抑制;分頁背景 → 彈
  - scope 兩模式過濾(含未指派對話在 my-teams 模式不彈)
  - 同對話 3 秒節流;`tag` 取代行為
  - permission 非 granted / 偏好關閉 → 不彈
  - payload 缺漏之 fallback
- **設定區塊元件測試**:四種權限態渲染、按鈕觸發 `requestPermission`、開關持久化
- **標題未讀數單測**:未讀變化更新前綴、換頁後前綴保留、歸零時移除
- **跨瀏覽器實測**(手動):Chrome / Edge + Windows 通知中心

## 範圍外

- 真 Web Push(瀏覽器關閉仍可收):VAPID、訂閱資料表、逐訊息後端觸發(原計畫估 +2–3 人天)
- Facebook / LINE 以外平台的特殊處理(通知層不分平台)
- 後端任何變更
