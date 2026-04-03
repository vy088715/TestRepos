using System.ComponentModel.DataAnnotations;

namespace GITP.API.DTOs;

public class TicketListDto
{
    public Guid Id { get; set; }
    public string TicketNo { get; set; } = "";
    public string Subject { get; set; } = "";
    public string Status { get; set; } = "";
    public string CompanyName { get; set; } = "";
    public string SubmitterName { get; set; } = "";
    public string? AssigneeName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? FirstResponseAt { get; set; }
    public DateTime? ClosedAt { get; set; }
}

public class TicketDetailDto
{
    public Guid Id { get; set; }
    public string TicketNo { get; set; } = "";
    public string Subject { get; set; } = "";
    public string Description { get; set; } = "";
    public string Status { get; set; } = "";
    public Guid CompanyId { get; set; }
    public string CompanyName { get; set; } = "";
    public Guid SubmitterId { get; set; }
    public string SubmitterName { get; set; } = "";
    public string SubmitterEmail { get; set; } = "";
    public string? SubmitterPhone { get; set; }
    public Guid? AssigneeId { get; set; }
    public string? AssigneeName { get; set; }
    public string? AssigneeEmail { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? FirstResponseAt { get; set; }
    public DateTime? ClosedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class TicketMessageDto
{
    public Guid Id { get; set; }
    public Guid TicketId { get; set; }
    public Guid AuthorId { get; set; }
    public string AuthorName { get; set; } = "";
    public string Content { get; set; } = "";
    public bool IsItReply { get; set; }
    public string MessageType { get; set; } = "reply";
    public DateTime CreatedAt { get; set; }
}

public class TicketHandlerHistoryDto
{
    public Guid Id { get; set; }
    public Guid TicketId { get; set; }
    public Guid HandlerId { get; set; }
    public string HandlerName { get; set; } = "";
    public string HandlerEmail { get; set; } = "";
    public Guid AssignedById { get; set; }
    public string AssignedByName { get; set; } = "";
    public DateTime AssignedAt { get; set; }
    public DateTime? ReleasedAt { get; set; }
    public string? Note { get; set; }
    public string ActionType { get; set; } = "";
}

public class AttachmentDto
{
    public Guid Id { get; set; }
    public Guid TicketId { get; set; }
    public string Filename { get; set; } = "";
    public long SizeBytes { get; set; }
    public string? ContentType { get; set; }
    public DateTime UploadedAt { get; set; }
}

public class AttachmentDetailDto
{
    public Guid Id { get; set; }
    public Guid TicketId { get; set; }
    public string Filename { get; set; } = "";
    public string StoragePath { get; set; } = "";
    public long SizeBytes { get; set; }
    public string? ContentType { get; set; }
    public DateTime UploadedAt { get; set; }
    public Guid TicketCompanyId { get; set; }
    public Guid TicketSubmitterId { get; set; }
}

public class ExportJobDto
{
    public Guid Id { get; set; }
    public string Status { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? ResultPath { get; set; }
}

public class ExportTicketDto
{
    public string TicketNo { get; set; } = "";
    public string CompanyName { get; set; } = "";
    public string SubmitterName { get; set; } = "";
    public string Subject { get; set; } = "";
    public string Status { get; set; } = "";
    public string? AssigneeName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? FirstResponseAt { get; set; }
    public DateTime? ClosedAt { get; set; }
}

public class UserDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Roles { get; set; } = "";
    public Guid CompanyId { get; set; }
    public string CompanyName { get; set; } = "";
    public string EffectiveRole => Roles.Contains("it_admin") ? "it_admin" :
                                   Roles.Contains("it_assignee") ? "it_assignee" : "employee";
}

public class ItAdminEmailDto
{
    public string Email { get; set; } = "";
    public string Name { get; set; } = "";
}

public class TicketFilterRequest
{
    public string? Status { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public string? Keyword { get; set; }
    public bool MyTickets { get; set; } = false;
    public Guid? CompanyIdFilter { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public class CreateTicketRequest
{
    [Required]
    [MaxLength(500)]
    public string Subject { get; set; } = "";

    [Required]
    public string Description { get; set; } = "";
}

public class UpdateStatusRequest
{
    [Required]
    public string Status { get; set; } = "";
}

public class AssignTicketRequest
{
    [Required]
    public Guid AssigneeId { get; set; }
}

public class TransferTicketRequest
{
    [Required]
    public Guid ToHandlerId { get; set; }
    public string? Note { get; set; }
}

public class BatchAssignRequest
{
    [Required]
    public List<Guid> TicketIds { get; set; } = new();
    [Required]
    public Guid AssigneeId { get; set; }
}

public class AddMessageRequest
{
    [Required]
    public string Content { get; set; } = "";
}
