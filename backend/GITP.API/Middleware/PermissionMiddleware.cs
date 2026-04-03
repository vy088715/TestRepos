using System.Data;
using System.Diagnostics;
using System.Security.Claims;
using System.Text.RegularExpressions;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Caching.Memory;

namespace GITP.API.Middleware;

/// <summary>
/// Centralized permission middleware that:
/// 1. Checks user roles against DB-defined permission rules (cached).
/// 2. Logs every authenticated API call to api_audit_logs.
/// </summary>
public class PermissionMiddleware
{
    private static readonly string[] AnonymousPrefixes =
    {
        "/swagger", "/favicon",
        "/api/users/login", "/api/users/ldap-auth",
        "/api/users/windows-auth", "/api/users/azure-ad-login",
        "/api/users/auth-config",
        "/api/feedback"
    };

    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);
    private const string CacheKey = "api_permissions_cache";

    private readonly RequestDelegate _next;
    private readonly ILogger<PermissionMiddleware> _logger;
    private readonly IMemoryCache _cache;
    private readonly IServiceScopeFactory _scopeFactory;

    public PermissionMiddleware(
        RequestDelegate next,
        ILogger<PermissionMiddleware> logger,
        IMemoryCache cache,
        IServiceScopeFactory scopeFactory)
    {
        _next         = next;
        _logger       = logger;
        _cache        = cache;
        _scopeFactory = scopeFactory;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path   = context.Request.Path.Value ?? string.Empty;
        var method = context.Request.Method.ToUpperInvariant();

        // Skip anonymous endpoints
        if (IsAnonymousPath(path))
        {
            await _next(context);
            return;
        }

        // Only process authenticated requests
        if (context.User.Identity?.IsAuthenticated != true)
        {
            await _next(context);
            return;
        }

        // ── Extract user info from JWT ──────────────────────────────
        var userId    = context.User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? context.User.FindFirstValue("sub");
        var userEmail = context.User.FindFirstValue(ClaimTypes.Email)
                     ?? context.User.FindFirstValue("email");
        var empId     = context.User.FindFirstValue("emp_id");
        var roles     = context.User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (roles.Count == 0)
        {
            var rolesClaim = context.User.FindFirstValue("roles");
            if (!string.IsNullOrEmpty(rolesClaim))
                roles = new HashSet<string>(
                    rolesClaim.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
                    StringComparer.OrdinalIgnoreCase);
        }

        // ── Permission check ────────────────────────────────────────
        var permissions = await GetPermissionsAsync();
        var rule = FindMatchingRule(permissions, method, path);

        if (rule != null && !string.IsNullOrWhiteSpace(rule.RequiredRoles))
        {
            var required = rule.RequiredRoles.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            bool hasRole = required.Any(r => roles.Contains(r));
            if (!hasRole)
            {
                _logger.LogWarning("Permission denied: user {UserId} roles [{Roles}] tried {Method} {Path} (requires [{Required}])",
                    userId, string.Join(",", roles), method, path, rule.RequiredRoles);
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync("{\"message\":\"權限不足\",\"code\":\"FORBIDDEN\"}");
                // Still log the denied request
                _ = LogAuditAsync(userId, userEmail, empId, method, path,
                    context.Request.QueryString.Value, 403,
                    GetClientIp(context), GetUserAgent(context), 0);
                return;
            }
        }

        // ── Call the next middleware and measure duration ───────────
        var sw = Stopwatch.StartNew();
        await _next(context);
        sw.Stop();

        // ── Async audit logging (fire & log-error on failure) ──────
        _ = LogAuditAsync(
            userId, userEmail, empId,
            method, path, context.Request.QueryString.Value,
            context.Response.StatusCode,
            GetClientIp(context), GetUserAgent(context),
            (int)sw.ElapsedMilliseconds);
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private static bool IsAnonymousPath(string path)
        => AnonymousPrefixes.Any(p => path.StartsWith(p, StringComparison.OrdinalIgnoreCase));

    private async Task<List<ApiPermissionRule>> GetPermissionsAsync()
    {
        if (_cache.TryGetValue(CacheKey, out List<ApiPermissionRule>? cached) && cached != null)
            return cached;

        try
        {
            using var scope = _scopeFactory.CreateScope();
            var conn = scope.ServiceProvider.GetRequiredService<SqlConnection>();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            var rules = (await conn.QueryAsync<ApiPermissionRule>(
                "usp_GetApiPermissions", commandType: CommandType.StoredProcedure)).ToList();

            _cache.Set(CacheKey, rules, CacheTtl);
            return rules;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load API permissions from DB");
            return new List<ApiPermissionRule>();
        }
    }

    private static ApiPermissionRule? FindMatchingRule(
        List<ApiPermissionRule> rules, string method, string path)
    {
        // Rules are ordered by descending path length, so more specific matches win.
        foreach (var rule in rules)
        {
            bool methodMatch = rule.HttpMethod == "*" ||
                               rule.HttpMethod.Equals(method, StringComparison.OrdinalIgnoreCase);
            if (!methodMatch) continue;

            if (PathMatches(rule.PathPattern, path)) return rule;
        }
        return null;
    }

    private static bool PathMatches(string pattern, string path)
    {
        if (!pattern.Contains('*'))
            return path.Equals(pattern, StringComparison.OrdinalIgnoreCase);

        // Wildcard: replace * with a regex that matches any segment(s)
        var regexPattern = "^" + Regex.Escape(pattern).Replace("\\*", ".*") + "$";
        return Regex.IsMatch(path, regexPattern, RegexOptions.IgnoreCase);
    }

    private async Task LogAuditAsync(
        string? userId, string? userEmail, string? empId,
        string method, string path, string? queryString,
        int statusCode, string? ip, string? userAgent, int durationMs)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var conn = scope.ServiceProvider.GetRequiredService<SqlConnection>();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            await conn.ExecuteAsync("usp_CreateApiAuditLog",
                new
                {
                    UserId      = string.IsNullOrEmpty(userId) ? (object?)null : Guid.TryParse(userId, out var uid) ? uid : (object?)null,
                    UserEmail   = userEmail,
                    EmpId       = empId,
                    HttpMethod  = method,
                    Path        = path,
                    QueryString = queryString,
                    StatusCode  = statusCode,
                    IpAddress   = ip,
                    UserAgent   = userAgent?.Length > 500 ? userAgent[..500] : userAgent,
                    DurationMs  = durationMs
                },
                commandType: CommandType.StoredProcedure);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to write API audit log for {Method} {Path}", method, path);
        }
    }

    private static string? GetClientIp(HttpContext context)
    {
        var forwarded = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrEmpty(forwarded))
            return forwarded.Split(',')[0].Trim();
        return context.Connection.RemoteIpAddress?.ToString();
    }

    private static string? GetUserAgent(HttpContext context)
        => context.Request.Headers["User-Agent"].FirstOrDefault();

    public record ApiPermissionRule(int Id, string HttpMethod, string PathPattern, string RequiredRoles);
}
