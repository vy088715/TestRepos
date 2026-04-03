using System.Security.Claims;
using GITP.API.DTOs;
using GITP.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GITP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TicketsController : ControllerBase
{
    private readonly ITicketService _ticketService;

    public TicketsController(ITicketService ticketService)
    {
        _ticketService = ticketService;
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

    [HttpGet]
    public async Task<IActionResult> GetTickets([FromQuery] TicketFilterRequest filter)
    {
        var ctx = GetContext();
        var (total, items) = await _ticketService.GetTicketsAsync(filter, ctx);
        return Ok(new { total, items });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetTicket(Guid id)
    {
        var ctx = GetContext();
        var result = await _ticketService.GetTicketByIdAsync(id, ctx);
        if (result == null) return NotFound();
        return Ok(new { ticket = result.Ticket, messages = result.Messages, attachments = result.Attachments });
    }

    [HttpPost]
    public async Task<IActionResult> CreateTicket([FromBody] CreateTicketRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var ctx = GetContext();
        var result = await _ticketService.CreateTicketAsync(request, ctx);
        if (result == null) return StatusCode(500, new { message = "\u5efa\u7acb\u6848\u4ef6\u5931\u6557" });
        return CreatedAtAction(nameof(GetTicket), new { id = result.Ticket.Id },
            new { ticket = result.Ticket, messages = result.Messages, attachments = result.Attachments });
    }

    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateStatusRequest request)
    {
        var ctx = GetContext();
        var (code, result) = await _ticketService.UpdateStatusAsync(id, request.Status, ctx);
        return code switch
        {
            0 => Ok(new { ticket = result!.Ticket, messages = result.Messages, attachments = result.Attachments }),
            1 => NotFound(new { message = "案件不存在" }),
            2 => Forbid(),
            3 => BadRequest(new { message = "無效的狀態轉換" }),
            5 => StatusCode(403, new { message = "只有 IT 公司的處理人員才可以結案", code = "NOT_IT_COMPANY" }),
            _ => StatusCode(500)
        };
    }

    [HttpPut("{id:guid}/assign")]
    public async Task<IActionResult> AssignTicket(Guid id, [FromBody] AssignTicketRequest request)
    {
        var ctx = GetContext();
        if (!ctx.IsItAdmin) return Forbid();
        var result = await _ticketService.AssignTicketAsync(id, request.AssigneeId, ctx);
        if (result == null) return NotFound();
        return Ok(new { ticket = result.Ticket, messages = result.Messages, attachments = result.Attachments });
    }

    /// <summary>
    /// Transfer a ticket to another IT handler.
    /// it_admin: can transfer any ticket.
    /// it_assignee: can only transfer tickets currently assigned to them.
    /// </summary>
    [HttpPut("{id:guid}/transfer")]
    public async Task<IActionResult> TransferTicket(Guid id, [FromBody] TransferTicketRequest request)
    {
        var ctx = GetContext();
        if (!ctx.IsItStaff) return Forbid();

        var (code, result) = await _ticketService.TransferTicketAsync(id, request.ToHandlerId, request.Note, ctx);
        return code switch
        {
            0 => Ok(new { ticket = result!.Ticket, messages = result.Messages, attachments = result.Attachments }),
            1 => NotFound(new { message = "\u6848\u4ef6\u4e0d\u5b58\u5728" }),
            2 => Forbid(),
            3 => BadRequest(new { message = "\u5df2\u7d50\u6848\u7684\u6848\u4ef6\u7121\u6cd5\u8f49\u6d3e" }),
            4 => BadRequest(new { message = "\u4e0d\u80fd\u8f49\u6d3e\u7d66\u76ee\u524d\u7684\u8655\u7406\u4eba\u54e1" }),
            _ => StatusCode(500)
        };
    }

    /// <summary>Get the full handler chain history for a ticket.</summary>
    [HttpGet("{id:guid}/handlers")]
    public async Task<IActionResult> GetHandlerHistory(Guid id)
    {
        var ctx = GetContext();
        // Only IT staff can view handler history
        if (!ctx.IsItStaff) return Forbid();
        var history = await _ticketService.GetHandlerHistoryAsync(id);
        return Ok(history);
    }

    [HttpPost("batch-assignments")]
    public async Task<IActionResult> BatchAssign([FromBody] BatchAssignRequest request)
    {
        var ctx = GetContext();
        if (!ctx.IsItAdmin) return Forbid();
        if (request.TicketIds == null || !request.TicketIds.Any())
            return BadRequest(new { message = "\u8acb\u63d0\u4f9b\u6848\u4ef6 ID \u6e05\u55ae" });
        var result = await _ticketService.BatchAssignAsync(request.TicketIds, request.AssigneeId, ctx);
        return Ok(new { updatedCount = result.UpdatedCount, tickets = result.Tickets });
    }

    [HttpGet("{id:guid}/messages")]
    public async Task<IActionResult> GetMessages(Guid id)
    {
        var ctx = GetContext();
        var messages = await _ticketService.GetMessagesAsync(id, ctx);
        return Ok(messages);
    }

    [HttpPost("{id:guid}/messages")]
    public async Task<IActionResult> AddMessage(Guid id, [FromBody] AddMessageRequest request)
    {
        var ctx = GetContext();
        var isItReply = ctx.IsItStaff;
        var message = await _ticketService.AddMessageAsync(id, request.Content, isItReply, ctx);
        if (message == null) return Forbid();
        return Ok(message);
    }
}
