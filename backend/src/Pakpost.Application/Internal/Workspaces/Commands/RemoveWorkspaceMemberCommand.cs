using Mediator;

namespace Pakpost.Application.Internal.Workspaces.Commands;

public sealed record RemoveWorkspaceMemberCommand(Guid ActorId, Guid WorkspaceId, Guid UserId) : IRequest;
