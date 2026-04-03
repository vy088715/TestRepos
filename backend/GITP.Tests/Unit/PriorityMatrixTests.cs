using FluentAssertions;

namespace GITP.Tests.Unit;

/// <summary>
/// Tests for the 3×3 severity × urgency priority matrix.
/// Priority formula: CEILING((severity + urgency - 1) / 2)
///   P1 Critical (紅): (1,1),(1,2),(2,1)
///   P2 High     (橘): (1,3),(2,2),(3,1),(2,3),(3,2)
///   P3 Normal   (綠): (3,3)
/// </summary>
public class PriorityMatrixTests
{
    // Mirror of the front-end getPriority and the ClassificationDto.PriorityLevel
    private static int GetPriority(int severity, int urgency) =>
        (int)Math.Ceiling((severity + urgency - 1) / 2.0);

    // ──────────────────────────────────────────────────────────────────────
    //  Full 3×3 matrix
    // ──────────────────────────────────────────────────────────────────────

    [Theory]
    // P1 – Critical: ceil((s+u-1)/2) = 1
    [InlineData(1, 1, 1)]   // ceil(0.5) = 1
    [InlineData(1, 2, 1)]   // ceil(1.0) = 1
    [InlineData(2, 1, 1)]   // ceil(1.0) = 1
    // P2 – High: ceil((s+u-1)/2) = 2
    [InlineData(1, 3, 2)]   // ceil(1.5) = 2
    [InlineData(2, 2, 2)]   // ceil(1.5) = 2
    [InlineData(3, 1, 2)]   // ceil(1.5) = 2
    [InlineData(2, 3, 2)]   // ceil(2.0) = 2
    [InlineData(3, 2, 2)]   // ceil(2.0) = 2
    // P3 – Normal: ceil((s+u-1)/2) = 3
    [InlineData(3, 3, 3)]   // ceil(2.5) = 3
    public void GetPriority_Matrix_MatchesExpected(int s, int u, int expected)
    {
        GetPriority(s, u).Should().Be(expected);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Boundary: highest severity or urgency
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public void GetPriority_BothMax_IsP3()
    {
        GetPriority(3, 3).Should().Be(3);
    }

    [Fact]
    public void GetPriority_BothMin_IsP1()
    {
        GetPriority(1, 1).Should().Be(1);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Symmetry: severity and urgency are interchangeable
    // ──────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData(1, 2)]
    [InlineData(1, 3)]
    [InlineData(2, 3)]
    public void GetPriority_IsSymmetric(int a, int b)
    {
        GetPriority(a, b).Should().Be(GetPriority(b, a));
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Range: priority is always between 1 and 3
    // ──────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData(1, 1)]
    [InlineData(1, 2)]
    [InlineData(1, 3)]
    [InlineData(2, 1)]
    [InlineData(2, 2)]
    [InlineData(2, 3)]
    [InlineData(3, 1)]
    [InlineData(3, 2)]
    [InlineData(3, 3)]
    public void GetPriority_AlwaysInRange1To3(int s, int u)
    {
        GetPriority(s, u).Should().BeInRange(1, 3);
    }
}
