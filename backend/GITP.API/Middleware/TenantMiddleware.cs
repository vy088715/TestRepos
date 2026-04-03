using Dapper;
using Microsoft.Data.SqlClient;
using System.Security.Claims;

namespace GITP.API.Middleware;

public class TenantMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<TenantMiddleware> _logger;

    public TenantMiddleware(RequestDelegate next, ILogger<TenantMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, SqlConnection connection)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var userId    = context.User.FindFirstValue(ClaimTypes.NameIdentifier)
                            ?? context.User.FindFirstValue("sub") ?? "";
            var companyId = context.User.FindFirstValue("company_id") ?? "";

            // Collect all role claims and join as comma-separated string
            // JWT may carry multiple ClaimTypes.Role claims (one per role)
            var roleClaims = context.User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();
            if (roleClaims.Count == 0)
            {
                // Fallback: try the custom 'roles' claim (comma-separated string)
                var rolesClaim = context.User.FindFirstValue("roles");
                if (!string.IsNullOrEmpty(rolesClaim))
                    roleClaims = rolesClaim.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
                else
                    roleClaims = new List<string> { "employee" };
            }
            var roles = string.Join(",", roleClaims.Distinct());

            try
            {
                if (connection.State != System.Data.ConnectionState.Open)
                    await connection.OpenAsync();

                await connection.ExecuteAsync(
                    "usp_SetSessionContext",
                    new { CompanyId = companyId, UserId = userId, Roles = roles },
                    commandType: System.Data.CommandType.StoredProcedure);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to set session context for user {UserId}", userId);
            }
        }

        await _next(context);
    }
}
