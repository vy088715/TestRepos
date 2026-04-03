namespace GITP.API.Models;

public class Company
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Code { get; set; } = "";
    public bool IsItCompany { get; set; }
    public DateTime CreatedAt { get; set; }
}
