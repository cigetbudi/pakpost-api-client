using Mediator;
using Pakpost.Application.Internal.Environments.DTOs;

namespace Pakpost.Application.Internal.Environments.Commands;

public sealed record UpdateEnvironmentCommand(
    Guid ActorId,
    Guid WorkspaceId,
    Guid EnvironmentId,
    string Name,
    List<EnvironmentVariableDto> Variables
) : IRequest<RequestEnvironmentDto>;
