namespace GITP.API.Models;

public class User
{
    public Guid Id { get; set; }
    public Guid CompanyId { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string? Phone { get; set; }
    public string? EmpId { get; set; }
    public string? DepId { get; set; }
    public string? DepName { get; set; }
    public DateTime CreatedAt { get; set; }
    /// <summary>Comma-separated roles from DB, e.g. "it_admin,it_assignee"</summary>
    public string Roles { get; set; } = "employee";
    public string? SsoId { get; set; }
    public string? PasswordHash { get; set; }

    public IReadOnlyList<string> RoleList =>
        Roles.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    /// <summary>Most privileged role: it_admin > it_assignee > employee</summary>
    public string EffectiveRole =>
        RoleList.Contains("it_admin") ? "it_admin" :
        RoleList.Contains("it_assignee") ? "it_assignee" : "employee";
}
