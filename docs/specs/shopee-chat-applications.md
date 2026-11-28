# 蝦皮聊聊：Go-Live 與 Chat API 申請草稿

配合 [Phase 1 規格](shopee-chat-phase-1.md) 第 3 節使用。以下內容皆為草稿，由帳號負責人確認後自行送出。

## 1. Go-Live 表單（App 252641 MCIS）

| 欄位 | 填寫內容 |
| --- | --- |
| Product URL（選填） | `https://mcis.daiwandist.com` |
| Test Username / Password（選填） | 建議留空。若要提供，另建一個只屬於空白團隊、看不到真實客戶的客服帳號，審核通過後停用，不要給正式帳號。 |
| Brief Introduction（必填，500 字元內） | 見下方 |
| 介面截圖（必填，png/jpg，最多 3 張） | 正式環境的對話列表、對話視窗、儀表板（2026-11-26 擷取，未遮蔽，經帳號負責人同意）。渠道設定頁需要管理員帳號，未擷取。 |
| Test Redirect URL Domain | `mcis-backend.daiwandist.com` |
| Live Redirect URL Domain | `mcis-backend.daiwandist.com` |
| Buyer PII | 關閉 |

**Brief Introduction**（英文，共 453 字元）：

```text
MCIS is Daiwan Abrasives' in-house customer service workspace. Our own support agents use it to read and manually reply to customer chats from our official channels (LINE, Facebook Messenger and our Shopee Mall shop) in one place. For Shopee we will only authorize our own shop, receive buyer chat messages via Webchat Push, and send replies typed by human agents. No chatbot, auto replies, broadcasts or promotional messages. Buyer PII is not required.
```

## 2. Chat API 工單（Raise Ticket → Feature APIs > Chat）

送出前提：Go-Live 已通過，正式商店已授權，且 API Access Log 有該商店近 30 天內的呼叫紀錄。

```text
主旨：申請開通 Chat API（Seller In House System App：MCIS，App ID 252641）

您好，

我們是蝦皮商城賣家，開發者帳號類型為 Registered Business Seller（台灣）。
App「MCIS」（Seller In House System）是我們自行開發的客服工作台，
公司內部客服人員在同一個畫面處理 LINE、Facebook Messenger 與蝦皮的顧客訊息。

申請用途：
1. 透過 Webchat Push（Code 10）即時接收買家傳給本店的聊聊訊息。
2. 由客服人員在 MCIS 內「人工」輸入並回覆買家（文字與圖片）。

我們承諾：
- 不使用 chatbot 自動回覆、不主動推送訂單通知或促銷訊息、不群發。
- 不將自動訊息偽裝為人工訊息。
- 聊天資料僅用於回覆買家，並遵守 Shopee 資料保護政策；不申請買家 PII。

申請開通的商店 ID：<shop_id>

謝謝。
```

`<shop_id>` 取自正式授權回跳網址的 `shop_id` 參數。
