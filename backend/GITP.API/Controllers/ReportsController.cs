using System.Security.Claims;
using GITP.API.DTOs;
using GITP.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GITP.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly ExportService _exportService;

    public ReportsController(ExportService exportService)
    {
        _exportService = exportService;
    }

    [HttpPost("exports")]
    public async Task<IActionResult> StartExport([FromBody] ExportRequestDto request)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
                               ?? User.FindFirstValue("sub") ?? Guid.Empty.ToString());

        var filtersJson = System.Text.Json.JsonSerializer.Serialize(request);
        var job = await _exportService.StartExportAsync(userId, filtersJson);
        return Accepted(new { jobId = job.Id, status = job.Status });
    }

    [HttpGet("exports/{jobId:guid}")]
    public async Task<IActionResult> GetExportStatus(Guid jobId)
    {
        var job = await _exportService.GetJobStatusAsync(jobId);
        if (job == null) return NotFound(new { message = "匯出工作不存在" });
        return Ok(new { jobId = job.Id, status = job.Status, createdAt = job.CreatedAt, completedAt = job.CompletedAt });
    }

    [HttpGet("exports/{jobId:guid}/download")]
    public async Task<IActionResult> DownloadExport(Guid jobId)
    {
        var (filePath, job) = await _exportService.GetExportFileAsync(jobId);
        if (job == null) return NotFound(new { message = "匯出工作不存在" });
        if (job.Status == "pending" || job.Status == "processing")
            return Accepted(new { message = "匯出尚未完成", status = job.Status });
        if (job.Status == "failed")
            return StatusCode(500, new { message = "匯出失敗" });
        if (string.IsNullOrEmpty(filePath) || !System.IO.File.Exists(filePath))
            return NotFound(new { message = "匯出檔案不存在" });

        var fileName = Path.GetFileName(filePath);
        var stream = System.IO.File.OpenRead(filePath);
        return File(stream, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
    }
}
