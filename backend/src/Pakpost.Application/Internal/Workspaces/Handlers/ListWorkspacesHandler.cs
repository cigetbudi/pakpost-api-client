using Mediator;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Workspaces.DTOs;
using Pakpost.Application.Internal.Workspaces.Queries;

namespace Pakpost.Application.Internal.Workspaces.Handlers;

public sealed class ListWorkspacesHandler(IWorkspaceRepository workspaces)
    : IRequestHandler<ListWorkspacesQuery, IReadOnlyList<WorkspaceDto>>
{
    public async ValueTask<IReadOnlyList<WorkspaceDto>> Handle(ListWorkspacesQuery request, CancellationToken ct)
    => (await workspaces.ListForUserAsync(request.ActorId, ct))
    .Select(x => new WorkspaceDto(x.Id, x.Name, x.OwnerUserId)).ToArray();
}
