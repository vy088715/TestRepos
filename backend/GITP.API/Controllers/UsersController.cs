using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Dapper;
using GITP.API.DTOs;
using GITP.API.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Negotiate;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.Tokens;

namespace GITP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly SqlConnection _connection;
    private readonly IConfiguration _configuration;
    private readonly TicketService _ticketService;
    private readonly WindowsAuthService _windowsAuthService;
    private readonly LdapService _ldapService;
    private readonly ILogger<UsersController> _logger;

    public UsersController(
        SqlConnection connection,
        IConfiguration configuration,
        TicketService ticketService,
        WindowsAuthService windowsAuthService,
        LdapService ldapService,
        ILogger<UsersController> logger)
    {
        _connection         = connection;
        _configuration      = configuration;
        _ticketService      = ticketService;
        _windowsAuthService = windowsAuthService;
        _ldapService        = ldapService;
        _logger             = logger;
    }

    private async Task EnsureOpenAsync()
    {
        if (_connection.State != ConnectionState.Open)
            await _connection.OpenAsync();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // POST /api/users/login  —  Form-based (email + password) login
    // ──────────────────────────────────────────────────────────────────────────
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { message = "Email 和密碼為必填" });

        await EnsureOpenAsync();
        var user = await _connection.QueryFirstOrDefaultAsync<LoginUserDto>(
            "usp_AuthGetUserByEmail",
            new { Email = request.Email },
            commandType: CommandType.StoredProcedure);

        if (user == null || string.IsNullOrEmpty(user.PasswordHash))
            return Unauthorized(new { message = "帳號或密碼錯誤" });

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized(new { message = "帳號或密碼錯誤" });

        var token = GenerateJwt(user);
        return Ok(BuildLoginResponse(token, user));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // POST /api/users/refresh-token
    //   Issues a new JWT for the currently authenticated user.
    //   The caller must present a valid (not yet expired) JWT.
    //   The backend re-queries the user to pick up any role/company changes,
    //   then mints a fresh token with a new expiry window.
    // ──────────────────────────────────────────────────────────────────────────
    [HttpPost("refresh-token")]
    [Authorize]
    public async Task<IActionResult> RefreshToken()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? User.FindFirstValue("sub");

        if (!Guid.TryParse(userIdStr, out var userId))
            return Unauthorized(new { message = "無法識別使用者身份" });

        await EnsureOpenAsync();
        var user = await _connection.QueryFirstOrDefaultAsync<LoginUserDto>(
            "usp_GetUserById",
            new { UserId = userId },
            commandType: CommandType.StoredProcedure);

        if (user == null)
            return Unauthorized(new { message = "使用者不存在" });

        var newToken = GenerateJwt(user);
        _logger.LogInformation("Token refreshed for user {Email}", user.Email);
        return Ok(new { token = newToken });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // POST /api/users/ldap-auth
    // ──────────────────────────────────────────────────────────────────────────
    [HttpPost("ldap-auth")]
    [AllowAnonymous]
    public async Task<IActionResult> LdapAuth([FromBody] LdapAuthRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { message = "使用者名稱和密碼為必填" });

        var resolved = await _ldapService.ResolveSettingsAsync(request.Username, request.CompanyId);
        if (resolved == null)
        {
            _logger.LogWarning("LDAP: no matching LDAP configuration for username={Username}, companyId={CompanyId}",
                request.Username, request.CompanyId);
            return StatusCode(503, new
            {
                message = "找不到對應的 LDAP 設定。請確認使用者名稱格式（DOMAIN\\user 或 user@domain.local），或聯繫 IT 管理員。"
            });
        }

        var (settings, plainUsername) = resolved.Value;

        bool authenticated;
        try
        {
            authenticated = await _ldapService.AuthenticateAsync(settings, plainUsername, request.Password);
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(502, new { message = ex.Message });
        }

        if (!authenticated)
            return Unauthorized(new { message = "使用者名稱或密碼錯誤" });

        await EnsureOpenAsync();
        var user = await _connection.QueryFirstOrDefaultAsync<LoginUserDto>(
            "usp_AuthGetUserByWindowsUsername",
            new { WindowsUsername = request.Username },
            commandType: CommandType.StoredProcedure);

        if (user == null)
        {
            _logger.LogWarning("LDAP auth passed but no GITP user found for: {Username}", request.Username);
            return StatusCode(403, new
            {
                message  = $"LDAP 驗證成功，但使用者「{request.Username}」尚未建立 GITP 帳號，請聯繫 IT 管理員。",
                authType = "ldap",
                identity = request.Username
            });
        }

        var token = GenerateJwt(user);
        _logger.LogInformation("LDAP auth success: {Email}, company={CompanyName}", user.Email, user.CompanyName);
        return Ok(BuildLoginResponse(token, user));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GET /api/users/windows-auth  —  Silent Windows (Negotiate) auth
    // ──────────────────────────────────────────────────────────────────────────
    [HttpGet("windows-auth")]
    [Authorize(AuthenticationSchemes = NegotiateDefaults.AuthenticationScheme)]
    public async Task<IActionResult> WindowsAuth()
    {
        var windowsIdentity = User.Identity?.Name;
        if (string.IsNullOrWhiteSpace(windowsIdentity))
            return Unauthorized(new { message = "Windows 身份識別失敗" });

        _logger.LogInformation("Windows auth attempt: {Identity}", windowsIdentity);

        await EnsureOpenAsync();
        var user = await _connection.QueryFirstOrDefaultAsync<LoginUserDto>(
            "usp_AuthGetUserByWindowsUsername",
            new { WindowsUsername = windowsIdentity },
            commandType: CommandType.StoredProcedure);

        if (user == null)
        {
            _logger.LogWarning("Windows user not mapped: {Identity}", windowsIdentity);
            return StatusCode(403, new
            {
                message  = $"Windows 帳號「{windowsIdentity}」尚未與系統使用者關聯，請聯繫 IT 管理員",
                authType = "windows",
                identity = windowsIdentity
            });
        }

        var token = GenerateJwt(user);
        _logger.LogInformation("Windows auth success: {Email}", user.Email);
        return Ok(BuildLoginResponse(token, user));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // POST /api/users/azure-ad-login
    // ──────────────────────────────────────────────────────────────────────────
    [HttpPost("azure-ad-login")]
    [AllowAnonymous]
    public async Task<IActionResult> AzureAdLogin([FromBody] AzureAdLoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.IdToken))
            return BadRequest(new { message = "idToken 為必填" });

        var tenantId = _configuration["AzureAd:TenantId"];
        var clientId = _configuration["AzureAd:ClientId"];

        if (string.IsNullOrWhiteSpace(tenantId) || string.IsNullOrWhiteSpace(clientId))
            return StatusCode(503, new { message = "Azure AD 尚未設定，請聯繫系統管理員" });

        ClaimsPrincipal principal;
        try
        {
            principal = await _windowsAuthService.ValidateAzureAdTokenAsync(request.IdToken, tenantId, clientId);
        }
        catch (SecurityTokenException ex)
        {
            _logger.LogWarning("Azure AD token validation failed: {Message}", ex.Message);
            return Unauthorized(new { message = "Azure AD Token 驗證失敗" });
        }

        var oid   = principal.FindFirstValue("oid") ?? principal.FindFirstValue("sub") ?? "";
        var email = principal.FindFirstValue("preferred_username")
                 ?? principal.FindFirstValue(ClaimTypes.Email)
                 ?? principal.FindFirstValue("upn")
                 ?? "";
        var name  = principal.FindFirstValue("name")
                 ?? principal.FindFirstValue(ClaimTypes.Name)
                 ?? email;

        if (string.IsNullOrWhiteSpace(email))
            return Unauthorized(new { message = "Azure AD Token 中缺少 email/upn 資訊" });

        await EnsureOpenAsync();
        var user = await _connection.QueryFirstOrDefaultAsync<LoginUserDto>(
            "usp_AuthGetOrCreateAzureAdUser",
            new { AzureAdOid = oid, Email = email, DisplayName = name },
            commandType: CommandType.StoredProcedure);

        if (user == null)
        {
            _logger.LogWarning("Azure AD user not found in GITP: {Email}", email);
            return StatusCode(403, new
            {
                message  = $"Azure AD 帳號「{email}」尚未建立 GITP 使用者，請聯繫 IT 管理員",
                authType = "azuread",
                email
            });
        }

        var token = GenerateJwt(user);
        _logger.LogInformation("Azure AD auth success: {Email}", user.Email);
        return Ok(BuildLoginResponse(token, user));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GET /api/users/me
    // ──────────────────────────────────────────────────────────────────────────
    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetMe()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(userIdStr, out var userId))
            return Unauthorized();

        await EnsureOpenAsync();
        var user = await _connection.QueryFirstOrDefaultAsync<UserDto>(
            "usp_GetUserById",
            new { UserId = userId },
            commandType: CommandType.StoredProcedure);

        if (user == null) return NotFound();
        return Ok(user);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GET /api/users/it-staff
    // ──────────────────────────────────────────────────────────────────────────
    [HttpGet("it-staff")]
    [Authorize]
    public async Task<IActionResult> GetItStaff()
    {
        var staff = await _ticketService.GetItStaffAsync();
        return Ok(staff);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GET /api/users/auth-config
    // ──────────────────────────────────────────────────────────────────────────
    [HttpGet("auth-config")]
    [AllowAnonymous]
    public async Task<IActionResult> GetAuthConfig()
    {
        var azureAdEnabled = !string.IsNullOrWhiteSpace(_configuration["AzureAd:TenantId"])
                          && !string.IsNullOrWhiteSpace(_configuration["AzureAd:ClientId"]);

        var ldapConfigs = await _ldapService.GetAllSettingsAsync();
        var ldapEnabled = ldapConfigs.Any(s => s.Enabled);

        return Ok(new
        {
            windowsAuth     = true,
            ldapAuth        = ldapEnabled,
            formLogin       = true,
            azureAd         = azureAdEnabled,
            azureAdClientId = azureAdEnabled ? _configuration["AzureAd:ClientId"] : null,
            azureAdTenantId = azureAdEnabled ? _configuration["AzureAd:TenantId"] : null
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static object BuildLoginResponse(string token, LoginUserDto user) => new
    {
        token,
        user = new
        {
            user.Id,
            user.Name,
            user.Email,
            user.EmpId,
            user.DepId,
            user.DepName,
            user.Role,
            user.CompanyId,
            user.CompanyName,
            user.CompanyCode,
            user.IsItCompany
        }
    };

    private string GenerateJwt(LoginUserDto user)
    {
        var key         = _configuration["Jwt:Key"] ?? "GITP_DEFAULT_SECRET_KEY_CHANGE_IN_PRODUCTION_32CHARS_MINIMUM";
        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        // All roles are embedded as separate ClaimTypes.Role claims within ONE single JWT.
        var roles = (user.Role ?? "employee")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct()
            .ToList();

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new("sub",          user.Id.ToString()),
            new(ClaimTypes.Email, user.Email),
            new("emp_id",       user.EmpId        ?? ""),
            new("emp_name",     user.Name),
            new("company_id",   user.CompanyId.ToString()),
            new("company_name", user.CompanyName),
            new("company_code", user.CompanyCode   ?? ""),
            new("dep_id",       user.DepId         ?? ""),
            new("dep_name",     user.DepName        ?? ""),
            new("is_it_company", user.IsItCompany ? "true" : "false"),
            new("created_at",   user.CreatedAt.ToString("o"))
        };

        // Add all roles as individual ClaimTypes.Role claims inside this single token.
        // JwtSecurityTokenHandler.WriteToken() maps ClaimTypes.Role → "role" via
        // DefaultOutboundClaimTypeMap, so we must NOT also add an explicit "role" claim
        // or the JWT will contain duplicate role entries.
        foreach (var role in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        var expiryHours = _configuration.GetValue<int>("Jwt:ExpiryHours", 8);
        var token = new JwtSecurityToken(
            claims:             claims,
            expires:            DateTime.UtcNow.AddHours(expiryHours),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

// ── Request / Response DTOs ───────────────────────────────────────────────────

public class LoginRequest
{
    public string Email    { get; set; } = "";
    public string Password { get; set; } = "";
}

public class AzureAdLoginRequest
{
    public string IdToken { get; set; } = "";
}

public class LoginUserDto
{
    public Guid    Id           { get; set; }
    public Guid    CompanyId    { get; set; }
    public string  Name         { get; set; } = "";
    public string  Email        { get; set; } = "";
    public string? Phone        { get; set; }
    public string? EmpId        { get; set; }
    public string? DepId        { get; set; }
    public string? DepName      { get; set; }
    public DateTime CreatedAt   { get; set; }
    public string  Role         { get; set; } = "";
    public string? PasswordHash { get; set; }
    public string  CompanyName  { get; set; } = "";
    public string? CompanyCode  { get; set; }
    public bool    IsItCompany  { get; set; }
}
