-- =============================================================
-- GITP System - Seed Data (SQL Server 2022)
-- v3: IT company flag, multi-role support
-- v4 (msg-23): Companies with is_it_company
-- v5 (msg-25): Issue types, Company systems
-- =============================================================
SET NOCOUNT ON;
GO

EXEC dbo.usp_SetSessionContext @Roles = N'it_admin';
GO

-- =============================================================
-- 1. Companies
-- =============================================================

IF NOT EXISTS (SELECT 1 FROM dbo.companies WHERE id = '11111111-1111-1111-1111-111111111111')
    INSERT INTO dbo.companies (id, name, code, is_it_company, created_at)
    VALUES ('11111111-1111-1111-1111-111111111111', N'集團總部 (IT公司)', 'HQ', 1, GETUTCDATE());
ELSE
    UPDATE dbo.companies SET is_it_company = 1 WHERE id = '11111111-1111-1111-1111-111111111111';

IF NOT EXISTS (SELECT 1 FROM dbo.companies WHERE id = '22222222-2222-2222-2222-222222222222')
    INSERT INTO dbo.companies (id, name, code, created_at)
    VALUES ('22222222-2222-2222-2222-222222222222', N'Alpha 製造公司', 'ALPHA', GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM dbo.companies WHERE id = '33333333-3333-3333-3333-333333333333')
    INSERT INTO dbo.companies (id, name, code, created_at)
    VALUES ('33333333-3333-3333-3333-333333333333', N'Beta 服務公司', 'BETA', GETUTCDATE());

-- =============================================================
-- 2. Users (password: secret)
-- BCrypt hash: $2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi
-- =============================================================

IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    INSERT INTO dbo.users (id, company_id, name, email, phone, emp_id, dep_id, dep_name, password_hash)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
            N'IT 管理員', 'admin@gitp.local', '02-1234-0001',
            'HQ001', 'IT', N'資訊部',
            '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');

IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
    INSERT INTO dbo.users (id, company_id, name, email, phone, emp_id, dep_id, dep_name, password_hash)
    VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111',
            N'工程師 王小明', 'it1@gitp.local', '02-1234-0002',
            'HQ002', 'IT', N'資訊部',
            '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');

IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc')
    INSERT INTO dbo.users (id, company_id, name, email, phone, emp_id, dep_id, dep_name, password_hash)
    VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111',
            N'工程師 李大華', 'it2@gitp.local', '02-1234-0003',
            'HQ003', 'IT', N'資訊部',
            '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');

IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE id = 'bbbb0000-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
    INSERT INTO dbo.users (id, company_id, name, email, phone, emp_id, dep_id, dep_name, password_hash)
    VALUES ('bbbb0000-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111',
            N'資深工程師 張雅文', 'senior@gitp.local', '02-1234-0004',
            'HQ004', 'IT', N'資訊部',
            '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');

IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd')
    INSERT INTO dbo.users (id, company_id, name, email, phone, emp_id, dep_id, dep_name, password_hash)
    VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222',
            N'陳小花', 'user1@alpha.local', '04-5678-0001',
            'ALP001', 'MFG', N'製造部',
            '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');

IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')
    INSERT INTO dbo.users (id, company_id, name, email, phone, emp_id, dep_id, dep_name, password_hash)
    VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222',
            N'林志明', 'user2@alpha.local', '04-5678-0002',
            'ALP002', 'ENG', N'工程部',
            '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');

IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff')
    INSERT INTO dbo.users (id, company_id, name, email, phone, emp_id, dep_id, dep_name, password_hash)
    VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '33333333-3333-3333-3333-333333333333',
            N'黃美玲', 'user1@beta.local', '07-8901-0001',
            'BET001', 'SVC', N'服務部',
            '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');

IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE id = '00000000-0000-0000-0000-000000000001')
    INSERT INTO dbo.users (id, company_id, name, email, phone, emp_id, dep_id, dep_name, password_hash)
    VALUES ('00000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333',
            N'張偉強', 'user2@beta.local', '07-8901-0002',
            'BET002', 'OPS', N'營運部',
            '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');

-- =============================================================
-- 3. User Roles
-- =============================================================

IF NOT EXISTS (SELECT 1 FROM dbo.user_roles WHERE user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND role = 'it_admin')
    INSERT INTO dbo.user_roles (user_id, role) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'it_admin');
IF NOT EXISTS (SELECT 1 FROM dbo.user_roles WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AND role = 'it_assignee')
    INSERT INTO dbo.user_roles (user_id, role) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'it_assignee');
IF NOT EXISTS (SELECT 1 FROM dbo.user_roles WHERE user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' AND role = 'it_assignee')
    INSERT INTO dbo.user_roles (user_id, role) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'it_assignee');
IF NOT EXISTS (SELECT 1 FROM dbo.user_roles WHERE user_id = 'bbbb0000-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AND role = 'it_admin')
    INSERT INTO dbo.user_roles (user_id, role) VALUES ('bbbb0000-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'it_admin');
IF NOT EXISTS (SELECT 1 FROM dbo.user_roles WHERE user_id = 'bbbb0000-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AND role = 'it_assignee')
    INSERT INTO dbo.user_roles (user_id, role) VALUES ('bbbb0000-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'it_assignee');

-- =============================================================
-- 4. Issue Types (問題類型)
-- =============================================================

IF NOT EXISTS (SELECT 1 FROM dbo.issue_types WHERE id = 'itttt000-0000-0000-0000-000000000001')
    INSERT INTO dbo.issue_types (id, name, sort_order, is_active) VALUES
    ('itttt000-0000-0000-0000-000000000001', N'硬體故障', 1, 1);
IF NOT EXISTS (SELECT 1 FROM dbo.issue_types WHERE id = 'itttt000-0000-0000-0000-000000000002')
    INSERT INTO dbo.issue_types (id, name, sort_order, is_active) VALUES
    ('itttt000-0000-0000-0000-000000000002', N'軟體問題', 2, 1);
IF NOT EXISTS (SELECT 1 FROM dbo.issue_types WHERE id = 'itttt000-0000-0000-0000-000000000003')
    INSERT INTO dbo.issue_types (id, name, sort_order, is_active) VALUES
    ('itttt000-0000-0000-0000-000000000003', N'網路連線', 3, 1);
IF NOT EXISTS (SELECT 1 FROM dbo.issue_types WHERE id = 'itttt000-0000-0000-0000-000000000004')
    INSERT INTO dbo.issue_types (id, name, sort_order, is_active) VALUES
    ('itttt000-0000-0000-0000-000000000004', N'帳號權限', 4, 1);
IF NOT EXISTS (SELECT 1 FROM dbo.issue_types WHERE id = 'itttt000-0000-0000-0000-000000000005')
    INSERT INTO dbo.issue_types (id, name, sort_order, is_active) VALUES
    ('itttt000-0000-0000-0000-000000000005', N'資安事件', 5, 1);
IF NOT EXISTS (SELECT 1 FROM dbo.issue_types WHERE id = 'itttt000-0000-0000-0000-000000000006')
    INSERT INTO dbo.issue_types (id, name, sort_order, is_active) VALUES
    ('itttt000-0000-0000-0000-000000000006', N'系統效能', 6, 1);
IF NOT EXISTS (SELECT 1 FROM dbo.issue_types WHERE id = 'itttt000-0000-0000-0000-000000000007')
    INSERT INTO dbo.issue_types (id, name, sort_order, is_active) VALUES
    ('itttt000-0000-0000-0000-000000000007', N'其他', 99, 1);

-- =============================================================
-- 5. Company Systems (各公司系統別)
-- =============================================================

-- HQ (IT公司) systems
IF NOT EXISTS (SELECT 1 FROM dbo.company_systems WHERE id = 'sysid000-0000-0000-0000-100000000001')
    INSERT INTO dbo.company_systems (id, company_id, name, sort_order) VALUES
    ('sysid000-0000-0000-0000-100000000001', '11111111-1111-1111-1111-111111111111', N'IT 管理平台', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.company_systems WHERE id = 'sysid000-0000-0000-0000-100000000002')
    INSERT INTO dbo.company_systems (id, company_id, name, sort_order) VALUES
    ('sysid000-0000-0000-0000-100000000002', '11111111-1111-1111-1111-111111111111', N'Active Directory', 2);
IF NOT EXISTS (SELECT 1 FROM dbo.company_systems WHERE id = 'sysid000-0000-0000-0000-100000000003')
    INSERT INTO dbo.company_systems (id, company_id, name, sort_order) VALUES
    ('sysid000-0000-0000-0000-100000000003', '11111111-1111-1111-1111-111111111111', N'Email 伺服器', 3);

-- Alpha 製造公司 systems
IF NOT EXISTS (SELECT 1 FROM dbo.company_systems WHERE id = 'sysid000-0000-0000-0000-200000000001')
    INSERT INTO dbo.company_systems (id, company_id, name, sort_order) VALUES
    ('sysid000-0000-0000-0000-200000000001', '22222222-2222-2222-2222-222222222222', N'ERP 系統', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.company_systems WHERE id = 'sysid000-0000-0000-0000-200000000002')
    INSERT INTO dbo.company_systems (id, company_id, name, sort_order) VALUES
    ('sysid000-0000-0000-0000-200000000002', '22222222-2222-2222-2222-222222222222', N'MES 製造執行系統', 2);
IF NOT EXISTS (SELECT 1 FROM dbo.company_systems WHERE id = 'sysid000-0000-0000-0000-200000000003')
    INSERT INTO dbo.company_systems (id, company_id, name, sort_order) VALUES
    ('sysid000-0000-0000-0000-200000000003', '22222222-2222-2222-2222-222222222222', N'OA 辦公自動化', 3);
IF NOT EXISTS (SELECT 1 FROM dbo.company_systems WHERE id = 'sysid000-0000-0000-0000-200000000004')
    INSERT INTO dbo.company_systems (id, company_id, name, sort_order) VALUES
    ('sysid000-0000-0000-0000-200000000004', '22222222-2222-2222-2222-222222222222', N'網路設備', 4);

-- Beta 服務公司 systems
IF NOT EXISTS (SELECT 1 FROM dbo.company_systems WHERE id = 'sysid000-0000-0000-0000-300000000001')
    INSERT INTO dbo.company_systems (id, company_id, name, sort_order) VALUES
    ('sysid000-0000-0000-0000-300000000001', '33333333-3333-3333-3333-333333333333', N'CRM 客戶管理', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.company_systems WHERE id = 'sysid000-0000-0000-0000-300000000002')
    INSERT INTO dbo.company_systems (id, company_id, name, sort_order) VALUES
    ('sysid000-0000-0000-0000-300000000002', '33333333-3333-3333-3333-333333333333', N'Office 365', 2);
IF NOT EXISTS (SELECT 1 FROM dbo.company_systems WHERE id = 'sysid000-0000-0000-0000-300000000003')
    INSERT INTO dbo.company_systems (id, company_id, name, sort_order) VALUES
    ('sysid000-0000-0000-0000-300000000003', '33333333-3333-3333-3333-333333333333', N'VPN 遠端連線', 3);
IF NOT EXISTS (SELECT 1 FROM dbo.company_systems WHERE id = 'sysid000-0000-0000-0000-300000000004')
    INSERT INTO dbo.company_systems (id, company_id, name, sort_order) VALUES
    ('sysid000-0000-0000-0000-300000000004', '33333333-3333-3333-3333-333333333333', N'印表機/週邊設備', 4);

-- =============================================================
-- 6. Tickets (same as v3, with classification on some)
-- =============================================================

IF NOT EXISTS (SELECT 1 FROM dbo.tickets WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001')
    INSERT INTO dbo.tickets (id, ticket_no, company_id, submitter_id, assignee_id,
                             subject, description, status,
                             issue_type_id, affected_company_id, system_id, severity, urgency,
                             created_at, first_response_at, updated_at)
    VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'GITP-202401-1000',
            '22222222-2222-2222-2222-222222222222',
            'dddddddd-dddd-dddd-dddd-dddddddddddd',
            'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            N'ERP 系統無法登入',
            N'今天早上 9 點開始無法登入 ERP 系統，畫面顯示「帳號或密碼錯誤」，昨天還可以正常使用。',
            N'處理中',
            'itttt000-0000-0000-0000-000000000004',
            '22222222-2222-2222-2222-222222222222',
            'sysid000-0000-0000-0000-200000000001',
            1, 1,
            DATEADD(day, -3, GETUTCDATE()),
            DATEADD(hour, -70, GETUTCDATE()),
            DATEADD(day, -2, GETUTCDATE()));

IF NOT EXISTS (SELECT 1 FROM dbo.tickets WHERE id = 'aaaaaaaa-0000-0000-0000-000000000002')
    INSERT INTO dbo.tickets (id, ticket_no, company_id, submitter_id, assignee_id,
                             subject, description, status, created_at, updated_at)
    VALUES ('aaaaaaaa-0000-0000-0000-000000000002', 'GITP-202401-1001',
            '22222222-2222-2222-2222-222222222222',
            'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', NULL,
            N'印表機離線無法列印',
            N'3樓的網路印表機顯示離線，無法列印任何文件。已嘗試重開機，問題依然存在。',
            N'新建立',
            DATEADD(day, -1, GETUTCDATE()),
            DATEADD(day, -1, GETUTCDATE()));

IF NOT EXISTS (SELECT 1 FROM dbo.tickets WHERE id = 'aaaaaaaa-0000-0000-0000-000000000003')
    INSERT INTO dbo.tickets (id, ticket_no, company_id, submitter_id, assignee_id,
                             subject, description, status,
                             issue_type_id, affected_company_id, system_id, severity, urgency,
                             created_at, first_response_at, closed_at, updated_at)
    VALUES ('aaaaaaaa-0000-0000-0000-000000000003', 'GITP-202401-1002',
            '33333333-3333-3333-3333-333333333333',
            'ffffffff-ffff-ffff-ffff-ffffffffffff',
            'cccccccc-cccc-cccc-cccc-cccccccccccc',
            N'Office 365 授權過期',
            N'Word、Excel 都顯示授權過期，無法開啟任何 Office 文件，影響工作進度。',
            N'已結案',
            'itttt000-0000-0000-0000-000000000002',
            '33333333-3333-3333-3333-333333333333',
            'sysid000-0000-0000-0000-300000000002',
            2, 1,
            DATEADD(day, -7, GETUTCDATE()),
            DATEADD(hour, -167, GETUTCDATE()),
            DATEADD(day, -5, GETUTCDATE()),
            DATEADD(day, -5, GETUTCDATE()));

IF NOT EXISTS (SELECT 1 FROM dbo.tickets WHERE id = 'aaaaaaaa-0000-0000-0000-000000000004')
    INSERT INTO dbo.tickets (id, ticket_no, company_id, submitter_id, assignee_id,
                             subject, description, status,
                             created_at, first_response_at, updated_at)
    VALUES ('aaaaaaaa-0000-0000-0000-000000000004', 'GITP-202401-1003',
            '33333333-3333-3333-3333-333333333333',
            '00000000-0000-0000-0000-000000000001',
            'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            N'VPN 連線頻繁斷線',
            N'遠端工作時 VPN 每隔約 30 分鐘就會自動斷線，已影響工作效率三天。',
            N'待使用者補充',
            DATEADD(day, -2, GETUTCDATE()),
            DATEADD(hour, -46, GETUTCDATE()),
            DATEADD(day, -1, GETUTCDATE()));

IF NOT EXISTS (SELECT 1 FROM dbo.tickets WHERE id = 'aaaaaaaa-0000-0000-0000-000000000005')
    INSERT INTO dbo.tickets (id, ticket_no, company_id, submitter_id, assignee_id,
                             subject, description, status,
                             created_at, first_response_at, updated_at)
    VALUES ('aaaaaaaa-0000-0000-0000-000000000005', 'GITP-202401-1004',
            '22222222-2222-2222-2222-222222222222',
            'dddddddd-dddd-dddd-dddd-dddddddddddd',
            'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            N'電腦速度嚴重變慢',
            N'筆電最近速度非常慢，CPU 使用率常達 90% 以上，已嘗試重開機但未改善。',
            N'已解決',
            DATEADD(day, -5, GETUTCDATE()),
            DATEADD(hour, -117, GETUTCDATE()),
            DATEADD(day, -1, GETUTCDATE()));

-- =============================================================
-- 7. Ticket Messages (same as before)
-- =============================================================

IF NOT EXISTS (SELECT 1 FROM dbo.ticket_messages WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001')
    INSERT INTO dbo.ticket_messages (id, ticket_id, author_id, content, is_it_reply, created_at)
    VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
            'dddddddd-dddd-dddd-dddd-dddddddddddd',
            N'補充說明：使用 Chrome 瀏覽器，其他同事也有類似問題。', 0, DATEADD(hour, -71, GETUTCDATE()));

IF NOT EXISTS (SELECT 1 FROM dbo.ticket_messages WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002')
    INSERT INTO dbo.ticket_messages (id, ticket_id, author_id, content, is_it_reply, created_at)
    VALUES ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
            'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            N'已確認是 AD 整合認證問題，正在修復中，預計下午 3 點前完成。', 1, DATEADD(hour, -70, GETUTCDATE()));

IF NOT EXISTS (SELECT 1 FROM dbo.ticket_messages WHERE id = 'bbbbbbbb-0000-0000-0000-000000000003')
    INSERT INTO dbo.ticket_messages (id, ticket_id, author_id, content, is_it_reply, created_at)
    VALUES ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003',
            'cccccccc-cccc-cccc-cccc-cccccccccccc',
            N'已重新指派 Office 365 授權，請登出後重新登入並等候 5-10 分鐘。', 1, DATEADD(hour, -167, GETUTCDATE()));

IF NOT EXISTS (SELECT 1 FROM dbo.ticket_messages WHERE id = 'bbbbbbbb-0000-0000-0000-000000000004')
    INSERT INTO dbo.ticket_messages (id, ticket_id, author_id, content, is_it_reply, created_at)
    VALUES ('bbbbbbbb-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000003',
            'ffffffff-ffff-ffff-ffff-ffffffffffff',
            N'已照步驟操作，Office 恢復正常，謝謝！', 0, DATEADD(hour, -122, GETUTCDATE()));

IF NOT EXISTS (SELECT 1 FROM dbo.ticket_messages WHERE id = 'bbbbbbbb-0000-0000-0000-000000000005')
    INSERT INTO dbo.ticket_messages (id, ticket_id, author_id, content, is_it_reply, created_at)
    VALUES ('bbbbbbbb-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000004',
            'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            N'請提供作業系統版本及 VPN 日誌檔案以便診斷。', 1, DATEADD(hour, -46, GETUTCDATE()));

IF NOT EXISTS (SELECT 1 FROM dbo.ticket_messages WHERE id = 'bbbbbbbb-0000-0000-0000-000000000006')
    INSERT INTO dbo.ticket_messages (id, ticket_id, author_id, content, is_it_reply, created_at)
    VALUES ('bbbbbbbb-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000005',
            'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            N'遠端診斷完成，已清除惡意程式並更新驅動程式，請確認速度是否恢復。', 1, DATEADD(hour, -48, GETUTCDATE()));

IF NOT EXISTS (SELECT 1 FROM dbo.ticket_messages WHERE id = 'bbbbbbbb-0000-0000-0000-000000000007')
    INSERT INTO dbo.ticket_messages (id, ticket_id, author_id, content, is_it_reply, created_at)
    VALUES ('bbbbbbbb-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000005',
            'dddddddd-dddd-dddd-dddd-dddddddddddd',
            N'速度已恢復正常，非常感謝！', 0, DATEADD(hour, -36, GETUTCDATE()));

PRINT N'Seed data v5 (issue types + company systems) inserted successfully.';
GO

-- =============================================================
-- Default API permission rules
-- =============================================================
IF NOT EXISTS (SELECT 1 FROM dbo.api_permissions WHERE http_method = N'*' AND path_pattern = N'/api/admin/*')
BEGIN
    INSERT INTO dbo.api_permissions (http_method, path_pattern, required_roles, description) VALUES
    (N'*',      N'/api/admin/*',                        N'it_admin',             N'所有管理員功能'),
    (N'*',      N'/api/ldap/*',                         N'it_admin',             N'LDAP 設定管理'),
    (N'GET',    N'/api/companies',                      N'it_admin',             N'公司清單'),
    (N'PUT',    N'/api/companies/*',                    N'it_admin',             N'公司設定'),
    (N'POST',   N'/api/reports/exports',                N'it_admin',             N'啟動 Excel 匯出（僅管理員）'),
    (N'GET',    N'/api/reports/exports/*',              N'it_admin,it_assignee', N'查詢/下載匯出結果'),
    (N'GET',    N'/api/dashboard/*',                    N'it_admin,it_assignee', N'統計儀表板（IT 公司）'),
    (N'POST',   N'/api/classification/issue-types',     N'it_admin',             N'新增問題類型'),
    (N'PUT',    N'/api/classification/issue-types/*',   N'it_admin',             N'更新問題類型'),
    (N'DELETE', N'/api/classification/issue-types/*',   N'it_admin',             N'停用問題類型'),
    (N'POST',   N'/api/classification/systems',         N'it_admin',             N'新增系統別'),
    (N'PUT',    N'/api/classification/systems/*',       N'it_admin',             N'更新系統別'),
    (N'DELETE', N'/api/classification/systems/*',       N'it_admin',             N'停用系統別'),
    (N'PUT',    N'/api/attachment-settings',            N'it_admin',             N'附件設定管理'),
    (N'PUT',    N'/api/tickets/*/assign',               N'it_admin',             N'指派工單'),
    (N'POST',   N'/api/tickets/batch-assignments',      N'it_admin',             N'批次指派'),
    (N'PUT',    N'/api/tickets/*/transfer',             N'it_admin,it_assignee', N'轉派工單'),
    (N'GET',    N'/api/tickets/*/handlers',             N'it_admin,it_assignee', N'處理記錄');
END
GO
