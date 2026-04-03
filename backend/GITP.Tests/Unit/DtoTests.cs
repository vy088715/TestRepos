using FluentAssertions;
using GITP.API.DTOs;

namespace GITP.Tests.Unit;

/// <summary>
/// Unit tests for DTOs — data annotations, derived properties,
/// and default values.
/// </summary>
public class DtoTests
{
    // ──────────────────────────────────────────────────────────────────────
    //  UserDto.EffectiveRole
    // ──────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("it_admin",             "it_admin")]
    [InlineData("it_assignee",          "it_assignee")]
    [InlineData("employee",             "employee")]
    [InlineData("it_admin,it_assignee", "it_admin")]
    [InlineData("it_assignee,employee", "it_assignee")]
    [InlineData("",                     "employee")]
    public void UserDto_EffectiveRole_Priority(string roles, string expected)
    {
        var dto = new UserDto { Roles = roles };
        dto.EffectiveRole.Should().Be(expected);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  TicketFilterRequest defaults
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public void TicketFilterRequest_DefaultPage_IsOne()
    {
        var req = new TicketFilterRequest();
        req.Page.Should().Be(1);
    }

    [Fact]
    public void TicketFilterRequest_DefaultPageSize_Is20()
    {
        var req = new TicketFilterRequest();
        req.PageSize.Should().Be(20);
    }

    [Fact]
    public void TicketFilterRequest_DefaultMyTickets_IsFalse()
    {
        var req = new TicketFilterRequest();
        req.MyTickets.Should().BeFalse();
    }

    // ──────────────────────────────────────────────────────────────────────
    //  CreateTicketRequest required fields validation
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public void CreateTicketRequest_EmptySubject_FailsAnnotationCheck()
    {
        var req = new CreateTicketRequest { Subject = "", Description = "some description" };
        var results = ValidationHelper.Validate(req);
        results.Should().ContainSingle(r => r.MemberNames.Contains("Subject"));
    }

    [Fact]
    public void CreateTicketRequest_EmptyDescription_FailsAnnotationCheck()
    {
        var req = new CreateTicketRequest { Subject = "Test", Description = "" };
        var results = ValidationHelper.Validate(req);
        results.Should().ContainSingle(r => r.MemberNames.Contains("Description"));
    }

    [Fact]
    public void CreateTicketRequest_SubjectOver500Chars_FailsAnnotationCheck()
    {
        var req = new CreateTicketRequest
        {
            Subject = new string('x', 501),
            Description = "desc"
        };
        var results = ValidationHelper.Validate(req);
        results.Should().ContainSingle(r => r.MemberNames.Contains("Subject"));
    }

    [Fact]
    public void CreateTicketRequest_ValidData_PassesValidation()
    {
        var req = new CreateTicketRequest { Subject = "Valid subject", Description = "Some description" };
        ValidationHelper.Validate(req).Should().BeEmpty();
    }

    // ──────────────────────────────────────────────────────────────────────
    //  BatchAssignRequest defaults
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public void BatchAssignRequest_DefaultTicketIds_IsEmptyList()
    {
        var req = new BatchAssignRequest();
        req.TicketIds.Should().NotBeNull().And.BeEmpty();
    }
}

internal static class ValidationHelper
{
    internal static IList<System.ComponentModel.DataAnnotations.ValidationResult> Validate(object obj)
    {
        var results = new List<System.ComponentModel.DataAnnotations.ValidationResult>();
        var ctx = new System.ComponentModel.DataAnnotations.ValidationContext(obj);
        System.ComponentModel.DataAnnotations.Validator.TryValidateObject(obj, ctx, results, validateAllProperties: true);
        return results;
    }
}
