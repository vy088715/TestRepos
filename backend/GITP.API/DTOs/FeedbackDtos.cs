namespace GITP.API.DTOs;

public class FeedbackDto
{
    public Guid   Id                 { get; set; }
    public Guid   TicketId           { get; set; }
    public Guid   Token              { get; set; }
    public string? Result            { get; set; }
    public Guid?  FollowUpTicketId   { get; set; }
    public string? FollowUpTicketNo  { get; set; }
    public DateTime CreatedAt        { get; set; }
    public DateTime? SubmittedAt     { get; set; }
    public string TicketNo           { get; set; } = "";
    public string Subject            { get; set; } = "";
    public string TicketStatus       { get; set; } = "";
    public string SubmitterName      { get; set; } = "";
}

public class FeedbackTokenDto
{
    public Guid   Token              { get; set; }
    public string SubmitterEmail     { get; set; } = "";
    public string SubmitterName      { get; set; } = "";
    public string TicketNo           { get; set; } = "";
    public string Subject            { get; set; } = "";
}

public class SubmitFeedbackRequest
{
    /// <summary>satisfied or unsatisfied</summary>
    public string Result { get; set; } = "";
}

public class SubmitFeedbackResponse
{
    public int         Code             { get; set; }
    public string      Message          { get; set; } = "";
    public FeedbackDto? Feedback        { get; set; }
}
