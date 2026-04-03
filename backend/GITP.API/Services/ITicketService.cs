using GITP.API.DTOs;

namespace GITP.API.Services;

/// <summary>
/// Abstraction over TicketService, used for dependency injection and testability.
/// </summary>
public interface ITicketService
{
    Task<(int TotalCount, IEnumerable<TicketListDto> Items)> GetTicketsAsync(
        TicketFilterRequest filter, RequestingUserContext ctx);

    Task<TicketDetailResult?> GetTicketByIdAsync(Guid ticketId, RequestingUserContext ctx);

    Task<TicketDetailResult?> CreateTicketAsync(CreateTicketRequest request, RequestingUserContext ctx);

    Task<(int Code, TicketDetailResult? Result)> UpdateStatusAsync(
        Guid ticketId, string newStatus, RequestingUserContext ctx);

    Task<TicketDetailResult?> AssignTicketAsync(
        Guid ticketId, Guid assigneeId, RequestingUserContext ctx);

    Task<(int Code, TicketDetailResult? Result)> TransferTicketAsync(
        Guid ticketId, Guid toHandlerId, string? note, RequestingUserContext ctx);

    Task<IEnumerable<TicketHandlerHistoryDto>> GetHandlerHistoryAsync(Guid ticketId);

    Task<BatchAssignResult> BatchAssignAsync(
        List<Guid> ticketIds, Guid assigneeId, RequestingUserContext ctx);

    Task<TicketMessageDto?> AddMessageAsync(
        Guid ticketId, string content, bool isItReply, RequestingUserContext ctx);

    Task<IEnumerable<TicketMessageDto>> GetMessagesAsync(
        Guid ticketId, RequestingUserContext ctx);

    Task<IEnumerable<ItAdminEmailDto>> GetItAdminsAsync();

    Task<IEnumerable<UserDto>> GetItStaffAsync();
}
