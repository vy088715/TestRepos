-- ============================================================
-- GITP - 集團跨公司 IT 問題反應平台
-- Database Initialization Script
-- Target: SQL Server 2022
-- v5: 問題分類功能
--     - issue_types: 問題類型主檔
--     - company_systems: 各公司系統清單
--     - tickets: 新增 issue_type_id, affected_company_id, system_id, severity, urgency
--     - usp_GetIssueTypes/usp_ManageIssueType
--     - usp_GetSystemsByCompany/usp_ManageCompanySystem
--     - usp_SetTicketClassification
--     v4: IT 公司結案限制
--     - companies.is_it_company: 標記哪些公司是 IT 公司
--     - usp_UpdateTicketStatus: 結案需由 IT 公司人員執行
--     - usp_GetCompanies: 查詢公司清單（含 is_it_company 旗標）
--     - usp_SetCompanyItFlag: 管理員設定/取消 IT 公司旗標
--     - usp_AuthGetUserByEmail: 回傳 is_it_company 供 JWT 使用
-- ============================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================
-- 1. CLEANUP (reverse FK order)
-- ============================================================

IF OBJECT_ID('dbo.usp_SetTicketClassification', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_SetTicketClassification;
GO
IF OBJECT_ID('dbo.usp_ManageCompanySystem', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_ManageCompanySystem;
GO
IF OBJECT_ID('dbo.usp_GetSystemsByCompany', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_GetSystemsByCompany;
GO
IF OBJECT_ID('dbo.usp_ManageIssueType', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_ManageIssueType;
GO
IF OBJECT_ID('dbo.usp_GetIssueTypes', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_GetIssueTypes;
GO
-- company_systems and issue_types are referenced by tickets (FK) so they must be dropped
-- AFTER tickets; we only remove the security policy here and defer the table drops below.
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'TicketCompanyPolicy' AND schema_id = SCHEMA_ID('dbo'))
    DROP SECURITY POLICY dbo.TicketCompanyPolicy;
GO
IF OBJECT_ID('dbo.usp_SetCompanyItFlag', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_SetCompanyItFlag;
GO
IF OBJECT_ID('dbo.usp_GetCompanies', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_GetCompanies;
GO
IF OBJECT_ID('dbo.usp_SaveAttachmentSettings', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_SaveAttachmentSettings;
GO
IF OBJECT_ID('dbo.usp_GetAttachmentSettings', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_GetAttachmentSettings;
GO
IF OBJECT_ID('dbo.attachment_settings', 'U') IS NOT NULL DROP TABLE dbo.attachment_settings;
GO
IF OBJECT_ID('dbo.export_jobs',      'U') IS NOT NULL DROP TABLE dbo.export_jobs;
GO
IF OBJECT_ID('dbo.attachments',      'U') IS NOT NULL DROP TABLE dbo.attachments;
GO
IF OBJECT_ID('dbo.ticket_messages',  'U') IS NOT NULL DROP TABLE dbo.ticket_messages;
GO
IF OBJECT_ID('dbo.ticket_handlers',  'U') IS NOT NULL DROP TABLE dbo.ticket_handlers;
GO
-- ticket_feedbacks references tickets (FK), must drop before tickets
IF OBJECT_ID('dbo.ticket_feedbacks', 'U') IS NOT NULL DROP TABLE dbo.ticket_feedbacks;
GO
IF OBJECT_ID('dbo.tickets',          'U') IS NOT NULL DROP TABLE dbo.tickets;
GO
-- company_systems and issue_types had FK references FROM tickets; safe to drop now
IF OBJECT_ID('dbo.company_systems', 'U') IS NOT NULL DROP TABLE dbo.company_systems;
GO
IF OBJECT_ID('dbo.issue_types', 'U') IS NOT NULL DROP TABLE dbo.issue_types;
GO
IF OBJECT_ID('dbo.user_roles',       'U') IS NOT NULL DROP TABLE dbo.user_roles;
GO
IF OBJECT_ID('dbo.users',            'U') IS NOT NULL DROP TABLE dbo.users;
GO
-- company_ldap_settings references companies (FK), must drop before companies
IF OBJECT_ID('dbo.company_ldap_settings', 'U') IS NOT NULL DROP TABLE dbo.company_ldap_settings;
GO
IF OBJECT_ID('dbo.companies',        'U') IS NOT NULL DROP TABLE dbo.companies;
GO
IF OBJECT_ID('dbo.fn_ticket_filter', 'IF') IS NOT NULL DROP FUNCTION dbo.fn_ticket_filter;
GO
IF OBJECT_ID('dbo.ticket_seq',       'SO') IS NOT NULL DROP SEQUENCE dbo.ticket_seq;
GO
IF OBJECT_ID('dbo.usp_CreateApiAuditLog',  'P') IS NOT NULL DROP PROCEDURE dbo.usp_CreateApiAuditLog;
GO
IF OBJECT_ID('dbo.usp_SaveApiPermission',  'P') IS NOT NULL DROP PROCEDURE dbo.usp_SaveApiPermission;
GO
IF OBJECT_ID('dbo.usp_GetApiPermissions',  'P') IS NOT NULL DROP PROCEDURE dbo.usp_GetApiPermissions;
GO
IF OBJECT_ID('dbo.api_audit_logs',   'U') IS NOT NULL DROP TABLE dbo.api_audit_logs;
GO
IF OBJECT_ID('dbo.api_permissions',  'U') IS NOT NULL DROP TABLE dbo.api_permissions;
GO

-- ============================================================
-- 2. TABLES
-- ============================================================

-- ---- companies ----
CREATE TABLE dbo.companies (
    id             UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    name           NVARCHAR(200)    NOT NULL,
    code           NVARCHAR(50)     NOT NULL,
    is_it_company  BIT              NOT NULL DEFAULT 0,
    created_at     DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT PK_companies      PRIMARY KEY (id),
    CONSTRAINT UQ_companies_code UNIQUE (code)
);
GO

-- ---- users ----
CREATE TABLE dbo.users (
    id               UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    company_id       UNIQUEIDENTIFIER NOT NULL,
    name             NVARCHAR(100)    NOT NULL,
    email            NVARCHAR(200)    NOT NULL,
    phone            NVARCHAR(50)     NULL,
    emp_id           NVARCHAR(50)     NULL,   -- 員工代號
    dep_id           NVARCHAR(50)     NULL,   -- 所屬單位代號
    dep_name         NVARCHAR(100)    NULL,   -- 所屬單位名稱
    sso_id           NVARCHAR(200)    NULL,
    password_hash    NVARCHAR(500)    NULL,
    windows_username NVARCHAR(200)    NULL,   -- AD/LDAP 帳號（如 CORP\john.doe）
    azure_ad_oid     NVARCHAR(100)    NULL,   -- Azure AD Object ID
    is_active        BIT              NOT NULL DEFAULT 1,
    created_at       DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT PK_users         PRIMARY KEY (id),
    CONSTRAINT UQ_users_email   UNIQUE (email),
    CONSTRAINT FK_users_company FOREIGN KEY (company_id) REFERENCES dbo.companies(id)
);
GO

-- ---- user_roles ----
CREATE TABLE dbo.user_roles (
    user_id UNIQUEIDENTIFIER NOT NULL,
    role    NVARCHAR(50)     NOT NULL,
    CONSTRAINT PK_user_roles      PRIMARY KEY (user_id, role),
    CONSTRAINT FK_user_roles_user FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE,
    CONSTRAINT CK_user_roles_role CHECK (role IN ('employee', 'it_assignee', 'it_admin'))
);
GO

-- ---- tickets ----
CREATE TABLE dbo.tickets (
    id                UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    ticket_no         NVARCHAR(20)     NOT NULL,
    company_id        UNIQUEIDENTIFIER NOT NULL,
    submitter_id      UNIQUEIDENTIFIER NOT NULL,
    assignee_id       UNIQUEIDENTIFIER NULL,
    subject           NVARCHAR(500)    NOT NULL,
    description       NVARCHAR(MAX)    NOT NULL,
    status            NVARCHAR(20)     NOT NULL DEFAULT N'\u65b0\u5efa\u7acb',
    created_at        DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    first_response_at DATETIME2        NULL,
    closed_at         DATETIME2        NULL,
    updated_at        DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    issue_type_id       UNIQUEIDENTIFIER NULL,
    affected_company_id UNIQUEIDENTIFIER NULL,
    system_id           UNIQUEIDENTIFIER NULL,
    severity            TINYINT          NULL,
    urgency             TINYINT          NULL,
    CONSTRAINT PK_tickets           PRIMARY KEY (id),
    CONSTRAINT UQ_tickets_ticket_no UNIQUE (ticket_no),
    CONSTRAINT FK_tickets_company        FOREIGN KEY (company_id)          REFERENCES dbo.companies(id),
    CONSTRAINT FK_tickets_submitter      FOREIGN KEY (submitter_id)        REFERENCES dbo.users(id),
    CONSTRAINT FK_tickets_assignee       FOREIGN KEY (assignee_id)         REFERENCES dbo.users(id),
    CONSTRAINT FK_tickets_issue_type     FOREIGN KEY (issue_type_id)       REFERENCES dbo.issue_types(id),
    CONSTRAINT FK_tickets_affected_co    FOREIGN KEY (affected_company_id) REFERENCES dbo.companies(id),
    CONSTRAINT FK_tickets_system         FOREIGN KEY (system_id)           REFERENCES dbo.company_systems(id),
    CONSTRAINT CK_tickets_severity       CHECK (severity IS NULL OR severity BETWEEN 1 AND 3),
    CONSTRAINT CK_tickets_urgency        CHECK (urgency  IS NULL OR urgency  BETWEEN 1 AND 3),
    CONSTRAINT CK_tickets_status    CHECK (status IN (
        N'\u65b0\u5efa\u7acb', N'\u8655\u7406\u4e2d', N'\u5f85\u4f7f\u7528\u8005\u88dc\u5145',
        N'\u5f85\u4f7f\u7528\u8005\u78ba\u8a8d', N'\u5df2\u89e3\u6c7a', N'\u5df2\u7d50\u6848'
    ))
);
GO

-- ---- ticket_handlers (handler chain history) ----
CREATE TABLE dbo.ticket_handlers (
    id           UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    ticket_id    UNIQUEIDENTIFIER NOT NULL,
    handler_id   UNIQUEIDENTIFIER NOT NULL,
    assigned_by  UNIQUEIDENTIFIER NOT NULL,
    assigned_at  DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    released_at  DATETIME2        NULL,
    note         NVARCHAR(MAX)    NULL,
    action_type  NVARCHAR(20)     NOT NULL DEFAULT N'\u521d\u6b21\u6307\u6d3e',
    CONSTRAINT PK_ticket_handlers          PRIMARY KEY (id),
    CONSTRAINT FK_ticket_handlers_ticket   FOREIGN KEY (ticket_id)   REFERENCES dbo.tickets(id),
    CONSTRAINT FK_ticket_handlers_handler  FOREIGN KEY (handler_id)  REFERENCES dbo.users(id),
    CONSTRAINT FK_ticket_handlers_assigner FOREIGN KEY (assigned_by) REFERENCES dbo.users(id),
    CONSTRAINT CK_ticket_handlers_action   CHECK (action_type IN (N'\u521d\u6b21\u6307\u6d3e', N'\u8f49\u6d3e', N'\u9000\u56de\u63d0\u5831\u4eba'))
);
GO

-- ---- ticket_messages ----
CREATE TABLE dbo.ticket_messages (
    id           UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    ticket_id    UNIQUEIDENTIFIER NOT NULL,
    author_id    UNIQUEIDENTIFIER NOT NULL,
    content      NVARCHAR(MAX)    NOT NULL,
    is_it_reply  BIT              NOT NULL DEFAULT 0,
    message_type NVARCHAR(20)     NOT NULL DEFAULT 'reply',
    created_at   DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT PK_ticket_messages PRIMARY KEY (id),
    CONSTRAINT FK_messages_ticket FOREIGN KEY (ticket_id) REFERENCES dbo.tickets(id),
    CONSTRAINT FK_messages_author FOREIGN KEY (author_id) REFERENCES dbo.users(id),
    CONSTRAINT CK_messages_type   CHECK (message_type IN ('reply', 'system'))
);
GO

-- ---- attachments ----
CREATE TABLE dbo.attachments (
    id           UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    ticket_id    UNIQUEIDENTIFIER NOT NULL,
    filename     NVARCHAR(500)    NOT NULL,
    storage_path NVARCHAR(1000)   NOT NULL,
    size_bytes   BIGINT           NOT NULL,
    content_type NVARCHAR(200)    NULL,
    uploaded_at  DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT PK_attachments        PRIMARY KEY (id),
    CONSTRAINT FK_attachments_ticket FOREIGN KEY (ticket_id) REFERENCES dbo.tickets(id)
);
GO

-- ---- attachment_settings ----
CREATE TABLE dbo.attachment_settings (
    id                  INT              NOT NULL DEFAULT 1,
    upload_enabled      BIT              NOT NULL DEFAULT 1,
    allowed_extensions  NVARCHAR(500)    NOT NULL DEFAULT N'.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.bmp,.zip',
    allowed_mime_types  NVARCHAR(1000)   NOT NULL DEFAULT N'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,image/jpeg,image/png,image/gif,image/bmp,application/zip',
    max_file_size_bytes BIGINT           NOT NULL DEFAULT 20971520,
    updated_at          DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    updated_by          UNIQUEIDENTIFIER NULL,
    CONSTRAINT PK_attachment_settings PRIMARY KEY (id),
    CONSTRAINT CK_attachment_settings_id CHECK (id = 1)
);
GO
INSERT INTO dbo.attachment_settings (id, upload_enabled, allowed_extensions, allowed_mime_types, max_file_size_bytes)
VALUES (1, 1,
    N'.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.bmp,.zip',
    N'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,image/jpeg,image/png,image/gif,image/bmp,application/zip',
    20971520);
GO

-- ---- export_jobs ----
CREATE TABLE dbo.export_jobs (
    id           UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    requested_by UNIQUEIDENTIFIER NOT NULL,
    status       NVARCHAR(50)     NOT NULL DEFAULT 'pending',
    filters_json NVARCHAR(MAX)    NULL,
    result_path  NVARCHAR(1000)   NULL,
    created_at   DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    completed_at DATETIME2        NULL,
    CONSTRAINT PK_export_jobs      PRIMARY KEY (id),
    CONSTRAINT FK_export_jobs_user FOREIGN KEY (requested_by) REFERENCES dbo.users(id)
);
GO

-- ---- issue_types ----
CREATE TABLE dbo.issue_types (
    id         UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    name       NVARCHAR(100)    NOT NULL,
    sort_order INT              NOT NULL DEFAULT 0,
    is_active  BIT              NOT NULL DEFAULT 1,
    created_at DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT PK_issue_types      PRIMARY KEY (id),
    CONSTRAINT UQ_issue_types_name UNIQUE (name)
);
GO

-- ---- company_systems ----
CREATE TABLE dbo.company_systems (
    id         UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    company_id UNIQUEIDENTIFIER NOT NULL,
    name       NVARCHAR(200)    NOT NULL,
    sort_order INT              NOT NULL DEFAULT 0,
    is_active  BIT              NOT NULL DEFAULT 1,
    created_at DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT PK_company_systems          PRIMARY KEY (id),
    CONSTRAINT FK_company_systems_company  FOREIGN KEY (company_id) REFERENCES dbo.companies(id) ON DELETE CASCADE
);
GO

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX IX_tickets_company_id         ON dbo.tickets(company_id);
CREATE INDEX IX_tickets_created_at         ON dbo.tickets(created_at);
CREATE INDEX IX_tickets_status             ON dbo.tickets(status);
CREATE INDEX IX_tickets_submitter_id       ON dbo.tickets(submitter_id);
CREATE INDEX IX_ticket_handlers_ticket_id  ON dbo.ticket_handlers(ticket_id);
CREATE INDEX IX_ticket_handlers_handler_id ON dbo.ticket_handlers(handler_id);
CREATE INDEX IX_ticket_messages_ticket_id  ON dbo.ticket_messages(ticket_id);
CREATE INDEX IX_attachments_ticket_id      ON dbo.attachments(ticket_id);
CREATE INDEX IX_user_roles_role            ON dbo.user_roles(role);
CREATE UNIQUE INDEX UQ_users_windows_username ON dbo.users(windows_username) WHERE windows_username IS NOT NULL;
CREATE UNIQUE INDEX UQ_users_azure_ad_oid     ON dbo.users(azure_ad_oid)     WHERE azure_ad_oid     IS NOT NULL;
GO

CREATE INDEX IX_tickets_issue_type_id        ON dbo.tickets(issue_type_id);
CREATE INDEX IX_tickets_affected_company_id  ON dbo.tickets(affected_company_id);
CREATE INDEX IX_tickets_system_id            ON dbo.tickets(system_id);
CREATE INDEX IX_tickets_severity_urgency     ON dbo.tickets(severity, urgency);
CREATE INDEX IX_company_systems_company_id   ON dbo.company_systems(company_id);
GO

-- ============================================================
-- 4. SEQUENCE
-- ============================================================

CREATE SEQUENCE dbo.ticket_seq START WITH 1000 INCREMENT BY 1;
GO

-- ============================================================
-- 5. RLS FUNCTION AND POLICY
-- ============================================================

CREATE FUNCTION dbo.fn_ticket_filter(@company_id UNIQUEIDENTIFIER)
RETURNS TABLE WITH SCHEMABINDING AS RETURN
SELECT 1 AS result WHERE
    CHARINDEX('it_admin',    CAST(SESSION_CONTEXT(N'roles') AS NVARCHAR(500))) > 0
    OR CHARINDEX('it_assignee', CAST(SESSION_CONTEXT(N'roles') AS NVARCHAR(500))) > 0
    OR @company_id = TRY_CAST(SESSION_CONTEXT(N'company_id') AS UNIQUEIDENTIFIER);
GO

CREATE SECURITY POLICY dbo.TicketCompanyPolicy
    ADD FILTER PREDICATE dbo.fn_ticket_filter(company_id) ON dbo.tickets,
    ADD BLOCK PREDICATE  dbo.fn_ticket_filter(company_id) ON dbo.tickets AFTER INSERT
WITH (STATE = ON);
GO

-- ============================================================
-- 6. STORED PROCEDURES
-- ============================================================

-- SP 1: usp_SetSessionContext
IF OBJECT_ID('dbo.usp_SetSessionContext', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_SetSessionContext;
GO
CREATE PROCEDURE dbo.usp_SetSessionContext
    @CompanyId NVARCHAR(100) = NULL,
    @UserId    NVARCHAR(100) = NULL,
    @Roles     NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    EXEC sp_set_session_context N'company_id', @CompanyId;
    EXEC sp_set_session_context N'roles',      @Roles;
    EXEC sp_set_session_context N'user_id',    @UserId;
END
GO

-- SP 2: usp_AuthGetUserByEmail
IF OBJECT_ID('dbo.usp_AuthGetUserByEmail', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_AuthGetUserByEmail;
GO
CREATE PROCEDURE dbo.usp_AuthGetUserByEmail
    @Email NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.id, u.company_id, u.name, u.email, u.phone,
        u.emp_id, u.dep_id, u.dep_name, u.created_at,
        ISNULL(STRING_AGG(ur.role, ','), 'employee') AS roles,
        u.password_hash, c.name AS company_name, c.code AS company_code, c.is_it_company
    FROM dbo.users u
    INNER JOIN dbo.companies c   ON u.company_id = c.id
    LEFT  JOIN dbo.user_roles ur ON ur.user_id = u.id
    WHERE u.email = @Email
    GROUP BY u.id, u.company_id, u.name, u.email, u.phone,
             u.emp_id, u.dep_id, u.dep_name, u.created_at,
             u.password_hash, c.name, c.code, c.is_it_company;
END
GO

-- SP 3: usp_GetUserById
IF OBJECT_ID('dbo.usp_GetUserById', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_GetUserById;
GO
CREATE PROCEDURE dbo.usp_GetUserById
    @UserId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.id, u.company_id, u.name, u.email, u.phone,
        u.emp_id, u.dep_id, u.dep_name, u.created_at,
        ISNULL(STRING_AGG(ur.role, ','), 'employee') AS roles,
        c.name AS company_name, c.code AS company_code, c.is_it_company
    FROM dbo.users u
    INNER JOIN dbo.companies c   ON u.company_id = c.id
    LEFT  JOIN dbo.user_roles ur ON ur.user_id = u.id
    WHERE u.id = @UserId
    GROUP BY u.id, u.company_id, u.name, u.email, u.phone,
             u.emp_id, u.dep_id, u.dep_name, u.created_at,
             c.name, c.code, c.is_it_company;
END
GO

-- SP 4: usp_GetItStaff
IF OBJECT_ID('dbo.usp_GetItStaff', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_GetItStaff;
GO
CREATE PROCEDURE dbo.usp_GetItStaff
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.id, u.name, u.email,
        ISNULL(STRING_AGG(ur_all.role, ','), 'employee') AS roles,
        u.company_id, c.name AS company_name
    FROM dbo.users u
    INNER JOIN dbo.companies c    ON u.company_id = c.id
    INNER JOIN dbo.user_roles ur_it  ON ur_it.user_id = u.id
        AND ur_it.role IN ('it_admin', 'it_assignee')
    LEFT  JOIN dbo.user_roles ur_all ON ur_all.user_id = u.id
    GROUP BY u.id, u.name, u.email, u.company_id, c.name
    ORDER BY u.name;
END
GO

-- SP 5: usp_GetItAdmins
IF OBJECT_ID('dbo.usp_GetItAdmins', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_GetItAdmins;
GO
CREATE PROCEDURE dbo.usp_GetItAdmins
AS
BEGIN
    SET NOCOUNT ON;
    SELECT DISTINCT u.email, u.name
    FROM dbo.users u
    INNER JOIN dbo.user_roles ur ON ur.user_id = u.id
    WHERE ur.role = 'it_admin';
END
GO

-- SP 6: usp_GetAdminUsers
IF OBJECT_ID('dbo.usp_GetAdminUsers', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_GetAdminUsers;
GO
CREATE PROCEDURE dbo.usp_GetAdminUsers
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.id, u.name, u.email, u.phone,
        ISNULL(STRING_AGG(ur_all.role, ','), 'employee') AS roles,
        u.company_id, c.name AS company_name
    FROM dbo.users u
    INNER JOIN dbo.companies c    ON u.company_id = c.id
    INNER JOIN dbo.user_roles ur_it  ON ur_it.user_id = u.id
        AND ur_it.role IN ('it_admin', 'it_assignee')
    LEFT  JOIN dbo.user_roles ur_all ON ur_all.user_id = u.id
    GROUP BY u.id, u.name, u.email, u.phone, u.company_id, c.name
    ORDER BY u.name;
END
GO

-- SP 7: usp_SetUserRoles
IF OBJECT_ID('dbo.usp_UpdateUserRole', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_UpdateUserRole;
GO
IF OBJECT_ID('dbo.usp_SetUserRoles',   'P') IS NOT NULL DROP PROCEDURE dbo.usp_SetUserRoles;
GO
CREATE PROCEDURE dbo.usp_SetUserRoles
    @UserId      UNIQUEIDENTIFIER,
    @Roles       NVARCHAR(500),
    @RequesterId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    IF @UserId = @RequesterId
    BEGIN SELECT 1 AS Code; RETURN; END

    CREATE TABLE #NewRoles (role NVARCHAR(50));
    INSERT INTO #NewRoles (role)
    SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@Roles, ',')
    WHERE LEN(LTRIM(RTRIM(value))) > 0;

    IF EXISTS (SELECT 1 FROM #NewRoles WHERE role NOT IN ('employee','it_assignee','it_admin'))
    BEGIN DROP TABLE #NewRoles; SELECT 3 AS Code; RETURN; END

    IF EXISTS (SELECT 1 FROM dbo.user_roles WHERE user_id = @UserId AND role = 'it_admin')
       AND NOT EXISTS (SELECT 1 FROM #NewRoles WHERE role = 'it_admin')
    BEGIN
        DECLARE @Remaining INT;
        SELECT @Remaining = COUNT(DISTINCT ur.user_id) FROM dbo.user_roles ur
        WHERE ur.role = 'it_admin' AND ur.user_id != @UserId;
        IF @Remaining < 1
        BEGIN DROP TABLE #NewRoles; SELECT 2 AS Code; RETURN; END
    END

    DELETE FROM dbo.user_roles WHERE user_id = @UserId;
    INSERT INTO dbo.user_roles (user_id, role) SELECT @UserId, role FROM #NewRoles;
    DROP TABLE #NewRoles;
    SELECT 0 AS Code;
END
GO

-- SP 8: usp_GetTickets
IF OBJECT_ID('dbo.usp_GetTickets', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_GetTickets;
GO
CREATE PROCEDURE dbo.usp_GetTickets
    @Status               NVARCHAR(20)     = NULL,
    @StartDate            DATETIME2        = NULL,
    @EndDate              DATETIME2        = NULL,
    @Keyword              NVARCHAR(500)    = NULL,
    @MyTickets            BIT              = 0,
    @CompanyIdFilter      UNIQUEIDENTIFIER = NULL,
    @Page                 INT              = 1,
    @PageSize             INT              = 20,
    @RequestingUserId     UNIQUEIDENTIFIER,
    @RequestingRole       NVARCHAR(50),
    @RequestingCompanyId  UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Offset INT = (@Page - 1) * @PageSize;

    SELECT t.id, t.ticket_no, t.subject, t.status,
        t.company_id, t.submitter_id, t.assignee_id,
        t.created_at, t.first_response_at, t.closed_at,
        c.name AS CompanyName, su.name AS SubmitterName, au.name AS AssigneeName
    INTO #TicketBase
    FROM dbo.tickets t
    INNER JOIN dbo.companies c  ON t.company_id   = c.id
    INNER JOIN dbo.users     su ON t.submitter_id = su.id
    LEFT  JOIN dbo.users     au ON t.assignee_id  = au.id
    WHERE
        (@Status    IS NULL OR t.status      = @Status)
        AND (@StartDate IS NULL OR t.created_at >= @StartDate)
        AND (@EndDate   IS NULL OR t.created_at <= @EndDate)
        AND (@Keyword   IS NULL
             OR t.subject LIKE '%' + @Keyword + '%'
             OR t.description LIKE '%' + @Keyword + '%')
        AND (
            (@RequestingRole IN ('it_admin','it_assignee')
             AND (@CompanyIdFilter IS NULL OR t.company_id = @CompanyIdFilter))
            OR (@RequestingRole = 'employee' AND @MyTickets = 1
                AND t.submitter_id = @RequestingUserId)
            OR (@RequestingRole = 'employee' AND @MyTickets = 0
                AND t.company_id = @RequestingCompanyId)
        );

    DECLARE @TotalCount INT;
    SELECT @TotalCount = COUNT(*) FROM #TicketBase;
    SELECT @TotalCount AS TotalCount;

    SELECT id AS Id, ticket_no AS TicketNo, subject AS Subject, status AS Status,
        CompanyName, SubmitterName, AssigneeName,
        created_at AS CreatedAt, first_response_at AS FirstResponseAt, closed_at AS ClosedAt
    FROM #TicketBase
    ORDER BY created_at DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;

    DROP TABLE #TicketBase;
END
GO

-- SP 9: usp_GetTicketById
IF OBJECT_ID('dbo.usp_GetTicketById', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_GetTicketById;
GO
CREATE PROCEDURE dbo.usp_GetTicketById
    @TicketId            UNIQUEIDENTIFIER,
    @RequestingUserId    UNIQUEIDENTIFIER,
    @RequestingRole      NVARCHAR(50),
    @RequestingCompanyId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @TicketCompanyId UNIQUEIDENTIFIER;
    SELECT @TicketCompanyId = company_id FROM dbo.tickets WHERE id = @TicketId;

    IF @TicketCompanyId IS NULL
       OR (@RequestingRole NOT IN ('it_admin','it_assignee')
           AND @TicketCompanyId != @RequestingCompanyId)
    BEGIN
        SELECT TOP 0
            CAST(NULL AS UNIQUEIDENTIFIER) AS Id, CAST(NULL AS NVARCHAR(20)) AS TicketNo,
            CAST(NULL AS NVARCHAR(500)) AS Subject, CAST(NULL AS NVARCHAR(MAX)) AS Description,
            CAST(NULL AS NVARCHAR(20)) AS Status, CAST(NULL AS UNIQUEIDENTIFIER) AS CompanyId,
            CAST(NULL AS NVARCHAR(200)) AS CompanyName, CAST(NULL AS UNIQUEIDENTIFIER) AS SubmitterId,
            CAST(NULL AS NVARCHAR(100)) AS SubmitterName, CAST(NULL AS NVARCHAR(200)) AS SubmitterEmail,
            CAST(NULL AS NVARCHAR(50)) AS SubmitterPhone, CAST(NULL AS UNIQUEIDENTIFIER) AS AssigneeId,
            CAST(NULL AS NVARCHAR(100)) AS AssigneeName, CAST(NULL AS NVARCHAR(200)) AS AssigneeEmail,
            CAST(NULL AS DATETIME2) AS CreatedAt, CAST(NULL AS DATETIME2) AS FirstResponseAt,
            CAST(NULL AS DATETIME2) AS ClosedAt, CAST(NULL AS DATETIME2) AS UpdatedAt
        WHERE 1 = 0;
        SELECT TOP 0 CAST(NULL AS UNIQUEIDENTIFIER) AS Id WHERE 1=0;
        SELECT TOP 0 CAST(NULL AS UNIQUEIDENTIFIER) AS Id WHERE 1=0;
        RETURN;
    END

    SELECT
        t.id AS Id, t.ticket_no AS TicketNo, t.subject AS Subject, t.description AS Description,
        t.status AS Status, t.company_id AS CompanyId, c.name AS CompanyName,
        t.submitter_id AS SubmitterId, su.name AS SubmitterName,
        su.email AS SubmitterEmail, su.phone AS SubmitterPhone,
        t.assignee_id AS AssigneeId, au.name AS AssigneeName, au.email AS AssigneeEmail,
        t.created_at AS CreatedAt, t.first_response_at AS FirstResponseAt,
        t.closed_at AS ClosedAt, t.updated_at AS UpdatedAt,
        t.issue_type_id AS IssueTypeId, it_t.name AS IssueTypeName,
        t.affected_company_id AS AffectedCompanyId, ac.name AS AffectedCompanyName,
        t.system_id AS SystemId, cs.name AS SystemName,
        t.severity AS Severity, t.urgency AS Urgency
    FROM dbo.tickets t
    INNER JOIN dbo.companies c  ON t.company_id   = c.id
    INNER JOIN dbo.users     su ON t.submitter_id = su.id
    LEFT  JOIN dbo.users     au ON t.assignee_id  = au.id
    LEFT  JOIN dbo.issue_types     it_t ON t.issue_type_id       = it_t.id
    LEFT  JOIN dbo.companies       ac   ON t.affected_company_id = ac.id
    LEFT  JOIN dbo.company_systems cs   ON t.system_id           = cs.id
    WHERE t.id = @TicketId;

    SELECT m.id AS Id, m.ticket_id AS TicketId, m.author_id AS AuthorId,
        u.name AS AuthorName, m.content AS Content,
        m.is_it_reply AS IsItReply, m.message_type AS MessageType, m.created_at AS CreatedAt
    FROM dbo.ticket_messages m
    INNER JOIN dbo.users u ON m.author_id = u.id
    WHERE m.ticket_id = @TicketId ORDER BY m.created_at ASC;

    SELECT a.id AS Id, a.ticket_id AS TicketId, a.filename AS Filename,
        a.size_bytes AS SizeBytes, a.content_type AS ContentType, a.uploaded_at AS UploadedAt
    FROM dbo.attachments a WHERE a.ticket_id = @TicketId ORDER BY a.uploaded_at ASC;
END
GO

-- SP 10: usp_CreateTicket
IF OBJECT_ID('dbo.usp_CreateTicket', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_CreateTicket;
GO
CREATE PROCEDURE dbo.usp_CreateTicket
    @CompanyId   UNIQUEIDENTIFIER,
    @SubmitterId UNIQUEIDENTIFIER,
    @Subject     NVARCHAR(500),
    @Description NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @NewId    UNIQUEIDENTIFIER = NEWID();
    DECLARE @TicketNo NVARCHAR(20) =
        'GITP-' + FORMAT(GETUTCDATE(), 'yyyyMM') + '-'
        + RIGHT('0000' + CAST(NEXT VALUE FOR dbo.ticket_seq AS NVARCHAR(10)), 4);

    INSERT INTO dbo.tickets
        (id, ticket_no, company_id, submitter_id, subject, description, status, created_at, updated_at)
    VALUES
        (@NewId, @TicketNo, @CompanyId, @SubmitterId, @Subject, @Description, N'新建立', GETUTCDATE(), GETUTCDATE());

    SELECT
        t.id AS Id, t.ticket_no AS TicketNo, t.subject AS Subject, t.description AS Description,
        t.status AS Status, t.company_id AS CompanyId, c.name AS CompanyName,
        t.submitter_id AS SubmitterId, su.name AS SubmitterName,
        su.email AS SubmitterEmail, su.phone AS SubmitterPhone,
        t.assignee_id AS AssigneeId,
        CAST(NULL AS NVARCHAR(100)) AS AssigneeName,
        CAST(NULL AS NVARCHAR(200)) AS AssigneeEmail,
        t.created_at AS CreatedAt, t.first_response_at AS FirstResponseAt,
        t.closed_at AS ClosedAt, t.updated_at AS UpdatedAt
    FROM dbo.tickets t
    INNER JOIN dbo.companies c  ON t.company_id   = c.id
    INNER JOIN dbo.users     su ON t.submitter_id = su.id
    WHERE t.id = @NewId;

    SELECT TOP 0
        CAST(NULL AS UNIQUEIDENTIFIER) AS Id, CAST(NULL AS UNIQUEIDENTIFIER) AS TicketId,
        CAST(NULL AS UNIQUEIDENTIFIER) AS AuthorId, CAST(NULL AS NVARCHAR(100)) AS AuthorName,
        CAST(NULL AS NVARCHAR(MAX)) AS Content, CAST(NULL AS BIT) AS IsItReply,
        CAST(NULL AS NVARCHAR(20)) AS MessageType, CAST(NULL AS DATETIME2) AS CreatedAt
    WHERE 1 = 0;

    SELECT TOP 0
        CAST(NULL AS UNIQUEIDENTIFIER) AS Id, CAST(NULL AS UNIQUEIDENTIFIER) AS TicketId,
        CAST(NULL AS NVARCHAR(500)) AS Filename, CAST(NULL AS BIGINT) AS SizeBytes,
        CAST(NULL AS NVARCHAR(200)) AS ContentType, CAST(NULL AS DATETIME2) AS UploadedAt
    WHERE 1 = 0;
END
GO

-- SP 11: usp_UpdateTicketStatus (with 待使用者確認 state)
IF OBJECT_ID('dbo.usp_UpdateTicketStatus', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_UpdateTicketStatus;
GO
CREATE PROCEDURE dbo.usp_UpdateTicketStatus
    @TicketId         UNIQUEIDENTIFIER,
    @NewStatus        NVARCHAR(20),
    @RequestingUserId UNIQUEIDENTIFIER,
    @RequestingRole   NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @CurrentStatus NVARCHAR(20);
    DECLARE @SubmitterId   UNIQUEIDENTIFIER;
    SELECT @CurrentStatus = status, @SubmitterId = submitter_id
    FROM dbo.tickets WHERE id = @TicketId;

    IF @CurrentStatus IS NULL
    BEGIN SELECT 1 AS Code; RETURN; END

    IF @CurrentStatus = N'已結案'
    BEGIN SELECT 3 AS Code; RETURN; END

    DECLARE @IsItStaff BIT = CASE WHEN @RequestingRole IN ('it_admin','it_assignee') THEN 1 ELSE 0 END;
    DECLARE @IsValid   BIT = 0;

    IF @IsItStaff = 1
    BEGIN
        IF  (@CurrentStatus = N'新建立'  AND @NewStatus = N'處理中')
         OR (@CurrentStatus = N'處理中'  AND @NewStatus IN (N'待使用者補充', N'待使用者確認', N'已解決', N'已結案'))
         OR (@CurrentStatus = N'待使用者補充'  AND @NewStatus = N'處理中')
         OR (@CurrentStatus = N'待使用者確認'  AND @NewStatus = N'處理中')
         OR (@CurrentStatus = N'已解決'  AND @NewStatus = N'已結案')
            SET @IsValid = 1;
    END
    ELSE
    BEGIN
        IF @SubmitterId = @RequestingUserId
        BEGIN
            IF  (@CurrentStatus = N'待使用者補充'  AND @NewStatus = N'處理中')
             OR (@CurrentStatus = N'待使用者確認'  AND @NewStatus IN (N'已結案', N'處理中'))
             OR (@CurrentStatus = N'已解決'  AND @NewStatus = N'已結案')
                SET @IsValid = 1;
        END
    END

    IF @IsValid = 0
    BEGIN
        IF @IsItStaff = 0 AND @SubmitterId != @RequestingUserId
            SELECT 2 AS Code;
        ELSE
            SELECT 3 AS Code;
        RETURN;
    END

    -- Code 5: Only IT company personnel can close tickets
    IF @NewStatus = N'已結案'
    BEGIN
        DECLARE @RequesterIsItCompany BIT = 0;
        SELECT @RequesterIsItCompany = c.is_it_company
        FROM dbo.users u
        INNER JOIN dbo.companies c ON u.company_id = c.id
        WHERE u.id = @RequestingUserId;

        IF ISNULL(@RequesterIsItCompany, 0) = 0
        BEGIN
            SELECT 5 AS Code;
            RETURN;
        END
    END

    UPDATE dbo.tickets
    SET status     = @NewStatus,
        updated_at = GETUTCDATE(),
        closed_at  = CASE WHEN @NewStatus = N'已結案' THEN GETUTCDATE() ELSE closed_at END
    WHERE id = @TicketId;

    SELECT 0 AS Code;

    SELECT t.id AS Id, t.ticket_no AS TicketNo, t.subject AS Subject, t.description AS Description,
        t.status AS Status, t.company_id AS CompanyId, c.name AS CompanyName,
        t.submitter_id AS SubmitterId, su.name AS SubmitterName,
        su.email AS SubmitterEmail, su.phone AS SubmitterPhone,
        t.assignee_id AS AssigneeId, au.name AS AssigneeName, au.email AS AssigneeEmail,
        t.created_at AS CreatedAt, t.first_response_at AS FirstResponseAt,
        t.closed_at AS ClosedAt, t.updated_at AS UpdatedAt
    FROM dbo.tickets t
    INNER JOIN dbo.companies c  ON t.company_id   = c.id
    INNER JOIN dbo.users     su ON t.submitter_id = su.id
    LEFT  JOIN dbo.users     au ON t.assignee_id  = au.id
    WHERE t.id = @TicketId;

    SELECT m.id AS Id, m.ticket_id AS TicketId, m.author_id AS AuthorId,
        u.name AS AuthorName, m.content AS Content,
        m.is_it_reply AS IsItReply, m.message_type AS MessageType, m.created_at AS CreatedAt
    FROM dbo.ticket_messages m
    INNER JOIN dbo.users u ON m.author_id = u.id
    WHERE m.ticket_id = @TicketId ORDER BY m.created_at ASC;

    SELECT a.id AS Id, a.ticket_id AS TicketId, a.filename AS Filename,
        a.size_bytes AS SizeBytes, a.content_type AS ContentType, a.uploaded_at AS UploadedAt
    FROM dbo.attachments a WHERE a.ticket_id = @TicketId ORDER BY a.uploaded_at ASC;
END
GO

-- SP 12: usp_AssignTicket (logs to ticket_handlers + system message)
IF OBJECT_ID('dbo.usp_AssignTicket', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_AssignTicket;
GO
CREATE PROCEDURE dbo.usp_AssignTicket
    @TicketId         UNIQUEIDENTIFIER,
    @AssigneeId       UNIQUEIDENTIFIER,
    @RequestingUserId UNIQUEIDENTIFIER,
    @RequestingRole   NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    IF @RequestingRole != 'it_admin'
    BEGIN RAISERROR('Access denied. Only it_admin can assign tickets.', 16, 1); RETURN; END

    -- Close any open handler record
    UPDATE dbo.ticket_handlers SET released_at = GETUTCDATE()
    WHERE ticket_id = @TicketId AND released_at IS NULL;

    -- Log initial assignment
    INSERT INTO dbo.ticket_handlers (ticket_id, handler_id, assigned_by, action_type)
    VALUES (@TicketId, @AssigneeId, @RequestingUserId, N'初次指派');

    UPDATE dbo.tickets
    SET assignee_id = @AssigneeId, status = N'處理中', updated_at = GETUTCDATE()
    WHERE id = @TicketId;

    DECLARE @AssignerName NVARCHAR(100);
    DECLARE @HandlerName  NVARCHAR(100);
    SELECT @AssignerName = name FROM dbo.users WHERE id = @RequestingUserId;
    SELECT @HandlerName  = name FROM dbo.users WHERE id = @AssigneeId;
    INSERT INTO dbo.ticket_messages (ticket_id, author_id, content, is_it_reply, message_type, created_at)
    VALUES (@TicketId, @RequestingUserId,
            N'[初次指派] ' + @AssignerName + N' -> ' + @HandlerName,
            1, 'system', GETUTCDATE());

    SELECT t.id AS Id, t.ticket_no AS TicketNo, t.subject AS Subject, t.description AS Description,
        t.status AS Status, t.company_id AS CompanyId, c.name AS CompanyName,
        t.submitter_id AS SubmitterId, su.name AS SubmitterName,
        su.email AS SubmitterEmail, su.phone AS SubmitterPhone,
        t.assignee_id AS AssigneeId, au.name AS AssigneeName, au.email AS AssigneeEmail,
        t.created_at AS CreatedAt, t.first_response_at AS FirstResponseAt,
        t.closed_at AS ClosedAt, t.updated_at AS UpdatedAt
    FROM dbo.tickets t
    INNER JOIN dbo.companies c  ON t.company_id   = c.id
    INNER JOIN dbo.users     su ON t.submitter_id = su.id
    LEFT  JOIN dbo.users     au ON t.assignee_id  = au.id
    WHERE t.id = @TicketId;

    SELECT m.id AS Id, m.ticket_id AS TicketId, m.author_id AS AuthorId,
        u.name AS AuthorName, m.content AS Content,
        m.is_it_reply AS IsItReply, m.message_type AS MessageType, m.created_at AS CreatedAt
    FROM dbo.ticket_messages m
    INNER JOIN dbo.users u ON m.author_id = u.id
    WHERE m.ticket_id = @TicketId ORDER BY m.created_at ASC;

    SELECT a.id AS Id, a.ticket_id AS TicketId, a.filename AS Filename,
        a.size_bytes AS SizeBytes, a.content_type AS ContentType, a.uploaded_at AS UploadedAt
    FROM dbo.attachments a WHERE a.ticket_id = @TicketId ORDER BY a.uploaded_at ASC;
END
GO

-- SP 13: usp_BatchAssignTickets (logs to ticket_handlers)
IF OBJECT_ID('dbo.usp_BatchAssignTickets', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_BatchAssignTickets;
GO
CREATE PROCEDURE dbo.usp_BatchAssignTickets
    @TicketIdsJson    NVARCHAR(MAX),
    @AssigneeId       UNIQUEIDENTIFIER,
    @RequestingUserId UNIQUEIDENTIFIER,
    @RequestingRole   NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    IF @RequestingRole != 'it_admin'
    BEGIN RAISERROR('Access denied. Only it_admin can batch assign tickets.', 16, 1); RETURN; END

    DECLARE @TicketIds TABLE (id UNIQUEIDENTIFIER);
    INSERT INTO @TicketIds (id)
    SELECT CAST(value AS UNIQUEIDENTIFIER) FROM OPENJSON(@TicketIdsJson);

    UPDATE dbo.ticket_handlers SET released_at = GETUTCDATE()
    WHERE ticket_id IN (SELECT id FROM @TicketIds) AND released_at IS NULL;

    INSERT INTO dbo.ticket_handlers (ticket_id, handler_id, assigned_by, action_type)
    SELECT id, @AssigneeId, @RequestingUserId, N'初次指派' FROM @TicketIds;

    UPDATE dbo.tickets
    SET assignee_id = @AssigneeId, status = N'處理中', updated_at = GETUTCDATE()
    WHERE id IN (SELECT id FROM @TicketIds);

    DECLARE @AssignerName NVARCHAR(100);
    DECLARE @HandlerName  NVARCHAR(100);
    SELECT @AssignerName = name FROM dbo.users WHERE id = @RequestingUserId;
    SELECT @HandlerName  = name FROM dbo.users WHERE id = @AssigneeId;
    INSERT INTO dbo.ticket_messages (ticket_id, author_id, content, is_it_reply, message_type, created_at)
    SELECT id, @RequestingUserId,
           N'[初次指派] ' + @AssignerName + N' -> ' + @HandlerName,
           1, 'system', GETUTCDATE()
    FROM @TicketIds;

    DECLARE @UpdatedCount INT = @@ROWCOUNT;
    SELECT @UpdatedCount AS Count;

    SELECT t.id AS TicketId, t.ticket_no AS TicketNo, t.subject AS Subject,
        c.name AS CompanyName, su.name AS SubmitterName,
        au.email AS AssigneeEmail, au.name AS AssigneeName
    FROM dbo.tickets t
    INNER JOIN dbo.companies c  ON t.company_id   = c.id
    INNER JOIN dbo.users     su ON t.submitter_id = su.id
    LEFT  JOIN dbo.users     au ON t.assignee_id  = au.id
    WHERE t.id IN (SELECT id FROM @TicketIds);
END
GO

-- SP 14: usp_TransferTicket (NEW)
-- it_admin can always transfer; it_assignee can transfer only their own assigned tickets.
IF OBJECT_ID('dbo.usp_TransferTicket', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_TransferTicket;
GO
CREATE PROCEDURE dbo.usp_TransferTicket
    @TicketId         UNIQUEIDENTIFIER,
    @ToHandlerId      UNIQUEIDENTIFIER,
    @Note             NVARCHAR(MAX)    = NULL,
    @RequestingUserId UNIQUEIDENTIFIER,
    @RequestingRole   NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @CurrentAssigneeId UNIQUEIDENTIFIER;
    DECLARE @CurrentStatus     NVARCHAR(20);
    DECLARE @TicketNo          NVARCHAR(20);

    SELECT @CurrentAssigneeId = assignee_id, @CurrentStatus = status, @TicketNo = ticket_no
    FROM dbo.tickets WHERE id = @TicketId;

    -- Not found
    IF @TicketNo IS NULL
    BEGIN SELECT 1 AS Code; RETURN; END

    -- Access: it_admin always; it_assignee only if currently assigned
    IF @RequestingRole NOT IN ('it_admin', 'it_assignee')
    BEGIN SELECT 2 AS Code; RETURN; END

    IF @RequestingRole = 'it_assignee'
       AND (@CurrentAssigneeId IS NULL OR @CurrentAssigneeId != @RequestingUserId)
    BEGIN SELECT 2 AS Code; RETURN; END

    -- Cannot transfer closed tickets
    IF @CurrentStatus = N'已結案'
    BEGIN SELECT 3 AS Code; RETURN; END

    -- Cannot transfer to the same person
    IF @ToHandlerId = @CurrentAssigneeId
    BEGIN SELECT 4 AS Code; RETURN; END

    -- Close current open handler record
    UPDATE dbo.ticket_handlers SET released_at = GETUTCDATE()
    WHERE ticket_id = @TicketId AND released_at IS NULL;

    -- Log transfer
    INSERT INTO dbo.ticket_handlers (ticket_id, handler_id, assigned_by, note, action_type)
    VALUES (@TicketId, @ToHandlerId, @RequestingUserId, @Note, N'轉派');

    -- Update ticket
    UPDATE dbo.tickets
    SET assignee_id = @ToHandlerId, status = N'處理中', updated_at = GETUTCDATE()
    WHERE id = @TicketId;

    -- Add system message
    DECLARE @AssignerName NVARCHAR(100);
    DECLARE @HandlerName  NVARCHAR(100);
    SELECT @AssignerName = name FROM dbo.users WHERE id = @RequestingUserId;
    SELECT @HandlerName  = name FROM dbo.users WHERE id = @ToHandlerId;

    DECLARE @SysMsg NVARCHAR(MAX) = N'[轉派] ' + @AssignerName + N' -> ' + @HandlerName;
    IF @Note IS NOT NULL AND LEN(@Note) > 0
        SET @SysMsg = @SysMsg + N'  (' + @Note + N')';

    INSERT INTO dbo.ticket_messages (ticket_id, author_id, content, is_it_reply, message_type, created_at)
    VALUES (@TicketId, @RequestingUserId, @SysMsg, 1, 'system', GETUTCDATE());

    SELECT 0 AS Code;

    SELECT t.id AS Id, t.ticket_no AS TicketNo, t.subject AS Subject, t.description AS Description,
        t.status AS Status, t.company_id AS CompanyId, c.name AS CompanyName,
        t.submitter_id AS SubmitterId, su.name AS SubmitterName,
        su.email AS SubmitterEmail, su.phone AS SubmitterPhone,
        t.assignee_id AS AssigneeId, au.name AS AssigneeName, au.email AS AssigneeEmail,
        t.created_at AS CreatedAt, t.first_response_at AS FirstResponseAt,
        t.closed_at AS ClosedAt, t.updated_at AS UpdatedAt
    FROM dbo.tickets t
    INNER JOIN dbo.companies c  ON t.company_id   = c.id
    INNER JOIN dbo.users     su ON t.submitter_id = su.id
    LEFT  JOIN dbo.users     au ON t.assignee_id  = au.id
    WHERE t.id = @TicketId;

    SELECT m.id AS Id, m.ticket_id AS TicketId, m.author_id AS AuthorId,
        u.name AS AuthorName, m.content AS Content,
        m.is_it_reply AS IsItReply, m.message_type AS MessageType, m.created_at AS CreatedAt
    FROM dbo.ticket_messages m
    INNER JOIN dbo.users u ON m.author_id = u.id
    WHERE m.ticket_id = @TicketId ORDER BY m.created_at ASC;

    SELECT a.id AS Id, a.ticket_id AS TicketId, a.filename AS Filename,
        a.size_bytes AS SizeBytes, a.content_type AS ContentType, a.uploaded_at AS UploadedAt
    FROM dbo.attachments a WHERE a.ticket_id = @TicketId ORDER BY a.uploaded_at ASC;
END
GO

-- SP 15: usp_GetHandlerHistory (NEW)
IF OBJECT_ID('dbo.usp_GetHandlerHistory', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_GetHandlerHistory;
GO
CREATE PROCEDURE dbo.usp_GetHandlerHistory
    @TicketId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        h.id          AS Id,
        h.ticket_id   AS TicketId,
        h.handler_id  AS HandlerId,
        hu.name       AS HandlerName,
        hu.email      AS HandlerEmail,
        h.assigned_by AS AssignedById,
        au.name       AS AssignedByName,
        h.assigned_at AS AssignedAt,
        h.released_at AS ReleasedAt,
        h.note        AS Note,
        h.action_type AS ActionType
    FROM dbo.ticket_handlers h
    INNER JOIN dbo.users hu ON h.handler_id  = hu.id
    INNER JOIN dbo.users au ON h.assigned_by = au.id
    WHERE h.ticket_id = @TicketId
    ORDER BY h.assigned_at ASC;
END
GO

-- SP 16: usp_AddMessage (updated with message_type)
IF OBJECT_ID('dbo.usp_AddMessage', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_AddMessage;
GO
CREATE PROCEDURE dbo.usp_AddMessage
    @TicketId            UNIQUEIDENTIFIER,
    @AuthorId            UNIQUEIDENTIFIER,
    @Content             NVARCHAR(MAX),
    @IsItReply           BIT,
    @RequestingRole      NVARCHAR(50),
    @RequestingCompanyId UNIQUEIDENTIFIER,
    @MessageType         NVARCHAR(20) = 'reply'
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @TicketCompanyId UNIQUEIDENTIFIER;
    SELECT @TicketCompanyId = company_id FROM dbo.tickets WHERE id = @TicketId;

    IF @TicketCompanyId IS NULL
    BEGIN RAISERROR('Ticket not found.', 16, 1); RETURN; END

    IF @RequestingRole NOT IN ('it_admin','it_assignee')
       AND @TicketCompanyId != @RequestingCompanyId
    BEGIN RAISERROR('Access denied.', 16, 1); RETURN; END

    DECLARE @NewId UNIQUEIDENTIFIER = NEWID();
    INSERT INTO dbo.ticket_messages (id, ticket_id, author_id, content, is_it_reply, message_type, created_at)
    VALUES (@NewId, @TicketId, @AuthorId, @Content, @IsItReply, @MessageType, GETUTCDATE());

    IF @IsItReply = 1
    BEGIN
        UPDATE dbo.tickets SET first_response_at = GETUTCDATE(), updated_at = GETUTCDATE()
        WHERE id = @TicketId AND first_response_at IS NULL;
        UPDATE dbo.tickets SET updated_at = GETUTCDATE()
        WHERE id = @TicketId AND first_response_at IS NOT NULL;
    END
    ELSE
        UPDATE dbo.tickets SET updated_at = GETUTCDATE() WHERE id = @TicketId;

    SELECT m.id AS Id, m.ticket_id AS TicketId, m.author_id AS AuthorId,
        u.name AS AuthorName, m.content AS Content,
        m.is_it_reply AS IsItReply, m.message_type AS MessageType, m.created_at AS CreatedAt
    FROM dbo.ticket_messages m
    INNER JOIN dbo.users u ON m.author_id = u.id
    WHERE m.id = @NewId;
END
GO

-- SP 17: usp_GetMessages
IF OBJECT_ID('dbo.usp_GetMessages', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_GetMessages;
GO
CREATE PROCEDURE dbo.usp_GetMessages
    @TicketId            UNIQUEIDENTIFIER,
    @RequestingRole      NVARCHAR(50),
    @RequestingCompanyId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @TicketCompanyId UNIQUEIDENTIFIER;
    SELECT @TicketCompanyId = company_id FROM dbo.tickets WHERE id = @TicketId;

    IF @TicketCompanyId IS NULL
       OR (@RequestingRole NOT IN ('it_admin','it_assignee')
           AND @TicketCompanyId != @RequestingCompanyId)
    BEGIN
        SELECT TOP 0
            CAST(NULL AS UNIQUEIDENTIFIER) AS Id, CAST(NULL AS UNIQUEIDENTIFIER) AS TicketId,
            CAST(NULL AS UNIQUEIDENTIFIER) AS AuthorId, CAST(NULL AS NVARCHAR(100)) AS AuthorName,
            CAST(NULL AS NVARCHAR(MAX)) AS Content, CAST(NULL AS BIT) AS IsItReply,
            CAST(NULL AS NVARCHAR(20)) AS MessageType, CAST(NULL AS DATETIME2) AS CreatedAt
        WHERE 1 = 0;
        RETURN;
    END

    SELECT m.id AS Id, m.ticket_id AS TicketId, m.author_id AS AuthorId,
        u.name AS AuthorName, m.content AS Content,
        m.is_it_reply AS IsItReply, m.message_type AS MessageType, m.created_at AS CreatedAt
    FROM dbo.ticket_messages m
    INNER JOIN dbo.users u ON m.author_id = u.id
    WHERE m.ticket_id = @TicketId ORDER BY m.created_at ASC;
END
GO

-- SP 18: usp_GetAttachmentById
IF OBJECT_ID('dbo.usp_GetAttachmentById', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_GetAttachmentById;
GO
CREATE PROCEDURE dbo.usp_GetAttachmentById
    @AttachmentId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SELECT a.id AS Id, a.ticket_id AS TicketId, a.filename AS Filename,
        a.storage_path AS StoragePath, a.size_bytes AS SizeBytes,
        a.content_type AS ContentType, a.uploaded_at AS UploadedAt,
        t.company_id AS TicketCompanyId
    FROM dbo.attachments a
    INNER JOIN dbo.tickets t ON a.ticket_id = t.id
    WHERE a.id = @AttachmentId;
END
GO

-- SP 19: usp_GetAttachmentsByTicket
IF OBJECT_ID('dbo.usp_GetAttachmentsByTicket', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_GetAttachmentsByTicket;
GO
CREATE PROCEDURE dbo.usp_GetAttachmentsByTicket
    @TicketId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SELECT a.id AS Id, a.ticket_id AS TicketId, a.filename AS Filename,
        a.size_bytes AS SizeBytes, a.content_type AS ContentType, a.uploaded_at AS UploadedAt
    FROM dbo.attachments a WHERE a.ticket_id = @TicketId ORDER BY a.uploaded_at ASC;
END
GO

-- SP 20: usp_CreateAttachment
IF OBJECT_ID('dbo.usp_CreateAttachment', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_CreateAttachment;
GO
CREATE PROCEDURE dbo.usp_CreateAttachment
    @TicketId    UNIQUEIDENTIFIER,
    @Filename    NVARCHAR(500),
    @StoragePath NVARCHAR(1000),
    @SizeBytes   BIGINT,
    @ContentType NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @NewId UNIQUEIDENTIFIER = NEWID();
    INSERT INTO dbo.attachments (id, ticket_id, filename, storage_path, size_bytes, content_type, uploaded_at)
    VALUES (@NewId, @TicketId, @Filename, @StoragePath, @SizeBytes, @ContentType, GETUTCDATE());
    SELECT a.id AS Id, a.ticket_id AS TicketId, a.filename AS Filename,
        a.size_bytes AS SizeBytes, a.content_type AS ContentType, a.uploaded_at AS UploadedAt
    FROM dbo.attachments a WHERE a.id = @NewId;
END
GO

-- SP 21: usp_DeleteAttachment
IF OBJECT_ID('dbo.usp_DeleteAttachment', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_DeleteAttachment;
GO
CREATE PROCEDURE dbo.usp_DeleteAttachment
    @AttachmentId        UNIQUEIDENTIFIER,
    @RequestingUserId    UNIQUEIDENTIFIER,
    @RequestingRole      NVARCHAR(50),
    @RequestingCompanyId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @TicketCompanyId UNIQUEIDENTIFIER;
    SELECT @TicketCompanyId = t.company_id
    FROM dbo.attachments a INNER JOIN dbo.tickets t ON a.ticket_id = t.id
    WHERE a.id = @AttachmentId;

    IF @TicketCompanyId IS NULL
    BEGIN SELECT 1 AS Code; RETURN; END

    IF @RequestingRole NOT IN ('it_admin','it_assignee')
       AND @TicketCompanyId != @RequestingCompanyId
    BEGIN SELECT 2 AS Code; RETURN; END

    DELETE FROM dbo.attachments WHERE id = @AttachmentId;
    SELECT 0 AS Code;
END
GO

-- SP 22: usp_CreateExportJob
IF OBJECT_ID('dbo.usp_CreateExportJob', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_CreateExportJob;
GO
CREATE PROCEDURE dbo.usp_CreateExportJob
    @RequestedBy UNIQUEIDENTIFIER,
    @FiltersJson NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @NewId UNIQUEIDENTIFIER = NEWID();
    INSERT INTO dbo.export_jobs (id, requested_by, status, filters_json, created_at)
    VALUES (@NewId, @RequestedBy, 'pending', @FiltersJson, GETUTCDATE());
    SELECT @NewId AS Id;
END
GO

-- SP 23: usp_UpdateExportJob
IF OBJECT_ID('dbo.usp_UpdateExportJob', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_UpdateExportJob;
GO
CREATE PROCEDURE dbo.usp_UpdateExportJob
    @JobId      UNIQUEIDENTIFIER,
    @Status     NVARCHAR(50),
    @ResultPath NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.export_jobs
    SET status       = @Status,
        result_path  = ISNULL(@ResultPath, result_path),
        completed_at = CASE WHEN @Status IN ('completed','failed') THEN GETUTCDATE() ELSE completed_at END
    WHERE id = @JobId;
END
GO

-- SP 24: usp_GetExportJob
IF OBJECT_ID('dbo.usp_GetExportJob', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_GetExportJob;
GO
CREATE PROCEDURE dbo.usp_GetExportJob
    @JobId       UNIQUEIDENTIFIER,
    @RequestedBy UNIQUEIDENTIFIER = NULL,
    @IsItStaff   BIT              = NULL
AS
BEGIN
    SET NOCOUNT ON;
    -- When @IsItStaff and @RequestedBy are both NULL (internal/background call), return by ID only.
    SELECT id AS Id, status AS Status, created_at AS CreatedAt,
        completed_at AS CompletedAt, result_path AS ResultPath
    FROM dbo.export_jobs
    WHERE id = @JobId
      AND (ISNULL(@IsItStaff, 1) = 1 OR requested_by = @RequestedBy);
END
GO

-- SP 25: usp_GetTicketsForExport
IF OBJECT_ID('dbo.usp_GetTicketsForExport', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_GetTicketsForExport;
GO
CREATE PROCEDURE dbo.usp_GetTicketsForExport
    @StartDate       DATETIME2        = NULL,
    @EndDate         DATETIME2        = NULL,
    @CompanyIdFilter UNIQUEIDENTIFIER = NULL,
    @Status          NVARCHAR(20)     = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT t.ticket_no AS TicketNo, c.name AS CompanyName, su.name AS SubmitterName,
        t.subject AS Subject, t.status AS Status, au.name AS AssigneeName,
        t.created_at AS CreatedAt, t.first_response_at AS FirstResponseAt, t.closed_at AS ClosedAt
    FROM dbo.tickets t
    INNER JOIN dbo.companies c  ON t.company_id   = c.id
    INNER JOIN dbo.users     su ON t.submitter_id = su.id
    LEFT  JOIN dbo.users     au ON t.assignee_id  = au.id
    WHERE (@StartDate       IS NULL OR t.created_at >= @StartDate)
      AND (@EndDate         IS NULL OR t.created_at <= @EndDate)
      AND (@CompanyIdFilter IS NULL OR t.company_id  = @CompanyIdFilter)
      AND (@Status          IS NULL OR t.status       = @Status)
    ORDER BY t.created_at ASC;
END
GO

-- ============================================================
-- v4 NEW SPs: Company Management
-- ============================================================

-- SP usp_GetCompanies: list all companies with is_it_company flag
IF OBJECT_ID('dbo.usp_GetCompanies', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_GetCompanies;
GO
CREATE PROCEDURE dbo.usp_GetCompanies
AS
BEGIN
    SET NOCOUNT ON;
    SELECT id AS Id, name AS Name, code AS Code,
           is_it_company AS IsItCompany, created_at AS CreatedAt
    FROM dbo.companies
    ORDER BY name;
END
GO

-- SP usp_SetCompanyItFlag: admin toggles is_it_company for a company
-- Returns: 0 = ok, 1 = company not found
IF OBJECT_ID('dbo.usp_SetCompanyItFlag', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_SetCompanyItFlag;
GO
CREATE PROCEDURE dbo.usp_SetCompanyItFlag
    @CompanyId    UNIQUEIDENTIFIER,
    @IsItCompany  BIT
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM dbo.companies WHERE id = @CompanyId)
    BEGIN
        SELECT 1 AS Code; RETURN;
    END

    UPDATE dbo.companies
    SET is_it_company = @IsItCompany
    WHERE id = @CompanyId;

    SELECT 0 AS Code;
    SELECT id AS Id, name AS Name, code AS Code,
           is_it_company AS IsItCompany, created_at AS CreatedAt
    FROM dbo.companies WHERE id = @CompanyId;
END
GO

-- ============================================================
-- v5 NEW SPs: Issue Classification
-- ============================================================

-- SP: usp_GetIssueTypes
IF OBJECT_ID('dbo.usp_GetIssueTypes', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_GetIssueTypes;
GO
CREATE PROCEDURE dbo.usp_GetIssueTypes
    @ActiveOnly BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    SELECT id AS Id, name AS Name, sort_order AS SortOrder, is_active AS IsActive, created_at AS CreatedAt
    FROM dbo.issue_types
    WHERE @ActiveOnly = 0 OR is_active = 1
    ORDER BY sort_order, name;
END
GO

-- SP: usp_ManageIssueType  (@Action: 'CREATE'|'UPDATE'|'DELETE')
-- Returns: Code 0=ok, 1=not found, 2=name conflict
IF OBJECT_ID('dbo.usp_ManageIssueType', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_ManageIssueType;
GO
CREATE PROCEDURE dbo.usp_ManageIssueType
    @Action     NVARCHAR(10),
    @Id         UNIQUEIDENTIFIER = NULL,
    @Name       NVARCHAR(100)    = NULL,
    @SortOrder  INT              = 0,
    @IsActive   BIT              = 1
AS
BEGIN
    SET NOCOUNT ON;
    IF @Action = 'CREATE'
    BEGIN
        IF EXISTS (SELECT 1 FROM dbo.issue_types WHERE name = @Name)
        BEGIN SELECT 2 AS Code; RETURN; END
        DECLARE @NewId UNIQUEIDENTIFIER = NEWID();
        INSERT INTO dbo.issue_types (id, name, sort_order, is_active)
        VALUES (@NewId, @Name, @SortOrder, @IsActive);
        SELECT 0 AS Code;
        SELECT id AS Id, name AS Name, sort_order AS SortOrder, is_active AS IsActive, created_at AS CreatedAt
        FROM dbo.issue_types WHERE id = @NewId;
        RETURN;
    END
    IF @Action = 'UPDATE'
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.issue_types WHERE id = @Id)
        BEGIN SELECT 1 AS Code; RETURN; END
        IF EXISTS (SELECT 1 FROM dbo.issue_types WHERE name = @Name AND id != @Id)
        BEGIN SELECT 2 AS Code; RETURN; END
        UPDATE dbo.issue_types SET name = @Name, sort_order = @SortOrder, is_active = @IsActive
        WHERE id = @Id;
        SELECT 0 AS Code;
        SELECT id AS Id, name AS Name, sort_order AS SortOrder, is_active AS IsActive, created_at AS CreatedAt
        FROM dbo.issue_types WHERE id = @Id;
        RETURN;
    END
    IF @Action = 'DELETE'
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.issue_types WHERE id = @Id)
        BEGIN SELECT 1 AS Code; RETURN; END
        UPDATE dbo.issue_types SET is_active = 0 WHERE id = @Id;
        SELECT 0 AS Code;
        RETURN;
    END
END
GO

-- SP: usp_GetSystemsByCompany
IF OBJECT_ID('dbo.usp_GetSystemsByCompany', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_GetSystemsByCompany;
GO
CREATE PROCEDURE dbo.usp_GetSystemsByCompany
    @CompanyId  UNIQUEIDENTIFIER = NULL,
    @ActiveOnly BIT              = 1
AS
BEGIN
    SET NOCOUNT ON;
    SELECT cs.id AS Id, cs.company_id AS CompanyId, c.name AS CompanyName,
           cs.name AS Name, cs.sort_order AS SortOrder, cs.is_active AS IsActive, cs.created_at AS CreatedAt
    FROM dbo.company_systems cs
    INNER JOIN dbo.companies c ON cs.company_id = c.id
    WHERE (@CompanyId IS NULL OR cs.company_id = @CompanyId)
      AND (@ActiveOnly = 0 OR cs.is_active = 1)
    ORDER BY c.name, cs.sort_order, cs.name;
END
GO

-- SP: usp_ManageCompanySystem  (@Action: 'CREATE'|'UPDATE'|'DELETE')
-- Returns: Code 0=ok, 1=not found, 2=name conflict within same company
IF OBJECT_ID('dbo.usp_ManageCompanySystem', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_ManageCompanySystem;
GO
CREATE PROCEDURE dbo.usp_ManageCompanySystem
    @Action     NVARCHAR(10),
    @Id         UNIQUEIDENTIFIER = NULL,
    @CompanyId  UNIQUEIDENTIFIER = NULL,
    @Name       NVARCHAR(200)    = NULL,
    @SortOrder  INT              = 0,
    @IsActive   BIT              = 1
AS
BEGIN
    SET NOCOUNT ON;
    IF @Action = 'CREATE'
    BEGIN
        IF EXISTS (SELECT 1 FROM dbo.company_systems WHERE company_id = @CompanyId AND name = @Name)
        BEGIN SELECT 2 AS Code; RETURN; END
        DECLARE @NewId UNIQUEIDENTIFIER = NEWID();
        INSERT INTO dbo.company_systems (id, company_id, name, sort_order, is_active)
        VALUES (@NewId, @CompanyId, @Name, @SortOrder, @IsActive);
        SELECT 0 AS Code;
        SELECT cs.id AS Id, cs.company_id AS CompanyId, c.name AS CompanyName,
               cs.name AS Name, cs.sort_order AS SortOrder, cs.is_active AS IsActive, cs.created_at AS CreatedAt
        FROM dbo.company_systems cs INNER JOIN dbo.companies c ON cs.company_id = c.id
        WHERE cs.id = @NewId;
        RETURN;
    END
    IF @Action = 'UPDATE'
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.company_systems WHERE id = @Id)
        BEGIN SELECT 1 AS Code; RETURN; END
        DECLARE @ExistCoId UNIQUEIDENTIFIER;
        SELECT @ExistCoId = company_id FROM dbo.company_systems WHERE id = @Id;
        IF EXISTS (SELECT 1 FROM dbo.company_systems WHERE company_id = @ExistCoId AND name = @Name AND id != @Id)
        BEGIN SELECT 2 AS Code; RETURN; END
        UPDATE dbo.company_systems SET name = @Name, sort_order = @SortOrder, is_active = @IsActive
        WHERE id = @Id;
        SELECT 0 AS Code;
        SELECT cs.id AS Id, cs.company_id AS CompanyId, c.name AS CompanyName,
               cs.name AS Name, cs.sort_order AS SortOrder, cs.is_active AS IsActive, cs.created_at AS CreatedAt
        FROM dbo.company_systems cs INNER JOIN dbo.companies c ON cs.company_id = c.id
        WHERE cs.id = @Id;
        RETURN;
    END
    IF @Action = 'DELETE'
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.company_systems WHERE id = @Id)
        BEGIN SELECT 1 AS Code; RETURN; END
        UPDATE dbo.company_systems SET is_active = 0 WHERE id = @Id;
        SELECT 0 AS Code;
        RETURN;
    END
END
GO

-- SP: usp_SetTicketClassification
-- Permission: it_admin always; it_assignee only if from IT company.
-- Returns: Code 0=ok, 1=ticket not found, 2=access denied, 3=system not valid for company
IF OBJECT_ID('dbo.usp_SetTicketClassification', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_SetTicketClassification;
GO
CREATE PROCEDURE dbo.usp_SetTicketClassification
    @TicketId           UNIQUEIDENTIFIER,
    @IssueTypeId        UNIQUEIDENTIFIER = NULL,
    @AffectedCompanyId  UNIQUEIDENTIFIER = NULL,
    @SystemId           UNIQUEIDENTIFIER = NULL,
    @Severity           TINYINT          = NULL,
    @Urgency            TINYINT          = NULL,
    @RequestingUserId   UNIQUEIDENTIFIER,
    @RequestingRole     NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.tickets WHERE id = @TicketId)
    BEGIN SELECT 1 AS Code; RETURN; END

    IF @RequestingRole NOT IN ('it_admin', 'it_assignee')
    BEGIN SELECT 2 AS Code; RETURN; END

    IF @RequestingRole = 'it_assignee'
    BEGIN
        DECLARE @RequesterIsItCo BIT = 0;
        SELECT @RequesterIsItCo = c.is_it_company
        FROM dbo.users u INNER JOIN dbo.companies c ON u.company_id = c.id
        WHERE u.id = @RequestingUserId;
        IF ISNULL(@RequesterIsItCo, 0) = 0
        BEGIN SELECT 2 AS Code; RETURN; END
    END

    -- Validate system belongs to affected company (or ticket company when no affected_company_id)
    IF @SystemId IS NOT NULL
    BEGIN
        DECLARE @TargetCoId UNIQUEIDENTIFIER = @AffectedCompanyId;
        IF @TargetCoId IS NULL
            SELECT @TargetCoId = company_id FROM dbo.tickets WHERE id = @TicketId;
        IF NOT EXISTS (
            SELECT 1 FROM dbo.company_systems
            WHERE id = @SystemId AND company_id = @TargetCoId AND is_active = 1
        )
        BEGIN SELECT 3 AS Code; RETURN; END
    END

    UPDATE dbo.tickets
    SET issue_type_id       = @IssueTypeId,
        affected_company_id = @AffectedCompanyId,
        system_id           = @SystemId,
        severity            = @Severity,
        urgency             = @Urgency,
        updated_at          = GETUTCDATE()
    WHERE id = @TicketId;

    SELECT 0 AS Code;

    SELECT
        t.id AS Id, t.ticket_no AS TicketNo, t.subject AS Subject, t.description AS Description,
        t.status AS Status, t.company_id AS CompanyId, c.name AS CompanyName,
        t.submitter_id AS SubmitterId, su.name AS SubmitterName,
        su.email AS SubmitterEmail, su.phone AS SubmitterPhone,
        t.assignee_id AS AssigneeId, au.name AS AssigneeName, au.email AS AssigneeEmail,
        t.created_at AS CreatedAt, t.first_response_at AS FirstResponseAt,
        t.closed_at AS ClosedAt, t.updated_at AS UpdatedAt,
        t.issue_type_id AS IssueTypeId, it_t.name AS IssueTypeName,
        t.affected_company_id AS AffectedCompanyId, ac.name AS AffectedCompanyName,
        t.system_id AS SystemId, cs.name AS SystemName,
        t.severity AS Severity, t.urgency AS Urgency
    FROM dbo.tickets t
    INNER JOIN dbo.companies c  ON t.company_id   = c.id
    INNER JOIN dbo.users     su ON t.submitter_id = su.id
    LEFT  JOIN dbo.users     au ON t.assignee_id  = au.id
    LEFT  JOIN dbo.issue_types     it_t ON t.issue_type_id       = it_t.id
    LEFT  JOIN dbo.companies       ac   ON t.affected_company_id = ac.id
    LEFT  JOIN dbo.company_systems cs   ON t.system_id           = cs.id
    WHERE t.id = @TicketId;
END
GO


-- ============================================================
-- PATCH: msg-34 Feedback feature
-- ============================================================
-- ============================================================
-- GITP - 滿意度回饋功能 Patch (msg-34)
-- 套用至 msg-29 的 init.sql 基礎上
-- ============================================================

USE gitpdb;
GO

-- ============================================================
-- 資料表：ticket_feedbacks
-- ============================================================
IF OBJECT_ID('dbo.ticket_feedbacks', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ticket_feedbacks (
        id                  UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        ticket_id           UNIQUEIDENTIFIER NOT NULL,
        token               UNIQUEIDENTIFIER NOT NULL UNIQUE DEFAULT NEWID(),
        result              NVARCHAR(20)     NULL,  -- NULL=未回覆 / 'satisfied' / 'unsatisfied'
        follow_up_ticket_id UNIQUEIDENTIFIER NULL,
        created_at          DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
        submitted_at        DATETIME2        NULL,
        CONSTRAINT FK_feedback_ticket FOREIGN KEY (ticket_id) REFERENCES dbo.tickets(id),
        CONSTRAINT CK_feedback_result CHECK (result IN ('satisfied', 'unsatisfied') OR result IS NULL)
    );
    CREATE INDEX IX_feedback_ticket ON dbo.ticket_feedbacks(ticket_id);
    CREATE INDEX IX_feedback_token  ON dbo.ticket_feedbacks(token);
END
GO

-- ============================================================
-- SP: usp_CreateFeedbackToken
-- 結案時呼叫，建立回饋 token 並回傳 token 與提報人 email
-- ============================================================
IF OBJECT_ID('dbo.usp_CreateFeedbackToken', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_CreateFeedbackToken;
GO
CREATE PROCEDURE dbo.usp_CreateFeedbackToken
    @TicketId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;

    -- 避免重複建立（同一案件只建一筆）
    IF EXISTS (SELECT 1 FROM dbo.ticket_feedbacks WHERE ticket_id = @TicketId)
    BEGIN
        SELECT f.token AS Token, u.email AS SubmitterEmail, u.name AS SubmitterName,
               t.ticket_no AS TicketNo, t.subject AS Subject
        FROM   dbo.ticket_feedbacks f
        INNER JOIN dbo.tickets t ON f.ticket_id = t.id
        INNER JOIN dbo.users   u ON t.submitter_id = u.id
        WHERE  f.ticket_id = @TicketId;
        RETURN;
    END

    DECLARE @Token UNIQUEIDENTIFIER = NEWID();
    DECLARE @FeedbackId UNIQUEIDENTIFIER = NEWID();

    INSERT INTO dbo.ticket_feedbacks (id, ticket_id, token)
    VALUES (@FeedbackId, @TicketId, @Token);

    SELECT f.token AS Token, u.email AS SubmitterEmail, u.name AS SubmitterName,
           t.ticket_no AS TicketNo, t.subject AS Subject
    FROM   dbo.ticket_feedbacks f
    INNER JOIN dbo.tickets t ON f.ticket_id = t.id
    INNER JOIN dbo.users   u ON t.submitter_id = u.id
    WHERE  f.id = @FeedbackId;
END
GO

-- ============================================================
-- SP: usp_GetFeedbackByToken
-- 公開查詢回饋狀態（不需驗證）
-- ============================================================
IF OBJECT_ID('dbo.usp_GetFeedbackByToken', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_GetFeedbackByToken;
GO
CREATE PROCEDURE dbo.usp_GetFeedbackByToken
    @Token UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SELECT f.id AS Id, f.ticket_id AS TicketId, f.token AS Token,
           f.result AS Result, f.follow_up_ticket_id AS FollowUpTicketId,
           f.created_at AS CreatedAt, f.submitted_at AS SubmittedAt,
           t.ticket_no AS TicketNo, t.subject AS Subject,
           t.status AS TicketStatus,
           u.name AS SubmitterName
    FROM   dbo.ticket_feedbacks f
    INNER JOIN dbo.tickets t ON f.ticket_id = t.id
    INNER JOIN dbo.users   u ON t.submitter_id = u.id
    WHERE  f.token = @Token;
END
GO

-- ============================================================
-- SP: usp_SubmitFeedback
-- 提報人透過 token 提交滿意 / 不滿意
-- 回傳 Code: 0=成功 / 1=token不存在 / 2=已回覆過
-- 若不滿意，自動建立追蹤案件
-- ============================================================
IF OBJECT_ID('dbo.usp_SubmitFeedback', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_SubmitFeedback;
GO
CREATE PROCEDURE dbo.usp_SubmitFeedback
    @Token  UNIQUEIDENTIFIER,
    @Result NVARCHAR(20)         -- 'satisfied' or 'unsatisfied'
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @FeedbackId     UNIQUEIDENTIFIER;
    DECLARE @TicketId       UNIQUEIDENTIFIER;
    DECLARE @CurrentResult  NVARCHAR(20);
    DECLARE @SubmitterId    UNIQUEIDENTIFIER;
    DECLARE @CompanyId      UNIQUEIDENTIFIER;
    DECLARE @OrigSubject    NVARCHAR(500);
    DECLARE @OrigTicketNo   NVARCHAR(50);

    SELECT @FeedbackId    = f.id,
           @TicketId      = f.ticket_id,
           @CurrentResult = f.result,
           @SubmitterId   = t.submitter_id,
           @CompanyId     = t.company_id,
           @OrigSubject   = t.subject,
           @OrigTicketNo  = t.ticket_no
    FROM   dbo.ticket_feedbacks f
    INNER JOIN dbo.tickets t ON f.ticket_id = t.id
    WHERE  f.token = @Token;

    IF @FeedbackId IS NULL
    BEGIN SELECT 1 AS Code; RETURN; END

    IF @CurrentResult IS NOT NULL
    BEGIN SELECT 2 AS Code; RETURN; END

    -- 更新回饋結果
    UPDATE dbo.ticket_feedbacks
    SET result = @Result, submitted_at = GETUTCDATE()
    WHERE id = @FeedbackId;

    -- 若不滿意：自動建立追蹤案件
    DECLARE @FollowUpId UNIQUEIDENTIFIER = NULL;
    IF @Result = 'unsatisfied'
    BEGIN
        DECLARE @Year      NVARCHAR(4)  = CAST(YEAR(GETUTCDATE()) AS NVARCHAR(4));
        DECLARE @Month     NVARCHAR(2)  = RIGHT('0' + CAST(MONTH(GETUTCDATE()) AS NVARCHAR(2)), 2);
        DECLARE @Counter   INT;
        DECLARE @Seq       NVARCHAR(6);
        DECLARE @NewNo     NVARCHAR(50);

        SELECT @Counter = ISNULL(MAX(CAST(RIGHT(ticket_no, 4) AS INT)), 0) + 1
        FROM   dbo.tickets
        WHERE  ticket_no LIKE 'GITP-' + @Year + @Month + '-%';

        SET @Seq   = RIGHT('0000' + CAST(@Counter AS NVARCHAR(6)), 4);
        SET @NewNo = 'GITP-' + @Year + @Month + '-' + @Seq;

        SET @FollowUpId = NEWID();
        INSERT INTO dbo.tickets
            (id, ticket_no, company_id, submitter_id, subject, description, status, created_at, updated_at)
        VALUES
            (@FollowUpId,
             @NewNo,
             @CompanyId,
             @SubmitterId,
             N'[不滿意追蹤] ' + @OrigSubject,
             N'此案件為 ' + @OrigTicketNo + N' 的滿意度追蹤案件，提報人對結案內容不滿意，請重新確認並進一步處理。',
             N'新建立',
             GETUTCDATE(),
             GETUTCDATE());

        -- 寫入系統訊息到原案件
        INSERT INTO dbo.ticket_messages
            (id, ticket_id, author_id, content, is_it_reply, message_type, created_at)
        VALUES
            (NEWID(), @TicketId, @SubmitterId,
             N'提報人對此案件回饋「不滿意」，系統已自動建立追蹤案件 ' + @NewNo + N'。',
             0, N'system', GETUTCDATE());

        -- 更新回饋紀錄的追蹤案件 ID
        UPDATE dbo.ticket_feedbacks
        SET follow_up_ticket_id = @FollowUpId
        WHERE id = @FeedbackId;
    END

    SELECT 0 AS Code;

    -- 回傳回饋詳情
    SELECT f.id AS Id, f.ticket_id AS TicketId, f.token AS Token,
           f.result AS Result, f.follow_up_ticket_id AS FollowUpTicketId,
           f.created_at AS CreatedAt, f.submitted_at AS SubmittedAt,
           t.ticket_no AS TicketNo, t.subject AS Subject,
           t.status AS TicketStatus,
           u.name AS SubmitterName,
           @NewNo AS FollowUpTicketNo
    FROM   dbo.ticket_feedbacks f
    INNER JOIN dbo.tickets t ON f.ticket_id = t.id
    INNER JOIN dbo.users   u ON t.submitter_id = u.id
    WHERE  f.id = @FeedbackId;
END
GO


-- ============================================================
-- PATCH: msg-36 Windows Auth
-- (columns and indexes now defined in CREATE TABLE / INDEXES section above)
-- ============================================================
GO

-- ============================================================
-- SP: usp_AuthGetUserByWindowsUsername
--   Input : @WindowsUsername NVARCHAR(200)  e.g. "CORP\john.doe" or "john.doe@corp.local"
--   Output: same columns as usp_AuthGetUserByEmail (no password_hash check needed for WinAuth)
-- ============================================================
IF OBJECT_ID('dbo.usp_AuthGetUserByWindowsUsername', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_AuthGetUserByWindowsUsername;
GO
CREATE PROCEDURE dbo.usp_AuthGetUserByWindowsUsername
    @WindowsUsername NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;

    -- Normalise: strip domain prefix (DOMAIN\user -> user) for secondary match
    DECLARE @UPN NVARCHAR(200) = LOWER(LTRIM(RTRIM(@WindowsUsername)));
    DECLARE @UserPart NVARCHAR(200) = CASE
        WHEN CHARINDEX('\', @UPN) > 0 THEN SUBSTRING(@UPN, CHARINDEX('\', @UPN) + 1, LEN(@UPN))
        ELSE @UPN
    END;

    SELECT TOP 1
        u.id,
        u.company_id,
        u.name,
        u.email,
        u.phone,
        u.emp_id,
        u.dep_id,
        u.dep_name,
        u.created_at,
        u.password_hash,
        c.name        AS company_name,
        c.code        AS company_code,
        c.is_it_company,
        STRING_AGG(r.role, ',') WITHIN GROUP (ORDER BY r.role) AS role
    FROM dbo.users u
    INNER JOIN dbo.companies c ON u.company_id = c.id
    LEFT  JOIN dbo.user_roles r ON r.user_id = u.id
    WHERE u.is_active = 1
      AND (
            -- Exact match on stored windows_username
            LOWER(u.windows_username) = @UPN
            -- Fallback: match email prefix against AD username part
         OR (u.windows_username IS NULL AND LOWER(LEFT(u.email, CHARINDEX('@', u.email) - 1)) = @UserPart)
      )
    GROUP BY u.id, u.company_id, u.name, u.email, u.phone,
             u.emp_id, u.dep_id, u.dep_name, u.created_at,
             u.password_hash, c.name, c.code, c.is_it_company;
END;
GO

-- ============================================================
-- SP: usp_AuthGetOrCreateAzureAdUser
--   Looks up user by OID; if not found, looks up by email;
--   updates OID on match; returns user row.
-- ============================================================
IF OBJECT_ID('dbo.usp_AuthGetOrCreateAzureAdUser', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_AuthGetOrCreateAzureAdUser;
GO
CREATE PROCEDURE dbo.usp_AuthGetOrCreateAzureAdUser
    @AzureAdOid  NVARCHAR(100),
    @Email       NVARCHAR(200),
    @DisplayName NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;

    -- Try by OID first
    DECLARE @UserId UNIQUEIDENTIFIER;
    SELECT @UserId = id FROM dbo.users WHERE azure_ad_oid = @AzureAdOid AND is_active = 1;

    -- If not found, try email; bind OID for future logins
    IF @UserId IS NULL
    BEGIN
        SELECT @UserId = id FROM dbo.users WHERE LOWER(email) = LOWER(@Email) AND is_active = 1;
        IF @UserId IS NOT NULL
            UPDATE dbo.users SET azure_ad_oid = @AzureAdOid WHERE id = @UserId;
    END;

    -- Return user if found
    IF @UserId IS NOT NULL
    BEGIN
        SELECT
            u.id,
            u.company_id,
            u.name,
            u.email,
            u.phone,
            u.emp_id,
            u.dep_id,
            u.dep_name,
            u.created_at,
            u.password_hash,
            c.name        AS company_name,
            c.code        AS company_code,
            c.is_it_company,
            STRING_AGG(r.role, ',') WITHIN GROUP (ORDER BY r.role) AS role
        FROM dbo.users u
        INNER JOIN dbo.companies c ON u.company_id = c.id
        LEFT  JOIN dbo.user_roles r ON r.user_id = u.id
        WHERE u.id = @UserId
        GROUP BY u.id, u.company_id, u.name, u.email, u.phone,
                 u.emp_id, u.dep_id, u.dep_name, u.created_at,
                 u.password_hash, c.name, c.code, c.is_it_company;
    END;
    -- If still not found, return empty (caller returns 403)
END;
GO

-- ============================================================
-- SP: usp_UpdateUserWindowsUsername  (Admin: bind / update mapping)
-- ============================================================
IF OBJECT_ID('dbo.usp_UpdateUserWindowsUsername', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_UpdateUserWindowsUsername;
GO
CREATE PROCEDURE dbo.usp_UpdateUserWindowsUsername
    @UserId          UNIQUEIDENTIFIER,
    @WindowsUsername NVARCHAR(200)  -- NULL to clear
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.users
    SET windows_username = NULLIF(LTRIM(RTRIM(@WindowsUsername)), '')
    WHERE id = @UserId;
    SELECT @@ROWCOUNT AS affected;
END;
GO

PRINT 'Patch patch_windows_auth.sql applied successfully.';
GO


-- ============================================================
-- PATCH: msg-40 LDAP Settings
-- ============================================================
-- ============================================================
-- GITP - Patch: Per-Company LDAP Settings
-- 前提：patch_windows_auth.sql 已執行
-- ============================================================
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================
-- 1. 建立 company_ldap_settings 資料表
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'company_ldap_settings')
BEGIN
    CREATE TABLE dbo.company_ldap_settings (
        id              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID()   PRIMARY KEY,
        company_id      UNIQUEIDENTIFIER NOT NULL,
        -- 連線設定
        ldap_host       NVARCHAR(255)    NOT NULL,                   -- IP 或主機名稱
        ldap_port       INT              NOT NULL DEFAULT 389,       -- 389 = LDAP, 636 = LDAPS
        use_ssl         BIT              NOT NULL DEFAULT 0,         -- 是否使用 SSL/TLS
        -- 目錄結構
        base_dn         NVARCHAR(500)    NOT NULL,                   -- e.g. DC=corp,DC=local
        -- 識別符號（登入時比對用）
        domain_prefix   NVARCHAR(100)    NULL,                       -- e.g. CORP（對應 CORP\user）
        upn_suffix      NVARCHAR(200)    NULL,                       -- e.g. corp.local（對應 user@corp.local）
        -- 服務帳號（可選，用於 user search bind）
        bind_dn         NVARCHAR(500)    NULL,                       -- e.g. CN=svc,OU=Services,DC=corp,DC=local
        bind_password   NVARCHAR(500)    NULL,                       -- 服務帳號密碼（建議加密儲存）
        -- 使用者查詢
        user_search_base NVARCHAR(500)   NULL,                       -- 可覆寫 base_dn 用於搜尋使用者
        user_filter     NVARCHAR(500)    NULL DEFAULT '(sAMAccountName={0})', -- {0} = username
        -- 狀態
        enabled         BIT              NOT NULL DEFAULT 1,
        created_at      DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at      DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT FK_ldap_company FOREIGN KEY (company_id) REFERENCES dbo.companies(id),
        CONSTRAINT UQ_ldap_company UNIQUE (company_id)      -- 一家公司一組設定
    );
    PRINT 'Created table: company_ldap_settings';
END
ELSE
    PRINT 'Table company_ldap_settings already exists, skipped.';
GO

-- ============================================================
-- 2. SP: usp_GetLdapSettings（取得指定公司或全部的 LDAP 設定）
-- ============================================================
IF OBJECT_ID('dbo.usp_GetLdapSettings', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_GetLdapSettings;
GO
CREATE PROCEDURE dbo.usp_GetLdapSettings
    @CompanyId UNIQUEIDENTIFIER = NULL   -- NULL = 取全部
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        ls.id,
        ls.company_id,
        c.name          AS company_name,
        ls.ldap_host,
        ls.ldap_port,
        ls.use_ssl,
        ls.base_dn,
        ls.domain_prefix,
        ls.upn_suffix,
        ls.bind_dn,
        -- 密碼欄位遮罩，實際值只在後端服務取用
        CASE WHEN ls.bind_password IS NOT NULL THEN '********' ELSE NULL END AS bind_password_masked,
        ls.user_search_base,
        ls.user_filter,
        ls.enabled,
        ls.created_at,
        ls.updated_at
    FROM dbo.company_ldap_settings ls
    INNER JOIN dbo.companies c ON ls.company_id = c.id
    WHERE @CompanyId IS NULL OR ls.company_id = @CompanyId
    ORDER BY c.name;
END;
GO

-- ============================================================
-- 3. SP: usp_GetLdapSettingByCompanyId（後端驗證流程使用，含明文密碼）
-- ============================================================
IF OBJECT_ID('dbo.usp_GetLdapSettingByCompanyId', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_GetLdapSettingByCompanyId;
GO
CREATE PROCEDURE dbo.usp_GetLdapSettingByCompanyId
    @CompanyId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        ls.id,
        ls.company_id,
        ls.ldap_host,
        ls.ldap_port,
        ls.use_ssl,
        ls.base_dn,
        ls.domain_prefix,
        ls.upn_suffix,
        ls.bind_dn,
        ls.bind_password,       -- 明文，僅供服務層使用
        ls.user_search_base,
        ls.user_filter,
        ls.enabled
    FROM dbo.company_ldap_settings ls
    WHERE ls.company_id = @CompanyId AND ls.enabled = 1;
END;
GO

-- ============================================================
-- 4. SP: usp_GetLdapSettingByDomain
--    依 domain_prefix 或 upn_suffix 找到對應公司的 LDAP 設定
--    供登入流程自動識別使用
-- ============================================================
IF OBJECT_ID('dbo.usp_GetLdapSettingByDomain', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_GetLdapSettingByDomain;
GO
CREATE PROCEDURE dbo.usp_GetLdapSettingByDomain
    @Domain NVARCHAR(255)   -- 傳入 domain prefix 或 UPN suffix
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP 1
        ls.id,
        ls.company_id,
        ls.ldap_host,
        ls.ldap_port,
        ls.use_ssl,
        ls.base_dn,
        ls.domain_prefix,
        ls.upn_suffix,
        ls.bind_dn,
        ls.bind_password,
        ls.user_search_base,
        ls.user_filter,
        ls.enabled
    FROM dbo.company_ldap_settings ls
    WHERE ls.enabled = 1
      AND (
            LOWER(ls.domain_prefix) = LOWER(@Domain)
         OR LOWER(ls.upn_suffix)    = LOWER(@Domain)
      );
END;
GO

-- ============================================================
-- 5. SP: usp_SaveLdapSettings（新增或更新）
-- ============================================================
IF OBJECT_ID('dbo.usp_SaveLdapSettings', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_SaveLdapSettings;
GO
CREATE PROCEDURE dbo.usp_SaveLdapSettings
    @CompanyId      UNIQUEIDENTIFIER,
    @LdapHost       NVARCHAR(255),
    @LdapPort       INT             = 389,
    @UseSsl         BIT             = 0,
    @BaseDn         NVARCHAR(500),
    @DomainPrefix   NVARCHAR(100)   = NULL,
    @UpnSuffix      NVARCHAR(200)   = NULL,
    @BindDn         NVARCHAR(500)   = NULL,
    @BindPassword   NVARCHAR(500)   = NULL,  -- NULL = 不更新密碼
    @UserSearchBase NVARCHAR(500)   = NULL,
    @UserFilter     NVARCHAR(500)   = '(sAMAccountName={0})',
    @Enabled        BIT             = 1
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM dbo.company_ldap_settings WHERE company_id = @CompanyId)
    BEGIN
        UPDATE dbo.company_ldap_settings
        SET
            ldap_host        = @LdapHost,
            ldap_port        = @LdapPort,
            use_ssl          = @UseSsl,
            base_dn          = @BaseDn,
            domain_prefix    = NULLIF(LTRIM(RTRIM(@DomainPrefix)), ''),
            upn_suffix       = NULLIF(LTRIM(RTRIM(@UpnSuffix)), ''),
            bind_dn          = NULLIF(LTRIM(RTRIM(@BindDn)), ''),
            -- 若傳入 NULL 則保留原密碼
            bind_password    = CASE WHEN @BindPassword IS NOT NULL THEN @BindPassword ELSE bind_password END,
            user_search_base = NULLIF(LTRIM(RTRIM(@UserSearchBase)), ''),
            user_filter      = ISNULL(NULLIF(LTRIM(RTRIM(@UserFilter)), ''), '(sAMAccountName={0})'),
            enabled          = @Enabled,
            updated_at       = SYSUTCDATETIME()
        WHERE company_id = @CompanyId;
    END
    ELSE
    BEGIN
        INSERT INTO dbo.company_ldap_settings
            (id, company_id, ldap_host, ldap_port, use_ssl, base_dn,
             domain_prefix, upn_suffix, bind_dn, bind_password,
             user_search_base, user_filter, enabled)
        VALUES
            (NEWID(), @CompanyId, @LdapHost, @LdapPort, @UseSsl, @BaseDn,
             NULLIF(LTRIM(RTRIM(@DomainPrefix)), ''),
             NULLIF(LTRIM(RTRIM(@UpnSuffix)), ''),
             NULLIF(LTRIM(RTRIM(@BindDn)), ''),
             @BindPassword,
             NULLIF(LTRIM(RTRIM(@UserSearchBase)), ''),
             ISNULL(NULLIF(LTRIM(RTRIM(@UserFilter)), ''), '(sAMAccountName={0})'),
             @Enabled);
    END;

    -- 回傳最新設定（密碼遮罩）
    EXEC dbo.usp_GetLdapSettings @CompanyId = @CompanyId;
END;
GO

-- ============================================================
-- 6. SP: usp_DeleteLdapSettings
-- ============================================================
IF OBJECT_ID('dbo.usp_DeleteLdapSettings', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_DeleteLdapSettings;
GO
CREATE PROCEDURE dbo.usp_DeleteLdapSettings
    @CompanyId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.company_ldap_settings WHERE company_id = @CompanyId;
    SELECT @@ROWCOUNT AS affected;
END;
GO

PRINT 'Patch patch_ldap_settings.sql applied successfully.';
GO


-- ============================================================
-- PATCH: msg-44 Dashboard Stats
-- ============================================================
-- ============================================================
-- GITP 統計儀表板補丁 (msg-44)
-- 新增 usp_GetTicketStats Stored Procedure
-- 功能：依月/年查詢各公司工單數量及處理狀態分佈
-- 權限：僅 IT 公司人員可呼叫（後端層控管）
-- ============================================================

IF OBJECT_ID('dbo.usp_GetTicketStats', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_GetTicketStats;
GO

CREATE PROCEDURE dbo.usp_GetTicketStats
    @Period   NVARCHAR(10),   -- 'month' 或 'year'
    @Year     INT,
    @Month    INT = NULL      -- 僅 Period='month' 時使用
AS
BEGIN
    SET NOCOUNT ON;

    -- 計算時間範圍
    DECLARE @StartDate DATETIME2, @EndDate DATETIME2;
    IF @Period = N'month' AND @Month IS NOT NULL
    BEGIN
        SET @StartDate = DATETIMEFROMPARTS(@Year, @Month, 1, 0, 0, 0, 0);
        SET @EndDate   = DATEADD(MONTH, 1, @StartDate);
    END
    ELSE -- year
    BEGIN
        SET @StartDate = DATETIMEFROMPARTS(@Year, 1, 1, 0, 0, 0, 0);
        SET @EndDate   = DATETIMEFROMPARTS(@Year + 1, 1, 1, 0, 0, 0, 0);
    END

    -- 各公司工單統計
    SELECT
        c.id            AS CompanyId,
        c.name          AS CompanyName,
        COUNT(t.id)     AS Total,
        SUM(CASE WHEN t.status = N'新建立'        THEN 1 ELSE 0 END) AS StatusNew,
        SUM(CASE WHEN t.status = N'處理中'        THEN 1 ELSE 0 END) AS StatusProcessing,
        SUM(CASE WHEN t.status = N'待使用者補充'   THEN 1 ELSE 0 END) AS StatusPendingSupply,
        SUM(CASE WHEN t.status = N'待使用者確認'   THEN 1 ELSE 0 END) AS StatusPendingConfirm,
        SUM(CASE WHEN t.status = N'已解決'        THEN 1 ELSE 0 END) AS StatusResolved,
        SUM(CASE WHEN t.status = N'已結案'        THEN 1 ELSE 0 END) AS StatusClosed,
        -- 嚴重度分佈
        SUM(CASE WHEN t.severity = 1 THEN 1 ELSE 0 END) AS SeverityHigh,
        SUM(CASE WHEN t.severity = 2 THEN 1 ELSE 0 END) AS SeverityMed,
        SUM(CASE WHEN t.severity = 3 THEN 1 ELSE 0 END) AS SeverityLow,
        SUM(CASE WHEN t.severity IS NULL THEN 1 ELSE 0 END) AS SeverityUnset,
        -- 緊急度分佈
        SUM(CASE WHEN t.urgency = 1 THEN 1 ELSE 0 END) AS UrgencyHigh,
        SUM(CASE WHEN t.urgency = 2 THEN 1 ELSE 0 END) AS UrgencyMed,
        SUM(CASE WHEN t.urgency = 3 THEN 1 ELSE 0 END) AS UrgencyLow,
        SUM(CASE WHEN t.urgency IS NULL THEN 1 ELSE 0 END) AS UrgencyUnset,
        -- 平均處理時間（小時，僅已結案工單）
        AVG(CASE
            WHEN t.status = N'已結案' AND t.closed_at IS NOT NULL
            THEN CAST(DATEDIFF(MINUTE, t.created_at, t.closed_at) AS FLOAT) / 60.0
            ELSE NULL
        END) AS AvgCloseHours
    FROM dbo.companies c
    LEFT JOIN dbo.tickets t
        ON  t.company_id = c.id
        AND t.created_at >= @StartDate
        AND t.created_at <  @EndDate
    WHERE c.is_it_company = 0   -- 只統計子公司（IT 公司本身不提問題）
    GROUP BY c.id, c.name
    ORDER BY COUNT(t.id) DESC, c.name;

    -- 整體摘要（單一資料列）
    SELECT
        COUNT(t.id)     AS GrandTotal,
        SUM(CASE WHEN t.status = N'新建立'        THEN 1 ELSE 0 END) AS StatusNew,
        SUM(CASE WHEN t.status = N'處理中'        THEN 1 ELSE 0 END) AS StatusProcessing,
        SUM(CASE WHEN t.status = N'待使用者補充'   THEN 1 ELSE 0 END) AS StatusPendingSupply,
        SUM(CASE WHEN t.status = N'待使用者確認'   THEN 1 ELSE 0 END) AS StatusPendingConfirm,
        SUM(CASE WHEN t.status = N'已解決'        THEN 1 ELSE 0 END) AS StatusResolved,
        SUM(CASE WHEN t.status = N'已結案'        THEN 1 ELSE 0 END) AS StatusClosed,
        @StartDate AS PeriodStart,
        @EndDate   AS PeriodEnd
    FROM dbo.tickets t
    WHERE t.created_at >= @StartDate
      AND t.created_at <  @EndDate;
END
GO


-- ============================================================
-- usp_GetAttachmentSettings
-- ============================================================
IF OBJECT_ID('dbo.usp_GetAttachmentSettings', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_GetAttachmentSettings;
GO
CREATE PROCEDURE dbo.usp_GetAttachmentSettings
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        upload_enabled      AS UploadEnabled,
        allowed_extensions  AS AllowedExtensions,
        allowed_mime_types  AS AllowedMimeTypes,
        max_file_size_bytes AS MaxFileSizeBytes,
        updated_at          AS UpdatedAt,
        updated_by          AS UpdatedBy
    FROM dbo.attachment_settings WHERE id = 1;
END
GO

-- ============================================================
-- usp_SaveAttachmentSettings
-- ============================================================
IF OBJECT_ID('dbo.usp_SaveAttachmentSettings', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_SaveAttachmentSettings;
GO
CREATE PROCEDURE dbo.usp_SaveAttachmentSettings
    @UploadEnabled      BIT,
    @AllowedExtensions  NVARCHAR(500),
    @AllowedMimeTypes   NVARCHAR(1000),
    @MaxFileSizeBytes   BIGINT,
    @UpdatedBy          UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.attachment_settings
    SET
        upload_enabled      = @UploadEnabled,
        allowed_extensions  = @AllowedExtensions,
        allowed_mime_types  = @AllowedMimeTypes,
        max_file_size_bytes = @MaxFileSizeBytes,
        updated_at          = GETUTCDATE(),
        updated_by          = @UpdatedBy
    WHERE id = 1;

    SELECT
        upload_enabled      AS UploadEnabled,
        allowed_extensions  AS AllowedExtensions,
        allowed_mime_types  AS AllowedMimeTypes,
        max_file_size_bytes AS MaxFileSizeBytes,
        updated_at          AS UpdatedAt,
        updated_by          AS UpdatedBy
    FROM dbo.attachment_settings WHERE id = 1;
END
GO

-- ============================================================
-- PATCH: msg-64 Employee ID / Department fields
-- (emp_id, dep_id, dep_name now defined in CREATE TABLE users above)
-- ============================================================

-- ═══════════════════════════════════════════════════════════════════
-- API Permission Management
-- ═══════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.api_permissions', 'U') IS NOT NULL DROP TABLE dbo.api_permissions;
CREATE TABLE dbo.api_permissions (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    http_method    NVARCHAR(10)  NOT NULL,
    path_pattern   NVARCHAR(300) NOT NULL,
    required_roles NVARCHAR(200) NOT NULL DEFAULT N'',
    description    NVARCHAR(500) NULL,
    is_active      BIT           NOT NULL DEFAULT 1,
    created_at     DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT UQ_api_permissions UNIQUE (http_method, path_pattern)
);
CREATE INDEX IX_api_permissions_active ON dbo.api_permissions(is_active, http_method);

-- API Audit Logs
IF OBJECT_ID('dbo.api_audit_logs', 'U') IS NOT NULL DROP TABLE dbo.api_audit_logs;
CREATE TABLE dbo.api_audit_logs (
    id           BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id      UNIQUEIDENTIFIER NULL,
    user_email   NVARCHAR(200)    NULL,
    emp_id       NVARCHAR(50)     NULL,
    http_method  NVARCHAR(10)     NOT NULL,
    path         NVARCHAR(500)    NOT NULL,
    query_string NVARCHAR(1000)   NULL,
    status_code  INT              NULL,
    ip_address   NVARCHAR(50)     NULL,
    user_agent   NVARCHAR(500)    NULL,
    duration_ms  INT              NULL,
    created_at   DATETIME2        NOT NULL DEFAULT GETUTCDATE()
);
CREATE INDEX IX_api_audit_user    ON dbo.api_audit_logs(user_id);
CREATE INDEX IX_api_audit_created ON dbo.api_audit_logs(created_at);
CREATE INDEX IX_api_audit_path    ON dbo.api_audit_logs(path, http_method);
GO

-- SP: Load all active permissions
IF OBJECT_ID('dbo.usp_GetApiPermissions', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_GetApiPermissions;
GO
CREATE PROCEDURE dbo.usp_GetApiPermissions
AS
BEGIN
    SET NOCOUNT ON;
    SELECT id AS Id, http_method AS HttpMethod, path_pattern AS PathPattern,
           required_roles AS RequiredRoles, description AS Description
    FROM dbo.api_permissions
    WHERE is_active = 1
    ORDER BY LEN(path_pattern) DESC, http_method;
END
GO

-- SP: Save (upsert) a permission rule
IF OBJECT_ID('dbo.usp_SaveApiPermission', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_SaveApiPermission;
GO
CREATE PROCEDURE dbo.usp_SaveApiPermission
    @HttpMethod    NVARCHAR(10),
    @PathPattern   NVARCHAR(300),
    @RequiredRoles NVARCHAR(200),
    @Description   NVARCHAR(500) = NULL,
    @IsActive      BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM dbo.api_permissions WHERE http_method = @HttpMethod AND path_pattern = @PathPattern)
        UPDATE dbo.api_permissions
        SET required_roles = @RequiredRoles, description = @Description, is_active = @IsActive
        WHERE http_method = @HttpMethod AND path_pattern = @PathPattern;
    ELSE
        INSERT INTO dbo.api_permissions (http_method, path_pattern, required_roles, description, is_active)
        VALUES (@HttpMethod, @PathPattern, @RequiredRoles, @Description, @IsActive);
    SELECT SCOPE_IDENTITY() AS Id;
END
GO

-- SP: Write API audit log
IF OBJECT_ID('dbo.usp_CreateApiAuditLog', 'P') IS NOT NULL DROP PROCEDURE dbo.usp_CreateApiAuditLog;
GO
CREATE PROCEDURE dbo.usp_CreateApiAuditLog
    @UserId      UNIQUEIDENTIFIER = NULL,
    @UserEmail   NVARCHAR(200) = NULL,
    @EmpId       NVARCHAR(50) = NULL,
    @HttpMethod  NVARCHAR(10),
    @Path        NVARCHAR(500),
    @QueryString NVARCHAR(1000) = NULL,
    @StatusCode  INT = NULL,
    @IpAddress   NVARCHAR(50) = NULL,
    @UserAgent   NVARCHAR(500) = NULL,
    @DurationMs  INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.api_audit_logs
        (user_id, user_email, emp_id, http_method, path, query_string, status_code, ip_address, user_agent, duration_ms)
    VALUES
        (@UserId, @UserEmail, @EmpId, @HttpMethod, @Path, @QueryString, @StatusCode, @IpAddress, @UserAgent, @DurationMs);
END
GO
