namespace GITP.API.DTOs;

public class TicketStatsRequest
{
    public string Period { get; set; } = "month"; // "month" or "year"
    public int Year { get; set; }
    public int? Month { get; set; }
}

public class CompanyTicketStatsDto
{
    public Guid CompanyId { get; set; }
    public string CompanyName { get; set; } = "";
    public int Total { get; set; }
    public int StatusNew { get; set; }
    public int StatusProcessing { get; set; }
    public int StatusPendingSupply { get; set; }
    public int StatusPendingConfirm { get; set; }
    public int StatusResolved { get; set; }
    public int StatusClosed { get; set; }
    public int SeverityHigh { get; set; }
    public int SeverityMed { get; set; }
    public int SeverityLow { get; set; }
    public int SeverityUnset { get; set; }
    public int UrgencyHigh { get; set; }
    public int UrgencyMed { get; set; }
    public int UrgencyLow { get; set; }
    public int UrgencyUnset { get; set; }
    public double? AvgCloseHours { get; set; }
    // Computed: in-flight (not closed/resolved)
    public int InProgress => StatusNew + StatusProcessing + StatusPendingSupply + StatusPendingConfirm;
}

public class TicketStatsSummaryDto
{
    public int GrandTotal { get; set; }
    public int StatusNew { get; set; }
    public int StatusProcessing { get; set; }
    public int StatusPendingSupply { get; set; }
    public int StatusPendingConfirm { get; set; }
    public int StatusResolved { get; set; }
    public int StatusClosed { get; set; }
    public DateTime PeriodStart { get; set; }
    public DateTime PeriodEnd { get; set; }
}

public class TicketStatsResponse
{
    public TicketStatsSummaryDto Summary { get; set; } = new();
    public List<CompanyTicketStatsDto> ByCompany { get; set; } = new();
    public string Period { get; set; } = "";
    public int Year { get; set; }
    public int? Month { get; set; }
}
