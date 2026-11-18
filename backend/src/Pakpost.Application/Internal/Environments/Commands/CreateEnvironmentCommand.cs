using Mediator;
using Pakpost.Application.Internal.Environments.DTOs;

namespace Pakpost.Application.Internal.Environments.Commands;

public sealed record CreateEnvironmentCommand(Guid ActorId, Guid WorkspaceId, string Name) : IRequest<RequestEnvironmentDto>;
