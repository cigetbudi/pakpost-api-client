using Mediator;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Workspaces.DTOs;
using Pakpost.Application.Internal.Workspaces.Queries;

namespace Pakpost.Application.Internal.Workspaces.Handlers;

public sealed class ListWorkspaceMembersHandler(IWorkspaceRepository workspaces, IUserRepository users)
    : IRequestHandler<ListWorkspaceMembersQuery, IReadOnlyList<MemberDto>>
{
    public async ValueTask<IReadOnlyList<MemberDto>> Handle(ListWorkspaceMembersQuery query, CancellationToken ct)
    {
        await WorkspacePermissions.RequireMemberAsync(workspaces, query.WorkspaceId, query.ActorId, ct);
        var memberships = await workspaces.ListMembersAsync(query.WorkspaceId, ct);
        var result = new List<MemberDto>();
        foreach (var m in memberships)
        {
            var user = await users.FindByIdAsync(m.UserId, ct);
            if (user is not null)
            {
                var roles = WorkspacePermissions.RolesOf(m);
                result.Add(new(m.UserId, user.Email, user.DisplayName, m.Role, roles,
                    WorkspacePermissions.EffectivePermissions(roles)));
            }
        }
        return result;
    }
}
