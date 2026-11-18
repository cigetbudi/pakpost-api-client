using Mediator;
using Pakpost.Application.Internal.Workspaces.DTOs;

namespace Pakpost.Application.Internal.Workspaces.Commands;

public sealed record CreateWorkspaceCommand(Guid ActorId, string Name) : IRequest<WorkspaceDto>;
