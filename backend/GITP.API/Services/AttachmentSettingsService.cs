using System.Data;
using Dapper;
using GITP.API.Data;
using GITP.API.DTOs;
using Microsoft.Data.SqlClient;

namespace GITP.API.Services;

public class AttachmentSettingsService
{
    private readonly IDbConnectionFactory _factory;

    public AttachmentSettingsService(IDbConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<AttachmentSettingsDto> GetSettingsAsync()
    {
        using var conn = _factory.CreateConnection();
        await conn.OpenAsync();
        var result = await conn.QueryFirstOrDefaultAsync<AttachmentSettingsDto>(
            "usp_GetAttachmentSettings",
            commandType: CommandType.StoredProcedure);
        return result ?? new AttachmentSettingsDto
        {
            UploadEnabled     = true,
            AllowedExtensions = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.bmp,.zip",
            AllowedMimeTypes  = "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,image/jpeg,image/png,image/gif,image/bmp,application/zip",
            MaxFileSizeBytes  = 20971520
        };
    }

    public async Task<AttachmentSettingsDto> SaveSettingsAsync(SaveAttachmentSettingsRequest req, Guid updatedBy)
    {
        using var conn = _factory.CreateConnection();
        await conn.OpenAsync();
        var result = await conn.QueryFirstOrDefaultAsync<AttachmentSettingsDto>(
            "usp_SaveAttachmentSettings",
            new
            {
                UploadEnabled     = req.UploadEnabled,
                AllowedExtensions = req.AllowedExtensions.Trim(),
                AllowedMimeTypes  = req.AllowedMimeTypes.Trim(),
                MaxFileSizeBytes  = req.MaxFileSizeBytes,
                UpdatedBy         = updatedBy
            },
            commandType: CommandType.StoredProcedure);
        return result ?? await GetSettingsAsync();
    }
}
