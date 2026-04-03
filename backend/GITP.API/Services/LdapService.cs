using System.Data;
using Dapper;
using GITP.API.DTOs;
using Microsoft.Data.SqlClient;
using Novell.Directory.Ldap;

namespace GITP.API.Services;

/// <summary>
/// Handles per-company LDAP authentication.
/// Each subsidiary company may have its own AD/LDAP server; the host IP and
/// connection parameters are stored in company_ldap_settings and managed by
/// IT administrators through the admin UI.
/// </summary>
public class LdapService
{
    private readonly SqlConnection _connection;
    private readonly ILogger<LdapService> _logger;

    public LdapService(SqlConnection connection, ILogger<LdapService> logger)
    {
        _connection = connection;
        _logger     = logger;
    }

    // ── Settings CRUD ─────────────────────────────────────────────────────────

    public async Task<IEnumerable<LdapSettingsDto>> GetAllSettingsAsync()
    {
        await EnsureOpenAsync();
        return await _connection.QueryAsync<LdapSettingsDto>(
            "usp_GetLdapSettings",
            new { CompanyId = (Guid?)null },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<LdapSettingsDto?> GetSettingsByCompanyAsync(Guid companyId)
    {
        await EnsureOpenAsync();
        return await _connection.QueryFirstOrDefaultAsync<LdapSettingsDto>(
            "usp_GetLdapSettings",
            new { CompanyId = companyId },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<LdapSettingsDto?> SaveSettingsAsync(Guid companyId, SaveLdapSettingsRequest req)
    {
        await EnsureOpenAsync();
        return await _connection.QueryFirstOrDefaultAsync<LdapSettingsDto>(
            "usp_SaveLdapSettings",
            new
            {
                CompanyId      = companyId,
                LdapHost       = req.LdapHost.Trim(),
                LdapPort       = req.LdapPort,
                UseSsl         = req.UseSsl,
                BaseDn         = req.BaseDn.Trim(),
                DomainPrefix   = req.DomainPrefix?.Trim(),
                UpnSuffix      = req.UpnSuffix?.Trim(),
                BindDn         = req.BindDn?.Trim(),
                BindPassword   = req.BindPassword,
                UserSearchBase = req.UserSearchBase?.Trim(),
                UserFilter     = string.IsNullOrWhiteSpace(req.UserFilter) ? "(sAMAccountName={0})" : req.UserFilter.Trim(),
                Enabled        = req.Enabled
            },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<int> DeleteSettingsAsync(Guid companyId)
    {
        await EnsureOpenAsync();
        var result = await _connection.QueryFirstOrDefaultAsync<dynamic>(
            "usp_DeleteLdapSettings",
            new { CompanyId = companyId },
            commandType: CommandType.StoredProcedure);
        return (int)(result?.affected ?? 0);
    }

    // ── Authentication ────────────────────────────────────────────────────────

    /// <summary>
    /// Resolves LDAP settings for a login attempt.
    /// Accepts DOMAIN\user, user@domain.local, or plain username with explicit companyId.
    /// Returns (settings, plainUsername) or null if no matching config found.
    /// </summary>
    public async Task<(LdapSettingsInternal settings, string plainUsername)?> ResolveSettingsAsync(
        string rawUsername, Guid? companyId)
    {
        await EnsureOpenAsync();

        LdapSettingsInternal? settings = null;
        string plainUsername = rawUsername;

        if (companyId.HasValue)
        {
            // Explicit company ID – load directly
            settings = await _connection.QueryFirstOrDefaultAsync<LdapSettingsInternal>(
                "usp_GetLdapSettingByCompanyId",
                new { CompanyId = companyId.Value },
                commandType: CommandType.StoredProcedure);
        }
        else
        {
            // Try to auto-detect domain from username format
            string? domain = null;

            if (rawUsername.Contains('\\'))
            {
                // DOMAIN\username
                var parts = rawUsername.Split('\\', 2);
                domain        = parts[0];
                plainUsername = parts[1];
            }
            else if (rawUsername.Contains('@'))
            {
                // user@domain.local
                var parts = rawUsername.Split('@', 2);
                domain        = parts[1];
                plainUsername = parts[0];
            }

            if (!string.IsNullOrWhiteSpace(domain))
            {
                settings = await _connection.QueryFirstOrDefaultAsync<LdapSettingsInternal>(
                    "usp_GetLdapSettingByDomain",
                    new { Domain = domain },
                    commandType: CommandType.StoredProcedure);
            }
        }

        if (settings == null || !settings.Enabled)
            return null;

        return (settings, plainUsername);
    }

    /// <summary>
    /// Authenticates a user against the configured LDAP server.
    /// Returns true if the bind succeeds; false otherwise.
    /// </summary>
    public async Task<bool> AuthenticateAsync(LdapSettingsInternal settings, string username, string password)
    {
        if (string.IsNullOrWhiteSpace(password))
            return false;

        return await Task.Run(() =>
        {
            try
            {
                using var conn = new LdapConnection { SecureSocketLayer = settings.UseSsl };
                conn.Connect(settings.LdapHost, settings.LdapPort);

                // Build the bind DN for the user
                string userDn = BuildUserBindDn(settings, username);

                _logger.LogInformation("LDAP auth attempt: host={Host}:{Port}, dn={Dn}",
                    settings.LdapHost, settings.LdapPort, userDn);

                conn.Bind(userDn, password);
                _logger.LogInformation("LDAP auth success for user: {Username}", username);
                return true;
            }
            catch (LdapException ex) when (ex.ResultCode == LdapException.InvalidCredentials)
            {
                _logger.LogWarning("LDAP invalid credentials for user: {Username}", username);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "LDAP connection error to {Host}:{Port}", settings.LdapHost, settings.LdapPort);
                throw new InvalidOperationException(
                    $"無法連線至 LDAP 伺服器 {settings.LdapHost}:{settings.LdapPort}，請聯繫 IT 管理員。", ex);
            }
        });
    }

    /// <summary>
    /// Connectivity test – binds with service account credentials (if configured)
    /// or performs an anonymous bind to verify the server is reachable.
    /// </summary>
    public async Task<(bool ok, string message)> TestConnectionAsync(LdapSettingsInternal settings)
    {
        return await Task.Run(() =>
        {
            try
            {
                using var conn = new LdapConnection { SecureSocketLayer = settings.UseSsl };
                conn.Connect(settings.LdapHost, settings.LdapPort);

                if (!string.IsNullOrWhiteSpace(settings.BindDn) &&
                    !string.IsNullOrWhiteSpace(settings.BindPassword))
                {
                    conn.Bind(settings.BindDn, settings.BindPassword);
                    return (true, $"連線並驗證服務帳號成功（{settings.BindDn}）");
                }

                return (true, $"連線至 {settings.LdapHost}:{settings.LdapPort} 成功（匿名連線）");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "LDAP test connection failed: {Host}:{Port}",
                    settings.LdapHost, settings.LdapPort);
                return (false, $"連線失敗：{ex.Message}");
            }
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// <summary>
    /// Constructs the DN used for the user bind.
    /// Strategy:
    ///   1. If user_filter contains a DN template (starts with "CN="), use it directly.
    ///   2. Otherwise try UPN format: username@upn_suffix.
    ///   3. Fallback: domain_prefix\username (simple bind accepted by most AD servers).
    /// </summary>
    private static string BuildUserBindDn(LdapSettingsInternal settings, string plainUsername)
    {
        // UPN bind: user@domain.local  (preferred for AD)
        if (!string.IsNullOrWhiteSpace(settings.UpnSuffix))
            return $"{plainUsername}@{settings.UpnSuffix}";

        // Domain\user (NTLM-style bind, works on most AD LDAP ports)
        if (!string.IsNullOrWhiteSpace(settings.DomainPrefix))
            return $"{settings.DomainPrefix}\\{plainUsername}";

        // Last resort: attempt simple-bind with base_dn substitution
        return $"CN={plainUsername},{settings.BaseDn}";
    }

    private async Task EnsureOpenAsync()
    {
        if (_connection.State != ConnectionState.Open)
            await _connection.OpenAsync();
    }
}
