using System.Data;
using System.Security.Claims;
using Dapper;
using GITP.API.DTOs;
using GITP.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace GITP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AttachmentsController : ControllerBase
{
    private readonly SqlConnection _connection;
    private readonly FileStorageService _fileStorage;
    private readonly ILogger<AttachmentsController> _logger;

    public AttachmentsController(SqlConnection connection, FileStorageService fileStorage,
        ILogger<AttachmentsController> logger)
    {
        _connection = connection;
        _fileStorage = fileStorage;
        _logger = logger;
    }

    private async Task EnsureOpenAsync()
    {
        if (_connection.State != ConnectionState.Open)
            await _connection.OpenAsync();
    }

    private (Guid UserId, bool IsItStaff, Guid CompanyId) GetUser()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? Guid.Empty.ToString());
        var companyId = Guid.Parse(User.FindFirstValue("company_id") ?? Guid.Empty.ToString());
        var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (roles.Count == 0)
        {
            var rolesClaim = User.FindFirstValue("roles");
            if (!string.IsNullOrEmpty(rolesClaim))
                roles = new HashSet<string>(
                    rolesClaim.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
                    StringComparer.OrdinalIgnoreCase);
        }
        bool isItStaff = roles.Contains("it_admin") || roles.Contains("it_assignee");
        return (userId, isItStaff, companyId);
    }

    [HttpPost("~/api/tickets/{ticketId:guid}/attachments")]
    public async Task<IActionResult> UploadAttachment(Guid ticketId, IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "請選擇檔案" });

        var (userId, isItStaff, companyId) = GetUser();

        // Validate file using DB-driven settings
        var (valid, error) = await _fileStorage.ValidateFileAsync(file.FileName, file.ContentType, file.Length);
        if (!valid) return BadRequest(new { message = error });

        await EnsureOpenAsync();

        // Check ticket access
        var effectiveRole = isItStaff ? "it_assignee" : "employee";
        var ticket = await _connection.QueryFirstOrDefaultAsync<TicketDetailDto>(
            "usp_GetTicketById",
            new { TicketId = ticketId, RequestingUserId = userId, RequestingRole = effectiveRole, RequestingCompanyId = companyId },
            commandType: CommandType.StoredProcedure);

        // usp_GetTicketById returns 3 result sets, but QueryFirstOrDefaultAsync only reads the first
        // We just need to check if the ticket is accessible
        if (ticket == null)
            return NotFound(new { message = "案件不存在或無存取權限" });

        // Save file
        string storagePath;
        try
        {
            storagePath = await _fileStorage.SaveFileAsync(file.OpenReadStream(), file.FileName, file.ContentType);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save file {Filename}", file.FileName);
            return StatusCode(500, new { message = "檔案儲存失敗" });
        }

        // Create attachment record
        var attachment = await _connection.QueryFirstOrDefaultAsync<AttachmentDto>(
            "usp_CreateAttachment",
            new
            {
                TicketId = ticketId,
                Filename = file.FileName,
                StoragePath = storagePath,
                SizeBytes = file.Length,
                ContentType = file.ContentType
            },
            commandType: CommandType.StoredProcedure);

        return Ok(attachment);
    }

    [HttpGet("~/api/tickets/{ticketId:guid}/attachments/{id:guid}")]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> DownloadAttachment(Guid id)
    {
        var (userId, isItStaff, companyId) = GetUser();

        await EnsureOpenAsync();
        var attachment = await _connection.QueryFirstOrDefaultAsync<AttachmentDetailDto>(
            "usp_GetAttachmentById",
            new { AttachmentId = id },
            commandType: CommandType.StoredProcedure);

        if (attachment == null) return NotFound(new { message = "附件不存在" });

        // Access check: IT staff OR same company
        if (!isItStaff && attachment.TicketCompanyId != companyId)
            return Forbid();

        try
        {
            var stream = await _fileStorage.GetFileAsync(attachment.StoragePath);
            var contentType = attachment.ContentType ?? "application/octet-stream";
            return File(stream, contentType, attachment.Filename);
        }
        catch (FileNotFoundException)
        {
            return NotFound(new { message = "檔案不存在" });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteAttachment(Guid id)
    {
        var (userId, isItStaff, companyId) = GetUser();

        await EnsureOpenAsync();
        var attachment = await _connection.QueryFirstOrDefaultAsync<AttachmentDetailDto>(
            "usp_GetAttachmentById",
            new { AttachmentId = id },
            commandType: CommandType.StoredProcedure);

        if (attachment == null) return NotFound(new { message = "附件不存在" });

        // Access check: IT staff OR same company
        if (!isItStaff && attachment.TicketCompanyId != companyId)
            return Forbid();

        // Delete DB record and get storage path
        var result = await _connection.QueryFirstOrDefaultAsync<dynamic>(
            "usp_DeleteAttachment",
            new { AttachmentId = id },
            commandType: CommandType.StoredProcedure);

        if (result?.StoragePath != null)
        {
            await _fileStorage.DeleteFileAsync(result.StoragePath.ToString());
        }

        return NoContent();
    }

    [HttpGet("~/api/tickets/{ticketId:guid}/attachments")]
    public async Task<IActionResult> GetAttachmentsByTicket(Guid ticketId)
    {
        var (userId, isItStaff, companyId) = GetUser();

        await EnsureOpenAsync();
        var attachments = await _connection.QueryAsync<AttachmentDto>(
            "usp_GetAttachmentsByTicket",
            new { TicketId = ticketId },
            commandType: CommandType.StoredProcedure);

        return Ok(attachments);
    }
}
