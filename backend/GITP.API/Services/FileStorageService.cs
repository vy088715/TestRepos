namespace GITP.API.Services;

public class FileStorageService
{
    private readonly IConfiguration _configuration;
    private readonly AttachmentSettingsService _settingsService;
    private readonly ILogger<FileStorageService> _logger;

    public FileStorageService(IConfiguration configuration,
        AttachmentSettingsService settingsService,
        ILogger<FileStorageService> logger)
    {
        _configuration  = configuration;
        _settingsService = settingsService;
        _logger         = logger;
    }

    public async Task<(bool valid, string? error)> ValidateFileAsync(string filename, string? contentType, long size)
    {
        var settings = await _settingsService.GetSettingsAsync();

        if (!settings.UploadEnabled)
            return (false, "系統目前不開放附件上傳");

        if (size > settings.MaxFileSizeBytes)
            return (false, $"檔案大小超過限制（最大 {settings.MaxFileSizeBytes / 1024 / 1024}MB）");

        var ext = Path.GetExtension(filename).ToLowerInvariant();
        if (!settings.AllowedExtensionList.Contains(ext))
            return (false, $"不支援的檔案格式：{ext}");

        if (!string.IsNullOrWhiteSpace(contentType) && settings.AllowedMimeTypeList.Count > 0)
        {
            var baseMime = contentType.Split(';')[0].Trim().ToLowerInvariant();
            if (!settings.AllowedMimeTypeList.Any(m => m.Equals(baseMime, StringComparison.OrdinalIgnoreCase)))
                return (false, $"不允許的 MIME 類型：{baseMime}");
        }

        return (true, null);
    }

    // Keep sync overload for backwards compat — falls back to config-based defaults only
    public (bool valid, string? error) ValidateFile(string filename, string? contentType, long size)
    {
        var maxSize = _configuration.GetValue<long>("Storage:MaxFileSizeBytes", 20971520);
        if (size > maxSize)
            return (false, $"檔案大小超過限制（最大 {maxSize / 1024 / 1024}MB）");
        var allowedExtensions = new[] { ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".zip" };
        var ext = Path.GetExtension(filename).ToLowerInvariant();
        if (!allowedExtensions.Contains(ext))
            return (false, $"不支援的檔案格式：{ext}");
        return (true, null);
    }

    public async Task<string> SaveFileAsync(Stream fileStream, string filename, string? contentType)
    {
        var storagePath = _configuration["Storage:LocalPath"] ?? "/app/uploads";
        Directory.CreateDirectory(storagePath);
        var uniqueFilename = $"{Guid.NewGuid():N}_{filename}";
        var filePath = Path.Combine(storagePath, uniqueFilename);
        using var outStream = new FileStream(filePath, FileMode.Create, FileAccess.Write);
        await fileStream.CopyToAsync(outStream);
        return filePath;
    }

    public async Task<Stream> GetFileAsync(string storagePath)
    {
        if (!File.Exists(storagePath))
            throw new FileNotFoundException("File not found", storagePath);
        return await Task.FromResult(new FileStream(storagePath, FileMode.Open, FileAccess.Read));
    }

    public async Task DeleteFileAsync(string storagePath)
    {
        if (File.Exists(storagePath))
            File.Delete(storagePath);
        await Task.CompletedTask;
    }

    public async Task<bool> VirusScanStubAsync(string storagePath)
    {
        await Task.CompletedTask;
        return true;
    }
}
