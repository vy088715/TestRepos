using FluentAssertions;

namespace GITP.Tests.Unit;

/// <summary>
/// Pure-logic tests that mirror the state-transition rules encoded in
/// usp_UpdateTicketStatus (init.sql lines 638-665).
///
/// These tests validate the business rules as a pure C# state machine
/// without requiring a database, ensuring the rules themselves are correct.
/// </summary>
public class TicketStateMachineTests
{
    // ──────────────────────────────────────────────────────────────────────
    //  Helper — mirrors the SP logic
    // ──────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Returns the SP result code:
    ///   0  = transition allowed
    ///   1  = ticket not found (not tested here)
    ///   2  = not the submitter
    ///   3  = invalid transition
    ///   5  = requires IT company to close
    /// </summary>
    private static int EvaluateTransition(
        string currentStatus,
        string newStatus,
        string requestingRole,
        bool isSubmitter,
        bool isItCompany = true)
    {
        if (currentStatus == "已結案") return 3;

        bool isItStaff = requestingRole is "it_admin" or "it_assignee";
        bool isValid = false;

        if (isItStaff)
        {
            isValid =
                (currentStatus == "新建立"       && newStatus == "處理中") ||
                (currentStatus == "處理中"        && newStatus is "待使用者補充" or "待使用者確認" or "已解決" or "已結案") ||
                (currentStatus == "待使用者補充"  && newStatus == "處理中") ||
                (currentStatus == "待使用者確認"  && newStatus == "處理中") ||
                (currentStatus == "已解決"        && newStatus == "已結案");
        }
        else
        {
            if (isSubmitter)
            {
                isValid =
                    (currentStatus == "待使用者補充" && newStatus == "處理中") ||
                    (currentStatus == "待使用者確認" && newStatus is "已結案" or "處理中") ||
                    (currentStatus == "已解決"       && newStatus == "已結案");
            }
        }

        if (!isValid)
            return (!isItStaff && !isSubmitter) ? 2 : 3;

        // Code 5: closing requires IT company
        if (newStatus == "已結案" && !isItCompany)
            return 5;

        return 0;
    }

    // ──────────────────────────────────────────────────────────────────────
    //  IT Staff valid transitions
    // ──────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("新建立",      "處理中")]
    [InlineData("處理中",      "待使用者補充")]
    [InlineData("處理中",      "待使用者確認")]
    [InlineData("處理中",      "已解決")]
    [InlineData("處理中",      "已結案")]
    [InlineData("待使用者補充", "處理中")]
    [InlineData("待使用者確認", "處理中")]
    [InlineData("已解決",      "已結案")]
    public void ItAdmin_ValidTransitions_ReturnCode0(string from, string to)
    {
        EvaluateTransition(from, to, "it_admin", isSubmitter: false, isItCompany: true)
            .Should().Be(0);
    }

    [Theory]
    [InlineData("新建立",      "處理中")]
    [InlineData("處理中",      "待使用者補充")]
    [InlineData("待使用者補充", "處理中")]
    public void ItAssignee_ValidTransitions_ReturnCode0(string from, string to)
    {
        EvaluateTransition(from, to, "it_assignee", isSubmitter: false, isItCompany: true)
            .Should().Be(0);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  IT Staff invalid transitions
    // ──────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("新建立",      "已結案")]   // must go through 處理中 first
    [InlineData("新建立",      "已解決")]
    [InlineData("已解決",      "處理中")]   // cannot reopen resolved
    [InlineData("已結案",      "處理中")]   // terminal state
    [InlineData("已結案",      "新建立")]
    public void ItAdmin_InvalidTransitions_ReturnCode3(string from, string to)
    {
        EvaluateTransition(from, to, "it_admin", isSubmitter: false, isItCompany: true)
            .Should().Be(3);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Employee (submitter) valid transitions
    // ──────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("待使用者補充", "處理中")]    // submitter adds info, resumes
    [InlineData("待使用者確認", "已結案")]    // submitter confirms → close
    [InlineData("待使用者確認", "處理中")]    // submitter rejects resolution → reopen
    [InlineData("已解決",      "已結案")]    // submitter confirms closure
    public void Submitter_ValidTransitions_ReturnCode0(string from, string to)
    {
        // isItCompany = true so "已結案" is also allowed here (for non-IT submitter
        // scenarios we test separately below)
        EvaluateTransition(from, to, "employee", isSubmitter: true, isItCompany: true)
            .Should().Be(0);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Employee (non-submitter) → always code 2
    // ──────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("新建立",      "處理中")]
    [InlineData("待使用者補充", "處理中")]
    public void NonSubmitterEmployee_AnyTransition_ReturnCode2(string from, string to)
    {
        EvaluateTransition(from, to, "employee", isSubmitter: false)
            .Should().Be(2);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Closing requires IT company (code 5)
    // ──────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("it_admin")]
    [InlineData("it_assignee")]
    public void Closing_NonItCompanyStaff_ReturnCode5(string role)
    {
        EvaluateTransition("已解決", "已結案", role, isSubmitter: false, isItCompany: false)
            .Should().Be(5);
    }

    [Fact]
    public void Closing_ByItCompanyAdmin_ReturnCode0()
    {
        EvaluateTransition("已解決", "已結案", "it_admin", isSubmitter: false, isItCompany: true)
            .Should().Be(0);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Terminal state: 已結案 cannot transition to anything
    // ──────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("新建立")]
    [InlineData("處理中")]
    [InlineData("已解決")]
    [InlineData("已結案")]
    public void ClosedTicket_AnyTransition_ReturnCode3(string to)
    {
        EvaluateTransition("已結案", to, "it_admin", isSubmitter: false, isItCompany: true)
            .Should().Be(3);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Employee closing restrictions (code 5 when not IT company)
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public void SubmitterEmployee_CloseFromConfirmed_NonItCompany_ReturnCode5()
    {
        EvaluateTransition("待使用者確認", "已結案", "employee", isSubmitter: true, isItCompany: false)
            .Should().Be(5);
    }

    [Fact]
    public void SubmitterEmployee_CloseFromResolved_NonItCompany_ReturnCode5()
    {
        EvaluateTransition("已解決", "已結案", "employee", isSubmitter: true, isItCompany: false)
            .Should().Be(5);
    }
}
