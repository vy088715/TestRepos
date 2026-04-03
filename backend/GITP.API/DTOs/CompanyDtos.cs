namespace GITP.API.DTOs;

public class CompanyDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Code { get; set; } = "";
    public bool IsItCompany { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class SetItFlagRequest
{
    public bool IsItCompany { get; set; }
}
