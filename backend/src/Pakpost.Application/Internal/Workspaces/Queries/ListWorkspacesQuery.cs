using Mediator;
using Pakpost.Application.Internal.Workspaces.DTOs;

namespace Pakpost.Application.Internal.Workspaces.Queries;

public sealed record ListWorkspacesQuery(Guid ActorId) : IRequest<IReadOnlyList<WorkspaceDto>>;
