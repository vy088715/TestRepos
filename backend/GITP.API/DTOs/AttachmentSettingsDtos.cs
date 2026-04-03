namespace GITP.API.DTOs;

public class AttachmentSettingsDto
{
    public bool UploadEnabled { get; set; }
    public string AllowedExtensions { get; set; } = string.Empty;
    public string AllowedMimeTypes { get; set; } = string.Empty;
    public long MaxFileSizeBytes { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public Guid? UpdatedBy { get; set; }

    public List<string> AllowedExtensionList =>
        AllowedExtensions.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(e => e.ToLowerInvariant())
            .ToList();

    public List<string> AllowedMimeTypeList =>
        AllowedMimeTypes.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToList();
}

public class SaveAttachmentSettingsRequest
{
    public bool UploadEnabled { get; set; }
    public string AllowedExtensions { get; set; } = string.Empty;
    public string AllowedMimeTypes { get; set; } = string.Empty;
    public long MaxFileSizeBytes { get; set; }
}
