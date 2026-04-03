using FluentAssertions;
using GITP.API.Services;

namespace GITP.Tests.Unit;

/// <summary>
/// Unit tests for RequestingUserContext — role resolution,
/// permission flags and effective-role priority.
/// </summary>
public class RequestingUserContextTests
{
    private static readonly Guid _userId    = Guid.NewGuid();
    private static readonly Guid _companyId = Guid.NewGuid();

    // ──────────────────────────────────────────────────────────────────────
    //  EffectiveRole priority
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public void EffectiveRole_WhenItAdmin_ReturnsItAdmin()
    {
        var ctx = new RequestingUserContext(_userId, ["it_admin"], _companyId);
        ctx.EffectiveRole.Should().Be("it_admin");
    }

    [Fact]
    public void EffectiveRole_WhenItAssigneeOnly_ReturnsItAssignee()
    {
        var ctx = new RequestingUserContext(_userId, ["it_assignee"], _companyId);
        ctx.EffectiveRole.Should().Be("it_assignee");
    }

    [Fact]
    public void EffectiveRole_WhenEmployeeOnly_ReturnsEmployee()
    {
        var ctx = new RequestingUserContext(_userId, ["employee"], _companyId);
        ctx.EffectiveRole.Should().Be("employee");
    }

    [Fact]
    public void EffectiveRole_WhenMultiRole_ItAdminWins()
    {
        var ctx = new RequestingUserContext(_userId, ["it_assignee", "it_admin", "employee"], _companyId);
        ctx.EffectiveRole.Should().Be("it_admin");
    }

    [Fact]
    public void EffectiveRole_WhenAssigneeAndEmployee_ItAssigneeWins()
    {
        var ctx = new RequestingUserContext(_userId, ["employee", "it_assignee"], _companyId);
        ctx.EffectiveRole.Should().Be("it_assignee");
    }

    // ──────────────────────────────────────────────────────────────────────
    //  IsItAdmin / IsItAssignee / IsItStaff flags
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public void IsItAdmin_TrueOnlyForItAdminRole()
    {
        new RequestingUserContext(_userId, ["it_admin"], _companyId).IsItAdmin.Should().BeTrue();
        new RequestingUserContext(_userId, ["it_assignee"], _companyId).IsItAdmin.Should().BeFalse();
        new RequestingUserContext(_userId, ["employee"], _companyId).IsItAdmin.Should().BeFalse();
    }

    [Fact]
    public void IsItAssignee_TrueOnlyForItAssigneeRole()
    {
        new RequestingUserContext(_userId, ["it_assignee"], _companyId).IsItAssignee.Should().BeTrue();
        new RequestingUserContext(_userId, ["it_admin"], _companyId).IsItAssignee.Should().BeFalse();
        new RequestingUserContext(_userId, ["employee"], _companyId).IsItAssignee.Should().BeFalse();
    }

    [Theory]
    [InlineData("it_admin",    true)]
    [InlineData("it_assignee", true)]
    [InlineData("employee",    false)]
    public void IsItStaff_ReflectsItPersonnel(string role, bool expected)
    {
        var ctx = new RequestingUserContext(_userId, [role], _companyId);
        ctx.IsItStaff.Should().Be(expected);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  CanCloseTicket — requires IsItStaff AND IsItCompany
    // ──────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("it_admin",    true,  true)]   // IT staff + IT company → can close
    [InlineData("it_assignee", true,  true)]
    [InlineData("it_admin",    false, false)]   // IT staff but NOT IT company → cannot
    [InlineData("it_assignee", false, false)]
    [InlineData("employee",    true,  false)]   // IT company but not IT staff → cannot
    [InlineData("employee",    false, false)]
    public void CanCloseTicket_RequiresBothItStaffAndItCompany(string role, bool isItCompany, bool expected)
    {
        var ctx = new RequestingUserContext(_userId, [role], _companyId, isItCompany);
        ctx.CanCloseTicket.Should().Be(expected);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  CanClassifyTicket — it_admin OR (it_assignee AND IT company)
    // ──────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("it_admin",    true,  true)]
    [InlineData("it_admin",    false, true)]   // it_admin can always classify
    [InlineData("it_assignee", true,  true)]
    [InlineData("it_assignee", false, false)]  // it_assignee only if IT company
    [InlineData("employee",    true,  false)]
    [InlineData("employee",    false, false)]
    public void CanClassifyTicket_FollowsBusinessRule(string role, bool isItCompany, bool expected)
    {
        var ctx = new RequestingUserContext(_userId, [role], _companyId, isItCompany);
        ctx.CanClassifyTicket.Should().Be(expected);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  RoleList is immutable (ReadOnly)
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public void Roles_IsReadOnly()
    {
        var ctx = new RequestingUserContext(_userId, ["it_admin"], _companyId);
        ctx.Roles.Should().BeAssignableTo<IReadOnlyList<string>>();
    }

    [Fact]
    public void Roles_ContainsAllProvidedValues()
    {
        var ctx = new RequestingUserContext(_userId, ["it_admin", "it_assignee"], _companyId);
        ctx.Roles.Should().Contain("it_admin").And.Contain("it_assignee");
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Constructor stores identity values unchanged
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public void Constructor_StoresUserIdAndCompanyId()
    {
        var userId    = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var ctx = new RequestingUserContext(userId, ["employee"], companyId, true);

        ctx.UserId.Should().Be(userId);
        ctx.CompanyId.Should().Be(companyId);
        ctx.IsItCompany.Should().BeTrue();
    }

    [Fact]
    public void IsItCompany_DefaultsFalse()
    {
        var ctx = new RequestingUserContext(_userId, ["it_admin"], _companyId);
        ctx.IsItCompany.Should().BeFalse();
    }
}
