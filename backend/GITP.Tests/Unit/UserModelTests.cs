using FluentAssertions;
using GITP.API.Models;

namespace GITP.Tests.Unit;

/// <summary>
/// Unit tests for the User model: RoleList parsing,
/// EffectiveRole priority, and edge cases.
/// </summary>
public class UserModelTests
{
    // ──────────────────────────────────────────────────────────────────────
    //  RoleList parsing
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public void RoleList_SingleRole_ParsedCorrectly()
    {
        var user = new User { Roles = "employee" };
        user.RoleList.Should().ContainSingle().Which.Should().Be("employee");
    }

    [Fact]
    public void RoleList_MultiRole_SplitsOnComma()
    {
        var user = new User { Roles = "it_admin,it_assignee" };
        user.RoleList.Should().HaveCount(2)
            .And.Contain("it_admin")
            .And.Contain("it_assignee");
    }

    [Fact]
    public void RoleList_HandlesWhitespaceAroundComma()
    {
        var user = new User { Roles = "it_admin , it_assignee" };
        user.RoleList.Should().Contain("it_admin").And.Contain("it_assignee");
    }

    [Fact]
    public void RoleList_EmptyString_ReturnsEmpty()
    {
        var user = new User { Roles = "" };
        user.RoleList.Should().BeEmpty();
    }

    // ──────────────────────────────────────────────────────────────────────
    //  EffectiveRole
    // ──────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("it_admin",              "it_admin")]
    [InlineData("it_assignee",           "it_assignee")]
    [InlineData("employee",              "employee")]
    [InlineData("it_admin,it_assignee",  "it_admin")]     // admin wins
    [InlineData("it_assignee,employee",  "it_assignee")]  // assignee beats employee
    [InlineData("",                      "employee")]     // default when no roles
    public void EffectiveRole_PriorityOrder(string roles, string expected)
    {
        var user = new User { Roles = roles };
        user.EffectiveRole.Should().Be(expected);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Default Roles value
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public void DefaultRoles_IsEmployee()
    {
        var user = new User();
        user.Roles.Should().Be("employee");
        user.EffectiveRole.Should().Be("employee");
    }
}
