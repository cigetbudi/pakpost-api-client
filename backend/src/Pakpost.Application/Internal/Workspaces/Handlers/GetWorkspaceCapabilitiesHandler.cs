using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.Application.Internal.Workspaces;

public sealed class GetWorkspaceCapabilitiesHandler(IWorkspaceRepository workspaces)
    : IRequestHandler<GetWorkspaceCapabilitiesQuery, WorkspaceCapabilitiesDto>
{
    public async ValueTask<WorkspaceCapabilitiesDto> Handle(GetWorkspaceCapabilitiesQuery query, CancellationToken ct)
    => new(await WorkspacePermissions.CanCreateWorkspaceAsync(workspaces, query.ActorId, ct));
}
