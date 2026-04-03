using System.Data;
using ClosedXML.Excel;
using Dapper;
using GITP.API.Data;
using GITP.API.DTOs;
using Microsoft.Data.SqlClient;

namespace GITP.API.Services;

public class ExportService
{
    private readonly IDbConnectionFactory _connectionFactory;
    private readonly ILogger<ExportService> _logger;
    private readonly string _exportPath;

    public ExportService(IDbConnectionFactory connectionFactory, IConfiguration config, ILogger<ExportService> logger)
    {
        _connectionFactory = connectionFactory;
        _logger = logger;
        _exportPath = config["Storage:ExportsPath"] ?? "/app/exports";
        Directory.CreateDirectory(_exportPath);
    }

    public async Task<ExportJobDto> StartExportAsync(Guid requestedBy, string? filtersJson)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        var parameters = new DynamicParameters();
        parameters.Add("RequestedBy", requestedBy);
        parameters.Add("FiltersJson", filtersJson);

        var job = await connection.QueryFirstAsync<ExportJobDto>(
            "usp_CreateExportJob", parameters, commandType: CommandType.StoredProcedure);

        // Start background processing
        _ = Task.Run(() => ProcessExportAsync(job.Id, filtersJson));

        return job;
    }

    public async Task<ExportJobDto?> GetJobStatusAsync(Guid jobId)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        return await connection.QueryFirstOrDefaultAsync<ExportJobDto>(
            "usp_GetExportJob", new { JobId = jobId }, commandType: CommandType.StoredProcedure);
    }

    public async Task<(string? FilePath, ExportJobDto? Job)> GetExportFileAsync(Guid jobId)
    {
        await using var connection = _connectionFactory.CreateConnection();
        await connection.OpenAsync();

        var job = await connection.QueryFirstOrDefaultAsync<ExportJobDto>(
            "usp_GetExportJob", new { JobId = jobId }, commandType: CommandType.StoredProcedure);

        if (job == null || job.Status != "completed" || string.IsNullOrEmpty(job.ResultPath))
            return (null, job);

        return (job.ResultPath, job);
    }

    private async Task ProcessExportAsync(Guid jobId, string? filtersJson)
    {
        await using var connection = _connectionFactory.CreateConnection();
        try
        {
            await connection.OpenAsync();

            // Set session context as it_admin to bypass RLS
            await connection.ExecuteAsync(
                "usp_SetSessionContext",
                new { CompanyId = (string?)null, UserId = (string?)null, Roles = "it_admin" },
                commandType: CommandType.StoredProcedure);

            // Parse filters
            ExportFilters? filters = null;
            if (!string.IsNullOrEmpty(filtersJson))
            {
                try
                {
                    filters = System.Text.Json.JsonSerializer.Deserialize<ExportFilters>(filtersJson,
                        new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                }
                catch { /* ignore parse errors */ }
            }

            var parameters = new DynamicParameters();
            parameters.Add("CompanyIdFilter", filters?.CompanyId);
            parameters.Add("StartDate", filters?.StartDate);
            parameters.Add("EndDate", filters?.EndDate);
            parameters.Add("Status", filters?.Status);

            var tickets = await connection.QueryAsync<ExportTicketDto>(
                "usp_GetTicketsForExport", parameters, commandType: CommandType.StoredProcedure);

            // Generate Excel
            var fileName = $"GITP_Export_{DateTime.UtcNow:yyyyMMddHHmmss}_{jobId:N}.xlsx";
            var filePath = Path.Combine(_exportPath, fileName);

            using (var workbook = new XLWorkbook())
            {
                var ws = workbook.Worksheets.Add("案件報表");

                // Header
                ws.Cell(1, 1).Value = "案件編號";
                ws.Cell(1, 2).Value = "公司名稱";
                ws.Cell(1, 3).Value = "提報人";
                ws.Cell(1, 4).Value = "主旨";
                ws.Cell(1, 5).Value = "狀態";
                ws.Cell(1, 6).Value = "擔當者";
                ws.Cell(1, 7).Value = "提報時間";
                ws.Cell(1, 8).Value = "首次回應時間";
                ws.Cell(1, 9).Value = "結案時間";

                var row = 2;
                foreach (var t in tickets)
                {
                    ws.Cell(row, 1).Value = t.TicketNo;
                    ws.Cell(row, 2).Value = t.CompanyName;
                    ws.Cell(row, 3).Value = t.SubmitterName;
                    ws.Cell(row, 4).Value = t.Subject;
                    ws.Cell(row, 5).Value = t.Status;
                    ws.Cell(row, 6).Value = t.AssigneeName ?? "";
                    ws.Cell(row, 7).Value = t.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss");
                    ws.Cell(row, 8).Value = t.FirstResponseAt?.ToString("yyyy-MM-dd HH:mm:ss") ?? "";
                    ws.Cell(row, 9).Value = t.ClosedAt?.ToString("yyyy-MM-dd HH:mm:ss") ?? "";
                    row++;
                }

                ws.Columns().AdjustToContents();
                workbook.SaveAs(filePath);
            }

            // Update job as completed
            await connection.ExecuteAsync(
                "usp_UpdateExportJob",
                new { JobId = jobId, Status = "completed", ResultPath = filePath },
                commandType: CommandType.StoredProcedure);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Export job {JobId} failed", jobId);
            try
            {
                await connection.ExecuteAsync(
                    "usp_UpdateExportJob",
                    new { JobId = jobId, Status = "failed", ResultPath = (string?)null },
                    commandType: CommandType.StoredProcedure);
            }
            catch { /* ignore */ }
        }
    }
}

public class ExportFilters
{
    public Guid? CompanyId { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public string? Status { get; set; }
}
