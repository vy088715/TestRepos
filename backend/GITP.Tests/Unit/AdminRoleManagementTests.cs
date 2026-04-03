using FluentAssertions;

namespace GITP.Tests.Unit;

/// <summary>
/// Business-logic tests for the admin role-management rules:
/// - Cannot change own role
/// - Must keep at least one it_admin
/// - Valid role values
/// These mirror the logic in usp_SetUserRoles (init.sql).
/// </summary>
public class AdminRoleManagementTests
{
    private static readonly Guid _adminId    = Guid.NewGuid();
    private static readonly Guid _otherAdminId = Guid.NewGuid();
    private static readonly Guid _assigneeId = Guid.NewGuid();

    /// <summary>
    /// Simulates the SP result code for SetUserRoles:
    ///   0 = success
    ///   1 = cannot change own roles
    ///   2 = would leave system with no it_admin
    ///   3 = invalid role value
    /// </summary>
    private static int EvaluateSetUserRoles(
        Guid targetUserId,
        Guid requesterId,
        IEnumerable<string> newRoles,
        int currentItAdminCount,
        bool targetIsCurrentlyAdmin)
    {
        var roles = newRoles.ToList();

        // Cannot change own roles
        if (targetUserId == requesterId) return 1;

        // Validate role values
        var valid = new[] { "employee", "it_assignee", "it_admin" };
        if (roles.Any(r => !valid.Contains(r))) return 3;

        // Removing last admin check
        if (targetIsCurrentlyAdmin && !roles.Contains("it_admin"))
        {
            int remainingAdmins = currentItAdminCount - 1;
            if (remainingAdmins < 1) return 2;
        }

        return 0;
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Cannot modify own roles
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public void SetUserRoles_SelfModification_ReturnCode1()
    {
        EvaluateSetUserRoles(_adminId, _adminId, ["it_assignee"], 2, true)
            .Should().Be(1);
    }

    [Fact]
    public void SetUserRoles_DifferentUser_SelfCheckPasses()
    {
        EvaluateSetUserRoles(_otherAdminId, _adminId, ["it_admin"], 2, true)
            .Should().Be(0);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Last admin protection
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public void SetUserRoles_DemoteLastAdmin_ReturnCode2()
    {
        // Only 1 admin in system; demoting them
        EvaluateSetUserRoles(_otherAdminId, _adminId, ["it_assignee"],
            currentItAdminCount: 1, targetIsCurrentlyAdmin: true)
            .Should().Be(2);
    }

    [Fact]
    public void SetUserRoles_DemoteWhenMoreAdminsExist_ReturnsCode0()
    {
        // 2 admins — safe to demote one
        EvaluateSetUserRoles(_otherAdminId, _adminId, ["it_assignee"],
            currentItAdminCount: 2, targetIsCurrentlyAdmin: true)
            .Should().Be(0);
    }

    [Fact]
    public void SetUserRoles_DemoteNonAdmin_LastAdminCheckIrrelevant()
    {
        // Changing roles of a non-admin — no admin count check needed
        EvaluateSetUserRoles(_assigneeId, _adminId, ["employee"],
            currentItAdminCount: 1, targetIsCurrentlyAdmin: false)
            .Should().Be(0);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Invalid role values
    // ──────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("superuser")]
    [InlineData("ADMIN")]
    [InlineData("it-admin")]   // dash instead of underscore
    [InlineData("")]
    public void SetUserRoles_InvalidRoleValue_ReturnCode3(string badRole)
    {
        EvaluateSetUserRoles(_otherAdminId, _adminId, [badRole], 2, false)
            .Should().Be(3);
    }

    [Theory]
    [InlineData("employee")]
    [InlineData("it_assignee")]
    [InlineData("it_admin")]
    public void SetUserRoles_ValidRoleValues_ReturnCode0(string role)
    {
        EvaluateSetUserRoles(_otherAdminId, _adminId, [role], 2, false)
            .Should().Be(0);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Multi-role assignment
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public void SetUserRoles_MultiRole_AllValid_ReturnsCode0()
    {
        EvaluateSetUserRoles(_otherAdminId, _adminId, ["it_admin", "it_assignee"], 2, false)
            .Should().Be(0);
    }

    [Fact]
    public void SetUserRoles_MultiRole_OneInvalid_ReturnCode3()
    {
        EvaluateSetUserRoles(_otherAdminId, _adminId, ["it_admin", "root"], 2, false)
            .Should().Be(3);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Promote non-admin to admin — always safe
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public void SetUserRoles_PromoteAssigneeToAdmin_ReturnsCode0()
    {
        EvaluateSetUserRoles(_assigneeId, _adminId, ["it_admin"],
            currentItAdminCount: 1, targetIsCurrentlyAdmin: false)
            .Should().Be(0);
    }
}
