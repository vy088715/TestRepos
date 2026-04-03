using System.Security.Claims;
using GITP.API.DTOs;
using GITP.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GITP.API.Controllers;

[ApiController]
[Route("api/attachment-settings")]
public class AttachmentSettingsController : ControllerBase
{
    private readonly AttachmentSettingsService _service;

    public AttachmentSettingsController(AttachmentSettingsService service)
    {
        _service = service;
    }

    /// <summary>GET /api/attachment-settings — public (no auth), so frontend can show correct hints before upload</summary>
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> Get()
    {
        var settings = await _service.GetSettingsAsync();
        return Ok(settings);
    }

    /// <summary>PUT /api/attachment-settings — it_admin only</summary>
    [HttpPut]
    [Authorize]
    public async Task<IActionResult> Save([FromBody] SaveAttachmentSettingsRequest req)
    {
        var userId = Guid.Parse(
            User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub")
            ?? Guid.Empty.ToString());

        var result = await _service.SaveSettingsAsync(req, userId);
        return Ok(result);
    }
}
