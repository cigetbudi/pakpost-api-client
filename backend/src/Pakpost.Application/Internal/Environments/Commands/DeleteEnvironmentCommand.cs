using Mediator;

namespace Pakpost.Application.Internal.Environments.Commands;

public sealed record DeleteEnvironmentCommand(Guid ActorId, Guid WorkspaceId, Guid EnvironmentId) : IRequest;
