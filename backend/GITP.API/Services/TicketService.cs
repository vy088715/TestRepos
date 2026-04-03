using System.Data;
using Dapper;
using GITP.API.DTOs;
using Microsoft.Data.SqlClient;

namespace GITP.API.Services;

public class RequestingUserContext
{
    public Guid UserId { get; }
    public IReadOnlyList<string> Roles { get; }
    public Guid CompanyId { get; }
    public bool IsItCompany { get; }

    public RequestingUserContext(Guid userId, IEnumerable<string> roles, Guid companyId, bool isItCompany = false)
    {
        UserId = userId;
        Roles = roles.ToList().AsReadOnly();
        CompanyId = companyId;
        IsItCompany = isItCompany;
    }

    public string EffectiveRole =>
        Roles.Contains("it_admin") ? "it_admin" :
        Roles.Contains("it_assignee") ? "it_assignee" : "employee";

    public bool IsItAdmin    => Roles.Contains("it_admin");
    public bool IsItAssignee => Roles.Contains("it_assignee");
    public bool IsItStaff    => IsItAdmin || IsItAssignee;
    public bool CanCloseTicket => IsItStaff && IsItCompany;
    public bool CanClassifyTicket => IsItAdmin || (IsItAssignee && IsItCompany);
}

public class TicketService : ITicketService
{
    private readonly SqlConnection _connection;
    private readonly EmailService _emailService;
    private readonly FeedbackService _feedbackService;
    private readonly ILogger<TicketService> _logger;

    public TicketService(
        SqlConnection connection,
        EmailService emailService,
        FeedbackService feedbackService,
        ILogger<TicketService> logger)
    {
        _connection = connection;
        _emailService = emailService;
        _feedbackService = feedbackService;
        _logger = logger;
    }

    private async Task EnsureOpenAsync()
    {
        if (_connection.State != ConnectionState.Open)
            await _connection.OpenAsync();
    }

    public async Task<(int TotalCount, IEnumerable<TicketListDto> Items)> GetTicketsAsync(
        TicketFilterRequest filter, RequestingUserContext ctx)
    {
        await EnsureOpenAsync();
        var p = new DynamicParameters();
        p.Add("Status", filter.Status);
        p.Add("StartDate", filter.StartDate);
        p.Add("EndDate", filter.EndDate);
        p.Add("Keyword", filter.Keyword);
        p.Add("MyTickets", filter.MyTickets ? 1 : 0);
        p.Add("CompanyIdFilter", filter.CompanyIdFilter);
        p.Add("Page", filter.Page);
        p.Add("PageSize", filter.PageSize);
        p.Add("RequestingUserId", ctx.UserId);
        p.Add("RequestingRole", ctx.EffectiveRole);
        p.Add("RequestingCompanyId", ctx.CompanyId);

        using var multi = await _connection.QueryMultipleAsync(
            "usp_GetTickets", p, commandType: CommandType.StoredProcedure);
        var countResult = await multi.ReadFirstAsync<dynamic>();
        int totalCount = (int)countResult.TotalCount;
        var items = await multi.ReadAsync<TicketListDto>();
        return (totalCount, items);
    }

    public async Task<TicketDetailResult?> GetTicketByIdAsync(Guid ticketId, RequestingUserContext ctx)
    {
        await EnsureOpenAsync();
        var p = new DynamicParameters();
        p.Add("TicketId", ticketId);
        p.Add("RequestingUserId", ctx.UserId);
        p.Add("RequestingRole", ctx.EffectiveRole);
        p.Add("RequestingCompanyId", ctx.CompanyId);

        using var multi = await _connection.QueryMultipleAsync(
            "usp_GetTicketById", p, commandType: CommandType.StoredProcedure);
        var ticket = await multi.ReadFirstOrDefaultAsync<TicketDetailDto>();
        if (ticket == null) return null;
        var messages = await multi.ReadAsync<TicketMessageDto>();
        var attachments = await multi.ReadAsync<AttachmentDto>();
        return new TicketDetailResult(ticket, messages, attachments);
    }

    public async Task<TicketDetailResult?> CreateTicketAsync(CreateTicketRequest request, RequestingUserContext ctx)
    {
        await EnsureOpenAsync();
        var p = new DynamicParameters();
        p.Add("CompanyId", ctx.CompanyId);
        p.Add("SubmitterId", ctx.UserId);
        p.Add("Subject", request.Subject);
        p.Add("Description", request.Description);

        using var multi = await _connection.QueryMultipleAsync(
            "usp_CreateTicket", p, commandType: CommandType.StoredProcedure);
        var ticket = await multi.ReadFirstOrDefaultAsync<TicketDetailDto>();
        if (ticket == null) return null;
        var messages = await multi.ReadAsync<TicketMessageDto>();
        var attachments = await multi.ReadAsync<AttachmentDto>();

        _ = Task.Run(async () =>
        {
            try
            {
                var admins = await GetItAdminsAsync();
                foreach (var admin in admins)
                {
                    await _emailService.SendEmailSafeAsync(
                        admin.Email, admin.Name,
                        $"[GITP] 新案件通知：{ticket.Subject}",
                        $"<p>有新案件需要處理。</p><p>案件編號：{ticket.TicketNo}</p><p>主旨：{ticket.Subject}</p><p>提報人：{ticket.SubmitterName}</p>");
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send new ticket notification");
            }
        });

        return new TicketDetailResult(ticket, messages, attachments);
    }

    public async Task<(int Code, TicketDetailResult? Result)> UpdateStatusAsync(
        Guid ticketId, string newStatus, RequestingUserContext ctx)
    {
        await EnsureOpenAsync();
        var p = new DynamicParameters();
        p.Add("TicketId", ticketId);
        p.Add("NewStatus", newStatus);
        p.Add("RequestingUserId", ctx.UserId);
        p.Add("RequestingRole", ctx.EffectiveRole);

        using var multi = await _connection.QueryMultipleAsync(
            "usp_UpdateTicketStatus", p, commandType: CommandType.StoredProcedure);
        var codeResult = await multi.ReadFirstAsync<dynamic>();
        int code = (int)codeResult.Code;
        if (code != 0) return (code, null);

        var ticket = await multi.ReadFirstOrDefaultAsync<TicketDetailDto>();
        if (ticket == null) return (code, null);
        var messages = await multi.ReadAsync<TicketMessageDto>();
        var attachments = await multi.ReadAsync<AttachmentDto>();

        // 結案後觸發滿意度回饋 Email（非同步，不阻塞主流程）
        if (newStatus == "已結案")
        {
            var closedTicketId = ticketId;
            _ = Task.Run(async () =>
            {
                await _feedbackService.CreateAndSendFeedbackAsync(closedTicketId);
            });
        }

        return (code, new TicketDetailResult(ticket, messages, attachments));
    }

    public async Task<TicketDetailResult?> AssignTicketAsync(
        Guid ticketId, Guid assigneeId, RequestingUserContext ctx)
    {
        await EnsureOpenAsync();
        var p = new DynamicParameters();
        p.Add("TicketId", ticketId);
        p.Add("AssigneeId", assigneeId);
        p.Add("RequestingUserId", ctx.UserId);
        p.Add("RequestingRole", ctx.EffectiveRole);

        using var multi = await _connection.QueryMultipleAsync(
            "usp_AssignTicket", p, commandType: CommandType.StoredProcedure);
        var ticket = await multi.ReadFirstOrDefaultAsync<TicketDetailDto>();
        if (ticket == null) return null;
        var messages = await multi.ReadAsync<TicketMessageDto>();
        var attachments = await multi.ReadAsync<AttachmentDto>();

        if (ticket.AssigneeEmail != null)
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    await _emailService.SendEmailSafeAsync(
                        ticket.AssigneeEmail, ticket.AssigneeName ?? "",
                        $"[GITP] 案件已指派給您：{ticket.Subject}",
                        $"<p>您有新的案件需要處理。</p><p>案件編號：{ticket.TicketNo}</p>");
                }
                catch (Exception ex) { _logger.LogWarning(ex, "Assign email failed"); }
            });
        }

        return new TicketDetailResult(ticket, messages, attachments);
    }

    public async Task<(int Code, TicketDetailResult? Result)> TransferTicketAsync(
        Guid ticketId, Guid toHandlerId, string? note, RequestingUserContext ctx)
    {
        await EnsureOpenAsync();
        var p = new DynamicParameters();
        p.Add("TicketId", ticketId);
        p.Add("ToHandlerId", toHandlerId);
        p.Add("Note", note);
        p.Add("RequestingUserId", ctx.UserId);
        p.Add("RequestingRole", ctx.EffectiveRole);

        using var multi = await _connection.QueryMultipleAsync(
            "usp_TransferTicket", p, commandType: CommandType.StoredProcedure);
        var codeResult = await multi.ReadFirstAsync<dynamic>();
        int code = (int)codeResult.Code;
        if (code != 0) return (code, null);

        var ticket = await multi.ReadFirstOrDefaultAsync<TicketDetailDto>();
        if (ticket == null) return (code, null);
        var messages = await multi.ReadAsync<TicketMessageDto>();
        var attachments = await multi.ReadAsync<AttachmentDto>();

        if (ticket.AssigneeEmail != null)
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    await _emailService.SendEmailSafeAsync(
                        ticket.AssigneeEmail, ticket.AssigneeName ?? "",
                        $"[GITP] 案件已轉派給您：{ticket.Subject}",
                        $"<p>案件已由其他人員轉派給您處理。</p><p>案件編號：{ticket.TicketNo}</p>{(note != null ? $"<p>備註：{note}</p>" : "")}");
                }
                catch (Exception ex) { _logger.LogWarning(ex, "Transfer email failed"); }
            });
        }

        return (code, new TicketDetailResult(ticket, messages, attachments));
    }

    public async Task<IEnumerable<TicketHandlerHistoryDto>> GetHandlerHistoryAsync(Guid ticketId)
    {
        await EnsureOpenAsync();
        var p = new DynamicParameters();
        p.Add("TicketId", ticketId);
        return await _connection.QueryAsync<TicketHandlerHistoryDto>(
            "usp_GetHandlerHistory", p, commandType: CommandType.StoredProcedure);
    }

    public async Task<BatchAssignResult> BatchAssignAsync(
        List<Guid> ticketIds, Guid assigneeId, RequestingUserContext ctx)
    {
        await EnsureOpenAsync();
        var ticketIdsJson = System.Text.Json.JsonSerializer.Serialize(ticketIds);
        var p = new DynamicParameters();
        p.Add("TicketIdsJson", ticketIdsJson);
        p.Add("AssigneeId", assigneeId);
        p.Add("RequestingUserId", ctx.UserId);
        p.Add("RequestingRole", ctx.EffectiveRole);

        using var multi = await _connection.QueryMultipleAsync(
            "usp_BatchAssignTickets", p, commandType: CommandType.StoredProcedure);
        var countResult = await multi.ReadFirstAsync<dynamic>();
        int updatedCount = (int)countResult.Count;
        var ticketDetails = (await multi.ReadAsync<BatchAssignTicketDetail>()).ToList();

        _ = Task.Run(async () =>
        {
            try
            {
                foreach (var t in ticketDetails.Where(x => x.AssigneeEmail != null))
                {
                    await _emailService.SendEmailSafeAsync(
                        t.AssigneeEmail!, t.AssigneeName ?? "",
                        $"[GITP] 案件已指派給您：{t.Subject}",
                        $"<p>案件編號：{t.TicketNo}</p><p>公司：{t.CompanyName}</p>");
                }
            }
            catch (Exception ex) { _logger.LogWarning(ex, "Batch assign email failed"); }
        });

        return new BatchAssignResult(updatedCount, ticketDetails);
    }

    public async Task<TicketMessageDto?> AddMessageAsync(
        Guid ticketId, string content, bool isItReply, RequestingUserContext ctx)
    {
        await EnsureOpenAsync();
        var p = new DynamicParameters();
        p.Add("TicketId", ticketId);
        p.Add("AuthorId", ctx.UserId);
        p.Add("Content", content);
        p.Add("IsItReply", isItReply);
        p.Add("RequestingRole", ctx.EffectiveRole);
        p.Add("RequestingCompanyId", ctx.CompanyId);
        p.Add("MessageType", "reply");

        return await _connection.QueryFirstOrDefaultAsync<TicketMessageDto>(
            "usp_AddMessage", p, commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<TicketMessageDto>> GetMessagesAsync(Guid ticketId, RequestingUserContext ctx)
    {
        await EnsureOpenAsync();
        var p = new DynamicParameters();
        p.Add("TicketId", ticketId);
        p.Add("RequestingRole", ctx.EffectiveRole);
        p.Add("RequestingCompanyId", ctx.CompanyId);
        return await _connection.QueryAsync<TicketMessageDto>(
            "usp_GetMessages", p, commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<ItAdminEmailDto>> GetItAdminsAsync()
    {
        await EnsureOpenAsync();
        return await _connection.QueryAsync<ItAdminEmailDto>(
            "usp_GetItAdmins", commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<UserDto>> GetItStaffAsync()
    {
        await EnsureOpenAsync();
        return await _connection.QueryAsync<UserDto>(
            "usp_GetItStaff", commandType: CommandType.StoredProcedure);
    }
}

public record TicketDetailResult(
    TicketDetailDto Ticket,
    IEnumerable<TicketMessageDto> Messages,
    IEnumerable<AttachmentDto> Attachments);

public record BatchAssignResult(int UpdatedCount, List<BatchAssignTicketDetail> Tickets);

public class BatchAssignTicketDetail
{
    public Guid TicketId { get; set; }
    public string TicketNo { get; set; } = "";
    public string Subject { get; set; } = "";
    public string CompanyName { get; set; } = "";
    public string SubmitterName { get; set; } = "";
    public string? AssigneeEmail { get; set; }
    public string? AssigneeName { get; set; }
}
