using System.Data;
using Dapper;
using GITP.API.DTOs;
using Microsoft.Data.SqlClient;

namespace GITP.API.Services;

public class ClassificationService
{
    private readonly SqlConnection _connection;
    private readonly ILogger<ClassificationService> _logger;

    public ClassificationService(SqlConnection connection, ILogger<ClassificationService> logger)
    {
        _connection = connection;
        _logger = logger;
    }

    private async Task EnsureOpenAsync()
    {
        if (_connection.State != ConnectionState.Open)
            await _connection.OpenAsync();
    }

    // ---- Issue Types ----

    public async Task<IEnumerable<IssueTypeDto>> GetIssueTypesAsync(bool activeOnly = true)
    {
        await EnsureOpenAsync();
        var p = new DynamicParameters();
        p.Add("ActiveOnly", activeOnly ? 1 : 0);
        return await _connection.QueryAsync<IssueTypeDto>(
            "usp_GetIssueTypes", p, commandType: CommandType.StoredProcedure);
    }

    public async Task<(int Code, IssueTypeDto? Result)> ManageIssueTypeAsync(ManageIssueTypeRequest request)
    {
        await EnsureOpenAsync();
        var p = new DynamicParameters();
        p.Add("Action",    request.Action.ToUpper());
        p.Add("Id",        request.Id);
        p.Add("Name",      request.Name);
        p.Add("SortOrder", request.SortOrder);
        p.Add("IsActive",  request.IsActive);

        using var multi = await _connection.QueryMultipleAsync(
            "usp_ManageIssueType", p, commandType: CommandType.StoredProcedure);

        var codeRow = await multi.ReadFirstAsync<dynamic>();
        int code = (int)codeRow.Code;
        if (code != 0) return (code, null);

        IssueTypeDto? result = null;
        if (!multi.IsConsumed)
            result = await multi.ReadFirstOrDefaultAsync<IssueTypeDto>();

        return (code, result);
    }

    // ---- Company Systems ----

    public async Task<IEnumerable<CompanySystemDto>> GetSystemsByCompanyAsync(Guid? companyId, bool activeOnly = true)
    {
        await EnsureOpenAsync();
        var p = new DynamicParameters();
        p.Add("CompanyId",  companyId);
        p.Add("ActiveOnly", activeOnly ? 1 : 0);
        return await _connection.QueryAsync<CompanySystemDto>(
            "usp_GetSystemsByCompany", p, commandType: CommandType.StoredProcedure);
    }

    public async Task<(int Code, CompanySystemDto? Result)> ManageCompanySystemAsync(ManageCompanySystemRequest request)
    {
        await EnsureOpenAsync();
        var p = new DynamicParameters();
        p.Add("Action",    request.Action.ToUpper());
        p.Add("Id",        request.Id);
        p.Add("CompanyId", request.CompanyId);
        p.Add("Name",      request.Name);
        p.Add("SortOrder", request.SortOrder);
        p.Add("IsActive",  request.IsActive);

        using var multi = await _connection.QueryMultipleAsync(
            "usp_ManageCompanySystem", p, commandType: CommandType.StoredProcedure);

        var codeRow = await multi.ReadFirstAsync<dynamic>();
        int code = (int)codeRow.Code;
        if (code != 0) return (code, null);

        CompanySystemDto? result = null;
        if (!multi.IsConsumed)
            result = await multi.ReadFirstOrDefaultAsync<CompanySystemDto>();

        return (code, result);
    }

    // ---- Ticket Classification ----

    public async Task<(int Code, TicketDetailDto? Ticket)> SetClassificationAsync(
        Guid ticketId,
        SetTicketClassificationRequest request,
        RequestingUserContext ctx)
    {
        await EnsureOpenAsync();
        var p = new DynamicParameters();
        p.Add("TicketId",          ticketId);
        p.Add("IssueTypeId",       request.IssueTypeId);
        p.Add("AffectedCompanyId", request.AffectedCompanyId);
        p.Add("SystemId",          request.SystemId);
        p.Add("Severity",          request.Severity);
        p.Add("Urgency",           request.Urgency);
        p.Add("RequestingUserId",  ctx.UserId);
        p.Add("RequestingRole",    ctx.EffectiveRole);

        using var multi = await _connection.QueryMultipleAsync(
            "usp_SetTicketClassification", p, commandType: CommandType.StoredProcedure);

        var codeRow = await multi.ReadFirstAsync<dynamic>();
        int code = (int)codeRow.Code;
        if (code != 0) return (code, null);

        var ticket = await multi.ReadFirstOrDefaultAsync<TicketDetailDto>();
        return (code, ticket);
    }
}
