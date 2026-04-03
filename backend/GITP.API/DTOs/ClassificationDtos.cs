using System.ComponentModel.DataAnnotations;

namespace GITP.API.DTOs;

public class IssueTypeDto
{
    public Guid   Id        { get; set; }
    public string Name      { get; set; } = "";
    public int    SortOrder { get; set; }
    public bool   IsActive  { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CompanySystemDto
{
    public Guid   Id            { get; set; }
    public Guid   CompanyId     { get; set; }
    public string CompanyName   { get; set; } = "";
    public string Name          { get; set; } = "";
    public int    SortOrder     { get; set; }
    public bool   IsActive      { get; set; }
    public DateTime CreatedAt   { get; set; }
}

public class SetTicketClassificationRequest
{
    public Guid?   IssueTypeId       { get; set; }
    public Guid?   AffectedCompanyId { get; set; }
    public Guid?   SystemId          { get; set; }
    public int?    Severity          { get; set; }
    public int?    Urgency           { get; set; }
}

public class ManageIssueTypeRequest
{
    public string Action    { get; set; } = "CREATE";
    public Guid?  Id        { get; set; }
    public string Name      { get; set; } = "";
    public int    SortOrder { get; set; }
    public bool   IsActive  { get; set; } = true;
}

public class ManageCompanySystemRequest
{
    public string Action     { get; set; } = "CREATE";
    public Guid?  Id         { get; set; }
    public Guid   CompanyId  { get; set; }
    public string Name       { get; set; } = "";
    public int    SortOrder  { get; set; }
    public bool   IsActive   { get; set; } = true;
}

public record CreateIssueTypeRequest([Required] string Name);
public record UpdateIssueTypeRequest([Required] string Name);
public record CreateCompanySystemRequest([Required] Guid CompanyId, [Required] string Name);
public record UpdateCompanySystemRequest([Required] Guid CompanyId, [Required] string Name);
