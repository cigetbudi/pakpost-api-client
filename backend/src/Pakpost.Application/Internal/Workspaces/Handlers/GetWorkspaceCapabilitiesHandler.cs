using Mediator;
using Microsoft.Extensions.Configuration;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Workspaces.DTOs;
using Pakpost.Application.Internal.Workspaces.Queries;

namespace Pakpost.Application.Internal.Workspaces.Handlers;

public sealed class GetWorkspaceCapabilitiesHandler(
    IUserRepository users, IUserExternalIdentityRepository identities, IConfiguration configuration)
    : IRequestHandler<GetWorkspaceCapabilitiesQuery, WorkspaceCapabilitiesDto>
{
    public async ValueTask<WorkspaceCapabilitiesDto> Handle(GetWorkspaceCapabilitiesQuery query, CancellationToken ct)
    {
        var policy = WorkspaceDeploymentPolicy.From(configuration);
        return new(await policy.CanCreateAsync(users, identities, query.ActorId, ct),
            policy.Mode, policy.MaxMembers);
    }
}
