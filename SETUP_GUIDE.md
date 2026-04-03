# GITP 系統本機架設操作說明書

版本：1.0  
適用版本：msg-56（.NET 10 + MSSQL + React 18 PWA）

---

## 1. 系統需求

### 必要安裝軟體

| 軟體 | 版本需求 | 下載連結 |
|------|---------|---------|
| **Docker Desktop** | ≥ 4.x | https://www.docker.com/products/docker-desktop/ |
| **Docker Compose** | ≥ 2.x（Docker Desktop 內建） | 隨 Docker Desktop 附帶 |
| **Git** | 任意版本 | https://git-scm.com/ |

> **注意：** Docker Desktop 已內建 Docker Compose v2，安裝 Docker Desktop 後即可使用 `docker compose` 指令。

### 若需要本機直接開發（非 Docker）

| 軟體 | 版本需求 | 下載連結 |
|------|---------|---------|
| **.NET SDK** | 10.0 | https://dotnet.microsoft.com/download/dotnet/10.0 |
| **Node.js** | ≥ 20 LTS | https://nodejs.org/ |
| **SQL Server** | 2019 / 2022，或 Azure SQL | https://www.microsoft.com/sql-server |
| **Visual Studio 2022** | 選填，可用 VS Code 替代 | https://visualstudio.microsoft.com/ |
| **VS Code** | 選填 | https://code.visualstudio.com/ |

---

## 2. 使用 Docker 啟動（推薦方式）

### 2.1 確認 Docker 已啟動

```bash
docker --version
docker compose version
```

預期輸出範例：
```
Docker version 27.x.x
Docker Compose version v2.x.x
```

### 2.2 取得專案

```bash
git clone <your-repo-url>
cd workspaces/issue-1/artifacts/msg-56
```

### 2.3 設定環境變數（選填）

預設值已可直接啟動，若需自訂請複製並編輯：

```bash
cp .env.example .env
```

`.env` 可覆蓋的設定：

```env
# JWT 密鑰（正式環境必須修改）
JWT_KEY=GITP_DEFAULT_SECRET_KEY_CHANGE_IN_PRODUCTION_32CHARS_MINIMUM

# JWT 有效時數（預設 8 小時）
JWT_EXPIRY_HOURS=8

# MSSQL SA 密碼（必須符合 MSSQL 複雜度要求）
SA_PASSWORD=GITPdev2024!

# 前端 Base URL（用於 Email 回饋連結）
FRONTEND_BASE_URL=http://localhost:3000

# SMTP（選填，不設定則僅記錄 log）
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=gitp@your-domain.com

# Azure AD（選填，不設定則停用 Azure AD 登入）
AZURE_AD_TENANT_ID=
AZURE_AD_CLIENT_ID=
```

### 2.4 啟動服務

```bash
docker compose up --build
```

第一次啟動會：
1. 下載 MSSQL Server 2022 映像（約 1.5 GB，需等待）
2. 建置 .NET 10 後端映像
3. 建置 React 18 前端映像
4. 自動執行 `init.sql`（建立資料庫結構）
5. 自動執行 `seed.sql`（載入測試資料）

啟動完成後，控制台會顯示：
```
gitp-frontend  | 🚀 Frontend serving at http://0.0.0.0:80
gitp-backend   | Now listening on: http://0.0.0.0:8080
```

### 2.5 存取系統

| 服務 | 網址 |
|------|------|
| 前端 PWA | http://localhost:3000 |
| 後端 Swagger UI | http://localhost:8080/swagger |

---

## 3. 測試帳號

> 所有帳號密碼均為：`secret`

| 帳號 | 角色 | 公司 | 員工代號 | 單位 |
|------|------|------|---------|------|
| admin@gitp.local | IT 管理員（it_admin） | 集團總部 | HQ001 | 資訊部 |
| it1@gitp.local | IT 擔當者（it_assignee） | 集團總部 | HQ002 | 資訊部 |
| it2@gitp.local | IT 擔當者（it_assignee） | 集團總部 | HQ003 | 資訊部 |
| senior@gitp.local | IT 管理員 + IT 擔當者（多角色） | 集團總部 | HQ004 | 資訊部 |
| user1@alpha.local | 子公司員工（employee） | Alpha 製造公司 | ALP001 | 製造部 |
| user2@alpha.local | 子公司員工（employee） | Alpha 製造公司 | ALP002 | 工程部 |
| user1@beta.local | 子公司員工（employee） | Beta 服務公司 | BET001 | 服務部 |
| user2@beta.local | 子公司員工（employee） | Beta 服務公司 | BET002 | 營運部 |

---

## 4. 確認服務正常

### 4.1 前端

瀏覽器開啟 http://localhost:3000，應顯示登入頁面。

### 4.2 後端 API

```bash
curl http://localhost:8080/health
```

預期回應：`Healthy`

### 4.3 資料庫連線

```bash
docker exec -it gitp-db /opt/mssql-tools/bin/sqlcmd \
  -S localhost -U sa -P "GITPdev2024!" \
  -Q "SELECT name FROM sys.databases"
```

預期顯示 `gitpdb` 資料庫名稱。

---

## 5. 常見問題排解

### Q1：Docker 啟動後 db-init 容器一直 restart

**原因：** MSSQL 尚未完全就緒，db-init 會自動重試。  
**處理：** 等待約 30–60 秒，MSSQL 就緒後會自動完成初始化。

```bash
docker compose logs db-init
```

### Q2：前端 http://localhost:3000 連線被拒

**原因：** frontend 服務尚未完成建置。  
**處理：** 查看 log，等待 `Frontend serving` 訊息出現。

```bash
docker compose logs frontend
```

### Q3：登入後顯示「帳號或密碼錯誤」

**原因：** 種子資料尚未載入完成，或資料庫初始化失敗。  
**處理：**
```bash
docker compose logs db-init   # 確認 init.sql / seed.sql 已執行
docker compose restart backend  # 重啟後端
```

### Q4：要重新初始化資料庫

```bash
docker compose down -v   # 刪除所有容器與資料卷
docker compose up --build
```

### Q5：修改程式碼後重新建置

```bash
docker compose up --build backend   # 只重建後端
docker compose up --build frontend  # 只重建前端
```

---

## 6. 本機直接開發（不使用 Docker）

### 6.1 後端

```bash
cd backend
dotnet restore
dotnet build GITP.sln

# 設定連線字串（複製 appsettings.json 並修改）
cp GITP.API/appsettings.json GITP.API/appsettings.Development.json
```

編輯 `appsettings.Development.json`，修改 `ConnectionStrings:DefaultConnection`：

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost,1433;Database=gitpdb;User Id=sa;Password=YourPassword;TrustServerCertificate=True;"
  }
}
```

```bash
dotnet run --project GITP.API
```

### 6.2 前端

```bash
cd frontend
npm install
npm run dev
```

前端開發伺服器預設在 http://localhost:5173。  
API proxy 設定於 `vite.config.js`，已預設轉發至 `http://localhost:8080`。

### 6.3 執行測試

```bash
# 後端 xUnit 測試
cd backend
dotnet test GITP.Tests

# 前端 Vitest 測試
cd frontend
npm test
```

---

## 7. 生產環境注意事項

1. **修改 JWT 密鑰：** `appsettings.json` 中 `Jwt:Key` 必須改為不少於 32 字元的隨機字串。
2. **修改 MSSQL SA 密碼：** `docker-compose.yml` 中 `SA_PASSWORD` 必須符合 MSSQL 密碼複雜度規則。
3. **啟用 SMTP：** 在 `appsettings.json` 中設定 `Smtp:Enabled: true` 及相關設定。
4. **HTTPS：** 正式環境應在反向代理（如 nginx、Azure Application Gateway）層終結 TLS。
5. **Azure AD（選填）：** 在 `appsettings.json` 中填入 `AzureAd:TenantId` 與 `AzureAd:ClientId`。
