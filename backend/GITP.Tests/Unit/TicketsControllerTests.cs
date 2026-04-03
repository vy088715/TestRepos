using FluentAssertions;
using GITP.API.DTOs;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using System.Security.Claims;
using GITP.API.Controllers;
using GITP.API.Services;

namespace GITP.Tests.Unit;

/// <summary>
/// Unit tests for TicketsController — verifies action results,
/// authorization checks, and error code mapping.
/// Uses Moq to stub ITicketService so no database is needed.
/// </summary>
public class TicketsControllerTests
{
    private static readonly Guid _adminId    = Guid.NewGuid();
    private static readonly Guid _employeeId = Guid.NewGuid();
    private static readonly Guid _companyId  = Guid.NewGuid();
    private static readonly Guid _ticketId   = Guid.NewGuid();

    // ──────────────────────────────────────────────────────────────────────
    //  Helpers
    // ──────────────────────────────────────────────────────────────────────

    private static TicketsController CreateController(
        Mock<ITicketService> svcMock,
        string role         = "it_admin",
        bool   isItCompany  = true)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, _adminId.ToString()),
            new("company_id",              _companyId.ToString()),
            new(ClaimTypes.Role,           role),
            new("is_it_company",           isItCompany ? "true" : "false"),
        };
        var identity   = new ClaimsIdentity(claims, "Test");
        var principal  = new ClaimsPrincipal(identity);
        var httpCtx    = new DefaultHttpContext { User = principal };

        var ctrl = new TicketsController(svcMock.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = httpCtx
            }
        };
        return ctrl;
    }

    private static TicketDetailResult MakeResult() =>
        new(
            new TicketDetailDto
            {
                Id        = _ticketId,
                TicketNo  = "GITP-202401-1001",
                Subject   = "Test ticket",
                Status    = "新建立",
                CompanyId = _companyId,
            },
            Enumerable.Empty<TicketMessageDto>(),
            Enumerable.Empty<AttachmentDto>()
        );

    // ──────────────────────────────────────────────────────────────────────
    //  GET /api/tickets
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetTickets_ReturnsOkWithTotalAndItems()
    {
        var svc = new Mock<ITicketService>();
        svc.Setup(s => s.GetTicketsAsync(It.IsAny<TicketFilterRequest>(), It.IsAny<RequestingUserContext>()))
           .ReturnsAsync((5, Enumerable.Empty<TicketListDto>()));

        var ctrl   = CreateController(svc);
        var result = await ctrl.GetTickets(new TicketFilterRequest());

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().NotBeNull();
    }

    // ──────────────────────────────────────────────────────────────────────
    //  GET /api/tickets/{id}
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetTicket_WhenFound_ReturnsOk()
    {
        var svc = new Mock<ITicketService>();
        svc.Setup(s => s.GetTicketByIdAsync(_ticketId, It.IsAny<RequestingUserContext>()))
           .ReturnsAsync(MakeResult());

        var ctrl   = CreateController(svc);
        var result = await ctrl.GetTicket(_ticketId);

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task GetTicket_WhenNotFound_Returns404()
    {
        var svc = new Mock<ITicketService>();
        svc.Setup(s => s.GetTicketByIdAsync(It.IsAny<Guid>(), It.IsAny<RequestingUserContext>()))
           .ReturnsAsync((TicketDetailResult?)null);

        var ctrl   = CreateController(svc);
        var result = await ctrl.GetTicket(Guid.NewGuid());

        result.Should().BeOfType<NotFoundResult>();
    }

    // ──────────────────────────────────────────────────────────────────────
    //  POST /api/tickets
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateTicket_ValidRequest_Returns201()
    {
        var svc = new Mock<ITicketService>();
        svc.Setup(s => s.CreateTicketAsync(It.IsAny<CreateTicketRequest>(), It.IsAny<RequestingUserContext>()))
           .ReturnsAsync(MakeResult());

        var ctrl   = CreateController(svc);
        var result = await ctrl.CreateTicket(new CreateTicketRequest
            { Subject = "Test", Description = "Desc" });

        result.Should().BeOfType<CreatedAtActionResult>();
    }

    [Fact]
    public async Task CreateTicket_InvalidModel_Returns400()
    {
        var svc    = new Mock<ITicketService>();
        var ctrl   = CreateController(svc);
        ctrl.ModelState.AddModelError("Subject", "Required");

        var result = await ctrl.CreateTicket(new CreateTicketRequest { Subject = "", Description = "" });

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    // ──────────────────────────────────────────────────────────────────────
    //  PUT /api/tickets/{id}/status — code → HTTP mapping
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateStatus_Code0_ReturnsOk()
    {
        var svc = new Mock<ITicketService>();
        svc.Setup(s => s.UpdateStatusAsync(_ticketId, "處理中", It.IsAny<RequestingUserContext>()))
           .ReturnsAsync((0, MakeResult()));

        var ctrl   = CreateController(svc);
        var result = await ctrl.UpdateStatus(_ticketId, new UpdateStatusRequest { Status = "處理中" });

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task UpdateStatus_Code1_Returns404()
    {
        var svc = new Mock<ITicketService>();
        svc.Setup(s => s.UpdateStatusAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<RequestingUserContext>()))
           .ReturnsAsync((1, (TicketDetailResult?)null));

        var ctrl   = CreateController(svc);
        var result = await ctrl.UpdateStatus(_ticketId, new UpdateStatusRequest { Status = "處理中" });

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task UpdateStatus_Code2_ReturnsForbid()
    {
        var svc = new Mock<ITicketService>();
        svc.Setup(s => s.UpdateStatusAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<RequestingUserContext>()))
           .ReturnsAsync((2, (TicketDetailResult?)null));

        var ctrl   = CreateController(svc);
        var result = await ctrl.UpdateStatus(_ticketId, new UpdateStatusRequest { Status = "處理中" });

        result.Should().BeOfType<ForbidResult>();
    }

    [Fact]
    public async Task UpdateStatus_Code3_Returns400()
    {
        var svc = new Mock<ITicketService>();
        svc.Setup(s => s.UpdateStatusAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<RequestingUserContext>()))
           .ReturnsAsync((3, (TicketDetailResult?)null));

        var ctrl   = CreateController(svc);
        var result = await ctrl.UpdateStatus(_ticketId, new UpdateStatusRequest { Status = "已結案" });

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task UpdateStatus_Code5_Returns403WithNotItCompanyCode()
    {
        var svc = new Mock<ITicketService>();
        svc.Setup(s => s.UpdateStatusAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<RequestingUserContext>()))
           .ReturnsAsync((5, (TicketDetailResult?)null));

        var ctrl   = CreateController(svc, isItCompany: false);
        var result = await ctrl.UpdateStatus(_ticketId, new UpdateStatusRequest { Status = "已結案" });

        var obj = result.Should().BeOfType<ObjectResult>().Subject;
        obj.StatusCode.Should().Be(403);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  PUT /api/tickets/{id}/assign — admin only
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task AssignTicket_AsEmployee_ReturnsForbid()
    {
        var svc    = new Mock<ITicketService>();
        var ctrl   = CreateController(svc, role: "employee");

        var result = await ctrl.AssignTicket(_ticketId, new AssignTicketRequest { AssigneeId = Guid.NewGuid() });

        result.Should().BeOfType<ForbidResult>();
    }

    [Fact]
    public async Task AssignTicket_AsAdmin_WhenTicketFound_ReturnsOk()
    {
        var svc = new Mock<ITicketService>();
        svc.Setup(s => s.AssignTicketAsync(_ticketId, It.IsAny<Guid>(), It.IsAny<RequestingUserContext>()))
           .ReturnsAsync(MakeResult());

        var ctrl   = CreateController(svc, role: "it_admin");
        var result = await ctrl.AssignTicket(_ticketId, new AssignTicketRequest { AssigneeId = Guid.NewGuid() });

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task AssignTicket_AsAdmin_WhenTicketNotFound_Returns404()
    {
        var svc = new Mock<ITicketService>();
        svc.Setup(s => s.AssignTicketAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<RequestingUserContext>()))
           .ReturnsAsync((TicketDetailResult?)null);

        var ctrl   = CreateController(svc, role: "it_admin");
        var result = await ctrl.AssignTicket(_ticketId, new AssignTicketRequest { AssigneeId = Guid.NewGuid() });

        result.Should().BeOfType<NotFoundResult>();
    }

    // ──────────────────────────────────────────────────────────────────────
    //  PUT /api/tickets/{id}/transfer
    // ──────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task TransferTicket_AsItAdmin_WhenSuccess_ReturnsOk()
    {
        var svc = new Mock<ITicketService>();
        svc.Setup(s => s.TransferTicketAsync(_ticketId, It.IsAny<Guid>(), It.IsAny<string?>(), It.IsAny<RequestingUserContext>()))
           .ReturnsAsync((0, MakeResult()));

        var ctrl   = CreateController(svc, role: "it_admin");
        var result = await ctrl.TransferTicket(_ticketId, new TransferTicketRequest { ToHandlerId = Guid.NewGuid() });

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task TransferTicket_AsEmployee_ReturnsForbid()
    {
        var svc    = new Mock<ITicketService>();
        var ctrl   = CreateController(svc, role: "employee");

        var result = await ctrl.TransferTicket(_ticketId, new TransferTicketRequest { ToHandlerId = Guid.NewGuid() });

        result.Should().BeOfType<ForbidResult>();
    }
}

