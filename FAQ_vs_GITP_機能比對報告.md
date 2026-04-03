# FAQ 現行系統 vs GITP 新系統 — 機能比對報告

**文件版本：** 1.1（2026-04-01 第二次校對：新增各未完整涵蓋機能之替代方案分析）  
**比對日期：** 2026-04-01  
**比對依據：**
- FAQ 規格書：`artifacts/msg-82/FAQ_系統功能規格書_現行盤點.md`（v1.6）
- GITP 規格書：`artifacts/msg-56/GITP_系統規格書_v5.0.md`（v5.7）
- GITP 後端程式碼：`artifacts/msg-56/backend/GITP.API/`
- GITP 前端程式碼：`artifacts/msg-56/frontend/src/`

**標記說明：**
- ✅ 已涵蓋：新系統有對應功能，功能完整
- ⚠️ 部分涵蓋：部分對應，有差距或缺漏
- ❌ 未涵蓋：新系統中完全沒有對應功能
- 🔄 可替代：新系統雖無相同設計，但有其他機制可達到相同目標
- ➕ 超越現行：GITP 新增了現行系統沒有的功能

> **本版更新說明（v1.1）：**  
> 針對所有 ⚠️（部分涵蓋）及 ❌（未涵蓋）項目，新增「GITP 替代方案分析」評估；  
> 並修正 GITP 規格書版本號（v5.5 → v5.7）、補充若干比對精確度說明。

---

## 目錄

1. [角色與權限系統](#1-角色與權限系統)
2. [問題點提報](#2-問題點提報)
3. [問題點查詢](#3-問題點查詢)
4. [問題點詳情](#4-問題點詳情)
5. [問題點處理](#5-問題點處理)
6. [滿意度回饋](#6-滿意度回饋)
7. [FAQ 知識庫](#7-faq-知識庫)
8. [統計功能](#8-統計功能)
9. [未完成案件（NonFinish）](#9-未完成案件nonfinish)
10. [CMDB 整合](#10-cmdb-整合)
11. [外部系統整合（TopEIP）](#11-外部系統整合topeip)
12. [附件管理](#12-附件管理)
13. [多公司（多租戶）設計](#13-多公司多租戶設計)
14. [API 稽核日誌](#14-api-稽核日誌)
15. [JWT 自動更新機制](#15-jwt-自動更新機制)
16. [其他 FAQ 特有功能](#16-其他-faq-特有功能)
17. [總結統計表與替代方案摘要](#17-總結統計表與替代方案摘要)

---

## 1. 角色與權限系統

### FAQ 現行機能

| 角色 | 識別方式 | 說明 |
|------|---------|------|
| ADMINS | `Session["GroupID"] == "ADMINS"`（帳號含 `rd\` 前綴） | IT 管理員，最高權限 |
| QweekUsers（PowerUser） | 各頁面個別查詢 `QweekUsers` 資料表 | IT 擔當者，可操作處理面板 |
| FirstUser | 各頁面個別查詢 `FirstUser` 資料表（單一帳號） | 第一線窗口，有完整轉派介面 |
| Vendor（一般員工） | 非 ADMINS 的所有帳號 | 僅可提報與查詢自己案件 |

**現行問題：**
- 角色判斷機制分散（Session + DB 各頁面獨立查詢），維護成本高
- SYSTEMS 角色是死碼，實際上永遠不會觸發
- 以帳號前綴（`rd\`）硬判斷 IT 人員，擴充性差

### GITP 對應機能

**✅ 已涵蓋（且大幅改善）**

GITP 採統一 RBAC 設計：

| 角色代碼 | 說明 | 對應 FAQ 角色 |
|----------|------|-------------|
| `employee` | 子公司員工 | Vendor（一般員工） |
| `it_assignee` | IT 擔當者 | QweekUsers + FirstUser |
| `it_admin` | IT 管理員 | ADMINS |

**改善點：**
- 角色統一由 `user_roles` 資料表管理，支援多角色並存（同一帳號可同時擁有 `it_admin` + `it_assignee`）
- JWT 多 Role Claim 嵌入，無需每頁面查詢資料庫
- 角色升降透過管理介面（`/admin/users`）操作，無需修改程式碼
- 保護機制：不可修改自己角色；最後一名 `it_admin` 不得被降級
- 對應程式碼：`AdminController.cs`、`AdminUserManagement.jsx`、`usp_SetUserRoles`

**尚缺部分：**
- FAQ 的 FirstUser（單一固定第一線窗口帳號）在 GITP 無明確對應，但 `it_assignee` 角色可達到相同效果

---

## 2. 問題點提報

### FAQ 現行機能（QuestionInput.aspx）

| 欄位 | 必填 | 說明 |
|------|:----:|------|
| 反應問題公司（廠商） | ✅ | DropDownList，來自 EIP 系統 |
| 反應問題人員 | ✅ | 依廠商動態載入（在職員工 View） |
| 反應時間 | ✅ | 預設今日 |
| 問題摘要（主旨） | ✅ | 單行文字 |
| 問題說明 | ✅ | 多行文字 |
| 附件 | ❌ | 支援 11 種副檔名 |

- 登錄人員、所屬公司由 Session 自動帶入
- ADMINS 可選任意廠商/反應人員（代報功能）
- 一般員工廠商與反應人員選單鎖定
- 提報後：Email 通知第一線人員（`getFirstMails` SP 取得收件清單）

### GITP 對應機能

**⚠️ 部分涵蓋**

**已涵蓋的部分：**
- 主旨（Subject）、說明（Description）必填 ✅
- 提報人相關資訊（EmpId、EmpName、CompanyId、DepId 等）由 JWT 自動帶入 ✅
- 附件上傳（副檔名、MIME Type 由 DB 設定動態控制）✅
- 提報後 Email 通知所有 `it_admin` ✅
- 對應程式碼：`TicketsController.cs`（POST `/api/tickets`）、`SubmitTicket.jsx`

**尚缺的部分：**

| FAQ 功能 | 狀態 | 說明 |
|---------|:----:|------|
| 代報功能（ADMINS 可選任意廠商與反應人員） | ❌ | GITP 僅允許提報自己的工單，無代他人提報機制 |
| 反應時間（可指定日期） | ❌ | GITP 提報時間固定為系統當下時間（`CreatedAt`），無法手動指定 |
| 聯絡電話欄位 | ⚠️ | GITP `users` 資料表有 `phone` 欄位，但提報表單未設計此欄位 |
| 公司/部門/人員選單（反應人員與提報人分離） | ❌ | GITP 設計為「提報人即反應人」，無分離選擇機制 |

**🔍 GITP 替代方案分析：**

| FAQ 缺漏功能 | 替代可行性 | 替代方案說明 |
|------------|:--------:|------------|
| 代報功能 | 🔄 可補充 | `it_admin` 提報時顯示「代為提報」選項，允許手動選填提報公司與人員（EmpId/CompanyId）。資料庫側 `tickets` 新增 `reported_by` 欄位與 `created_by`（登入者）分開儲存即可。**建議列為 P1 補充。** |
| 反應時間手動指定 | 🔄 易補充 | `CreateTicketRequest` 新增 `occurred_at?` 選填欄位，it_admin 提報時可手動填入事件發生時間，與 `created_at` 分開記錄，工程量小。 |
| 聯絡電話欄位顯示 | 🔄 已有欄位，只需 UI 顯示 | `users.phone` 欄位已存在且包含於 JWT payload，僅需在提報表單（`SubmitTicket.jsx`）與詳情頁（`TicketDetail.jsx`）加入顯示，**改動極小**。 |
| 反應人員與提報人分離 | 🔄 隨代報功能解決 | 解決代報功能後此問題自然一併解決。 |

---

## 3. 問題點查詢

### FAQ 現行機能（QuestionQry.aspx / MyQuestionQry.aspx）

**QuestionQry.aspx（全域查詢）：**

| 篩選條件 | 說明 |
|---------|------|
| 開始/結束日期 | 預設近一個月 |
| 是否結案 | 全部 / 未結案 / 已結案 |
| 負責擔當 | 來自 `VIEW_TakeUser` |
| 發生系統 | 來自 `SystemTable` |
| 問題類別 | 來自 `QuesType` |
| 公司別 | 來自 `CompanyTable` |
| 廠商（反應公司） | 來自 EIP，聯動反應人員下拉 |
| 反應人員 | 依廠商動態載入 |
| 關鍵字 | 主旨/說明全文搜尋 |

**MyQuestionQry.aspx（我的案件）：** 個人視角，以當前使用者 UserID 查詢

- 分頁：DataGrid 內建分頁（每頁筆數硬碼）
- 可匯出 Excel（`spQuestionQry_ExcelQry`）

### GITP 對應機能

**⚠️ 部分涵蓋**

**已涵蓋的部分：**
- 案件清單（`GET /api/tickets`）支援狀態篩選、日期範圍、關鍵字（主旨/說明）、公司篩選 ✅
- 案件視角：員工僅見自己公司案件；IT 人員見全部案件 ✅
- 「我的案件」vs「公司案件」視角切換（員工可見同公司工單）✅
- 分頁：API 支援分頁（`TicketList.jsx`）✅
- 對應程式碼：`TicketsController.cs`（GET `/api/tickets`）、`TicketList.jsx`

**尚缺的部分：**

| FAQ 篩選條件 | 狀態 | 說明 |
|------------|:----:|------|
| 依「負責擔當」篩選 | ❌ | GITP 工單清單 API 無此篩選維度 |
| 依「反應人員」篩選 | ❌ | GITP 無代報概念，無此欄位 |
| 依「發生系統」篩選 | ⚠️ | GITP 有 system_id 欄位但清單篩選 API 未見此參數 |
| 依「問題類別」篩選 | ⚠️ | GITP 有 issue_type_id 欄位但清單篩選 API 未見此參數 |
| 轉 FAQ 按鈕（從查詢結果一鍵建立 FAQ） | ❌ | GITP 無 FAQ 知識庫，故無此功能 |

**🔍 GITP 替代方案分析：**

| FAQ 缺漏功能 | 替代可行性 | 替代方案說明 |
|------------|:--------:|------------|
| 依「負責擔當」篩選 | 🔄 易補充 | `TicketFilterRequest` 新增 `AssigneeId?`（Guid）參數，`usp_GetTickets` SP 加入對應 WHERE 條件即可。`TicketList.jsx` 前端加入 IT 人員下拉選單篩選器。**建議補充。** |
| 依「反應人員」篩選 | 🔄 隨代報功能解決 | 待代報功能補充後，可用 `reported_by` 欄位作為篩選維度。 |
| 依「發生系統」篩選 | 🔄 欄位已有，易補充 | `system_id` 已存於 `tickets` 資料表，`TicketFilterRequest` 新增 `SystemId?` 參數，SP 加一行 WHERE 條件即可，前端加入系統別下拉。 |
| 依「問題類別」篩選 | 🔄 欄位已有，易補充 | `issue_type_id` 已存於 `tickets` 資料表，同上方式補充。 |
| 轉 FAQ 按鈕 | ❌ 依賴 FAQ 知識庫 | 需先完成 FAQ 知識庫功能（第 7 節），再在工單清單與詳情頁加入入口。 |

---

## 4. 問題點詳情

### FAQ 現行機能（QuestionDetail.aspx）

- 顯示所有提報資訊（登錄人員、反應人員、時間、主旨、說明、原因分析、對策等）
- 處理歷程 Timeline（Repeater，呼叫 SP `spQuestionDetail`）
- 案件狀態顯示
- 附件下載連結（現有 Bug：連結路徑錯誤）
- 緊急度×衝擊 3×3 矩陣（H/M/L × H/M/L，目前等級以藍色高亮）
- PREV/NEXT 導覽（QuesID ±1，僅 ADMINS 可見）
- CMDB CI 狀態顯示
- 操作面板（結案、轉派、問題解析按鈕）

### GITP 對應機能

**⚠️ 部分涵蓋**

**已涵蓋的部分：**
- 工單詳情頁（`TicketDetail.jsx`）顯示所有提報資訊 ✅
- 對話式 Timeline（`Timeline.jsx`，`ticket_messages` 資料表，`message_type: user/system` 區分使用者回覆與系統事件，系統事件以灰色橫幅區隔）✅
- 處理人員歷史鏈（`ticket_handlers`，`GET /api/tickets/{id}/handlers`）✅
- 問題分類標籤顯示（問題類型、公司別、系統別、優先等級）✅
- 嚴重度×緊急度 3×3 優先矩陣（`PriorityMatrix.jsx`，P1/P2/P3）✅（設計不同但功能等效）
- 對應程式碼：`TicketDetail.jsx`、`Timeline.jsx`、`PriorityMatrix.jsx`

**尚缺的部分：**

| FAQ 功能 | 狀態 | 說明 |
|---------|:----:|------|
| PREV/NEXT 導覽（案件編號 ±1） | ❌ | GITP 無此導覽功能，每次需回清單再進入 |
| 原因分析（Analysis）獨立欄位 | ⚠️ | GITP 以 Timeline 訊息整合，未設獨立欄位顯示「原因分析」 |
| 對策（IssueContent）獨立欄位 | ⚠️ | 同上，整合在 Timeline 中 |
| 臨時對策旗標（TempSolution） | ❌ | GITP 無此欄位 |
| 附件下載連結（直接顯示於詳情頁） | ✅ | GITP 有 `GET /api/attachments/{id}` |

**🔍 GITP 替代方案分析：**

| FAQ 缺漏功能 | 替代可行性 | 替代方案說明 |
|------------|:--------:|------------|
| PREV/NEXT 導覽 | ⚠️ 部分可替代 | GITP 使用 GUID 作為案件 ID，無法用 ±1 方式切換。但前端可實作「在當前篩選清單中前一筆/下一筆」，傳遞有序清單至詳情頁後在 UI 顯示上下導覽按鈕，屬中等工程量。對 ADMINS 管理多案件時有使用價值，**建議列為 P3 補充**。 |
| 原因分析獨立欄位 | 🔄 可設計補充 | `tickets` 資料表新增 `root_cause`（根本原因）與 `countermeasure`（對策）欄位，在詳情頁以獨立區塊顯示。這有助於知識沉澱，與 FAQ 知識庫功能互補，**建議補充**。 |
| 對策獨立欄位 | 🔄 同上 | 同原因分析，合併一起補充。 |
| 臨時對策旗標 | 🔄 可補充 | `ticket_messages` 加入 `is_workaround` BIT 欄位，或 `tickets` 加 `has_workaround` 旗標，工程量小。 |

---

## 5. 問題點處理

### FAQ 現行機能（QuestionResponse.aspx）

依 `?Type=` 參數決定操作類型：

| 操作 | 說明 |
|------|------|
| Close（結案） | 填寫回應、原因分析、問題類別/公司/系統別，呼叫 `spUpdQuestionDetail_Close` |
| Tran（轉派） | 選擇新擔當者，ADMINS 可選任意；非 ADMINS 使用 btnTopmost（轉回前一位負責人）|
| Meeting（會議記錄） | 空殼功能，SaveReplyData() 方法體全空，不執行任何操作 |
| Problem（問題解析） | 需帳號以 `rd` 開頭，呼叫 FAQ DB 側 SP 後再建立 TopEIP 問題處理單 |

**退回功能：** FAQ 現行系統無明確「退回」狀態，轉派即為退回  
**Email 通知：** 結案/轉派/btnTopmost 分別觸發不同 Email

### GITP 對應機能

**⚠️ 部分涵蓋**

**已涵蓋的部分：**
- 回覆/新增訊息（`POST /api/tickets/{id}/messages`）✅
- 轉派（`PUT /api/tickets/{id}/transfer`）：`it_assignee` 可轉自己負責的案件；`it_admin` 可轉任何案件 ✅
- 退回提報人（狀態 `pending_user`，請提報人補充資訊）✅（**優於** FAQ：有明確狀態機）
- 待使用者確認（狀態 `pending_confirm`，請提報人確認處理結果）✅（FAQ 無此狀態）
- 結案（`PUT /api/tickets/{id}/status`）：僅 IT 公司人員可結案（雙層保護：API + DB）✅
- 結案前填寫分類（問題類型/嚴重度/緊急度等）✅
- 轉派/指派後 Email 通知 ✅
- 對應程式碼：`TicketsController.cs`、`TicketDetail.jsx`、`usp_UpdateTicketStatus`、`usp_TransferTicket`

**尚缺的部分：**

| FAQ 功能 | 狀態 | 說明 |
|---------|:----:|------|
| btnTopmost（置頂 / 轉回前一位負責人） | ❌ | GITP 無此特殊邏輯，可透過一般轉派達成類似效果，但無「自動轉回前任」機制 |
| 問題解析（btnProblem → TopEIP 問題處理單） | ❌ | GITP 完全無此功能（見第 11 節）|
| 召開會議（Meeting）功能 | ❌ | FAQ 為空殼，GITP 同樣未實作 |
| 原因分析獨立欄位（txtAnalysis） | ⚠️ | GITP 的 Timeline 訊息可達到類似效果，但無獨立欄位 |
| 預計完成日（txtCusDueDate，RD 帳號限定） | ❌ | GITP 無預計完成日欄位 |

**🔍 GITP 替代方案分析：**

| FAQ 缺漏功能 | 替代可行性 | 替代方案說明 |
|------------|:--------:|------------|
| btnTopmost（轉回前任） | 🔄 可透過轉派替代 | GITP 的 `ticket_handlers` 資料表記錄完整的處理人員歷史鏈。IT 管理員可查看歷史鏈後，手動將案件轉派給前一位負責人，功能上等效；只是沒有一鍵自動回到前任的按鈕。若需一鍵功能，可在 `TicketDetail.jsx` 加入「轉回上一位」按鈕，讀取 `ticket_handlers` 最後一筆記錄後自動呼叫 transfer API，工程量小。 |
| 問題解析（TopEIP） | ❌ 無替代，需開發整合 | 詳見第 11 節。需先確認 TopEIP 是否仍在使用。 |
| 召開會議（Meeting） | 🔄 可透過 Timeline 替代 | GITP 的 Timeline 支援 `message_type: system/user`，可新增 `meeting` 類型，讓 IT 人員記錄「會議時間、出席人員、討論結果」。前端以特殊卡片樣式顯示，比 FAQ 的空殼功能更完整，**建議補充**。 |
| 原因分析獨立欄位 | 🔄 可補充 | 詳見第 4 節替代方案分析。 |
| 預計完成日 | 🔄 易補充 | `tickets` 資料表新增 `due_date DATETIME2 NULL` 欄位，`UpdateStatusRequest` 加入此欄位，詳情頁顯示；工程量極小，**建議補充**。 |

---

## 6. 滿意度回饋

### FAQ 現行機能（ReplyQuestionOK / ReplyQuestionNOK）

- **觸發時機：** 結案後 Email 通知含「同意/不同意」連結（含 `?ID={QuesID}`）
- **ReplyQuestionOK：** 使用者開啟頁面即自動記錄「滿意」（無需任何按鈕操作）
- **ReplyQuestionNOK：** 使用者輸入意見說明後儲存；Email 通知案件負責擔當（主管副本功能有 Bug，實際失效）
- **不滿意不會自動建立追蹤工單**（僅寄 Email）
- **驗證：** `usp_CheckQuestionReply`（防止非提報人回覆、重複回覆）

### GITP 對應機能

**✅ 已涵蓋（且大幅強化）**

| FAQ 功能 | GITP 對應 | 說明 |
|---------|----------|------|
| 結案後 Email 通知提報人 | ✅ | `FeedbackService.cs` + `EmailService.cs` 自動觸發 |
| 滿意連結（Email 中一鍵回覆） | ✅ | `GET /api/feedback/{token}/satisfied` 自動提交 |
| 不滿意連結（含留言） | ✅ | `POST /api/feedback/{token}` 含 `comment` 欄位 |
| 一次性 Token（防重複回覆） | ✅ | GUID Token，回覆後立即失效；可設定過期天數 |
| 不滿意自動建立追蹤工單 | ✅（**新增**） | FAQ 無此功能；GITP `usp_SubmitFeedback` 自動建立追蹤工單並在原工單 Timeline 插入系統訊息 |
| 無需登入即可回饋 | ✅ | Token 為公開端點，降低回饋門檻 |
| 前端路由 | ✅ | `/feedback/:token`、`/feedback/:token/:action` |

- 對應程式碼：`FeedbackController.cs`、`FeedbackService.cs`、`FeedbackPage.jsx`、`usp_CreateFeedbackToken`、`usp_SubmitFeedback`

**比較：** GITP 的滿意度機制優於 FAQ，解決了 FAQ 的「主管副本 Bug」，並新增了「不滿意自動建立追蹤工單」功能。

---

## 7. FAQ 知識庫

### FAQ 現行機能（FAQQry.aspx / FAQDetail.aspx）

- **FAQQry.aspx：** 關鍵字全文搜尋，DataGrid 分頁（每頁 10 筆硬碼）
- **FAQDetail.aspx：** 三種進入模式
  - `?ID={FAQID}`：查看/編輯現有 FAQ（建立者可編輯）
  - `?TranID={QuesID}`：從問題點轉建 FAQ（預填標題/說明）
  - 無參數：空白新建 FAQ
- 存取控制有 Bug（任何已登入使用者均可存取）
- 資料表：`FAQTable`（FAQID, FAQTitle, FAQDesc, WriteUserID, TranQuesID）

### GITP 對應機能

**❌ 未涵蓋**

GITP 完全沒有 FAQ 知識庫功能：
- 無對應的前端路由（`App.jsx` 中無任何 FAQ 相關頁面）
- 無對應的後端 Controller
- 無對應的資料表（`attachment_settings` 等資料表清單中無 FAQ 相關表）
- 工單清單頁也無「轉 FAQ」按鈕

**影響評估：**
現行 FAQ 系統的核心知識沉澱機制（將處理好的案件轉為可搜尋的知識庫條目）在 GITP 中完全缺失，對知識管理與問題重複發生的預防有明顯影響。

**🔍 GITP 替代方案分析：**

**❌ 目前無替代機制，需全新開發**

GITP 現有功能中沒有任何可以替代 FAQ 知識庫的機制。GITP 的 Timeline 訊息（`ticket_messages`）僅限於單一工單的溝通記錄，無法跨工單搜尋，也無法獨立建立知識條目。

**建議補充方向（P1 優先）：**
1. 新增 `faq_articles` 資料表（`id`, `title`, `content`, `source_ticket_id?`, `author_id`, `tags`, `created_at`, `updated_at`）
2. 新增 `FAQController`（`GET /api/faq`、`GET /api/faq/{id}`、`POST /api/faq`、`PUT /api/faq/{id}`）
3. 工單結案後，`TicketDetail.jsx` 顯示「轉為 FAQ」按鈕（僅 `it_admin`/`it_assignee` 可見），預填 subject/description
4. 前端新增 `/faq` 搜尋頁（全域公開，含全文搜尋）與 `/faq/:id` 詳情頁
5. 此功能完成後，第 3 節的「轉 FAQ 按鈕」和第 16 節的「QuesList.ascx」下鑽至 FAQ 清單才有意義

---

## 8. 統計功能

### FAQ 現行機能（QuesIndex.aspx / Statistic.ascx / QuesList.ascx）

`spQuesCrossTable` 一次回傳四個 Result Set，對應四個統計面板：

| 統計面板 | 對應 ClassName | 說明 |
|---------|--------------|------|
| staticA | TakeUser | 依「處理擔當」統計 |
| staticB | QuesUser | 依「反應問題人員」統計 |
| staticC | QuesType | 依「問題類別」統計 |
| staticD | QuesSystem | 依「系統別」統計 |

- 每個面板顯示各項目的「未結案數」與「合計數」，附超連結可下鑽至具體清單
- 時間範圍由使用者選擇
- Excel 匯出（`QuestionQry.aspx` 入口，HTML 偽裝成 .xls）

### GITP 對應機能

**⚠️ 部分涵蓋**

**已涵蓋的部分：**
- 統計儀表板（`TicketStats.jsx`，`/admin/stats`）提供整體摘要 ✅
- 各子公司明細表格（問題總數/各狀態數量/結案率/平均結案時數）✅
- 時間範圍篩選（當月/當年）✅
- Excel 匯出（`ClosedXML` 真正的 XLSX 格式，非同步背景處理）✅
- 對應程式碼：`DashboardController.cs`、`ReportsController.cs`、`TicketStats.jsx`、`usp_GetTicketStats`

**尚缺的部分：**

| FAQ 統計維度 | 狀態 | 說明 |
|------------|:----:|------|
| 依「處理擔當（IT 人員）」統計與下鑽 | ❌ | GITP 統計以「公司別」為維度，無依 IT 人員下鑽 |
| 依「反應問題人員（提報人）」統計 | ❌ | GITP 無此維度 |
| 依「問題類別」統計 | ❌ | GITP `usp_GetTicketStats` 未見此維度 |
| 依「系統別」統計 | ❌ | 同上 |
| 統計清單下鑽（點擊數字進入清單） | ❌ | GITP 統計頁無下鑽至具體工單清單的連結 |
| 逾期統計 | ❌ | FAQ 有逾期案件統計，GITP 未見 |

**🔍 GITP 替代方案分析：**

| FAQ 缺漏功能 | 替代可行性 | 替代方案說明 |
|------------|:--------:|------------|
| 依 IT 人員統計 | 🔄 可擴充 | 擴充 `usp_GetTicketStats` 回傳第三個 ResultSet（依 assignee 彙總），`TicketStats.jsx` 加入「IT 人員統計」Tab。 |
| 依問題類別統計 | 🔄 可擴充 | `issue_types` 主檔已存在，SP 加入依 `issue_type_id` 的 GROUP BY 即可新增此維度。 |
| 依系統別統計 | 🔄 可擴充 | `company_systems` 主檔已存在，同上方式補充。 |
| 依提報人統計 | ⚠️ 待代報功能 | 待代報功能補充後，以 `reported_by` 欄位作為統計維度。 |
| 統計下鑽 | 🔄 可設計 | 統計數字加上超連結，導向工單清單頁（`/tickets?assigneeId=xxx` 或 `?issueTypeId=xxx`），前提是清單 API 需先補充對應篩選參數（見第 3 節）。**建議與清單篩選補充一起實作。** |
| 逾期統計 | 🔄 需先有 due_date | 待「預計完成日」欄位補充後（見第 5 節），即可在 SP 加入 `WHERE due_date < GETDATE() AND finish = 0` 的逾期計算。 |

---

## 9. 未完成案件（NonFinish）

### FAQ 現行機能（NonFinish.aspx）

- IT 擔當者的工作桌面
- 呼叫 `spNonFinish`，傳入 `@UserID`，顯示目前指派給自己的所有未結案問題點
- 以 Repeater 顯示，含歷程記錄數（`RecordCount`）
- `RecordCount == 0` 顯示「新問題」圖示（尚未有任何 IT 回應）

### GITP 對應機能

**⚠️ 部分涵蓋**

**已涵蓋的部分：**
- 工單清單（`TicketList.jsx`）可依狀態篩選，IT 人員可過濾出「指派給自己且未結案」的工單 ✅
- 處理中/待補充/待確認等未結案狀態均可篩選 ✅

**尚缺的部分：**

| FAQ 功能 | 狀態 | 說明 |
|---------|:----:|------|
| 獨立的「待處理工作桌面」頁面 | ❌ | GITP 無類似 NonFinish.aspx 的專用頁面，需使用者手動篩選 |
| 「新問題」圖示（尚無 IT 回應的案件特殊標記） | ❌ | GITP 工單清單無此視覺提示 |
| 自動預設篩選「指派給我的未結案」 | ❌ | GITP IT 人員進入清單後需自行設定篩選條件 |

**🔍 GITP 替代方案分析：**

| FAQ 缺漏功能 | 替代可行性 | 替代方案說明 |
|------------|:--------:|------------|
| 待處理工作桌面 | 🔄 可補充 | 新增 `/my-tasks` 路由，預設帶入篩選條件 `assigneeId=當前用戶&status=processing,pending_user,pending_confirm`。後端 `GET /api/tickets?myAssigned=true` 加入此邏輯即可，**工程量小且使用價值高，建議優先補充**。 |
| 「新問題」圖示 | 🔄 可透過資料達成 | GITP `ticket_messages` 資料表可計算每筆工單的 IT 回覆數（`message_type = 'user' AND sender_role IN ('it_admin','it_assignee')`）。工單清單 API 回傳 `has_it_reply: boolean`，前端以圖示區分「待首次回應」案件，**實作難度低**。 |
| 自動預設篩選 | 🔄 同待處理工作桌面 | 解決待處理工作桌面即同步解決此問題。 |

---

## 10. CMDB 整合

### FAQ 現行機能（GSS CMDB API）

- **建立 CI 變更單（RFC）：** 詳情頁「建立 CI 變更單」按鈕 → 呼叫 `GssCreateNewRFCApi` → 取得 CI 單號 → 儲存至 `QuestionMain.CIChangeID`
- **查詢 CI 狀態：** 呼叫 `GssGetStatusApi`，取得 `CanClose` 旗標
- **結案限制：** 若案件有 `CIChangeID` 且 `EffectCI = "TRUE"`，需確認 `CanClose = true` 才能結案；否則「結案」按鈕禁用
- **btnCancel（CMDB 確認失敗時取消）：** `CanClose = false` 時結案按鈕禁用（隱性的 cancel 機制）
- **環境切換：** `IsProduction` 設定值控制 API 指向測試/正式環境

### GITP 對應機能

**❌ 未涵蓋**

GITP 完全沒有 CMDB 整合功能：
- 無任何 CI 變更單相關 Controller、Service、資料表欄位
- 工單結案流程無 CMDB `CanClose` 檢查
- `tickets` 資料表無 `CIChangeID` 相關欄位

**影響評估：**
若業務流程要求「IT 問題點影響 CI（組態項目）時，必須先在 GSS CMDB 建立變更單並確認關閉後才能結案」，則 GITP 完全無法滿足此需求。

**🔍 GITP 替代方案分析：**

**❌ 目前無替代機制，需確認業務需求後再開發**

GITP 無任何 CI 或 CMDB 相關概念。若新系統上線後業務仍要求此整合，建議：
1. **先確認** GSS CMDB API 是否仍在使用，以及新系統是否繼續沿用此業務流程（IT 問題不一定都需要 CI 變更單）
2. 若確認需要，補充方向：
   - `tickets` 資料表新增 `ci_change_id NVARCHAR(50) NULL`、`effect_ci BIT DEFAULT 0` 欄位
   - 新增 `CmdbController.cs` 整合 GSS CMDB REST API（或保留 DB 直連方式）
   - `TicketDetail.jsx` 加入「建立 CI 變更單」按鈕（`it_admin` 限定），結案前若 `effect_ci=1` 則檢查 `CanClose`
   - 環境設定（IsProduction 等）改為後端 `appsettings.json` 可設定項

---

## 11. 外部系統整合（TopEIP）

### FAQ 現行機能（btnProblem）

- **觸發條件：** 案件未結案 + 尚未申請過問題解析（`RequestSheet != "1"`）+ 操作者帳號以 `rd` 開頭
- **執行流程：**
  1. 呼叫 FAQ DB 側 SP `spUpdQuestionResponse_TransProblemSheet`（防止重複解析，標記 `RequestSheet`）
  2. 連接外部 TopEIP 資料庫，呼叫 `usp_UpdAddNewProblemSheet` 在 TopEIP 建立「應用問題點處理單」
  3. 顯示成功提示，不執行結案操作

### GITP 對應機能

**❌ 未涵蓋**

GITP 完全沒有 TopEIP 外部系統整合功能：
- 無任何 TopEIP 相關連線設定
- 工單詳情無「問題解析」操作按鈕
- 無 `RequestSheet` 相關欄位

**影響評估：**
若企業仍需要在 IT 問題點解析後，連動在 TopEIP 系統建立對應的「應用問題點處理單」，GITP 完全無法支援此業務流程。

**🔍 GITP 替代方案分析：**

**❌ 目前無替代機制，需先確認 TopEIP 是否仍在使用**

建議在進入開發前，先向業務確認：
1. TopEIP 系統是否仍在使用且持續維護？
2. 新系統上線後「問題解析→建立處理單」是否仍要求系統連動？還是改為手動作業？
3. TopEIP 是否有提供 REST API 接口，可取代現行的直接 DB 連線？

若確認需要整合，補充方向：
- `tickets` 資料表新增 `request_sheet BIT DEFAULT 0`（防止重複解析）
- 新增 `TopEipService.cs`（連線 TopEIP DB 或呼叫 TopEIP API，由 `appsettings.json` 設定）
- `TicketDetail.jsx` 加入「問題解析」按鈕（`it_admin` 限定，且 `request_sheet = 0`），操作後設定 `request_sheet = 1`

---

## 12. 附件管理

### FAQ 現行機能

| 功能 | 說明 |
|------|------|
| 附件上傳 | 單一附件，11 種副檔名（switch-case 硬碼）|
| 儲存路徑 | 伺服器本機 `./attachment/att{QuesID}.{副檔名}` |
| 附件下載 | 有 Bug（連結只含副檔名，路徑錯誤）|
| MIME Type 驗證 | 無（僅靠副檔名）|
| 大小限制 | 無應用層限制，僅靠 IIS `maxRequestLength`（20MB）|
| 病毒掃描 | 無 |
| 多附件 | 不支援（每案件僅一個附件欄位）|
| 附件刪除 | 無明確刪除功能 |

### GITP 對應機能

**✅ 已涵蓋（且大幅改善）**

| FAQ 功能 | GITP 對應 | 說明 |
|---------|----------|------|
| 附件上傳 | ✅ | 支援多附件（`ticket_attachments` 資料表）|
| 副檔名驗證 | ✅ | `AttachmentSettingsService.ValidateFileAsync()` 動態讀取 DB 設定 |
| MIME Type 驗證 | ✅ | 同上，雙重驗證（副檔名 + MIME Type）|
| 大小限制 | ✅ | DB 可設定，預設 20MB |
| 附件下載 | ✅ | `GET /api/attachments/{id}` |
| 附件刪除 | ✅ | `DELETE /api/attachments/{id}` |
| 儲存路徑 | ✅ | Azure Blob Storage / AWS S3（非本機磁碟）|
| 病毒掃描 | ⚠️ | 規格書第 16.2 節要求「整合外部 AV API」，但實際 `FileStorageService.ValidateFileAsync()` 程式碼未實作病毒掃描，僅做副檔名/MIME/大小驗證 |
| 附件上傳設定管理 | ✅（**新增**）| 管理介面（`/admin/attachment-settings`）動態調整，無需改程式 |

- 對應程式碼：`AttachmentsController.cs`、`AttachmentSettingsController.cs`、`FileStorageService.cs`、`AttachmentSettingsService.cs`、`FileUpload.jsx`

---

## 13. 多公司（多租戶）設計

### FAQ 現行機能

- `QuestionMain.CompanyID`：`CHAR(1)`（單字元），極限擴充性（最多 9 家公司）
- `CompanyTable`：公司主檔
- 無 Row-Level Security（RLS）：靠程式邏輯過濾，可能被繞過
- EIP 系統的 `Dept` 欄位作為公司識別（`ComID`/`ComName`/`DeptName` 三個 Session 值相同）

### GITP 對應機能

**✅ 已涵蓋（且大幅改善）**

| FAQ 設計 | GITP 改善 |
|---------|----------|
| CompanyID `CHAR(1)` | `UNIQUEIDENTIFIER`，無上限 |
| 無 RLS | SQL Server RLS（`fn_ticket_filter` + `TicketCompanyPolicy`）雙層保護 |
| 程式邏輯過濾 | `TenantMiddleware` 每次請求前設定 `SESSION_CONTEXT`（company_id/roles/user_id）|
| 公司設定固定 | `companies` 資料表可維護，含 `is_it_company` 旗標 |
| 無 IT 公司旗標 | `companies.is_it_company` 決定誰可結案，可動態調整 |

- 對應程式碼：`TenantMiddleware.cs`、`CompaniesController.cs`、`CompanyManagement.jsx`、`usp_SetCompanyItFlag`

---

## 14. API 稽核日誌

### FAQ 現行機能

- 無 API 稽核日誌機制
- 僅有 `Global.asax.cs Application_Error` 寫入錯誤日誌（SP `spAddRecordError`），且只記錄未處理例外

### GITP 對應機能

**✅ 已涵蓋（新功能，FAQ 無對應）**

- `PermissionMiddleware.cs` 中：每次經過驗證的 API 呼叫自動寫入 `api_audit_logs`
- 實作：`conn.ExecuteAsync("usp_CreateApiAuditLog", ...)`
- 紀錄欄位：呼叫的使用者、端點路徑、HTTP 方法、時間戳記等
- 已整合至 `Program.cs`（`app.UseMiddleware<PermissionMiddleware>()`）

---

## 15. JWT 自動更新機制

### FAQ 現行機能

- Session-based 驗證（NTLM/Kerberos Windows 整合驗證）
- Session Timeout：20 分鐘（Web.config 設定）
- 無 JWT 機制

### GITP 對應機能

**✅ 已涵蓋（新功能，FAQ 無對應）**

| 機制 | 說明 |
|------|------|
| 統一 JWT | 所有驗證方式（Windows/表單/Azure AD/LDAP）最終均換發同一 GITP JWT |
| 前端定時檢查 | `useAuth.js` hook 每 60 秒檢查 Token 剩餘有效時間 |
| 5 分鐘閾值靜默更新 | 剩餘 < 5 分鐘時靜默向 `POST /api/users/refresh-token` 更新 |
| Request Interceptor | `axios` 每次 API 呼叫前檢查，近過期時先更新再發請求 |
| Singleton Promise | 防止多請求同時觸發重複更新 |
| 過期自動登出 | Token 已過期時清除 Session 並導向登入頁 |

- 對應程式碼：`useAuth.js`、`client.js`（axios interceptor）、`UsersController.cs`（`/api/users/refresh-token`）

---

## 16. 其他 FAQ 特有功能

### 16.1 QuesList.ascx 五種查詢模式

**FAQ 現行機能：** 依 QueryString `classname` 參數切換五種模式：

| 模式 | classname | 呼叫 SP |
|------|-----------|---------|
| 預設（全部未結案） | （空） | `spQuesListNonFinish` |
| 依擔當者篩選 | `TakeUser` | `spQuesListForTakeUser` |
| 依反應人員篩選 | `QuesUser` | `spQuesListForQuesUser` |
| 依問題類別篩選 | `QuesType` | `spQuesListForQuesType` |
| 依系統別篩選 | `QuesSystem` | `spQuesListForSystem` |

**GITP 對應：** **⚠️ 部分可替代**

GITP 工單清單（`TicketList.jsx`）支援基本篩選，但無此五維度的下鑽統計清單功能。

**🔍 替代方案：**
- 「依擔當者」「依問題類別」「依系統別」篩選：待第 3 節補充篩選參數後，統計頁可加入超連結帶入相應篩選條件跳轉至工單清單，等效實現下鑽功能。
- 「預設未結案清單」：待第 9 節「待處理工作桌面」補充後，此功能自動涵蓋。
- 「依反應人員篩選」：待代報功能補充後可支援。
- 總體而言，此功能的缺口可透過「清單篩選補充 + 統計下鑽連結」組合解決，無需獨立模式。

---

### 16.2 問題點 PREV/NEXT 導覽

**FAQ 現行機能：** QuestionDetail.aspx 右上角「上一筆 / 下一筆」超連結（QuesID ±1 切換），僅 ADMINS 可見。

**GITP 對應：** **⚠️ 無法完全替代，但有替代設計**

GITP 無此功能。GITP 的案件 ID 為 `UNIQUEIDENTIFIER`（GUID），無法用 ±1 方式導覽。

**🔍 替代方案：**
- 前端工單清單在跳轉至詳情頁時，可傳遞當前已排序的清單（透過 URL state 或 SessionStorage）
- 詳情頁讀取清單後，顯示「上一筆 / 下一筆」導覽按鈕（依清單中的位置）
- 此方法不依賴 ID 遞增，可適用於任意篩選結果，彈性更高
- 工程量中等，建議列為 P3 補充

---

### 16.3 會議記錄功能（Meeting）

**FAQ 現行機能：** `QuestionResponse.aspx?Type=Meeting` — `QuestionMeeting` 類別存在，顯示日期輸入欄，但 `SaveReplyData()` 方法體完全為空（全部邏輯被注解），實際上不執行任何操作。屬未完成的死功能。

**GITP 對應：** **🔄 可透過 Timeline 替代（且比 FAQ 更完整）**

GITP 的 Timeline（`ticket_messages`）支援 `message_type` 欄位，可在不需獨立資料表的情況下，以 `message_type: 'meeting'` 記錄會議摘要（含日期、出席人、決議事項）。

**🔍 替代方案：**
- `ticket_messages.message_type` 新增 `meeting` 值
- `TicketDetail.jsx` 在 Timeline 中為 meeting 型訊息顯示特殊會議卡片（含日期、出席人、決議事項欄位）
- 這比 FAQ 的空殼功能更完整，且無需新增資料表
- 工程量小，建議列為 P3 補充（尤其若業務上有此需求）

---

## 17. 總結統計表與替代方案摘要

### 17.1 完整比對統計表

| # | 機能群組 | 狀態 | 替代可行性 | 備註 |
|---|---------|:----:|:--------:|------|
| 1 | 角色與權限系統 | ✅ 已涵蓋 | — | GITP 統一 RBAC，大幅優於 FAQ |
| 2 | 問題點提報 | ⚠️ 部分涵蓋 | 🔄 可補充 | 代報/反應時間/聯絡電話均可補充 |
| 3 | 問題點查詢 | ⚠️ 部分涵蓋 | 🔄 可補充 | 欄位已有，篩選 API 需補充 |
| 4 | 問題點詳情 | ⚠️ 部分涵蓋 | 🔄 可補充 | 原因分析/對策/PREV-NEXT 可補充 |
| 5 | 問題點處理 | ⚠️ 部分涵蓋 | 🔄 大部分可替代 | btnTopmost 可透過 handlers 替代；Meeting 可透過 Timeline 替代 |
| 6 | 滿意度回饋 | ✅ 已涵蓋 | — | GITP 更完善，新增不滿意自動追蹤工單 ➕ |
| 7 | FAQ 知識庫 | ❌ 未涵蓋 | ❌ 需全新開發 | **最重要缺漏，無替代，需開發** |
| 8 | 統計功能 | ⚠️ 部分涵蓋 | 🔄 可擴充 | 現有資料表可支援多維度，SP 需擴充 |
| 9 | 未完成案件（NonFinish） | ⚠️ 部分涵蓋 | 🔄 可補充 | 新增 `/my-tasks` 頁面即可，工程量小 |
| 10 | CMDB 整合 | ❌ 未涵蓋 | ❌ 需確認業務需求後開發 | 須先確認 CMDB 是否仍在使用 |
| 11 | 外部系統整合（TopEIP） | ❌ 未涵蓋 | ❌ 需確認業務需求後開發 | 須先確認 TopEIP 是否仍在使用 |
| 12 | 附件管理 | ✅ 已涵蓋 | — | GITP 大幅改善；病毒掃描規格有但未實作 |
| 13 | 多公司（多租戶）設計 | ✅ 已涵蓋 | — | GITP 完整 RLS，遠優於 FAQ ➕ |
| 14 | API 稽核日誌 | ✅ 已涵蓋 | — | 新功能（FAQ 無對應）➕ |
| 15 | JWT 自動更新機制 | ✅ 已涵蓋 | — | 新功能（FAQ 無對應）➕ |
| 16a | QuesList.ascx 五種查詢模式 | ⚠️ 部分可替代 | 🔄 可補充 | 清單篩選 + 統計下鑽組合可替代 |
| 16b | PREV/NEXT 導覽 | ⚠️ 部分可替代 | 🔄 可補充 | 清單位置導覽替代 ±1 方式 |
| 16c | 會議記錄（Meeting） | 🔄 可替代 | 🔄 Timeline meeting type | FAQ 是空殼，GITP Timeline 可完整替代 |

### 17.2 狀態統計

| 狀態 | 數量 |
|------|:----:|
| ✅ 已涵蓋（且通常優於 FAQ） | 7 |
| ⚠️ 部分涵蓋 / 可替代 | 8 |
| ❌ 未涵蓋且無替代（需開發） | 3 |

> **關鍵發現：** 原報告 v1.0 有 6 項 ❌ 未涵蓋，經替代方案分析後，僅剩 3 項真正需要全新開發（FAQ 知識庫、CMDB 整合、TopEIP 整合）；其餘缺漏均可透過補充欄位或調整現有功能解決，工程量相對可控。

### 17.3 建議開發優先序

| 優先級 | 功能 | 預估難度 | 說明 |
|--------|------|:--------:|------|
| 🔴 P1 | FAQ 知識庫 | 高 | 核心知識管理功能，完全缺失，需全新開發 |
| 🔴 P1 | 代報功能 | 中 | 影響提報流程完整性，ADMINS 日常需要 |
| 🔴 P1 | 問題點查詢篩選補充（擔當/類別/系統） | 低 | 欄位已有，API 篩選未開放，工程量小 |
| 🟠 P2 | 待處理工作桌面（/my-tasks） | 低 | IT 人員效率提升，工程量極小 |
| 🟠 P2 | 統計下鑽 + 多維度補充 | 中 | SP 擴充 + 前端連結，可搭配清單篩選一起做 |
| 🟠 P2 | CMDB 整合 | 高 | 需先確認業務需求，若需要則開發複雜度高 |
| 🟠 P2 | TopEIP 整合 | 中 | 需先確認 TopEIP 是否仍在使用 |
| 🟡 P3 | 原因分析 / 對策 / 預計完成日欄位 | 低 | 欄位補充，改動極小 |
| 🟡 P3 | 聯絡電話顯示 | 極低 | 欄位已有，UI 加一行 |
| 🟡 P3 | PREV/NEXT 清單導覽 | 中 | UX 提升，前端實作 |
| 🟡 P3 | 會議記錄（Timeline meeting type） | 低 | message_type 新增值，前端新增卡片樣式 |

---

*本報告依據 FAQ 規格書 v1.6、GITP 規格書 v5.7 及實際程式碼產出。比對日期：2026-04-01。文件版本：v1.1（含替代方案分析）。*
