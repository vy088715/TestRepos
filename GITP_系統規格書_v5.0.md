# 集團跨公司 IT 問題反應平台（GITP）
# 系統規格書 v5.5

**版本：** 5.5  
**文件狀態：** 正式版（含歷次迭代功能）  
**最後更新：** 2026-03-31  
**核心目標：** 提供子公司極簡報修管道，建立 IT 公司高效派工、多關卡處理、分類分析、滿意度追蹤與數據輸出機制。

---

## 目錄

1. [系統願景與設計原則](#1-系統願景與設計原則)
2. [角色權限矩陣（RBAC）](#2-角色權限矩陣rbac)
3. [功能需求規範](#3-功能需求規範)
4. [工單狀態機](#4-工單狀態機)
5. [多關卡處理流程](#5-多關卡處理流程)
6. [結案限制與 IT 公司設定](#6-結案限制與-it-公司設定)
7. [問題分類模組](#7-問題分類模組)
8. [滿意度回饋機能](#8-滿意度回饋機能)
9. [身份驗證機制](#9-身份驗證機制)
   - [9.1 三層驗證架構](#91-三層驗證架構)
   - [9.2 驗證流程](#92-驗證流程)
   - [9.3 Windows 驗證](#93-windows-驗證)
   - [9.4 Azure AD 驗證](#94-azure-ad-驗證)
   - [9.5 LDAP 驗證（各子公司網域帳號）](#95-ldap-驗證各子公司網域帳號)
   - [9.6 JWT Token 自動更新機制](#96-jwt-token-自動更新機制)
   - [9.7 JWT 設計](#97-jwt-設計)
   - [9.8 新增 API 端點](#98-新增-api-端點)
10. [統計儀表板](#10-統計儀表板)
11. [附件上傳設定管理](#11-附件上傳設定管理)
12. [通知機制](#12-通知機制)
13. [技術架構](#13-技術架構)
14. [資料庫設計](#14-資料庫設計)
15. [API 端點清單](#15-api-端點清單)
16. [安全與效能要求](#16-安全與效能要求)
17. [部署規格](#17-部署規格)
18. [自動化測試](#18-自動化測試)
19. [附錄：修訂履歷](#附錄修訂履歷)

---

## 1. 系統願景與設計原則

| 原則 | 說明 |
|------|------|
| 一分鐘報修 | 介面極簡，使用者填寫主旨與說明即可提交，其餘由系統自動帶入 |
| 多租戶隔離 | 嚴格確保各子公司間的資料隱私，雙層保護（API 層 + 資料庫 RLS） |
| 全生命週期管理 | 從提報、派工、多關卡轉派、確認到結案的完整閉環 |
| 數據驅動 | 支援 Excel 非同步導出，提供集團 IT 績效分析 |
| IT 公司主導結案 | 只有被標記為「IT 公司」的人員才可執行結案，防止子公司自行關閉工單 |
| 滿意度追蹤 | 結案後自動通知提報人進行滿意度回饋，不滿意時自動建立追蹤工單 |
| 企業驗證優先 | 優先使用 Windows 驗證（無感登入），備援表單登入，額外提供 Azure AD 選項 |
| JWT 自動更新 | 前端定時檢查 Token 剩餘有效時間，靜默更新避免使用者被強制登出 |
| LDAP 企業目錄驗證 | 各子公司可設定獨立 LDAP 伺服器，支援 Active Directory 網域帳號驗證 |
| 附件設定可維護化 | 附件上傳的開關、允許副檔名、MIME Type 及大小上限均由 `it_admin` 透過管理介面動態設定，無需修改程式碼 |

---

## 2. 角色權限矩陣（RBAC）

### 2.1 角色說明

| 角色代碼 | 角色名稱 | 說明 |
|----------|----------|------|
| `employee` | 子公司員工 | 一般使用者，屬於非 IT 公司 |
| `it_assignee` | IT 擔當者 | IT 公司第一線處理人員 |
| `it_admin` | IT 管理員 | IT 公司系統管理員，具最高操作權 |

> **多角色支援：** 使用者可同時持有多個角色（例如：`it_admin` + `it_assignee`），由資料庫 `user_roles` 關聯表管理。**同一帳號無論持有幾個角色，一律只核發一組 JWT**，多個角色以各自的 `ClaimTypes.Role` 嵌入同一 Token 中。

### 2.2 功能權限對照表

| 功能 | `employee` | `it_assignee` | `it_admin` |
|------|:----------:|:-------------:|:----------:|
| 提報新工單 | ✅ | ✅ | ✅ |
| 查看本公司工單 | ✅ | — | — |
| 查看所有公司工單 | ❌ | ✅ | ✅ |
| 上傳附件 | ✅（同公司工單）| ✅ | ✅ |
| 刪除附件 | ✅（同公司工單）| ✅ | ✅ |
| 回覆訊息 | ✅ | ✅ | ✅ |
| 更新工單狀態 | 部分（見狀態機）| ✅ | ✅ |
| 設定工單分類 | ❌ | ✅（IT 公司人員）| ✅ |
| 指派擔當者 | ❌ | ❌ | ✅ |
| 轉派工單 | ❌ | ✅（自己負責的工單）| ✅ |
| 退回要求補充 | ❌ | ✅ | ✅ |
| 結案 | ❌ | ✅（IT 公司人員）| ✅ |
| 滿意度回饋（Email 連結）| ✅（提報人）| — | — |
| 導出 Excel 報表 | ❌ | ✅ | ✅ |
| 管理 IT 人員角色 | ❌ | ❌ | ✅ |
| 管理公司 IT 旗標 | ❌ | ❌ | ✅ |
| 管理問題類型主檔 | ❌ | ❌ | ✅ |
| 管理公司系統主檔 | ❌ | ❌ | ✅ |
| 設定使用者 Windows 帳號 | ❌ | ❌ | ✅ |
| 管理附件上傳設定 | ❌ | ❌ | ✅ |

### 2.3 系統管理員（it_admin）維護範圍

`it_admin` 為可維護的動態設定，並非 IT 公司所有員工皆具備此權限。  
管理員可在「人員管理」頁面（`/admin/users`）對 IT 人員進行角色升降操作：

- 可升降：`it_admin` ↔ `it_assignee`
- **保護機制：** 不可修改自己的角色；系統確保最後一名 `it_admin` 不被降級

---

## 3. 功能需求規範

### 3.1 快速提報模組

**提報欄位：**

| 欄位 | 必填 | 說明 |
|------|:----:|------|
| 主旨（Subject） | ✅ | 單行文字，簡述問題 |
| 說明（Description） | ✅ | 多行文字，詳細描述問題 |
| 附件（Attachment） | ❌ | 支援的副檔名、MIME Type 及單檔大小上限，由 `it_admin` 透過「附件設定管理」介面動態維護（預設：Office/.docx/.xlsx、PDF、圖片；上限 20MB）；管理員亦可關閉附件上傳功能 |

**系統自動帶入欄位（由 JWT 解析）：**
- 提報人代號（EmpId）
- 提報人姓名（EmpName）
- 所屬公司代號（CompanyId）
- 所屬公司簡稱（CompanyName）
- 所屬單位代號（DepId）
- 所屬單位名稱（DepName）
- 時間戳記（CreatedAt）

**提報後自動觸發：**
- 發送 Email 通知所有 `it_admin`（系統管理員）
- 工單狀態設定為「新建立」

---

### 3.2 查詢與歷程模組

**清單頁篩選條件：**
- 狀態篩選（新建立、處理中、待使用者補充、待使用者確認、已解決、已結案）
- 日期範圍篩選
- 關鍵字搜尋（主旨、說明）
- 公司篩選（`it_admin` / `it_assignee` 可用）

**案件視角：**
- 員工：「我的案件」+ 「公司案件（主管級權限）」
- IT 人員：「全部案件」

**案件詳情頁：**
- 對話式 Timeline（時間軸顯示 IT 回應、使用者回覆、系統事件）
  - 系統事件（指派、轉派等）以灰色橫幅顯示，明確與一般回覆區隔
- 處理人員經歷（`ticket_handlers` 記錄完整轉派鏈）
- 工單分類標籤顯示（問題類型、公司別、系統別、優先等級）

---

### 3.3 管理與派工模組

**初次派工（`it_admin`）：**
- 可批次或單案指派「擔當者（`it_assignee`）」
- 指派後自動發信通知被指派人員

**轉派機制（多關卡處理）：**
- `it_admin`：可轉派任何案件給其他 IT 人員
- `it_assignee`（IT 公司）：只能轉派目前指派給自己的案件
- 轉派記錄完整保留在 `ticket_handlers` 歷史鏈中
- 轉派時自動在 Timeline 插入系統訊息、發信通知新處理人員

**退回機制：**
- IT 人員可將案件設為「待使用者補充」，要求提報人補充資訊
- IT 人員可將案件設為「待使用者確認」，請提報人確認處理結果

---

### 3.4 報表導出功能

- **非同步背景處理：** 大量資料導出採用背景 Job（避免逾時）
- **篩選條件：** 日期範圍、公司別
- **導出格式：** `.xlsx`（ClosedXML 產生）
- **權限：** 僅 `it_admin` / `it_assignee` 可操作（啟動 + 下載均需驗證角色）

**導出欄位：**

| 欄位 | 說明 |
|------|------|
| 案件編號 | GITP-YYYYMM-NNNN |
| 公司名稱 | 提報人所屬公司 |
| 提報人 | 使用者姓名 |
| 主旨 | 工單主旨 |
| 狀態 | 目前狀態 |
| 問題類型 | 分類主檔 |
| 影響公司 | 受影響的公司別 |
| 影響系統 | 受影響的系統別 |
| 嚴重度 | 1–3 |
| 緊急度 | 1–3 |
| 優先等級 | P1 / P2 / P3 |
| 提報時間 | CreatedAt |
| 首次回應時間 | FirstResponseAt |
| 結案時間 | ClosedAt |

---

## 4. 工單狀態機

### 4.1 狀態清單

| 狀態代碼 | 顯示名稱 | 說明 |
|----------|----------|------|
| `new` | 新建立 | 工單剛提報，尚未指派 |
| `in_progress` | 處理中 | 已指派擔當者，處理中 |
| `pending_user` | 待使用者補充 | 退回給提報人補充資訊 |
| `pending_confirm` | 待使用者確認 | 請提報人確認處理結果 |
| `resolved` | 已解決 | IT 人員標記解決 |
| `closed` | 已結案 | 終態，僅 IT 公司人員可設定；設定後自動觸發結案通知與滿意度調查 |

### 4.2 合法狀態轉換矩陣

**IT 人員（`it_admin` / IT 公司 `it_assignee`）：**

| 來源狀態 | 可轉換目標 |
|----------|----------|
| `new` → | `in_progress`（指派觸發）|
| `in_progress` → | `pending_user`、`pending_confirm`、`resolved` |
| `pending_user` → | `in_progress` |
| `pending_confirm` → | `in_progress`、`closed` |
| `resolved` → | `closed` |

**提報人（`employee`）：**

| 來源狀態 | 可轉換目標 |
|----------|----------|
| `pending_user` → | `in_progress`（已補充，繼續處理）|
| `pending_confirm` → | `closed`（確認解決）、`in_progress`（問題仍未解決）|
| `resolved` → | `closed` |

> **終態保護：** `closed` 為不可逆終態，任何角色均無法從 `closed` 轉換至其他狀態。

---

## 5. 多關卡處理流程

### 5.1 處理人員記錄（ticket_handlers）

每次指派、轉派事件均記錄至 `ticket_handlers`：

| 欄位 | 說明 |
|------|------|
| handler_id | 負責人員 ID |
| assigned_by | 指派人員 ID |
| action_type | `assign`（初次）/ `transfer`（轉派）/ `return`（退回）|
| note | 備註說明 |
| started_at | 接手時間 |
| ended_at | 移交時間（NULL 表示仍在負責中）|

### 5.2 標準處理流程圖

```
提報人提交工單
       ↓
   新建立（new）
       ↓
IT 管理員指派擔當者
       ↓
   處理中（in_progress）
       ↓
   ┌────────────────────────────────┐
   │ IT 擔當者操作選擇               │
   ├────────────────────────────────┤
   │ A. 轉派給其他 IT 人員           │ → 更新 assignee，紀錄轉派鏈
   │ B. 要求提報人補充資訊           │ → 待使用者補充
   │ C. 處理完成請提報人確認         │ → 待使用者確認
   │ D. 直接標記已解決               │ → 已解決
   └────────────────────────────────┘
       ↓（確認後或 IT 直接結案）
     已結案（closed）
       ↓（自動觸發）
   結案通知 Email → 提報人滿意度調查
```

---

## 6. 結案限制與 IT 公司設定

### 6.1 結案限制規則

- 只有所屬公司標記為 `is_it_company = true` 的人員可執行「結案」操作
- 雙層保護：
  - **資料庫層**：`usp_UpdateTicketStatus` 驗證請求人所屬公司旗標
  - **後端層**：Controller 將驗證失敗映射為 403 錯誤碼
  - **前端層**：非 IT 公司人員的結案按鈕不顯示

### 6.2 IT 公司設定（可維護）

- 資料庫欄位：`companies.is_it_company`（BIT，預設 0）
- 管理端點：`PUT /api/companies/{id}/it-flag`
- 管理頁面：`/admin/companies`（僅 `it_admin` 可操作）
- **保護提示：** 取消某公司 IT 旗標時，顯示影響警告

---

## 7. 問題分類模組

### 7.1 問題類型（issue_types）

可維護主檔，預設 7 種：

| 類型 |
|------|
| 硬體故障 |
| 軟體問題 |
| 網路連線 |
| 帳號權限 |
| 資安事件 |
| 系統效能 |
| 其他 |

管理：`POST /api/classification/issue-types`（Action: CREATE / UPDATE / DELETE）

### 7.2 公司系統清單（company_systems）

- 每家公司可維護獨立的系統清單
- 前端「系統別」下拉選項依「公司別」選擇動態載入（級聯選單）
- 管理：`POST /api/classification/systems`

### 7.3 嚴重度 × 緊急度優先矩陣

分類設定人員需選擇「嚴重度（1–3）」與「緊急度（1–3）」，系統自動計算優先等級。

**3×3 矩陣視覺化：**

```
          ← 嚴重度 →
          1(高)  2(中)  3(低)
        ┌──────┬──────┬──────┐
緊 1(高)│  P1  │  P1  │  P2  │
急      ├──────┼──────┼──────┤
度 2(中)│  P1  │  P2  │  P3  │
        ├──────┼──────┼──────┤
↓  3(低)│  P2  │  P3  │  P3  │
        └──────┴──────┴──────┘
```

**優先等級對照：**

| 等級 | 顯示顏色 | 說明 |
|------|:--------:|------|
| P1 緊急 | 🔴 紅 | 需立即處理 |
| P2 高 | 🟠 橘 | 需優先處理 |
| P3 一般 | 🟢 綠 | 正常排程處理 |

**計算公式：** `Priority = CEILING((嚴重度 + 緊急度 - 1) / 2)`

### 7.4 分類設定權限

| 角色 | 設定權限 |
|------|:-------:|
| `employee` | 唯讀顯示 |
| `it_assignee`（IT 公司）| ✅ 可設定 |
| `it_admin` | ✅ 可設定 |

---

## 8. 滿意度回饋機能

### 8.1 功能說明

工單進入「已結案」狀態時，系統自動觸發結案通知流程，讓提報人對本次服務進行滿意度評估。

### 8.2 回饋流程

```
工單結案（closed）
       ↓（自動觸發）
系統產生一次性 Token（GUID）並儲存於 ticket_feedbacks
       ↓
發送結案通知 Email 給提報人
  - 信件包含「✅ 滿意」與「❌ 不滿意」兩個一鍵連結
  - 連結格式：http://{FrontendBaseUrl}/feedback/{token}
       ↓
提報人點擊連結（無需登入）
  - 選擇「滿意」→ 記錄回饋結果，顯示感謝頁面
  - 選擇「不滿意」→ 記錄回饋結果
                    系統自動建立追蹤工單
                    （主旨：[不滿意追蹤] {原主旨}）
                    原工單 Timeline 插入系統訊息，載明追蹤案件編號
```

### 8.3 Token 安全機制

- Token 為一次性 GUID，回饋提交後立即失效
- 不需使用者登入，降低回饋門檻
- Token 過期後（可設定有效天數）自動失效

### 8.4 資料庫（ticket_feedbacks）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | UNIQUEIDENTIFIER | 主鍵 |
| `ticket_id` | UNIQUEIDENTIFIER | 關聯工單 |
| `token` | UNIQUEIDENTIFIER | 一次性存取 Token |
| `is_satisfied` | BIT | 滿意（1）/ 不滿意（0）/ 尚未回饋（NULL）|
| `follow_up_ticket_id` | UNIQUEIDENTIFIER | 不滿意時自動建立的追蹤工單 ID |
| `created_at` | DATETIME2 | Token 建立時間 |
| `responded_at` | DATETIME2 | 提報人回應時間 |

### 8.5 相關 Stored Procedures

| SP 名稱 | 功能 |
|---------|------|
| `usp_CreateFeedbackToken` | 結案時建立回饋 Token |
| `usp_GetFeedbackByToken` | 以 Token 取得回饋狀態（公開）|
| `usp_SubmitFeedback` | 提交回饋結果（含不滿意追蹤工單建立）|

### 8.6 前端路由（公開，無需登入）

| 路徑 | 說明 |
|------|------|
| `/feedback/:token` | 回饋頁面，顯示滿意 / 不滿意選項 |
| `/feedback/:token/satisfied` | 直接從 Email 連結帶入滿意回饋 |
| `/feedback/:token/unsatisfied` | 直接從 Email 連結帶入不滿意回饋 |

---

## 9. 身份驗證機制

### 9.1 三層驗證架構

系統採用三層遞補驗證設計，優先使用企業內網驗證，降低使用者操作成本：

| 層次 | 驗證方式 | 觸發條件 | 適用對象 |
|------|----------|----------|----------|
| 1（主要）| Windows 驗證（NTLM / Kerberos）| 系統預設優先嘗試 | 加入網域的企業內網使用者 |
| 2（備援）| 表單登入（Email + 密碼）| Windows 驗證失敗時自動顯示 | 所有使用者 |
| 3（額外）| Azure AD 登入（OIDC）| 表單登入頁面選項按鈕 | 已設定 Azure AD 租戶的環境 |

### 9.2 驗證流程

```
使用者進入系統
       ↓
前端靜默發送 GET /api/users/windows-auth（credentials: include）
       ↓
    ┌──────────────────────────┐
    │ NTLM/Kerberos 握手成功？  │
    └──────────────────────────┘
         ✅ 是                ❌ 否
          ↓                    ↓
   直接取得 GITP JWT      顯示登入頁面
   進入系統（無感）        ├── 表單登入（Email + 密碼）
                          └── Azure AD 登入按鈕（可選，依設定顯示）
                                    ↓
                              Azure AD MSAL Popup
                                    ↓
                           POST /api/users/azure-ad-login
                           （ID Token 換 GITP JWT）
```

### 9.3 Windows 驗證

- **Protocol：** NTLM / Kerberos（由 IIS / Kestrel `Negotiate` Scheme 處理）
- **帳號對應：** 管理員於後台設定每位使用者的 `windows_username`（格式：`DOMAIN\username` 或 `username@domain.local`）
- **自動推導：** 若未設定 `windows_username`，系統嘗試以 Email 前綴比對 AD 帳號名稱
- **帳號未對應：** Windows 驗證成功但 GITP 無對應使用者時，回傳 403 並顯示錯誤訊息

### 9.4 Azure AD 驗證

- **前端：** 使用 `@azure/msal-browser` Popup 流程取得 ID Token
- **後端：** 透過 OIDC metadata 驗證 ID Token，換發 GITP JWT
- **啟用條件：** `appsettings.json` 的 `AzureAd:TenantId` 與 `AzureAd:ClientId` 填入後自動啟用
- **停用條件：** 設定為空時，前端動態隱藏「Azure AD 登入」按鈕（由 `GET /api/users/auth-config` 決定）

### 9.5 LDAP 驗證（各子公司網域帳號）

說明：每家子公司可設定獨立的 LDAP 伺服器，由 IT 管理員透過管理介面設定各公司的 LDAP 連線資訊。

**設定欄位：**

| 欄位 | 說明 |
|------|------|
| LDAP 主機 IP / 主機名 | 子公司 Active Directory 伺服器位址 |
| Port | LDAP：389，LDAPS：636 |
| 使用 SSL | 是否啟用加密連線 |
| Base DN | e.g. `DC=corp,DC=local` |
| Domain Prefix | e.g. `CORP`（對應 `CORP\username` 格式）|
| UPN Suffix | e.g. `corp.local`（對應 `username@corp.local` 格式）|
| Bind DN / 密碼 | 服務帳號（可選，用於 user search）|
| 使用者 Filter | e.g. `(sAMAccountName={0})`（`{0}` = 使用者名稱）|
| 啟用 | 是否啟用此公司 LDAP |

**使用者名稱格式自動識別：**
- `CORP\username` → 依 `domain_prefix` 找到對應公司
- `username@corp.local` → 依 `upn_suffix` 找到對應公司
- 純使用者名稱 + `companyId` → 直接使用指定公司設定

**管理端點：**
- `GET /api/ldap/settings` — 取得全部公司 LDAP 設定（密碼遮罩）
- `PUT /api/ldap/settings/{companyId}` — 新增或更新 LDAP 設定（Upsert）
- `DELETE /api/ldap/settings/{companyId}` — 刪除 LDAP 設定
- `POST /api/ldap/test/{companyId}` — 測試 LDAP 連線可達性
- `POST /api/users/ldap-auth` — LDAP 驗證取得 GITP JWT（公開）

**前端管理頁面：** `/admin/ldap`（僅 `it_admin` 可操作）

---

### 9.6 JWT Token 自動更新機制

所有驗證方式最終均換發統一的 GITP JWT，並實作自動更新以避免使用者在持續使用中被強制登出。

**Token 自動更新設計：**

| 機制 | 說明 |
|------|------|
| 過期前主動更新 | 後端 `/api/users/refresh-token` 端點，Token 仍有效時可換發新 Token（re-query DB 取最新角色資訊）|
| 前端定時檢查 | `useAuth` hook 每 60 秒檢查 Token 剩餘有效時間 |
| 5 分鐘閾值 | 剩餘有效時間 < 5 分鐘時靜默向後端更新 |
| Request Interceptor | `axios` 請求攔截器於每次 API 呼叫前檢查 Token 狀態，近過期時先更新再發請求 |
| Singleton Promise | 同時觸發多次更新請求時，共享同一個 HTTP 請求，避免重複呼叫 |
| 過期後自動登出 | Token 已過期（非近過期）時直接清除 Session 並導向登入頁 |
| 更新失敗登出 | Refresh 請求失敗（例如伺服器端 Session 失效）時清除 Session |

**API 端點：** `POST /api/users/refresh-token`（需攜帶有效 JWT）

---

### 9.7 JWT 設計

- 所有驗證方式最終均換發統一的 GITP JWT
- **同一帳號無論持有幾個角色，一律只核發一組 JWT**（非每角色一組）
- JWT 過期檢查在前端 `useAuth` hook 中實作，過期後自動重新驗證

**JWT Payload 欄位：**

| Claim 欄位 | 說明 |
|-----------|------|
| `sub` | 使用者 UUID（= NameIdentifier）|
| `emp_id` | 員工代號 |
| `emp_name` | 員工姓名 |
| `company_id` | 所屬公司 UUID |
| `company_name` | 所屬公司名稱 |
| `company_code` | 所屬公司代碼（如 HQ / ALPHA）|
| `dep_id` | 所屬單位代號 |
| `dep_name` | 所屬單位名稱 |
| `is_it_company` | 是否屬於 IT 公司（"true" / "false"）|
| `created_at` | 帳號建立時間（ISO 8601）|
| `ClaimTypes.Role` | 角色 Claim（每個角色一筆，可多筆於同一 JWT）|

### 9.8 新增 API 端點

| 方法 | 路徑 | 說明 | 所需驗證 |
|------|------|------|----------|
| GET | `/api/users/windows-auth` | Windows 驗證並換發 GITP JWT | Negotiate Scheme |
| POST | `/api/users/azure-ad-login` | Azure AD ID Token 換 GITP JWT | 公開 |
| GET | `/api/users/auth-config` | 查詢啟用的驗證方式 | 公開 |
| PUT | `/api/admin/users/{id}/windows-username` | 設定使用者 Windows 帳號 | `it_admin` |
| POST | `/api/users/ldap-auth` | LDAP 驗證取得 GITP JWT | 公開 |
| POST | `/api/users/refresh-token` | 更新 JWT Token（需有效 JWT）| 登入 |

---

## 10. 統計儀表板

### 10.1 功能說明

提供 IT 公司人員查看集團各子公司問題提報狀況的統計分析視圖，支援依當月或當年進行篩選。

**存取限制：** 僅 IT 公司人員可使用（`is_it_company = true`），前端路由守衛 + 後端 403 雙層保護。

### 10.2 統計維度

**期間選擇：**
- 當月：選擇年份 + 月份
- 當年：選擇年份

**顯示內容：**

1. **整體摘要卡片**

| 指標 | 說明 |
|------|------|
| 問題總數 | 期間內全部工單數 |
| 處理中合計 | 處理中 + 待補充 + 待確認 |
| 已結案 | 已結案工單數 |
| 結案率 | 已結案 / 問題總數（%）|

2. **各子公司明細表格**

| 欄位 | 說明 |
|------|------|
| 公司名稱 | 子公司 |
| 問題總數 | 當期提報數 |
| 新建立 / 處理中 / 待補充 / 待確認 / 已解決 / 已結案 | 各狀態數量 |
| 結案率 | 已結案 / 問題總數（%，色碼標示）|
| 平均結案時數 | 已結案工單的平均處理時間（小時）|

3. **狀態分佈橫條圖**（每家公司一條）

### 10.3 前端路由

| 路徑 | 說明 | 限制 |
|------|------|------|
| `/admin/stats` | 統計儀表板頁面 | IT 公司人員 |

管理後台右上角顯示「📊 統計儀表板」導覽按鈕。

### 10.4 API 端點

| 方法 | 路徑 | 說明 | 所需驗證 |
|------|------|------|----------|
| GET | `/api/dashboard/stats?period=month&year=2026&month=3` | 查詢當月統計 | IT 公司人員 |
| GET | `/api/dashboard/stats?period=year&year=2026` | 查詢當年統計 | IT 公司人員 |

### 10.5 Stored Procedure

| SP 名稱 | 功能 |
|---------|------|
| `usp_GetTicketStats` | 依期間查詢各子公司工單統計（回傳兩個結果集：公司明細 + 整體摘要）|

**參數：** `@Period`（month/year）、`@Year`、`@Month`（月份可選）

---

## 11. 附件上傳設定管理

### 11.1 設計原則

附件的允許副檔名、MIME Type 及大小上限等規則，過去為程式碼內的硬碼設定。
v5.1 起改為由資料庫維護，`it_admin` 可透過管理介面動態調整，**無需重新部署系統**。

### 11.2 管理介面

- 前端路由：`/admin/attachment-settings`（需 `it_admin` 登入）
- 入口：管理後台右上角「📎 附件設定」按鈕

| 設定項目 | 說明 |
|----------|------|
| 開放附件上傳 | 開關，關閉後所有附件上傳入口皆顯示禁用提示 |
| 最大檔案大小（MB）| 整數，系統預設 20MB |
| 允許副檔名 | Tag 清單，例如：`.docx`、`.xlsx`、`.pdf`、`.jpg`、`.png` |
| 允許 MIME Type | Tag 清單，例如：`application/pdf`、`image/jpeg`、`image/png` |

### 11.3 驗證機制（雙層）

- **後端 `AttachmentSettingsService`**：上傳時讀取 DB 設定，驗證副檔名、MIME Type 及檔案大小；若上傳功能已關閉，直接回傳 403
- **前端 `FileUpload` 元件**：啟動時呼叫 `GET /api/attachment-settings` 取得最新設定，動態更新 `accept` 屬性及大小限制說明，上傳關閉時顯示禁用提示

### 11.4 API 端點

| 方法 | 路徑 | 說明 | 所需角色 |
|------|------|------|----------|
| GET | `/api/attachment-settings` | 取得目前設定（MIME 不含密碼等敏感欄位）| 公開（供前端初始化）|
| PUT | `/api/attachment-settings` | 更新附件上傳設定 | `it_admin` |

### 11.5 資料庫設計

**資料表：`attachment_settings`**（單一設定列，主鍵固定為 1）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | INT | 主鍵（固定值 1）|
| `is_upload_enabled` | BIT | 是否開放上傳 |
| `max_file_size_mb` | INT | 單檔大小上限（MB）|
| `allowed_extensions` | NVARCHAR(MAX) | 逗號分隔副檔名清單 |
| `allowed_mime_types` | NVARCHAR(MAX) | 逗號分隔 MIME Type 清單 |
| `updated_at` | DATETIME2 | 最後修改時間 |
| `updated_by` | UNIQUEIDENTIFIER | 最後修改人員 |

**Stored Procedures：**

| SP 名稱 | 功能 |
|---------|------|
| `usp_GetAttachmentSettings` | 取得附件設定 |
| `usp_SaveAttachmentSettings` | 更新附件設定（Upsert）|

---

## 12. 通知機制

### 12.1 Email 通知觸發點

| 觸發事件 | 收件人 | 說明 |
|----------|--------|------|
| 新工單提報 | 所有 `it_admin` | 通知管理員有待派工工單 |
| 初次指派 | 被指派的 IT 人員 | 通知該人員有新工單需處理 |
| 轉派 | 新的被指派 IT 人員 | 通知新處理人員接手 |
| 批次指派 | 被指派的 IT 人員 | 每張工單分別發送獨立通知信 |
| 工單結案 | 提報人 | 結案通知 + 滿意度調查連結 |

### 12.2 SMTP 設定

設定位置：`backend/GITP.API/appsettings.json` → `Smtp` 區塊

| 設定項 | 說明 |
|--------|------|
| `Enabled` | `true` 實際發信；`false` 僅記錄 Log（開發環境預設關閉）|
| `Host` | SMTP 伺服器位址 |
| `Port` | SMTP Port（預設 587）|
| `Username` | SMTP 帳號 |
| `Password` | SMTP 密碼 |
| `FromAddress` | 寄件人信箱 |

### 12.3 失敗處理

- SMTP 失敗時以結構化 `LogError` 記錄失敗資訊
- 不阻斷主流程（非同步觸發，`SendEmailSafeAsync` 包裝）

---

## 13. 技術架構

### 13.1 技術堆疊

| 層次 | 技術選型 |
|------|----------|
| 前端 | React 18 + Vite（PWA 架構），響應式網頁設計 |
| 後端 | .NET 10 Web API |
| ORM | Dapper 2.x（輕量 Micro-ORM，搭配 Stored Procedure）|
| 資料庫 | Microsoft SQL Server 2022 |
| 儲存體 | Azure Blob Storage / AWS S3（附件檔案）|
| 容器化 | Docker + Docker Compose |
| Email | MailKit 4.7.1（SMTP 發信）|
| Excel 導出 | ClosedXML |
| 身份驗證 | JWT（Bearer Token）+ Windows 驗證（Negotiate）+ Azure AD（MSAL / OIDC）|
| Azure AD 前端套件 | @azure/msal-browser |
| LDAP 驗證 | Novell.Directory.Ldap.NETStandard 3.6.0 |
| 後端測試 | xUnit 2.9.2 + Moq 4.20 + FluentAssertions 6.12（135 項）|
| 前端測試 | Vitest + React Testing Library（56 項）|

### 13.2 系統架構圖

```
┌─────────────────────────────────────────────────────┐
│                使用者瀏覽器（PWA）                    │
│               React 18 + Vite                        │
│                                                       │
│  驗證流程：Windows 自動驗證 → 表單登入 → Azure AD    │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS / REST API
┌──────────────────────▼──────────────────────────────┐
│               .NET 10 Web API                         │
│  ┌─────────────────────────────────────────────┐    │
│  │ Middleware                                   │    │
│  │  - JWT / Negotiate / AzureAD 三種驗證 Scheme│    │
│  │  - TenantMiddleware                         │    │
│  │    (設定 SESSION_CONTEXT → MSSQL)           │    │
│  └─────────────────────────────────────────────┘    │
│  Controllers → Services → Dapper → Stored Procedures │
└──────────────────────┬──────────────────────────────┘
                       │ T-SQL / Stored Procedures
┌──────────────────────▼──────────────────────────────┐
│              SQL Server 2022                         │
│  - Row-Level Security（RLS）                        │
│  - 35+ Stored Procedures                            │
│  - SESSION_CONTEXT 租戶隔離                          │
└─────────────────────────────────────────────────────┘
```

---

## 14. 資料庫設計

### 14.1 資料表清單

| 資料表 | 說明 |
|--------|------|
| `companies` | 公司主檔（含 `is_it_company` 旗標）|
| `users` | 使用者主檔（含 `windows_username`、`azure_ad_oid` 欄位）|
| `user_roles` | 使用者多角色關聯表（多對多）|
| `tickets` | 工單主表 |
| `ticket_messages` | 工單訊息（含 `message_type`: user / system）|
| `ticket_attachments` | 工單附件 |
| `ticket_handlers` | 工單處理人員歷史鏈 |
| `issue_types` | 問題類型主檔 |
| `company_systems` | 公司系統主檔（依公司別維護）|
| `export_jobs` | Excel 非同步導出工作記錄 |
| `ticket_feedbacks` | 工單滿意度回饋記錄 |
| `company_ldap_settings` | 各公司 LDAP 設定主檔 |
| `attachment_settings` | 附件上傳設定（副檔名、MIME Type、大小上限、開關）|

### 14.2 tickets 主要欄位

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | UNIQUEIDENTIFIER | 主鍵 |
| `ticket_no` | NVARCHAR(20) | 案件編號（GITP-YYYYMM-NNNN）|
| `company_id` | UNIQUEIDENTIFIER | 提報人所屬公司 |
| `submitter_id` | UNIQUEIDENTIFIER | 提報人 |
| `assignee_id` | UNIQUEIDENTIFIER | 目前負責人（可 NULL）|
| `subject` | NVARCHAR(200) | 主旨 |
| `description` | NVARCHAR(MAX) | 說明 |
| `status` | NVARCHAR(20) | 狀態（CHECK CONSTRAINT）|
| `issue_type_id` | UNIQUEIDENTIFIER | 問題類型（分類後填入）|
| `affected_company_id` | UNIQUEIDENTIFIER | 影響公司別 |
| `system_id` | UNIQUEIDENTIFIER | 影響系統別 |
| `severity` | TINYINT | 嚴重度（1–3）|
| `urgency` | TINYINT | 緊急度（1–3）|
| `created_at` | DATETIME2 | 提報時間 |
| `first_response_at` | DATETIME2 | 首次回應時間 |
| `closed_at` | DATETIME2 | 結案時間 |

### 14.3 users 主要欄位（含新增驗證欄位）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | UNIQUEIDENTIFIER | 主鍵 |
| `company_id` | UNIQUEIDENTIFIER | 所屬公司 |
| `name` | NVARCHAR(100) | 顯示名稱 |
| `email` | NVARCHAR(200) | 登入信箱（表單登入使用）|
| `password_hash` | NVARCHAR(MAX) | bcrypt 雜湊密碼 |
| `phone` | NVARCHAR(50) | 聯繫電話 |
| `windows_username` | NVARCHAR(200) | Windows 網域帳號（格式：`DOMAIN\username` 或 `username@domain.local`，同時支援 LDAP 帳號比對）|
| `azure_ad_oid` | NVARCHAR(100) | Azure AD 物件 ID（OID Claim）|
| `created_at` | DATETIME2 | 建立時間 |

> **備註：** `windows_username` 欄位同時用於 Windows 驗證與 LDAP 驗證的帳號比對，支援 `DOMAIN\username` 及 `username@domain.local` 兩種格式。

### 14.4 Row-Level Security（RLS）

**安全機制：**
- `TenantMiddleware` 每次請求前呼叫 `usp_SetSessionContext`，
  將 JWT 中的 `company_id`、`roles`、`user_id` 寫入 `SESSION_CONTEXT`
- `fn_ticket_filter` 述詞函數根據 Session 角色決定可見範圍：
  - `it_admin` / `it_assignee`：看所有公司工單
  - `employee`：只看 `company_id = SESSION_CONTEXT 中的 company_id`
- `TicketCompanyPolicy` 安全原則套用至 `tickets` 資料表

**重要：** RLS 已移除多餘的 `assignee_id` 條件（防止 TenantMiddleware 邊緣情況下的繞過風險）

### 14.5 Stored Procedures 清單

| SP 名稱 | 功能 |
|---------|------|
| `usp_SetSessionContext` | 設定每個請求的租戶 Session 變數 |
| `usp_AuthGetUserByEmail` | 表單登入驗證 |
| `usp_AuthGetUserByWindowsUsername` | Windows 驗證帳號對應 |
| `usp_AuthGetUserByAzureOid` | Azure AD OID 對應使用者 |
| `usp_GetUserById` | 取得使用者資訊（含多角色）|
| `usp_GetItStaff` | 取得所有 IT 人員清單 |
| `usp_GetItAdmins` | 取得所有管理員清單 |
| `usp_GetAdminUsers` | 取得管理頁面用人員清單 |
| `usp_SetUserRoles` | 原子性設定使用者多角色（含最後管理員保護）|
| `usp_SetUserWindowsUsername` | 設定使用者 Windows 帳號 |
| `usp_GetTickets` | 取得工單清單（含篩選）|
| `usp_GetTicketById` | 取得工單詳情（含分類欄位）|
| `usp_CreateTicket` | 建立新工單 |
| `usp_UpdateTicketStatus` | 更新狀態（含狀態機 + IT 公司結案驗證）|
| `usp_AssignTicket` | 指派工單 |
| `usp_BatchAssignTickets` | 批次指派工單 |
| `usp_TransferTicket` | 轉派工單 |
| `usp_GetHandlerHistory` | 取得處理人員歷史鏈 |
| `usp_AddMessage` | 新增訊息（含 system message）|
| `usp_GetMessages` | 取得工單訊息 |
| `usp_GetAttachmentById` | 取得附件資訊 |
| `usp_GetAttachmentsByTicket` | 取得工單所有附件 |
| `usp_CreateAttachment` | 建立附件記錄 |
| `usp_DeleteAttachment` | 刪除附件記錄 |
| `usp_CreateExportJob` | 建立導出工作 |
| `usp_UpdateExportJob` | 更新導出工作狀態 |
| `usp_GetExportJob` | 取得導出工作狀態 |
| `usp_GetTicketsForExport` | 取得導出用工單資料 |
| `usp_GetCompanies` | 取得公司清單（含 IT 旗標）|
| `usp_SetCompanyItFlag` | 設定公司 IT 旗標 |
| `usp_GetIssueTypes` | 取得問題類型清單 |
| `usp_ManageIssueType` | 新增/修改/刪除問題類型 |
| `usp_GetSystemsByCompany` | 依公司取得系統清單 |
| `usp_ManageCompanySystem` | 新增/修改/刪除公司系統 |
| `usp_SetTicketClassification` | 設定工單分類（含 system_id 從屬驗證）|
| `usp_CreateFeedbackToken` | 結案時建立滿意度回饋 Token |
| `usp_GetFeedbackByToken` | 以 Token 取得回饋狀態 |
| `usp_SubmitFeedback` | 提交回饋結果（含不滿意追蹤工單建立）|
| `usp_GetLdapSettings` | 取得指定公司或全部的 LDAP 設定 |
| `usp_GetLdapSettingByCompanyId` | 取得單一公司 LDAP 設定（含密碼明文，後端內部使用）|
| `usp_GetLdapSettingByDomain` | 以 domain_prefix 或 upn_suffix 解析 LDAP 設定 |
| `usp_SaveLdapSettings` | 新增或更新 LDAP 設定（Upsert）|
| `usp_DeleteLdapSettings` | 刪除 LDAP 設定 |
| `usp_AuthGetUserByWindowsUsername` | 以 Windows 帳號或 LDAP 帳號查詢使用者 |
| `usp_AuthGetOrCreateAzureAdUser` | Azure AD OID 或 Email 查詢使用者 |
| `usp_GetTicketStats` | 依月/年查詢各子公司工單統計數據 |
| `usp_GetAttachmentSettings` | 取得附件上傳設定 |
| `usp_SaveAttachmentSettings` | 更新附件上傳設定（Upsert）|

---

## 15. API 端點清單

### 15.1 身份驗證

| 方法 | 路徑 | 說明 | 所需驗證 |
|------|------|------|----------|
| POST | `/api/users/login` | 表單登入取得 JWT | 公開 |
| GET | `/api/users/windows-auth` | Windows 驗證換發 GITP JWT | Negotiate Scheme |
| POST | `/api/users/azure-ad-login` | Azure AD ID Token 換 GITP JWT | 公開 |
| GET | `/api/users/auth-config` | 查詢啟用的驗證方式 | 公開 |
| POST | `/api/users/ldap-auth` | LDAP 驗證取得 GITP JWT | 公開 |
| POST | `/api/users/refresh-token` | 更新 JWT Token（需有效 JWT）| 登入 |

### 15.2 工單管理

| 方法 | 路徑 | 說明 | 所需角色 |
|------|------|------|----------|
| GET | `/api/tickets` | 取得工單清單（含篩選）| 登入 |
| POST | `/api/tickets` | 提報新工單 | 登入 |
| GET | `/api/tickets/{id}` | 取得工單詳情 | 登入 |
| PUT | `/api/tickets/{id}/status` | 更新工單狀態 | 登入 |
| PUT | `/api/tickets/{id}/assign` | 指派擔當者 | `it_admin` |
| POST | `/api/tickets/batch-assign` | 批次指派 | `it_admin` |
| PUT | `/api/tickets/{id}/transfer` | 轉派工單 | IT 人員 |
| GET | `/api/tickets/{id}/handlers` | 取得處理人員歷史 | 登入 |
| POST | `/api/tickets/{id}/messages` | 新增訊息 | 登入 |
| GET | `/api/tickets/{id}/messages` | 取得訊息 | 登入 |

### 15.3 附件管理

| 方法 | 路徑 | 說明 | 所需角色 |
|------|------|------|----------|
| POST | `/api/attachments/{ticketId}` | 上傳附件 | 登入（同公司）|
| GET | `/api/attachments/{id}` | 下載附件 | 登入（同公司）|
| DELETE | `/api/attachments/{id}` | 刪除附件 | 登入（同公司）|

### 15.4 滿意度回饋

| 方法 | 路徑 | 說明 | 所需驗證 |
|------|------|------|----------|
| GET | `/api/feedback/{token}` | 取得回饋頁面資料 | 公開（Token）|
| POST | `/api/feedback/{token}` | 提交滿意度回饋 | 公開（Token）|

### 15.5 報表

| 方法 | 路徑 | 說明 | 所需角色 |
|------|------|------|----------|
| POST | `/api/reports/export` | 啟動 Excel 非同步導出 | IT 人員 |
| GET | `/api/reports/export/{jobId}` | 查詢導出工作狀態 | IT 人員 |
| GET | `/api/reports/export/{jobId}/download` | 下載導出結果 | IT 人員 |

### 15.6 管理功能

| 方法 | 路徑 | 說明 | 所需角色 |
|------|------|------|----------|
| GET | `/api/admin/users` | 取得 IT 人員清單 | `it_admin` |
| PUT | `/api/admin/users/{id}/roles` | 設定使用者角色（多值）| `it_admin` |
| PUT | `/api/admin/users/{id}/windows-username` | 設定使用者 Windows 帳號 | `it_admin` |
| GET | `/api/companies` | 取得公司清單 | IT 人員 |
| PUT | `/api/companies/{id}/it-flag` | 設定 IT 公司旗標 | `it_admin` |

### 15.7 問題分類

| 方法 | 路徑 | 說明 | 所需角色 |
|------|------|------|----------|
| GET | `/api/classification/issue-types` | 取得問題類型清單 | 登入 |
| POST | `/api/classification/issue-types` | 管理問題類型 | `it_admin` |
| GET | `/api/classification/systems` | 依公司取得系統清單 | 登入 |
| POST | `/api/classification/systems` | 管理公司系統 | `it_admin` |
| PUT | `/api/classification/tickets/{id}` | 設定工單分類 | IT 公司人員 |

### 15.8 LDAP 設定管理

| 方法 | 路徑 | 說明 | 所需角色 |
|------|------|------|----------|
| GET | `/api/ldap/settings` | 取得全部公司 LDAP 設定 | `it_admin` |
| PUT | `/api/ldap/settings/{companyId}` | 新增或更新 LDAP 設定 | `it_admin` |
| DELETE | `/api/ldap/settings/{companyId}` | 刪除 LDAP 設定 | `it_admin` |
| POST | `/api/ldap/test/{companyId}` | 測試 LDAP 連線 | `it_admin` |

### 15.9 統計儀表板

| 方法 | 路徑 | 說明 | 所需驗證 |
|------|------|------|----------|
| GET | `/api/dashboard/stats` | 查詢工單統計數據 | IT 公司人員 |

### 15.10 附件設定管理

| 方法 | 路徑 | 說明 | 所需角色 |
|------|------|------|----------|
| GET | `/api/attachment-settings` | 取得附件上傳設定 | 公開（供前端初始化）|
| PUT | `/api/attachment-settings` | 更新附件上傳設定 | `it_admin` |

---

## 16. 安全與效能要求

### 16.1 資料安全

| 需求 | 實作方式 |
|------|----------|
| 多租戶資料隔離 | SQL Server RLS + `SESSION_CONTEXT` 雙層保護 |
| API 層存取控制 | JWT Bearer Token + `PermissionMiddleware`（DB 驅動權限規則，5 分鐘快取）|
| 最後管理員保護 | 降級前計算剩餘 `it_admin` 數量 |
| 結案限制 | 資料庫層 + API 層雙重驗證 IT 公司旗標 |
| 報表下載保護 | 下載端點同樣需驗證 IT 人員角色 |
| 回饋 Token 安全 | 一次性 GUID，使用後立即失效 |
| Windows 驗證帳號綁定 | 管理員手動設定，防止 AD 帳號自動推導錯誤 |

### 16.2 檔案安全

- 附件上傳需通過後端病毒掃描（整合外部 AV API）
- 上傳前由 `AttachmentSettingsService` 讀取 DB 設定，動態驗證 MIME 類型、副檔名及檔案大小；上傳功能關閉時直接回傳 403
- 實際檔案儲存於 Azure Blob Storage / AWS S3，後端不直接暴露檔案路徑

### 16.3 效能優化

| 最佳化項目 | 說明 |
|----------|------|
| 資料庫索引 | `CompanyID`、`CreatedAt`、`Status`、`AssigneeID` 建立複合索引 |
| 非同步導出 | 大量資料導出採背景 Job，前端輪詢狀態 |
| 分頁查詢 | 所有清單查詢支援分頁（Offset / Fetch Next）|
| 連線工廠 | `IDbConnectionFactory` 管理資料庫連線，ExportService 使用獨立連線 |

---

## 17. 部署規格

### 17.1 Docker Compose 服務

| 服務名稱 | Image | Port | 說明 |
|----------|-------|------|------|
| `mssql` | `mcr.microsoft.com/mssql/server:2022-latest` | 1433 | SQL Server 2022 |
| `db-init` | 自訂 | — | 自動執行 init.sql + seed.sql + patch |
| `backend` | 自訂（.NET 10）| 8080 | Web API（等 db-init 完成後啟動）|
| `frontend` | 自訂（Node + Nginx）| 3000 | React PWA |

### 17.2 環境變數

**後端（backend）：**

| 變數 | 說明 |
|------|------|
| `ConnectionStrings__DefaultConnection` | MSSQL 連線字串 |
| `Jwt__SecretKey` | JWT 簽名密鑰 |
| `Jwt__Issuer` | JWT Issuer |
| `Smtp__Host` | SMTP 伺服器 |
| `Smtp__Username` | SMTP 帳號 |
| `Smtp__Password` | SMTP 密碼 |
| `Smtp__Enabled` | 是否實際發信 |
| `Storage__Provider` | `AzureBlob` / `AWSS3` |
| `Storage__ConnectionString` | 儲存服務連線字串 |
| `FrontendBaseUrl` | 前端網址（供 Email 連結使用，例如：`http://localhost:3000`）|
| `AzureAd__TenantId` | Azure AD 租戶 ID（空值時停用 Azure AD 登入）|
| `AzureAd__ClientId` | Azure AD 應用程式 ID（空值時停用 Azure AD 登入）|

### 17.3 啟動方式

```bash
cd workspaces/issue-1/artifacts/msg-46
docker compose up --build
```

**服務位址：**
- 前端 PWA：`http://localhost:3000`
- 後端 Swagger UI：`http://localhost:8080/swagger`

### 17.4 預設測試帳號（密碼均為 `secret`）

| 帳號 | 角色 | 說明 |
|------|------|------|
| `admin@gitp.local` | `it_admin` | IT 管理員 |
| `it1@gitp.local` | `it_assignee` | IT 擔當者 |
| `it2@gitp.local` | `it_assignee` | IT 擔當者 |
| `senior@gitp.local` | `it_admin` + `it_assignee` | 多角色示範 |
| `user1@alpha.local` | `employee` | Alpha 公司員工 |
| `user1@beta.local` | `employee` | Beta 公司員工 |

### 17.5 Azure AD App Registration 設定（快速參考）

1. Azure Portal → App registrations → New registration
2. 設定 Redirect URI（SPA 類型）：`http://localhost:3000`
3. Authentication → 勾選 `ID tokens`
4. 記錄 Application (client) ID 及 Directory (tenant) ID，填入 docker-compose.yml 環境變數

---

## 18. 自動化測試

### 18.1 測試概覽

| 分類 | 框架 | 測試項目數 |
|------|------|-----------|
| 後端單元測試 | xUnit 2.9.2 + Moq + FluentAssertions | 135 項 |
| 前端元件/邏輯測試 | Vitest + React Testing Library | 56 項 |
| **合計** | | **191 項** |

### 18.2 後端測試（GITP.Tests 專案）

位置：`backend/GITP.Tests/Unit/`

| 測試類別 | 測試項目數 | 涵蓋範圍 |
|----------|-----------|---------|
| `RequestingUserContextTests` | 20 | EffectiveRole 優先順序、CanCloseTicket / CanClassifyTicket 條件、多角色組合 |
| `UserModelTests` | 8 | RoleList 解析、EffectiveRole 優先順序、預設值 |
| `DtoTests` | 9 | UserDto.EffectiveRole、TicketFilterRequest 預設值、CreateTicketRequest 驗證 |
| `TicketStateMachineTests` | 36 | 完整狀態轉換矩陣、角色限制、終態保護、IT 公司結案限制 |
| `TicketsControllerTests` | 14 | 各 API 端點回傳碼、角色權限攔截 |
| `AdminRoleManagementTests` | 12 | 最後管理員保護、不可修改自己角色、多角色降級 |
| `PriorityMatrixTests` | 16 | 3×3 矩陣計算、對稱性、邊界值 |

**執行方式：**
```bash
cd backend/GITP.Tests
dotnet test
```

### 18.3 前端測試（Vitest）

位置：`frontend/src/__tests__/`

| 測試檔案 | 測試項目數 | 涵蓋範圍 |
|----------|-----------|---------|
| `components/StatusBadge.test.jsx` | 9 | 各狀態標籤顯示、未知狀態 fallback |
| `components/PriorityMatrix.test.jsx` | 9 | 3×3 格子渲染、點擊觸發、readOnly 模式 |
| `utils/jwtHelpers.test.js` | 15 | Token 解析、過期判斷、5 分鐘近期更新門檻 |
| `hooks/authLogic.test.js` | 10 | hasRole 多角色查詢、resolveEffectiveRole 優先順序 |
| `utils/priorityMatrix.test.js` | 13 | 3×3 公式驗證、對稱性、範圍 |

**執行方式：**
```bash
cd frontend
npm test
```

### 18.4 一鍵執行全部測試

專案根目錄提供 `run_tests.sh`：
```bash
bash run_tests.sh
```

### 18.5 方案檔整合

後端測試專案已納入 `backend/GITP.sln`，Visual Studio 可直接執行測試總管。

---

## 附錄：修訂履歷

### 版本異動摘要表

| 版本 | 日期 | 負責人 | 文件狀態 | 異動摘要 |
|------|------|--------|----------|----------|
| v1.0 | 2026-03-30 | Chang Iris | 初稿 | 系統初始規格（快速提報、查詢、管理、報表、Docker 部署）|
| v1.1 | 2026-03-30 | Chang Iris | 修訂 | 新增 Email 通知機制（新工單 / 指派通知）；新增 IT 人員角色管理功能 |
| v1.2 | 2026-03-30 | Chang Iris | 修訂 | 邏輯矛盾修正（狀態機轉換規則、批次指派 Email、最後管理員保護、報表下載權限等共 9 項）|
| v1.3 | 2026-03-30 | Chang Iris | 修訂 | 資料庫遷移至 MSSQL Server 2022；所有資料庫操作改由 Stored Procedure 處理 |
| v1.4 | 2026-03-30 | Chang Iris | 修訂 | 使用者角色支援多值（`user_roles` 關聯表，JWT 多 Claim）|
| v1.5 | 2026-03-30 | Chang Iris | 修訂 | 多關卡處理流程（轉派機制、`ticket_handlers` 歷史鏈、`pending_confirm` 新狀態）|
| v1.6 | 2026-03-30 | Chang Iris | 修訂 | 結案限制（僅 IT 公司人員可結案）；新增 IT 公司旗標可維護設定 |
| v2.0 | 2026-03-31 | Chang Iris | 修訂 | 問題分類模組（問題類型、公司系統主檔、3×3 嚴重度×緊急度優先矩陣）|
| v2.1 | 2026-03-31 | Chang Iris | 修訂 | 滿意度回饋機能（結案通知 Email、一次性 Token 回饋、不滿意自動建立追蹤工單）|
| v3.0 | 2026-03-31 | Chang Iris | 修訂 | 三層驗證機制（Windows 驗證主要 / 表單備援 / Azure AD 額外選項）；`users` 資料表新增 `windows_username`、`azure_ad_oid` 欄位 |
| v3.1 | 2026-03-31 | Chang Iris | 修訂 | LDAP 各子公司獨立驗證設定；各子公司 LDAP 主機 IP 可維護 |
| v3.2 | 2026-03-31 | Chang Iris | 修訂 | JWT Token 自動更新機制（前端定時檢查、Request Interceptor 靜默更新）|
| v4.0 | 2026-03-31 | Chang Iris | 修訂 | 統計儀表板（依月/年查詢各子公司工單數量與狀態分佈）；全版本整合完成 |
| v4.1 | 2026-03-31 | Chang Iris | 修訂 | 新增自動化測試（後端 xUnit 135 項 + 前端 Vitest 56 項，合計 191 項）；建立 GITP.Tests 專案並納入方案檔 |
| v5.0 | 2026-03-31 | Chang Iris | 修訂 | 後端升級至 .NET 10；前端測試整合至主專案目錄；自動化測試章節加入規格書 |
| v5.1 | 2026-03-31 | Chang Iris | 正式版 | 附件上傳設定可維護化（副檔名、MIME Type、大小上限、開關由 `it_admin` 透過管理介面動態設定）；新增第 11 章；規格書版本補齊修訂履歷 |
| v5.2 | 2026-03-31 | Chang Iris | 正式版 | JWT 確保一帳號一 Token；JWT Payload 新增 `emp_id`/`emp_name`/`company_id`/`company_name`/`company_code`/`dep_id`/`dep_name`/`created_at`；users 資料表新增員工代號、單位欄位；新增本機架設操作說明書（SETUP_GUIDE.md）|
| v5.3 | 2026-03-31 | Copilot | 修訂 | 代碼審查修正：狀態機 IT 人員不得直接由「處理中」結案；報表下載端點開放 it_assignee；init.sql CLEANUP DROP TABLE 順序修正（company_systems/issue_types 移至 tickets 後）；TicketsController HTTP 方法修正（PATCH 狀態、POST 指派）；App.jsx 新增回饋自動提交路由；docker-compose 補上 FrontendBaseUrl 環境變數 |
| v5.4 | 2026-03-31 | Copilot | 修訂 | Fix: IT 人員可直接由「處理中」結案（非強制需等提報人確認）；Add: 新增 Permission Middleware（DB 驅動權限控管 + API 稽核日誌）；Fix: RESTful API 規範修正（Classification CRUD 獨立端點、Reports `exports`、Attachments 路由、Tickets assign PUT、batch-assignments）|
| v5.5 | 2026-03-31 | Copilot | 修訂 | 全面代碼審查修正：users 資料表補齊 `windows_username`/`azure_ad_oid`/`is_active` 欄位；CLEANUP 補齊 ticket_feedbacks/company_ldap_settings；seed.sql 指派端點 HTTP 方法修正；AttachmentsController 多角色支援；Program.cs 移除重複 DI；client.js 移除廢棄函式 |
| v5.6 | 2026-03-31 | Copilot | 修訂 | 全面代碼審查（v5.6）：**[CRITICAL]** init.sql CLEANUP DROP 順序修正——`ticket_feedbacks`（FK → tickets）移至 tickets 之前；`company_ldap_settings`（FK → companies）移至 companies 之前；**[SERIOUS]** ExportService.ProcessExportAsync 參數名修正（`Role` → `Roles`，符合 usp_SetSessionContext 宣告）；**[SERIOUS]** usp_GetExportJob 加入 `@RequestedBy`/`@IsItStaff` 預設值，解決 ExportService.GetJobStatusAsync 缺參數導致 SP 執行失敗問題；**[MINOR]** usp_GetTicketsForExport 補上 `@Status` 參數；**[MINOR]** 規格書 16.1 安全需求修正：API 存取控制說明由 `[Authorize(Roles=...)]` 改為 `PermissionMiddleware`（實際實作） |
| v5.7 | 2026-04-01 | Copilot | 修訂 | 全面代碼審查（v5.7）：**[JWT 安全]** UsersController.GenerateJwt() 移除對每個角色重複加入 `new Claim("role", role)`——`ClaimTypes.Role` 已由 JwtSecurityTokenHandler 自動映射為 `"role"`，重複加入導致 JWT payload 出現冗餘欄位；**[代碼一致性]** DashboardController.cs `DynamicParameters.Add()` 移除 `@` 前綴（`"@Period"` → `"Period"` 等），與全系統 Dapper 呼叫慣例一致；**[文件錯誤]** PriorityMatrixTests.cs docstring 修正——`(2,3)` / `(3,2)` 依公式結果為 P2，非 P3 |

### 各版本詳細說明

#### v1.0（2026-03-30）— 系統初版

- 功能需求：快速提報（主旨、說明、附件）、查詢與歷程（Timeline）、管理與派工（批次指派、退回）、報表導出（Excel 非同步）
- 技術架構：React 18 PWA + .NET 8 Web API + PostgreSQL + Docker Compose
- 角色：`employee`、`it_assignee`、`it_admin`

#### v1.1（2026-03-30）— 通知機制 & 人員管理

- 新增 Email 通知（新工單通知所有 `it_admin`；指派後通知被指派人）
- 新增 IT 人員角色升降管理介面（`/admin/users`）
- 保護機制：不可修改自己角色；確保最後一名 `it_admin` 不可被降級

#### v1.2（2026-03-30）— 邏輯矛盾修正（9 項）

- 建立狀態機轉換矩陣（依角色限制）
- 批次指派改為每張工單各發一封通知信
- 最後管理員保護
- 下載端點補足 IT 角色驗證
- 員工存取工單一律以 `CompanyId` 為基準
- 移除 RLS 多餘的 `assignee_id` 條件

#### v1.3（2026-03-30）— MSSQL + Stored Procedure

- 資料庫從 PostgreSQL 遷移至 SQL Server 2022
- 所有 DB 操作改由 Stored Procedure 處理（共 23 支 SP）
- 後端改用 Dapper 取代 EF Core；Row-Level Security 改用 MSSQL SESSION_CONTEXT 實作
- Docker Compose 改用 `mcr.microsoft.com/mssql/server:2022-latest`

#### v1.4（2026-03-30）— 多角色支援

- 新增 `user_roles` 關聯表，使用者可同時持有多個角色
- JWT 每個角色獨立發行一筆 `ClaimTypes.Role`
- `EffectiveRole` 屬性依優先順序（`it_admin` > `it_assignee` > `employee`）計算最高權限
- 前端角色編輯改為勾選框（checkbox），一次可選多個角色

#### v1.5（2026-03-30）— 多關卡處理流程

- 新增 `ticket_handlers` 資料表，記錄完整轉派鏈歷史
- 新增轉派機制（`PUT /api/tickets/{id}/transfer`）
- 新增「待使用者確認」狀態（提報人確認處理結果後結案）
- 轉派、指派自動在 Timeline 插入灰色系統訊息

#### v1.6（2026-03-30）— IT 公司結案限制

- `companies` 新增 `is_it_company` 旗標，可由管理員設定
- 結案操作雙層保護：後端 `CanCloseTicket` + 資料庫 `usp_UpdateTicketStatus` 檢查旗標
- 前端結案按鈕依 `is_it_company` 動態顯示；非 IT 公司人員顯示警示提示
- 新增公司管理頁面（`/admin/companies`）

#### v2.0（2026-03-31）— 問題分類模組

- 新增問題類型主檔（`issue_types`）及公司系統主檔（`company_systems`），可動態維護
- 工單新增分類欄位：`issue_type_id`、`affected_company_id`、`system_id`、`severity`、`urgency`
- 嚴重度 × 緊急度 3×3 優先矩陣，公式：`CEILING((S + U - 1) / 2)`，分三個等級（P1/P2/P3）
- 前端 `ClassificationPanel` 元件含聯動下拉；`PriorityMatrix` 元件可互動選取
- 新增分類設定管理頁面（`/admin/classification`）

#### v2.1（2026-03-31）— 滿意度回饋機能

- 結案後自動寄送結案通知 Email 給提報人（含滿意 / 不滿意一鍵連結）
- 提報人點擊連結開啟公開回饋頁（`/feedback/{token}`），無需登入
- Token 為一次性 GUID，回饋後立即失效
- 選擇「不滿意」時系統自動建立追蹤工單，原工單 Timeline 記錄追蹤編號
- 新增 `ticket_feedbacks` 資料表

#### v3.0（2026-03-31）— 三層驗證機制

- 主要：Windows 驗證（NTLM/Kerberos），瀏覽器自動完成，使用者無感知
- 備援：表單登入（Email + 密碼）
- 額外：Azure AD 登入（MSAL Popup 流程，後端設定後動態顯示按鈕）
- `users` 新增 `windows_username`、`azure_ad_oid` 欄位
- 所有驗證方式通過後一律換發 GITP JWT，後續功能統一以 Bearer Token 驗證

#### v3.1（2026-03-31）— 各子公司 LDAP 設定

- 新增 `company_ldap_settings` 資料表，每家公司可設定獨立 LDAP 伺服器（主機 IP、Port、SSL、Domain 等）
- 新增 `LdapService`，依帳號格式（`DOMAIN\user` 或 `user@domain.local`）自動識別對應公司 LDAP 伺服器
- 新增「測試連線」功能，確認伺服器可達性
- 前端新增 LDAP 設定管理頁面（`/admin/ldap`）及 LDAP 登入頁籤

#### v3.2（2026-03-31）— JWT 自動更新

- 後端新增 `POST /api/users/refresh-token` 端點（需有效 JWT，重新核發新 Token）
- 前端 `useAuth` Hook 每 60 秒自動檢查：Token 已過期則登出；5 分鐘內到期則靜默更新
- `client.js` Request Interceptor：每次 API 請求前主動偵測是否快過期，若是則先更新再發請求

#### v4.0（2026-03-31）— 統計儀表板 & 全版本整合

- 新增 `usp_GetTicketStats` SP，支援依月/年查詢各子公司工單數量與狀態分佈
- 前端統計儀表板（`/admin/stats`）：期間選擇器、整體摘要卡片、各公司明細表格、結案率色碼
- 限 IT 公司人員使用（前端守衛 + 後端 `is_it_company` 驗證）
- 全版本（msg-5 至 msg-44）整合為單一完整專案（msg-46）

#### v4.1（2026-03-31）— 自動化測試

- 新增後端 xUnit 測試專案 `GITP.Tests`（135 項，7 個測試類別）
- 新增前端 Vitest 測試（56 項，5 個測試檔案）
- 測試納入 `backend/GITP.sln` 方案檔，Visual Studio 可直接執行

#### v5.0（2026-03-31）— .NET 10 升級

- 後端 TargetFramework 由 `net8.0` 升級至 `net10.0`
- Docker base image 改用 `mcr.microsoft.com/dotnet/aspnet:10.0`
- 前端測試整合至主專案 `src/__tests__/` 目錄
- 規格書補齊自動化測試章節（第 17 章）

#### v5.1（2026-03-31）— 附件設定可維護化

- 移除程式碼中硬碼的附件限制（副檔名清單、MIME Type、大小上限）
- 新增 `attachment_settings` 資料表及 `usp_GetAttachmentSettings` / `usp_SaveAttachmentSettings` 兩支 SP
- 新增 `AttachmentSettingsService`，上傳時動態讀取 DB 設定驗證
- 前端 `FileUpload` 元件改為動態取得設定；關閉時顯示禁用提示
- 新增附件設定管理頁面（`/admin/attachment-settings`），`it_admin` 可維護
- 新增規格書第 11 章（附件上傳設定管理）
- 補齊本附錄修訂履歷

#### v5.2（2026-03-31）— JWT 欄位強化 & 架設說明書

- **JWT 一帳號一 Token：** 確保同一帳號無論持有幾個角色，一律只核發一組 JWT；多角色以各自 `ClaimTypes.Role` Claim 嵌入同一 Token
- **JWT Payload 欄位新增：** `emp_id`（員工代號）、`emp_name`（員工姓名）、`company_id`、`company_name`、`company_code`（公司代碼）、`dep_id`（單位代號）、`dep_name`（單位名稱）、`created_at`（帳號建立時間）
- **資料庫：** `users` 資料表新增 `emp_id`、`dep_id`、`dep_name` 欄位；相關 Stored Procedures 同步更新
- **Seed 資料：** 測試帳號補齊員工代號與單位資訊
- **新增 `SETUP_GUIDE.md`：** 本機架設操作說明書，包含 Docker 啟動、測試帳號、常見問題排解、本機直接開發說明

#### v5.3（2026-03-31）— 代碼審查修正

- **狀態機修正（`usp_UpdateTicketStatus`）：** 移除 IT 人員由「處理中」直接轉為「已結案」的非法轉換；IT 人員結案路徑僅為「已解決 → 已結案」（且須為 IT 公司人員）
- **報表下載端點授權修正（`ReportsController`）：** 新增匯出查詢與下載端點對 `it_assignee` 角色的存取權；移除 `DownloadExport` 內使用 `FindFirstValue` 的錯誤手動角色判斷（會在多角色用戶身上失效）
- **資料庫 CLEANUP 順序修正（`init.sql`）：** 將 `company_systems` 與 `issue_types` 的 DROP TABLE 移至 `tickets` 之後，修正因 FK 約束導致 init.sql 重複執行時失敗的問題
- **前後端 HTTP 方法一致性（`TicketsController`）：** 工單狀態更新由 `PUT` 改為 `PATCH`；工單指派由 `PUT` 改為 `POST`，與前端 `client.js` 的呼叫方式一致
- **回饋頁自動提交路由（`App.jsx`）：** 新增 `/feedback/:token/:action` 路由，使結案 Email 中的「滿意/不滿意」一鍵連結可正確開啟並自動提交
- **`docker-compose.yml` 補上 `FrontendBaseUrl`：** 後端 `FeedbackService` 發送的 Email 連結所需的前端根網址

#### v5.5（2026-03-31）— 全面代碼審查修正

- **資料庫 `users` 資料表補齊欄位：** 將 `windows_username`、`azure_ad_oid`（Windows/Azure AD 登入用）與 `is_active`（帳號啟用旗標，原被 Windows Auth SP 引用但未定義）直接加入 `CREATE TABLE users`；移除後段重複的 `ALTER TABLE` PATCH 段落
- **資料庫 CLEANUP 補齊：** `ticket_feedbacks` 與 `company_ldap_settings` 兩張資料表原未列入 CLEANUP 的 DROP TABLE，導致重複執行 init.sql 時無法重建；已補齊
- **資料庫 unique index 整合：** `UQ_users_windows_username`、`UQ_users_azure_ad_oid` 過濾索引移至主要 INDEXES 區段定義，與其他索引統一管理
- **`seed.sql` api_permissions 修正：** `TicketsController` 指派端點（`[HttpPut("{id:guid}/assign")]`）的 HTTP 方法為 `PUT`，但 seed 資料誤填 `POST`，已修正
- **`AttachmentsController` 多角色支援修正：** `GetUser()` 原只讀取第一筆 `ClaimTypes.Role` Claim（`FindFirstValue`），多角色使用者可能被誤判為非 IT 人員；已改用 `FindAll(ClaimTypes.Role)` 收集所有角色，正確判斷 IT staff 身份
- **`Program.cs` 移除重複 DI 登錄：** `TicketService` 以 `ITicketService` 登錄已足夠，原額外的具體型別 `AddScoped<TicketService>()` 會在每個請求多建立一個無用實例；已移除
- **`client.js` 移除廢棄函式 `updateUserRole`：** 呼叫的端點 `/admin/users/{id}/role`（單數）已不存在，所有前端使用均已改用 `updateUserRoles`（複數，正確端點），已移除廢棄函式以避免混淆
