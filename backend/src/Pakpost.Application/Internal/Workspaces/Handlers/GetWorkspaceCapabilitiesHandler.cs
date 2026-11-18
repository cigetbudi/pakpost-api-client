using Mediator;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Workspaces.DTOs;
using Pakpost.Application.Internal.Workspaces.Queries;

namespace Pakpost.Application.Internal.Workspaces.Handlers;

public sealed class GetWorkspaceCapabilitiesHandler(IWorkspaceRepository workspaces)
    : IRequestHandler<GetWorkspaceCapabilitiesQuery, WorkspaceCapabilitiesDto>
{
    public async ValueTask<WorkspaceCapabilitiesDto> Handle(GetWorkspaceCapabilitiesQuery query, CancellationToken ct)
    => new(await WorkspacePermissions.CanCreateWorkspaceAsync(workspaces, query.ActorId, ct));
}
