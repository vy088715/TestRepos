using System.Data;
using System.Security.Claims;
using Dapper;
using GITP.API.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace GITP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AdminController : ControllerBase
{
    private readonly SqlConnection _connection;
    private readonly ILogger<AdminController> _logger;

    public AdminController(SqlConnection connection, ILogger<AdminController> logger)
    {
        _connection = connection;
        _logger = logger;
    }

    private async Task EnsureOpenAsync()
    {
        if (_connection.State != ConnectionState.Open)
            await _connection.OpenAsync();
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetAdminUsers()
    {
        await EnsureOpenAsync();
        var users = await _connection.QueryAsync<AdminUserDto>(
            "usp_GetAdminUsers", commandType: CommandType.StoredProcedure);
        return Ok(users);
    }

    /// <summary>
    /// Replace all roles for the target user.
    /// Body: { "roles": ["it_admin", "it_assignee"] }
    /// Valid roles: employee, it_assignee, it_admin
    /// </summary>
    [HttpPut("users/{userId:guid}/roles")]
    public async Task<IActionResult> UpdateUserRoles(Guid userId, [FromBody] UpdateUserRolesRequest request)
    {
        if (request.Roles == null || !request.Roles.Any())
            return BadRequest(new { message = "請至少指定一個角色" });

        var requesterId = Guid.Parse(
            User.FindFirstValue(ClaimTypes.NameIdentifier) ??
            User.FindFirstValue("sub") ?? Guid.Empty.ToString());

        var rolesParam = string.Join(",", request.Roles.Select(r => r.Trim()).Distinct());

        await EnsureOpenAsync();
        var result = await _connection.QueryFirstOrDefaultAsync<dynamic>(
            "usp_SetUserRoles",
            new { UserId = userId, Roles = rolesParam, RequesterId = requesterId },
            commandType: CommandType.StoredProcedure);

        int code = result?.Code ?? -1;
        return code switch
        {
            0 => Ok(new { message = "角色已更新" }),
            1 => BadRequest(new { message = "無法修改自己的角色" }),
            2 => BadRequest(new { message = "系統至少需要一位 IT 管理員" }),
            3 => BadRequest(new { message = "包含無效的角色值" }),
            _ => StatusCode(500, new { message = "更新失敗" })
        };
    }

    /// <summary>
    /// Bind or update the Windows username for a user.
    /// Body: { "windowsUsername": "CORP\\john.doe" }   (null to clear)
    /// Used by admins to map AD accounts to GITP users for Windows Auth SSO.
    /// </summary>
    [HttpPut("users/{userId:guid}/windows-username")]
    public async Task<IActionResult> UpdateWindowsUsername(
        Guid userId,
        [FromBody] UpdateWindowsUsernameRequest request)
    {
        await EnsureOpenAsync();
        var result = await _connection.QueryFirstOrDefaultAsync<dynamic>(
            "usp_UpdateUserWindowsUsername",
            new { UserId = userId, WindowsUsername = request.WindowsUsername },
            commandType: CommandType.StoredProcedure);

        int affected = result?.affected ?? 0;
        if (affected == 0) return NotFound(new { message = "使用者不存在" });
        return Ok(new { message = "Windows 帳號已更新" });
    }
}

public class UpdateWindowsUsernameRequest
{
    public string? WindowsUsername { get; set; }
}
