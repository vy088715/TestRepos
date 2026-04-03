# GITP - 集團跨公司 IT 問題反應平台

集團跨公司 IT 問題反應平台（GITP）是一套讓集團旗下各公司員工向 IT 部門提報問題、追蹤處理進度的全端解決方案。支援多角色、多公司、工單轉派、問題分類及優先度矩陣等完整功能。

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 24+
- [Docker Compose](https://docs.docker.com/compose/) v2.20+

## 快速啟動

```bash
docker compose up --build
```

首次啟動需要約 1-2 分鐘完成資料庫初始化。

## 服務位址

| 服務 | URL |
|------|-----|
| 前端（React） | http://localhost:3000 |
| 後端 API（ASP.NET Core） | http://localhost:8080 |
| Swagger API 文件 | http://localhost:8080/swagger |
| 資料庫（MSSQL） | localhost:1433 |

> 注意：nginx 會在 3000 port 將 `/api` 請求反向代理至後端，因此前端可以直接呼叫 `/api`。

## 測試帳號

所有帳號密碼皆為 `secret`。

| 角色 | Email | 密碼 | 公司 |
|------|-------|------|------|
| IT 管理員 | admin@gitp.local | secret | 集團總部 (IT公司) |
| IT 人員 | staff1@gitp.local | secret | 集團總部 (IT公司) |
| IT 人員 | staff2@gitp.local | secret | 集團總部 (IT公司) |
| 一般使用者 | user1@alpha.local | secret | Alpha 製造公司 |
| 一般使用者 | user2@alpha.local | secret | Alpha 製造公司 |
| 一般使用者 | user1@beta.local | secret | Beta 服務公司 |

## 功能清單

- **多公司支援**：Row-Level Security 確保各公司只能看到自己的工單
- **多角色**：`employee`（一般員工）、`it_assignee`（IT 人員）、`it_admin`（IT 管理員）
- **工單管理**：建立、查詢、篩選、狀態更新、批次指派
- **工單轉派**：IT 人員之間可互相轉派工單，完整保留轉派歷程
- **問題分類**：IT 人員可設定問題類型、所屬公司系統、嚴重度 × 緊急度（3×3 優先度矩陣）
- **IT 公司結案限制**：只有 IT 公司的處理人員才能將工單結案
- **檔案附件**：上傳附件（最大 20MB）
- **訊息對話**：工單內雙向對話，支援 IT 回覆標記
- **匯出報表**：Excel 報表非同步產生與下載
- **電子郵件通知**：可設定 SMTP 寄送通知（預設停用）

## 系統架構

```
frontend (React 18 + Vite)
    ↓ HTTP /api/*
nginx (port 3000)
    ↓ proxy
backend (ASP.NET Core 8 + Dapper)  (port 8080)
    ↓ SQL
MSSQL Server 2022  (port 1433)
```

### 技術棧

| 層級 | 技術 |
|------|------|
| 前端 | React 18、React Router 6、Axios、Day.js |
| 後端 | ASP.NET Core 8、Dapper、BCrypt.Net |
| 資料庫 | SQL Server 2022（Docker）、Row-Level Security |
| 容器化 | Docker、Docker Compose |
| 認證 | JWT Bearer Token |

## 停止服務

```bash
docker compose down
# 若要同時刪除資料庫 volume：
docker compose down -v
```
