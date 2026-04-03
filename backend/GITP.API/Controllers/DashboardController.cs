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
public class DashboardController : ControllerBase
{
    private readonly SqlConnection _connection;

    public DashboardController(SqlConnection connection)
    {
        _connection = connection;
    }

    private async Task EnsureOpenAsync()
    {
        if (_connection.State != ConnectionState.Open)
            await _connection.OpenAsync();
    }

    private bool IsItCompany()
    {
        var claim = User.FindFirstValue("is_it_company");
        return claim == "true" || claim == "True";
    }

    /// <summary>
    /// 取得工單統計資料（僅限 IT 公司人員）
    /// GET /api/dashboard/stats?period=month&year=2026&month=3
    /// GET /api/dashboard/stats?period=year&year=2026
    /// </summary>
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats([FromQuery] TicketStatsRequest request)
    {
        if (!IsItCompany())
            return StatusCode(403, new { message = "僅限 IT 公司人員查閱統計資料" });

        // 預設：本月
        var now = DateTime.UtcNow;
        if (request.Year == 0) request.Year = now.Year;
        if (request.Period == "month" && request.Month == null)
            request.Month = now.Month;

        if (request.Period != "month" && request.Period != "year")
            return BadRequest(new { message = "period 必須為 month 或 year" });

        if (request.Period == "month" && (request.Month < 1 || request.Month > 12))
            return BadRequest(new { message = "month 必須介於 1 到 12" });

        await EnsureOpenAsync();

        var p = new DynamicParameters();
        p.Add("Period", request.Period);
        p.Add("Year",   request.Year);
        p.Add("Month",  request.Period == "month" ? request.Month : (int?)null, DbType.Int32);

        using var multi = await _connection.QueryMultipleAsync(
            "usp_GetTicketStats",
            p,
            commandType: CommandType.StoredProcedure
        );

        var byCompany = (await multi.ReadAsync<CompanyTicketStatsDto>()).ToList();
        var summary   = await multi.ReadFirstOrDefaultAsync<TicketStatsSummaryDto>()
                        ?? new TicketStatsSummaryDto();

        return Ok(new TicketStatsResponse
        {
            Summary   = summary,
            ByCompany = byCompany,
            Period    = request.Period,
            Year      = request.Year,
            Month     = request.Period == "month" ? request.Month : null
        });
    }
}
