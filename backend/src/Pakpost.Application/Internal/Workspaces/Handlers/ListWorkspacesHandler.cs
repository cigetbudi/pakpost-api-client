using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.Application.Internal.Workspaces;

public sealed class ListWorkspacesHandler(IWorkspaceRepository workspaces)
    : IRequestHandler<ListWorkspacesQuery, IReadOnlyList<WorkspaceDto>>
{
    public async ValueTask<IReadOnlyList<WorkspaceDto>> Handle(ListWorkspacesQuery request, CancellationToken ct)
    => (await workspaces.ListForUserAsync(request.ActorId, ct))
    .Select(x => new WorkspaceDto(x.Id, x.Name, x.OwnerUserId)).ToArray();
}
