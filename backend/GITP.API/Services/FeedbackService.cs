using System.Data;
using Dapper;
using GITP.API.DTOs;
using Microsoft.Data.SqlClient;

namespace GITP.API.Services;

public class FeedbackService
{
    private readonly SqlConnection _connection;
    private readonly EmailService _emailService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<FeedbackService> _logger;

    public FeedbackService(
        SqlConnection connection,
        EmailService emailService,
        IConfiguration configuration,
        ILogger<FeedbackService> logger)
    {
        _connection = connection;
        _emailService = emailService;
        _configuration = configuration;
        _logger = logger;
    }

    private async Task EnsureOpenAsync()
    {
        if (_connection.State != ConnectionState.Open)
            await _connection.OpenAsync();
    }

    /// <summary>
    /// Called after a ticket is closed. Creates a feedback token and sends closure email.
    /// </summary>
    public async Task CreateAndSendFeedbackAsync(Guid ticketId)
    {
        try
        {
            await EnsureOpenAsync();
            var p = new DynamicParameters();
            p.Add("TicketId", ticketId);
            var tokenInfo = await _connection.QueryFirstOrDefaultAsync<FeedbackTokenDto>(
                "usp_CreateFeedbackToken", p, commandType: CommandType.StoredProcedure);

            if (tokenInfo == null)
            {
                _logger.LogWarning("Failed to create feedback token for ticket {TicketId}", ticketId);
                return;
            }

            var frontendBase = _configuration["FrontendBaseUrl"] ?? "http://localhost:3000";
            var satisfiedUrl   = $"{frontendBase}/feedback/{tokenInfo.Token}/satisfied";
            var unsatisfiedUrl = $"{frontendBase}/feedback/{tokenInfo.Token}/unsatisfied";

            var htmlBody = $@"
<p>親愛的 {tokenInfo.SubmitterName}，</p>
<p>您所提報的案件 <strong>{tokenInfo.TicketNo}</strong> 已正式結案。</p>
<p><strong>主旨：</strong>{tokenInfo.Subject}</p>
<hr />
<p>請問您對本次 IT 處理結果感到滿意嗎？請點擊下方連結回覆：</p>
<table style=""border-spacing:8px"">
  <tr>
    <td>
      <a href=""{satisfiedUrl}"" style=""background:#22c55e;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:16px"">
        ✅ 滿意
      </a>
    </td>
    <td>
      <a href=""{unsatisfiedUrl}"" style=""background:#ef4444;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:16px"">
        ❌ 不滿意
      </a>
    </td>
  </tr>
</table>
<p style=""color:#6b7280;font-size:12px"">此連結僅能使用一次，回覆後即失效。</p>
<p style=""color:#6b7280;font-size:12px"">GITP 集團跨公司 IT 問題反應平台</p>";

            await _emailService.SendEmailSafeAsync(
                tokenInfo.SubmitterEmail,
                tokenInfo.SubmitterName,
                $"[GITP] 案件已結案，請填寫滿意度回饋：{tokenInfo.TicketNo}",
                htmlBody);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating feedback for ticket {TicketId}", ticketId);
        }
    }

    /// <summary>
    /// Returns feedback details by token without consuming it.
    /// </summary>
    public async Task<FeedbackDto?> GetFeedbackByTokenAsync(Guid token)
    {
        await EnsureOpenAsync();
        var p = new DynamicParameters();
        p.Add("Token", token);
        return await _connection.QueryFirstOrDefaultAsync<FeedbackDto>(
            "usp_GetFeedbackByToken", p, commandType: CommandType.StoredProcedure);
    }

    /// <summary>
    /// Submits feedback. Returns (code, feedbackDto):
    ///   0 = success
    ///   1 = token not found
    ///   2 = already submitted
    /// </summary>
    public async Task<SubmitFeedbackResponse> SubmitFeedbackAsync(Guid token, string result)
    {
        await EnsureOpenAsync();
        var p = new DynamicParameters();
        p.Add("Token", token);
        p.Add("Result", result);

        using var multi = await _connection.QueryMultipleAsync(
            "usp_SubmitFeedback", p, commandType: CommandType.StoredProcedure);

        var codeRow = await multi.ReadFirstAsync<dynamic>();
        int code = (int)codeRow.Code;

        if (code != 0)
        {
            return new SubmitFeedbackResponse
            {
                Code = code,
                Message = code == 1 ? "回饋連結無效或已失效" : "您已經提交過滿意度回饋"
            };
        }

        var feedback = await multi.ReadFirstOrDefaultAsync<FeedbackDto>();
        return new SubmitFeedbackResponse
        {
            Code = 0,
            Message = result == "satisfied" ? "感謝您的回饋！" : "感謝您的回饋，我們已為您建立追蹤案件。",
            Feedback = feedback
        };
    }
}
