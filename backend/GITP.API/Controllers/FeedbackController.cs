using GITP.API.DTOs;
using GITP.API.Services;
using Microsoft.AspNetCore.Mvc;

namespace GITP.API.Controllers;

/// <summary>
/// Public feedback endpoints — no authentication required.
/// The token in the URL is the only access control.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class FeedbackController : ControllerBase
{
    private readonly FeedbackService _feedbackService;
    private readonly IConfiguration _configuration;

    public FeedbackController(FeedbackService feedbackService, IConfiguration configuration)
    {
        _feedbackService = feedbackService;
        _configuration = configuration;
    }

    /// <summary>GET /api/feedback/{token} — view feedback status</summary>
    [HttpGet("{token:guid}")]
    public async Task<IActionResult> GetFeedback(Guid token)
    {
        var feedback = await _feedbackService.GetFeedbackByTokenAsync(token);
        if (feedback == null) return NotFound(new { message = "回饋連結無效或已失效" });
        return Ok(feedback);
    }

    /// <summary>
    /// POST /api/feedback/{token} — submit satisfied or unsatisfied.
    /// Body: { "result": "satisfied" | "unsatisfied" }
    /// </summary>
    [HttpPost("{token:guid}")]
    public async Task<IActionResult> SubmitFeedback(Guid token, [FromBody] SubmitFeedbackRequest request)
    {
        if (request.Result != "satisfied" && request.Result != "unsatisfied")
            return BadRequest(new { message = "result 必須為 satisfied 或 unsatisfied" });

        var response = await _feedbackService.SubmitFeedbackAsync(token, request.Result);
        return response.Code switch
        {
            0 => Ok(response),
            1 => NotFound(new { message = response.Message }),
            2 => Conflict(new { message = response.Message }),
            _ => StatusCode(500)
        };
    }
}
