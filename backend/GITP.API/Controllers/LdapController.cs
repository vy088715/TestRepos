using System.Data;
using System.Security.Claims;
using Dapper;
using GITP.API.DTOs;
using GITP.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace GITP.API.Controllers;

/// <summary>
/// LDAP 設定管理 API（僅 it_admin 可存取）
/// GET    /api/ldap/settings              — 取得全部公司的 LDAP 設定
/// GET    /api/ldap/settings/{companyId}  — 取得指定公司的 LDAP 設定
/// PUT    /api/ldap/settings/{companyId}  — 新增或更新 LDAP 設定
/// DELETE /api/ldap/settings/{companyId}  — 刪除 LDAP 設定
/// POST   /api/ldap/test/{companyId}      — 測試 LDAP 連線
/// </summary>
[ApiController]
[Route("api/ldap")]
[Authorize]
public class LdapController : ControllerBase
{
    private readonly LdapService _ldapService;
    private readonly SqlConnection _connection;
    private readonly ILogger<LdapController> _logger;

    public LdapController(
        LdapService ldapService,
        SqlConnection connection,
        ILogger<LdapController> logger)
    {
        _ldapService = ldapService;
        _connection  = connection;
        _logger      = logger;
    }

    // ── GET /api/ldap/settings ────────────────────────────────────────────────

    [HttpGet("settings")]
    public async Task<IActionResult> GetAll()
    {
        var settings = await _ldapService.GetAllSettingsAsync();
        return Ok(settings);
    }

    // ── GET /api/ldap/settings/{companyId} ───────────────────────────────────

    [HttpGet("settings/{companyId:guid}")]
    public async Task<IActionResult> GetByCompany(Guid companyId)
    {
        var settings = await _ldapService.GetSettingsByCompanyAsync(companyId);
        if (settings == null)
            return NotFound(new { message = "此公司尚未設定 LDAP" });
        return Ok(settings);
    }

    // ── PUT /api/ldap/settings/{companyId} ───────────────────────────────────

    [HttpPut("settings/{companyId:guid}")]
    public async Task<IActionResult> Save(Guid companyId, [FromBody] SaveLdapSettingsRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.LdapHost))
            return BadRequest(new { message = "LDAP 主機位址為必填" });
        if (string.IsNullOrWhiteSpace(request.BaseDn))
            return BadRequest(new { message = "Base DN 為必填" });
        if (request.LdapPort is < 1 or > 65535)
            return BadRequest(new { message = "LDAP Port 必須介於 1 到 65535 之間" });

        // Ensure company exists
        if (_connection.State != System.Data.ConnectionState.Open)
            await _connection.OpenAsync();

        var exists = await _connection.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM dbo.companies WHERE id = @Id",
            new { Id = companyId });
        if (exists == 0)
            return NotFound(new { message = "公司不存在" });

        _logger.LogInformation("Admin {AdminId} saving LDAP settings for company {CompanyId}",
            User.FindFirstValue(ClaimTypes.NameIdentifier), companyId);

        var result = await _ldapService.SaveSettingsAsync(companyId, request);
        return Ok(result);
    }

    // ── DELETE /api/ldap/settings/{companyId} ────────────────────────────────

    [HttpDelete("settings/{companyId:guid}")]
    public async Task<IActionResult> Delete(Guid companyId)
    {
        var affected = await _ldapService.DeleteSettingsAsync(companyId);
        if (affected == 0)
            return NotFound(new { message = "此公司的 LDAP 設定不存在" });

        _logger.LogInformation("Admin {AdminId} deleted LDAP settings for company {CompanyId}",
            User.FindFirstValue(ClaimTypes.NameIdentifier), companyId);

        return Ok(new { message = "LDAP 設定已刪除" });
    }

    // ── POST /api/ldap/test/{companyId} ──────────────────────────────────────

    [HttpPost("test/{companyId:guid}")]
    public async Task<IActionResult> TestConnection(Guid companyId)
    {
        var internalSettings = await _connection.QueryFirstOrDefaultAsync<LdapSettingsInternal>(
            "usp_GetLdapSettingByCompanyId",
            new { CompanyId = companyId },
            commandType: System.Data.CommandType.StoredProcedure);

        if (internalSettings == null)
            return NotFound(new { message = "此公司的 LDAP 設定不存在或已停用" });

        _logger.LogInformation("Testing LDAP connection for company {CompanyId}: {Host}:{Port}",
            companyId, internalSettings.LdapHost, internalSettings.LdapPort);

        var (ok, message) = await _ldapService.TestConnectionAsync(internalSettings);
        return ok ? Ok(new { success = true, message }) : StatusCode(502, new { success = false, message });
    }
}
