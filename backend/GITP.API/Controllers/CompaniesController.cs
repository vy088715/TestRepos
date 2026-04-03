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
public class CompaniesController : ControllerBase
{
    private readonly SqlConnection _connection;

    public CompaniesController(SqlConnection connection)
    {
        _connection = connection;
    }

    private async Task EnsureOpenAsync()
    {
        if (_connection.State != ConnectionState.Open)
            await _connection.OpenAsync();
    }

    private bool IsAdmin()
    {
        var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();
        return roles.Contains("it_admin");
    }

    /// <summary>GET /api/companies — list all companies with is_it_company flag (admin only)</summary>
    [HttpGet]
    public async Task<IActionResult> GetCompanies()
    {
        await EnsureOpenAsync();
        var companies = await _connection.QueryAsync<CompanyDto>(
            "usp_GetCompanies", commandType: CommandType.StoredProcedure);
        return Ok(companies);
    }

    /// <summary>PUT /api/companies/{id}/it-flag — set or unset IT company flag (admin only)</summary>
    [HttpPut("{id:guid}/it-flag")]
    public async Task<IActionResult> SetItFlag(Guid id, [FromBody] SetItFlagRequest request)
    {
        await EnsureOpenAsync();
        var p = new DynamicParameters();
        p.Add("CompanyId", id);
        p.Add("IsItCompany", request.IsItCompany ? 1 : 0);

        using var multi = await _connection.QueryMultipleAsync(
            "usp_SetCompanyItFlag", p, commandType: CommandType.StoredProcedure);
        var codeResult = await multi.ReadFirstAsync<dynamic>();
        int code = (int)codeResult.Code;

        if (code == 1) return NotFound(new { message = "公司不存在" });

        var company = await multi.ReadFirstOrDefaultAsync<CompanyDto>();
        return Ok(company);
    }
}
