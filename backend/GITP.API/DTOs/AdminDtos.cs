using System.ComponentModel.DataAnnotations;

namespace GITP.API.DTOs;

public class UpdateUserRolesRequest
{
    /// <summary>List of roles to assign. Valid values: employee, it_assignee, it_admin</summary>
    [Required]
    public List<string> Roles { get; set; } = new();
}

public class AdminUserDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string? Phone { get; set; }
    /// <summary>Comma-separated roles, e.g. "it_admin,it_assignee"</summary>
    public string Roles { get; set; } = "";
    public Guid CompanyId { get; set; }
    public string CompanyName { get; set; } = "";

    public IReadOnlyList<string> RoleList =>
        Roles.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}

public class ExportRequestDto
{
    public Guid? CompanyId { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public string? Status { get; set; }
}
