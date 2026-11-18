using Mediator;

namespace Pakpost.Application.Internal.Workspaces.Commands;

public sealed record DeleteWorkspaceCommand(Guid ActorId, Guid WorkspaceId) : IRequest;
