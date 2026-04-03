namespace GITP.API.Models;

public class Ticket
{
    public Guid Id { get; set; }
    public string TicketNo { get; set; } = "";
    public Guid CompanyId { get; set; }
    public Guid SubmitterId { get; set; }
    public Guid? AssigneeId { get; set; }
    public string Subject { get; set; } = "";
    public string Description { get; set; } = "";
    public string Status { get; set; } = "新建立";
    public DateTime CreatedAt { get; set; }
    public DateTime? FirstResponseAt { get; set; }
    public DateTime? ClosedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
