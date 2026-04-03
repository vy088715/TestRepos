using System.Security.Claims;
using GITP.API.DTOs;
using GITP.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GITP.API.Controllers;

/// <summary>
/// Manages classification reference data (issue types, company systems)
/// and provides the endpoint to classify a specific ticket.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ClassificationController : ControllerBase
{
    private readonly ClassificationService _classificationService;

    public ClassificationController(ClassificationService classificationService)
    {
        _classificationService = classificationService;
    }

    private RequestingUserContext GetContext()
    {
        var userId    = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
                        ?? User.FindFirstValue("sub") ?? Guid.Empty.ToString());
        var companyId = Guid.Parse(User.FindFirstValue("company_id") ?? Guid.Empty.ToString());
        var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();
        if (roles.Count == 0)
        {
            var rolesClaim = User.FindFirstValue("roles");
            roles = string.IsNullOrEmpty(rolesClaim)
                ? new List<string> { "employee" }
                : rolesClaim.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
        }
        var isItCompanyStr = User.FindFirstValue("is_it_company");
        var isItCompany = isItCompanyStr == "true" || isItCompanyStr == "True" || isItCompanyStr == "1";
        return new RequestingUserContext(userId, roles, companyId, isItCompany);
    }

    // ── Issue Types ──────────────────────────────────────────────

    /// <summary>Get all active issue types (accessible to all authenticated users).</summary>
    [HttpGet("issue-types")]
    public async Task<IActionResult> GetIssueTypes([FromQuery] bool activeOnly = true)
    {
        var result = await _classificationService.GetIssueTypesAsync(activeOnly);
        return Ok(result);
    }

    [HttpPost("issue-types")]
    public async Task<IActionResult> CreateIssueType([FromBody] CreateIssueTypeRequest request)
    {
        var manageReq = new ManageIssueTypeRequest { Action = "CREATE", Name = request.Name };
        var (code, result) = await _classificationService.ManageIssueTypeAsync(manageReq);
        return code switch
        {
            0 => CreatedAtAction(nameof(GetIssueTypes), result),
            2 => Conflict(new { message = "問題類型名稱重複" }),
            _ => StatusCode(500)
        };
    }

    [HttpPut("issue-types/{id:guid}")]
    public async Task<IActionResult> UpdateIssueType(Guid id, [FromBody] UpdateIssueTypeRequest request)
    {
        var manageReq = new ManageIssueTypeRequest { Action = "UPDATE", Id = id, Name = request.Name };
        var (code, result) = await _classificationService.ManageIssueTypeAsync(manageReq);
        return code switch
        {
            0 => Ok(result),
            1 => NotFound(new { message = "問題類型不存在" }),
            2 => Conflict(new { message = "問題類型名稱重複" }),
            _ => StatusCode(500)
        };
    }

    [HttpDelete("issue-types/{id:guid}")]
    public async Task<IActionResult> DeleteIssueType(Guid id)
    {
        var manageReq = new ManageIssueTypeRequest { Action = "DELETE", Id = id };
        var (code, _) = await _classificationService.ManageIssueTypeAsync(manageReq);
        return code switch
        {
            0 => NoContent(),
            1 => NotFound(new { message = "問題類型不存在" }),
            _ => StatusCode(500)
        };
    }

    // ── Company Systems ──────────────────────────────────────────

    /// <summary>Get systems. Optionally filter by companyId.</summary>
    [HttpGet("systems")]
    public async Task<IActionResult> GetSystems([FromQuery] Guid? companyId, [FromQuery] bool activeOnly = true)
    {
        var result = await _classificationService.GetSystemsByCompanyAsync(companyId, activeOnly);
        return Ok(result);
    }

    [HttpPost("systems")]
    public async Task<IActionResult> CreateSystem([FromBody] CreateCompanySystemRequest request)
    {
        var manageReq = new ManageCompanySystemRequest { Action = "CREATE", CompanyId = request.CompanyId, Name = request.Name };
        var (code, result) = await _classificationService.ManageCompanySystemAsync(manageReq);
        return code switch
        {
            0 => CreatedAtAction(nameof(GetSystems), result),
            2 => Conflict(new { message = "同一公司下系統名稱重複" }),
            _ => StatusCode(500)
        };
    }

    [HttpPut("systems/{id:guid}")]
    public async Task<IActionResult> UpdateSystem(Guid id, [FromBody] UpdateCompanySystemRequest request)
    {
        var manageReq = new ManageCompanySystemRequest { Action = "UPDATE", Id = id, CompanyId = request.CompanyId, Name = request.Name };
        var (code, result) = await _classificationService.ManageCompanySystemAsync(manageReq);
        return code switch
        {
            0 => Ok(result),
            1 => NotFound(new { message = "系統別不存在" }),
            2 => Conflict(new { message = "同一公司下系統名稱重複" }),
            _ => StatusCode(500)
        };
    }

    [HttpDelete("systems/{id:guid}")]
    public async Task<IActionResult> DeleteSystem(Guid id)
    {
        var manageReq = new ManageCompanySystemRequest { Action = "DELETE", Id = id };
        var (code, _) = await _classificationService.ManageCompanySystemAsync(manageReq);
        return code switch
        {
            0 => NoContent(),
            1 => NotFound(new { message = "系統別不存在" }),
            _ => StatusCode(500)
        };
    }

    // ── Ticket Classification ────────────────────────────────────

    /// <summary>
    /// Set classification for a ticket.
    /// Allowed: it_admin (always) or it_assignee from IT company.
    /// </summary>
    [HttpPut("tickets/{ticketId:guid}")]
    public async Task<IActionResult> SetTicketClassification(
        Guid ticketId,
        [FromBody] SetTicketClassificationRequest request)
    {
        var ctx = GetContext();

        // Only it_admin or IT-company it_assignee may classify
        if (!ctx.CanClassifyTicket)
            return Forbid();

        var (code, ticket) = await _classificationService.SetClassificationAsync(ticketId, request, ctx);
        return code switch
        {
            0 => Ok(new { ticket }),
            1 => NotFound(new { message = "案件不存在" }),
            2 => StatusCode(403, new { message = "無分類設定權限", code = "NO_CLASSIFY_PERMISSION" }),
            3 => BadRequest(new { message = "所選系統別不屬於指定公司", code = "SYSTEM_COMPANY_MISMATCH" }),
            _ => StatusCode(500)
        };
    }
}
